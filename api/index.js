const path = require("path");
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

const app = express();

app.use(express.json());
app.use(cors({ origin: true, credentials: true }));
app.use(helmet());

app.use("/api/auth", authRoutes);
app.use("/api/users", usersRoutes);
app.use("/api/leads", leadsRoutes);
app.use("/api/negociacoes", negociacaoRoutes);

app.get("/api/health", (req, res) => {
    res.json({ status: "ok", service: "BMAX API", env: "vercel" });
});

app.use(errorMiddleware);

module.exports = app;
