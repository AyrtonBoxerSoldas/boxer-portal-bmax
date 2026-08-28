const {
    createNegociacao,
    listNegociacoes
} = require("../services/negociacao.service");
const { AuditLog } = require("../services/audit.service");

async function create(req, res) {
    try {

        const data = req.body;

        data.user_id = req.user.id;

        const negociacao = await createNegociacao(data);
        await AuditLog(req, {
            action: "CREATE_NEGOCIACAO",
            entityType: "Negociacao",
            entityId: String(negociacao.id),
            metadata: {
                nome: negociacao.nome,
                cnpj: negociacao.cnpj,
                revenda: negociacao.revenda,
                representante: negociacao.representante,
                caminho: data.caminho || null
            }
        });
        return res.status(201).json(negociacao);

    } catch (err) {

        console.error("Erro Create Negociação:", err);

        return res.status(400).json({
            error: err.message || "Erro ao criar negociação"
        });
    }
}

async function list(req, res) {
    try {

        const negociacoes = await listNegociacoes(req.user);

        return res.json(negociacoes);
    } catch (err) {

        console.error("Erro List Negociacoes:", err);

        return res.status(500).json({
            error: "Erro ao listar negociações"
        });
    }
}

module.exports = {
    create,
    list
};