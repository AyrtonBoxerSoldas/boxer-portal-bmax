// Remove SÓ os lançamentos criados por mim hoje (19/11) para o card JOETEC envolvendo SANTOS/Caio, deixando o crédito ORIGINAL de R$520 do SANTOS. Backup antes.
const P = "C:/Users/andre.coelho.BXSD/BOXER/Dados - Documentos/Comercial/Geral/Estrategia/2026/Projeto BMax/boxer-portal-bmax";
process.chdir(P); require(P + "/node_modules/dotenv").config({ quiet: true });
const fs = require("fs"); const db = require(P + "/src/database"); const { QueryTypes } = require(P + "/node_modules/sequelize");
const q = (s, r) => db.sequelize.query(s, { replacements: r || {}, type: QueryTypes.SELECT });
const LEAD = "6afda441046807001fa60a48";
(async () => {
  const rows = await q(`SELECT * FROM bmax_transacoes WHERE lead_id=:l AND tipo_agente='representante' AND revenda IN ('SANTOS','Caio P Mancini') ORDER BY criado_em`, { l: LEAD });
  console.log("linhas do lead (representante):", rows.map(r => `${r.criado_em.toISOString().slice(11, 19)} ${r.revenda} ${r.tipo} ${r.valor}`).join(" | "));
  const original = rows.find(r => r.revenda === "SANTOS" && r.tipo === "credito"); if (!original || rows[0].id !== original.id) throw new Error("não achei o crédito original como 1ª linha");
  const meus = rows.filter(r => r.id !== original.id); if (meus.length !== 5) throw new Error("esperava 5 lançamentos meus, achei " + meus.length);
  const antes = await q(`SELECT revenda, saldo::text FROM bmax_saldo WHERE tipo_agente='representante' AND revenda IN ('SANTOS','Caio P Mancini')`);
  fs.writeFileSync("C:/Users/andre.coelho.BXSD/BOXER/Dados - Documentos/Comercial/Geral/Estrategia/2026/Projeto BMax/Documentação/Backups_Banco/lancamentos_santos_caio_removidos_19-11-2026.json", JSON.stringify({ removidos: meus, saldos_antes: antes }, null, 1));
  const deltaS = meus.filter(r => r.revenda === "SANTOS").reduce((s, r) => s + (r.tipo === "credito" ? Number(r.valor) : -Number(r.valor)), 0);
  const deltaC = meus.filter(r => r.revenda === "Caio P Mancini").reduce((s, r) => s + (r.tipo === "credito" ? Number(r.valor) : -Number(r.valor)), 0);
  for (const r of meus) await db.sequelize.query(`DELETE FROM bmax_transacoes WHERE id=:i`, { replacements: { i: r.id }, type: QueryTypes.DELETE });
  await db.sequelize.query(`UPDATE bmax_saldo SET saldo = saldo - :d, atualizado_em = NOW() WHERE tipo_agente='representante' AND revenda='SANTOS'`, { replacements: { d: deltaS }, type: QueryTypes.UPDATE });
  if (deltaC) await db.sequelize.query(`UPDATE bmax_saldo SET saldo = saldo - :d, atualizado_em = NOW() WHERE tipo_agente='representante' AND revenda='Caio P Mancini'`, { replacements: { d: deltaC }, type: QueryTypes.UPDATE });
  console.log("deltas removidos: SANTOS", deltaS, "| Caio", deltaC);
  console.log("saldos depois:", JSON.stringify(await q(`SELECT revenda, saldo::text FROM bmax_saldo WHERE tipo_agente='representante' AND revenda IN ('SANTOS','Caio P Mancini') ORDER BY 1`)));
  const chk = await q(`SELECT revenda, COALESCE(SUM(CASE WHEN tipo='credito' THEN valor ELSE -valor END),0)::text v FROM bmax_transacoes WHERE tipo_agente='representante' AND revenda IN ('SANTOS','Caio P Mancini') GROUP BY revenda ORDER BY 1`);
  console.log("soma dos lançamentos (deve bater com o saldo):", JSON.stringify(chk));
  process.exit(0);
})().catch(e => { console.error("ERRO", e.stack || e.message); process.exit(1); });
