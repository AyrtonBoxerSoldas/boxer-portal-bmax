const db = require("../database");
const { createLead, createTask, getLeadByName } = require("./rd.leads.service");
const { sendEmail } = require("./email.service");
const { getRepresentativeEmailByName } = require("../controllers/leads.controller");

const { Negociacao, User, Representante } = db;

async function createNegociacao(data) {

    const expires_at = new Date();

    expires_at.setDate(expires_at.getDate() + 60);

    console.log("Data: ", data);

    const leadNameToSearch = data.nome;

    // Verifica se existe um Lead com o nome da negociação. Se existir, impede a criação.
    try {
        const existingLead = await getLeadByName(leadNameToSearch);

        if (existingLead) {
            console.log("Lead já existe no RD Station. ID:", existingLead.id);
            throw new Error(`Já existe um Lead ativo do cliente "${leadNameToSearch}" no RD Station.`);
        }
    } catch (error) {
        // Re-lança o erro se for um problema na comunicação com a API do RD
        throw new Error(`${error.message}`);
    }
    const novaNegociacao = await Negociacao.create({
        user_id: data.user_id,
        cnpj: data.cnpj,
        nome: data.nome,
        cidade: data.cidade,
        cep: data.cep,
        maquina: data.maquinainteresse,
        arquivo: data.arquivo || null,
        revenda: data.revenda,
        representante: data.representante,
        expires_at: expires_at
    });

    // Aguarda a criação do Lead no RD Station
    const leadResponse = await createLead(data); // createLead já retorna o JSON parseado
    console.log("Lead Response (parsed):", leadResponse);

    const leadId = leadResponse.data.id;

    const taskData = {
        deal_id: leadId,
        name: "Lead BMAX",
        created_by_id: "661572a5823cb7000e85e146",
        owner_ids: [
            "6a312b777a6c170023b6427d"
        ],
        type: "task"
    };

    await createTask(taskData);

    try {
        let responsavelNome = data.responsavel || "";
        const emailResponsavel = await getRepresentativeEmailByName(responsavelNome);
        const destinatarioEmail = emailResponsavel || "ayrton.oliveira@boxersoldas.com.br";

        if (!emailResponsavel) {
            console.warn(`E-mail do responsável não encontrado para "${responsavelNome}". Usando destinatário padrão.`);
        }

        await sendEmail(
            destinatarioEmail,
            `Nova Negociação BMAX: ${novaNegociacao.nome}`,
            `<p>Uma nova negociação foi registrada no Portal BMAX:</p>
             <ul>
                <li><strong>Cliente:</strong> ${novaNegociacao.nome}</li>
                <li><strong>Máquina:</strong> ${novaNegociacao.maquina}</li>
                <li><strong>Revenda:</strong> ${novaNegociacao.revenda}</li>
                <li><strong>Representante:</strong> ${novaNegociacao.representante}</li>
             </ul>`
        );
    } catch (error) {
        console.error("Falha ao enviar e-mail de notificação:", error);
    }

    return novaNegociacao;
}

async function listNegociacoes(user) {
    if (user.role === "adm") {
        return await Negociacao.findAll();
    }

    return await Negociacao.findAll({
        where: {
            user_id: user.id
        }
    });
}

module.exports = {
    createNegociacao,
    listNegociacoes
}
