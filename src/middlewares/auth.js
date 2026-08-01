const jwt = require("jsonwebtoken");

function authenticate(req, res, next) {
    const authHeader = req.headers.authorization;

    if (!authHeader) {
        return res.status(401).json({ error: "Token não informado" });
    }

    const parts = authHeader.split(" ");

    if (parts.length !== 2) {
        return res.status(401).json({ error: "Formato do token inválido" });
    }

    const [scheme, token] = parts;

    if (scheme !== "Bearer" || !token) {
        return res.status(401).json({ error: "Token mal formatado" });
    }

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        req.user = decoded;
        return next();
    } catch (err) {
        return res.status(401).json({ error: "Token inválido" });
    }
}

function authorize(roles) {
    return (req, res, next) => {
        if (!req.user) {
            return res.status(401).json({ error: "Usuário não autenticado" });
        }

        if (!roles.includes(req.user.role)) {
            return res.status(403).json({ error: "Acesso negado" });
        }

        return next();
    };
}

module.exports = {
    authenticate,
    authorize
};