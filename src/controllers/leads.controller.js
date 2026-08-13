const { getLeads, mapDealToCard, updateLead, getTask, updateTask, createTask, getLeadNotes, getCustomField } = require("../services/rd.leads.service");
const { sendEmail } = require("../services/email.service");
const db = require("../database");
const { lerPlanilhaResponsavel } = require("../services/responsavel.service");

const { User, Representante } = db;

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

async function getRepresentativeEmailByName(representanteNome) {
    const nome = String(representanteNome || "").trim();

    if (!nome) {
        return null;
    }

    const user = await User.findOne({
        where: {
            username: nome,
            role: "representante"
        }
    });

    if (!user) {
        return null;
    }

    const representante = await Representante.findOne({
        where: {
            user_id: user.id
        }
    });

    return representante?.email || null;
}

async function listLeads(req, res) {
    try {
        const userIdentifier =
            req.user.role === "revenda"
                ? req.user.name
                : req.user.username;

        const leads = await getLeads(userIdentifier, req.user.role);

        const cards = [];
        const BATCH_SIZE = 5;
        for (let i = 0; i < leads.length; i += BATCH_SIZE) {
            const batch = leads.slice(i, i + BATCH_SIZE);
            const batchCards = await Promise.all(
                batch.map(lead => mapDealToCard(lead, req.user.role))
            );
            cards.push(...batchCards);
        }

        return res.json(cards);

    } catch (err) {
        console.error("Erro List Leads:", err);

        return res.status(500).json({
            error: err.message || "Falha ao buscar leads do RD"
        });
    }
}

async function updateLeadPci(req, res) {
    try {
        if (req.user?.role !== "revenda") {
            return res.status(403).json({
                error: "Apenas usuários do tipo revenda podem definir o caminho de venda"
            });
        }

        const { dealId, caminho, cidade, estado } = req.body;

        if (!dealId || !caminho || !cidade || !estado) {
            return res.status(400).json({
                error: "dealId, caminho, cidade e estado são obrigatórios"
            });
        }

        const pciPorCaminho = {
            "BOX>REV": "PCI 12a",
            "BOX+REV>IND": "PCI 12b"
        };

        const novoPci = pciPorCaminho[caminho];

        if (!novoPci) {
            return res.status(400).json({
                error: "Caminho inválido"
            });
        }

        const responsavel = await lerPlanilhaResponsavel(cidade, estado);

        if (!responsavel) {
            return res.status(400).json({
                error: `Responsável não encontrado para a cidade "${cidade}" e estado "${estado}"`
            });
        }

        const IdPorResponsavel = {
            "Carlos": "66152391467aac000da67451",
            "Lucas Ferreira": "69c5314a81439100135437c7",
            "Max": "6a2007b8b9704500268c5624",
            "Revenda": "661572a5823cb7000e85e146",
            "Representante": "661572a5823cb7000e85e146"
        };

        const responsavelId = IdPorResponsavel[responsavel];

        if (!responsavelId) {
            return res.status(400).json({
                error: `ID não encontrado para o responsável "${responsavel}"`
            });
        }

        const body = {
            data: {
                stage_id: "6a2bff35a294cf00226dd602",
                owner_id: `${responsavelId}`,
                custom_fields: {
                    "perfil-pci": `${novoPci}`
                }
            }
        };

        if (novoPci === "PCI 12b") {
            const taskData = {
                deal_id: dealId,
                name: "Revenda Autorizou",
                description:"Revenda Selecionou Caminho BOX+REV>IND - Boxer assume venda",
                created_by_id: "661572a5823cb7000e85e146",
                owner_ids: [
                    "6a312b777a6c170023b6427d"
                ],
                type: "task"
            };
            await createTask(taskData);
        }

        const result = await updateLead(dealId, body);

        const resultPci = getCustomField(result, "PERFIL PCI");
        if (resultPci === "PCI 12b") {
            let historico = await getLeadNotes(dealId);
            let representanteNome = getCustomField(result, "REPRESENTANTE") || "";
            representanteNome = representanteNome === "Victor Lantyer" ? "Victor VLM" : representanteNome === "Caio Tito" ? "Caio P Mancini" : representanteNome;
            const emailRepresentante = await getRepresentativeEmailByName(representanteNome);
            const destinatarioEmail = emailRepresentante || "ayrton.oliveira@boxersoldas.com.br";

            if (!emailRepresentante) {
                console.error(`E-mail do representante não encontrado para "${representanteNome}". Usando destinatário padrão.`);
            }
            let cnpj = getCustomField(result, "CNPJ") || "";
            cnpj = cnpj.replace(/\D/g, "");
            if (cnpj.length !== 14) cnpj = "--------------";
            else cnpj = cnpj.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/,"$1.$2.$3/$4-$5");
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
                console.error("Falha ao enviar e-mail de notificação:", error);
            }
        }

        return res.json(result);
    } catch (err) {
        console.error("Erro ao atualizar PCI:", err);

        return res.status(500).json({
            error: err.message || "Falha ao atualizar PCI"
        });
    }
}

async function updateLeadResultado(req, res) {
    try {
        if (req.user?.role !== "revenda") {
            return res.status(403).json({
                error: "Apenas usuários do tipo revenda podem atualizar o resultado da negociação"
            });
        }

        const { dealId, resultado, valor } = req.body;

        if (!dealId || !resultado) {
            return res.status(400).json({
                error: "dealId e resultado são obrigatórios"
            });
        }

        const resultadoNormalizado = String(resultado).toLowerCase();
        const stagePorResultado = {
            vendido: "6a5a200c4d3424002786a346",
            perdido: "6a2bff35a294cf00226dd603"
        };

        const stageId = stagePorResultado[resultadoNormalizado];

        if (!stageId) {
            return res.status(400).json({
                error: "Resultado inválido"
            });
        }

        const valorNumero = Number(String(valor ?? "").replace(",", "."));

        if (!Number.isFinite(valorNumero) || valorNumero < 0) {
            return res.status(400).json({
                error: "Informe um valor numérico válido"
            });
        }

        const body = {
            data: {
                stage_id: stageId,
                custom_fields: {
                    "notas": `R$ ${valorNumero}`
                }
            }
        };

        const result = await updateLead(dealId, body);

        return res.json(result);
    } catch (err) {
        console.error("Erro ao atualizar resultado:", err);

        return res.status(500).json({
            error: err.message || "Falha ao atualizar resultado"
        });
    }
}

module.exports = {
    listLeads,
    updateLeadPci,
    updateLeadResultado,
    formatarHistoricoNotas,
    getRepresentativeEmailByName
};
