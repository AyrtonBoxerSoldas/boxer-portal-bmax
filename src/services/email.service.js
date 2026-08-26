async function sendEmail(to, subject, html) {
    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) {
        console.error("RESEND_API_KEY não configurada");
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
            console.error("Resend error:", error);
            return false;
        }

        console.log(`✓ Email enviado para ${to}: ${subject}`);
        return true;
    } catch (err) {
        console.error("❌ Erro ao enviar email:", err.message);
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
    const motorUrl = "https://motor.boxersoldas.com.br";

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

module.exports = {
    sendEmail,
    sendAccessCredentials
}