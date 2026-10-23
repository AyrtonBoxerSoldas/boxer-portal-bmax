// Lê o mapa_pipefy.json local (gerado na montagem da estrutura no Pipefy,
// fica no .gitignore — não pode ir pro Git nem chegar no deploy da Vercel
// por lá) e imprime um JSON reduzido, pronto pra colar na variável de
// ambiente PIPEFY_MAPA_JSON (Vercel → Project Settings → Environment
// Variables). Reduzido = os pipes que o Portal de fato lê
// (PIPEFY_PIPES_PORTAL, de pipefyConstants.js — NÃO um default próprio
// aqui, pra nunca dessincronizar dos dois) **mais sempre BMAX e
// REVENDA - INTERNO** (Tarefa A4, 2º adendo 23/10/2026: mesmo que não
// estejam no painel, são usados por createLeadPipefy — revenda sempre cria
// no BMAX —, getLeadByCnpjPipefy e pelas 3 rotinas de renomear/reatribuir;
// sem eles no mapa, essas operações quebram em produção), mais
// contatos/empresas/membros.
//
// Uso: node scripts/gerar-pipefy-mapa-env.js
require("dotenv").config({ quiet: true });

function montarMapaReduzido(mapaCompleto, pipesPortal) {
    const nomesPipes = Array.from(new Set([...pipesPortal, "BMAX", "REVENDA - INTERNO"]));

    const pipesReduzidos = {};
    for (const nome of nomesPipes) {
        if (mapaCompleto.pipes?.[nome]) {
            pipesReduzidos[nome] = mapaCompleto.pipes[nome];
        } else {
            console.error(`AVISO: pipe "${nome}" não existe em mapa_pipefy.json — ignorado.`);
        }
    }

    return {
        pipes: pipesReduzidos,
        contatos: mapaCompleto.contatos || null,
        empresas: mapaCompleto.empresas || null,
        membros: mapaCompleto.membros || {}
    };
}

function main() {
    let mapaCompleto;
    try {
        mapaCompleto = require("../mapa_pipefy.json");
    } catch (e) {
        console.error("ERRO: mapa_pipefy.json não encontrado na raiz do projeto.");
        process.exit(1);
    }

    const { PIPEFY_PIPES_PORTAL } = require("../src/config/pipefyConstants");
    const reduzido = montarMapaReduzido(mapaCompleto, PIPEFY_PIPES_PORTAL);

    const json = JSON.stringify(reduzido);
    console.log(`\nCole este valor em PIPEFY_MAPA_JSON (Vercel → Environment Variables):\n`);
    console.log(json);
    console.log(`\nTamanho: ${json.length} caracteres (mapa completo tinha ${JSON.stringify(mapaCompleto).length}).`);
}

module.exports = { montarMapaReduzido };

if (require.main === module) main();
