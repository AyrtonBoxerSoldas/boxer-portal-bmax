const { sequelize } = require("../database");
const { QueryTypes } = require("sequelize");
const { sbSistemasService } = require("../config/supabaseSistemas");
const { logger } = require("../logger");

// Padrão de GRUPO (etapa 1 do código único, 17/11/2026):
//   - O CADASTRO da loja (comercial_revendas_bmax.grupo) é a fonte. O grupo existe em comercial_bmax_grupos (id) e a loja guarda
//     o grupo_id. Grupo só faz sentido com 2+ lojas: loja única fica SEM grupo.
//   - O que o Portal usa para somar saldo do grupo e filtrar leads (bmax_grupos: revenda_rd -> grupo) e o grupo do login
//     (Revendas.grupo) passam a ser DERIVADOS do cadastro por esta função. Antes, cadastrar uma filial com grupo gravava só o
//     texto no cadastro e a filial ficava fora de bmax_grupos: o login do grupo não via os leads nem o saldo dela.
// Nunca apaga linhas de bmax_grupos nem remove grupo de login (sessões abertas levam o grupo no token): só inclui/atualiza.

const k = s => String(s || "").trim().toLowerCase().replace(/\s+/g, " ");

async function sincronizarGrupoDaLoja(lojaId) {
    const loja = (await sbSistemasService(`/comercial_revendas_bmax?id=eq.${encodeURIComponent(lojaId)}&select=id,nome,nome_rd,grupo,grupo_id,user_id,ativo`))[0];
    if (!loja) return { ok: false, motivo: "loja não encontrada" };
    const grupoTxt = String(loja.grupo || "").trim().replace(/\s+/g, " ");

    // Sem grupo: só zera o vínculo do cadastro (não mexe em bmax_grupos nem no login).
    if (!grupoTxt) {
        if (loja.grupo_id) await sbSistemasService(`/comercial_revendas_bmax?id=eq.${loja.id}`, "PATCH", { grupo_id: null });
        return { ok: true, grupo: null };
    }

    // Grupo canônico (sem duplicar por maiúscula/minúscula); cria se for novo.
    const existentes = await sbSistemasService("/comercial_bmax_grupos?select=id,nome");
    let g = (Array.isArray(existentes) ? existentes : []).find(x => k(x.nome) === k(grupoTxt));
    let criado = false;
    if (!g) {
        const r = await sbSistemasService("/comercial_bmax_grupos", "POST", { nome: grupoTxt });
        g = Array.isArray(r) ? r[0] : r; criado = true;
    }
    if (loja.grupo !== g.nome || loja.grupo_id !== g.id) {
        await sbSistemasService(`/comercial_revendas_bmax?id=eq.${loja.id}`, "PATCH", { grupo: g.nome, grupo_id: g.id });
    }

    // Derivados: bmax_grupos (nome da loja no RD -> grupo) e login da loja.
    const nomeRd = String(loja.nome_rd || loja.nome || "").trim();
    if (nomeRd && loja.ativo !== false) {
        await sequelize.query(
            `INSERT INTO bmax_grupos (revenda_rd, grupo) VALUES (:rd, :g)
             ON CONFLICT (revenda_rd) DO UPDATE SET grupo = EXCLUDED.grupo`,
            { replacements: { rd: nomeRd, g: g.nome }, type: QueryTypes.INSERT }
        );
    }
    if (loja.user_id) {
        await sequelize.query(`UPDATE "Revendas" SET grupo = :g WHERE user_id = :u`, { replacements: { g: g.nome, u: loja.user_id }, type: QueryTypes.UPDATE });
    }
    logger.info({ message: "Grupo da loja sincronizado", loja: nomeRd, grupo: g.nome, grupoCriado: criado });
    return { ok: true, grupo: g.nome, grupoCriado: criado };
}

module.exports = { sincronizarGrupoDaLoja };
