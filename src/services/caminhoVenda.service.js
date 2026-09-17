const { updateLead, createTask, getLeadNotes, getCustomField, getAliasMaps, getContatoPrincipal } = require("./rd.leads.service");
const { lerPlanilhaResponsavel } = require("./responsavel.service");
const { getRepresentativeEmailByName, getRevendaEmailByName } = require("./user.service");
const { sendEmail } = require("./email.service");
const { marcarResolvido, buscarOwnerOriginal } = require("./pci12Tracking.service");
const { logger } = require("../logger");
const {
    RD_STAGE_NEGOCIACAO,
    RD_OWNERS,
    RD_OWNER_DEFAULT,
    PCI_POR_CAMINHO,
    EMAIL_FALLBACK
} = require("../config/constants");

function erroValidacao(mensagem) {
    return Object.assign(new Error(mensagem), { status: 400 });
}

function formatarHistoricoNotas(historico) {
    const notas = Array.isArray(historico?.annotations) ? historico.annotations : Array.isArray(historico?.data) ? historico.data : [];

    if (!notas.length) {
        return "<p><em>Sem histórico disponível para este lead.</em></p>";
    }

    const itens = notas.map((nota) => {
        const data = (nota.registered_at || nota.created_at)
            ? new Date(nota.registered_at || nota.created_at).toLocaleString("pt-BR")
            : "Data não informada";
        const descricao = nota.description || nota.text || "Sem descrição";

        return `
            <li style="margin-bottom:12px;">
                <div><strong>${data}</strong></div>
                <div>${descricao}</div>
            </li>
        `;
    }).join("");

    return `
        <div style="margin-top:16px;">
            <p style="margin:0 0 8px;"><strong>Histórico da Negociação</strong></p>
            <ul style="padding-left:18px; margin:0;">
                ${itens}
            </ul>
        </div>
    `;
}

async function notificarNegociacaoAssumida(dealId, result) {
    const historico = await getLeadNotes(dealId);
    const rdNameOriginal = getCustomField(result, "REPRESENTANTE") || "";
    const { rdToUsername, rdToEmail } = await getAliasMaps();
    const representanteNome = rdToUsername[rdNameOriginal] || rdNameOriginal;
    // rdToUsername devolve o nome canônico, não o username de login (que hoje é
    // e-mail) — getRepresentativeEmailByName busca por username exato e falha
    // pra quem já migrou. rdToEmail vem direto do cadastro (Supabase), mais
    // confiável; getRepresentativeEmailByName fica só de fallback.
    const emailRepresentante = rdToEmail[rdNameOriginal] || await getRepresentativeEmailByName(representanteNome);
    const destinatarioEmail = emailRepresentante || EMAIL_FALLBACK;

    if (!emailRepresentante) {
        logger.warn({ message: "E-mail do representante não encontrado, usando destinatário padrão", representanteNome });
    }

    let cnpj = getCustomField(result, "CNPJ") || "";
    cnpj = cnpj.replace(/\D/g, "");
    cnpj = cnpj.length === 14
        ? cnpj.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, "$1.$2.$3/$4-$5")
        : "--------------";

    try {
        await sendEmail(
            destinatarioEmail,
            `BMAX - Negociação Assumida (Boxer vende)`,
            `<p>Uma negociação do BMAX foi assumida pela Boxer (caminho BOX+REV>IND):</p>
            <ul>
                <li><strong>Cliente:</strong> ${result?.name}</li>
                <li><strong>CNPJ:</strong> ${cnpj}</li>
                <li><strong>Cidade:</strong> ${getCustomField(result, "CIDADE")}</li>
                <li><strong>Estado:</strong> ${getCustomField(result, "ESTADO")}</li>
                <li><strong>Máquina:</strong> ${getCustomField(result, "MÁQUINA DE INTERESSE")}</li>
                <li><strong>Preço Total:</strong> ${result?.amount_total || 0} R$</li>
            </ul>
            ${formatarHistoricoNotas(historico)}`
        );
    } catch (error) {
        logger.error({ message: "Falha ao enviar e-mail de notificação", error: error.message });
    }
}

