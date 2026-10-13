// Casa do Soldador (PR, Diamante, representante Hugo Carpanese): 6 lojas (endereços do ZEN, informados
// pelo André em 13/10/2026) como cadastros do Motor + grupo no Portal + filiais + opções no RD.
//   node scripts/casa-do-soldador-filiais-13-10-2026.js [--aplicar]
require("dotenv").config({ quiet: true });
const fs = require("fs");
const l = require("../src/services/rd.leads.service");
const { sbSistemasService: sv } = require("../src/config/supabaseSistemas");
const { geocodeCep, nominatimGeocode } = require("../src/services/geocode.service");

// Caixa aproximada de cada cidade: só aceita a coordenada por endereço se cair dentro dela.
const CAIXA = { "Maringá": [-23.55, -23.30, -52.10, -51.80], "Londrina": [-23.45, -23.20, -51.30, -51.00] };
const dentro = (g, cidade) => g && CAIXA[cidade] && g.lat >= CAIXA[cidade][0] && g.lat <= CAIXA[cidade][1] && g.lng >= CAIXA[cidade][2] && g.lng <= CAIXA[cidade][3];
const pausa = ms => new Promise(r => setTimeout(r, ms));
const db = require("../src/database");
const { QueryTypes } = require("sequelize");

const APLICAR = process.argv.includes("--aplicar");
const GRUPO = "Casa do Soldador";
const LOGIN = "raphael@casadosoldador.com.br";
const REP = "Hugo Carpanese";

// cadastroId = existente a reaproveitar (null = criar). zen_id mantido nos existentes.
const LOJAS = [
    { chave: "matriz", cadastroId: "0c2d3706-7951-4eec-b7c5-a7496a52fc58", nomeRd: "Casa do Soldador", cep: "87069013", cidade: "Maringá", uf: "PR", endereco: "Avenida Julieta Dos Santos Pardini", numero: "112", bairro: "Parque Industrial Cidade De Maringá", principal: true },
    { chave: "laguna1630", cadastroId: "c332833f-5398-4c8b-af0c-a4998303d400", nomeRd: "Casa do Soldador Laguna 1630", cep: "87050260", cidade: "Maringá", uf: "PR", endereco: "Avenida Laguna", numero: "1630", bairro: "Zona 08" },
    { chave: "laguna1656", cadastroId: "ff82c7b9-2788-4edf-aed7-b7a362c26306", nomeRd: "Casa do Soldador Laguna 1656", cep: "87050363", cidade: "Maringá", uf: "PR", endereco: "Avenida Laguna", numero: "1656", bairro: "Zona 08" },
    { chave: "monteiro", cadastroId: null, nomeRd: "Casa do Soldador Monteiro Lobato", nome: "Casa Do Soldador - Monteiro Lobato 1168", cep: "87050280", cidade: "Maringá", uf: "PR", endereco: "Avenida Monteiro Lobato", numero: "1168", bairro: "Zona 08" },
    { chave: "colombo", cadastroId: null, nomeRd: "Casa do Soldador Colombo", nome: "Casa Do Soldador - Colombo 4738", cep: "87030121", cidade: "Maringá", uf: "PR", endereco: "Avenida Colombo", numero: "4738", bairro: "Zona 07" },
    { chave: "londrina", cadastroId: "c4926e29-871f-40ff-bcb1-5b4a77fc72bb", nomeRd: "Casa do Soldador Londrina", cep: "86010190", cidade: "Londrina", uf: "PR", endereco: "Avenida Duque De Caxias", numero: "3148", bairro: "Jardim Londrilar" }
];

