const bcrypt = require("bcryptjs");
const { UniqueConstraintError } = require("sequelize");
const db = require("../database");

const { User, Revenda, Representante, sequelize } = db;

const SB_SISTEMAS_URL = 'https://bmepxcnrsofofoswubuu.supabase.co';

async function sbSistemasAuthInvite(email) {
    const serviceKey = process.env.SUPABASE_SERVICE_KEY_SISTEMAS;
    if (!serviceKey) throw new Error("SUPABASE_SERVICE_KEY_SISTEMAS não configurada");
    const res = await fetch(`${SB_SISTEMAS_URL}/auth/v1/invite`, {
        method: "POST",
        headers: {
            apikey: serviceKey,
            Authorization: `Bearer ${serviceKey}`,
            "Content-Type": "application/json"
        },
        body: JSON.stringify({ email })
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok && json?.error_code !== "email_exists") {
        throw new Error(json?.msg || json?.message || `Supabase Auth ${res.status}`);
    }
    return json;
}

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

        // Envia convite ao representante para acesso ao Motor (Supabase Auth)
        if (role === "representante" && email) {
            try {
                await sbSistemasAuthInvite(email);
            } catch (e) {
                console.error("Aviso: falha ao enviar convite do Motor para representante:", e.message);
            }
        }

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

async function listUsers(req, res) {
    try {
        const users = await User.findAll({
            attributes: ["id", "username", "role"],
            order: [["role", "ASC"], ["username", "ASC"]]
        });

        const result = [];
        for (const u of users) {
            const entry = { id: u.id, username: u.username, role: u.role };

            if (u.role === "revenda") {
                const rev = await Revenda.findOne({ where: { user_id: u.id } });
                if (rev) {
                    entry.revenda = rev.name;
                    entry.cnpj = rev.cnpj;
                    entry.cidade = rev.cidade;
                    entry.estado = rev.estado;
                    entry.grupo = rev.grupo;
                }
            } else if (u.role === "representante") {
                const rep = await Representante.findOne({ where: { user_id: u.id } });
                if (rep) entry.email = rep.email;
            }

            result.push(entry);
        }

        res.json(result);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
}

async function updateRevenda(req, res) {
    try {
        const { id } = req.params;
        const { grupo } = req.body;

        const rev = await Revenda.findOne({ where: { user_id: id } });
        if (!rev) return res.status(404).json({ error: "Revenda nao encontrada" });

        if (grupo !== undefined) rev.grupo = grupo || null;
        await rev.save();

        res.json({ ok: true, grupo: rev.grupo });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
}

module.exports = {
    createUser,
    listUsers,
    updateRevenda
};