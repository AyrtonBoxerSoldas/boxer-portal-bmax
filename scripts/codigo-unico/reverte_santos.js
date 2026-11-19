// Reverte a troca de representante do card JOETEC: volta a SANTOS (RD) e devolve o crédito de R$520 de Caio P Mancini para SANTOS (estorno COM lead_id).
const P = "C:/Users/andre.coelho.BXSD/BOXER/Dados - Documentos/Comercial/Geral/Estrategia/2026/Projeto BMax/boxer-portal-bmax";
process.chdir(P); require(P + "/node_modules/dotenv").config({ quiet: true });
const db = require(P + "/src/database"); const { QueryTypes } = require(P + "/node_modules/sequelize");
const l = require(P + "/src/services/rd.leads.service"); const saldo = require(P + "/src/services/saldo.service"); const { recalcularComissoes } = require(P + "/src/services/comissao.service");
const q = (s, r) => db.sequelize.query(s, { replacements: r || {}, type: QueryTypes.SELECT });
const LEAD = "6afda441046807001fa60a48";
(async () => {
  const net = async (nome) => Number((await q(`SELECT COALESCE(SUM(CASE WHEN tipo='credito' THEN valor ELSE -valor END),0) v FROM bmax_transacoes WHERE lead_id=:l AND revenda=:n AND tipo_agente='representante'`, { l: LEAD, n: nome }))[0].v);
  console.log("antes — líquido no lead: Caio P Mancini", await net("Caio P Mancini"), "| SANTOS", await net("SANTOS"));
  await l.updateLead(LEAD, { data: { custom_fields: { representante: "SANTOS" } } });
  const d = await l.getDealById(LEAD); console.log("card REPRESENTANTE agora:", l.getCustomField(d, "REPRESENTANTE"));
  if ((await net("Caio P Mancini")) === 520) {
    await saldo.debitarCashback("Caio P Mancini", 520, `Estorno: reversão da troca de representante (volta a SANTOS) — lead ${LEAD} — pedido do André 19/11/2026`, null, "representante");
    await db.sequelize.query(`UPDATE bmax_transacoes SET lead_id=:l WHERE id=(SELECT id FROM bmax_transacoes WHERE revenda='Caio P Mancini' AND tipo='debito' AND lead_id IS NULL ORDER BY criado_em DESC LIMIT 1)`, { replacements: { l: LEAD }, type: QueryTypes.UPDATE });
    await saldo.creditarCashback("SANTOS", 520, `Reversão: crédito devolvido ao representante do card (SANTOS) — lead ${LEAD} — pedido do André 19/11/2026`, LEAD, "representante", { pci: "PCI 6", classePreco: null, comissaoPct: null });
  }
  console.log("depois — líquido no lead: Caio P Mancini", await net("Caio P Mancini"), "| SANTOS", await net("SANTOS"));
  const rc = await recalcularComissoes(); console.log("recálculo do robô (deve ser 0 ajustes neste lead):", JSON.stringify({ ajustados: rc.ajustados, erros: rc.erros, detalhes: rc.detalhes.filter(x => x.dealId === LEAD) }));
  console.log("saldos:", JSON.stringify(await q(`SELECT revenda, saldo::text FROM bmax_saldo WHERE tipo_agente='representante' AND revenda IN ('SANTOS','Caio P Mancini') ORDER BY 1`)));
  process.exit(0);
})().catch(e => { console.error("ERRO", e.stack || e.message); process.exit(1); });
