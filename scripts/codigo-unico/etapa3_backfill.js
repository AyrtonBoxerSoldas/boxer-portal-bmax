// ETAPA 3: (a) apelidos de representantes e de logins de lojas inativas; (b) preenche os códigos no Portal (razão, saques, login).
// Nada de nome/saldo é alterado. Uso: node etapa3_backfill.js [--aplicar]
const P = "C:/Users/andre.coelho.BXSD/BOXER/Dados - Documentos/Comercial/Geral/Estrategia/2026/Projeto BMax/boxer-portal-bmax";
process.chdir(P); require(P + "/node_modules/dotenv").config({ quiet: true });
const db = require(P + "/src/database"); const { QueryTypes } = require(P + "/node_modules/sequelize");
const { sbSistemasService } = require(P + "/src/config/supabaseSistemas");
const q = (s, r) => db.sequelize.query(s, { replacements: r || {}, type: QueryTypes.SELECT });
const x = (s, r) => db.sequelize.query(s, { replacements: r || {}, type: QueryTypes.UPDATE });
const norm = s => String(s || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toLowerCase().replace(/\s+/g, " ");
const APLICAR = process.argv.includes("--aplicar");
(async () => {
  const cad = await sbSistemasService("/comercial_revendas_bmax?select=id,nome,nome_rd,grupo_id,ativo,user_id");
  const reps = await sbSistemasService("/comercial_representantes_bmax?select=id,nome,rd_alias,email,ativo");
  let apel = await sbSistemasService("/comercial_bmax_apelidos?select=entidade,entidade_id,origem,apelido_norm&limit=5000");
  const logins = await q(`SELECT r.name, r.grupo, r.user_id FROM "Revendas" r`);
  const novos = []; const tem = new Set(apel.map(a => a.origem + "|" + a.apelido_norm));
  const add = (entidade, id, origem, apelido) => { const n = norm(apelido); if (!n || tem.has(origem + "|" + n)) return; tem.add(origem + "|" + n); novos.push({ entidade, entidade_id: id, origem, apelido: String(apelido).trim(), apelido_norm: n }); };
  // (a) logins ligados a lojas INATIVAS (e sem apelido ainda)
  const lojaPorUser = new Map(); cad.forEach(c => { if (c.user_id && (!lojaPorUser.has(c.user_id) || c.ativo)) lojaPorUser.set(c.user_id, c); });
  let loginsInativos = 0; for (const lg of logins) { const l = lojaPorUser.get(lg.user_id); if (l && !l.ativo) { add("revenda", l.id, "login", lg.name); loginsInativos++; } }
  // (b) representantes: nome canônico, alias do RD, e os nomes que aparecem no razão/saques
  const repPorNome = new Map(); reps.forEach(r => { repPorNome.set(norm(r.nome), r); if (r.rd_alias) repPorNome.set(norm(r.rd_alias), r); });
  reps.forEach(r => { add("representante", r.id, "cadastro", r.nome); if (r.rd_alias) add("representante", r.id, "rd", r.rd_alias); });
  const nomesRep = [...new Set([...(await q(`SELECT DISTINCT revenda n FROM bmax_saldo WHERE tipo_agente='representante'`)), ...(await q(`SELECT DISTINCT revenda n FROM bmax_transacoes WHERE tipo_agente='representante'`)), ...(await q(`SELECT DISTINCT representante n FROM bmax_saques WHERE representante IS NOT NULL`))].map(r => r.n))];
  const repSemCodigo = []; nomesRep.forEach(n => { const r = repPorNome.get(norm(n)); if (r) add("representante", r.id, "razao", n); else repSemCodigo.push(n); });
  console.log(`apelidos novos: ${novos.length} (logins de lojas inativas: ${loginsInativos}; representantes: ${novos.filter(a => a.entidade === "representante").length}) | nomes de representante no razão SEM código: ${JSON.stringify(repSemCodigo)}`);
  if (APLICAR && novos.length) { for (let i = 0; i < novos.length; i += 200) await sbSistemasService("/comercial_bmax_apelidos?on_conflict=origem,apelido_norm", "POST", novos.slice(i, i + 200), { Prefer: "resolution=merge-duplicates,return=minimal" }); apel = await sbSistemasService("/comercial_bmax_apelidos?select=entidade,entidade_id,origem,apelido_norm&limit=5000"); }
  // mapa nome -> {entidade,id} por tipo
  const mapRev = new Map(); apel.filter(a => a.entidade !== "representante").forEach(a => { if (!mapRev.has(a.apelido_norm)) mapRev.set(a.apelido_norm, a); });
  if (APLICAR) novos.filter(a => a.entidade !== "representante").forEach(a => { if (!mapRev.has(a.apelido_norm)) mapRev.set(a.apelido_norm, a); });
  const resRev = nome => mapRev.get(norm(nome));
  const antes = await q(`SELECT (SELECT SUM(saldo) FROM bmax_saldo) s, (SELECT COUNT(*) FROM bmax_saldo) ns, (SELECT COUNT(*) FROM bmax_transacoes) nt`);
  let stats = { saldo: 0, trans: 0, saques: 0, semCodigo: [] };
  const upd = async (tabela, col, tipo, nome, ent) => {
    const set = ent.entidade === "grupo" ? "grupo_id = :id" : ent.entidade === "representante" ? "representante_id = :id" : "revenda_id = :id";
    const filtroTipo = tipo ? ` AND tipo_agente = :tipo` : "";
    if (APLICAR) await x(`UPDATE ${tabela} SET ${set} WHERE ${col} = :nome${filtroTipo}`, { id: ent.entidade_id, nome, tipo });
  };
  // razão: saldo e transações
  for (const tabela of ["bmax_saldo", "bmax_transacoes"]) {
    const nomes = await q(`SELECT DISTINCT revenda n, tipo_agente t FROM ${tabela}`);
    for (const { n, t } of nomes) {
      let ent = null;
      if (t === "revenda") ent = resRev(n); else if (t === "representante") { const r = repPorNome.get(norm(n)); if (r) ent = { entidade: "representante", entidade_id: r.id }; }
      else continue; // vendedor_interno: sem entidade
      if (!ent) { stats.semCodigo.push(`${tabela}/${t}: ${n}`); continue; }
      await upd(tabela, "revenda", t, n, ent); stats[tabela === "bmax_saldo" ? "saldo" : "trans"]++;
    }
  }
  // saques: revenda (por nome) e representante (aprovador, se for um representante)
  for (const { n } of await q(`SELECT DISTINCT revenda n FROM bmax_saques`)) { const ent = resRev(n); if (!ent) { stats.semCodigo.push("bmax_saques/revenda: " + n); continue; } const set = ent.entidade === "grupo" ? "grupo_id" : "revenda_id"; if (APLICAR) await x(`UPDATE bmax_saques SET ${set} = :id WHERE revenda = :n`, { id: ent.entidade_id, n }); stats.saques++; }
  for (const { n } of await q(`SELECT DISTINCT representante n FROM bmax_saques WHERE representante IS NOT NULL`)) { const r = repPorNome.get(norm(n)); if (r && APLICAR) await x(`UPDATE bmax_saques SET representante_id = :id WHERE representante = :n`, { id: r.id, n }); }
  // login: revenda_id (loja ligada por user_id) e grupo_id (grupo do cadastro dessa loja, se o login tem grupo)
  let nLog = 0, loginSem = []; for (const lg of logins) { const l = lojaPorUser.get(lg.user_id); if (!l) { loginSem.push(lg.name); continue; } if (APLICAR) await x(`UPDATE "Revendas" SET revenda_id = :r, grupo_id = :g WHERE user_id = :u`, { r: l.id, g: lg.grupo ? l.grupo_id : null, u: lg.user_id }); nLog++; }
  const depois = await q(`SELECT (SELECT SUM(saldo) FROM bmax_saldo) s, (SELECT COUNT(*) FROM bmax_saldo) ns, (SELECT COUNT(*) FROM bmax_transacoes) nt`);
  console.log("carteiras com código:", stats.saldo, "| nomes de transações com código:", stats.trans, "| saques (nomes):", stats.saques, "| logins com código:", nLog, "| logins SEM loja no cadastro:", loginSem.length);
  console.log("SEM CÓDIGO:", stats.semCodigo.join(" | ") || "nenhum");
  console.log("soma dos saldos antes/depois:", antes[0].s, "/", depois[0].s, "| linhas saldo/trans:", antes[0].ns, antes[0].nt, "/", depois[0].ns, depois[0].nt);
  const cob = await q(`SELECT 'saldo' t, count(*) filter (where revenda_id is not null or grupo_id is not null or representante_id is not null) com, count(*) total FROM bmax_saldo UNION ALL SELECT 'transacoes', count(*) filter (where revenda_id is not null or grupo_id is not null or representante_id is not null), count(*) FROM bmax_transacoes UNION ALL SELECT 'saques', count(*) filter (where revenda_id is not null or grupo_id is not null), count(*) FROM bmax_saques`);
  console.log("cobertura (com código / total):", JSON.stringify(cob));
  process.exit(0);
})().catch(e => { console.error("ERRO", e.stack || e.message); process.exit(1); });
