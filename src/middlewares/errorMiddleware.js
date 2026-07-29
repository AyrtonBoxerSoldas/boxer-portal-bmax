const logger = require("../logger");

function errorMiddleware(err, req, res, next) {
    logger.error({
        message: err.message,
        stack: err.stack,
        url: req.originalUrl,
        method: req.method,
        time: new Date().toISOString()
    });

    return res.status(500).json({
        error: "Erro interno do servidor"
    });
}

module.exports = errorMiddleware;