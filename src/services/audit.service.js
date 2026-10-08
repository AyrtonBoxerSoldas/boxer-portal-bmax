const { Op } = require("sequelize");
const { AuditLog: AuditLogModel, sequelize } = require("../database");
const { logger } = require("../logger");

let auditTableExists = null;

async function isAuditTableAvailable() {
    if (auditTableExists !== null) return auditTableExists;

    try {
        const tables = await sequelize.getQueryInterface().showAllTables();
        const tableNames = tables.map((t) => (typeof t === "string" ? t : t.tableName));
        auditTableExists = tableNames.includes(AuditLogModel.getTableName());

        if (!auditTableExists) {
            logger.warn({ message: "Tabela AuditLogs não encontrada. Logs de auditoria serão ignorados até ela ser criada." });
        }
    } catch (error) {
        logger.error({ message: "Falha ao verificar tabela AuditLogs", error: error.message });
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
        return await AuditLogModel.create({
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
        logger.error({ message: "Falha ao registrar log de auditoria", error: error.message });
        return null;
    }
}

async function listAuditLogs({ userId, page, pageSize }) {
    if (!(await isAuditTableAvailable())) {
        return { rows: [], count: 0 };
    }

    return AuditLogModel.findAndCountAll({
        where: userId ? { user_id: userId } : {},
        order: [["createdAt", "DESC"]],
        limit: pageSize,
        offset: (page - 1) * pageSize
    });
}

async function listAuditUsers() {
    if (!(await isAuditTableAvailable())) {
        return [];
    }

    const rows = await AuditLogModel.findAll({
        attributes: ["user_id", "username", "role"],
        where: { user_id: { [Op.ne]: null } },
        group: ["user_id", "username", "role"],
        order: [["username", "ASC"]]
    });

    return rows.map((r) => ({ user_id: r.user_id, username: r.username, role: r.role }));
}

// Resumo de acessos por usuário (quem entrou no Portal e quando). Base = tabela
// de usuários, pra aparecer também quem NUNCA acessou. Acesso = LOGIN_SUCCESS (o
// Portal pede login a cada abertura da página, então login == acesso). O vínculo é
// pelo `username`: no login o `user_id` do log vem NULO (ainda não há req.user).
// Tentativas com usuário inexistente não têm linha em Users; vêm só no total
// `falhasDesconhecidas`.
async function resumoAcessos(dias) {
    if (!(await isAuditTableAvailable())) return { usuarios: [], falhasDesconhecidas: 0 };
    const { QueryTypes } = require("sequelize");
    const replacements = { dias: Math.min(Math.max(Number(dias) || 30, 1), 365) };

    const usuarios = await sequelize.query(
        `SELECT u.id, u.username, u.role,
                (SELECT r.name FROM "Revendas" r WHERE r.user_id = u.id LIMIT 1) AS revenda,
                COUNT(a.id) FILTER (WHERE a.action = 'LOGIN_SUCCESS')::int AS acessos,
                MAX(a."createdAt") FILTER (WHERE a.action = 'LOGIN_SUCCESS') AS ultimo_acesso,
                COUNT(a.id) FILTER (WHERE a.action = 'LOGIN_FAILED')::int AS falhas,
                (SELECT l.ip_address FROM "AuditLogs" l WHERE l.username = u.username AND l.action = 'LOGIN_SUCCESS' ORDER BY l."createdAt" DESC LIMIT 1) AS ultimo_ip,
                (SELECT MAX(l."createdAt") FROM "AuditLogs" l WHERE l.username = u.username AND l.action = 'LOGIN_SUCCESS') AS ultimo_acesso_geral
         FROM "Users" u
         LEFT JOIN "AuditLogs" a ON a.username = u.username
              AND a.action IN ('LOGIN_SUCCESS', 'LOGIN_FAILED')
              AND a."createdAt" >= NOW() - (:dias || ' days')::interval
         GROUP BY u.id, u.username, u.role
         ORDER BY ultimo_acesso_geral DESC NULLS LAST, u.username ASC`,
        { replacements, type: QueryTypes.SELECT }
    );

    const desconhecidas = await sequelize.query(
        `SELECT COUNT(*)::int AS n FROM "AuditLogs"
         WHERE action = 'LOGIN_FAILED' AND "createdAt" >= NOW() - (:dias || ' days')::interval
           AND (username IS NULL OR username NOT IN (SELECT username FROM "Users"))`,
        { replacements, type: QueryTypes.SELECT }
    );
    return { usuarios, falhasDesconhecidas: desconhecidas[0]?.n || 0, dias: replacements.dias };
}

module.exports = { AuditLog, listAuditLogs, listAuditUsers, resumoAcessos };
