// Avisos por WhatsApp (canal SÓ de comunicação — nada é executado por lá; cada aviso leva o link do Portal).
// Este serviço monta a PRÉVIA do que seria enviado hoje a cada login de revenda. Não envia nada.
// Regras (André, 14/10/2026): sem nada a comunicar não sai mensagem; só revenda ativa no programa;
// só login com celular válido e aceite registrado; sem nome de cliente e sem % de comissão no texto.
const { QueryTypes } = require("sequelize");
const { sequelize } = require("../database");
const { sbSistemasService } = require("../config/supabaseSistemas");
const { getLeads, getCustomField } = require("./rd.leads.service");
const { getSaldoGrupo, getCreditosProximosVencimentoGrupo } = require("./saldo.service");
const { buscarPrazos12a } = require("./pci12Tracking.service");
const { normalizarCelularBR } = require("./telefone.service");
const { REVENDA_SEM_CREDITO, RD_STAGE_VENDA_EFETIVADA, RD_STAGE_VENDIDO, RD_STAGE_ENTREGA_TECNICA, RD_STAGE_PERDIDO, RD_STAGE_EXCLUIDO } = require("../config/constants");

const PORTAL_URL = process.env.PORTAL_URL || "https://bmax.boxersoldas.com.br";
const MARCOS_CASHBACK = [30, 15, 7];     // dias para expirar
const MARCOS_12A = [15, 30, 50];         // dias desde que a revenda assumiu o lead (o prazo final é 60)
const FINAIS = new Set([RD_STAGE_VENDA_EFETIVADA, RD_STAGE_VENDIDO, RD_STAGE_ENTREGA_TECNICA, RD_STAGE_PERDIDO, RD_STAGE_EXCLUIDO]);

const trim = s => String(s || "").trim();
const brl = v => "R$ " + Number(v).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const plural = (n, um, varios) => `${n} ${n === 1 ? um : varios}`;
const pciNorm = d => String(getCustomField(d, "PERFIL PCI") || "").replace(/\s/g, "").toUpperCase();

function textoPci12(qtd) {
    return `BMAX Boxer: ${plural(qtd, "lead aguarda", "leads aguardam")} sua decisão de caminho (PCI12). Decida em até 48h para não perder o prazo: ${PORTAL_URL}/#dash`;
}

function textoResumo(it) {
    const linhas = [];
    if (it.novos) linhas.push(`• ${plural(it.novos, "lead novo na sua tela", "leads novos na sua tela")}`);
    if (it.cashbackExpirando.length) linhas.push(...it.cashbackExpirando.map(c => `• ${brl(c.valor)} de cashback vencem em ${c.dias} dias`));
    if (it.cashbackDisponivel) linhas.push(`• Você tem ${brl(it.cashbackDisponivel)} de cashback para usar`);
    if (it.leads12aSemResultado) linhas.push(`• ${plural(it.leads12aSemResultado, "lead assumido por você aguarda", "leads assumidos por você aguardam")} o registro de Vendido ou Perdido`);
    if (it.incentivoNovaNegociacao) linhas.push("• Registre uma nova negociação: cada venda gera mais cashback para você");
    return `BMAX Boxer — resumo de hoje:\n${linhas.join("\n")}\nAcesse: ${PORTAL_URL}/#dash`;
}

