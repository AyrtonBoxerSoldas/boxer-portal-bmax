const express = require("express");
const { createUser } = require("../controllers/users.controller");
const { authenticate, authorize } = require("../middlewares/auth");

const router = express.Router();

router.post(
    "/",
    authenticate,
    authorize(["adm"]),
    createUser
);

module.exports = router;
