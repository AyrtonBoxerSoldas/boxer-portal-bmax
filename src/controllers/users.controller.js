const bcrypt = require("bcryptjs");
const { UniqueConstraintError } = require("sequelize");
const db = require("../database");

const { User, Revenda, Representante, sequelize } = db;

function clean(value) {
    return (value ?? "").toString().trim();
}

function onlyDigits(value) {
    return clean(value).replace(/\D/g, "");
}

async function createUser(req, res) {
    try {
        const role = clean(req.body.role);
        const name = clean(req.body.name);
        const email = clean(req.body.email).toLowerCase();
        const password = clean(req.body.password);
        const cnpj = onlyDigits(req.body.cnpj);
        const cep = onlyDigits(req.body.cep);
        const cidade = clean(req.body.cidade);
        const estado = clean(req.body.estado).toUpperCase();
        const providedUsername = clean(req.body.username);

        if (!["adm", "representante", "revenda"].includes(role)) {
            return res.status(400).json({
                error: "role inválido"
            });
        }

        if (!password) {
            return res.status(400).json({
                error: "password é obrigatório"
            });
        }

        const username = providedUsername || (role === "revenda" ? email : name);

        if (!username) {
            return res.status(400).json({
                error: "username é obrigatório"
            });
        }

        if (role === "adm" && !name) {
            return res.status(400).json({
                error: "nome é obrigatório para administradores"
            });
        }

        if (role === "representante" && (!name || !email)) {
            return res.status(400).json({
                error: "nome e e-mail são obrigatórios para representantes"
            });
        }

        if (role === "revenda" && (!email || !name || !cnpj || !cep || !cidade || !estado)) {
            return res.status(400).json({
                error: "e-mail, cnpj, nome, cep, cidade e estado são obrigatórios para revenda"
            });
        }

        const hashedPassword = await bcrypt.hash(password, 10);

        const user = await sequelize.transaction(async (transaction) => {
            const createdUser = await User.create({
                username,
                password: hashedPassword,
                role
            }, { transaction });

            if (role === "representante") {
                await Representante.create({
                    user_id: createdUser.id,
                    email
                }, { transaction });
            }

            if (role === "revenda") {
                await Revenda.create({
                    user_id: createdUser.id,
                    name,
                    cnpj,
                    cep,
                    cidade,
                    estado
                }, { transaction });
            }

            return createdUser;
        });

        return res.status(201).json({
            id: user.id,
            username: user.username,
            role: user.role
        });
    } catch (err) {
        console.error("Erro createUser:", err);

        if (err instanceof UniqueConstraintError) {
            return res.status(400).json({
                error: err.errors?.[0]?.message || "Já existe um cadastro com esses dados"
            });
        }

        if (err.name === "SequelizeValidationError" || err.name === "ValidationError") {
            return res.status(400).json({
                error: err.errors?.[0]?.message || "Dados inválidos"
            });
        }

        return res.status(500).json({
            error: err.message || "Erro ao criar usuário"
        });
    }
}

module.exports = {
    createUser
};