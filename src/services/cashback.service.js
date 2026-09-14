const { sbSistemasAnon } = require("../config/supabaseSistemas");
const { logger } = require("../logger");

let _comCache = { data: null, ts: 0 };
const COM_CACHE_TTL = 10 * 60 * 1000;

const RESPONSAVEL_EXCECAO = "André Coelho";
const REPRESENTANTE_INVALIDOS = ["", "?????", "?", "Vazio", "N/D"];

async function fetchComTabela() {
    if (_comCache.data && Date.now() - _comCache.ts < COM_CACHE_TTL) return _comCache.data;

    let rows;
    try {
        rows = await sbSistemasAnon('/comercial_bmax_config?chave=eq.comissao_tabela&select=valor');
    } catch (err) {
        logger.error({ message: "Erro ao buscar comissao_tabela do boxer-sistemas", error: err.message });
        return null;
    }
    if (!rows.length) return null;

    const parsed = typeof rows[0].valor === 'string' ? JSON.parse(rows[0].valor) : rows[0].valor;
    _comCache = { data: parsed, ts: Date.now() };
    return parsed;
}

// PCI12A e PCI16: revenda apenas informa a venda ao Boxer, não existe comissionamento
// nenhum para nenhum agente nesses dois casos (ver planilha BMAX CRITERIOS, aba
// "PCI Versão 2 (atual)" — "PORTAL BMAX - perfis que devem ver o Lead" = NÃO).
// Hard-coded aqui (em vez de confiar que a tabela sempre vai ter zero) porque uma
// edição futura da tabela não deve poder acidentalmente passar a pagar comissão
// nesses dois tipos de PCI.
const PCI_SEM_COMISSAO = new Set(["PCI12A", "PCI16"]);

function normalizarPci(pci) {
    return (pci || '').toUpperCase().replace(/\s/g, '');
}

// Detecta a "exceção" da planilha: quando o representante está preenchido mas o
// responsável (dono do deal no RD) é André Coelho, entende-se que o próprio
// representante fez o atendimento comercial (não teve Vendedor Interno/Técnico
// envolvido) — nesse caso o representante recebe a taxa de exceção (soma), e não
// existe crédito de VI/VT para ninguém nessa venda.
function isExcecaoRepresentante(representante, responsavelRd) {
    const rep = (representante || '').trim();
    if (!rep || REPRESENTANTE_INVALIDOS.includes(rep)) return false;
    return (responsavelRd || '').trim() === RESPONSAVEL_EXCECAO;
}

function buscarLinha(tabela, pciKey, agente) {
    if (!tabela || !tabela.linhas) return null;
    return tabela.linhas.find(l => l.pci === pciKey && l.agente === agente) || null;
}

// Retorna a fração (0.02 = 2%) para um agente específico, ou `null` quando a
// combinação PCI/Classe não tem regra definida (não confundir com 0 = comissão
// legitimamente zero, ex: PCI1 para Revenda). `null` deve virar alerta na UI, não
// um R$ 0,00 silencioso.
async function resolverComissao(pci, agente, classepreco) {
    const pciKey = normalizarPci(pci);
    if (!pciKey || pciKey === 'SEMPCI') return null;
    if (PCI_SEM_COMISSAO.has(pciKey)) return 0;

    const tabela = await fetchComTabela();
    const linha = buscarLinha(tabela, pciKey, agente);
    if (!linha) return null;

    const classeNum = parseInt(classepreco, 10);
    if (!classeNum || classeNum < 1 || classeNum > linha.valores.length) return null;

    const val = linha.valores[classeNum - 1];
    if (val === null || val === undefined) return null;
    return Number(val) / 100;
}

// Mantido por compatibilidade com quem já chama assim (role: 'revenda' | 'representante' | 'adm').
// Uso novo deve preferir `calcularComissoes`, que já resolve os 4 agentes de uma vez.
async function lerPlanilhaCashback(pci, role, classepreco) {
    const agente = role === 'revenda' ? 'Revenda' : 'Rep';
    const comissao = await resolverComissao(pci, agente, classepreco);
    return comissao || 0;
}

// Calcula, para uma venda, o valor de comissão de CADA agente aplicável.
// Retorna { revenda, representante, vendedorInterno } — cada um é
// { valor, tipoAgente, comissaoPct } ou null quando não se aplica, ou
// { faltando: true, motivo } quando deveria haver regra mas não foi encontrada.
async function calcularComissoes({ valorTotal, pci, classePreco, representante, responsavelRd }) {
    const valor = Number(valorTotal) || 0;
    const pciKey = normalizarPci(pci);
    const resultado = { revenda: null, representante: null, vendedorInterno: null };

    if (!pciKey || pciKey === 'SEMPCI') {
        return { ...resultado, faltando: true, motivo: "Sem PCI definido no lead" };
    }
    if (!classePreco) {
        return { ...resultado, faltando: true, motivo: "Sem Classe de Preço definida no lead" };
    }
    if (PCI_SEM_COMISSAO.has(pciKey)) {
        return resultado; // revenda só informou a venda — sem comissão pra ninguém, por design
    }

    const excecao = isExcecaoRepresentante(representante, responsavelRd);

    const pctRevenda = await resolverComissao(pciKey, 'Revenda', classePreco);
    if (pctRevenda === null) {
        return { ...resultado, faltando: true, motivo: `Sem regra de comissão para ${pci} / Classe ${classePreco}` };
    }
    if (pctRevenda > 0) {
        resultado.revenda = { valor: Number((valor * pctRevenda).toFixed(2)), comissaoPct: pctRevenda };
    }

    const rep = (representante || '').trim();
    if (rep && !REPRESENTANTE_INVALIDOS.includes(rep)) {
        const pctRep = await resolverComissao(pciKey, excecao ? 'RepExcecao' : 'Rep', classePreco);
        if (pctRep > 0) {
            resultado.representante = { nome: rep, valor: Number((valor * pctRep).toFixed(2)), comissaoPct: pctRep, excecao };
        }

        if (!excecao) {
            const respRd = (responsavelRd || '').trim();
            if (respRd && !REPRESENTANTE_INVALIDOS.includes(respRd)) {
                const pctVi = await resolverComissao(pciKey, 'VI/VT', classePreco);
                if (pctVi > 0) {
                    resultado.vendedorInterno = { nome: respRd, valor: Number((valor * pctVi).toFixed(2)), comissaoPct: pctVi };
                }
            }
        }
    }

    return resultado;
}

module.exports = {
    lerPlanilhaCashback,
    resolverComissao,
    calcularComissoes,
    isExcecaoRepresentante
};
