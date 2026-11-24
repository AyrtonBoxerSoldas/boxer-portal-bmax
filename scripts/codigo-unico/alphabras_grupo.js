// Alphabras = NOME DO GRUPO em todo lugar (RD, cards, carteira, bmax_grupos, cadastro, apelidos). Pedido do André, 19/11/2026.
const P = "C:/Users/andre.coelho.BXSD/BOXER/Dados - Documentos/Comercial/Geral/Estrategia/2026/Projeto BMax/boxer-portal-bmax";
process.chdir(P); require(P + "/node_modules/dotenv").config({ quiet: true });
const fs = require("fs"); const db = require(P + "/src/database"); const { QueryTypes } = require(P + "/node_modules/sequelize");
const { sbSistemasService } = require(P + "/src/config/supabaseSistemas"); const l = require(P + "/src/services/rd.leads.service");
const q = (s, r) => db.sequelize.query(s, { replacements: r || {}, type: QueryTypes.SELECT });
const x = (s, r, t) => db.sequelize.query(s, { replacements: r || {}, type: t || QueryTypes.UPDATE });
const T = process.env.RD_CRM_TOKEN, B = "https://crm.rdstation.com/api/v1", ED = "claude (pedido do André em 19/11/2026)"; const BK = "C:/Users/andre.coelho.BXSD/BOXER/Dados - Documentos/Comercial/Geral/Estrategia/2026/Projeto BMax/Documentação/Backups_Banco/";
const GRUPO = "Alphabras", VELHA_CARTEIRA = "42863 Alphabras Poços de Caldas 1";
const LEGADO = ["42863 Alphabras Poços de Caldas 1", "alphabras", "31490 Alphabras SJBV ", "31490 Alphabras SJBV", "Alphabras Poços de Caldas 1", "Alphabras Poços de Caldas 2", "42546 Alphabras Poços de Caldas 2", "Alphabras SJBV", "42863, Alpha Abras Comercio De Abrasivos Ltda"];
(async () => {
  const arr = await (await fetch(`${B}/custom_fields?token=${T}`)).json(); const cfs = arr.custom_fields || arr; const campo = cfs.find(z => z.label && z.label.trim() === "REVENDA/LOJA" && (z.for === "deal" || !z.for)); const fid = campo._id || campo.id;
  const atual = (await (await fetch(`${B}/custom_fields/${fid}?token=${T}`)).json()).opts || [];
  fs.writeFileSync(BK + "rd_opcoes_revenda_ANTES_alphabras_19-11-2026.json", JSON.stringify({ fid, opts: atual }, null, 1));
  // 1) opção do RD com a grafia do grupo
  if (!atual.includes(GRUPO)) {
    if (!atual.includes("alphabras")) throw new Error("opção 'alphabras' não encontrada");
    const r = await fetch(`${B}/custom_fields/${fid}?token=${T}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ custom_field: { opts: atual.map(o => o === "alphabras" ? GRUPO : o) } }) }); console.log("1) opção RD 'alphabras' -> 'Alphabras': HTTP", r.status);
  }
  const opcNova = await l.getOpcoesRevendaRD(); if (!opcNova.includes(GRUPO)) throw new Error("opção 'Alphabras' não existe após a troca");
  // 2) cards: todos os nomes antigos -> nome do grupo
  const idRev = fid; const deals = await l.fetchAllDealsAllPipelines(); const alvo = deals.filter(d => LEGADO.includes(String(l.getCustomField(d, "REVENDA/LOJA") || "")) && String(l.getCustomField(d, "REVENDA/LOJA")) !== GRUPO);
  fs.writeFileSync(BK + "cards_alphabras_ANTES_19-11-2026.json", JSON.stringify(alvo.map(d => ({ id: d.id || d._id, nome: d.name, valor_antigo: l.getCustomField(d, "REVENDA/LOJA"), win: d.win })), null, 1));
  let ok = 0, pend = [];
  for (const d of alvo) { const id = d.id || d._id; const r = await fetch(`${B}/deals/${id}?token=${T}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ deal: { deal_custom_fields: [{ custom_field_id: idRev, value: GRUPO }] } }) }); if (r.status === 200) ok++; else pend.push(id + ":" + r.status); }
  console.log("2) cards ->", GRUPO, "| total", alvo.length, "| ok", ok, "| pendentes", JSON.stringify(pend));
  if (pend.length) throw new Error("cards pendentes — paro antes de mexer no razão/grupos");
  // 3) cadastro: as 3 lojas passam a ter o nome do grupo no RD (nome repetido permitido dentro do mesmo grupo)
  const lojas = await sbSistemasService(`/comercial_revendas_bmax?grupo=eq.${GRUPO}&select=id,nome,nome_rd,cidade,user_id`); const g = (await sbSistemasService(`/comercial_bmax_grupos?nome=eq.${GRUPO}&select=id`))[0];
  for (const lj of lojas) await sbSistemasService(`/comercial_revendas_bmax?id=eq.${lj.id}`, "PATCH", { nome_rd: GRUPO, editado_em: new Date().toISOString(), editado_por: ED });
  console.log("3) lojas do grupo com nome_rd =", GRUPO, ":", lojas.map(z => z.cidade).join(", "));
  // 4) carteira de cashback: vira a carteira do GRUPO (como a WST); histórico preservado
  if ((await q(`SELECT 1 FROM bmax_saldo WHERE revenda=:n AND tipo_agente='revenda'`, { n: GRUPO })).length) throw new Error("já existe carteira 'Alphabras'");
  const antes = (await q(`SELECT sum(saldo)::text s, count(*) n FROM bmax_saldo`))[0];
  for (const t of ["bmax_saldo", "bmax_transacoes"]) await x(`UPDATE ${t} SET revenda=:n, grupo_id=:g, revenda_id=NULL WHERE revenda=:v AND tipo_agente='revenda'`, { n: GRUPO, g: g.id, v: VELHA_CARTEIRA });
  await x(`UPDATE bmax_saques SET revenda=:n, grupo_id=:g, revenda_id=NULL WHERE revenda=:v`, { n: GRUPO, g: g.id, v: VELHA_CARTEIRA });
  const dep = (await q(`SELECT sum(saldo)::text s, count(*) n FROM bmax_saldo`))[0]; console.log("4) soma dos saldos", antes.s, "->", dep.s, "| carteiras", antes.n, "->", dep.n, "| carteira:", JSON.stringify(await q(`SELECT revenda, saldo::text FROM bmax_saldo WHERE revenda=:n`, { n: GRUPO })));
  // 5) bmax_grupos: o grupo passa a ter 1 nome (o do grupo)
  const email = (await q(`SELECT email_responsavel e FROM bmax_grupos WHERE grupo=:g AND email_responsavel IS NOT NULL LIMIT 1`, { g: GRUPO }))[0];
  fs.writeFileSync(BK + "bmax_grupos_alphabras_ANTES_19-11-2026.json", JSON.stringify(await q(`SELECT * FROM bmax_grupos WHERE grupo=:g`, { g: GRUPO }), null, 1));
  await x(`INSERT INTO bmax_grupos (revenda_rd, grupo, email_responsavel) VALUES (:n, :g, :e) ON CONFLICT (revenda_rd) DO UPDATE SET grupo=:g`, { n: GRUPO, g: GRUPO, e: email ? email.e : null }, QueryTypes.INSERT);
  await x(`DELETE FROM bmax_grupos WHERE grupo=:g AND revenda_rd <> :n`, { g: GRUPO, n: GRUPO }, QueryTypes.DELETE);
  console.log("5) bmax_grupos Alphabras:", JSON.stringify((await q(`SELECT revenda_rd FROM bmax_grupos WHERE grupo=:g`, { g: GRUPO })).map(r => r.revenda_rd)));
  // 6) apelidos: "Alphabras" (qualquer origem) aponta para o GRUPO
  await sbSistemasService(`/comercial_bmax_apelidos?apelido_norm=eq.alphabras`, "PATCH", { entidade: "grupo", entidade_id: g.id });
  await sbSistemasService("/comercial_bmax_apelidos?on_conflict=origem,apelido_norm", "POST", [{ entidade: "grupo", entidade_id: g.id, origem: "razao", apelido: GRUPO, apelido_norm: "alphabras" }, { entidade: "grupo", entidade_id: g.id, origem: "rd", apelido: GRUPO, apelido_norm: "alphabras" }], { Prefer: "resolution=merge-duplicates,return=minimal" });
  console.log("6) apelidos 'alphabras':", JSON.stringify(await sbSistemasService("/comercial_bmax_apelidos?apelido_norm=eq.alphabras&select=entidade,origem")));
  process.exit(0);
})().catch(e => { console.error("ERRO", e.stack || e.message); process.exit(1); });
