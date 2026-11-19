// DDL aditivo e idempotente (3º adendo, Tarefa B1, 26/10/2026) — liga o card
// de origem (BMAX) ao card novo criado no INDÚSTRIA - INTERNO quando o
// caminho de venda "BOX+REV>IND" transfere a negociação entre pipes (ver
// transferirCardParaIndustria, src/services/pipefyLeads.service.js).
// resolverCardId segue essa ligação até o card vivo. Rodar UMA vez em
// produção junto com o deploy:
//   node scripts/create-pipefy-transferencias-table.js
require("dotenv").config({ quiet: true });
const { sequelize } = require("../src/database");

const sql = `
CREATE TABLE IF NOT EXISTS bmax_pipefy_transferencias (
  card_origem TEXT PRIMARY KEY,
  card_destino TEXT NOT NULL,
  criado_em TIMESTAMP NOT NULL DEFAULT now()
);
`;

(async () => {
    try {
        await sequelize.query(sql);
        console.log("OK: bmax_pipefy_transferencias pronta");
        process.exit(0);
    } catch (e) {
        console.error("ERRO:", e.message);
        process.exit(1);
    }
})();
