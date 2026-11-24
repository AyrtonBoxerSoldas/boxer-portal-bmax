// Pré-aquecimento do cache do Pipefy (Postgres: bmax_pipefy_cache_cards/
// bmax_pipefy_cache_estado) ANTES de ligar CRM_PROVIDER=pipefy em produção.
//
// Por quê: a primeira leitura de um pipe com cache frio é uma leitura
// COMPLETA (allCardsInPipe, sem filtro de data) — com o CRM BOXER SOLDAS já
// tendo 7.640 cards (achado 19/11/2026), essa leitura levou ~94s rodando
// sem limite de tempo. Na Vercel, `vercel.json` define `maxDuration: 60` —
// a função é matada antes de terminar, a requisição nunca recebe resposta, e
// o painel mostra 0 leads (sem erro visível). Rodando esse script UMA VEZ
// localmente (sem o limite de 60s da Vercel), a leitura completa dos 4 pipes
// ativos (CRM BOXER SOLDAS, BMAX, REVENDA - INTERNO, FUNIL SDR — os mesmos
// da Consulta de Lead do Motor, Fase 7) é feita e persistida no banco; depois
// disso, a primeira requisição real na Vercel encontra o cache já quente
// (carregarCacheDoBanco) e só faz leituras INCREMENTAIS, rápidas.
//
// Pré-requisito: as tabelas de cache precisam existir (rodar antes, uma
// vez, se ainda não rodou):
//   node scripts/create-pipefy-cache-tables.js
//
// Uso (aponte pra produção só nesta chamada, sem alterar seu .env local):
//   DATABASE_URL="<url de produção>" DB_DIALECT=postgres PIPEFY_TOKEN="<token>" \
//     node scripts/pre-aquecer-cache-pipefy.js
//
// PIPEFY_MAPA_JSON também pode ser passado (mesmo valor usado na Vercel);
// na ausência dele, cai no mapa_pipefy.json local (se existir e já tiver os
// 4 pipes) — mesmo fallback que pipefyConstants.js já usa.
require("dotenv").config({ quiet: true });

async function main() {
    const { fetchAllCardsConsultaLeadPipefy } = require("../src/services/pipefyLeads.service");

    console.log("Iniciando leitura completa dos 4 pipes ativos (CRM BOXER SOLDAS, BMAX, REVENDA - INTERNO, FUNIL SDR)...");
    console.log("Isso pode levar alguns minutos na primeira vez — sem problema, não há limite de tempo aqui.");
    const inicio = Date.now();

    const deals = await fetchAllCardsConsultaLeadPipefy();

    const porPipe = {};
    for (const d of deals) porPipe[d._pipelineNome] = (porPipe[d._pipelineNome] || 0) + 1;

    const duracaoSeg = ((Date.now() - inicio) / 1000).toFixed(1);
    console.log(`\nOK: cache pré-aquecido em ${duracaoSeg}s.`);
    console.log(`Total de cards lidos: ${deals.length}`);
    console.log("Por pipe:", JSON.stringify(porPipe, null, 2));
    console.log("\nAs próximas leituras (inclusive na Vercel) vão encontrar o cache já gravado no banco e fazer só leituras incrementais.");
}

main()
    .then(() => process.exit(0))
    .catch(e => {
        console.error("ERRO:", e.message);
        console.error(e.stack);
        process.exit(1);
    });
