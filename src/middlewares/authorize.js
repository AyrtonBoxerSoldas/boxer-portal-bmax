const authorize = (roles) => {
    return (req, res, next) => {
        console.log("Entrou no authorize");

        if (!req.user) {
            return res.status(401).json({ error: "Usuário não autenticado" });
        }

        console.log("User role:", req.user.role);
        console.log("Roles permitidas:", roles);

        if (!roles.includes(req.user.role)) {
            console.log("Usuário sem permissão");
            return res.status(403).json({ error: "Acesso negado" });
        }

        console.log("Usuário autorizado");
        return next();
    };
};

module.exports = {
    authorize
};