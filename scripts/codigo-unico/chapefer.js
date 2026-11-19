// Remove o login da Chapefer (pedido do André, 19/11/2026). A loja continua ativa no cadastro. Backup antes.
const P = "C:/Users/andre.coelho.BXSD/BOXER/Dados - Documentos/Comercial/Geral/Estrategia/2026/Projeto BMax/boxer-portal-bmax";
process.chdir(P); require(P + "/node_modules/dotenv").config({ quiet: true });
const fs = require("fs");
const db = require(P + "/src/database"); const { QueryTypes } = require(P + "/node_modules/sequelize");
const { sbSistemasService } = require(P + "/src/config/supabaseSistemas");
const q = (s, r) => db.sequelize.query(s, { replacements: r || {}, type: QueryTypes.SELECT });
(async () => {
  const loja = (await sbSistemasService("/comercial_revendas_bmax?nome=eq.Chapefer&ativo=eq.true&select=id,nome,nome_rd,user_id"))[0]; if (!loja || !loja.user_id) throw new Error("Chapefer sem login ligado");
  const lg = (await q(`SELECT u.id, u.username, u.role::text role, r.* FROM "Users" u JOIN "Revendas" r ON r.user_id=u.id WHERE u.id=:i`, { i: loja.user_id }))[0];
  const nomes = [lg.name, loja.nome, loja.nome_rd].filter(Boolean);
  const mov = (await q(`SELECT (SELECT count(*) FROM bmax_transacoes WHERE revenda IN (:n)) t, (SELECT coalesce(sum(saldo),0) FROM bmax_saldo WHERE revenda IN (:n)) s, (SELECT count(*) FROM bmax_saques WHERE revenda IN (:n)) q`, { n: nomes }))[0];
  if (Number(mov.t) || Number(mov.s) || Number(mov.q)) throw new Error("tem movimento financeiro " + JSON.stringify(mov));
  fs.writeFileSync("C:/Users/andre.coelho.BXSD/BOXER/Dados - Documentos/Comercial/Geral/Estrategia/2026/Projeto BMax/Documentação/Backups_Banco/login_chapefer_ANTES_19-11-2026.json", JSON.stringify({ loja, login_sem_hash: lg }, null, 1));
  await sbSistemasService(`/comercial_revendas_bmax?id=eq.${loja.id}`, "PATCH", { user_id: null, editado_em: new Date().toISOString(), editado_por: "claude (pedido do André em 19/11/2026)" });
  await db.sequelize.query(`DELETE FROM "Revendas" WHERE user_id=:u`, { replacements: { u: lg.id }, type: QueryTypes.DELETE }); await db.sequelize.query(`DELETE FROM "Users" WHERE id=:u`, { replacements: { u: lg.id }, type: QueryTypes.DELETE });
  console.log("login removido:", lg.username, "| loja Chapefer segue ativa:", JSON.stringify((await sbSistemasService(`/comercial_revendas_bmax?id=eq.${loja.id}&select=nome,ativo,user_id`))[0]));
  process.exit(0);
})().catch(e => { console.error("ERRO", e.message); process.exit(1); });
