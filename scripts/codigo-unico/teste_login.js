const P = "C:/Users/andre.coelho.BXSD/BOXER/Dados - Documentos/Comercial/Geral/Estrategia/2026/Projeto BMax/boxer-portal-bmax";
process.chdir(P); require(P + "/node_modules/dotenv").config({ quiet: true });
const bcrypt = require(P + "/node_modules/bcryptjs"); const db = require(P + "/src/database"); const { login } = require(P + "/src/controllers/auth.controller");
const chamar = async (username, password, role) => { let out = {}; const res = { status(c) { out.status = c; return this; }, json(b) { out.body = b; return this; } }; await login({ body: { username, password, role }, headers: {}, ip: "127.0.0.1", connection: {}, get() { return ""; } }, res); return `${out.status || 200} ${out.body && (out.body.error || (out.body.token ? "TOKEN" : JSON.stringify(out.body).slice(0, 60)))}`; };
(async () => {
  console.log("Compras6@Tamoyo.com.br + senha ERRADA ->", await chamar("Compras6@Tamoyo.com.br", "x-errada-x", "revenda"), "(esperado: 401 Senha inválida = usuário achado)");
  console.log("compras6@tamoyo.com.br + senha ERRADA  ->", await chamar("compras6@tamoyo.com.br", "x-errada-x", "revenda"));
  console.log("ADMIN (duas contas admin/Admin) ->", await chamar("ADMIN", "x-errada-x", "adm"), "(esperado: 401 Usuário inválido = não adivinha)");
  console.log("naoexiste@x.com ->", await chamar("naoexiste@x.com", "x", "revenda"));
  for (const [id, senha] of [[54, "compras6"]]) { const u = await db.User.findByPk(id); console.log("Tamoyo hash confere com a senha do padrão:", await bcrypt.compare(senha, u.password), "| username:", u.username); }
  const d = await db.User.findOne({ where: { username: "enoque.almeida@dominik.com.br" } }); console.log("Dominik hash confere com a senha do padrão:", await bcrypt.compare("enoque.almeida", d.password), "| role:", d.role);
  process.exit(0);
})().catch(e => { console.error("ERRO", e.stack || e.message); process.exit(1); });
