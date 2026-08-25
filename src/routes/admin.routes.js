const express = require("express");
const { authenticate, authorize } = require("../middlewares/auth");
const { sequelize } = require("../database");
const { QueryTypes } = require("sequelize");
const { getLeads, getCustomField, syncRevendasToRD, syncRepresentantesToRD } = require("../services/rd.leads.service");
const { User, Revenda, Representante } = require("../database");
const bcrypt = require("bcryptjs");
const { invalidateConfigCache } = require("./config.routes");
const multer = require("multer");
const XLSX = require("xlsx");

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

const router = express.Router();

const SB_SISTEMAS_URL = 'https://bmepxcnrsofofoswubuu.supabase.co';
const SB_SISTEMAS_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJtZXB4Y25yc29mb2Zvc3d1YnV1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk3MTczNzMsImV4cCI6MjA5NTI5MzM3M30.S55ouFczRYlUYNFf5PotYKXBPT5idypTSmbzR-x2Pk0';

async function sbSistemas(path, method = 'GET', body = null) {
    const headers = {
        'apikey': SB_SISTEMAS_ANON,
        'Authorization': `Bearer ${SB_SISTEMAS_ANON}`,
        'Content-Type': 'application/json',
        'Prefer': method === 'POST' ? 'return=representation' : method === 'PATCH' ? 'return=representation' : ''
    };
    const opts = { method, headers };
    if (body) opts.body = JSON.stringify(body);
    const res = await fetch(`${SB_SISTEMAS_URL}/rest/v1${path}`, opts);
    if (!res.ok) { const e = await res.text(); throw new Error(`Supabase ${res.status}: ${e}`); }
    return (method === 'GET' || method === 'POST' || method === 'PATCH') ? res.json() : res;
}

async function fetchAllRevendasAtivas() {
    return await sbSistemas('/comercial_revendas_bmax?ativo=eq.true&select=nome&order=nome');
}

async function syncRevendasAfterChange() {
    try {
        const revendas = await fetchAllRevendasAtivas();
        const nomes = revendas.map(r => r.nome);
        return await syncRevendasToRD(nomes);
    } catch (err) {
        console.error("Erro sync revendas → RD:", err);
        return { error: err.message };
    }
}

router.get("/revendas-rd", authenticate, authorize(["adm"]), async (req, res) => {
    try {
        const { RD_CUSTOM_FIELDS } = require("../config/constants");
        const rdToken = process.env.RD_CRM_TOKEN;
        const cfRes = await fetch(`https://crm.rdstation.com/api/v1/custom_fields?token=${rdToken}`);
        const allFields = await cfRes.json();
        const revendaField = allFields.find(f => f.id === RD_CUSTOM_FIELDS.REVENDA_LOJA);
        const optsRD = (revendaField?.opts || []).map(o => o.trim()).filter(o => o && o !== "Sem Revenda");

        const allDeals = await getLeads("admin", "adm");
        const usedSet = new Set();
        const invalidSet = new Set();
        const optsSet = new Set(optsRD);
        for (const d of allDeals) {
            const rev = getCustomField(d, "REVENDA/LOJA");
            if (!rev || rev === "?????" || !rev.trim()) continue;
            const trimmed = rev.trim();
            usedSet.add(trimmed);
            if (!optsSet.has(trimmed)) invalidSet.add(trimmed);
        }

        const grupos = await sequelize.query(
            `SELECT revenda_rd, grupo, email_responsavel FROM bmax_grupos`,
            { type: QueryTypes.SELECT }
        );
        const grupoMap = {};
        for (const g of grupos) grupoMap[g.revenda_rd] = g;

        const result = optsRD.sort().map(nome => ({
            nome,
            grupo: grupoMap[nome]?.grupo || null,
            email_responsavel: grupoMap[nome]?.email_responsavel || null,
            leads: usedSet.has(nome) ? true : false
        }));

        const alertas = Array.from(invalidSet).sort().map(nome => ({
            nome,
            msg: "Lead preenchido com revenda que nao existe na lista do RD"
        }));

        res.json({ revendas: result, alertas });
    } catch (err) {
        console.error("Erro revendas-rd:", err);
        res.status(500).json({ error: err.message });
    }
});

