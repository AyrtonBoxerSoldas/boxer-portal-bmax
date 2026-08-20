const { sequelize } = require("../database");
const { QueryTypes } = require("sequelize");

async function getSaldo(revenda) {
    const rows = await sequelize.query(
        `SELECT saldo FROM bmax_saldo WHERE revenda = :revenda LIMIT 1`,
        { replacements: { revenda }, type: QueryTypes.SELECT }
    );
    return rows.length ? Number(rows[0].saldo) : 0;
}

async function upsertSaldo(revenda, novoSaldo) {
    await sequelize.query(
        `INSERT INTO bmax_saldo (revenda, saldo, atualizado_em)
         VALUES (:revenda, :saldo, NOW())
         ON CONFLICT (revenda)
         DO UPDATE SET saldo = :saldo, atualizado_em = NOW()`,
        { replacements: { revenda, saldo: novoSaldo }, type: QueryTypes.INSERT }
    );
}

async function creditarCashback(revenda, valor, descricao, leadId) {
    const saldoAtual = await getSaldo(revenda);
    const novoSaldo = Number((saldoAtual + valor).toFixed(2));
    const expiraEm = new Date(Date.now() + 180 * 24 * 60 * 60 * 1000).toISOString();

    await sequelize.query(
        `INSERT INTO bmax_transacoes (revenda, tipo, valor, descricao, lead_id, saldo_apos, expira_em)
         VALUES (:revenda, 'credito', :valor, :descricao, :leadId, :saldoApos, :expiraEm)`,
        { replacements: { revenda, valor, descricao, leadId, saldoApos: novoSaldo, expiraEm }, type: QueryTypes.INSERT }
    );

    await upsertSaldo(revenda, novoSaldo);
    return novoSaldo;
}

async function debitarCashback(revenda, valor, descricao, saqueId) {
    const saldoAtual = await getSaldo(revenda);
    const novoSaldo = Number((saldoAtual - valor).toFixed(2));

    await sequelize.query(
        `INSERT INTO bmax_transacoes (revenda, tipo, valor, descricao, saque_id, saldo_apos)
         VALUES (:revenda, 'debito', :valor, :descricao, :saqueId, :saldoApos)`,
        { replacements: { revenda, valor, descricao, saqueId, saldoApos: novoSaldo }, type: QueryTypes.INSERT }
    );

    await upsertSaldo(revenda, novoSaldo);
    return novoSaldo;
}

async function getExtrato(revenda) {
    return sequelize.query(
        `SELECT id, tipo, valor, descricao, lead_id, saque_id, saldo_apos, expira_em, criado_em
         FROM bmax_transacoes WHERE revenda = :revenda ORDER BY criado_em DESC LIMIT 200`,
        { replacements: { revenda }, type: QueryTypes.SELECT }
    );
}

async function getExpirandoEm(dias) {
    const desde = new Date();
    const ate = new Date(Date.now() + dias * 24 * 60 * 60 * 1000);
    return sequelize.query(
        `SELECT id, revenda, valor, descricao, expira_em, criado_em
         FROM bmax_transacoes
         WHERE tipo = 'credito' AND expira_em IS NOT NULL
           AND expira_em > :desde AND expira_em <= :ate
           AND NOT EXISTS (
               SELECT 1 FROM bmax_transacoes t2
               WHERE t2.descricao LIKE '%Expirado:%' AND t2.descricao LIKE '%' || bmax_transacoes.id::text || '%'
           )
         ORDER BY expira_em ASC`,
        { replacements: { desde: desde.toISOString(), ate: ate.toISOString() }, type: QueryTypes.SELECT }
    );
}

async function processarExpirados() {
    const agora = new Date().toISOString();
    const expirados = await sequelize.query(
        `SELECT id, revenda, valor, descricao, expira_em
         FROM bmax_transacoes
         WHERE tipo = 'credito' AND expira_em IS NOT NULL AND expira_em <= :agora
           AND NOT EXISTS (
               SELECT 1 FROM bmax_transacoes t2
               WHERE t2.descricao LIKE 'Expirado: credito ' || bmax_transacoes.id::text
           )`,
        { replacements: { agora }, type: QueryTypes.SELECT }
    );

    const resultados = [];
    for (const tx of expirados) {
        await debitarCashback(tx.revenda, Number(tx.valor), `Expirado: credito ${tx.id}`, null);
        resultados.push({ id: tx.id, revenda: tx.revenda, valor: tx.valor });
    }
    return resultados;
}

async function getCreditosProximosVencimento(revenda) {
    const em30dias = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
    return sequelize.query(
        `SELECT id, valor, descricao, expira_em, criado_em
         FROM bmax_transacoes
         WHERE tipo = 'credito' AND revenda = :revenda
           AND expira_em IS NOT NULL AND expira_em <= :em30dias AND expira_em > NOW()
           AND NOT EXISTS (
               SELECT 1 FROM bmax_transacoes t2
               WHERE t2.descricao LIKE 'Expirado: credito ' || bmax_transacoes.id::text
           )
         ORDER BY expira_em ASC`,
        { replacements: { revenda, em30dias }, type: QueryTypes.SELECT }
    );
}

function isGrupo(revenda) {
    return revenda && revenda.includes("Luitex");
}

function grupoPattern(revenda) {
    if (revenda.includes("Luitex")) return "Luitex%";
    return revenda;
}

async function getSaldoGrupo(revenda) {
    if (!isGrupo(revenda)) return getSaldo(revenda);
    const rows = await sequelize.query(
        `SELECT COALESCE(SUM(saldo), 0) as total FROM bmax_saldo WHERE revenda LIKE :pattern`,
        { replacements: { pattern: grupoPattern(revenda) }, type: QueryTypes.SELECT }
    );
    return Number(rows[0].total);
}

async function getExtratoGrupo(revenda) {
    if (!isGrupo(revenda)) return getExtrato(revenda);
    return sequelize.query(
        `SELECT id, tipo, valor, descricao, lead_id, saque_id, saldo_apos, expira_em, criado_em, revenda
         FROM bmax_transacoes WHERE revenda LIKE :pattern ORDER BY criado_em DESC LIMIT 200`,
        { replacements: { pattern: grupoPattern(revenda) }, type: QueryTypes.SELECT }
    );
}

async function getCreditosProximosVencimentoGrupo(revenda) {
    if (!isGrupo(revenda)) return getCreditosProximosVencimento(revenda);
    const em30dias = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
    return sequelize.query(
        `SELECT id, valor, descricao, expira_em, criado_em, revenda
         FROM bmax_transacoes
         WHERE tipo = 'credito' AND revenda LIKE :pattern
           AND expira_em IS NOT NULL AND expira_em <= :em30dias AND expira_em > NOW()
           AND NOT EXISTS (
               SELECT 1 FROM bmax_transacoes t2
               WHERE t2.descricao LIKE 'Expirado: credito ' || bmax_transacoes.id::text
           )
         ORDER BY expira_em ASC`,
        { replacements: { pattern: grupoPattern(revenda), em30dias }, type: QueryTypes.SELECT }
    );
}

module.exports = { getSaldo, getSaldoGrupo, upsertSaldo, creditarCashback, debitarCashback, getExtrato, getExtratoGrupo, getExpirandoEm, processarExpirados, getCreditosProximosVencimento, getCreditosProximosVencimentoGrupo };
