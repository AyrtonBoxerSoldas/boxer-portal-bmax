const express = require("express");
const { createUser, listUsers, updateRevenda } = require("../controllers/users.controller");
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

module.exports = router;
