const { sequelize } = require("../database");
const { QueryTypes } = require("sequelize");
const { getLeads, getCustomField } = require("./rd.leads.service");
const { sbSistemasService } = require("../config/supabaseSistemas");
const {
    RD_STAGE_VENDIDO, RD_STAGE_VENDA_EFETIVADA, RD_STAGE_ENTREGA_TECNICA,
    RD_STAGE_PERDIDO, RD_STAGE_EXCLUIDO, REVENDA_SEM_CREDITO
} = require("../config/constants");

// Módulo "Performance de Revendas" (admin). Somente leitura: junta cards do RD (leads/vendas), razão de cashback
// (bmax_transacoes) e o histórico do PCI12 (bmax_pci12_tracking, bmax_pci12a_prazo, AuditLogs). Devolve componentes
// ADITIVOS por loja — o front soma para virar grupo e recalcula as taxas (conversão, % 12a em aberto etc.).

const ETAPAS_VENDA = new Set([RD_STAGE_VENDIDO, RD_STAGE_VENDA_EFETIVADA, RD_STAGE_ENTREGA_TECNICA]);
const norm = s => String(s || "").trim().toLowerCase().replace(/\s+/g, " ");
const SEM_REVENDA = new Set(REVENDA_SEM_CREDITO.map(norm).concat([""]));

function etapaId(d) { return d.deal_stage ? d.deal_stage.id : null; }
function situacao(d) {
    if (ETAPAS_VENDA.has(etapaId(d)) && Number(d.amount_total || 0) > 0) return "venda";
    if (d.win === false || etapaId(d) === RD_STAGE_PERDIDO || etapaId(d) === RD_STAGE_EXCLUIDO) return "perdido";
    return "aberto";
}
const dentro = (data, de, ate) => {
    if (!de && !ate) return true;
    if (!data) return false;
    const t = new Date(data).getTime();
    if (de && t < de) return false;
    if (ate && t > ate) return false;
    return true;
};
const novaLinha = (nome) => ({
    nome, leads: 0, vendas: 0, valor: 0,
    cashback_gerado: 0, cashback_resgatado: 0, saldo: 0,
    pci12_recebidos: 0, dec12a_revenda: 0, dec12a_equipe: 0, dec12b_revenda: 0, dec12b_equipe: 0, auto12b: 0, aguardando: 0,
    horas_soma: 0, horas_n: 0,
    a12_assumidos: 0, a12_vendidos: 0, a12_valor: 0, a12_perdidos: 0, a12_abertos: 0,
    detalhes: []
});

