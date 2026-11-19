// Restaura a Metatrônica (decisão do André em 19/11/2026: tirar do projeto foi um erro): loja ativa, login de volta (mesmo id e dados, senha no padrão do projeto), acesso ao Motor, e o crédito de R$780.
const P = "C:/Users/andre.coelho.BXSD/BOXER/Dados - Documentos/Comercial/Geral/Estrategia/2026/Projeto BMax/boxer-portal-bmax";
process.chdir(P); require(P + "/node_modules/dotenv").config({ quiet: true });
const fs = require("fs"); const bcrypt = require(P + "/node_modules/bcryptjs");
const db = require(P + "/src/database"); const { QueryTypes } = require(P + "/node_modules/sequelize");
const { sbSistemasService } = require(P + "/src/config/supabaseSistemas"); const { sbSistemasAuthProvision } = require(P + "/src/controllers/users.controller");
const { recalcularComissoes } = require(P + "/src/services/comissao.service");
const q = (s, r) => db.sequelize.query(s, { replacements: r || {}, type: QueryTypes.SELECT });
const x = (s, r, t) => db.sequelize.query(s, { replacements: r || {}, type: t || QueryTypes.UPDATE });
const B = JSON.parse(fs.readFileSync("C:/Users/andre.coelho.BXSD/BOXER/Dados - Documentos/Comercial/Geral/Estrategia/2026/Projeto BMax/Documentação/Backups_Banco/metatronica_ANTES_19-11-2026.json", "utf8"));
(async () => {
  const lg = B.login_sem_hash, loja = B.loja;
  if ((await q(`SELECT 1 FROM "Users" WHERE id=:i OR lower(username)=:u`, { i: lg.id, u: String(lg.username).toLowerCase() })).length) throw new Error("login já existe");
  // 1) login de volta, com o mesmo id e os mesmos dados; senha = padrão do projeto (parte do e-mail antes do @)
  const senha = String(lg.username).toLowerCase().split("@")[0];
  await x(`INSERT INTO "Users" (id, username, password, role, "createdAt", "updatedAt") VALUES (:id, :u, :h, 'revenda', :c, NOW())`, { id: lg.id, u: lg.username, h: await bcrypt.hash(senha, 10), c: lg.createdAt }, QueryTypes.INSERT);
  await x(`INSERT INTO "Revendas" (user_id, cnpj, cep, cidade, estado, name, grupo, email, telefone, endereco, numero, complemento, whatsapp_aceite_em, revenda_id, grupo_id) VALUES (:user_id, :cnpj, :cep, :cidade, :estado, :name, :grupo, :email, :telefone, :endereco, :numero, :complemento, :wa, :rid, :gid)`,
    { user_id: lg.id, cnpj: lg.cnpj, cep: lg.cep, cidade: lg.cidade, estado: lg.estado, name: lg.name, grupo: lg.grupo || null, email: lg.email, telefone: lg.telefone, endereco: lg.endereco, numero: lg.numero, complemento: lg.complemento, wa: lg.whatsapp_aceite_em || null, rid: loja.id, gid: lg.grupo_id || null }, QueryTypes.INSERT);
  console.log("login restaurado:", lg.username, "| id", lg.id, "| nome:", lg.name);
  // 2) loja ativa e ligada ao login
  await sbSistemasService(`/comercial_revendas_bmax?id=eq.${loja.id}`, "PATCH", { ativo: true, user_id: lg.id, editado_em: new Date().toISOString(), editado_por: "claude (pedido do André em 19/11/2026 — reversão)" });
  // 3) acesso ao Motor com a mesma senha do Portal
  try { await sbSistemasAuthProvision(String(lg.username).toLowerCase(), senha); console.log("acesso do Motor: ok"); } catch (e) { console.log("acesso do Motor: FALHA", e.message); }
  // 4) crédito de R$780: remove o estorno que EU lancei (sem lead) e devolve o saldo
  const est = await q(`SELECT * FROM bmax_transacoes WHERE revenda='Metatrônica' AND tipo_agente='revenda' AND tipo='debito' AND descricao LIKE 'Estorno: revenda fora do projeto%'`);
  if (est.length !== 1 || Number(est[0].valor) !== 780) throw new Error("estorno esperado não encontrado: " + JSON.stringify(est.map(e => e.valor)));
  fs.writeFileSync("C:/Users/andre.coelho.BXSD/BOXER/Dados - Documentos/Comercial/Geral/Estrategia/2026/Projeto BMax/Documentação/Backups_Banco/estorno_metatronica_removido_19-11-2026.json", JSON.stringify(est, null, 1));
  await x(`DELETE FROM bmax_transacoes WHERE id=:i`, { i: est[0].id }, QueryTypes.DELETE);
  await x(`UPDATE bmax_saldo SET saldo = saldo + 780, atualizado_em = NOW() WHERE revenda='Metatrônica' AND tipo_agente='revenda'`);
  const chk = (await q(`SELECT (SELECT saldo::text FROM bmax_saldo WHERE revenda='Metatrônica' AND tipo_agente='revenda') s, (SELECT COALESCE(SUM(CASE WHEN tipo='credito' THEN valor ELSE -valor END),0)::text FROM bmax_transacoes WHERE revenda='Metatrônica' AND tipo_agente='revenda') t`))[0];
  console.log("saldo Metatrônica:", chk.s, "| soma dos lançamentos:", chk.t);
  const rc = await recalcularComissoes(); console.log("robô (recálculo idempotente): ajustes", rc.ajustados, "erros", rc.erros, JSON.stringify(rc.detalhes).slice(0, 200));
  console.log("loja:", JSON.stringify((await sbSistemasService(`/comercial_revendas_bmax?id=eq.${loja.id}&select=nome,nome_rd,ativo,user_id,classe,rep`))[0]));
  process.exit(0);
})().catch(e => { console.error("ERRO", e.stack || e.message); process.exit(1); });
