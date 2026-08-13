const express = require("express");
const { listLeads, updateLeadPci, updateLeadResultado } = require("../controllers/leads.controller");
const { authenticate, authorize } = require("../middlewares/auth");

const router = express.Router();

router.get(
    "/",
    authenticate,
    authorize(["adm", "representante", "revenda"]),
    listLeads
);

router.post(
    "/pci",
    authenticate,
    authorize(["revenda"]),
    updateLeadPci
);

router.post(
    "/resultado",
    authenticate,
    authorize(["revenda"]),
    updateLeadResultado
);

module.exports = router;