async function montarResumoDiario({ hoje = new Date() } = {}) {
    const [logins, grupos, cadAtivos, deals, prazos12a] = await Promise.all([
        sequelize.query(`SELECT u.id AS user_id, u.username, r.name, r.grupo, r.telefone, r.whatsapp_aceite_em FROM "Users" u JOIN "Revendas" r ON r.user_id = u.id WHERE u.role = 'revenda' ORDER BY u.username`, { type: QueryTypes.SELECT }),
        sequelize.query(`SELECT revenda_rd, grupo FROM bmax_grupos`, { type: QueryTypes.SELECT }),
        sbSistemasService("/comercial_revendas_bmax?select=nome,nome_rd&ativo=eq.true&limit=1000"),
        getLeads("admin", "adm"),
        buscarPrazos12a()
    ]);
    const gruposMap = {};
    grupos.forEach(g => (gruposMap[g.grupo] = gruposMap[g.grupo] || []).push(trim(g.revenda_rd)));
    const ativos = new Set(cadAtivos.map(c => trim(c.nome_rd || c.nome).toLowerCase()));
    const assumidoEm = new Map(prazos12a.map(p => [p.deal_id, new Date(p.assumido_em)]));
    const umDia = 86_400_000;

    const resultado = [];
    for (const u of logins) {
        const nomes = (u.grupo && gruposMap[u.grupo]) ? gruposMap[u.grupo] : (u.name ? [trim(u.name)] : []);
        const conjunto = new Set(nomes);
        const ativa = nomes.some(n => ativos.has(n.toLowerCase()));
        const tel = normalizarCelularBR(u.telefone);
        const aceite = !!u.whatsapp_aceite_em;
        const base = { user_id: u.user_id, login: u.username, revenda: u.name, grupo: u.grupo || null, ativa, whatsapp: tel, aceiteEm: u.whatsapp_aceite_em || null };

        // Só revenda ativa no programa recebe aviso
        if (!ativa) { resultado.push({ ...base, itens: null, mensagens: [], enviaria: false, bloqueio: "revenda não está ativa no programa" }); continue; }

        const meus = deals.filter(d => conjunto.has(trim(getCustomField(d, "REVENDA/LOJA"))) && !REVENDA_SEM_CREDITO.includes(trim(getCustomField(d, "REVENDA/LOJA"))));
        const pci12 = meus.filter(d => pciNorm(d) === "PCI12" && !FINAIS.has(d.deal_stage?.id));
        const novos = meus.filter(d => new Date(d.created_at) >= new Date(hoje - umDia) && !pci12.includes(d)).length;
        const leads12a = meus.filter(d => pciNorm(d) === "PCI12A" && !FINAIS.has(d.deal_stage?.id) && d.win !== true && d.win !== false);
        const leads12aSemResultado = leads12a.filter(d => {
            const ini = assumidoEm.get(d.id || d._id);
            return ini && MARCOS_12A.includes(Math.floor((hoje - ini) / umDia));
        }).length;
        const grupoParam = (u.grupo && gruposMap[u.grupo]) ? u.grupo : null;
        const saldo = await getSaldoGrupo(trim(u.name), grupoParam);
        const expirando = await getCreditosProximosVencimentoGrupo(trim(u.name), grupoParam);
        const cashbackExpirando = MARCOS_CASHBACK.map(m => {
            const soma = expirando.filter(c => Math.ceil((new Date(c.expira_em) - hoje) / umDia) === m).reduce((s, c) => s + Number(c.valor), 0);
            return soma > 0 ? { dias: m, valor: soma } : null;
        }).filter(Boolean);
        const diaDoMes = hoje.getDate();
        const cashbackDisponivel = saldo > 0 && (diaDoMes === 1 || diaDoMes === 15) ? saldo : 0;
        const incentivoNovaNegociacao = !meus.some(d => new Date(d.created_at) >= new Date(hoje - 30 * umDia)) && hoje.getDay() === 1; // só às segundas

        const itens = { novos, pci12Pendentes: pci12.length, cashbackExpirando, cashbackDisponivel, leads12aSemResultado, incentivoNovaNegociacao };
        const temResumo = !!(novos || cashbackExpirando.length || cashbackDisponivel || leads12aSemResultado || incentivoNovaNegociacao);
        const mensagens = [];
        if (pci12.length) mensagens.push({ tipo: "pci12", texto: textoPci12(pci12.length) });
        if (temResumo) mensagens.push({ tipo: "resumo", texto: textoResumo(itens) });

        let bloqueio = null;
        if (!tel.valido) bloqueio = `WhatsApp inválido: ${tel.motivo}`;
        else if (!aceite) bloqueio = "sem aceite de WhatsApp registrado";
        else if (!mensagens.length) bloqueio = "nada a comunicar hoje";
        resultado.push({ ...base, itens, mensagens, enviaria: !bloqueio, bloqueio });
    }
    const ativos2 = resultado.filter(r => r.ativa);
    return {
        geradoEm: hoje.toISOString(),
        totais: {
            logins: resultado.length,
            ativos: ativos2.length,
            comWhatsAppValido: ativos2.filter(r => r.whatsapp.valido).length,
            comAceite: ativos2.filter(r => r.aceiteEm).length,
            comMensagemHoje: ativos2.filter(r => r.mensagens.length).length,
            enviariamHoje: resultado.filter(r => r.enviaria).length
        },
        logins: resultado
    };
}

module.exports = { montarResumoDiario, textoPci12, textoResumo };
