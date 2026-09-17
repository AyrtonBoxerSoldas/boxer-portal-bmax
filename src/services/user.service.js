const db = require("../database");

const { User, Representante, Revenda } = db;

async function getRepresentativeEmailByName(representanteNome) {
    const nome = String(representanteNome || "").trim();

    if (!nome) {
        return null;
    }

    const user = await User.findOne({
        where: {
            username: nome,
            role: "representante"
        }
    });

    if (!user) {
        return null;
    }

    const representante = await Representante.findOne({
        where: {
            user_id: user.id
        }
    });

    return representante?.email || null;
}

async function getRevendaEmailByName(revendaNome) {
    const nome = String(revendaNome || "").trim();

    if (!nome) {
        return null;
    }

    let revenda = await Revenda.findOne({
        where: {
            name: nome
        }
    });

    if (!revenda) {
        // Grupos com várias lojas (ex: "Luitex Sumaré", "42863 Alphabras Poços
        // de Caldas 1") têm um único cadastro no Portal por grupo, mas o RD
        // lista cada loja separadamente no campo REVENDA/LOJA — sem esse
        // fallback, qualquer loja que não seja a "principal" nunca acha
        // e-mail. Casa pelo `grupo` (Luitex) ou por substring do próprio
        // `name` cadastrado dentro do nome vindo do RD (Alphabras), ignorando
        // prefixo numérico de filial (ex: "42863 ").
        const nomeSemPrefixo = nome.replace(/^\d+\s*/, "");
        const todasRevendas = await Revenda.findAll();
        revenda = todasRevendas.find(r =>
            (r.grupo && nomeSemPrefixo.includes(r.grupo)) || nomeSemPrefixo.includes(r.name)
        ) || null;
    }

    if (!revenda) {
        return null;
    }

    const user = await User.findOne({
        where: {
            id: revenda.user_id,
            role: "revenda"
        }
    });

    // Para role "revenda" o username cadastrado é o próprio e-mail de login.
    return user?.username || null;
}

module.exports = {
    getRepresentativeEmailByName,
    getRevendaEmailByName
};
