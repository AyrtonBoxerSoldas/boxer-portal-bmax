// Force Vercel's file tracer to include pg in this function's bundle
require("pg");

let app;
let initError;

try {
    const helmet = require("helmet");
    const express = require("express");
    const cors = require("cors");
    const dotenv = require("dotenv");

    dotenv.config();

    const { sequelize } = require("../src/database");
    const authRoutes = require("../src/routes/auth.routes");
    const usersRoutes = require("../src/routes/users.routes");
    const leadsRoutes = require("../src/routes/leads.routes");
    const negociacaoRoutes = require("../src/routes/negociacao.routes");
    const errorMiddleware = require("../src/middlewares/errorMiddleware");

    app = express();

    app.use(express.json());
    app.use(cors({ origin: true, credentials: true }));
    app.use(helmet());

    app.get("/api/ping", (req, res) => {
        res.json({ pong: true, url: req.originalUrl, method: req.method });
    });

    app.use("/api/auth", authRoutes);
    app.use("/api/users", usersRoutes);
    app.use("/api/leads", leadsRoutes);
    app.use("/api/negociacoes", negociacaoRoutes);

    app.get("/api/health", (req, res) => {
        res.json({ status: "ok", service: "BMAX API", env: "vercel" });
    });

    // OAuth callback for RD Station — exchanges code for tokens and stores them
    app.get("/api/rd/callback", async (req, res) => {
        try {
            const { code } = req.query;
            if (!code) return res.status(400).json({ error: "Missing code parameter" });

            const { RdToken } = require("../src/database");
            const body = new URLSearchParams({
                grant_type: "authorization_code",
                code,
                client_id: process.env.RD_CLIENT_ID,
                client_secret: process.env.RD_CLIENT_SECRET,
                redirect_uri: process.env.RD_REDIRECT_URI
            });

            const response = await fetch("https://api.rd.services/oauth2/token", {
                method: "POST",
                headers: { "Content-Type": "application/x-www-form-urlencoded" },
                body: body.toString()
            });

            const data = await response.json();
            if (!response.ok) return res.status(400).json({ error: "OAuth failed", detail: data });

            await RdToken.upsert({ id: 1, access_token: data.access_token, refresh_token: data.refresh_token });

            res.json({ success: true, message: "Tokens RD Station salvos com sucesso" });
        } catch (e) {
            res.status(500).json({ error: e.message });
        }
    });

    app.use(errorMiddleware);
} catch (e) {
    initError = { message: e.message, stack: e.stack };
}

module.exports = (req, res) => {
    if (initError) {
        res.statusCode = 500;
        res.setHeader("Content-Type", "application/json");
        res.end(JSON.stringify({ error: "Init failed", detail: initError.message, stack: initError.stack.split("\n").slice(0, 10) }));
        return;
    }
    return app(req, res);
};
