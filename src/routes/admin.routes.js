const express = require("express");
const { authenticate, authorize } = require("../middlewares/auth");
const { sequelize } = require("../database");
const { QueryTypes } = require("sequelize");
const { getLeads, getCustomField } = require("../services/rd.leads.service");
const { User, Revenda, Representante } = require("../database");
const bcrypt = require("bcryptjs");

const router = express.Router();

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

module.exports = router;
