// DDL aditivo e idempotente (08/10/2026) — regras de prazo do PCI12/PCI12a.
// Sem migration tooling no projeto: rodar UMA vez em produção junto com o deploy.
//   node scripts/create-pci-prazos-tables.js
require("dotenv").config({ quiet: true });
const { sequelize } = require("../src/database");

const sql = `
-- PCI12 pendente: marca quando o prazo de 48h expirou e o sistema aplicou o 12b sozinho
ALTER TABLE bmax_pci12_tracking ADD COLUMN IF NOT EXISTS auto_12b_em TIMESTAMP;

-- PCI12a (revenda assumiu): 60 dias a partir de assumido_em; depois vai pro funil BMAX "Prazo Vencido"
CREATE TABLE IF NOT EXISTS bmax_pci12a_prazo (
  deal_id TEXT PRIMARY KEY,
  assumido_em TIMESTAMP NOT NULL DEFAULT now(),
  aviso_em TIMESTAMP,
  arquivado_em TIMESTAMP,
  criado_em TIMESTAMP NOT NULL DEFAULT now()
);
`;

(async () => {
    try {
        await sequelize.query(sql);
        console.log("OK: bmax_pci12_tracking.auto_12b_em e bmax_pci12a_prazo prontos");
        process.exit(0);
    } catch (e) {
        console.error("ERRO:", e.message);
        process.exit(1);
    }
})();
