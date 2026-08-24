const { listAuditUsers, listAuditLogs } = require("../services/audit.service");

async function list(req, res) {
    try {
        const page = Math.max(1, Number(req.query.page) || 1);
        const pageSize = Math.max(1, Number(req.query.pageSize) || 20);
        const userId = req.query.userId ? Number(req.query.userId) : null;

        const result = await listAuditLogs({
            userId,
            page,
            pageSize
        });

        return res.json({
            logs: result.rows,
            total: result.count,
            currentPage: page,
            pageSize,
            hasNext: page * pageSize < result.count,
            hasPrev: page > 1
        });
    } catch (err) {
        console.error("Erro List Audit Logs:", err);
        return res.status(500).json({
            error: err.message || "Falha ao consultar logs"
        });
    }
}

async function users(req, res) {
    try {
        const usersList = await listAuditUsers();

        return res.json(usersList);
    } catch (err) {
        console.error("Erro List Audit Users:", err);
        return res.status(500).json({
            error: err.message || "Falha ao consultar usuários"
        });
    }
}

module.exports = {
    list,
    users
};