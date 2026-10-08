const express = require("express");
const { authenticate, authorize } = require("../middlewares/auth");
const { list, users } = require("../controllers/audit.controller");
const { resumoAcessos } = require("../services/audit.service");

const router = express.Router();

router.get(
    "/users",
    authenticate,
    authorize(["adm"]),
    users
);

router.get("/acessos", authenticate, authorize(["adm"]), async (req, res) => {
    try {
        res.json(await resumoAcessos(req.query.dias));
    } catch (err) {
        res.status(500).json({ error: err.message || "Falha ao consultar acessos" });
    }
});

router.get(
    "/",
    authenticate,
    authorize(["adm"]),
    list
);

module.exports = router;