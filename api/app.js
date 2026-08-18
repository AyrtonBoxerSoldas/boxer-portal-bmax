require("pg");

let handler;
let initError;

try {
    const { validateEnv } = require("../src/config/validateEnv");
    validateEnv();
    const app = require("../src/app");
    const { sequelize } = require("../src/database");
    handler = app;
} catch (e) {
    initError = e.message;
}

module.exports = (req, res) => {
    if (initError) {
        res.statusCode = 500;
        res.setHeader("Content-Type", "application/json");
        res.end(JSON.stringify({ error: "Init failed" }));
        return;
    }
    return handler(req, res);
};
