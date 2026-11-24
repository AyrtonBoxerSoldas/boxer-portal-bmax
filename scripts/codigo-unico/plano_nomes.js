// SOMENTE LEITURA: onde o nome de cada loja ATIVA aparece (cadastro, login, grupos, razão, apelidos, cards do RD) e quem está fora do padrão
const P = "C:/Users/andre.coelho.BXSD/BOXER/Dados - Documentos/Comercial/Geral/Estrategia/2026/Projeto BMax/boxer-portal-bmax";
process.chdir(P); require(P + "/node_modules/dotenv").config({ quiet: true });
const fs = require("fs"); const db = require(P + "/src/database"); const { QueryTypes } = require(P + "/node_modules/sequelize");
const { sbSistemasService } = require(P + "/src/config/supabaseSistemas"); const l = require(P + "/src/services/rd.leads.service");
const q = (s) => db.sequelize.query(s, { type: QueryTypes.SELECT });
const nz = s => String(s || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toLowerCase().replace(/\s+/g, " ");
(async () => {
  const lojas = await sbSistemasService("/comercial_revendas_bmax?ativo=eq.true&select=id,nome,nome_rd,grupo,grupo_id,cidade,estado,cnpj,user_id&order=nome");
  const apel = await sbSistemasService("/comercial_bmax_apelidos?select=entidade,entidade_id,origem,apelido&limit=5000");
  const logins = await q(`SELECT user_id, name, grupo FROM "Revendas"`); const lg = new Map(logins.map(x => [x.user_id, x]));
  const tab = await q(`SELECT grupo, revenda_rd FROM bmax_grupos`);
  const led = await q(`SELECT revenda_id, grupo_id, revenda nome, 'saldo' o FROM bmax_saldo WHERE tipo_agente='revenda' UNION ALL SELECT revenda_id, grupo_id, revenda, 'trans' FROM bmax_transacoes WHERE tipo_agente='revenda' UNION ALL SELECT revenda_id, grupo_id, revenda, 'saque' FROM bmax_saques`);
  const deals = await l.fetchAllDealsAllPipelines(); const cards = {}; deals.forEach(d => { const v = String(l.getCustomField(d, "REVENDA/LOJA") || ""); if (v) cards[v] = (cards[v] || 0) + 1; });
  const opc = new Set((await l.getOpcoesRevendaRD()).map(String));
  const suja = n => /^\s*\d{3,6}\b/.test(n) || n === n.toLowerCase() || /,/.test(n) || /\bltda\b/i.test(n);
  const out = [];
  for (const x of lojas) {
    const can = x.nome_rd || x.nome; const meus = apel.filter(a => (a.entidade === "revenda" && a.entidade_id === x.id)).map(a => a.apelido);
    const nomesLedger = [...new Set(led.filter(r => r.revenda_id === x.id).map(r => r.nome))];
    const grp = x.grupo_id ? tab.filter(t => t.grupo === x.grupo).map(t => t.revenda_rd) : [];
    const rdVals = [...new Set([can, ...meus, ...nomesLedger])].filter(n => cards[n]).map(n => `${n}(${cards[n]})`);
    out.push({ id: x.id, can, cadastro_nome: x.nome, grupo: x.grupo || "", cidade: x.cidade, login: x.user_id ? (lg.get(x.user_id) || {}).name : null, apelidos: meus, ledger: nomesLedger, bmax_grupos: grp, cards: rdVals, opcao_rd: opc.has(can), suja: suja(can) });
  }
  fs.writeFileSync("C:/tmp/bmax/plano_nomes.json", JSON.stringify(out, null, 1));
  console.log("lojas ativas:", out.length, "| nome fora do padrão (código ZEN/minúsculo/vírgula/Ltda):", out.filter(o => o.suja).length);
  out.filter(o => o.suja || (o.login && o.login !== o.can && !o.grupo) || o.ledger.some(n => n !== o.can)).forEach(o => console.log(`\n* "${o.can}" [${o.grupo || "sem grupo"}] ${o.cidade} | cadastro nome: "${o.cadastro_nome}" | login: ${JSON.stringify(o.login)} | opção no RD: ${o.opcao_rd}\n    apelidos: ${JSON.stringify(o.apelidos)}\n    razão: ${JSON.stringify(o.ledger)} | bmax_grupos(do grupo): ${JSON.stringify(o.bmax_grupos)}\n    cards por nome: ${JSON.stringify(o.cards)}`));
  process.exit(0);
})().catch(e => { console.error("ERRO", e.stack || e.message); process.exit(1); });
