// Correções de nome (08/10/2026) — registro do que foi aplicado em produção:
//  1) cadastros de revenda com representante inexistente -> nome canônico do cadastro de representante
//  2) Romapar / Suprimig: cadastro ZEN com nome longo -> "Nome no RD" curto, deals renomeados, login alinhado
require("dotenv").config({ quiet: true });
const l = require("../src/services/rd.leads.service");
const { sbSistemasService: sv } = require("../src/config/supabaseSistemas");
const db = require("../src/database");

const quando = new Date().toISOString();
const meta = { editado_em: quando, editado_por: "script-08-10-2026" };

(async () => {
    const opcoes = await l.getOpcoesRevendaRD();
    const noPicklist = n => opcoes.some(o => o.trim().toLowerCase() === n.trim().toLowerCase());

    console.log("== 1) representante dos cadastros de revenda ==");
    const trocas = [
        { de: "Victor Representante", para: "Victor VLM" },
        { de: "Caio", para: "Caio P Mancini" }
    ];
    for (const t of trocas) {
        const rows = await sv(`/comercial_revendas_bmax?rep=eq.${encodeURIComponent(t.de)}&select=id,nome,nome_rd,rep,ativo`);
        for (const r of rows) {
            await sv(`/comercial_revendas_bmax?id=eq.${r.id}`, "PATCH", { rep: t.para, ...meta });
            console.log(`  ${r.ativo ? "ATIVA  " : "inativa"} | ${r.nome} | "${t.de}" -> "${t.para}"`);
        }
    }

    console.log("\n== 2) Romapar / Suprimig ==");
    const casos = [
        { id: "66028228-dd49-4bdc-a5de-84c9bac982cc", nomeRd: "Romapar", login: "edson@romaparafusos.com.br" },
        { id: "7ed91a73-8807-476b-8e5e-1724a05990f7", nomeRd: "Suprimig", login: "heitor@suprimig.com.br" }
    ];
    for (const c of casos) {
        const [cad] = await sv(`/comercial_revendas_bmax?id=eq.${c.id}&select=id,nome,nome_rd`);
        if (!cad) { console.log("  cadastro não encontrado", c.id); continue; }
        if (!noPicklist(c.nomeRd)) { console.log(`  PULADO: "${c.nomeRd}" não existe no picklist do RD`); continue; }
        const antigoRd = cad.nome_rd || cad.nome;
        await sv(`/comercial_revendas_bmax?id=eq.${c.id}`, "PATCH", { nome_rd: c.nomeRd, ...meta });
        console.log(`  cadastro "${cad.nome}" -> nome_rd = "${c.nomeRd}"`);
        const r = await l.renomearRevendaNoRD(antigoRd, c.nomeRd);
        console.log(`  deals renomeados no RD: ${r.updated} de ${r.total} varridos (falhas: ${r.failed})`);
        const user = await db.User.findOne({ where: { username: c.login } });
        const rev = user ? await db.Revenda.findOne({ where: { user_id: user.id } }) : null;
        if (rev && rev.name !== c.nomeRd) { const ant = rev.name; await rev.update({ name: c.nomeRd }); console.log(`  login ${c.login}: Revenda.name "${ant}" -> "${c.nomeRd}"`); }
        else console.log(`  login ${c.login}: já está "${rev ? rev.name : "(sem Revenda)"}"`);
    }
    process.exit(0);
})().catch(e => { console.error("ERRO", e.message); process.exit(1); });
