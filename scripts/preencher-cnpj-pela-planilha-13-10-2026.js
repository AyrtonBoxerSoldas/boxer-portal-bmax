// Preenche CNPJ dos cadastros ATIVOS que estão sem, pela planilha mestra (BMAX CRITERIOS.xlsx, aba REVENDA).
// Regra segura: casa por ID ZEN (nome "12345, ..." ou zen_id) — ou, só na cabeça do login (user_id), pelo e-mail.
// Nunca usa o e-mail em loja de grupo sem login (daria o CNPJ da matriz às filiais).
//   node scripts/preencher-cnpj-pela-planilha-13-10-2026.js [--aplicar]
require("dotenv").config({ quiet: true });
const fs = require("fs");
const XLSX = require("xlsx");
const { sbSistemasService: sv } = require("../src/config/supabaseSistemas");
const db = require("../src/database");
const { QueryTypes } = require("sequelize");
const dg = s => String(s || "").replace(/\D/g, "");
const n = s => String(s || "").trim().toLowerCase();
const APLICAR = process.argv.includes("--aplicar");

(async () => {
    const wb = XLSX.readFile("../Documentação/BMAX CRITERIOS.xlsx");
    const rows = XLSX.utils.sheet_to_json(wb.Sheets["REVENDA"], { header: 1, defval: "" });
    const H = rows[1].map(c => String(c).trim());
    const I = k => H.indexOf(k);
    const sheet = rows.slice(2).filter(r => r[I("ID ZEN")] && dg(r[I("CNPJ")]).length === 14).map(r => ({ zen: String(r[I("ID ZEN")]), email: n(r[I("E-MAIL")]), cnpj: dg(r[I("CNPJ")]), nome: String(r[I("Nome")]).trim() }));
    const cad = (await sv("/comercial_revendas_bmax?select=id,nome,nome_rd,zen_id,cnpj,user_id,ativo,grupo&ativo=eq.true&limit=1000")).filter(c => !c.cnpj);
    const logins = await db.sequelize.query(`SELECT id, username FROM "Users" WHERE role = 'revenda'`, { type: QueryTypes.SELECT });
    const userPorId = new Map(logins.map(u => [u.id, u.username]));
    const planos = [], pendentes = [];
    for (const c of cad) {
        const zen = (String(c.nome).match(/^(\d+),/) || [])[1] || c.zen_id;
        let s = zen && sheet.find(x => x.zen === String(zen)), via = "ZEN";
        // e-mail do login só vale pra revenda SEM grupo: em grupo a cabeça do login pode não ser a
        // loja da linha da planilha (Luitex: login na Americana, planilha é a unidade de Mogi Guaçu).
        if (!s && c.user_id && !c.grupo) { s = sheet.find(x => x.email && x.email === n(userPorId.get(c.user_id))); via = "e-mail do login"; }
        if (s) planos.push({ c, cnpj: s.cnpj, via }); else pendentes.push(c);
    }
    console.log(`ativas sem CNPJ: ${cad.length} | resolvidas pela planilha: ${planos.length} | pendentes: ${pendentes.length}`);
    planos.forEach(p => console.log(`  ${(p.c.nome_rd || p.c.nome).slice(0, 38).padEnd(38)} <- ${p.cnpj} (${p.via})`));
    console.log("\nPENDENTES (sem fonte segura):");
    pendentes.forEach(c => console.log(`  ${(c.nome_rd || c.nome)} | grupo ${c.grupo || "-"}`));
    if (!APLICAR) { console.log("\n(simulação — use --aplicar)"); process.exit(0); }
    fs.writeFileSync(`scripts/backups/cnpj-planilha-${Date.now()}.json`, JSON.stringify(planos.map(p => ({ id: p.c.id, antes: p.c.cnpj })), null, 1));
    const meta = { editado_em: new Date().toISOString(), editado_por: "script-cnpj-planilha-13-10-2026" };
    for (const p of planos) await sv(`/comercial_revendas_bmax?id=eq.${p.c.id}`, "PATCH", { cnpj: p.cnpj, ...meta });
    console.log("CNPJ gravado em", planos.length, "cadastros");
    process.exit(0);
})().catch(e => { console.error("ERRO", e.message); process.exit(1); });
