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
        res.json({ pong: true, url: req.originalUrl, method: req.method });
    });

    app.use("/api/auth", authRoutes);
    app.use("/api/users", usersRoutes);
    app.use("/api/leads", leadsRoutes);
    app.use("/api/negociacoes", negociacaoRoutes);

    app.get("/api/health", (req, res) => {
        res.json({ status: "ok", service: "BMAX API", env: "vercel" });
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
