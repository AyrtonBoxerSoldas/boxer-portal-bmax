// Importa a correspondência rd_deal_id <-> pipefy_card_id pra
// bmax_rd_pipefy_map, a partir de um CSV gerado pela ferramenta da
// migração depois da carga real (ela já sabe, naquele momento, qual card
// novo corresponde a qual negociação antiga do RD — sem isso, cada card
// migrado só seria achado por findCardByRdId, 1 chamada ao Pipefy por
// negociação).
//
// Formato esperado do CSV (com cabeçalho, vírgula): rd_deal_id,pipefy_card_id
//
// Uso: node scripts/importar-mapa-rd-pipefy.js caminho/do/arquivo.csv
require("dotenv").config({ quiet: true });
const fs = require("fs");
const { sequelize } = require("../src/database");
const { QueryTypes } = require("sequelize");

async function main() {
    const caminho = process.argv[2];
    if (!caminho) {
        console.error("Uso: node scripts/importar-mapa-rd-pipefy.js caminho/do/arquivo.csv");
        process.exit(1);
    }

    const linhas = fs.readFileSync(caminho, "utf8").split(/\r?\n/).filter(l => l.trim());
    const [cabecalho, ...dados] = linhas;
    const colunas = cabecalho.split(",").map(c => c.trim().toLowerCase());
    const idxRd = colunas.indexOf("rd_deal_id");
    const idxPipefy = colunas.indexOf("pipefy_card_id");

    if (idxRd === -1 || idxPipefy === -1) {
        console.error('CSV precisa ter as colunas "rd_deal_id" e "pipefy_card_id" no cabeçalho.');
        process.exit(1);
    }

    let importados = 0, invalidos = 0;
    for (const linha of dados) {
        const campos = linha.split(",").map(c => c.trim());
        const rdDealId = campos[idxRd];
        const pipefyCardId = campos[idxPipefy];
        if (!rdDealId || !pipefyCardId) { invalidos++; continue; }

        await sequelize.query(
            `INSERT INTO bmax_rd_pipefy_map (rd_deal_id, pipefy_card_id)
             VALUES (:rdDealId, :pipefyCardId)
             ON CONFLICT (rd_deal_id) DO UPDATE SET pipefy_card_id = :pipefyCardId`,
            { replacements: { rdDealId, pipefyCardId }, type: QueryTypes.INSERT }
        );
        importados++;
    }

    console.log(`OK: ${importados} linha(s) importada(s), ${invalidos} inválida(s)/ignorada(s).`);
    process.exit(0);
}

main().catch(e => { console.error("ERRO:", e.message); process.exit(1); });
