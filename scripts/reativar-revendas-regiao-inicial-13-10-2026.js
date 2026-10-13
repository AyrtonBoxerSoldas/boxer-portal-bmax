// Reativa revendas da região inicial (SP / sul de MG) e a Casa do Soldador (PR, classe Diamante),
// aprovado pelo André em 13/10/2026. Dados vêm da planilha mestra BMAX CRITERIOS.xlsx (aba REVENDA).
// Senha inicial = prefixo do e-mail (padrão da aba "Senha inicial" da planilha).
//   node scripts/reativar-revendas-regiao-inicial-13-10-2026.js [--aplicar]
require("dotenv").config({ quiet: true });
const fs = require("fs");
const XLSX = require("xlsx");
const bcrypt = require("bcryptjs");
const { sbSistemasService: sv } = require("../src/config/supabaseSistemas");
const { geocodeCep } = require("../src/services/geocode.service");
const db = require("../src/database");

const APLICAR = process.argv.includes("--aplicar");
const n = s => String(s || "").trim().toLowerCase();
const digits = s => String(s || "").replace(/\D/g, "");

// login (e-mail) -> id do cadastro a reativar + classe forçada (se houver)
const ALVOS = [
    { email: "oxigenio@oxigeniojundiai.com.br", cadastroId: "e22e5434-f1d8-4a48-8cb5-7ff2320d2d2a" },
    { email: "ferragistaltda@hotmail.com", cadastroId: "4c52ce16-2900-4612-b36b-ddd0dfd51a7f" },
    { email: "nelson@oxirio.com.br", cadastroId: "eb0d7ad4-a020-4e6a-9aaf-e094d3289ecb" },
    { email: "fiscal@edmaq.com.br", cadastroId: "e6d858b8-2322-494c-bebd-5c9c4d49497a" },
    { email: "raphael@casadosoldador.com.br", cadastroId: "ff82c7b9-2788-4edf-aed7-b7a362c26306", classe: "Diamante" }
];
const SO_SENHA = ["ivanparafusos@gmail.com"]; // já ativo, só volta ao ar com a senha padrão

(async () => {
    const wb = XLSX.readFile("../Documentação/BMAX CRITERIOS.xlsx");
    const rows = XLSX.utils.sheet_to_json(wb.Sheets["REVENDA"], { header: 1, defval: "" });
    const H = rows[1].map(c => String(c).trim());
    const ix = nome => H.indexOf(nome);
    const planilha = new Map(rows.slice(2).filter(r => r[ix("E-MAIL")]).map(r => [n(r[ix("E-MAIL")]), r]));

    const meta = { editado_em: new Date().toISOString(), editado_por: "script-reativacao-13-10-2026" };
    const plano = [];
    for (const a of ALVOS) {
        const user = await db.User.findOne({ where: { username: a.email } });
        const rev = user && await db.Revenda.findOne({ where: { user_id: user.id } });
        const [cad] = await sv(`/comercial_revendas_bmax?id=eq.${a.cadastroId}&select=*`);
        const r = planilha.get(n(a.email));
        if (!user || !rev || !cad || !r) { console.log("PULADO (dado ausente):", a.email, { user: !!user, rev: !!rev, cad: !!cad, planilha: !!r }); continue; }
        const cep = digits(r[ix("CEP")]);
        const geo = await geocodeCep(cep, { cidade: cad.cidade, estado: cad.estado });
        const campos = {
            ativo: true, user_id: user.id, nome_rd: rev.name, email: a.email,
            cnpj: digits(r[ix("CNPJ")]) || cad.cnpj, cep: cep || cad.cep,
            rep: String(r[ix("Representante")]).trim() || cad.rep,
            classe: a.classe || (/^(ouro|prata)$/i.test(String(r[ix("CLASSIFICAÇÃO")]).trim()) ? String(r[ix("CLASSIFICAÇÃO")]).trim() : cad.classe),
            ...(geo.lat !== null ? { lat: geo.lat, lng: geo.lng } : {})
        };
        plano.push({ a, user, cad, campos });
        console.log(`${rev.name} <${a.email}> | cadastro "${cad.nome}" | classe ${cad.classe} -> ${campos.classe} | rep ${cad.rep} -> ${campos.rep} | cnpj ${cad.cnpj || "-"} -> ${campos.cnpj} | cep ${cad.cep || "-"} -> ${campos.cep} | coord ${cad.lat} -> ${campos.lat ?? "(mantida)"}`);
    }
    const logins = [...ALVOS.map(a => a.email), ...SO_SENHA];
    console.log("\nsenha inicial (prefixo do e-mail) para:", logins.length, "logins");
    if (!APLICAR) { console.log("(simulação — use --aplicar)"); process.exit(0); }

    fs.writeFileSync(`scripts/backups/reativacao-13-10-${Date.now()}.json`, JSON.stringify(plano.map(p => ({ id: p.cad.id, antes: p.cad })), null, 1));
    for (const p of plano) await sv(`/comercial_revendas_bmax?id=eq.${p.cad.id}`, "PATCH", { ...p.campos, ...meta });
    console.log("cadastros reativados:", plano.length);
    for (const email of logins) {
        const u = await db.User.findOne({ where: { username: email } });
        if (!u) { console.log("login não encontrado:", email); continue; }
        await u.update({ password: await bcrypt.hash(email.split("@")[0], 10) });
    }
    console.log("senhas redefinidas:", logins.length);
    process.exit(0);
})().catch(e => { console.error("ERRO", e.message); process.exit(1); });
