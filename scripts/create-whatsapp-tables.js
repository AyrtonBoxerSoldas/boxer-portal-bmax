// DDL aditivo e idempotente (14/10/2026) — avisos por WhatsApp (canal só de comunicação).
// Sem migration tooling: rodar UMA vez em produção junto com o deploy.
//   node scripts/create-whatsapp-tables.js
require("dotenv").config({ quiet: true });
const { sequelize } = require("../src/database");

const sql = `
-- Quando a revenda autorizou receber avisos por WhatsApp (NULL = não autorizou). Exigência da Meta + LGPD.
ALTER TABLE "Revendas" ADD COLUMN IF NOT EXISTS whatsapp_aceite_em TIMESTAMP;

-- Registro do que já foi enviado, pra nunca repetir o mesmo aviso (chave = lead, marco de prazo, mês...).
CREATE TABLE IF NOT EXISTS bmax_whatsapp_envios (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL,
  tipo TEXT NOT NULL,
  chave TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'enviado',
  provider_sid TEXT,
  enviado_em TIMESTAMP NOT NULL DEFAULT now(),
  UNIQUE (user_id, tipo, chave)
);
`;

(async () => {
    try {
        await sequelize.query(sql);
        console.log('OK: "Revendas".whatsapp_aceite_em e bmax_whatsapp_envios prontos');
        process.exit(0);
    } catch (e) {
        console.error("ERRO:", e.message);
        process.exit(1);
    }
})();
