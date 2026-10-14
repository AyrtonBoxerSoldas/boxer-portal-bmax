// IDs da estrutura do Pipefy (pipes, fases, campos, databases) — ver
// guia_bmax_pipefy.md (raiz do repo), seção 4. Os valores reais vêm de
// `mapa_pipefy.json` (raiz do repo, gerado na montagem da estrutura no
// Pipefy). Se o arquivo faltar (ou um ID específico não existir nele), tudo
// aqui vira null/vazio — CRM_PROVIDER continua "rd" por padrão (ver
// rd.leads.service.js), e as funções do lado Pipefy (pipefyLeads.service.js)
// checam esses valores e lançam erro claro antes de montar qualquer chamada
// GraphQL com ID faltando.
let mapa = {};
try {
    mapa = require("../../mapa_pipefy.json");
} catch (e) {
    // Esperado até o arquivo ser gerado/adicionado — não é erro de configuração.
}

const bmax = mapa?.pipes?.BMAX || {};

const PIPEFY_PIPE_BMAX = bmax.id || null;

// nome da fase -> id da fase no Pipefy (ex: "Leads Revenda", "Venda Efetivada")
const PIPEFY_FASES = bmax.fases || {};

// Chaveado pelo RÓTULO do campo (igual mapa_pipefy.json: "PCI", "CNPJ",
// "Revenda/Loja", "Título", "Contato"...), com o valor sendo o ID real do
// campo no Pipefy (o Pipefy deriva esse ID do próprio rótulo, ex: "Máquina
// de interesse" -> "m_quina_de_interesse"). updateLeadPipefy traduz os slugs
// genéricos vindos de RD_CF_SLUG_MAP ("perfil-pci", etc.) pro rótulo
// correspondente via ROTULO_POR_SLUG (pipefyLeads.service.js) antes de
// procurar aqui.
const PIPEFY_CAMPOS = bmax.campos || {};

// "Contatos"/"Empresas" ficam na raiz do mapa_pipefy.json (não dentro de uma
// chave "tabelas"), cada um com seu próprio id de database e campos (também
// chaveados por rótulo: "Nome", "E-mail", "Telefone"...).
const PIPEFY_TABELA_CONTATOS = mapa?.contatos?.id || null;
const PIPEFY_TABELA_EMPRESAS = mapa?.empresas?.id || null;

// Campos do database de Contatos (guia seção 5.4/5.5) — nome e e-mail,
// usados pra achar/criar o contato antes do card.
const PIPEFY_CAMPO_CONTATO_NOME = mapa?.contatos?.campos?.["Nome"] || null;
const PIPEFY_CAMPO_CONTATO_EMAIL = mapa?.contatos?.campos?.["E-mail"] || null;

// Grafia exata das 21 opções válidas do campo PCI (guia seção 4) — picklist
// fechado no Pipefy, igual o RD: qualquer outro valor é recusado.
const PIPEFY_PCI_OPCOES = [
    "PCI 1", "PCI 2", "PCI 3", "PCI 4", "PCI 5", "PCI 6", "PCI 7", "PCI 8", "PCI 9",
    "PCI 10", "PCI 11", "PCI 12", "PCI 13", "PCI 14", "PCI 15", "PCI 16", "PCI 17", "PCI 18",
    "PCI 12a", "PCI 12b", "Sem PCI"
];

function exigirConfig(valor, descricao) {
    if (!valor) {
        throw new Error(`Pipefy não configurado: falta ${descricao} em mapa_pipefy.json`);
    }
    return valor;
}

module.exports = {
    PIPEFY_PIPE_BMAX,
    PIPEFY_FASES,
    PIPEFY_CAMPOS,
    PIPEFY_TABELA_CONTATOS,
    PIPEFY_TABELA_EMPRESAS,
    PIPEFY_CAMPO_CONTATO_NOME,
    PIPEFY_CAMPO_CONTATO_EMAIL,
    PIPEFY_PCI_OPCOES,
    exigirConfig
};
