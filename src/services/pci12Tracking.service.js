const { sequelize } = require("../database");
const { QueryTypes } = require("sequelize");

// Rastreia a troca automática de responsável (owner) no RD Station enquanto
// um lead fica pendente de definição de caminho no PCI12. Regra (definida
// por André, 14/09/2026): ao detectar um PCI12 novo, o responsável muda para
// André (RD_OWNERS["Revenda"]) até a revenda escolher o caminho ou até 48h
// passarem sem resposta — nesse caso o responsável volta para quem era o
// dono original do lead antes da troca.

// Retorna true só quando o INSERT de fato aconteceu (deal ainda não estava
// rastreado) — usado pelo chamador pra decidir se deve trocar o owner_id no
// RD agora (evita repetir a troca a cada rodada do cron pro mesmo deal).
async function registrarTroca(dealId, ownerOriginalId, ownerOriginalNome) {
    const rows = await sequelize.query(
        `INSERT INTO bmax_pci12_tracking (deal_id, owner_original_id, owner_original_nome)
         VALUES (:dealId, :ownerOriginalId, :ownerOriginalNome)
         ON CONFLICT (deal_id) DO NOTHING
         RETURNING deal_id`,
        { replacements: { dealId, ownerOriginalId, ownerOriginalNome: ownerOriginalNome || null }, type: QueryTypes.SELECT }
    );
    return rows.length > 0;
}

async function buscarPendentes() {
    return sequelize.query(
        `SELECT deal_id, owner_original_id, owner_original_nome, detectado_em, email_24h_enviado_em
         FROM bmax_pci12_tracking
         WHERE resolvido_em IS NULL AND revertido_em IS NULL`,
        { type: QueryTypes.SELECT }
    );
}

async function marcarEmail24hEnviado(dealId) {
    await sequelize.query(
        `UPDATE bmax_pci12_tracking SET email_24h_enviado_em = now() WHERE deal_id = :dealId`,
        { replacements: { dealId }, type: QueryTypes.UPDATE }
    );
}

async function marcarRevertido(dealId) {
    await sequelize.query(
        `UPDATE bmax_pci12_tracking SET revertido_em = now() WHERE deal_id = :dealId`,
        { replacements: { dealId }, type: QueryTypes.UPDATE }
    );
}

async function marcarResolvido(dealId) {
    await sequelize.query(
        `UPDATE bmax_pci12_tracking SET resolvido_em = now() WHERE deal_id = :dealId AND resolvido_em IS NULL`,
        { replacements: { dealId }, type: QueryTypes.UPDATE }
    );
}

module.exports = {
    registrarTroca,
    buscarPendentes,
    marcarEmail24hEnviado,
    marcarRevertido,
    marcarResolvido
};
