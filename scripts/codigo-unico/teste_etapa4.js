const P = "C:/Users/andre.coelho.BXSD/BOXER/Dados - Documentos/Comercial/Geral/Estrategia/2026/Projeto BMax/boxer-portal-bmax";
process.chdir(P); require(P + "/node_modules/dotenv").config({ quiet: true });
const db = require(P + "/src/database"); const { QueryTypes } = require(P + "/node_modules/sequelize");
const { sbSistemasService } = require(P + "/src/config/supabaseSistemas"); const { codigoDe, norm } = require(P + "/src/services/codigoUnico.service");
const saldo = require(P + "/src/services/saldo.service"); const saque = require(P + "/src/services/saque.service");
const q = (s, r) => db.sequelize.query(s, { replacements: r || {}, type: QueryTypes.SELECT });
const x = (s, r) => db.sequelize.query(s, { replacements: r || {}, type: QueryTypes.DELETE });
const TESTE = "ZZ TESTE ETAPA4";
(async () => {
  const antes = (await q(`SELECT (SELECT sum(saldo) FROM bmax_saldo) s, (SELECT count(*) FROM bmax_saldo) ns, (SELECT count(*) FROM bmax_transacoes) nt, (SELECT count(*) FROM bmax_saques) nq`))[0];
  console.log("== resolvedor ==");
  for (const [n, t] of [["Aldesoldas", "revenda"], ["WST", "revenda"], ["Luitex Sumaré", "revenda"], ["42863 Alphabras Poços de Caldas 1", "revenda"], ["Caio P Mancini", "representante"], ["Victor VLM", "representante"], ["Billy", "vendedor_interno"], ["Sem Revenda", "revenda"], ["Sem Representante", "representante"], ["nome que nao existe", "revenda"]]) {
    const c = await codigoDe(n, t); console.log(`${n.padEnd(36)} ${t.padEnd(16)} ->`, c.revenda_id ? "revenda " + c.revenda_id.slice(0, 8) : c.grupo_id ? "grupo " + c.grupo_id.slice(0, 8) : c.representante_id ? "rep " + c.representante_id.slice(0, 8) : "(sem código)");
  }
  console.log("== escrita (agente de teste) ==");
  const ald = (await sbSistemasService("/comercial_revendas_bmax?nome=eq.Aldesoldas&select=id"))[0].id;
  try {
    await sbSistemasService("/comercial_bmax_apelidos?on_conflict=origem,apelido_norm", "POST", [{ entidade: "revenda", entidade_id: ald, origem: "razao", apelido: TESTE, apelido_norm: norm(TESTE) }], { Prefer: "resolution=merge-duplicates,return=minimal" });
    require(P + "/src/services/codigoUnico.service").limparCache();
    await saldo.creditarCashback(TESTE, 0.01, "teste etapa 4", "ZZ-LEAD", "revenda", {});
    const s1 = (await q(`SELECT revenda_id, saldo FROM bmax_saldo WHERE revenda=:n AND tipo_agente='revenda'`, { n: TESTE }))[0];
    const t1 = (await q(`SELECT revenda_id FROM bmax_transacoes WHERE revenda=:n AND tipo='credito'`, { n: TESTE }))[0];
    console.log("crédito -> saldo.revenda_id correto:", s1.revenda_id === ald, "| transação.revenda_id correto:", t1.revenda_id === ald);
    const sq = await saque.solicitarSaque(TESTE, "Caio P Mancini", 0.01, "desconto");
    const sqRow = Array.isArray(sq) ? (Array.isArray(sq[0]) ? sq[0][0] : sq[0]) : sq; const q1 = (await q(`SELECT revenda_id, representante_id FROM bmax_saques WHERE id=:i`, { i: sqRow.id }))[0];
    console.log("saque -> revenda_id correto:", q1.revenda_id === ald, "| representante_id preenchido:", !!q1.representante_id);
    await saldo.debitarCashback(TESTE, 0.01, "teste etapa 4 débito", null, "revenda");
    const t2 = (await q(`SELECT revenda_id FROM bmax_transacoes WHERE revenda=:n AND tipo='debito'`, { n: TESTE }))[0];
    console.log("débito -> transação.revenda_id correto:", t2.revenda_id === ald);
    // nome SEM código: lançamento tem que seguir funcionando
    await saldo.creditarCashback(TESTE + " B", 0.01, "teste sem código", "ZZ-LEAD", "revenda", {});
    const s3 = (await q(`SELECT revenda_id, saldo FROM bmax_saldo WHERE revenda=:n`, { n: TESTE + " B" }))[0];
    console.log("nome sem código -> lançou normalmente:", !!s3, "| código nulo:", s3 && s3.revenda_id === null);
  } finally {
    await x(`DELETE FROM bmax_transacoes WHERE revenda IN (:a,:b)`, { a: TESTE, b: TESTE + " B" }); await x(`DELETE FROM bmax_saques WHERE revenda = :a`, { a: TESTE }); await x(`DELETE FROM bmax_saldo WHERE revenda IN (:a,:b)`, { a: TESTE, b: TESTE + " B" });
    await sbSistemasService(`/comercial_bmax_apelidos?origem=eq.razao&apelido_norm=eq.${encodeURIComponent(norm(TESTE))}`, "DELETE");
    const dep = (await q(`SELECT (SELECT sum(saldo) FROM bmax_saldo) s, (SELECT count(*) FROM bmax_saldo) ns, (SELECT count(*) FROM bmax_transacoes) nt, (SELECT count(*) FROM bmax_saques) nq`))[0];
    console.log("limpeza: saldos", antes.s, "->", dep.s, "| linhas saldo/trans/saques", [antes.ns, antes.nt, antes.nq].join("/"), "->", [dep.ns, dep.nt, dep.nq].join("/"));
  }
  process.exit(0);
})().catch(e => { console.error("ERRO", e.stack || e.message); process.exit(1); });
