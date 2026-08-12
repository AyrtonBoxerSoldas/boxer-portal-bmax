module.exports = async (req, res) => {
    const diag = { tests: [], env: {}, expressInfo: {} };

    diag.env = {
        DATABASE_URL: process.env.DATABASE_URL ? "set (" + process.env.DATABASE_URL.length + " chars)" : "NOT SET",
        DB_DIALECT: process.env.DB_DIALECT || "NOT SET",
        NODE_ENV: process.env.NODE_ENV || "NOT SET",
        VERCEL: process.env.VERCEL || "NOT SET",
        nodeVersion: process.version,
    };

    // Test 0: pg resolution paths
    try {
        const pgPath = require.resolve("pg");
        const pgHbaPath = require.resolve("pg-hstore").catch ? null : require.resolve("pg-hstore");
        diag.tests.push({ name: "pg-resolve", pass: true, pgPath, cwd: process.cwd(), dirname: __dirname });
    } catch(e) {
        diag.tests.push({ name: "pg-resolve", pass: false, error: e.message, cwd: process.cwd(), dirname: __dirname });
    }

    // Test 0b: Sequelize pg loading
    try {
        const { Sequelize } = require("sequelize");
        const sq = new Sequelize("postgres://x:x@localhost:5432/x", { dialect: "postgres", logging: false });
        diag.tests.push({ name: "sequelize-pg-init", pass: true });
    } catch(e) {
        diag.tests.push({ name: "sequelize-pg-init", pass: false, error: e.message });
    }

    // Test 1: Express version and app info
    try {
        const express = require("express");
        const ver = require("express/package.json").version;
        const app = express();
        diag.expressInfo = { version: ver, appType: typeof app, arity: app.length };
        diag.tests.push({ name: "express-load", pass: true });
    } catch(e) {
        diag.tests.push({ name: "express-load", pass: false, error: e.message });
    }

    // Test 2: Minimal Express app handling a fake request
    try {
        const express = require("express");
        const app = express();
        app.get("/fake", (r, s) => s.json({ fake: true }));

        const result = await new Promise((resolve, reject) => {
            const timeout = setTimeout(() => reject(new Error("timeout 3s")), 3000);
            const fakeReq = { method: "GET", url: "/fake", headers: {}, on: ()=>{}, removeListener: ()=>{} };
            const chunks = [];
            const fakeRes = {
                statusCode: 200,
                _headers: {},
                setHeader(k,v) { this._headers[k]=v; },
                getHeader(k) { return this._headers[k]; },
                writeHead(s,h) { this.statusCode=s; if(h) Object.assign(this._headers,h); },
                write(c) { chunks.push(c); },
                end(c) { if(c) chunks.push(c); clearTimeout(timeout); resolve({ status: this.statusCode, body: chunks.join("") }); },
                on: ()=>{}, removeListener: ()=>{},
            };
            try { app(fakeReq, fakeRes); } catch(e) { clearTimeout(timeout); reject(e); }
        });
        diag.tests.push({ name: "express-fake-request", pass: true, result });
    } catch(e) {
        diag.tests.push({ name: "express-fake-request", pass: false, error: e.message, stack: e.stack?.split("\n").slice(0,5) });
    }

    // Test 3: Load the actual app (api/index.js)
    let appModule = null;
    try {
        appModule = require("./index");
        diag.tests.push({ name: "app-require", pass: true, exportType: typeof appModule, arity: typeof appModule === "function" ? appModule.length : null });
    } catch(e) {
        diag.tests.push({ name: "app-require", pass: false, error: e.message, stack: e.stack?.split("\n").slice(0,5) });
    }

    // Test 4: Database connection
    try {
        const { sequelize } = require("../src/database");
        await sequelize.authenticate({ timeout: 5000 });
        diag.tests.push({ name: "db-connection", pass: true });
    } catch(e) {
        diag.tests.push({ name: "db-connection", pass: false, error: e.message, stack: e.stack?.split("\n").slice(0,3) });
    }

    // Test 5: Query a table
    try {
        const { User } = require("../src/database");
        const count = await User.count();
        diag.tests.push({ name: "db-query-users", pass: true, count });
    } catch(e) {
        diag.tests.push({ name: "db-query-users", pass: false, error: e.message });
    }

    // Test 6: Process actual request through the app
    if (appModule && typeof appModule === "function") {
        try {
            const result = await new Promise((resolve, reject) => {
                const timeout = setTimeout(() => reject(new Error("app timeout 8s")), 8000);
                const fakeReq = { method: "GET", url: "/api/ping", originalUrl: "/api/ping", path: "/api/ping", headers: { host: "test" }, query: {}, params: {}, on: ()=>{}, removeListener: ()=>{}, get: (h) => "" };
                const chunks = [];
                const fakeRes = {
                    statusCode: 200, _headers: {},
                    setHeader(k,v) { this._headers[k]=v; return this; },
                    getHeader(k) { return this._headers[k]; },
                    removeHeader(k) { delete this._headers[k]; return this; },
                    writeHead(s,h) { this.statusCode=s; if(h) Object.assign(this._headers,h); return this; },
                    write(c) { chunks.push(typeof c === "string" ? c : c.toString()); return this; },
                    end(c) { if(c) chunks.push(typeof c === "string" ? c : c.toString()); clearTimeout(timeout); resolve({ status: this.statusCode, body: chunks.join("").substring(0,500) }); return this; },
                    json(obj) { this.setHeader("content-type","application/json"); this.end(JSON.stringify(obj)); },
                    on: ()=> fakeRes, removeListener: ()=> fakeRes, once: ()=> fakeRes, emit: ()=> fakeRes,
                };
                try { appModule(fakeReq, fakeRes); } catch(e) { clearTimeout(timeout); reject(e); }
            });
            diag.tests.push({ name: "app-handle-ping", pass: true, result });
        } catch(e) {
            diag.tests.push({ name: "app-handle-ping", pass: false, error: e.message, stack: e.stack?.split("\n").slice(0,5) });
        }
    }

    res.json(diag);
};
