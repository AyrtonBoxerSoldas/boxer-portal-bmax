const attempts = new Map();

const WINDOW_MS = 15 * 60 * 1000;
const MAX_ATTEMPTS = 10;

function loginRateLimit(req, res, next) {
    const ip = req.headers["x-forwarded-for"]?.split(",")[0]?.trim() || req.ip;
    const now = Date.now();
    const record = attempts.get(ip);

    if (record) {
        record.timestamps = record.timestamps.filter(t => now - t < WINDOW_MS);
        if (record.timestamps.length >= MAX_ATTEMPTS) {
            return res.status(429).json({ error: "Muitas tentativas de login. Tente novamente em 15 minutos." });
        }
        record.timestamps.push(now);
    } else {
        attempts.set(ip, { timestamps: [now] });
    }

    if (attempts.size > 10000) {
        const cutoff = now - WINDOW_MS;
        for (const [key, val] of attempts) {
            if (!val.timestamps.length || val.timestamps[val.timestamps.length - 1] < cutoff) {
                attempts.delete(key);
            }
        }
    }

    next();
}

module.exports = { loginRateLimit };
