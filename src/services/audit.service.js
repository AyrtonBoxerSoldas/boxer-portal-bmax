const { AuditLog, sequelize } = require("../database");

let auditTableExists = null;

async function isAuditTableAvailable() {
    if (auditTableExists !== null) return auditTableExists;

    try {
        const tables = await sequelize.getQueryInterface().showAllTables();
        const tableNames = tables.map((t) => (typeof t === "string" ? t : t.tableName));
        auditTableExists = tableNames.includes(AuditLog.getTableName());

        if (!auditTableExists) {
            console.warn("Tabela AuditLogs não encontrada. Logs de auditoria serão ignorados até ela ser criada.");
        }
    } catch (error) {
        console.error("Falha ao verificar tabela AuditLogs:", error.message);
        auditTableExists = false;
    }

    return auditTableExists;
}

async function AuditLog(req, {
    action,
    entityType = null,
    entityId = null,
    status = "success",
    metadata = {}
}) {
    if (!(await isAuditTableAvailable())) {
        return null;
    }

    const ip =
        req.headers["x-forwarded-for"]?.split(",")[0]?.trim() ||
        req.socket?.remoteAddress ||
        req.ip ||
        null;

    try {
        return await AuditLog.create({
            user_id: req.user?.id || null,
            username: req.user?.username || req.body?.username || null,
            role: req.user?.role || req.body?.role || null,
            action,
            entity_type: entityType,
            entity_id: entityId,
            status,
            ip_address: ip,
            user_agent: req.headers["user-agent"] || null,
            metadata
        });
    } catch (error) {
        console.error("Falha ao registrar log de auditoria:", error.message);
        return null;
    }
}

module.exports = { AuditLog };
