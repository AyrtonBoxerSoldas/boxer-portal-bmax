const { logger } = require("../logger");

async function sendEmail(to, subject, html) {
    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) {
        logger.error({ message: "RESEND_API_KEY não configurada" });
        return false;
    }

    try {
        const res = await fetch("https://api.resend.com/emails", {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${apiKey}`,
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                from: "Portal BMax <noreply@boxersoldas.com.br>",
                to,
                subject,
                html
            })
        });

        if (!res.ok) {
            const error = await res.text();
            logger.error({ message: "Resend error", error, to });
            return false;
        }

        logger.info({ message: "Email enviado", to, subject });
        return true;
    } catch (err) {
        logger.error({ message: "Erro ao enviar email", to, error: err.message });
        return false;
    }
}

async function sendAccessCredentials(email, username, password, role) {
    const roleLabel = {
        representante: "Representante",
        revenda: "Revenda",
        funcionario: "Funcionário Boxer",
        adm: "Administrador"
    }[role] || role;

    const portalUrl = "https://bmax.boxersoldas.com.br";
    const motorUrl = "https://bmax-motor.pages.dev";

    const html = `
    <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px">
        <h2 style="color:#333">Bem-vindo ao Portal BMAX! 🎉</h2>

        <p>Sua conta foi criada com sucesso como <strong>${roleLabel}</strong>.</p>

        <div style="background:#f5f5f5;padding:20px;border-radius:8px;margin:20px 0">
            <h3 style="margin-top:0">Seus dados de acesso:</h3>
            <p><strong>Usuário:</strong> <code style="background:#fff;padding:4px 8px;border-radius:4px">${username}</code></p>
            <p><strong>Senha:</strong> <code style="background:#fff;padding:4px 8px;border-radius:4px">${password}</code></p>
        </div>

        <h3>Acessar os sistemas:</h3>
        <ul style="list-style:none;padding:0">
            <li style="margin:10px 0">
                <a href="${portalUrl}" style="background:#25bbee;color:white;padding:12px 24px;border-radius:6px;text-decoration:none;display:inline-block">
                    Acessar Portal BMAX
                </a>
            </li>
            ${role !== "revenda" ? `
            <li style="margin:10px 0">
                <a href="${motorUrl}" style="background:#1e88e5;color:white;padding:12px 24px;border-radius:6px;text-decoration:none;display:inline-block">
                    Acessar Motor
                </a>
            </li>
            ` : ""}
        </ul>

        <hr style="border:none;border-top:1px solid #ddd;margin:30px 0">
        <p style="font-size:12px;color:#666">
            <strong>Importante:</strong> Recomendamos que você mude sua senha na primeira vez que acessar a plataforma.
        </p>
    </div>
    `;

    return await sendEmail(email, "Suas credenciais de acesso - Portal BMAX", html);
}

// Alerta rápido pro admin (via EMAIL_FALLBACK) quando uma ação de gestão falha
// no servidor — criar/editar revenda ou representante, resetar senha, vincular
// grupo, etc. Fire-and-forget de propósito: nunca deve derrubar a resposta de
// erro original pro usuário só porque o alerta em si falhou.
async function alertarAdminErro(contexto, err, detalhes = {}) {
    const destino = process.env.EMAIL_FALLBACK;
    if (!destino) return false;

    const linhasDetalhe = Object.entries(detalhes)
        .map(([k, v]) => `<li><strong>${k}:</strong> ${v}</li>`)
        .join("");

    const html = `
    <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px">
        <h2 style="color:#e30613">⚠️ Erro no Portal BMAX</h2>
        <p><strong>Onde:</strong> ${contexto}</p>
        <p><strong>Mensagem:</strong> ${err?.message || String(err)}</p>
        ${linhasDetalhe ? `<ul>${linhasDetalhe}</ul>` : ""}
        <p style="font-size:12px;color:#666">A ação NÃO foi concluída — a tela do usuário já mostrou o erro. Este e-mail é só pra você ficar sabendo sem precisar que alguém avise por fora.</p>
    </div>`;

    return await sendEmail(destino, `BMAX - Erro: ${contexto}`, html).catch(() => false);
}

module.exports = {
    sendEmail,
    sendAccessCredentials,
    alertarAdminErro
}