// DDL aditivo e idempotente (14/10/2026) — anexos de orçamento da Nova Negociação.
// Sem migration tooling: rodar UMA vez em produção junto com o deploy.
//   node scripts/create-orcamentos.js
// Cria: tabela bmax_orcamentos (Postgres boxer-bmax) + bucket privado "bmax-orcamentos" no Storage do Supabase boxer-sistemas.
require("dotenv").config({ quiet: true });
const { sequelize } = require("../src/database");
const { SB_SISTEMAS_URL } = require("../src/config/supabaseSistemas");

const sql = `
CREATE TABLE IF NOT EXISTS bmax_orcamentos (
  id SERIAL PRIMARY KEY,
  token TEXT NOT NULL UNIQUE,            -- código aleatório do link fixo /api/orcamento/<token>
  user_id INTEGER NOT NULL,
  nome_arquivo TEXT NOT NULL,
  mime TEXT,
  tamanho INTEGER,
  caminho TEXT NOT NULL,                 -- caminho do objeto no bucket
  status TEXT NOT NULL DEFAULT 'pendente', -- pendente (enviado, ainda sem negociação) | anexado
  negociacao_id INTEGER,
  deal_id TEXT,                          -- card no RD
  nota_rd_em TIMESTAMP,                  -- quando o link entrou na nota do card (NULL = ainda falta)
  revogado_em TIMESTAMP,
  aberturas INTEGER NOT NULL DEFAULT 0,
  ultima_abertura_em TIMESTAMP,
  criado_em TIMESTAMP NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS bmax_orcamentos_deal_idx ON bmax_orcamentos (deal_id);
CREATE INDEX IF NOT EXISTS bmax_orcamentos_status_idx ON bmax_orcamentos (status, criado_em);
`;

(async () => {
    try {
        await sequelize.query(sql);
        console.log("OK: tabela bmax_orcamentos pronta");

        const key = process.env.SUPABASE_SERVICE_KEY_SISTEMAS;
        if (!key) throw new Error("SUPABASE_SERVICE_KEY_SISTEMAS não configurada");
        const h = { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json" };
        const existe = await fetch(`${SB_SISTEMAS_URL}/storage/v1/bucket/bmax-orcamentos`, { headers: h });
        if (existe.ok) {
            console.log("OK: bucket bmax-orcamentos já existe");
        } else {
            const r = await fetch(`${SB_SISTEMAS_URL}/storage/v1/bucket`, {
                method: "POST", headers: h,
                body: JSON.stringify({
                    id: "bmax-orcamentos", name: "bmax-orcamentos", public: false,
                    file_size_limit: 10 * 1024 * 1024
                })
            });
            console.log(r.ok ? "OK: bucket bmax-orcamentos criado (privado, 10 MB por arquivo)" : "ERRO bucket: " + r.status + " " + (await r.text()));
            if (!r.ok) process.exit(1);
        }
        process.exit(0);
    } catch (e) {
        console.error("ERRO:", e.message);
        process.exit(1);
    }
})();
