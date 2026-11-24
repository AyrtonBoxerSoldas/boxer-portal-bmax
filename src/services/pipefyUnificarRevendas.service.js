const { sbSistemasService } = require("../config/supabaseSistemas");
const { logger } = require("../logger");
const { norm, codigoDe } = require("./codigoUnico.service");
const { PIPEFY_PIPE_BMAX, PIPEFY_CAMPOS, pipeConfig, revendaParaPipefy, revendaDoPipefy } = require("../config/pipefyConstants");
const { getStartFormFields, updatePhaseField, findCardsByFieldValue, updateFieldEmVariosCards } = require("./pipefy.service");

// Unificação do campo "Revenda/Loja" do Pipefy (23/11/2026): a lista de opções passa a ter SÓ o nome único de cada loja ativa
// (nome_rd, senão nome) + "Sem Revenda". Cada opção antiga é traduzida pelo código único (apelidos), os cards são renomeados e só
// DEPOIS a opção sai da lista (nunca com cards ainda usando). Opção antiga que não resolve para nenhuma loja e tem card fica na lista
// e é reportada. Idempotente e em fatias (a função da Vercel tem 60 s): chamar de novo continua de onde parou.
const PIPES = ["BMAX", "REVENDA - INTERNO", "CRM BOXER SOLDAS"];
const ROTULO = "Revenda/Loja";

function configDoPipe(nome) { return nome === "BMAX" ? { id: PIPEFY_PIPE_BMAX, campos: PIPEFY_CAMPOS } : pipeConfig(nome); }

async function nomesEsperados() {
    const lojas = await sbSistemasService("/comercial_revendas_bmax?ativo=eq.true&select=nome,nome_rd,grupo_id");
    const grupos = await sbSistemasService("/comercial_bmax_grupos?select=id,nome");
    const set = new Map();
    for (const l of lojas) { const n = String(l.nome_rd || l.nome || "").trim(); if (n) set.set(norm(n), n); }
    return { esperados: set, grupos: new Map(grupos.map(g => [g.id, g.nome])) };
}

// nome antigo -> nome único (ou null)
async function traduzir(opcao, nomePipe, esp) {
    const k = norm(revendaDoPipefy(nomePipe, opcao));
    if (esp.esperados.has(k)) return esp.esperados.get(k);              // já é um nome correto (só difere em caixa/espaço)
    const c = await codigoDe(opcao, "revenda");
    if (c.grupo_id && esp.grupos.get(c.grupo_id) && esp.esperados.has(norm(esp.grupos.get(c.grupo_id)))) return esp.esperados.get(norm(esp.grupos.get(c.grupo_id)));
    if (c.revenda_id) {
        const [loja] = await sbSistemasService(`/comercial_revendas_bmax?id=eq.${c.revenda_id}&select=nome,nome_rd,ativo`);
        if (loja && loja.ativo) return String(loja.nome_rd || loja.nome).trim();
    }
    return null;
}

async function unificarPipe(nomePipe, { aplicar = false, orcamentoMs = 40000 } = {}) {
    const t0 = Date.now(); const cfg = configDoPipe(nomePipe);
    const campoId = cfg.campos && cfg.campos[ROTULO];
    if (!cfg.id || !campoId) return { pipe: nomePipe, pulado: true };
    const campo = (await getStartFormFields(cfg.id)).find(c => c.id === campoId);
    if (!campo) return { pipe: nomePipe, pulado: true, motivo: "campo não encontrado no formulário inicial" };
    const esp = await nomesEsperados();
    const opcoes = campo.options || [];
    const esperadosPipe = new Set([...esp.esperados.values(), "Sem Revenda"].map(n => norm(revendaParaPipefy(nomePipe, n))));
    const legado = opcoes.filter(o => !esperadosPipe.has(norm(o)));
    const faltam = [...esp.esperados.values(), "Sem Revenda"].map(n => revendaParaPipefy(nomePipe, n)).filter(n => !opcoes.some(o => norm(o) === norm(n)));
    const relatorio = { pipe: nomePipe, opcoesHoje: opcoes.length, esperadas: esperadosPipe.size, faltam, legado: legado.length, opcoesAntes: opcoes, itens: [], removiveis: [], renomeados: 0, falharam: 0 };

    // 1) acrescenta as que faltam (um único updatePhaseField) — só na primeira fatia
    let opcoesAtuais = opcoes;
    if (aplicar && faltam.length) { opcoesAtuais = [...opcoes, ...faltam]; await updatePhaseField(campo.id, campo.uuid, campo.label, opcoesAtuais); relatorio.acrescentadas = faltam.length; }

    // 2) traduz todas (em memória); processa primeiro as que têm loja correspondente, depois as sem correspondência
    const traduzidas = [];
    for (const antiga of legado) { const alvo = await traduzir(antiga, nomePipe, esp); traduzidas.push({ antiga, alvo, alvoPipe: alvo ? revendaParaPipefy(nomePipe, alvo) : null }); }
    traduzidas.sort((x, y) => (y.alvoPipe ? 1 : 0) - (x.alvoPipe ? 1 : 0));
    let feitos = 0;
    for (const t of traduzidas) {
        if (Date.now() - t0 > orcamentoMs) break;
        const cards = await findCardsByFieldValue(cfg.id, campoId, t.antiga);
        const item = { antiga: t.antiga, alvo: t.alvoPipe, cards: cards.length };
        if (aplicar && t.alvoPipe && cards.length) {
            const r = await updateFieldEmVariosCards(campoId, t.alvoPipe, cards.map(c => c.id));
            item.renomeados = r.atualizados; item.falharam = r.falharam;
            relatorio.renomeados += r.atualizados; relatorio.falharam += r.falharam;
            if (!r.falharam) item.removivel = true;
        } else if (!cards.length) item.removivel = true;      // sem nenhum card: pode sair (traduzida ou não)
        else if (!t.alvoPipe) item.mantida = "sem loja correspondente e com cards";
        relatorio.itens.push(item); feitos++;
    }
    relatorio.restantes = traduzidas.length - feitos;

    // 3) tira da lista as opções verificadas (sem card e/ou já renomeadas)
    const sair = new Set(relatorio.itens.filter(x => x.removivel).map(x => x.antiga));
    relatorio.removiveis = [...sair];
    if (aplicar && sair.size) {
        const novas = opcoesAtuais.filter(o => !sair.has(o));
        await updatePhaseField(campo.id, campo.uuid, campo.label, novas);
        relatorio.removidas = sair.size; relatorio.opcoesDepois = novas.length;
    }
    relatorio.ms = Date.now() - t0;
    logger.info({ message: "pipefyUnificarRevendas", pipe: nomePipe, aplicar, ...{ legado: relatorio.legado, renomeados: relatorio.renomeados, falharam: relatorio.falharam, restantes: relatorio.restantes } });
    return relatorio;
}

module.exports = { unificarPipe, PIPES };
