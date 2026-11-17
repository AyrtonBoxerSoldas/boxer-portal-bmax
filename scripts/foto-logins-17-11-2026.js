// FOTO DOS LOGINS (somente leitura): o que cada login de revenda enxerga, usando as MESMAS funções do Portal.
// Uso: node foto_logins.js <saida.json> [--leads]    e depois: node foto_logins.js --comparar <antes.json> <depois.json>
const P = "C:/Users/andre.coelho.BXSD/BOXER/Dados - Documentos/Comercial/Geral/Estrategia/2026/Projeto BMax/boxer-portal-bmax";
process.chdir(P); require(P + "/node_modules/dotenv").config({ quiet: true });
const fs = require("fs");
if (process.argv[2] === "--comparar") {
  const a = JSON.parse(fs.readFileSync(process.argv[3], "utf8")), b = JSON.parse(fs.readFileSync(process.argv[4], "utf8"));
  const mb = new Map(b.map(x => [x.username, x])); let dif = 0;
  for (const x of a) { const y = mb.get(x.username); const k = ["saldo", "extrato_n", "extrato_soma", "leads"]; const d = !y ? ["SUMIU"] : k.filter(c => JSON.stringify(x[c]) !== JSON.stringify(y[c])); if (d.length) { dif++; console.log("DIFERE", x.username, d.join(","), "antes:", JSON.stringify(k.map(c => x[c])), "depois:", y ? JSON.stringify(k.map(c => y[c])) : "-"); } }
  console.log(dif ? `${dif} login(s) com diferença` : `OK: ${a.length} logins idênticos`); process.exit(dif ? 1 : 0);
}
const db = require(P + "/src/database"); const { QueryTypes } = require(P + "/node_modules/sequelize");
const saldo = require(P + "/src/services/saldo.service"); const l = require(P + "/src/services/rd.leads.service");
(async () => {
  const logins = await db.sequelize.query(`SELECT r.name, r.grupo, u.username FROM "Revendas" r JOIN "Users" u ON u.id=r.user_id ORDER BY u.username`, { type: QueryTypes.SELECT });
  const out = [];
  for (const lg of logins) {
    const s = await saldo.getSaldoGrupo(lg.name, lg.grupo); const ex = await saldo.getExtratoGrupo(lg.name, lg.grupo);
    const o = { username: lg.username, name: lg.name, grupo: lg.grupo, saldo: Number(Number(s).toFixed(2)), extrato_n: ex.length, extrato_soma: Number(ex.reduce((a, r) => a + (r.tipo === "credito" ? Number(r.valor) : -Number(r.valor)), 0).toFixed(2)) };
    if (process.argv.includes("--leads")) { try { const ls = await l.getLeads(lg.name, "revenda", lg.grupo || undefined); o.leads = ls.map(d => d.id || d._id).sort(); } catch (e) { o.leads = "ERRO " + e.message; } }
    out.push(o);
  }
  fs.writeFileSync(process.argv[2], JSON.stringify(out, null, 1));
  console.log(out.length, "logins fotografados;", out.filter(x => x.saldo).length, "com saldo;", out.reduce((a, x) => a + x.saldo, 0).toFixed(2), "soma dos saldos");
  process.exit(0);
})().catch(e => { console.error("ERRO", e.stack || e.message); process.exit(1); });
