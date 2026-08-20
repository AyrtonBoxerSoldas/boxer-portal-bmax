const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");
const { User, Revenda } = require("../database");

async function login(req, res) {
    try {
        const { username, password, role } = req.body;

        const user = await User.findOne({ where: { username } });

        if (!user) {
            return res.status(401).json({ error: "Usuário inválido" });
        }

        const validPassword = await bcrypt.compare(password, user.password);

        if (!validPassword) {
            return res.status(401).json({ error: "Senha inválida" });
        }

        if (user.role !== role) {
            return res.status(401).json({
                error: "Tipo de acesso inválido"
            });
        }

        let revendaName = null;
        let revendaGrupo = null;

        if (user.role === "revenda") {
            const revenda = await Revenda.findOne({
                where: { user_id: user.id }
            });

            revendaName = revenda?.name || null;
            revendaGrupo = revenda?.grupo || null;
        }

        const token = jwt.sign(
            {
                id: user.id,
                username: user.username,
                role: user.role,
                name: revendaName,
                grupo: revendaGrupo
            },
            process.env.JWT_SECRET,
            { expiresIn: "1d" }
        );

        return res.json({
            token,
            user: {
                username: user.username,
                role: user.role,
                name: revendaName
            }
        });

    } catch (error) {
        console.error("ERRO LOGIN:", error);
        return res.status(500).json({ message: "Erro interno do servidor" });
    }
}

module.exports = {
    login
};