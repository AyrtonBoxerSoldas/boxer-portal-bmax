// SOMENTE LEITURA: resíduos de nomes antigos por grupo: bmax_grupos x lojas ativas, nomes de carteira x lojas, e as 15 opções legadas do RD
const P = "C:/Users/andre.coelho.BXSD/BOXER/Dados - Documentos/Comercial/Geral/Estrategia/2026/Projeto BMax/boxer-portal-bmax";
process.chdir(P); require(P + "/node_modules/dotenv").config({ quiet: true });
const db = require(P + "/src/database"); const { QueryTypes } = require(P + "/node_modules/sequelize");
const { sbSistemasService } = require(P + "/src/config/supabaseSistemas"); const l = require(P + "/src/services/rd.leads.service");
const q = (s) => db.sequelize.query(s, { type: QueryTypes.SELECT });
const nz = s => String(s || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toLowerCase().replace(/\s+/g, " ");
(async () => {
  const lojas = await sbSistemasService("/comercial_revendas_bmax?ativo=eq.true&select=id,nome,nome_rd,grupo"); const can = n => nz(n);
  const nomesAtivos = new Set(lojas.map(x => can(x.nome_rd || x.nome))); const grupos = new Set(lojas.map(x => x.grupo).filter(Boolean));
  const tab = await q(`SELECT grupo, revenda_rd FROM bmax_grupos ORDER BY grupo, revenda_rd`);
  const deals = await l.fetchAllDealsAllPipelines(); const cards = {}; deals.forEach(d => { const v = String(l.getCustomField(d, "REVENDA/LOJA") || ""); if (v) cards[v] = (cards[v] || 0) + 1; });
  console.log("== bmax_grupos: linhas que NÃO são o nome de uma loja ativa (nem o do próprio grupo) ==");
  for (const t of tab) { const ok = nomesAtivos.has(can(t.revenda_rd)) || can(t.revenda_rd) === can(t.grupo); if (!ok) console.log(`  [${t.grupo}] "${t.revenda_rd}" | cards com esse nome: ${cards[t.revenda_rd] || 0}`); }
  console.log("== bmax_grupos: lojas ativas de grupo SEM linha ==");
  for (const x of lojas.filter(z => z.grupo)) { const n = x.nome_rd || x.nome; if (!tab.some(t => t.grupo === x.grupo && can(t.revenda_rd) === can(n))) console.log(`  [${x.grupo}] falta "${n}"`); }
  console.log("== carteiras (cashback de revenda) com nome que não é de loja ativa nem de grupo ==");
  const sal = await q(`SELECT revenda, saldo::text s, revenda_id, grupo_id FROM bmax_saldo WHERE tipo_agente='revenda'`);
  for (const s of sal) if (!nomesAtivos.has(can(s.revenda)) && !grupos.has(s.revenda)) console.log(`  "${s.revenda}" saldo ${s.s} | revenda_id ${s.revenda_id ? "sim" : "não"} grupo_id ${s.grupo_id ? "sim" : "não"}`);
  console.log("== as opções legadas do RD ==");
  const opc = await l.getOpcoesRevendaRD(); const leg = opc.filter(o => !nomesAtivos.has(can(o)) && can(o) !== "sem revenda");
  for (const o of leg) console.log(`  "${o}" | cards: ${cards[o] || 0} | em bmax_grupos: ${tab.filter(t => t.revenda_rd === o).map(t => t.grupo).join(",") || "-"} | carteira: ${sal.some(s => s.revenda === o) ? "SIM" : "não"}`);
  process.exit(0);
})().catch(e => { console.error("ERRO", e.stack || e.message); process.exit(1); });
