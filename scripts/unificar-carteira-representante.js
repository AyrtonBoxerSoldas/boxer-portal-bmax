// Unifica duas carteiras de comissão do MESMO representante (09/10/2026).
// Move todas as transações de `de` para `para`, recalcula o saldo corrido (saldo_apos) na
// ordem cronológica, atualiza bmax_saldo e remove a carteira antiga. Tudo numa transação.
//   node scripts/unificar-carteira-representante.js "Caio P Mancini" "Caio Tito" [--aplicar]
require("dotenv").config({ quiet: true });
const fs = require("fs");
const { sequelize } = require("../src/database");
const { QueryTypes } = require("sequelize");

(async () => {
    const [de, para] = process.argv.slice(2).filter(a => !a.startsWith("--"));
    const aplicar = process.argv.includes("--aplicar");
    if (!de || !para || de === para) { console.error("uso: <de> <para> [--aplicar]"); process.exit(1); }
    const TIPO = "representante";

    const trans = await sequelize.query(
        `SELECT * FROM bmax_transacoes WHERE tipo_agente = :TIPO AND revenda IN (:nomes) ORDER BY criado_em, id`,
        { replacements: { TIPO, nomes: [de, para] }, type: QueryTypes.SELECT });
    const saldos = await sequelize.query(
        `SELECT * FROM bmax_saldo WHERE tipo_agente = :TIPO AND revenda IN (:nomes)`,
        { replacements: { TIPO, nomes: [de, para] }, type: QueryTypes.SELECT });
    fs.writeFileSync(`scripts/backups/carteira-${de.replace(/\W+/g, "_")}-${Date.now()}.json`, JSON.stringify({ trans, saldos }, null, 1));

    let corrido = 0; const novos = trans.map(t => { corrido = Number((corrido + (t.tipo === "credito" ? Number(t.valor) : -Number(t.valor))).toFixed(2)); return { id: t.id, saldo_apos: corrido }; });
    const saldoAntes = saldos.map(s => `${s.revenda}=${s.saldo}`).join(" + ");
    console.log(`transações: ${trans.length} | saldos antes: ${saldoAntes} | saldo unificado: ${corrido}`);
    if (!aplicar) { console.log("(simulação — use --aplicar)"); process.exit(0); }

    await sequelize.transaction(async (t) => {
        await sequelize.query(`UPDATE bmax_transacoes SET revenda = :para WHERE tipo_agente = :TIPO AND revenda = :de`, { replacements: { para, TIPO, de }, transaction: t });
        for (const n of novos) await sequelize.query(`UPDATE bmax_transacoes SET saldo_apos = :s WHERE id = :id`, { replacements: { s: n.saldo_apos, id: n.id }, transaction: t });
        await sequelize.query(`INSERT INTO bmax_saldo (revenda, saldo, tipo_agente, atualizado_em) VALUES (:para, :s, :TIPO, NOW())
                               ON CONFLICT (tipo_agente, revenda) DO UPDATE SET saldo = :s, atualizado_em = NOW()`, { replacements: { para, s: corrido, TIPO }, transaction: t });
        await sequelize.query(`DELETE FROM bmax_saldo WHERE tipo_agente = :TIPO AND revenda = :de`, { replacements: { TIPO, de }, transaction: t });
    });
    const conf = await sequelize.query(`SELECT revenda, saldo FROM bmax_saldo WHERE tipo_agente = :TIPO AND revenda IN (:nomes)`, { replacements: { TIPO, nomes: [de, para] }, type: QueryTypes.SELECT });
    console.log("DEPOIS:", JSON.stringify(conf));
    process.exit(0);
})().catch(e => { console.error("ERRO", e.message); process.exit(1); });
