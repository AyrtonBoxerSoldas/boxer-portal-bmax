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

module.exports = { getSaldo, upsertSaldo, creditarCashback, debitarCashback, getExtrato };
