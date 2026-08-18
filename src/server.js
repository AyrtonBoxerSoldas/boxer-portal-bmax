const path = require("path");
const express = require("express");
const { validateEnv } = require("./config/validateEnv");
const { sequelize } = require("./database");
const app = require("./app");

validateEnv();

app.use(express.static(path.join(__dirname, "../public")));
app.set("trust proxy", true);
app.use((req, res, next) => {
    if (req.path.startsWith("/api")) return next();
    res.sendFile(path.join(__dirname, "../public/index.html"));
});

async function startServer() {
    try {
        if (process.env.NODE_ENV !== "production") {
            await sequelize.sync({ alter: true });
        }
        const PORT = process.env.PORT || 3000;
        app.listen(PORT, "0.0.0.0", () => {
            console.log(`API rodando na porta ${PORT}`);
        });
    } catch (err) {
        console.error("ERRO AO INICIAR:", err);
    }
}

startServer();
