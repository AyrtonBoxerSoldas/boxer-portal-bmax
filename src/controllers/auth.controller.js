const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");
const { User, Revenda, sequelize } = require("../database");
const { AuditLog } = require("../services/audit.service");
const { logger } = require("../logger");

async function login(req, res) {
    try {
        const { username, password, role } = req.body;

        // Login por e-mail não diferencia maiúscula de minúscula ("Compras6@x.com" = "compras6@x.com"). Primeiro tenta o
        // texto exato (mantém contas que só diferem por caixa, como "admin" e "Admin"); se não achar, aceita a variação de
        // caixa/espaços SOMENTE quando existe exatamente uma conta — nunca adivinha entre duas.
        let user = await User.findOne({ where: { username } });
        if (!user && typeof username === "string" && username.trim()) {
            const candidatos = await User.findAll({
                where: sequelize.where(sequelize.fn("lower", sequelize.col("username")), username.trim().toLowerCase()),
                limit: 2
            });
            if (candidatos.length === 1) user = candidatos[0];
        }

        if (!user) {
            await AuditLog(req, {
                action: "LOGIN_FAILED",
                entityType: "User",
                metadata: {
                    username,
                    reason: "usuario_nao_encontrado"
                },
                status: "failed"
            });
            return res.status(401).json({ error: "Usuário inválido" });
        }

        const validPassword = await bcrypt.compare(password, user.password);

        if (!validPassword) {
            await AuditLog(req, {
                action: "LOGIN_FAILED",
                entityType: "User",
                entityId: user.id,
                metadata: {
                    username,
                    reason: "senha_invalida"
                },
                status: "failed"
            });
            return res.status(401).json({ error: "Senha inválida" });
        }

        if (user.role !== role) {
            await AuditLog(req, {
                action: "LOGIN_FAILED",
                entityType: "User",
                entityId: user.id,
                metadata: {
                    username,
                    reason: "role_invalida",
                    attemptedRole: role
                },
                status: "failed"
            });
            return res.status(401).json({
                error: "Tipo de acesso inválido"
            });
        }
        await AuditLog(req, {
            action: "LOGIN_SUCCESS",
            entityType: "User",
            entityId: user.id,
            metadata: {
                username: user.username,
                role: user.role
            }
        });
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
        logger.error({ message: "Erro no login", error: error.message, stack: error.stack });
        return res.status(500).json({ message: "Erro interno do servidor" });
    }
}

module.exports = {
    login
};