// Revenda escolheu "eu assumo a venda" (BOX>REV, PCI12A) — ninguém era
// avisado nesse caminho antes (só o BOX+REV>IND tinha e-mail). Avisa revenda
// e representante, já com nome/telefone do contato pra eles conseguirem
// ligar pro cliente direto (mesma regra de privacidade do drawer no front:
// esse dado só é buscado/exposto quando o caminho já é PCI12A).
async function notificarRevendaAssumiu(dealId, result) {
    const revendaNome = getCustomField(result, "REVENDA/LOJA") || "";
    const rdNameOriginal = getCustomField(result, "REPRESENTANTE") || "";

    try {
        // Mesmo problema de notificarNegociacaoAssumida: rdToUsername devolve
        // o nome canônico, não o username de login (hoje é e-mail) — usar o
        // e-mail já cadastrado (rdToEmail) evita depender de bater username
        // com nome exato, que falha pra quem já migrou pro login por e-mail.
        const { rdToUsername, rdToEmail } = await getAliasMaps();
        const representanteNome = rdToUsername[rdNameOriginal] || rdNameOriginal;

        const emailRevenda = await getRevendaEmailByName(revendaNome);
        const emailRepresentante = rdToEmail[rdNameOriginal] || await getRepresentativeEmailByName(representanteNome);
        const destinatarios = [...new Set([emailRevenda, emailRepresentante].filter(Boolean))];
        if (!destinatarios.length) destinatarios.push(EMAIL_FALLBACK);

        if (!emailRevenda) {
            logger.warn({ message: "E-mail da revenda não encontrado para aviso de PCI12A assumido", revendaNome });
        }
        if (!emailRepresentante) {
            logger.warn({ message: "E-mail do representante não encontrado para aviso de PCI12A assumido", representanteNome });
        }

        const orgId = result.organization?._id || result.organization?.id || null;
        const contato = await getContatoPrincipal(orgId, dealId);

        await sendEmail(
            destinatarios,
            `BMAX - Voce assumiu a venda (contate o cliente)`,
            `<p>Você escolheu atender este lead diretamente (caminho BOX>REV):</p>
             <ul>
                <li><strong>Cliente:</strong> ${result?.name || "?????"}</li>
                <li><strong>Cidade:</strong> ${getCustomField(result, "CIDADE") || "?????"}</li>
                <li><strong>Estado:</strong> ${getCustomField(result, "ESTADO") || "?????"}</li>
                <li><strong>Máquina:</strong> ${getCustomField(result, "MÁQUINA DE INTERESSE") || "?????"}</li>
                <li><strong>Valor:</strong> R$ ${result?.amount_total || 0}</li>
                ${contato?.nome ? `<li><strong>Contato:</strong> ${contato.nome}</li>` : ""}
                ${contato?.telefone ? `<li><strong>Telefone:</strong> ${contato.telefone}</li>` : ""}
             </ul>
             <p>Entre em contato com o cliente o quanto antes. Os mesmos dados de contato também aparecem no Portal, no detalhe deste lead.</p>`
        );
    } catch (error) {
        logger.error({ message: "Falha ao enviar e-mail de revenda assumiu (PCI12A)", dealId, error: error.message });
    }
}

async function aplicarCaminhoVenda(dealId, caminho, cidade, estado) {
    const novoPci = PCI_POR_CAMINHO[caminho];

    if (!novoPci) {
        throw erroValidacao("Caminho inválido");
    }

    let stageId, responsavelId, responsavel;

    if (novoPci === "PCI 12a") {
        // Revenda assume a venda (BOX>REV) — regra confirmada por André
        // (16-17/09/2026): NÃO muda de funil (permanece em Indústria
        // Interno), mas vai pra etapa Negociação (mesma etapa do caminho
        // BOX+REV>IND, só não muda de pipeline) — responsável continua
        // sendo André (mesma pessoa da troca automática enquanto o PCI12
        // ficava pendente), PCI vira 12a, e cria uma anotação no RD
        // documentando que a revenda vai atender direto.
        stageId = RD_STAGE_NEGOCIACAO;
        responsavelId = RD_OWNERS["Revenda"];
        responsavel = "Revenda (André)";
    } else {
        // Boxer vende (BOX+REV>IND) — o lead volta pra Negociação (funil
        // Indústria Interno) e o responsável deixa de ser o André: vira o
        // vendedor da região (planilha por cidade/estado) ou, se a planilha
        // não encontrar ninguém, quem era o responsável antes da troca
        // automática (nunca fica com o André).
        stageId = RD_STAGE_NEGOCIACAO;
        responsavel = await lerPlanilhaResponsavel(cidade, estado);
        responsavelId = responsavel ? RD_OWNERS[responsavel] : null;

        if (!responsavelId) {
            const original = await buscarOwnerOriginal(dealId);
            if (original?.owner_original_id) {
                responsavelId = original.owner_original_id;
                responsavel = original.owner_original_nome || responsavelId;
            }
        }

        if (!responsavelId) {
            throw erroValidacao(`Responsável não encontrado para a cidade "${cidade}" e estado "${estado}"`);
        }
    }

    const body = {
        data: {
            owner_id: `${responsavelId}`,
            custom_fields: {
                "perfil-pci": `${novoPci}`
            }
        }
    };
    // stage_id só entra no body quando o caminho de fato precisa mudar de
    // etapa (BOX+REV>IND volta pra Negociação). BOX>REV não muda de etapa
    // nem de funil — omitir a chave inteira faz o updateLead não tocar
    // nesse campo no RD (ver rd.leads.service.js:updateLead).
    if (stageId) {
        body.data.stage_id = stageId;
    }

    if (novoPci === "PCI 12b") {
        await createTask({
            deal_id: dealId,
            name: "Revenda Autorizou",
            notes: "Revenda Selecionou Caminho BOX+REV>IND - Boxer assume venda",
            owner_id: RD_OWNER_DEFAULT,
            type: "task"
        });
    } else if (novoPci === "PCI 12a") {
        await createTask({
            deal_id: dealId,
            name: "Revenda Assumiu o Atendimento",
            notes: "Revenda selecionou o caminho BOX>REV - a revenda seguirá o atendimento diretamente com o cliente.",
            owner_id: RD_OWNERS["Revenda"],
            type: "task"
        });
    }

    const result = await updateLead(dealId, body);

    // Caminho definido — encerra o rastreamento da troca automática de
    // responsável (ver bloco PCI12 em sync-revenda-rep-rd / cron
    // pci12-followup). updateLead acima já sobrescreveu owner_id com o
    // responsável correto pra esse caminho, então não há nada pra reverter
    // aqui — só marcar resolvido pra o cron de followup não mexer mais nele.
    try { await marcarResolvido(dealId); } catch (e) {
        logger.error({ message: "Erro ao marcar PCI12 tracking como resolvido", dealId, error: e.message });
    }

    const resultPci = getCustomField(result, "PERFIL PCI");
    if (resultPci === "PCI 12b") {
        await notificarNegociacaoAssumida(dealId, result);
    } else if (resultPci === "PCI 12a") {
        await notificarRevendaAssumiu(dealId, result);
    }

    return { novoPci, responsavel, result };
}

module.exports = { aplicarCaminhoVenda };
