// 13/10/2026: CNPJ de cada loja da Casa do Soldador (coluna "Nº do documento" do ZEN, informada pelo André),
// e-mail do login em todas as lojas (padrão Diafer/Alphabras: e-mail em todas as lojas, user_id só em uma)
// e CEP/CNPJ da Technofer (planilha mestra BMAX CRITERIOS.xlsx).
require("dotenv").config({ quiet: true });
const fs = require("fs");
const { sbSistemasService: sv } = require("../src/config/supabaseSistemas");
const { geocodeCep } = require("../src/services/geocode.service");
const LOGIN = "raphael@casadosoldador.com.br";
const meta = { editado_em: new Date().toISOString(), editado_por: "script-cnpj-email-13-10-2026" };
const LOJAS = [
    ["Casa do Soldador", "72295793000124"],
    ["Casa do Soldador Laguna 1630", "02344660000115"],
    ["Casa do Soldador Laguna 1656", "72295793000205"],
    ["Casa do Soldador Monteiro Lobato", "02344660000204"],
    ["Casa do Soldador Colombo", "72295793000396"],
    ["Casa do Soldador Londrina", "72295793000477"]
];
(async () => {
    const cad = await sv("/comercial_revendas_bmax?select=id,nome,nome_rd,cnpj,email,user_id,cep&ativo=eq.true&limit=1000");
    fs.writeFileSync(`scripts/backups/cnpj-email-${Date.now()}.json`, JSON.stringify(cad.filter(c => /casa do soldador|technofer/i.test((c.nome_rd || "") + c.nome)), null, 1));
    for (const [nomeRd, cnpj] of LOJAS) {
        const c = cad.find(x => x.nome_rd === nomeRd);
        if (!c) { console.log("NÃO ACHADO:", nomeRd); continue; }
        await sv(`/comercial_revendas_bmax?id=eq.${c.id}`, "PATCH", { cnpj, email: LOGIN, ...meta });
        console.log(`${nomeRd.padEnd(34)} | cnpj ${c.cnpj || "-"} -> ${cnpj} | e-mail -> ${LOGIN} | user_id ${c.user_id || "-"}`);
    }
    const t = cad.find(x => /^30601, Technofer/i.test(x.nome));
    const geo = await geocodeCep("14803851", { cidade: "Araraquara", estado: "SP" });
    await sv(`/comercial_revendas_bmax?id=eq.${t.id}`, "PATCH", { cep: "14803851", cnpj: "48239336000138", cidade: "Araraquara", estado: "SP", ...(geo.lat !== null ? { lat: geo.lat, lng: geo.lng } : {}), ...meta });
    console.log(`Technofer: cep ${t.cep || "-"} -> 14803851 | cnpj ${t.cnpj || "-"} -> 48239336000138 | coord ${geo.lat},${geo.lng}`);
    process.exit(0);
})().catch(e => { console.error("ERRO", e.message); process.exit(1); });
