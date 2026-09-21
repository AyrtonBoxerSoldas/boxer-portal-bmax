const { logger } = require("../logger");
const { alertarAdminErro } = require("../services/email.service");

function errorMiddleware(err, req, res, next) {
    logger.error({
        message: err.message,
        stack: err.stack,
        url: req.originalUrl,
        method: req.method,
        time: new Date().toISOString()
    });

    alertarAdminErro(`${req.method} ${req.originalUrl}`, err, { usuario: req.user?.username || "não autenticado" }).catch(() => {});

    return res.status(500).json({
        error: "Erro interno do servidor",
        detail: process.env.NODE_ENV !== "production" ? err.message : undefined
    });
}

module.exports = errorMiddleware;