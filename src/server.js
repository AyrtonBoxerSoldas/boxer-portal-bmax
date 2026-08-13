const path = require("path");
const helmet = require("helmet");
const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");

const { sequelize } = require("./database");
const authRoutes = require("./routes/auth.routes");
const usersRoutes = require("./routes/users.routes");
const leadsRoutes = require("./routes/leads.routes");
const negociacaoRoutes = require("./routes/negociacao.routes");
const errorMiddleware = require("./middlewares/errorMiddleware");

dotenv.config();


const app = express();

// Middlewares básicos
app.use(express.json());
app.use(cors({ origin: true, credentials: true }));
app.use(helmet());

// Static (frontend)
app.use(express.static(path.join(__dirname, "../public")));

// Rotas API
app.use("/api/auth", authRoutes);
app.use("/api/users", usersRoutes);
app.use("/api/leads", leadsRoutes);
app.use("/api/negociacoes", negociacaoRoutes);

// Health check
app.get("/api/health", (req, res) => {
    res.json({ status: "ok", service: "BMAX API" });
});


// SPA fallback (IMPORTANTE corrigido)
app.use((req, res, next) => {
    if (req.path.startsWith("/api")) {
        return next();
    }
    res.sendFile(path.join(__dirname, "../public/index.html"));
});

// Error handler
app.use(errorMiddleware);

// 🚀 Inicialização correta
async function startServer() {
    try {
        if (process.env.NODE_ENV !== "production") {
            await sequelize.sync({ alter: true });
        }

        const PORT = process.env.PORT || 3000;

        app.listen(PORT, "0.0.0.0", () => {
            console.log(`🚀 API rodando na porta ${PORT}`);
        });

    } catch (err) {
        console.error("ERRO AO INICIAR:", err);
    }
}

startServer();