const db = require("../database");

const { User, Representante } = db;

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

module.exports = {
    getRepresentativeEmailByName
};
