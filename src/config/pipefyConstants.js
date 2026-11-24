// IDs da estrutura do Pipefy (pipes, fases, campos, databases) — ver
// guia_bmax_pipefy.md (raiz do repo), seção 4. Em produção (Vercel), não dá
// pra contar com `mapa_pipefy.json` chegar no deploy — ele está no
// .gitignore (tem e-mails de funcionários, não pode ser versionado). Por
// isso a configuração vem primeiro da variável de ambiente
// PIPEFY_MAPA_JSON (o JSON inteiro, numa variável só, gerado por
// scripts/gerar-pipefy-mapa-env.js); o arquivo local fica só como
// alternativa pra uso em desenvolvimento. Se nenhum dos dois existir (ou um
// ID específico faltar), tudo aqui vira null/vazio — CRM_PROVIDER continua
// "rd" por padrão (ver rd.leads.service.js), e as funções do lado Pipefy
// (pipefyLeads.service.js) checam esses valores e lançam erro claro antes
// de montar qualquer chamada GraphQL com ID faltando.
let mapa = {};
if (process.env.PIPEFY_MAPA_JSON) {
    try {
        mapa = JSON.parse(process.env.PIPEFY_MAPA_JSON);
    } catch (e) {
        throw new Error(`PIPEFY_MAPA_JSON não é um JSON válido: ${e.message}`);
    }
} else {
    try {
        mapa = require("../../mapa_pipefy.json");
    } catch (e) {
        // Esperado fora do ambiente local, quando nenhum dos dois existe — não é erro de configuração.
    }
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

// Quais pipes alimentam a listagem de leads do Portal (getLeads/
// fetchAllDealsPipefy) — padrão "CRM BOXER SOLDAS" (Fase 5, 18/11/2026): esse
// pipe é o antigo "[Dev.Stegia] CRM" (id 307242360), renomeado e reestruturado
// pra ganhar os campos que faltavam (Representante, Revenda/Loja, Empresa,
// etc.) — substitui "INDÚSTRIA - INTERNO", usado como padrão até então (Fase
// 3, 19/10/2026). Continua configurável, não hardcoded. Cada pipe adicional
// precisa da sua própria entrada em PIPEFY_FASE_PARA_ETAPA_RD (abaixo) pra
// ser filtrado/classificado direito — sem isso, os cards desse pipe aparecem
// sem etapa (ver aviso em cardParaDealFake, pipefyLeads.service.js).
const PIPEFY_PIPES_PORTAL = (process.env.PIPEFY_PIPES_PORTAL || "CRM BOXER SOLDAS")
    .split(",").map(s => s.trim()).filter(Boolean);

// Versão genérica de PIPEFY_PIPE_BMAX/PIPEFY_FASES/PIPEFY_CAMPOS, por nome
// de pipe — usada por fetchAllDealsPipefy (pipefyLeads.service.js) pra
// iterar sobre PIPEFY_PIPES_PORTAL. PIPEFY_PIPE_BMAX/PIPEFY_FASES/
// PIPEFY_CAMPOS continuam existindo como estavam (só BMAX, escrita/criação
// sempre nesse pipe específico — não afetadas por PIPEFY_PIPES_PORTAL).
function pipeConfig(nomePipe) {
    const p = mapa?.pipes?.[nomePipe] || {};
    return { id: p.id || null, fases: p.fases || {}, campos: p.campos || {} };
}

// "Contatos"/"Empresas" ficam na raiz do mapa_pipefy.json (não dentro de uma
// chave "tabelas"), cada um com seu próprio id de database e campos (também
// chaveados por rótulo: "Nome", "E-mail", "Telefone"...).
const PIPEFY_TABELA_CONTATOS = mapa?.contatos?.id || null;
const PIPEFY_TABELA_EMPRESAS = mapa?.empresas?.id || null;

// Campos do database de Contatos (guia seção 5.4/5.5) — nome e e-mail,
// usados pra achar/criar o contato antes do card.
const PIPEFY_CAMPO_CONTATO_NOME = mapa?.contatos?.campos?.["Nome"] || null;
const PIPEFY_CAMPO_CONTATO_EMAIL = mapa?.contatos?.campos?.["E-mail"] || null;
// Usado por getContatoPrincipalPipefy (pipefyLeads.service.js, equivalente a
// getContatoPrincipal do lado RD) — só existe na database Contatos
// Comercial; "Contatos (RD)" (usada pelo CRM BOXER SOLDAS) não tem esse
// campo no mapa, então pra esse pipe o telefone sempre vem null (só o nome).
const PIPEFY_CAMPO_CONTATO_TELEFONE = mapa?.contatos?.campos?.["Telefone"] || null;

// Campos do database de Empresas (mesmo padrão do Contatos acima) — nome e
// CNPJ, usados por createLeadPipefy pra achar/criar a Empresa antes do card
// (achado real, 26/10/2026: createLeadPipefy nunca ligava Empresa nenhuma —
// só Contato — e um card sem Empresa não tem o que a transferência
// BOX+REV>IND copiar nesse campo).
const PIPEFY_CAMPO_EMPRESA_NOME = mapa?.empresas?.campos?.["Nome"] || null;
const PIPEFY_CAMPO_EMPRESA_CNPJ = mapa?.empresas?.campos?.["CNPJ"] || null;

// Confirmado ao vivo na conta real (18/11/2026, introspecção do schema via
// `connectedRepo` de PhaseField): os campos "Empresa"/"Contatos" do pipe CRM
// BOXER SOLDAS NÃO estão ligados às databases Empresas Comercial/Contatos
// Comercial (usadas pelos outros 3 pipes) — estão ligados a "Empresas (RD)"/
// "Contatos (RD)", bases diferentes (prováveis da migração de marketing,
// não da Comercial). Gravar o ID de um registro de Empresas Comercial nesse
// campo é IGNORADO EM SILÊNCIO pelo Pipefy (acerto confirmado num teste real
// — o card é criado normalmente, só o campo de conexão fica vazio).
const PIPEFY_TABELA_CONTATOS_RD = mapa?.contatosRD?.id || null;
const PIPEFY_CAMPO_CONTATO_RD_NOME = mapa?.contatosRD?.campos?.["Nome"] || null;
const PIPEFY_CAMPO_CONTATO_RD_EMAIL = mapa?.contatosRD?.campos?.["E-mail"] || null;
const PIPEFY_TABELA_EMPRESAS_RD = mapa?.empresasRD?.id || null;
const PIPEFY_CAMPO_EMPRESA_RD_NOME = mapa?.empresasRD?.campos?.["Nome"] || null;
const PIPEFY_CAMPO_EMPRESA_RD_CNPJ = mapa?.empresasRD?.campos?.["CNPJ"] || null;

// Qual database de Empresa/Contato cada pipe usa — hoje só CRM BOXER SOLDAS
// diverge do padrão (Empresas Comercial/Contatos Comercial); qualquer outro
// pipe continua usando as databases de sempre.
function tabelaEmpresaDoPipe(nomePipe) {
    return nomePipe === "CRM BOXER SOLDAS"
        ? { id: PIPEFY_TABELA_EMPRESAS_RD, campoNome: PIPEFY_CAMPO_EMPRESA_RD_NOME, campoCnpj: PIPEFY_CAMPO_EMPRESA_RD_CNPJ }
        : { id: PIPEFY_TABELA_EMPRESAS, campoNome: PIPEFY_CAMPO_EMPRESA_NOME, campoCnpj: PIPEFY_CAMPO_EMPRESA_CNPJ };
}

function tabelaContatoDoPipe(nomePipe) {
    return nomePipe === "CRM BOXER SOLDAS"
        ? { id: PIPEFY_TABELA_CONTATOS_RD, campoNome: PIPEFY_CAMPO_CONTATO_RD_NOME, campoEmail: PIPEFY_CAMPO_CONTATO_RD_EMAIL, campoTelefone: null }
        : { id: PIPEFY_TABELA_CONTATOS, campoNome: PIPEFY_CAMPO_CONTATO_NOME, campoEmail: PIPEFY_CAMPO_CONTATO_EMAIL, campoTelefone: PIPEFY_CAMPO_CONTATO_TELEFONE };
}

// E-mail -> ID do membro da organização no Pipefy (guia seção 2/"membros"
// do mapa). Usado pra traduzir o responsável (RD: nome -> e-mail, via
// getAliasMaps().rdToEmail) no e-mail -> membro do Pipefy, em
// updateLeadPipefy (Tarefa 6).
const PIPEFY_MEMBROS = mapa?.membros || {};

// Grafia exata das 21 opções válidas do campo PCI (guia seção 4) — picklist
// fechado no Pipefy, igual o RD: qualquer outro valor é recusado.
const PIPEFY_PCI_OPCOES = [
    "PCI 1", "PCI 2", "PCI 3", "PCI 4", "PCI 5", "PCI 6", "PCI 7", "PCI 8", "PCI 9",
    "PCI 10", "PCI 11", "PCI 12", "PCI 13", "PCI 14", "PCI 15", "PCI 16", "PCI 17", "PCI 18",
    "PCI 12a", "PCI 12b", "Sem PCI",
    "PCI X"   // produto não BMax (venda da revenda, sem comissão) — 23/11/2026
];

// Tradução NOME DA FASE DO PIPEFY -> { etapa: ID DE ETAPA DO RD, win }, por
// pipe (cada pipe de PIPEFY_PIPES_PORTAL/usado na criação precisa da sua
// própria tabela — hoje cobertos: BMAX e INDÚSTRIA - INTERNO). Existe pra
// todo o resto do código (getLeads, mapDealToCard, cálculo de cashback, o
// guard-clause de caminhoVenda.service.js que impede redefinir caminho em
// lead já vendido/perdido) continuar comparando `deal_stage.id`/`win` com as
// constantes RD_STAGE_* de sempre, sem precisar saber que o dado veio do
// Pipefy. `win` fica na própria tabela (não mais hardcoded por nome de fase
// dentro de cardParaDealFake, pipefyLeads.service.js) porque cada pipe usa
// um nome diferente pra fase de venda/perda (BMAX: "Venda Efetivada"/
// "Perdido"; INDÚSTRIA: "VENDA EFETIVADA"/"PERDIDOS | SEM PERFIL").
//
// BMAX confirmado direto no código (15/10/2026, revisão bmax_pipefy_correcoes.md):
// - "Leads Revenda" -> RD_STAGE_ASSUMIDO: createLead usa essa etapa como
//   inicial pra negociação nova de revenda no pipeline BMAX-Interno do RD.
// - "Prazo Vencido" -> RD_STAGE_PERDIDO: o cron pci12a-prazo (app.js) grava
//   literalmente essa etapa do RD quando o prazo de 60 dias vence — mesmo
//   ID que RD_STAGES rotula globalmente como "Perdido", reaproveitado nesse
//   pipeline especificamente com o sentido de "Prazo Vencido".
// - "Venda Efetivada" -> RD_STAGE_VENDIDO: é a etapa que o botão "Marcar
//   como Vendido" grava, no mesmo contexto (lead PCI12A, pipeline
//   BMAX-Interno) de onde vêm os leads deste pipe.
// - "Perdido": fase criada direto no Pipefy, sem etapa equivalente própria
//   no funil BMAX do RD. Reaproveita o mesmo RD_STAGE_PERDIDO de "Prazo
//   Vencido" (não por serem a mesma coisa — win distingue as duas — mas
//   porque getLeads (rd.leads.service.js) já exclui RD_STAGE_PERDIDO do
//   painel, e caminhoVenda.service.js já barra redefinir caminho nessa
//   etapa; sem mapear "Perdido" pra algum RD_STAGE_*, nenhuma das duas
//   proteções pegaria esses cards (etapa ficaria null, não bate com nada).
//
// INDÚSTRIA - INTERNO (Fase 3 do plano, 19/10/2026, bmax_pipefy_correcoes_adendo.md):
// as 7 fases desse pipe no Pipefy batem 1:1, por nome, com as 7 etapas que
// RD_STAGES já rotula pro pipeline RD_PIPELINE_INDUSTRIA — confirmado no
// mapa_pipefy.json real. "VENDA EFETIVADA" e "ENTREGA TECNICA" contam como
// venda (win:true, a entrega técnica vem depois da venda, mesmo critério já
// usado pra RD_STAGE_ENTREGA_TECNICA no cálculo de cashback/comissão);
// "PERDIDOS | SEM PERFIL" é perda (win:false); as demais não são finais
// (win:null).
const {
    RD_STAGE_ASSUMIDO,
    RD_STAGE_PERDIDO,
    RD_STAGE_VENDIDO,
    RD_STAGE_LEAD,
    RD_STAGE_EM_CONTATO,
    RD_STAGE_NEGOCIACAO,
    RD_STAGE_DEMONSTRACAO,
    RD_STAGE_VENDA_EFETIVADA,
    RD_STAGE_ENTREGA_TECNICA,
    RD_STAGE_EXCLUIDO
} = require("./constants");
const PIPEFY_FASE_PARA_ETAPA_RD = {
    BMAX: {
        "Leads Revenda": { etapa: RD_STAGE_ASSUMIDO, win: null },
        "Prazo Vencido": { etapa: RD_STAGE_PERDIDO, win: null },
        "Venda Efetivada": { etapa: RD_STAGE_VENDIDO, win: true },
        "Perdido": { etapa: RD_STAGE_PERDIDO, win: false },
        // Tarefa B1 (3º adendo, decisão tomada 26/10/2026): fase final de quem
        // foi transferido pro INDÚSTRIA - INTERNO (ver transferirCardParaIndustria,
        // pipefyLeads.service.js) — não é uma etapa "de verdade" do RD, mas
        // precisa de ALGUMA entrada aqui (senão fica sem etapa classificada,
        // logger.warn a cada card). RD_STAGE_EXCLUIDO + win:false porque é
        // exatamente o efeito desejado: fora do painel (getLeads exclui esse
        // RD_STAGE_*) e fora da checagem de duplicidade (dealBateComCnpj só
        // bloqueia quando win é null) — o card novo no INDÚSTRIA - INTERNO é
        // quem passa a representar a negociação viva.
        "Transferido para a Indústria": { etapa: RD_STAGE_EXCLUIDO, win: false }
    },
    "INDÚSTRIA - INTERNO": {
        "LEAD": { etapa: RD_STAGE_LEAD, win: null },
        "EM CONTATO": { etapa: RD_STAGE_EM_CONTATO, win: null },
        "NEGOCIAÇÃO": { etapa: RD_STAGE_NEGOCIACAO, win: null },
        "DEMONSTRAÇÃO": { etapa: RD_STAGE_DEMONSTRACAO, win: null },
        "VENDA EFETIVADA": { etapa: RD_STAGE_VENDA_EFETIVADA, win: true },
        "ENTREGA TECNICA": { etapa: RD_STAGE_ENTREGA_TECNICA, win: true },
        "PERDIDOS | SEM PERFIL": { etapa: RD_STAGE_EXCLUIDO, win: false }
    },
    // CRM BOXER SOLDAS (Fase 5, 18/11/2026) — pipe novo padrão do painel (ver
    // PIPEFY_PIPES_PORTAL acima). Nomes de fase com espaço no final são EXATOS
    // (confirmados ao vivo na conta real) — "Timming " e "ENTREGA TECNICA ".
    // "Timming ": o Comercial confirmou (19/11/2026) que essa fase fica DE
    // PROPÓSITO fora do fluxo do BMAX (não é um estágio de venda nosso) —
    // mesmo tratamento já usado em BMAX["Transferido para a Indústria"]:
    // RD_STAGE_EXCLUIDO + win:false tira o card do painel (getLeads exclui
    // esse RD_STAGE_*) e da checagem de duplicidade (dealBloqueiaDuplicata só
    // bloqueia quando win é null) — exatamente "desconsiderar" o card
    // enquanto ele estiver nessa fase.
    "CRM BOXER SOLDAS": {
        "Lead": { etapa: RD_STAGE_LEAD, win: null },
        "Em contato": { etapa: RD_STAGE_EM_CONTATO, win: null },
        "Negociação": { etapa: RD_STAGE_NEGOCIACAO, win: null },
        "Demonstração": { etapa: RD_STAGE_DEMONSTRACAO, win: null },
        "Timming ": { etapa: RD_STAGE_EXCLUIDO, win: false },
        "Venda Efetiva": { etapa: RD_STAGE_VENDA_EFETIVADA, win: true },
        "ENTREGA TECNICA ": { etapa: RD_STAGE_ENTREGA_TECNICA, win: true },
        "Perdidos | Sem Perfil": { etapa: RD_STAGE_EXCLUIDO, win: false }
    },
    // REVENDA - INTERNO / FUNIL SDR ainda não têm tradução fase->etapa RD
    // real (Fase 7, 19/11/2026) — nenhum código hoje precisa disso pra
    // ESCREVER; só a Consulta de Lead do Motor lê esses pipes, e o
    // "estagio" exibido ao usuário já vem do nome bruto da fase
    // (deal_stage.name), não desta tabela. Entrada vazia (mas truthy) só
    // evita o aviso de "pipe sem tabela configurada" por CARD durante a
    // varredura (cardParaDealFake); dealBloqueiaDuplicata cai no padrão
    // seguro (bloqueia) sem um win conhecido. Não inventar significado de
    // negócio aqui — se um dia precisar escrever etapa nesses pipes, mapear
    // de verdade então.
    "REVENDA - INTERNO": {},
    "FUNIL SDR": {}
};

// Campo PCI do CRM BOXER SOLDAS ("Perfil PCI 🤖", apelidado de "PCI" em
// mapa_pipefy.json — ver pipeConfig) tem opções incompatíveis com o PCI
// formal de 21 opções (PIPEFY_PCI_OPCOES acima): só "12A"/"12B" maiúsculos
// (o padrão formal usa "12a"/"12b" minúsculo) continuam divergentes.
// **Resolvido em 19/11/2026**: o Comercial adicionou a opção "Sem PCI" ao
// campo (confirmado ao vivo na conta real, grafia idêntica à do padrão
// formal) — removida a tradução "Sem PCI" -> "" que antes fazia o valor ser
// omitido (campo não obrigatório, "" é descartado por montarCamposValidos);
// agora "Sem PCI" é enviado/lido como qualquer outro valor, sem alias.
const PIPEFY_PCI_ALIAS = {
    "CRM BOXER SOLDAS": {
        paraPipefy: { "PCI 12a": "PCI 12A", "PCI 12b": "PCI 12B" },
        doPipefy: { "PCI 12A": "PCI 12a", "PCI 12B": "PCI 12b" }
    }
};

function pciParaPipefy(nomePipe, valor) {
    return PIPEFY_PCI_ALIAS[nomePipe]?.paraPipefy[valor] ?? valor;
}

function pciDoPipefy(nomePipe, valor) {
    return PIPEFY_PCI_ALIAS[nomePipe]?.doPipefy[valor] ?? valor;
}

// Confirmado na conta real (18/11/2026, teste ao vivo do Fase 5): o campo
// "Revenda/Loja" do CRM BOXER SOLDAS recusa o valor "Sem Revenda" (grafia
// usada em todo o resto do sistema, vinda de matchRevendaRD em
// rd.leads.service.js) — a opção de verdade nesse pipe é "Sem revenda"
// (minúsculo). As ~100 revendas nomeadas parecem idênticas nos dois pipes
// (checado por amostragem); só esse valor especial diverge. Mesmo padrão do
// PIPEFY_PCI_ALIAS acima.
const PIPEFY_REVENDA_ALIAS = {
    "CRM BOXER SOLDAS": {
        paraPipefy: { "Sem Revenda": "Sem revenda" },
        doPipefy: { "Sem revenda": "Sem Revenda" }
    }
};

function revendaParaPipefy(nomePipe, valor) {
    return PIPEFY_REVENDA_ALIAS[nomePipe]?.paraPipefy[valor] ?? valor;
}

function revendaDoPipefy(nomePipe, valor) {
    return PIPEFY_REVENDA_ALIAS[nomePipe]?.doPipefy[valor] ?? valor;
}

function exigirConfig(valor, descricao) {
    if (!valor) {
        throw new Error(`Pipefy não configurado: falta ${descricao} em mapa_pipefy.json`);
    }
    return valor;
}

// Nome do pipe (chave de mapa.pipes) a partir do ID — usado por
// getDealByIdPipefy (pipefyLeads.service.js, Tarefa A2 do 2º adendo,
// 23/10/2026) pra traduzir um card pro pipe CERTO (`getCard` já pede
// `pipe { id name }`), em vez de assumir sempre BMAX.
function nomeDoPipePorId(pipeId) {
    if (!pipeId) return null;
    return Object.entries(mapa?.pipes || {}).find(([, p]) => String(p.id) === String(pipeId))?.[0] || null;
}

// Quando mais de uma fase do MESMO pipe aponta pra mesma etapa do RD em
// PIPEFY_FASE_PARA_ETAPA_RD, a tradução INVERSA (etapa do RD -> nome da
// fase, usada por updateLeadPipefy pra mover um card) não dá pra inferir
// sozinha — precisa de uma escolha explícita. Hoje só um caso (Tarefa A3 do
// 2º adendo, 23/10/2026): no BMAX, RD_STAGE_PERDIDO é usado tanto por
// "Prazo Vencido" (gravado pelo cron pci12a-prazo) quanto, em tese, por
// "Perdido" (perda marcada à mão no Pipefy) — mover um card por causa de uma
// etapa do RD só faz sentido pro caso do cron, nunca pra marcar perda à mão.
const PREFERENCIA_ETAPA_RD_PARA_FASE = {
    BMAX: {
        [RD_STAGE_PERDIDO]: "Prazo Vencido"
    }
};

function faseParaEtapaRdReversa(nomePipe, etapaRd) {
    const tabela = PIPEFY_FASE_PARA_ETAPA_RD[nomePipe];
    if (!tabela) return null;
    const preferida = PREFERENCIA_ETAPA_RD_PARA_FASE[nomePipe]?.[etapaRd];
    if (preferida) return preferida;
    return Object.entries(tabela).find(([, info]) => info.etapa === etapaRd)?.[0] || null;
}

module.exports = {
    PIPEFY_PIPE_BMAX,
    PIPEFY_FASES,
    PIPEFY_CAMPOS,
    PIPEFY_TABELA_CONTATOS,
    PIPEFY_TABELA_EMPRESAS,
    PIPEFY_CAMPO_CONTATO_NOME,
    PIPEFY_CAMPO_CONTATO_EMAIL,
    PIPEFY_CAMPO_EMPRESA_NOME,
    PIPEFY_CAMPO_EMPRESA_CNPJ,
    PIPEFY_PCI_OPCOES,
    PIPEFY_FASE_PARA_ETAPA_RD,
    PIPEFY_MEMBROS,
    PIPEFY_PIPES_PORTAL,
    pipeConfig,
    exigirConfig,
    nomeDoPipePorId,
    faseParaEtapaRdReversa,
    pciParaPipefy,
    pciDoPipefy,
    revendaParaPipefy,
    revendaDoPipefy,
    tabelaEmpresaDoPipe,
    tabelaContatoDoPipe
};
