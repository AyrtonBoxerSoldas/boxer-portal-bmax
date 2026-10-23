// DDL aditivo e idempotente (15/10/2026) — correspondência entre o ID da
// negociação no RD e o ID do card no Pipefy. Sem migration tooling no
// projeto: rodar UMA vez em produção junto com o deploy.
//   node scripts/create-rd-pipefy-map-table.js
require("dotenv").config({ quiet: true });
const { sequelize } = require("../src/database");

const sql = `
CREATE TABLE IF NOT EXISTS bmax_rd_pipefy_map (
  rd_deal_id TEXT PRIMARY KEY,
  pipefy_card_id TEXT UNIQUE NOT NULL,
  criado_em TIMESTAMP NOT NULL DEFAULT now()
);
`;

(async () => {
    try {
        await sequelize.query(sql);
        console.log("OK: bmax_rd_pipefy_map pronta");
        process.exit(0);
    } catch (e) {
        console.error("ERRO:", e.message);
        process.exit(1);
    }
})();
