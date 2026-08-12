module.exports = (req, res) => {
    const errors = [];
    const loaded = [];

    try { require("express"); loaded.push("express"); } catch(e) { errors.push({mod:"express", err:e.message}); }
    try { require("helmet"); loaded.push("helmet"); } catch(e) { errors.push({mod:"helmet", err:e.message}); }
    try { require("cors"); loaded.push("cors"); } catch(e) { errors.push({mod:"cors", err:e.message}); }
    try { require("dotenv").config(); loaded.push("dotenv"); } catch(e) { errors.push({mod:"dotenv", err:e.message}); }
    try { require("sequelize"); loaded.push("sequelize"); } catch(e) { errors.push({mod:"sequelize", err:e.message}); }
    try { require("pg"); loaded.push("pg"); } catch(e) { errors.push({mod:"pg", err:e.message}); }
    try { require("winston"); loaded.push("winston"); } catch(e) { errors.push({mod:"winston", err:e.message}); }

    let dbError = null;
    try {
        const { sequelize } = require("../src/database");
        loaded.push("database");
    } catch(e) {
        dbError = { message: e.message, stack: e.stack ? e.stack.split("\n").slice(0,5) : null };
    }

    let routeErrors = [];
    const routes = ["auth.routes","users.routes","leads.routes","negociacao.routes"];
    for (const r of routes) {
        try { require("../src/routes/" + r); loaded.push(r); } catch(e) { routeErrors.push({route:r, err:e.message}); }
    }

    let appError = null;
    try {
        require("./index");
        loaded.push("api/index");
    } catch(e) {
        appError = { message: e.message, stack: e.stack ? e.stack.split("\n").slice(0,8) : null };
    }

    res.json({
        env: {
            DATABASE_URL: process.env.DATABASE_URL ? "set (" + process.env.DATABASE_URL.length + " chars)" : "NOT SET",
            DB_DIALECT: process.env.DB_DIALECT || "NOT SET",
            NODE_ENV: process.env.NODE_ENV || "NOT SET",
            VERCEL: process.env.VERCEL || "NOT SET",
        },
        loaded,
        errors,
        dbError,
        routeErrors,
        appError
    });
};
