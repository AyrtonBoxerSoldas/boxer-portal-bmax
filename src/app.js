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

app.get("/api/health", (req, res) => {
    res.json({ status: "ok", service: "BMAX API" });
});

app.use(errorMiddleware);

module.exports = app;
