const express = require("express");
const { createUser, listUsers, updateRevenda, listFiliais, createFilial, updateFilial, deleteFilial } = require("../controllers/users.controller");
const { authenticate, authorize } = require("../middlewares/auth");

const router = express.Router();

router.get(
    "/",
    authenticate,
    authorize(["adm"]),
    listUsers
);

router.post(
    "/",
    authenticate,
    authorize(["adm"]),
    createUser
);

router.patch(
    "/:id/revenda",
    authenticate,
    authorize(["adm"]),
    updateRevenda
);

router.get(
    "/:id/filiais",
    authenticate,
    authorize(["adm", "revenda"]),
    listFiliais
);

router.post(
    "/:id/filiais",
    authenticate,
    authorize(["adm", "revenda"]),
    createFilial
);

router.put(
    "/:id/filiais/:filial_id",
    authenticate,
    authorize(["adm", "revenda"]),
    updateFilial
);

router.delete(
    "/:id/filiais/:filial_id",
    authenticate,
    authorize(["adm", "revenda"]),
    deleteFilial
);

module.exports = router;
