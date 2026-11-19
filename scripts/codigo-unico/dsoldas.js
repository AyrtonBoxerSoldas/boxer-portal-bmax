// SOMENTE LEITURA: tudo que referencia "D. SOLDAS" / "Aldesoldas"
const P = "C:/Users/andre.coelho.BXSD/BOXER/Dados - Documentos/Comercial/Geral/Estrategia/2026/Projeto BMax/boxer-portal-bmax";
process.chdir(P); require(P + "/node_modules/dotenv").config({ quiet: true });
const db = require(P + "/src/database"); const { QueryTypes } = require(P + "/node_modules/sequelize");
const { sbSistemasService } = require(P + "/src/config/supabaseSistemas"); const l = require(P + "/src/services/rd.leads.service"); const C = require(P + "/src/config/constants");
const q = (s) => db.sequelize.query(s, { type: QueryTypes.SELECT });
(async () => {
  const re = "d\\.? ?soldas|aldesold";
  console.log("CADASTRO:", JSON.stringify(await sbSistemasService("/comercial_revendas_bmax?or=(nome.ilike.*aldesold*,nome_rd.ilike.*aldesold*,nome.ilike.*d.%20soldas*,nome_rd.ilike.*d.%20soldas*)&select=id,nome,nome_rd,ativo,classe,rep,grupo,user_id,cidade,estado")));
  console.log("APELIDOS:", JSON.stringify(await sbSistemasService("/comercial_bmax_apelidos?or=(apelido.ilike.*aldesold*,apelido.ilike.*d.%20soldas*)&select=entidade,origem,apelido")));
  console.log("LOGIN:", JSON.stringify(await q(`SELECT r.name, r.grupo, u.username FROM "Revendas" r JOIN "Users" u ON u.id=r.user_id WHERE r.name ~* '${re}'`)));
  console.log("bmax_grupos:", JSON.stringify(await q(`SELECT grupo, revenda_rd FROM bmax_grupos WHERE revenda_rd ~* '${re}' OR grupo ~* '${re}'`)));
  console.log("RAZÃO saldo:", JSON.stringify(await q(`SELECT revenda, tipo_agente, saldo FROM bmax_saldo WHERE revenda ~* '${re}'`)), "| transações:", JSON.stringify(await q(`SELECT revenda, count(*) n FROM bmax_transacoes WHERE revenda ~* '${re}' GROUP BY 1`)), "| saques:", JSON.stringify(await q(`SELECT revenda, status, valor FROM bmax_saques WHERE revenda ~* '${re}'`)));
  const deals = await l.fetchAllDealsAllPipelines(); const out = [];
  deals.forEach(d => { const r = String(l.getCustomField(d, "REVENDA/LOJA") || ""); if (/^\s*d\.?\s*soldas\s*$/i.test(r)) out.push({ id: d.id, nome: d.name, etapa: C.RD_STAGES[d.deal_stage && d.deal_stage.id] || (d.deal_stage && d.deal_stage.name), funil: d.deal_pipeline_name || "", win: d.win, valor: d.amount_total, pci: l.getCustomField(d, "PERFIL PCI"), classe: l.getCustomField(d, "CLASSE DE PREÇO"), rep: l.getCustomField(d, "REPRESENTANTE"), criado: (d.created_at || "").slice(0, 10), fechado: (d.closed_at || "").slice(0, 10) }); });
  console.log("CARDS 'D. SOLDAS':", JSON.stringify(out, null, 0));
  const ald = deals.filter(d => /aldesoldas/i.test(String(l.getCustomField(d, "REVENDA/LOJA") || ""))); console.log("cards já em Aldesoldas:", ald.length);
  const dsq = deals.filter(d => /ap m[aá]quinas/i.test(String(l.getCustomField(d, "REVENDA/LOJA") || ""))).map(d => ({ id: d.id, nome: d.name, etapa: C.RD_STAGES[d.deal_stage && d.deal_stage.id] || (d.deal_stage && d.deal_stage.name), win: d.win, criado: (d.created_at || "").slice(0, 10) })); console.log("CARDS 'Ap Máquinas':", JSON.stringify(dsq));
  process.exit(0);
})().catch(e => { console.error("ERRO", e.stack || e.message); process.exit(1); });
