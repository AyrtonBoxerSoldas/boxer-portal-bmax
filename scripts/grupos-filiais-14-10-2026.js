// Grupos com filiais (dados do ZEN enviados pelo André em 13-14/10/2026): Diafer, Luitex, Alphabras,
// Atual Equipamentos, Cascavel Soldas e Ivan Ferramentas. Para cada loja: casa por CEP/nome com o
// cadastro existente (ou cria), grava CNPJ/CEP/endereço/coordenada, e-mail do login do grupo, grupo no
// Portal (bmax_grupos + Revenda.grupo), filiais do Portal e opções no RD. Casa do Soldador já foi feita.
// Fecha também o e-mail dos demais cadastros ativos (cabeça do login = e-mail do login; sem login = planilha).
//   node scripts/grupos-filiais-14-10-2026.js [--aplicar]
require("dotenv").config({ quiet: true });
const fs = require("fs");
const XLSX = require("xlsx");
const l = require("../src/services/rd.leads.service");
const { sbSistemasService: sv } = require("../src/config/supabaseSistemas");
const { geocodeCep, nominatimGeocode } = require("../src/services/geocode.service");
const db = require("../src/database");
const { QueryTypes } = require("sequelize");

const APLICAR = process.argv.includes("--aplicar");
const n = s => String(s || "").trim().toLowerCase();
const dg = s => String(s || "").replace(/\D/g, "");
const pausa = ms => new Promise(r => setTimeout(r, ms));

