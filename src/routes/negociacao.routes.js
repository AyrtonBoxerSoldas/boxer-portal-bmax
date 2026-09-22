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

// André, 22/09/2026: Funcionário Boxer é só visualização geral do BMax — não
// pode criar negociação (nem via botão, que já fica escondido, nem chamando a
// API direto, que até agora aceitava qualquer role autenticado).
router.post(
    "/",
    authenticate,
    authorize(["adm", "representante", "revenda"]),
    create
);

router.get(
    "/",
    authenticate,
    list
);

module.exports = router;