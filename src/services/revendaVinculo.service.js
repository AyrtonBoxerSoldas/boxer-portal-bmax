// Vínculo REVENDA/LOJA (RD) -> login do Portal. Caso Heitor/Suprimig (28/10/2026): o card entrou no RD com
// o nome do ZEN ("31023, Heitor Nogueira...") e não com "Suprimig"; o login não via o lead e o robô de 48h
// aplicou o 12b sem a revenda saber. Um nome de revenda só é "vinculado" se algum login do Portal o enxerga
// (Revendas.name) ou se pertence a um grupo (bmax_grupos) cujo nome é o de um login.
const { QueryTypes } = require("sequelize");
const db = require("../database");

const n = s => String(s || "").trim().toLowerCase();
const TTL_MS = 5 * 60 * 1000;
let _cache = { ts: 0, set: null, ids: new Set() };

async function nomesComLogin() {
    if (_cache.set && Date.now() - _cache.ts < TTL_MS) return _cache.set;
    const logins = await db.sequelize.query(
        `SELECT r.name, r.grupo, r.revenda_id FROM "Revendas" r JOIN "Users" u ON u.id = r.user_id WHERE u.role = 'revenda'`, { type: QueryTypes.SELECT });
    const grupos = await db.sequelize.query(`SELECT revenda_rd, grupo FROM bmax_grupos`, { type: QueryTypes.SELECT });
    const set = new Set(logins.map(x => n(x.name)).filter(Boolean));
    logins.filter(x => x.grupo).forEach(x => grupos.filter(g => g.grupo === x.grupo).forEach(g => set.add(n(g.revenda_rd))));
    _cache = { ts: Date.now(), set, ids: new Set(logins.map(x => x.revenda_id).filter(Boolean)) };
    return set;
}

// true se algum login do Portal enxerga leads com esse nome de revenda
async function revendaTemLogin(nome) {
    const k = n(nome);
    if (!k) return false;
    if ((await nomesComLogin()).has(k)) return true;
    return temLoginPeloCodigo(nome);
}

// Código único (etapa 4/5): o nome do card pode ser um apelido (ZEN, Pipefy, nome antigo) da loja ou do grupo. A loja tem login se ela
// mesma tem, ou se alguma loja do mesmo grupo tem (o login do grupo enxerga todas as lojas do grupo).
async function temLoginPeloCodigo(nome) {
    try {
        const { codigoDe, estruturaGrupos } = require("./codigoUnico.service");
        const c = await codigoDe(nome, "revenda");
        if (!c.revenda_id && !c.grupo_id) return false;
        const ids = _cache.ids || new Set();
        const { lojasDoGrupo, lojaGrupo } = await estruturaGrupos();
        const gid = c.grupo_id || lojaGrupo.get(c.revenda_id);
        if (c.revenda_id && ids.has(c.revenda_id)) return true;
        return !!gid && (lojasDoGrupo.get(gid) || []).some(id => ids.has(id));
    } catch (_) { return false; }
}

const SEM_REVENDA = new Set(["", "?????", "?", "vazio", "n/d", "sem revenda"]);

// nome presente (não é "sem revenda") mas sem login que o veja
async function revendaSemLogin(nome) {
    if (SEM_REVENDA.has(n(nome))) return false;
    return !(await revendaTemLogin(nome));
}

module.exports = { nomesComLogin, revendaTemLogin, revendaSemLogin };
