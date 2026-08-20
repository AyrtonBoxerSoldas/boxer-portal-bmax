const express = require("express");
const { authenticate, authorize } = require("../middlewares/auth");
const { getSaldo, getSaldoGrupo, getExtrato, getExtratoGrupo, getCreditosProximosVencimento, getCreditosProximosVencimentoGrupo, processarExpirados, getExpirandoEm, creditarCashback } = require("../services/saldo.service");
const { solicitarSaque, aprovarSaque, recusarSaque, listarSaques } = require("../services/saque.service");
const { sendEmail } = require("../services/email.service");
const { getRepresentativeEmailByName } = require("../services/user.service");
const { getLeads, mapDealToCard, getCustomField } = require("../services/rd.leads.service");
const { lerPlanilhaCashback } = require("../services/cashback.service");
const { sequelize } = require("../database");

const router = express.Router();

router.get("/saldo", authenticate, authorize(["revenda", "adm"]), async (req, res) => {
    try {
        const revenda = req.user.role === "revenda" ? req.user.name : req.query.revenda;
        if (!revenda) return res.status(400).json({ error: "revenda obrigatoria" });
        const saldo = await getSaldoGrupo(revenda);
        res.json({ revenda, saldo });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.get("/extrato", authenticate, authorize(["revenda", "adm"]), async (req, res) => {
    try {
        const revenda = req.user.role === "revenda" ? req.user.name : req.query.revenda;
        if (!revenda) return res.status(400).json({ error: "revenda obrigatoria" });
        const saldo = await getSaldoGrupo(revenda);
        const transacoes = await getExtratoGrupo(revenda);
        res.json({ revenda, saldo, transacoes });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.get("/saques", authenticate, async (req, res) => {
    try {
        const saques = await listarSaques(req.user.name, req.user.username, req.user.role);
        res.json(saques);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.post("/saques", authenticate, authorize(["revenda"]), async (req, res) => {
    try {
        const { valor, tipo_uso } = req.body;
        if (!valor || !tipo_uso) return res.status(400).json({ error: "valor e tipo_uso obrigatorios" });

        const result = await solicitarSaque(req.user.name, null, Number(valor), tipo_uso);
        res.json({ ok: true, saque: result });
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

router.post("/saques/:id/aprovar", authenticate, authorize(["representante", "adm"]), async (req, res) => {
    try {
        const saque = await aprovarSaque(req.params.id, req.user.username);

        try {
            const tipoLabel = saque.tipo_uso === "desconto" ? "Desconto (max 5% do pedido)" : "Bonificacao (max 10% do pedido)";
            const chequeHtml = `
                <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;border:2px solid #1d327b;border-radius:12px;overflow:hidden;">
                    <div style="background:#1d327b;color:#fff;padding:20px;text-align:center;">
                        <h2 style="margin:0;">BMAX - Cheque Cashback</h2>
                    </div>
                    <div style="padding:24px;">
                        <table style="width:100%;font-size:14px;border-collapse:collapse;">
                            <tr><td style="padding:8px 0;color:#666;">Codigo</td><td style="padding:8px 0;font-weight:bold;font-size:18px;color:#1d327b;">${saque.codigo_cheque}</td></tr>
                            <tr><td style="padding:8px 0;color:#666;">Valor</td><td style="padding:8px 0;font-weight:bold;font-size:20px;color:#16a34a;">R$ ${Number(saque.valor).toFixed(2)}</td></tr>
                            <tr><td style="padding:8px 0;color:#666;">Tipo de Uso</td><td style="padding:8px 0;font-weight:bold;">${tipoLabel}</td></tr>
                            <tr><td style="padding:8px 0;color:#666;">Revenda</td><td style="padding:8px 0;">${saque.revenda}</td></tr>
                            <tr><td style="padding:8px 0;color:#666;">Validade</td><td style="padding:8px 0;color:#e30613;font-weight:bold;">30 dias (ate ${new Date(saque.expira_em).toLocaleDateString("pt-BR")})</td></tr>
                        </table>
                        <hr style="margin:16px 0;border:none;border-top:1px solid #eee;">
                        <p style="font-size:12px;color:#888;margin:0;">Insira o codigo <strong>${saque.codigo_cheque}</strong> no campo Observacao do pedido no ZEN.</p>
                    </div>
                </div>`;

            const emailRep = await getRepresentativeEmailByName(req.user.username);
            if (emailRep) await sendEmail(emailRep, `BMAX Cheque Aprovado: ${saque.codigo_cheque}`, chequeHtml);

            const { sequelize } = require("../database");
            const { QueryTypes } = require("sequelize");
            const revendaUsers = await sequelize.query(
                `SELECT u.username FROM "Users" u JOIN "Revendas" r ON r.user_id = u.id WHERE r.nome = :nome LIMIT 1`,
                { replacements: { nome: saque.revenda }, type: QueryTypes.SELECT }
            );
            if (revendaUsers.length) {
                const revendaEmail = revendaUsers[0].username;
                if (revendaEmail.includes("@")) {
                    await sendEmail(revendaEmail, `BMAX Cheque Cashback: ${saque.codigo_cheque}`, chequeHtml);
                }
            }
        } catch (emailErr) {
            console.error("Erro ao enviar email do cheque:", emailErr);
        }

        res.json({ ok: true, codigo_cheque: saque.codigo_cheque });
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

router.post("/saques/:id/recusar", authenticate, authorize(["representante", "adm"]), async (req, res) => {
    try {
        await recusarSaque(req.params.id, req.user.username, req.body.motivo);
        res.json({ ok: true });
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

router.get("/expirando", authenticate, authorize(["revenda", "adm"]), async (req, res) => {
    try {
        const revenda = req.user.role === "revenda" ? req.user.name : req.query.revenda;
        if (!revenda) return res.status(400).json({ error: "revenda obrigatoria" });
        const creditos = await getCreditosProximosVencimentoGrupo(revenda);
        res.json(creditos);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.post("/creditar-retroativo", authenticate, authorize(["adm"]), async (req, res) => {
    try {
        const { RD_STAGES, RD_STAGE_VENDIDO, RD_STAGE_VENDA_EFETIVADA } = require("../config/constants");
        const { QueryTypes } = require("sequelize");

        const allDeals = await getLeads("admin", "adm");

        const vendaStages = new Set([RD_STAGE_VENDIDO, RD_STAGE_VENDA_EFETIVADA]);
        const elegíveis = allDeals.filter(d => {
            const stageId = d.deal_stage ? d.deal_stage.id : null;
            return vendaStages.has(stageId) && Number(d.amount_total || 0) > 0;
        });

        const existentes = await sequelize.query(
            `SELECT DISTINCT lead_id FROM bmax_transacoes WHERE tipo = 'credito' AND lead_id IS NOT NULL`,
            { type: QueryTypes.SELECT }
        );
        const jaCredidatos = new Set(existentes.map(r => r.lead_id));

        let creditados = 0;
        let erros = 0;
        const detalhes = [];

        for (const deal of elegíveis) {
            const dealId = deal.id || deal._id;
            if (jaCredidatos.has(dealId)) continue;

            const revenda = getCustomField(deal, "REVENDA/LOJA") || "";
            if (!revenda || revenda === "?????" || revenda === "") continue;

            const pciRaw = (getCustomField(deal, "PERFIL PCI") || "").trim().replace(/\s/g, "");
            const classePreco = (getCustomField(deal, "CLASSE DE PREÇO") || "").replace(/\D/g, "");
            const valor = Number(deal.amount_total || 0);

            try {
                const comissao = parseFloat(await lerPlanilhaCashback(pciRaw, "revenda", classePreco)) || 0;
                if (comissao <= 0) continue;

                const cashbackValor = Number((valor * comissao).toFixed(2));
                await creditarCashback(revenda, cashbackValor, `Venda ${dealId} — ${pciRaw} (${(comissao * 100).toFixed(1)}%)`, dealId);
                creditados++;
                detalhes.push({ dealId, revenda, valor: cashbackValor });
            } catch (err) {
                erros++;
                console.error(`Erro creditando deal ${dealId}:`, err.message);
            }
        }

        res.json({ ok: true, total_elegiveis: elegíveis.length, creditados, ja_existentes: jaCredidatos.size, erros, detalhes });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.post("/processar-expirados", authenticate, authorize(["adm"]), async (req, res) => {
    try {
        const expirados = await processarExpirados();

        const em30 = await getExpirandoEm(30);
        const em15 = await getExpirandoEm(15);

        const { sequelize } = require("../database");
        const { QueryTypes } = require("sequelize");

        for (const tx of [...em30, ...em15]) {
            const diasRestantes = Math.ceil((new Date(tx.expira_em) - Date.now()) / (24 * 60 * 60 * 1000));
            const revendaUsers = await sequelize.query(
                `SELECT u.username FROM "Users" u JOIN "Revendas" r ON r.user_id = u.id WHERE r.nome = :nome LIMIT 1`,
                { replacements: { nome: tx.revenda }, type: QueryTypes.SELECT }
            );
            if (revendaUsers.length && revendaUsers[0].username.includes("@")) {
                try {
                    await sendEmail(
                        revendaUsers[0].username,
                        `BMAX - Cashback expirando em ${diasRestantes} dias`,
                        `<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;">
                            <div style="background:#1d327b;color:#fff;padding:20px;text-align:center;border-radius:12px 12px 0 0;">
                                <h2 style="margin:0;">BMAX - Aviso de Vencimento</h2>
                            </div>
                            <div style="padding:24px;border:1px solid #e2e8f0;border-top:none;border-radius:0 0 12px 12px;">
                                <p>Voce tem um credito de cashback que expira em <strong>${diasRestantes} dias</strong>:</p>
                                <table style="width:100%;font-size:14px;border-collapse:collapse;">
                                    <tr><td style="padding:8px 0;color:#666;">Valor</td><td style="padding:8px 0;font-weight:bold;color:#16a34a;">R$ ${Number(tx.valor).toFixed(2)}</td></tr>
                                    <tr><td style="padding:8px 0;color:#666;">Origem</td><td style="padding:8px 0;">${tx.descricao}</td></tr>
                                    <tr><td style="padding:8px 0;color:#666;">Expira em</td><td style="padding:8px 0;color:#e30613;font-weight:bold;">${new Date(tx.expira_em).toLocaleDateString("pt-BR")}</td></tr>
                                </table>
                                <p style="margin-top:16px;">Acesse o <a href="https://bmax.boxersoldas.com.br" style="color:#1d327b;font-weight:bold;">Portal BMAX</a> para solicitar o saque antes do vencimento.</p>
                            </div>
                        </div>`
                    );
                } catch (emailErr) {
                    console.error("Erro ao enviar aviso de vencimento:", emailErr);
                }
            }
        }

        res.json({ ok: true, expirados: expirados.length, avisos30d: em30.length, avisos15d: em15.length });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