// loja: { cep, cnpj, cidade, uf, rua, num, bairro, nomeRd, head?, cadId? (casamento explícito), ... }
const GRUPOS = [
    {
        nome: "Diafer", tagCadastro: "DIAFER", login: "ademir.oliv@diafer.com.br", rep: null, extraNomesGrupo: [],
        lojas: [
            { nomeRd: "Diafer Itapeva Matriz", head: true, cep: "18406000", cnpj: "04798677000178", cidade: "Itapeva", uf: "SP", rua: "Avenida Roberto Gemignani", num: "78", bairro: "Central Park" },
            { nomeRd: "Diafer Itapeva", cep: "18407130", cnpj: "04798677000763", cidade: "Itapeva", uf: "SP", rua: "Rua Alexandrino De Moraes", num: "360", bairro: "Jardim Maringá" },
            { nomeRd: "Diafer Cd", cep: "18410600", cnpj: "04798677000682", cidade: "Itapeva", uf: "SP", rua: "Avenida Guido Tomazoni", num: "715", bairro: "Distrito Industrial" },
            { nomeRd: "Diafer Itapetininga", cep: "18200075", cnpj: "04798677000500", cidade: "Itapetininga", uf: "SP", rua: "Rua Padre Albuquerque", num: "931", bairro: "Centro" },
            { nomeRd: "Diafer Itararé", cep: "18460009", cnpj: "04798677000259", cidade: "Itararé", uf: "SP", rua: "Rua São Pedro", num: "1938", bairro: "Centro" },
            { nomeRd: "Diafer Capão", cep: "18304040", cnpj: "04798677000330", cidade: "Capão Bonito", uf: "SP", rua: "Rua Antônio De Souza Lopes", num: "39", bairro: "Vila Nova Capão Bonito" },
            { nomeRd: "Diafer Ponta Grossa", cep: "84070000", cnpj: "04798677000925", cidade: "Ponta Grossa", uf: "PR", rua: "Avenida Ernesto Vilela", num: "528/52", bairro: "Nova Rússia" },
            { nomeRd: "Diafer Jaguariaiva", cep: "84200000", cnpj: "04798677000410", cidade: "Jaguariaíva", uf: "PR", rua: "Av Governador Paulo Da Cruz Pimentel", num: "362", bairro: "Jardim N.S. De Fátima" }
        ]
    },
    {
        nome: "Luitex", tagCadastro: "Luitex", login: "marcio@luitex.com.br", extraNomesGrupo: ["LUITEX"],
        lojas: [
            { nomeRd: "Luitex Americana", head: true, cep: "13466000", cnpj: "51051811000233", cidade: "Americana", uf: "SP", rua: "Rua Dom Pedro II", num: "790", bairro: "Santa Catarina" },
            { nomeRd: "Cd Luitex Americana", cep: "13478704", cnpj: "51051811000748", cidade: "Americana", uf: "SP", rua: "Avenida Marginal-Futura", num: "1285", bairro: "Recanto" },
            { nomeRd: "Luitex Mogi Guaçu", cep: "13844282", cnpj: "51051811000403", cidade: "Mogi Guaçu", uf: "SP", rua: "Rua Ulisses Leme", num: "1850", bairro: "Parque Guaíno", cadNome: "LUITEX" },
            { nomeRd: "Luitex SBO", cep: "13450088", cnpj: "51051811000152", cidade: "Santa Bárbara d'Oeste", uf: "SP", rua: "Avenida Conifeu Azevedo Marques", num: "280", bairro: "Loteamento Colina Santa Bárbara" },
            { nomeRd: "Luitex Sumaré", cep: "13173050", cnpj: "51051811000314", cidade: "Sumaré", uf: "SP", rua: "Avenida Eugênia Biancalana Duarte", num: "15", bairro: "Jardim Primavera" }
        ]
    },
    {
        nome: "Alphabras", tagCadastro: "Alphabras", login: "compras.alphabras@gmail.com", extraNomesGrupo: ["Alphabras", "42863 Alphabras Poços de Caldas 1"],
        desativarDuplicadosPorCep: true,
        lojas: [
            { nomeRd: "Alphabras", head: true, cadPrefixo: "42863,", cep: "37701489", cnpj: "05159343000117", cidade: "Poços de Caldas", uf: "MG", rua: "Travessa Coronel Virgílio Silva", num: "102", bairro: "Bem Bastos" },
            { nomeRd: "31490 Alphabras SJBV", cep: "13874439", cnpj: "43042383000173", cidade: "São João da Boa Vista", uf: "SP", rua: "Rua Nagib Miguel", num: "3045", bairro: "Jardim Recanto Do Bosque" },
            { nomeRd: "42546 Alphabras Poços de Caldas 2", cep: "37701386", cnpj: "26632757000191", cidade: "Poços de Caldas", uf: "MG", rua: "Avenida João Pinheiro", num: "2539", bairro: "Centro" }
        ]
    },
    {
        nome: "Atual Equipamentos", tagCadastro: "Atual Equipamentos", login: "diretoria@atualsoldas.com.br", extraNomesGrupo: [],
        lojas: [
            { nomeRd: "Atual Equipamentos", head: true, cep: "15045185", cnpj: "60661770000107", cidade: "São José do Rio Preto", uf: "SP", rua: "Avenida Domingos Falavina", num: "911", bairro: "Minidistrito Industrial Heitor Jose Eiras Garcia" },
            { nomeRd: "Atual Equipamentos Itapema", cep: "15045395", cnpj: "18605133000157", cidade: "São José do Rio Preto", uf: "SP", rua: "Avenida Domingos Falavina", num: "911", bairro: "Jardim Itapema" }
        ]
    },
    {
        nome: "Cascavel Soldas", tagCadastro: "Cascavel Soldas", loginPorNome: "Cascavel Soldas", extraNomesGrupo: [],
        lojas: [
            { nomeRd: "Cascavel Soldas", head: true, cep: "85813195", cnpj: "08262604000380", cidade: "Cascavel", uf: "PR", rua: "Avenida Barão Do Rio Branco", num: "1467", bairro: "Country" },
            { nomeRd: "Cascavel Soldas Padre Anchieta", cep: "85803740", cnpj: "08262604000118", cidade: "Cascavel", uf: "PR", rua: "Rua Padre Anchieta", num: "374", bairro: "Parque São Paulo" }
        ]
    },
    {
        nome: "Ivan Ferramentas", tagCadastro: "Ivan Ferramentas", login: "ivanparafusos@gmail.com", extraNomesGrupo: [], renomearLoginPara: "Ivan Ferramentas",
        lojas: [
            { nomeRd: "Ivan Ferramentas", head: true, cadId: "d09e3ed0-51a5-4589-830f-1db1729a8a69", cep: "37170000", cnpj: "34144666000135", cidade: "Boa Esperança", uf: "MG", rua: "Avenida Joaquim Três Pontas", num: "336", bairro: "Santa Terezinha" },
            { nomeRd: "Ivan Ferramentas Nepomuceno", criar: true, nomeCad: "Ivan Ferramentas - Nepomuceno", cep: "37250000", cnpj: "47643702000157", cidade: "Nepomuceno", uf: "MG", rua: "Rua Francisco Teixeira De Oliveira", num: "117", bairro: "Massahud" },
            { nomeRd: "Ivan Ferramentas Boa Esperança 2", criar: true, nomeCad: "Ivan Ferramentas - Boa Esperança 2", cep: "37170000", cnpj: "03862404000182", cidade: "Boa Esperança", uf: "MG", rua: "Avenida Joaquim Três Pontas", num: "1075", bairro: "Jardim Das Magnólias" }
        ]
    }
];

