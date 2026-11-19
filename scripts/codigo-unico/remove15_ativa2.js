// 18/11/2026 (pedido do André): remove 15 revendas inativas com login; ativa Locsoldas (Prata) e Dominik (Diamante). Backup antes.
const P = "C:/Users/andre.coelho.BXSD/BOXER/Dados - Documentos/Comercial/Geral/Estrategia/2026/Projeto BMax/boxer-portal-bmax";
process.chdir(P); require(P + "/node_modules/dotenv").config({ quiet: true });
const fs = require("fs");
const db = require(P + "/src/database"); const { QueryTypes } = require(P + "/node_modules/sequelize");
const { sbSistemasService } = require(P + "/src/config/supabaseSistemas"); const { syncRevendasToRD } = require(P + "/src/services/rd.leads.service");
const { sincronizarGrupoDaLoja } = require(P + "/src/services/grupoLoja.service");
const q = (s, r) => db.sequelize.query(s, { replacements: r || {}, type: QueryTypes.SELECT });
const REMOVER = ["Certto Comercio", "Servweld", "Fermarcs", "ALMAM", "AVANTPAR", "FEBRAZO", "FERPAR", "KAPDIMA", "MAQDIMA", "MATTES", "MEPAR", "NAZARENO SOLDAS", "SAMTA", "SCHNEIDER", "TECMAQUINAS"];
const BKP = "C:/Users/andre.coelho.BXSD/BOXER/Dados - Documentos/Comercial/Geral/Estrategia/2026/Projeto BMax/Documentação/Backups_Banco/revendas_removidas_18-11-2026.json";
(async () => {
  const cad = await sbSistemasService("/comercial_revendas_bmax?select=*&ativo=eq.false&user_id=not.is.null");
  const alvo = cad.filter(c => REMOVER.some(n => c.nome.toLowerCase().includes(n.toLowerCase().replace("comercio", "").trim()) && (n !== "Certto Comercio" || /certto/i.test(c.nome))));
  if (alvo.length !== 15) throw new Error("esperava 15 lojas, achei " + alvo.length + ": " + alvo.map(c => c.nome));
  const ids = alvo.map(c => c.user_id);
  const logins = await q(`SELECT u.id, u.username, u.role::text role, u."createdAt", r.* FROM "Users" u JOIN "Revendas" r ON r.user_id=u.id WHERE u.id IN (:ids)`, { ids });
  if (logins.length !== 15) throw new Error("esperava 15 logins, achei " + logins.length);
  for (const lg of logins) {
    if (lg.role !== "revenda") throw new Error("não é revenda: " + lg.username);
    const nomes = [lg.name, ...alvo.filter(c => c.user_id === lg.id).flatMap(c => [c.nome, c.nome_rd])].filter(Boolean);
    const mov = await q(`SELECT (SELECT count(*) FROM bmax_transacoes WHERE revenda IN (:n)) t, (SELECT coalesce(sum(saldo),0) FROM bmax_saldo WHERE revenda IN (:n)) s, (SELECT count(*) FROM bmax_saques WHERE revenda IN (:n)) q`, { n: nomes });
    if (Number(mov[0].t) || Number(mov[0].s) || Number(mov[0].q)) throw new Error(`tem movimento financeiro: ${lg.username} ${JSON.stringify(mov[0])}`);
  }
  const apel = await sbSistemasService(`/comercial_bmax_apelidos?entidade=eq.revenda&entidade_id=in.(${alvo.map(c => c.id).join(",")})&select=*`);
  fs.writeFileSync(BKP, JSON.stringify({ gerado_em: new Date().toISOString(), motivo: "remoção pedida por André em 18/11/2026", lojas_cadastro: alvo, logins_sem_hash: logins, apelidos: apel }, null, 1));
  // remove
  for (const c of alvo) {
    await db.sequelize.query(`DELETE FROM "Revendas" WHERE user_id = :u`, { replacements: { u: c.user_id }, type: QueryTypes.DELETE });
    await db.sequelize.query(`DELETE FROM "Users" WHERE id = :u`, { replacements: { u: c.user_id }, type: QueryTypes.DELETE });
    await sbSistemasService(`/comercial_bmax_apelidos?entidade=eq.revenda&entidade_id=eq.${c.id}`, "DELETE");
    await sbSistemasService(`/comercial_revendas_bmax?id=eq.${c.id}`, "DELETE");
    console.log("removida:", c.nome.slice(0, 40), "| login", logins.find(l => l.id === c.user_id).username);
  }
  // ativa Locsoldas (Prata) e Dominik (Diamante), nome no RD = nome do login (já existe no picklist do RD)
  const ATIVAR = [{ nome: "LOCSOLDAS", rd: "Locsoldas", classe: "Prata" }, { nome: "DOMINIK", rd: "Dominik", classe: "Diamante" }];
  for (const a of ATIVAR) {
    const l = (await sbSistemasService(`/comercial_revendas_bmax?nome=eq.${encodeURIComponent(a.nome)}&select=id,cidade,estado,rep,user_id`))[0];
    if (!l || !l.cidade || !l.estado) throw new Error("dados incompletos p/ ativar " + a.nome);
    const dup = (await sbSistemasService("/comercial_revendas_bmax?ativo=eq.true&select=id,nome,nome_rd")).find(r => String(r.nome_rd || r.nome).trim().toLowerCase() === a.rd.toLowerCase());
    if (dup) throw new Error("nome no RD já em uso: " + a.rd);
    await sbSistemasService(`/comercial_revendas_bmax?id=eq.${l.id}`, "PATCH", { ativo: true, classe: a.classe, nome_rd: a.rd, editado_em: new Date().toISOString(), editado_por: "claude (pedido do André em 18/11/2026)" });
    await sincronizarGrupoDaLoja(l.id);
    const e = await sbSistemasService("/comercial_bmax_apelidos?on_conflict=origem,apelido_norm", "POST", [{ entidade: "revenda", entidade_id: l.id, origem: "rd", apelido: a.rd, apelido_norm: a.rd.toLowerCase() }], { Prefer: "resolution=merge-duplicates,return=minimal" });
    console.log("ativada:", a.nome, "->", a.classe, "| nome no RD:", a.rd);
  }
  const ativas = await sbSistemasService("/comercial_revendas_bmax?ativo=eq.true&select=nome,nome_rd");
  const sync = await syncRevendasToRD(ativas.map(r => (r.nome_rd && r.nome_rd.trim()) || r.nome));
  console.log("sync RD:", JSON.stringify(sync).slice(0, 300));
  const tot = await q(`SELECT count(*) n FROM "Revendas"`); console.log("logins de revenda agora:", tot[0].n);
  process.exit(0);
})().catch(e => { console.error("ERRO", e.message); process.exit(1); });
