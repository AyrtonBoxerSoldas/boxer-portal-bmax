const express = require("express");

const router = express.Router();

const {
    create,
    list
} = require("../controllers/negociacao.controller");

const {
    authenticate
} = require("../middlewares/auth");

router.post(
    "/",
    authenticate,
    create
);

router.get(
    "/",
    authenticate,
    list
);

module.exports = router;