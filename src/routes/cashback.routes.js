const express = require("express");
const { authenticate, authorize } = require("../middlewares/auth");
const { getSaldo, getExtrato } = require("../services/saldo.service");
const { solicitarSaque, aprovarSaque, recusarSaque, listarSaques } = require("../services/saque.service");
const { sendEmail } = require("../services/email.service");
const { getRepresentativeEmailByName } = require("../services/user.service");

const router = express.Router();

router.get("/saldo", authenticate, authorize(["revenda", "adm"]), async (req, res) => {
    try {
        const revenda = req.user.role === "revenda" ? req.user.name : req.query.revenda;
        if (!revenda) return res.status(400).json({ error: "revenda obrigatoria" });
        const saldo = await getSaldo(revenda);
        res.json({ revenda, saldo });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.get("/extrato", authenticate, authorize(["revenda", "adm"]), async (req, res) => {
    try {
        const revenda = req.user.role === "revenda" ? req.user.name : req.query.revenda;
        if (!revenda) return res.status(400).json({ error: "revenda obrigatoria" });
        const saldo = await getSaldo(revenda);
        const transacoes = await getExtrato(revenda);
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

module.exports = router;
