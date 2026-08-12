module.exports = (req, res) => {
    res.json({ status: "ok", service: "BMAX API", env: "vercel", time: new Date().toISOString() });
};
