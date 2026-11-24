const { sbSistemasService } = require("../config/supabaseSistemas");
const { logger } = require("../logger");

// Resolvedor ÚNICO nome -> código (etapa 4 do código único, 19/11/2026).
// Cada revenda (loja), grupo e representante tem um código interno fixo (uuid). Os nomes (ZEN, RD, login, razão) são apelidos:
//   comercial_bmax_apelidos (entidade, entidade_id, origem, apelido_norm). O razão do cashback continua gravando o NOME (compatível
//   com todo leitor antigo) e agora grava também o CÓDIGO ao lado. Falha ao resolver NUNCA bloqueia o lançamento: grava sem código
//   e o robô de conferência avisa.
const norm = s => String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").trim().toLowerCase().replace(/\s+/g, " ");
const TTL_MS = 2 * 60 * 1000, MIN_RECARGA_MS = 20 * 1000;
let cache = { ts: 0, rev: new Map(), rep: new Map(), grp: new Map(), lojasDoGrupo: new Map() };

async function carregar(forcar = false) {
    if (!forcar && cache.ts && Date.now() - cache.ts < TTL_MS) return cache;
    const [apel, lojas, reps, grupos] = await Promise.all([
        sbSistemasService("/comercial_bmax_apelidos?select=entidade,entidade_id,apelido_norm&limit=5000"),
        sbSistemasService("/comercial_revendas_bmax?select=id,nome,nome_rd,ativo,grupo,grupo_id&order=ativo.desc"),
        sbSistemasService("/comercial_representantes_bmax?select=id,nome,rd_alias"),
        sbSistemasService("/comercial_bmax_grupos?select=id,nome")
    ]);
    const rev = new Map(), rep = new Map(), grp = new Map(), lojasDoGrupo = new Map();
    for (const g of (Array.isArray(grupos) ? grupos : [])) grp.set(norm(g.nome), g.id);
    for (const l of (Array.isArray(lojas) ? lojas : [])) if (l.grupo_id) { const a = lojasDoGrupo.get(l.grupo_id) || []; a.push(l.id); lojasDoGrupo.set(l.grupo_id, a); }
    for (const l of (Array.isArray(lojas) ? lojas : [])) for (const n of [l.nome_rd, l.nome]) { const k = norm(n); if (k && !rev.has(k)) rev.set(k, { entidade: "revenda", id: l.id }); }
    for (const a of (Array.isArray(apel) ? apel : [])) {
        if (a.entidade === "representante") { if (!rep.has(a.apelido_norm)) rep.set(a.apelido_norm, a.entidade_id); }
        else rev.set(a.apelido_norm, { entidade: a.entidade, id: a.entidade_id }); // apelido tem prioridade (resolve nomes do ZEN/razão e nomes de grupo)
    }
    for (const r of (Array.isArray(reps) ? reps : [])) for (const n of [r.nome, r.rd_alias]) { const k = norm(n); if (k && !rep.has(k)) rep.set(k, r.id); }
    cache = { ts: Date.now(), rev, rep, grp, lojasDoGrupo };
    return cache;
}

// Devolve { revenda_id, grupo_id, representante_id } (campos nulos quando não há entidade, ex.: vendedor_interno ou nome sem código)
async function codigoDe(nome, tipoAgente, opts = {}) {
    const vazio = { revenda_id: null, grupo_id: null, representante_id: null };
    try {
        if (!nome || (tipoAgente !== "revenda" && tipoAgente !== "representante")) return vazio;
        const k = norm(nome);
        let c = await carregar();
        const achar = () => tipoAgente === "representante" ? c.rep.get(k) : c.rev.get(k);
        let achou = achar();
        if (!achou && !opts.semRecarga && Date.now() - c.ts > MIN_RECARGA_MS) { c = await carregar(true); achou = achar(); } // loja/representante recém-criado
        if (!achou) return vazio;
        if (tipoAgente === "representante") return { ...vazio, representante_id: achou };
        return achou.entidade === "grupo" ? { ...vazio, grupo_id: achou.id } : { ...vazio, revenda_id: achou.id };
    } catch (e) {
        logger.warn({ message: "codigoDe: não foi possível resolver o código (lançamento segue só com o nome)", nome, tipoAgente, error: e.message });
        return vazio;
    }
}

// Código do grupo pelo NOME do grupo (o que o login e o token guardam) + códigos das lojas dele. Usado pelos leitores de cashback.
async function codigosDoGrupo(nomeGrupo) {
    const vazio = { grupoId: null, lojaIds: [] };
    try {
        if (!nomeGrupo) return vazio;
        const c = await carregar(); const gid = c.grp.get(norm(nomeGrupo)); if (!gid) return vazio;
        return { grupoId: gid, lojaIds: c.lojasDoGrupo.get(gid) || [] };
    } catch (e) { logger.warn({ message: "codigosDoGrupo falhou (leitura segue só por nome)", grupo: nomeGrupo, error: e.message }); return vazio; }
}

function limparCache() { cache = { ts: 0, rev: new Map(), rep: new Map(), grp: new Map(), lojasDoGrupo: new Map() }; }

module.exports = { codigoDe, codigosDoGrupo, limparCache, norm };
