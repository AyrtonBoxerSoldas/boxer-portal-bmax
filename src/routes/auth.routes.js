const express = require("express");
const { login } = require("../controllers/auth.controller");
const { loginRateLimit } = require("../middlewares/rateLimit");
const { sendEmail } = require("../services/email.service");
const User = require("../models/User");

const router = express.Router();

router.post("/login", loginRateLimit, login);

router.post("/forgot-password", async (req, res) => {
    try {
        const { email } = req.body;
        if (!email) return res.status(400).json({ error: "Email é obrigatório" });

        // Encontra o usuário pelo email
        const user = await User.findOne({ where: { username: email } }) ||
                     await User.findOne({ raw: true, where: {} });

        // Busca admins para notificar
        const admins = await User.findAll({ where: { role: "adm" } });
        if (admins.length === 0) {
            return res.status(500).json({ error: "Nenhum administrador disponível" });
        }

        // Envia alerta para cada admin
        const subject = `Alerta: Redefinição de Senha Solicitada - ${email}`;
        const html = `
            <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px">
                <h2 style="color:#333">⚠️ Solicitação de Redefinição de Senha</h2>
                <p>Um usuário solicitou redefinição de senha:</p>
                <div style="background:#f5f5f5;padding:20px;border-radius:8px;margin:20px 0">
                    <p><strong>Email/Usuário:</strong> ${email}</p>
                    <p><strong>Hora:</strong> ${new Date().toLocaleString("pt-BR")}</p>
                </div>
                <p>Acesse o painel administrativo para redefinir a senha.</p>
                <p style="font-size:12px;color:#666">
                    Após redefinir, avise o usuário sua nova senha via WhatsApp ou outro canal seguro.
                </p>
            </div>
        `;

        for (const admin of admins) {
            await sendEmail(admin.username || "admin@boxersoldas.com.br", subject, html);
        }

        res.json({ message: "Solicitação recebida. Um administrador entrará em contato em breve." });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Erro ao processar solicitação" });
    }
});

module.exports = router;
