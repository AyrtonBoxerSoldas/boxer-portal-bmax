const nodemailer = require("nodemailer");

const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: process.env.SMTP_PORT,
    secure: false,
    auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS
    }
});

async function sendEmail(to, subject, html) {
    await transporter.sendMail({
        from: `"Portal BMAX" <${process.env.SMTP_USER}>`,
        to,
        subject,
        html
    });
}

async function sendAccessCredentials(email, username, password, role) {
    const roleLabel = {
        representante: "Representante",
        revenda: "Revenda",
        funcionario: "Funcionário Boxer",
        adm: "Administrador"
    }[role] || role;

    const portalUrl = process.env.PORTAL_URL || "https://bmax.boxer.com.br";
    const motorUrl = process.env.MOTOR_URL || "https://motor.boxer.com.br";

    const html = `
    <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px">
        <h2 style="color:#333">Bem-vindo ao Portal BMAX!</h2>

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
            <li style="margin:10px 0">
                <a href="${motorUrl}" style="background:#333;color:white;padding:12px 24px;border-radius:6px;text-decoration:none;display:inline-block">
                    Acessar Motor PCI
                </a>
            </li>
        </ul>

        <hr style="border:none;border-top:1px solid #ddd;margin:30px 0">
        <p style="font-size:12px;color:#666">
            Se tiver dúvidas, entre em contato com o suporte: ${process.env.SUPPORT_EMAIL || "support@boxer.com.br"}
        </p>
    </div>
    `;

    await sendEmail(email, "Suas credenciais de acesso - Portal BMAX", html);
}

module.exports = {
    sendEmail,
    sendAccessCredentials
}