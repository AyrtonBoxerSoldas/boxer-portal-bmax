// ETAPA 3 (Portal Postgres): colunas NULAS de código ao lado dos nomes. Aditivo.
const P = "C:/Users/andre.coelho.BXSD/BOXER/Dados - Documentos/Comercial/Geral/Estrategia/2026/Projeto BMax/boxer-portal-bmax";
process.chdir(P); require(P + "/node_modules/dotenv").config({ quiet: true });
const db = require(P + "/src/database");
(async () => {
  const s = db.sequelize;
  for (const t of ["bmax_saldo", "bmax_transacoes", "bmax_saques"])
    await s.query(`ALTER TABLE ${t} ADD COLUMN IF NOT EXISTS revenda_id uuid, ADD COLUMN IF NOT EXISTS grupo_id uuid, ADD COLUMN IF NOT EXISTS representante_id uuid`);
  await s.query(`ALTER TABLE "Revendas" ADD COLUMN IF NOT EXISTS revenda_id uuid, ADD COLUMN IF NOT EXISTS grupo_id uuid`);
  await s.query(`CREATE INDEX IF NOT EXISTS bmax_saldo_revenda_id_idx ON bmax_saldo (revenda_id)`);
  await s.query(`CREATE INDEX IF NOT EXISTS bmax_transacoes_revenda_id_idx ON bmax_transacoes (revenda_id)`);
  await s.query(`CREATE INDEX IF NOT EXISTS bmax_saques_revenda_id_idx ON bmax_saques (revenda_id)`);
  console.log("colunas criadas");
  process.exit(0);
})().catch(e => { console.error("ERRO", e.message); process.exit(1); });
