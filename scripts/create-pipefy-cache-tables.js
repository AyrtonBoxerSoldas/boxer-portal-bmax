// DDL aditivo e idempotente (23/10/2026, Tarefa A6 do 2º adendo) — o cache
// de cards do Pipefy (pipefyLeads.service.js, _cachePorPipe) vive só em
// memória de módulo: numa instância nova da Vercel (partida a frio), some, e
// a próxima leitura precisa ser COMPLETA (~18 chamadas) em vez de
// incremental. Essas 2 tabelas deixam o cache sobreviver entre instâncias —
// best-effort: se o banco falhar, o código segue só com a memória (nunca
// derruba o painel). Sem migration tooling no projeto: rodar UMA vez em
// produção junto com o deploy.
//   node scripts/create-pipefy-cache-tables.js
require("dotenv").config({ quiet: true });
const { sequelize } = require("../src/database");

const sql = `
CREATE TABLE IF NOT EXISTS bmax_pipefy_cache_cards (
  pipe TEXT NOT NULL,
  card_id TEXT NOT NULL,
  card JSONB NOT NULL,
  atualizado_em TIMESTAMP NOT NULL DEFAULT now(),
  PRIMARY KEY (pipe, card_id)
);
CREATE TABLE IF NOT EXISTS bmax_pipefy_cache_estado (
  pipe TEXT PRIMARY KEY,
  maior_updated_at TEXT,
  ultima_leitura_completa TIMESTAMP NOT NULL
);
`;

(async () => {
    try {
        await sequelize.query(sql);
        console.log("OK: bmax_pipefy_cache_cards e bmax_pipefy_cache_estado prontas");
        process.exit(0);
    } catch (e) {
        console.error("ERRO:", e.message);
        process.exit(1);
    }
})();
