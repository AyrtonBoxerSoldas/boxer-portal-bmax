const express = require("express");

const router = express.Router();

const {
    create,
    list
} = require("../controllers/negociacao.controller");

const {
    authenticate,
    authorize
} = require("../middlewares/auth");
const { sensitiveActionRateLimit } = require("../middlewares/rateLimit");
const { gerarUploadUrl } = require("../services/orcamento.service");

// André, 22/09/2026: Funcionário Boxer é só visualização geral do BMax — não
// pode criar negociação (nem via botão, que já fica escondido, nem chamando a
// API direto, que até agora aceitava qualquer role autenticado).
router.post(
    "/",
    authenticate,
    authorize(["adm", "representante", "revenda"]),
    create
);

// Orçamento da Nova Negociação (até 3 arquivos): devolve a URL de upload direto pro Storage.
router.post(
    "/orcamento-upload-url",
    authenticate,
    authorize(["adm", "representante", "revenda"]),
    sensitiveActionRateLimit,
    async (req, res) => {
        try {
            res.json(await gerarUploadUrl(req.user, req.body || {}));
        } catch (err) {
            res.status(400).json({ error: err.message || "Não foi possível preparar o envio do arquivo" });
        }
    }
);

router.get(
    "/",
    authenticate,
    list
);

module.exports = router;