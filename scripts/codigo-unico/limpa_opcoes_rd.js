// Remove do picklist REVENDA/LOJA do RD as opções SEM loja ativa e SEM nenhum card em NENHUM funil. Uso: node limpa_opcoes_rd.js [--aplicar]
const P = "C:/Users/andre.coelho.BXSD/BOXER/Dados - Documentos/Comercial/Geral/Estrategia/2026/Projeto BMax/boxer-portal-bmax";
process.chdir(P); require(P + "/node_modules/dotenv").config({ quiet: true });
const fs = require("fs");
const db = require(P + "/src/database"); const { QueryTypes } = require(P + "/node_modules/sequelize");
const { sbSistemasService } = require(P + "/src/config/supabaseSistemas"); const l = require(P + "/src/services/rd.leads.service");
const q = (s) => db.sequelize.query(s, { type: QueryTypes.SELECT });
const t = s => String(s || "").trim(); const k = s => t(s).toLowerCase();
const APLICAR = process.argv.includes("--aplicar");
(async () => {
  const fieldId = await (async () => { const r = await fetch(`https://crm.rdstation.com/api/v1/custom_fields?token=${process.env.RD_CRM_TOKEN}`); const a = await r.json(); const f = (a.custom_fields || a).find(x => x.label && x.label.trim().toUpperCase() === "REVENDA/LOJA"); return f._id || f.id; })();
  const campo = await (await fetch(`https://crm.rdstation.com/api/v1/custom_fields/${fieldId}?token=${process.env.RD_CRM_TOKEN}`)).json();
  const opts = campo.opts || [];
  const cad = await sbSistemasService("/comercial_revendas_bmax?select=nome,nome_rd,ativo");
  const ativas = new Set(cad.filter(c => c.ativo).map(c => k(c.nome_rd || c.nome)));   // nome único = nome_rd (o nome de cadastro do ZEN é só referência)
  const logins = new Set((await q(`SELECT name FROM "Revendas"`)).map(x => k(x.name)));
  const tabG = new Set((await q(`SELECT revenda_rd FROM bmax_grupos`)).map(x => k(x.revenda_rd)));
  const razao = new Set((await q(`SELECT DISTINCT revenda n FROM bmax_saldo UNION SELECT DISTINCT revenda FROM bmax_transacoes UNION SELECT DISTINCT revenda FROM bmax_saques`)).map(x => k(x.n)));
  const deals = await l.fetchAllDealsAllPipelines(); const cards = {};
  deals.forEach(d => { const r = k(l.getCustomField(d, "REVENDA/LOJA")); if (r) cards[r] = (cards[r] || 0) + 1; });
  const manter = [], remover = [], comCards = [];
  for (const o of opts) {
    const c = k(o);
    if (c === "sem revenda") { manter.push([o, "placeholder do sistema"]); continue; }
    if (ativas.has(c)) { manter.push([o, "loja ativa"]); continue; }
    if (logins.has(c)) { manter.push([o, "nome de login"]); continue; }
    if (tabG.has(c)) { manter.push([o, "nome em grupo (bmax_grupos)"]); continue; }
    if (razao.has(c)) { manter.push([o, "tem cashback/saque"]); continue; }
    if (cards[c]) { comCards.push([o, cards[c]]); continue; }
    remover.push(o);
  }
  console.log(`opções hoje: ${opts.length} | mantidas: ${manter.length} | REMOVER (sem loja ativa e sem cards): ${remover.length} | sem loja ativa MAS com cards (mantidas): ${comCards.length} | cards lidos: ${deals.length}`);
  console.log("REMOVER:", JSON.stringify(remover));
  console.log("COM CARDS (ficam):", JSON.stringify(comCards));
  if (APLICAR) {
    fs.writeFileSync("C:/Users/andre.coelho.BXSD/BOXER/Dados - Documentos/Comercial/Geral/Estrategia/2026/Projeto BMax/Documentação/Backups_Banco/rd_opcoes_revenda_ANTES_limpeza_18-11-2026.json", JSON.stringify({ gerado_em: new Date().toISOString(), campo_id: fieldId, opts }, null, 1));
    const rem = new Set(remover.map(k)); const novas = opts.filter(o => !rem.has(k(o)));
    const r = await fetch(`https://crm.rdstation.com/api/v1/custom_fields/${fieldId}?token=${process.env.RD_CRM_TOKEN}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ custom_field: { opts: novas } }) });
    const depois = await (await fetch(`https://crm.rdstation.com/api/v1/custom_fields/${fieldId}?token=${process.env.RD_CRM_TOKEN}`)).json();
    console.log("PUT RD:", r.status, "| opções agora:", (depois.opts || []).length, "| removidas de fato:", opts.length - (depois.opts || []).length);
  }
  process.exit(0);
})().catch(e => { console.error("ERRO", e.stack || e.message); process.exit(1); });
