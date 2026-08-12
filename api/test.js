const express = require("express");
const app = express();

app.get("/api/test", (req, res) => {
    res.json({ ok: true, express: require("express/package.json").version });
});

app.all("*", (req, res) => {
    res.json({ path: req.path, method: req.method, url: req.originalUrl });
});

module.exports = app;
