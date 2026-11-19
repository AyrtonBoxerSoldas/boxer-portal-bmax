// Remove 9 logins sem loja ativa (decisão do André 18/11/2026) e liga a Casa dos Parafusos Umuarama. Backup antes (sem hash de senha).
const P = "C:/Users/andre.coelho.BXSD/BOXER/Dados - Documentos/Comercial/Geral/Estrategia/2026/Projeto BMax/boxer-portal-bmax";
process.chdir(P); require(P + "/node_modules/dotenv").config({ quiet: true });
const fs = require("fs");
const db = require(P + "/src/database"); const { QueryTypes } = require(P + "/node_modules/sequelize");
const { sbSistemasService } = require(P + "/src/config/supabaseSistemas");
const q = (s, r) => db.sequelize.query(s, { replacements: r || {}, type: QueryTypes.SELECT });
const REMOVER = ["financeiro@apmaquinaseferramentas.com.br", "wmseletronic@gmail.com", "casadasferramentascri@outlook.com", "compras01@grupofermaq.com.br", "leandro.ferreirasoldas@hotmail.com", "ruzamparafusoseferramentas@gmail.com", "maxsoldascrt@gmail.com", "compras@riomaq.com.br", "asouzacoelho@gmail.com"];
const LOJA_CASA = "e24e008b-b77c-426f-be6e-21c95e18097a"; // 30275, A Bitencourt ... Casa Dos Parafusos (Umuarama/PR)
(async () => {
  const us = await q(`SELECT u.id, u.username, u.role::text role, u."createdAt", r.* FROM "Users" u LEFT JOIN "Revendas" r ON r.user_id=u.id WHERE u.username IN (:l)`, { l: REMOVER });
  if (us.length !== REMOVER.length) throw new Error(`esperava ${REMOVER.length} logins, achei ${us.length}: ${us.map(u => u.username)}`);
  const cad = await sbSistemasService("/comercial_revendas_bmax?select=id,user_id&user_id=not.is.null");
  const ligados = new Set(cad.map(c => c.user_id));
  for (const u of us) {
    if (u.role !== "revenda") throw new Error("não é revenda: " + u.username);
    if (ligados.has(u.id)) throw new Error("ligado a loja do cadastro: " + u.username);
    const mov = await q(`SELECT (SELECT count(*) FROM bmax_transacoes WHERE revenda=:n) t, (SELECT coalesce(sum(saldo),0) FROM bmax_saldo WHERE revenda=:n) s, (SELECT count(*) FROM bmax_saques WHERE revenda=:n) q`, { n: u.name });
    if (Number(mov[0].t) || Number(mov[0].s) || Number(mov[0].q)) throw new Error(`tem movimento financeiro: ${u.username} ${JSON.stringify(mov[0])}`);
  }
  const bkp = { gerado_em: new Date().toISOString(), motivo: "remoção pedida por André em 18/11/2026 (logins sem loja ativa)", usuarios: us.map(u => { const { ...x } = u; return x; }) };
  fs.writeFileSync("C:/Users/andre.coelho.BXSD/BOXER/Dados - Documentos/Comercial/Geral/Estrategia/2026/Projeto BMax/Documentação/Backups_Banco/logins_removidos_18-11-2026.json", JSON.stringify(bkp, null, 1));
  for (const u of us) { await db.sequelize.query(`DELETE FROM "Revendas" WHERE user_id = :id`, { replacements: { id: u.id }, type: QueryTypes.DELETE }); await db.sequelize.query(`DELETE FROM "Users" WHERE id = :id`, { replacements: { id: u.id }, type: QueryTypes.DELETE }); console.log("removido:", u.username, "|", u.name); }
  // Casa dos Parafusos Umuarama: liga o login existente (id 37) à loja 30275 e grava o e-mail informado pelo André
  const login = (await q(`SELECT u.id, u.username, r.name FROM "Users" u JOIN "Revendas" r ON r.user_id=u.id WHERE u.username='financeiro1@casaparafuso.com'`))[0];
  if (!login) throw new Error("login da Casa dos Parafusos não encontrado");
  await sbSistemasService(`/comercial_revendas_bmax?id=eq.${LOJA_CASA}`, "PATCH", { user_id: login.id, email: "compras@casadosparafusos.com.br" });
  await db.sequelize.query(`UPDATE "Revendas" SET revenda_id = :r WHERE user_id = :u`, { replacements: { r: LOJA_CASA, u: login.id }, type: QueryTypes.UPDATE });
  const conf = (await sbSistemasService(`/comercial_revendas_bmax?id=eq.${LOJA_CASA}&select=nome,ativo,email,user_id,classe,rep,cidade,estado`))[0];
  console.log("Casa dos Parafusos ligada:", JSON.stringify(conf), "| login:", login.username, `"${login.name}"`);
  const tot = await q(`SELECT count(*) n FROM "Revendas"`); console.log("logins de revenda agora:", tot[0].n);
  process.exit(0);
})().catch(e => { console.error("ERRO", e.message); process.exit(1); });