router.get("/grupos", authenticate, authorize(["adm"]), async (req, res) => {
    try {
        const rows = await sequelize.query(
            `SELECT grupo, array_agg(revenda_rd ORDER BY revenda_rd) as revendas,
                    (array_agg(email_responsavel))[1] as email_responsavel
             FROM bmax_grupos WHERE grupo IS NOT NULL
             GROUP BY grupo ORDER BY grupo`,
            { type: QueryTypes.SELECT }
        );
        res.json(rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.post("/grupos", authenticate, authorize(["adm"]), async (req, res) => {
    try {
        const { revenda_rd, grupo, email_responsavel } = req.body;
        if (!revenda_rd) return res.status(400).json({ error: "revenda_rd obrigatorio" });

        await sequelize.query(
            `INSERT INTO bmax_grupos (revenda_rd, grupo, email_responsavel)
             VALUES (:revenda_rd, :grupo, :email_responsavel)
             ON CONFLICT (revenda_rd) DO UPDATE SET grupo = :grupo, email_responsavel = :email_responsavel`,
            { replacements: { revenda_rd, grupo: grupo || null, email_responsavel: email_responsavel || null }, type: QueryTypes.INSERT }
        );

        if (grupo && email_responsavel) {
            const allEmails = await sequelize.query(
                `SELECT DISTINCT email_responsavel FROM bmax_grupos WHERE grupo = :grupo AND email_responsavel IS NOT NULL`,
                { replacements: { grupo }, type: QueryTypes.SELECT }
            );
            const emails = allEmails.map(r => r.email_responsavel);
            if (emails.length > 0) {
                await sequelize.query(
                    `UPDATE "Revendas" SET grupo = :grupo WHERE user_id IN (
                        SELECT id FROM "Users" WHERE username IN (:emails)
                    )`,
                    { replacements: { grupo, emails }, type: QueryTypes.UPDATE }
                );
            }
        }

        res.json({ ok: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.get("/users", authenticate, authorize(["adm"]), async (req, res) => {
    try {
        const users = await User.findAll({
            attributes: ["id", "username", "role"],
            order: [["role", "ASC"], ["username", "ASC"]]
        });

        const result = [];
        for (const u of users) {
            const entry = { id: u.id, username: u.username, role: u.role };
            if (u.role === "revenda") {
                const rev = await Revenda.findOne({ where: { user_id: u.id } });
                if (rev) {
                    entry.revenda = rev.name;
                    entry.cnpj = rev.cnpj;
                    entry.cidade = rev.cidade;
                    entry.estado = rev.estado;
                    entry.grupo = rev.grupo;
                }
            } else if (u.role === "representante") {
                const rep = await Representante.findOne({ where: { user_id: u.id } });
                if (rep) entry.email = rep.email;
            }
            result.push(entry);
        }
        res.json(result);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.delete("/users/:id", authenticate, authorize(["adm"]), async (req, res) => {
    try {
        const { id } = req.params;
        const user = await User.findByPk(id);
        if (!user) return res.status(404).json({ error: "Usuario nao encontrado" });
        if (user.id === req.user.id) return res.status(400).json({ error: "Nao pode excluir a si mesmo" });

        await user.destroy();
        res.json({ ok: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.patch("/users/:id/grupo", authenticate, authorize(["adm"]), async (req, res) => {
    try {
        const { id } = req.params;
        const { grupo } = req.body;
        const rev = await Revenda.findOne({ where: { user_id: id } });
        if (!rev) return res.status(404).json({ error: "Revenda nao encontrada" });

        rev.grupo = grupo || null;
        await rev.save();
        res.json({ ok: true, grupo: rev.grupo });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.patch("/users/:id/reset-password", authenticate, authorize(["adm"]), async (req, res) => {
    try {
        const { id } = req.params;
        const { password } = req.body;
        if (!password || password.length < 6) return res.status(400).json({ error: "Senha deve ter no minimo 6 caracteres" });

        const user = await User.findByPk(id);
        if (!user) return res.status(404).json({ error: "Usuario nao encontrado" });

        user.password = await bcrypt.hash(password, 10);
        await user.save();
        res.json({ ok: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ─── CRUD Revendas BMax (Supabase boxer-sistemas) ───────────

router.get("/revendas-bmax", authenticate, authorize(["adm"]), async (req, res) => {
    try {
        const rows = await sbSistemas('/comercial_revendas_bmax?select=id,nome,cidade,estado,classe,ativo,rep,grupo&order=nome');
        res.json(rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.post("/revendas-bmax", authenticate, authorize(["adm"]), async (req, res) => {
    try {
        const { nome, cidade, estado, classe, rep, grupo } = req.body;
        if (!nome || !nome.trim()) return res.status(400).json({ error: "Nome é obrigatório" });
        const row = await sbSistemas('/comercial_revendas_bmax', 'POST', {
            nome: nome.trim(), cidade: cidade || null, estado: estado || null,
            classe: classe || null, rep: rep || null, grupo: grupo || null, ativo: true
        });
        invalidateConfigCache();
        const sync = await syncRevendasAfterChange();
        res.json({ revenda: row[0] || row, sync });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.patch("/revendas-bmax/:id", authenticate, authorize(["adm"]), async (req, res) => {
    try {
        const { id } = req.params;
        const updates = {};
        for (const key of ['nome', 'cidade', 'estado', 'classe', 'rep', 'grupo', 'ativo']) {
            if (req.body[key] !== undefined) updates[key] = req.body[key];
        }
        if (Object.keys(updates).length === 0) return res.status(400).json({ error: "Nenhum campo para atualizar" });
        updates.editado_em = new Date().toISOString();
        updates.editado_por = req.user.username || req.user.email || 'admin';

        const row = await sbSistemas(`/comercial_revendas_bmax?id=eq.${id}`, 'PATCH', updates);
        invalidateConfigCache();
        const needsSync = 'nome' in updates || 'ativo' in updates;
        const sync = needsSync ? await syncRevendasAfterChange() : null;
        res.json({ revenda: row[0] || row, sync });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.post("/sync-revendas-rd", authenticate, authorize(["adm"]), async (req, res) => {
    try {
        const result = await syncRevendasAfterChange();
        if (result.error) return res.status(500).json({ error: result.error });
        res.json({ ok: true, ...result });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.post("/sync-reps-rd", authenticate, authorize(["adm"]), async (req, res) => {
    try {
        const rows = await sbSistemas('/comercial_bmax_config?chave=eq.representantes_bmax&select=valor');
        const reps = rows[0]?.valor ? JSON.parse(rows[0].valor) : [];
        const nomesAtivos = reps.filter(r => r.ativo).map(r => r.nome);
        const result = await syncRepresentantesToRD(nomesAtivos);
        if (result.error) return res.status(500).json({ error: result.error });
        res.json({ ok: true, ...result });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ─── CRUD Representantes (comercial_bmax_config) ────────────

router.get("/representantes-bmax", authenticate, authorize(["adm"]), async (req, res) => {
    try {
        const rows = await sbSistemas('/comercial_bmax_config?chave=eq.representantes_bmax&select=valor');
        const reps = rows[0]?.valor ? JSON.parse(rows[0].valor) : [];
        res.json(reps);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.put("/representantes-bmax", authenticate, authorize(["adm"]), async (req, res) => {
    try {
        const { representantes } = req.body;
        if (!Array.isArray(representantes)) return res.status(400).json({ error: "Array de representantes esperado" });
        await sbSistemas('/comercial_bmax_config?chave=eq.representantes_bmax', 'PATCH', {
            valor: JSON.stringify(representantes)
        });
        invalidateConfigCache();
        let sync = null;
        try {
            const nomesAtivos = representantes.filter(r => r.ativo).map(r => r.nome);
            sync = await syncRepresentantesToRD(nomesAtivos);
        } catch (e) { console.error("Erro sync reps → RD:", e); sync = { error: e.message }; }
        res.json({ ok: true, count: representantes.length, sync });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ─── Cobertura Geográfica (comercial_bmax_cobertura) ───────

async function fetchAllCobertura(select = 'ibge_codigo,cidade,estado,ddd,mesorregiao,rep_bmax') {
    const all = [];
    const PAGE = 1000;
    let offset = 0;
    while (true) {
        const rows = await sbSistemas(`/comercial_bmax_cobertura?select=${select}&order=estado,cidade&limit=${PAGE}&offset=${offset}`);
        all.push(...rows);
        if (rows.length < PAGE) break;
        offset += PAGE;
    }
    return all;
}

router.get("/cobertura", authenticate, authorize(["adm"]), async (req, res) => {
    try {
        const rows = await fetchAllCobertura();
        res.json(rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.get("/cobertura/resumo", authenticate, authorize(["adm"]), async (req, res) => {
    try {
        const rows = await fetchAllCobertura('rep_bmax,estado');
        const resumo = {};
        for (const r of rows) {
            const rep = r.rep_bmax || "(Sem rep)";
            if (!resumo[rep]) resumo[rep] = { total: 0, estados: new Set() };
            resumo[rep].total++;
            if (r.estado) resumo[rep].estados.add(r.estado);
        }
        const result = Object.entries(resumo).map(([rep, d]) => ({
            rep, total: d.total, estados: [...d.estados].sort().join(", ")
        })).sort((a, b) => b.total - a.total);
        res.json(result);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.patch("/cobertura/:ibge", authenticate, authorize(["adm"]), async (req, res) => {
    try {
        const { ibge } = req.params;
        const { rep_bmax } = req.body;
        const row = await sbSistemas(`/comercial_bmax_cobertura?ibge_codigo=eq.${ibge}`, 'PATCH', {
            rep_bmax: rep_bmax || null
        });
        res.json({ ok: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.post("/cobertura", authenticate, authorize(["adm"]), async (req, res) => {
    try {
        const { ibge_codigo, cidade, estado, ddd, mesorregiao, rep_bmax } = req.body;
        if (!ibge_codigo || !cidade || !estado) return res.status(400).json({ error: "ibge_codigo, cidade e estado sao obrigatorios" });
        const row = await sbSistemas('/comercial_bmax_cobertura', 'POST', {
            ibge_codigo, cidade: cidade.trim(), estado: estado.trim().toUpperCase(),
            ddd: ddd ? parseInt(ddd) : null, mesorregiao: mesorregiao || null,
            rep_bmax: rep_bmax || null, ativo: true
        });
        res.json({ ok: true, row: row[0] || row });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.post("/cobertura/upload", authenticate, authorize(["adm"]), upload.single("file"), async (req, res) => {
    try {
        if (!req.file) return res.status(400).json({ error: "Nenhum arquivo enviado" });
        const wb = XLSX.read(req.file.buffer, { type: "buffer" });
        const sheet = wb.Sheets[wb.SheetNames[0]];
        const rows = XLSX.utils.sheet_to_json(sheet, { defval: "" });
        if (!rows.length) return res.status(400).json({ error: "Planilha vazia" });

        const colMap = {};
        const firstRow = rows[0];
        const keys = Object.keys(firstRow);
        for (const k of keys) {
            const kl = k.toLowerCase().trim();
            if (kl.includes("ibge") || kl === "codigo" || kl === "código") colMap.ibge_codigo = k;
            else if (kl.includes("cidade") || kl === "municipio" || kl === "município") colMap.cidade = k;
            else if (kl.includes("estado") || kl === "uf") colMap.estado = k;
            else if (kl.includes("ddd")) colMap.ddd = k;
            else if (kl.includes("meso")) colMap.mesorregiao = k;
            else if (kl.includes("rep")) colMap.rep_bmax = k;
        }
        if (!colMap.ibge_codigo) return res.status(400).json({ error: "Coluna IBGE nao encontrada. Use 'ibge_codigo', 'ibge' ou 'codigo' como header." });
        if (!colMap.cidade) return res.status(400).json({ error: "Coluna cidade nao encontrada." });
        if (!colMap.estado) return res.status(400).json({ error: "Coluna estado/UF nao encontrada." });

        const batch = [];
        let skipped = 0;
        for (const r of rows) {
            const ibge = String(r[colMap.ibge_codigo] || "").trim();
            const cidade = String(r[colMap.cidade] || "").trim();
            const estado = String(r[colMap.estado] || "").trim().toUpperCase();
            if (!ibge || !cidade || !estado) { skipped++; continue; }
            batch.push({
                ibge_codigo: ibge,
                cidade,
                estado,
                ddd: colMap.ddd ? (parseInt(r[colMap.ddd]) || null) : null,
                mesorregiao: colMap.mesorregiao ? (String(r[colMap.mesorregiao] || "").trim() || null) : null,
                rep_bmax: colMap.rep_bmax ? (String(r[colMap.rep_bmax] || "").trim() || null) : null,
                ativo: true
            });
        }

        if (!batch.length) return res.status(400).json({ error: "Nenhuma linha valida na planilha" });

        const CHUNK = 500;
        let upserted = 0;
        for (let i = 0; i < batch.length; i += CHUNK) {
            const chunk = batch.slice(i, i + CHUNK);
            await fetch(`${SB_SISTEMAS_URL}/rest/v1/comercial_bmax_cobertura`, {
                method: 'POST',
                headers: {
                    'apikey': SB_SISTEMAS_ANON,
                    'Authorization': `Bearer ${SB_SISTEMAS_ANON}`,
                    'Content-Type': 'application/json',
                    'Prefer': 'resolution=merge-duplicates,return=minimal'
                },
                body: JSON.stringify(chunk)
            });
            upserted += chunk.length;
        }
        res.json({ ok: true, upserted, skipped });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.get("/cobertura/download", authenticate, authorize(["adm"]), async (req, res) => {
    try {
        const rows = await fetchAllCobertura();
        const ws = XLSX.utils.json_to_sheet(rows, { header: ["ibge_codigo", "cidade", "estado", "ddd", "mesorregiao", "rep_bmax"] });
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Cobertura");
        const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
        res.setHeader("Content-Disposition", "attachment; filename=cobertura_bmax.xlsx");
        res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
        res.send(Buffer.from(buf));
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
