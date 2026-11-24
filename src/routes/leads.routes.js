const express = require("express");
const { listLeads, updateLeadPci, updateLeadResultado, registrarAndamento, listarAndamento, relatorioPerdas } = require("../controllers/leads.controller");
const { authenticate, authorize } = require("../middlewares/auth");

const router = express.Router();

router.get(
    "/",
    authenticate,
    authorize(["adm", "representante", "revenda", "funcionario"]),
    listLeads
);

router.post(
    "/pci",
    authenticate,
    authorize(["revenda", "representante", "adm", "funcionario"]),
    updateLeadPci
);

router.post(
    "/resultado",
    authenticate,
    authorize(["revenda", "adm"]),
    updateLeadResultado
);

router.post("/andamento", authenticate, authorize(["revenda", "adm"]), registrarAndamento);
router.get("/andamento/relatorio/perdas", authenticate, authorize(["adm", "funcionario"]), relatorioPerdas);
router.get("/andamento/:dealId", authenticate, authorize(["adm", "representante", "revenda", "funcionario"]), listarAndamento);

module.exports = router;