// de/ate: timestamps (ms) ou null. Leads contam pela data de CRIAÇÃO; vendas pela data de FECHAMENTO;
// cashback pela data do lançamento; PCI12 pela data do evento (detecção/escolha, ou criação do card).
async function calcularPerformance({ de = null, ate = null } = {}) {
    const [leads, cadastro, ledger, saldos, tracking, prazo12a, escolhas] = await Promise.all([
        getLeads("admin", "adm"),
        sbSistemasService("/comercial_revendas_bmax?select=nome,nome_rd,classe,estado,cidade,rep,grupo,ativo&order=nome").catch(() => []),
        sequelize.query(
            `SELECT revenda AS nome, tipo, saque_id, valor, criado_em FROM bmax_transacoes WHERE tipo_agente='revenda'`,
            { type: QueryTypes.SELECT }),
        sequelize.query(`SELECT revenda AS nome, saldo FROM bmax_saldo WHERE tipo_agente='revenda'`, { type: QueryTypes.SELECT }),
        sequelize.query(
            `SELECT deal_id, detectado_em, resolvido_em, auto_12b_em FROM bmax_pci12_tracking`, { type: QueryTypes.SELECT }),
        sequelize.query(`SELECT deal_id, assumido_em, arquivado_em FROM bmax_pci12a_prazo`, { type: QueryTypes.SELECT }),
        sequelize.query(
            `SELECT DISTINCT ON (a.entity_id) a.entity_id AS deal_id, a.metadata->>'caminho' AS caminho, a."createdAt" AS quando, u.role
             FROM "AuditLogs" a LEFT JOIN "Users" u ON u.username = a.username
             WHERE a.action = 'SELECT_CAMINHO_VENDA' AND a.status = 'success'
             ORDER BY a.entity_id, a."createdAt" DESC`,
            { type: QueryTypes.SELECT })
    ]);

    // linhas por loja: cadastro ativo + qualquer nome que apareça nos cards/razão
    const linhas = new Map();
    const meta = new Map();
    for (const c of cadastro) {
        const nomeRd = c.nome_rd || c.nome;
        const k = norm(nomeRd);
        if (!k || SEM_REVENDA.has(k)) continue;
        if (!linhas.has(k)) { linhas.set(k, novaLinha(nomeRd)); meta.set(k, { classe: c.classe || "", estado: c.estado || "", cidade: c.cidade || "", rep: c.rep || "", grupo: c.grupo || "", ativo: !!c.ativo }); }
    }
    const garantir = (nome) => {
        const k = norm(nome);
        if (!linhas.has(k)) { linhas.set(k, novaLinha(String(nome).trim())); meta.set(k, { classe: "", estado: "", cidade: "", rep: "", grupo: "", ativo: false, fora_cadastro: true }); }
        return linhas.get(k);
    };
    const semRevenda = { leads: 0, vendas: 0, valor: 0 };

    // ── Leads e vendas ──
    const porId = new Map();
    for (const d of leads) {
        const id = d.id || d._id; porId.set(id, d);
        const nome = (getCustomField(d, "REVENDA/LOJA") || "").trim();
        const sit = situacao(d);
        const criadoOk = dentro(d.created_at, de, ate);
        const vendaOk = sit === "venda" && dentro(d.closed_at || d.updated_at, de, ate);
        if (SEM_REVENDA.has(norm(nome))) {
            if (criadoOk) semRevenda.leads++;
            if (vendaOk) { semRevenda.vendas++; semRevenda.valor += Number(d.amount_total); }
            continue;
        }
        const l = garantir(nome);
        if (criadoOk) l.leads++;
        if (vendaOk) { l.vendas++; l.valor += Number(d.amount_total); }
        if (criadoOk || vendaOk) l.detalhes.push({ id, n: d.name, e: d.deal_stage ? d.deal_stage.name : "", p: (getCustomField(d, "PERFIL PCI") || "").trim(), v: Number(d.amount_total || 0), s: sit, c: d.created_at });
    }

    // ── Cashback gerado (créditos − ajustes de recálculo), resgatado (débitos com saque) e saldo atual ──
    for (const t of ledger) {
        if (SEM_REVENDA.has(norm(t.nome)) || !dentro(t.criado_em, de, ate)) continue;
        const l = garantir(t.nome); const v = Number(t.valor || 0);
        if (t.tipo === "credito") l.cashback_gerado += v;
        else if (t.saque_id) l.cashback_resgatado += v;
        else l.cashback_gerado -= v;
    }
    for (const s of saldos) if (!SEM_REVENDA.has(norm(s.nome))) garantir(s.nome).saldo = Number(s.saldo || 0);

    // ── PCI12 ──
    const trk = new Map(tracking.map(t => [t.deal_id, t]));
    const esc12a = new Map(escolhas.map(e => [e.deal_id, e]));
    const p12a = new Map(prazo12a.map(p => [p.deal_id, p]));
    const universo = new Set([...trk.keys(), ...esc12a.keys(), ...p12a.keys()]);
    for (const [id, d] of porId) { const p = (getCustomField(d, "PERFIL PCI") || "").trim(); if (p === "PCI 12a" || p === "PCI 12b" || p === "PCI 12") universo.add(id); }

    for (const id of universo) {
        const d = porId.get(id); if (!d) continue; // card fora da janela do Portal
        const nome = (getCustomField(d, "REVENDA/LOJA") || "").trim();
        if (SEM_REVENDA.has(norm(nome))) continue;
        const t = trk.get(id), e = esc12a.get(id), pciCard = (getCustomField(d, "PERFIL PCI") || "").trim();
        const dataEvento = (t && t.detectado_em) || (e && e.quando) || d.created_at;
        if (!dentro(dataEvento, de, ate)) continue;
        const l = garantir(nome);
        l.pci12_recebidos++;

        // caminho final: escolha registrada > 12b automático > PCI atual do card
        let caminho = null, quem = "equipe", auto = false;
        if (e && e.caminho) { caminho = e.caminho === "BOX>REV" ? "12a" : "12b"; quem = e.role === "revenda" ? "revenda" : "equipe"; }
        else if (t && t.auto_12b_em) { caminho = "12b"; auto = true; }
        else if (pciCard === "PCI 12a" || p12a.has(id)) caminho = "12a";
        else if (pciCard === "PCI 12b") caminho = "12b";

        if (!caminho) l.aguardando++;
        else if (auto) l.auto12b++;
        else if (caminho === "12a") (quem === "revenda" ? l.dec12a_revenda++ : l.dec12a_equipe++);
        else (quem === "revenda" ? l.dec12b_revenda++ : l.dec12b_equipe++);

        if (t && t.resolvido_em && t.detectado_em && !auto) {
            const h = (new Date(t.resolvido_em) - new Date(t.detectado_em)) / 36e5;
            if (h >= 0 && h < 24 * 90) { l.horas_soma += h; l.horas_n++; }
        }
        if (caminho === "12a") {
            l.a12_assumidos++;
            const sit = situacao(d);
            if (sit === "venda") { l.a12_vendidos++; l.a12_valor += Number(d.amount_total); }
            else if (sit === "perdido") l.a12_perdidos++;
            else l.a12_abertos++;
        }
    }

    const rows = [...linhas.entries()].map(([k, l]) => ({ ...l, ...meta.get(k) }));
    for (const r of rows) {
        r.valor = Number(r.valor.toFixed(2)); r.cashback_gerado = Number(r.cashback_gerado.toFixed(2));
        r.cashback_resgatado = Number(r.cashback_resgatado.toFixed(2)); r.a12_valor = Number(r.a12_valor.toFixed(2));
    }
    const comAtividade = rows.filter(r => r.ativo || r.leads || r.vendas || r.cashback_gerado || r.pci12_recebidos || r.saldo);
    semRevenda.valor = Number(semRevenda.valor.toFixed(2));
    return {
        gerado_em: new Date().toISOString(),
        historico_pci12: { rastreio_48h_desde: "2026-07-30", escolhas_e_assumidos_desde: "2026-09-10" },
        linhas: comAtividade,
        sem_revenda: semRevenda
    };
}

module.exports = { calcularPerformance };
