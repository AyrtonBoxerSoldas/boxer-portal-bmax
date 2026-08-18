const express = require("express");
const { login } = require("../controllers/auth.controller");
const { loginRateLimit } = require("../middlewares/rateLimit");

const router = express.Router();

router.post("/login", loginRateLimit, login);

module.exports = router;
