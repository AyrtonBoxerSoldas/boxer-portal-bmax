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

// André, 22/09/2026: Funcionário Boxer era só visualização. André, 16/11/2026: o Funcionário passa a ter o mesmo módulo
// do Representante, inclusive criar Nova Negociação. Revenda, representante, funcionário e admin podem criar.
router.post(
    "/",
    authenticate,
    authorize(["adm", "representante", "revenda", "funcionario"]),
    create
);

// Orçamento da Nova Negociação (até 3 arquivos): devolve a URL de upload direto pro Storage.
router.post(
    "/orcamento-upload-url",
    authenticate,
    authorize(["adm", "representante", "revenda", "funcionario"]),
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