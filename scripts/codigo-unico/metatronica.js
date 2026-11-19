// 19/11/2026 (pedido do André): Metatrônica fora do projeto. Corrige rep do card, estorna R$780 (revenda) e R$520 (SANTOS), desativa a loja, remove o login. Backup antes.
const P = "C:/Users/andre.coelho.BXSD/BOXER/Dados - Documentos/Comercial/Geral/Estrategia/2026/Projeto BMax/boxer-portal-bmax";
process.chdir(P); require(P + "/node_modules/dotenv").config({ quiet: true });
const fs = require("fs");
const db = require(P + "/src/database"); const { QueryTypes } = require(P + "/node_modules/sequelize");
const { sbSistemasService } = require(P + "/src/config/supabaseSistemas"); const l = require(P + "/src/services/rd.leads.service");
const saldo = require(P + "/src/services/saldo.service"); const { recalcularComissoes } = require(P + "/src/services/comissao.service");
const q = (s, r) => db.sequelize.query(s, { replacements: r || {}, type: QueryTypes.SELECT });
const x = (s, r) => db.sequelize.query(s, { replacements: r || {}, type: QueryTypes.UPDATE });
const LEAD = "6afda441046807001fa60a48", ED = "claude (pedido do André em 19/11/2026)";
(async () => {
  const loja = (await sbSistemasService("/comercial_revendas_bmax?nome=eq.Metatronica&select=*"))[0]; if (!loja || !loja.ativo) throw new Error("loja Metatrônica não encontrada/ativa");
  const lg = (await q(`SELECT u.id, u.username, u.role::text role, u."createdAt", r.* FROM "Users" u JOIN "Revendas" r ON r.user_id=u.id WHERE u.id=:i`, { i: loja.user_id }))[0];
  const trans = await q(`SELECT * FROM bmax_transacoes WHERE lead_id=:l ORDER BY criado_em`, { l: LEAD });
  const sal = await q(`SELECT * FROM bmax_saldo WHERE revenda IN ('Metatrônica','SANTOS','Carlos Fernandes')`);
  const deal = await l.getDealById(LEAD);
  fs.writeFileSync("C:/Users/andre.coelho.BXSD/BOXER/Dados - Documentos/Comercial/Geral/Estrategia/2026/Projeto BMax/Documentação/Backups_Banco/metatronica_ANTES_19-11-2026.json", JSON.stringify({ loja, login_sem_hash: lg, transacoes_do_lead: trans, saldos: sal, card_rep_antes: l.getCustomField(deal, "REPRESENTANTE") }, null, 1));
  console.log("transações do lead:", trans.map(t => `${t.revenda}/${t.tipo_agente}/${t.tipo} ${t.valor}`).join(" | "));
  // 1) representante do card: SANTOS -> Caio P Mancini (representante da revenda no cadastro)
  await l.updateLead(LEAD, { data: { custom_fields: { representante: "Caio P Mancini" } } });
  const d2 = await l.getDealById(LEAD); console.log("card REPRESENTANTE agora:", l.getCustomField(d2, "REPRESENTANTE"), "| etapa/win:", d2.deal_stage && d2.deal_stage.name, d2.win);
  // 2) estorno do rep SANTOS ligado ao lead (assim o robô credita Caio P Mancini sozinho) e da revenda sem ligar ao lead (para o robô não recriar)
  const sant = Number((await q(`SELECT COALESCE(SUM(CASE WHEN tipo='credito' THEN valor ELSE -valor END),0) v FROM bmax_transacoes WHERE lead_id=:l AND revenda='SANTOS' AND tipo_agente='representante'`, { l: LEAD }))[0].v);
  const rev = Number((await q(`SELECT COALESCE(SUM(CASE WHEN tipo='credito' THEN valor ELSE -valor END),0) v FROM bmax_transacoes WHERE lead_id=:l AND revenda='Metatrônica' AND tipo_agente='revenda'`, { l: LEAD }))[0].v);
  console.log("a estornar: SANTOS", sant, "| Metatrônica", rev);
  if (sant === 520) { await saldo.debitarCashback("SANTOS", 520, `Estorno: representante incorreto no card (SANTOS) — lead ${LEAD} — pedido do André 19/11/2026`, null, "representante"); await x(`UPDATE bmax_transacoes SET lead_id=:l WHERE id=(SELECT id FROM bmax_transacoes WHERE revenda='SANTOS' AND tipo='debito' AND lead_id IS NULL ORDER BY criado_em DESC LIMIT 1)`, { l: LEAD }); }
  if (rev === 780) await saldo.debitarCashback("Metatrônica", 780, `Estorno: revenda fora do projeto — lead ${LEAD} — pedido do André 19/11/2026`, null, "revenda");
  // 3) o mesmo recálculo do robô: deve creditar Caio P Mancini (R$520) e mais nada
  const rc = await recalcularComissoes(); console.log("recalculo:", JSON.stringify({ ajustados: rc.ajustados, erros: rc.erros, detalhes: rc.detalhes }).slice(0, 700));
  // 4) saldo final e desativação
  console.log("saldos agora:", JSON.stringify(await q(`SELECT revenda, tipo_agente, saldo::text FROM bmax_saldo WHERE revenda IN ('Metatrônica','SANTOS','Caio P Mancini','Carlos Fernandes') ORDER BY 1`)));
  const sM = Number((await q(`SELECT COALESCE(sum(saldo),0) v FROM bmax_saldo WHERE revenda='Metatrônica'`))[0].v);
  if (sM !== 0) throw new Error("saldo da Metatrônica não zerou: " + sM + " — loja NÃO desativada");
  await sbSistemasService(`/comercial_revendas_bmax?id=eq.${loja.id}`, "PATCH", { ativo: false, user_id: null, editado_em: new Date().toISOString(), editado_por: ED });
  await db.sequelize.query(`DELETE FROM "Revendas" WHERE user_id=:u`, { replacements: { u: lg.id }, type: QueryTypes.DELETE }); await db.sequelize.query(`DELETE FROM "Users" WHERE id=:u`, { replacements: { u: lg.id }, type: QueryTypes.DELETE });
  console.log("Metatrônica: loja inativa e login removido");
  process.exit(0);
})().catch(e => { console.error("ERRO", e.stack || e.message); process.exit(1); });