(async () => {
    const [cad, opcoes, logins] = await Promise.all([
        sv("/comercial_revendas_bmax?select=*&limit=1000"),
        l.getOpcoesRevendaRD(),
        db.sequelize.query(`SELECT u.id, u.username, r.name, r.grupo FROM "Users" u JOIN "Revendas" r ON r.user_id = u.id WHERE u.role = 'revenda'`, { type: QueryTypes.SELECT })
    ]);
    const picklistExato = nome => opcoes.find(o => o.trim().toLowerCase() === nome.trim().toLowerCase());
    const meta = { editado_em: new Date().toISOString(), editado_por: "script-grupos-14-10-2026" };
    const todasAcoes = [];

    for (const g of GRUPOS) {
        const login = g.login ? logins.find(u => n(u.username) === n(g.login)) : logins.find(u => n(u.name) === n(g.loginPorNome));
        if (!login) { console.log(`\n### ${g.nome}: LOGIN NÃO ENCONTRADO — grupo pulado`); continue; }
        const headCad = cad.find(c => c.user_id === login.id);
        const rep = headCad ? headCad.rep : null;
        console.log(`\n### ${g.nome} | login ${login.username} (name="${login.name}", grupo=${login.grupo || "-"}) | rep ${rep}`);
        const usados = new Set();
        const lojasPlano = [];
        for (const x of g.lojas) {
            let atual = null;
            if (x.cadId) atual = cad.find(c => c.id === x.cadId);
            if (!atual && x.cadPrefixo) atual = cad.find(c => String(c.nome).startsWith(x.cadPrefixo));
            if (!atual && !x.criar) {
                const porCep = cad.filter(c => dg(c.cep) === x.cep && !usados.has(c.id));
                atual = porCep.find(c => n(c.grupo) === n(g.tagCadastro)) || porCep.find(c => n(c.nome_rd) === n(x.nomeRd)) || porCep.find(c => c.user_id === login.id) || porCep[0] || null;
                if (!atual) atual = cad.find(c => !usados.has(c.id) && (n(c.nome_rd) === n(x.nomeRd) || n(c.nome) === n(x.cadNome || x.nomeRd)) && (n(c.grupo) === n(g.tagCadastro) || !c.grupo));
            }
            if (atual) usados.add(atual.id);
            let geo = await nominatimGeocode({ street: x.num + " " + x.rua, city: x.cidade, state: x.uf });
            await pausa(1300);
            const base = await geocodeCep(x.cep, { cidade: x.cidade, estado: x.uf });
            if (!geo || !base.lat || Math.abs(geo.lat - base.lat) > 0.35 || Math.abs(geo.lng - base.lng) > 0.35) geo = base; // endereço fora da cidade -> usa o CEP
            const nomeRdFinal = picklistExato(x.nomeRd) || x.nomeRd;
            const campos = {
                ativo: true, grupo: g.tagCadastro, nome_rd: nomeRdFinal, cep: x.cep, cnpj: x.cnpj, cidade: x.cidade, estado: x.uf,
                endereco: `${x.rua}, ${x.num} - ${x.bairro}`, email: login.username,
                ...(geo && geo.lat != null ? { lat: geo.lat, lng: geo.lng } : {}),
                ...(x.head ? { user_id: login.id } : {}),
                ...(atual ? {} : { nome: x.nomeCad || x.nomeRd, classe: headCad ? headCad.classe : "Prata", rep })
            };
            lojasPlano.push({ x, atual, campos });
            console.log(`  ${atual ? "EXISTE" : "CRIAR "} | ${nomeRdFinal.padEnd(34)} | ${x.cep} ${x.cidade.padEnd(18)} | cnpj ${x.cnpj}${atual ? ` | casou com "${String(atual.nome).slice(0, 28)}" (ativo ${atual.ativo}, cep ${atual.cep}, cnpj ${atual.cnpj || "-"}, user ${atual.user_id || "-"})` : ""} | coord ${geo && geo.lat != null ? geo.lat.toFixed(4) + "," + geo.lng.toFixed(4) : "?"}`);
        }
        const duplicados = g.desativarDuplicadosPorCep
            ? cad.filter(c => c.ativo && n(c.grupo) === n(g.tagCadastro) && !usados.has(c.id) && g.lojas.some(x => dg(c.cep) === x.cep))
            : [];
        duplicados.forEach(d => console.log(`  DUPLICADO a inativar: "${d.nome}" (cep ${d.cep}, zen ${d.zen_id || "-"}, user ${d.user_id || "-"})`));
        const nomesGrupo = [...new Set([...lojasPlano.map(p => p.campos.nome_rd), ...g.extraNomesGrupo])];
        console.log(`  grupo no Portal "${g.nome}": ${nomesGrupo.join(" | ")}`);
        todasAcoes.push({ g, login, lojasPlano, duplicados, nomesGrupo });
    }

    // e-mail dos demais cadastros ativos
    const wb = XLSX.readFile("../Documentação/BMAX CRITERIOS.xlsx");
    const rows = XLSX.utils.sheet_to_json(wb.Sheets["REVENDA"], { header: 1, defval: "" });
    const H = rows[1].map(c => String(c).trim());
    const sheet = rows.slice(2).filter(r => r[H.indexOf("ID ZEN")]).map(r => ({ zen: String(r[H.indexOf("ID ZEN")]), email: n(r[H.indexOf("E-MAIL")]) }));
    const idsGrupos = new Set(todasAcoes.flatMap(a => a.lojasPlano.filter(p => p.atual).map(p => p.atual.id)));
    const userPorId = new Map(logins.map(u => [u.id, u.username]));
    const emails = [];
    cad.filter(c => c.ativo && !c.email && !idsGrupos.has(c.id) && c.grupo !== "Casa do Soldador").forEach(c => {
        if (c.user_id && userPorId.get(c.user_id)) return emails.push({ c, email: userPorId.get(c.user_id), via: "login" });
        const zen = (String(c.nome).match(/^(\d+),/) || [])[1] || c.zen_id;
        const s = zen && sheet.find(x => x.zen === String(zen) && x.email);
        if (s) emails.push({ c, email: s.email, via: "planilha (ZEN)" }); else console.log(`  e-mail SEM FONTE: ${c.nome_rd || c.nome} (grupo ${c.grupo || "-"})`);
    });
    console.log(`\ne-mail dos demais cadastros ativos: ${emails.length}`);
    emails.forEach(e => console.log(`  ${(e.c.nome_rd || e.c.nome).slice(0, 36).padEnd(36)} <- ${e.email} (${e.via})`));

    if (!APLICAR) { console.log("\n(simulação — use --aplicar)"); process.exit(0); }

    fs.writeFileSync(`scripts/backups/grupos-filiais-${Date.now()}.json`, JSON.stringify({
        cadastros: cad.filter(c => todasAcoes.some(a => a.lojasPlano.some(p => p.atual && p.atual.id === c.id) || a.duplicados.some(d => d.id === c.id)) || emails.some(e => e.c.id === c.id)),
        grupos: await db.sequelize.query("SELECT * FROM bmax_grupos", { type: QueryTypes.SELECT })
    }, null, 1));

    for (const a of todasAcoes) {
        for (const p of a.lojasPlano) {
            if (p.atual) await sv(`/comercial_revendas_bmax?id=eq.${p.atual.id}`, "PATCH", { ...p.campos, ...meta });
            else await sv("/comercial_revendas_bmax", "POST", { ...p.campos, ...meta });
        }
        for (const d of a.duplicados) await sv(`/comercial_revendas_bmax?id=eq.${d.id}`, "PATCH", { ativo: false, ...meta });
        for (const nome of a.nomesGrupo) {
            await db.sequelize.query(
                `INSERT INTO bmax_grupos (revenda_rd, grupo, email_responsavel) VALUES (:r, :g, :e)
                 ON CONFLICT (revenda_rd) DO UPDATE SET grupo = :g, email_responsavel = COALESCE(bmax_grupos.email_responsavel, :e)`,
                { replacements: { r: nome, g: a.g.nome, e: a.login.username } });
        }
        const rev = await db.Revenda.findOne({ where: { user_id: a.login.id } });
        const upd = { grupo: a.g.nome };
        if (a.g.renomearLoginPara) upd.name = picklistExato(a.g.renomearLoginPara) || a.g.renomearLoginPara;
        await rev.update(upd);
        const jaFiliais = (await db.sequelize.query(`SELECT cep FROM "RevendaFiliais" WHERE user_id = :id`, { replacements: { id: a.login.id }, type: QueryTypes.SELECT })).map(f => f.cep);
        for (const p of a.lojasPlano) {
            if (jaFiliais.includes(p.x.cep)) continue;
            await db.RevendaFilial.create({ user_id: a.login.id, nome: p.campos.nome_rd, cep: p.x.cep, cidade: p.x.cidade, estado: p.x.uf, endereco: p.x.rua, numero: p.x.num, complemento: p.x.bairro, principal: !!p.x.head && !jaFiliais.length, email: a.login.username });
            jaFiliais.push(p.x.cep);
        }
        console.log(`aplicado: ${a.g.nome} (${a.lojasPlano.length} lojas, ${a.duplicados.length} duplicado(s) inativado(s))`);
    }
    for (const e of emails) await sv(`/comercial_revendas_bmax?id=eq.${e.c.id}`, "PATCH", { email: e.email, ...meta });
    console.log("e-mails preenchidos:", emails.length);
    const ativas = await sv("/comercial_revendas_bmax?select=nome,nome_rd&ativo=eq.true&limit=1000");
    const r = await l.syncRevendasToRD(ativas.map(c => (c.nome_rd && c.nome_rd.trim()) || c.nome));
    console.log("RD REVENDA/LOJA sincronizado:", JSON.stringify(r));
    process.exit(0);
})().catch(e => { console.error("ERRO", e.message); process.exit(1); });
