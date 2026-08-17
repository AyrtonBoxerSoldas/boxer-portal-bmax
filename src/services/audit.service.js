async function auditLog(req, {
    action,
    entityType = null,
    entityId = null,
    status = "success",
    metadata = {}
}) {
    const ip =
        req.headers["x-forwarded-for"]?.split(",")[0]?.trim() ||
        req.socket?.remoteAddress ||
        req.ip ||
        null;

    return AuditLog.create({
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
}