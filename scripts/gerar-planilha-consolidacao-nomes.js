// Gera a planilha de revisão para consolidar os nomes de revenda em UM nome por loja (somente leitura).
//   node scripts/gerar-planilha-consolidacao-nomes.js
require("dotenv").config({ quiet: true });
const XLSX = require("xlsx");
const l = require("../src/services/rd.leads.service");
const C = require("../src/config/constants");
const { sbSistemasService: sv } = require("../src/config/supabaseSistemas");
const db = require("../src/database");
const { QueryTypes } = require("sequelize");

const n = s => String(s || "").trim().toLowerCase();
const norm = s => String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/^\s*\d+\s*,?\s*/, "").replace(/[^a-z0-9]+/g, " ").trim();
const STOP = new Set(["ltda", "eireli", "epp", "me", "comercio", "de", "do", "da", "e", "dos", "das", "com", "industria", "servicos"]);
const toks = s => new Set(norm(s).split(" ").filter(t => t.length > 1 && !STOP.has(t)));
const sim = (a, b) => { const A = toks(a), B = toks(b); if (!A.size || !B.size) return 0; let i = 0; A.forEach(t => B.has(t) && i++); return i / Math.min(A.size, B.size); };

(async () => {
    const [cad, opcoes, todos, logins, grupos] = await Promise.all([
        sv("/comercial_revendas_bmax?select=*&limit=1000"),
        l.getOpcoesRevendaRD(),
        l.fetchAllDealsAllPipelines(),
        db.sequelize.query(`SELECT u.id, u.username, r.name, r.grupo FROM "Users" u JOIN "Revendas" r ON r.user_id=u.id WHERE u.role='revenda'`, { type: QueryTypes.SELECT }),
        db.sequelize.query(`SELECT revenda_rd, grupo FROM bmax_grupos`, { type: QueryTypes.SELECT })
    ]);
    const deals = todos.filter(d => d._pipelineId === C.RD_PIPELINE_INDUSTRIA || d._pipelineId === C.RD_PIPELINE_BMAX_INTERNO);
    const leadsPor = {};
    deals.forEach(d => { const k = n(l.getCustomField(d, "REVENDA/LOJA")); if (k) leadsPor[k] = (leadsPor[k] || 0) + 1; });
    const ativos = cad.filter(c => c.ativo);
    const canonDe = c => String(c.nome_rd || c.nome).trim();
    const canonSet = new Set(ativos.map(c => n(canonDe(c))));
    const loginDoGrupo = {};
    logins.filter(u => u.grupo).forEach(u => { loginDoGrupo[u.grupo] = u; });
    const grupoDe = nome => (grupos.find(g => n(g.revenda_rd) === n(nome)) || {}).grupo;

    // variantes: opções do RD que não são o nome canônico de nenhuma loja ativa
    const orfas = opcoes.filter(o => !canonSet.has(n(o)) && n(o) !== "sem revenda" && n(o) !== "n/d");
    const atribuicao = new Map();
    orfas.forEach(o => {
        let melhor = null, ms = 0;
        ativos.forEach(c => { const s = Math.max(sim(o, canonDe(c)), sim(o, c.nome)); if (s > ms) { ms = s; melhor = c; } });
        if (melhor && ms >= 0.7) atribuicao.set(o, { c: melhor, s: ms });
    });

    // Decisões já tomadas pelo André que a semelhança de nome não adivinha
    const DECIDIDOS = { "d. soldas": "Aldesoldas" };
    orfas.forEach(o => {
        const alvo = DECIDIDOS[n(o)];
        const loja = alvo && ativos.find(c => n(canonDe(c)) === n(alvo));
        if (loja) atribuicao.set(o, { c: loja, s: 1 });
    });

    const lojas = ativos.map(c => {
        const canon = canonDe(c);
        const g = grupoDe(canon);
        const headLogin = logins.find(u => u.id === c.user_id) || (g && loginDoGrupo[g]) || null;
        const variantes = [...atribuicao.entries()].filter(([, v]) => v.c.id === c.id).map(([o]) => o);
        const avisos = [];
        if (!c.nome_rd) avisos.push("Nome no RD vazio (usa o nome do ZEN)");
        if (headLogin && !g && n(headLogin.name) !== n(canon)) avisos.push(`login com nome diferente: "${headLogin.name}"`);
        if (!opcoes.some(o => n(o) === n(canon))) avisos.push("nome canônico NÃO existe no picklist do RD");
        return {
            "Nome canônico proposto (edite se quiser)": canon,
            "Nome no ZEN (cadastro)": c.nome,
            "Grupo": c.grupo || "",
            "Login": headLogin ? headLogin.username : "",
            "Leads com o nome canônico": leadsPor[n(canon)] || 0,
            "Variantes antigas no RD (provável mesma loja)": variantes.map(v => `${v} (${leadsPor[n(v)] || 0})`).join(" | "),
            "Leads nas variantes": variantes.reduce((s, v) => s + (leadsPor[n(v)] || 0), 0),
            "Avisos": avisos.join(" ; "),
            "OK? (S/N ou novo nome)": ""
        };
    }).sort((a, b) => String(a["Grupo"]).localeCompare(String(b["Grupo"])) || a["Nome canônico proposto (edite se quiser)"].localeCompare(b["Nome canônico proposto (edite se quiser)"]));

    const usadas = new Set(logins.map(u => n(u.name)).concat(grupos.map(g => n(g.revenda_rd))));
    const variantesSheet = orfas.map(o => {
        const at = atribuicao.get(o);
        const q = leadsPor[n(o)] || 0;
        return {
            "Opção no RD": o,
            "Leads (todos os funis)": q,
            "Referenciada por login/grupo?": usadas.has(n(o)) ? "sim" : "não",
            "Loja provável": at ? canonDe(at.c) : "(nenhuma parecida)",
            "Ação proposta": at ? `renomear ${q} lead(s) para a loja provável e retirar das listas` : (q ? "DECIDIR: tem leads e não casa com loja ativa" : "sem leads: só retirar das listas (a opção pode ficar no RD)"),
            "OK? (S/N ou outra ação)": ""
        };
    }).sort((a, b) => b["Leads (todos os funis)"] - a["Leads (todos os funis)"]);

    const inativos = logins.filter(u => !ativos.some(c => n(canonDe(c)) === n(u.name)) && !(u.grupo && grupos.some(g => g.grupo === u.grupo && canonSet.has(n(g.revenda_rd)))));
    const loginsSheet = inativos.map(u => ({ "Login": u.username, "Nome do login": u.name, "Leads": leadsPor[n(u.name)] || 0, "Situação": "revenda sem loja ativa no programa", "Ação (manter / desativar / reativar loja)": "" }));

    const perguntas = [
        ["1", "WST tem 2 cadastros ativos com o mesmo nome e CEP, CNPJs diferentes (43.542.081/0001-64 e 53.924.644/0001-32). É segunda loja ou duplicata?"],
        ["2", "Nomes que EU escolhi para lojas novas (Atual Equipamentos Itapema, Cascavel Soldas Padre Anchieta, Ivan Ferramentas Nepomuceno, Ivan Ferramentas Boa Esperança 2, e as da Casa do Soldador): manter ou trocar? (edite na aba Lojas)"],
        ["3", "Na aba Variantes: confirmar que as lojas prováveis estão certas antes de renomear os leads."],
        ["4", "Na aba Logins: decidir os logins de revendas que não estão ativas no programa (manter, desativar ou reativar a loja)."],
        ["5", "Regra proposta: o Nome no RD passa a ser o único nome que liga RD, Portal e Motor (obrigatório e único). O nome do ZEN fica só como dado cadastral. De acordo?"]
    ].map(([k, t]) => ({ "#": k, "Decisão necessária": t, "Sua resposta": "" }));

    const wb = XLSX.utils.book_new();
    const add = (nome, rows, larguras) => {
        const ws = XLSX.utils.json_to_sheet(rows);
        ws["!cols"] = larguras.map(w => ({ wch: w }));
        XLSX.utils.book_append_sheet(wb, ws, nome);
    };
    add("Decisões", perguntas, [4, 120, 40]);
    add("Lojas", lojas, [38, 52, 18, 36, 12, 60, 12, 50, 22]);
    add("Variantes", variantesSheet, [46, 14, 16, 36, 70, 22]);
    add("Logins", loginsSheet, [40, 40, 8, 38, 36]);
    XLSX.writeFile(wb, "../Documentação/Consolidacao_nomes_revendas_14-10-2026.xlsx");

    const casam = variantesSheet.filter(v => v["Loja provável"] !== "(nenhuma parecida)");
    console.log(`lojas ativas: ${lojas.length} | com aviso: ${lojas.filter(x => x["Avisos"]).length} | com variantes: ${lojas.filter(x => x["Variantes antigas no RD (provável mesma loja)"]).length}`);
    console.log(`opções no RD sem loja ativa: ${orfas.length} | casam com uma loja: ${casam.length} (${casam.reduce((s, v) => s + v["Leads (todos os funis)"], 0)} leads) | a decidir (tem leads, sem loja): ${variantesSheet.filter(v => v["Ação proposta"].startsWith("DECIDIR")).length}`);
    console.log(`logins sem loja ativa: ${loginsSheet.length}`);
    console.log("\nlojas com aviso:");
    lojas.filter(x => x["Avisos"]).forEach(x => console.log("  ", x["Nome canônico proposto (edite se quiser)"], "|", x["Avisos"]));
    console.log("\nvariantes com leads:");
    variantesSheet.filter(v => v["Leads (todos os funis)"] > 0).slice(0, 15).forEach(v => console.log("  ", v["Opção no RD"], "|", v["Leads (todos os funis)"], "leads |", v["Loja provável"]));
    process.exit(0);
})().catch(e => { console.error("ERR", e.message); process.exit(1); });