(async () => {
    const user = await db.User.findOne({ where: { username: LOGIN } });
    const rev = await db.Revenda.findOne({ where: { user_id: user.id } });
    const cadAll = await sv("/comercial_revendas_bmax?select=*&limit=1000");
    const existentes = LOJAS.filter(x => x.cadastroId).map(x => cadAll.find(c => c.id === x.cadastroId));
    if (existentes.some(c => !c)) throw new Error("cadastro esperado não encontrado");
    const meta = { editado_em: new Date().toISOString(), editado_por: "script-casa-do-soldador-13-10-2026" };
    const matrizCad = cadAll.find(c => c.id === LOJAS[0].cadastroId);
    const nomesRdUsados = new Set(cadAll.filter(c => !LOJAS.some(x => x.cadastroId === c.id)).map(c => String(c.nome_rd || "").trim().toLowerCase()));
    LOJAS.forEach(x => { if (nomesRdUsados.has(x.nomeRd.toLowerCase())) throw new Error("nome_rd já usado por outro cadastro: " + x.nomeRd); });

    const plano = [];
    for (const x of LOJAS) {
        const atual = x.cadastroId ? cadAll.find(c => c.id === x.cadastroId) : null;
        let geo = await nominatimGeocode({ street: x.numero + " " + x.endereco, city: x.cidade, state: "Paraná" });
        await pausa(1300); // limite do Nominatim: 1 requisição por segundo
        if (!dentro(geo, x.cidade)) geo = await geocodeCep(x.cep, { cidade: x.cidade, estado: x.uf }); // plano B: CEP / centro da cidade
        const campos = {
            ativo: true, classe: "Diamante", rep: REP, grupo: GRUPO, nome_rd: x.nomeRd,
            cidade: x.cidade, estado: x.uf, cep: x.cep, endereco: `${x.endereco}, ${x.numero} - ${x.bairro}`,
            ...(geo.lat !== null ? { lat: geo.lat, lng: geo.lng } : {}),
            // vínculo 1:1 com o login e dados cadastrais só na matriz (as demais são lojas do mesmo grupo)
            user_id: x.principal ? user.id : null,
            email: x.principal ? LOGIN : null,
            cnpj: x.principal ? (rev.cnpj || matrizCad.cnpj) : (atual ? atual.cnpj && atual.cnpj !== rev.cnpj ? atual.cnpj : null : null),
            ...(atual ? {} : { nome: x.nome })
        };
        plano.push({ x, atual, campos });
        console.log(`${(atual ? "EXISTE " : "CRIAR  ")} | ${x.nomeRd.padEnd(34)} | CEP ${x.cep} ${x.cidade} | ${x.endereco}, ${x.numero} | coord ${geo.lat ?? "?"},${geo.lng ?? "?"}${atual ? ` | ativo ${atual.ativo} -> true, classe ${atual.classe} -> Diamante, rep ${atual.rep} -> ${REP}, zen ${atual.zen_id}` : ""}`);
    }
    const gr = await db.sequelize.query(`SELECT * FROM bmax_grupos WHERE revenda_rd ILIKE 'casa do soldador%'`, { type: QueryTypes.SELECT });
    console.log("\ngrupo no Portal:", GRUPO, "| linhas existentes:", gr.map(g => g.revenda_rd).join(" | "), "| login Revenda.grupo:", rev.grupo, "->", GRUPO);
    const fil = await db.sequelize.query(`SELECT cep FROM "RevendaFiliais" WHERE user_id = :id`, { replacements: { id: user.id }, type: QueryTypes.SELECT });
    console.log("filiais do login hoje:", fil.length, "-> serão criadas:", LOJAS.filter(x => !fil.some(f => f.cep === x.cep)).length);
    if (!APLICAR) { console.log("\n(simulação — use --aplicar)"); process.exit(0); }

    fs.writeFileSync(`scripts/backups/casa-do-soldador-${Date.now()}.json`, JSON.stringify({ cadastros: existentes, grupos: gr, revenda: rev.toJSON() }, null, 1));
    for (const p of plano) {
        if (p.atual) await sv(`/comercial_revendas_bmax?id=eq.${p.atual.id}`, "PATCH", { ...p.campos, ...meta });
        else await sv("/comercial_revendas_bmax", "POST", { ...p.campos, ...meta });
    }
    console.log("cadastros: reaproveitados", plano.filter(p => p.atual).length, "| criados", plano.filter(p => !p.atual).length);

    for (const x of LOJAS) {
        await db.sequelize.query(
            `INSERT INTO bmax_grupos (revenda_rd, grupo, email_responsavel) VALUES (:r, :g, :e)
             ON CONFLICT (revenda_rd) DO UPDATE SET grupo = :g, email_responsavel = COALESCE(bmax_grupos.email_responsavel, :e)`,
            { replacements: { r: x.nomeRd, g: GRUPO, e: LOGIN } });
    }
    await rev.update({ grupo: GRUPO });
    console.log("grupo Portal:", LOJAS.length, "lojas | login Revenda.grupo =", GRUPO);

    let novas = 0;
    for (const x of LOJAS) {
        if (fil.some(f => f.cep === x.cep)) continue;
        await db.RevendaFilial.create({ user_id: user.id, nome: x.nomeRd, cep: x.cep, cidade: x.cidade, estado: x.uf, endereco: x.endereco, numero: x.numero, complemento: x.bairro, principal: !!x.principal, email: x.principal ? LOGIN : null });
        novas++;
    }
    console.log("filiais (Portal) criadas:", novas);

    // opções no RD: união com as ativas (nome_rd || nome), como o Portal faz ao salvar revenda
    const ativas = await sv("/comercial_revendas_bmax?ativo=eq.true&select=nome,nome_rd&limit=1000");
    const r = await l.syncRevendasToRD(ativas.map(c => (c.nome_rd && c.nome_rd.trim()) || c.nome));
    console.log("RD REVENDA/LOJA sincronizado:", JSON.stringify(r));
    process.exit(0);
})().catch(e => { console.error("ERRO", e.message); process.exit(1); });
