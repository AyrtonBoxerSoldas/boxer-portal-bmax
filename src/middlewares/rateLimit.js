// Rate limiting em memória, por IP. Simples e suficiente para o volume atual do
// Portal, mas não é compartilhado entre instâncias serverless da Vercel — sob
// carga alta (múltiplas instâncias frias), o limite real efetivo pode ser maior
// que o configurado. Se isso virar um problema real, mover o contador para uma
// tabela no Postgres (mesmo padrão do AuditLog) resolveria.
function createRateLimiter({ windowMs, max, message }) {
    const attempts = new Map();

    return function rateLimit(req, res, next) {
        const ip = req.headers["x-forwarded-for"]?.split(",")[0]?.trim() || req.ip;
        const now = Date.now();
        const record = attempts.get(ip);

        if (record) {
            record.timestamps = record.timestamps.filter(t => now - t < windowMs);
            if (record.timestamps.length >= max) {
                return res.status(429).json({ error: message });
            }
            record.timestamps.push(now);
        } else {
            attempts.set(ip, { timestamps: [now] });
        }

        if (attempts.size > 10000) {
            const cutoff = now - windowMs;
            for (const [key, val] of attempts) {
                if (!val.timestamps.length || val.timestamps[val.timestamps.length - 1] < cutoff) {
                    attempts.delete(key);
                }
            }
        }

        next();
    };
}

const loginRateLimit = createRateLimiter({
    windowMs: 15 * 60 * 1000,
    max: 10,
    message: "Muitas tentativas de login. Tente novamente em 15 minutos."
});

const forgotPasswordRateLimit = createRateLimiter({
    windowMs: 15 * 60 * 1000,
    max: 5,
    message: "Muitas solicitações de redefinição de senha. Tente novamente em 15 minutos."
});

// Para ações sensíveis autenticadas (saques, sync com RD Station, recálculo de
// cashback) — mais permissivo que login/forgot-password pois é uso legítimo
// repetido por admins/revendas, só limita abuso/automação descontrolada.
const sensitiveActionRateLimit = createRateLimiter({
    windowMs: 15 * 60 * 1000,
    max: 20,
    message: "Muitas requisições em pouco tempo. Tente novamente em alguns minutos."
});

module.exports = { createRateLimiter, loginRateLimit, forgotPasswordRateLimit, sensitiveActionRateLimit };
