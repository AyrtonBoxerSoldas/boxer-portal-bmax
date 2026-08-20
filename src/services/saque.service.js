const { sequelize } = require("../database");
const { QueryTypes } = require("sequelize");
const { getSaldo, debitarCashback } = require("./saldo.service");

function gerarCodigoCheque() {
    const ano = new Date().getFullYear();
    const rand = String(Math.floor(Math.random() * 99999)).padStart(5, "0");
    return `BMAX-${ano}-${rand}`;
}

async function solicitarSaque(revenda, representante, valor, tipoUso) {
    const saldo = await getSaldo(revenda);
    if (valor > saldo) {
        throw new Error(`Saldo insuficiente. Disponivel: R$ ${saldo.toFixed(2)}`);
    }
    if (valor <= 0) {
        throw new Error("Valor deve ser maior que zero");
    }
    if (!["desconto", "bonificacao"].includes(tipoUso)) {
        throw new Error("Tipo de uso deve ser 'desconto' ou 'bonificacao'");
    }

    const rows = await sequelize.query(
        `INSERT INTO bmax_saques (revenda, representante, valor, tipo_uso, status)
         VALUES (:revenda, :representante, :valor, :tipoUso, 'pendente')
         RETURNING id, criado_em`,
        { replacements: { revenda, representante, valor, tipoUso }, type: QueryTypes.INSERT }
    );

    return rows[0] || rows;
}

async function aprovarSaque(saqueId, representante) {
    const rows = await sequelize.query(
        `SELECT * FROM bmax_saques WHERE id = :id LIMIT 1`,
        { replacements: { id: saqueId }, type: QueryTypes.SELECT }
    );
    if (!rows.length) throw new Error("Saque nao encontrado");
    const saque = rows[0];

    if (saque.status !== "pendente") throw new Error(`Saque ja esta ${saque.status}`);

    const saldo = await getSaldo(saque.revenda);
    if (saque.valor > saldo) throw new Error(`Saldo insuficiente. Disponivel: R$ ${saldo.toFixed(2)}`);

    const codigo = gerarCodigoCheque();
    const expiraEm = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();

    await sequelize.query(
        `UPDATE bmax_saques SET status = 'aprovado', codigo_cheque = :codigo, aprovado_em = NOW(), expira_em = :expiraEm
         WHERE id = :id`,
        { replacements: { id: saqueId, codigo, expiraEm }, type: QueryTypes.UPDATE }
    );

    const tipoLabel = saque.tipo_uso === "desconto" ? "Desconto 5%" : "Bonificacao 10%";
    await debitarCashback(saque.revenda, saque.valor, `Saque ${codigo} (${tipoLabel})`, saqueId);

    return { ...saque, status: "aprovado", codigo_cheque: codigo, expira_em: expiraEm };
}

async function recusarSaque(saqueId, representante, motivo) {
    const rows = await sequelize.query(
        `SELECT * FROM bmax_saques WHERE id = :id LIMIT 1`,
        { replacements: { id: saqueId }, type: QueryTypes.SELECT }
    );
    if (!rows.length) throw new Error("Saque nao encontrado");
    const saque = rows[0];

    if (saque.status !== "pendente") throw new Error(`Saque ja esta ${saque.status}`);

    await sequelize.query(
        `UPDATE bmax_saques SET status = 'recusado', motivo_recusa = :motivo WHERE id = :id`,
        { replacements: { id: saqueId, motivo: motivo || "Sem motivo informado" }, type: QueryTypes.UPDATE }
    );
}

async function marcarUtilizado(saqueId) {
    await sequelize.query(
        `UPDATE bmax_saques SET status = 'utilizado', utilizado_em = NOW() WHERE id = :id AND status = 'aprovado'`,
        { replacements: { id: saqueId }, type: QueryTypes.UPDATE }
    );
}

async function listarSaques(revenda, representante, role) {
    let where = "";
    const replacements = {};

    if (role === "revenda") {
        where = "WHERE s.revenda = :revenda";
        replacements.revenda = revenda;
    } else if (role === "representante") {
        where = "WHERE s.representante = :representante";
        replacements.representante = representante;
    }

    return sequelize.query(
        `SELECT s.* FROM bmax_saques s ${where} ORDER BY s.criado_em DESC LIMIT 100`,
        { replacements, type: QueryTypes.SELECT }
    );
}

module.exports = { solicitarSaque, aprovarSaque, recusarSaque, marcarUtilizado, listarSaques };
