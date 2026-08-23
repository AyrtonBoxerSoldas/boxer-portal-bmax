const helmet = require("helmet");
const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");

dotenv.config();

const authRoutes = require("./routes/auth.routes");
const usersRoutes = require("./routes/users.routes");
const leadsRoutes = require("./routes/leads.routes");
const negociacaoRoutes = require("./routes/negociacao.routes");
const configRoutes = require("./routes/config.routes");
const exportRoutes = require("./routes/export.routes");
const cashbackRoutes = require("./routes/cashback.routes");
const adminRoutes = require("./routes/admin.routes");
const auditRoutes = require("./routes/audit.routes");
const errorMiddleware = require("./middlewares/errorMiddleware");

const ALLOWED_ORIGINS = [
    "https://bmax.boxersoldas.com.br",
    "https://boxer-portal-bmax.vercel.app",
    process.env.NODE_ENV !== "production" && "http://localhost:3000"
].filter(Boolean);

const app = express();

app.use(express.json());
app.use(cors({
    origin: function (origin, callback) {
        if (!origin || ALLOWED_ORIGINS.includes(origin)) {
            callback(null, true);
        } else {
            callback(new Error("Origem não permitida"));
        }
    },
    credentials: true
}));
app.use(helmet({
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            scriptSrc: ["'self'", "'unsafe-inline'"],
            styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
            fontSrc: ["'self'", "https://fonts.gstatic.com"],
            connectSrc: ["'self'"],
            imgSrc: ["'self'", "data:"],
        }
    }
}));

app.get("/api/ping", (req, res) => {
    res.json({ pong: true });
});

app.use("/api/auth", authRoutes);
app.use("/api/users", usersRoutes);
app.use("/api/leads", leadsRoutes);
app.use("/api/negociacoes", negociacaoRoutes);
app.use("/api/config", configRoutes);
app.use("/api/export", exportRoutes);
app.use("/api/cashback", cashbackRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/audit", auditRoutes);

app.get("/api/health", (req, res) => {
    res.json({ status: "ok", service: "BMAX API" });
});

app.get("/api/cron/expirar-cashback", async (req, res) => {
    const secret = req.headers["authorization"];
    if (secret !== `Bearer ${process.env.CRON_SECRET}`) {
        return res.status(401).json({ error: "unauthorized" });
    }
    try {
        const { processarExpirados, getExpirandoEm } = require("./services/saldo.service");
        const { sendEmail } = require("./services/email.service");
        const { sequelize } = require("./database");
        const { QueryTypes } = require("sequelize");

        const expirados = await processarExpirados();

        const em30 = await getExpirandoEm(30);
        const em15 = await getExpirandoEm(15);
        const aNotificar = [...em15, ...em30.filter(t => !em15.find(e => e.id === t.id))];

        for (const tx of aNotificar) {
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

        res.json({ ok: true, expirados: expirados.length, notificados: aNotificar.length });
    } catch (err) {
        console.error("Erro no cron expirar-cashback:", err);
        res.status(500).json({ error: err.message });
    }
});

app.use(errorMiddleware);

module.exports = app;
