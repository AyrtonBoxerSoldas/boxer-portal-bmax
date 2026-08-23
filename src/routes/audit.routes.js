const express = require("express");
const { authenticate, authorize } = require("../middlewares/auth");
const { list, users } = require("../controllers/audit.controller");

const router = express.Router();

router.get(
    "/users",
    authenticate,
    authorize(["adm"]),
    users
);

router.get(
    "/",
    authenticate,
    authorize(["adm"]),
    list
);

module.exports = router;