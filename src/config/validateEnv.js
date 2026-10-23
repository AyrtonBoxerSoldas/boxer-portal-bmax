const { logger } = require("../logger");

const REQUIRED = [
    "RD_CRM_TOKEN",
    "JWT_SECRET",
    "SUPABASE_ANON_KEY_SISTEMAS"
];

const REQUIRED_DB = [
    "DATABASE_URL"
];

function validateEnv() {
    const missing = [];

    REQUIRED.forEach(key => {
        if (!process.env[key]) missing.push(key);
    });

    // CRM_PROVIDER=pipefy liga o lado Pipefy (ainda desativado por padrão —
    // ver guia_bmax_pipefy.md e rd.leads.service.js). RD_CRM_TOKEN continua
    // exigido sempre: mesmo com a flag ligada, boa parte do arquivo
    // (sync de picklist, Consulta de Lead, etc.) sempre chama o RD.
    if (process.env.CRM_PROVIDER === "pipefy") {
        if (!process.env.PIPEFY_TOKEN) {
            missing.push("PIPEFY_TOKEN");
        }
        // mapa_pipefy.json está no .gitignore (tem e-mail de funcionário) —
        // não chega no deploy da Vercel. Em produção, a configuração só pode
        // vir de PIPEFY_MAPA_JSON (ver pipefyConstants.js); o arquivo local
        // é só pra desenvolvimento, então aqui só confirmamos que ALGUMA das
        // duas fontes resultou num pipe BMAX configurado.
        const { PIPEFY_PIPE_BMAX, PIPEFY_PIPES_PORTAL, pipeConfig } = require("./pipefyConstants");
        if (!process.env.PIPEFY_MAPA_JSON && !PIPEFY_PIPE_BMAX) {
            missing.push("PIPEFY_MAPA_JSON (ou mapa_pipefy.json local, com pipes.BMAX.id)");
        } else if (!PIPEFY_PIPE_BMAX) {
            missing.push("pipes.BMAX.id dentro de PIPEFY_MAPA_JSON/mapa_pipefy.json");
        }
        // BMAX é sempre exigido à parte (createLeadPipefy/resolverCardId usam
        // direto, independente do painel) — além disso, cada pipe listado em
        // PIPEFY_PIPES_PORTAL (painel de leads, Tarefa 11) precisa ter seu
        // próprio id configurado, senão fetchAllDealsPipefy falha ao tentar
        // listar um pipe inexistente.
        PIPEFY_PIPES_PORTAL.forEach(nomePipe => {
            if (nomePipe !== "BMAX" && !pipeConfig(nomePipe).id) {
                missing.push(`pipes.${nomePipe}.id dentro de PIPEFY_MAPA_JSON/mapa_pipefy.json (PIPEFY_PIPES_PORTAL inclui "${nomePipe}")`);
            }
        });

        // REVENDA - INTERNO não alimenta o painel, mas renomearRevendaNoRD/
        // reatribuirRepresentanteDaRevendaNoRD (Tarefa 9) sempre varrem esse
        // pipe também — sem avisar, uma produção com o mapa reduzido errado
        // (gerado antes da correção do script, Tarefa A4) só descobriria o
        // problema quando alguém tentasse renomear uma revenda. Só aviso, não
        // bloqueia a inicialização (2º adendo, 23/10/2026).
        if (!pipeConfig("REVENDA - INTERNO").id) {
            logger.warn({ message: "CRM_PROVIDER=pipefy sem o pipe REVENDA - INTERNO configurado em PIPEFY_MAPA_JSON/mapa_pipefy.json — renomear/reatribuir revenda vão falhar" });
        }
    }

    const hasDbUrl = !!process.env.DATABASE_URL;
    const hasDbParts = process.env.DB_HOST && process.env.DB_NAME && process.env.DB_USER;

    if (!hasDbUrl && !hasDbParts) {
        missing.push("DATABASE_URL (ou DB_HOST+DB_NAME+DB_USER)");
    }

    if (missing.length > 0) {
        logger.error({ message: "Variáveis de ambiente faltando", missing });
        if (process.env.NODE_ENV === "production") {
            process.exit(1);
        }
    }
}

module.exports = { validateEnv };
