const { lerPlanilhaCashback } = require("./cashback.service");

const RD_CRM_V1 = "https://crm.rdstation.com/api/v1";

function rdToken() {
    return process.env.RD_CRM_TOKEN;
}

function getCustomField(deal, label) {
    const cf = (deal.deal_custom_fields || []).find(
        f => f.custom_field && f.custom_field.label.toUpperCase() === label.toUpperCase()
    );
    return cf ? cf.value : "";
}

function getCustomFieldId(deal, label) {
    const cf = (deal.deal_custom_fields || []).find(
        f => f.custom_field && f.custom_field.label.toUpperCase() === label.toUpperCase()
    );
    return cf ? cf.custom_field._id : null;
}

async function rdFetch(path, method = "GET", body = null) {
    const sep = path.includes("?") ? "&" : "?";
    const url = `${RD_CRM_V1}${path}${sep}token=${rdToken()}`;

    const opts = { method, headers: {} };
    if (body) {
        opts.headers["Content-Type"] = "application/json";
        opts.body = JSON.stringify(body);
    }

    const res = await fetch(url, opts);

    if (res.status === 429) {
        throw new Error("Rate limit atingido na API do RD Station. Tente novamente em alguns segundos.");
    }

    const json = await res.json();

    if (!res.ok) {
        console.error(`RD ${method} ${path} → ${res.status}:`, json);
        throw new Error(json?.message || json?.errors?.[0]?.message || `Erro RD ${res.status}`);
    }

    return json;
}

// ─── DEALS (GET) ─────────────────────────────────────────────

async function getLeads(username, role) {
    let allDeals = [];
    let page = 1;

    while (true) {
        const json = await rdFetch(
            `/deals?deal_pipeline_id=66151c1470449b000d54e914&win=null&created_at_start=2026-05-01&page=${page}&limit=200`
        );

        const deals = json.deals || [];
        if (deals.length === 0) break;

        allDeals = allDeals.concat(deals);

        if (!json.has_more) break;
        page++;
    }

    const excludeStage = "66151c4859f00e001209d066";
    allDeals = allDeals.filter(d => d.deal_stage && d.deal_stage.id !== excludeStage);

    if (role === "revenda") {
        const isLuitex = username.includes("Luitex");
        allDeals = allDeals.filter(d => {
            const revenda = getCustomField(d, "REVENDA/LOJA");
            if (isLuitex) {
                return revenda.includes("Luitex");
            }
            return revenda === username;
        });
    } else if (role === "representante") {
        let matchName = username;
        if (username.includes("Victor VLM")) matchName = "Victor Lantyer";

        allDeals = allDeals.filter(d => {
            const rep = getCustomField(d, "REPRESENTANTE");
            if (username.includes("Caio P Mancini")) {
                return rep === "Caio P Mancini" || rep === "Caio Tito";
            }
            return rep === matchName;
        });
    }

    return allDeals;
}

// ─── DEALS (WRITE) ───────────────────────────────────────────

async function createLead(negociacao) {
    const formattedCnpj = negociacao.cnpj.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, "$1.$2.$3/$4-$5");
    const formattedCep = String(negociacao.cep || "").replace(/\D/g, "").replace(/^(\d{5})(\d{3})$/, "$1-$2");

    let organization = await getOrgByCNPJ(formattedCnpj);

    if (!organization) {
        organization = await createOrg({
            name: negociacao.nome,
            user_id: "6a312b777a6c170023b6427d",
        });
    }

    const pci = negociacao.pci || "PCI 12";
    const representante = negociacao.representante || "N/D";

    let nomeusuario;
    switch (negociacao.usuario) {
        case "Caio P Mancini": nomeusuario = "Caio Tito"; break;
        case "Victor VLM": nomeusuario = "Victor Lantyer"; break;
        case "Patrick": nomeusuario = "Patrick Ferreira"; break;
        case "Carlos": nomeusuario = "Carlos Alberto"; break;
        case "Weberson": nomeusuario = "Weberson Rodrigues"; break;
        default: nomeusuario = negociacao.usuario; break;
    }

    const IdPorResponsavel = {
        "Carlos": "66152391467aac000da67451",
        "Lucas Ferreira": "69c5314a81439100135437c7",
        "Max": "6a2007b8b9704500268c5624",
        "Revenda": "661572a5823cb7000e85e146",
        "Representante": "661572a5823cb7000e85e146"
    };

    const responsavelId = IdPorResponsavel[negociacao.responsavel];
    const isBmaxInternal = responsavelId === "661572a5823cb7000e85e146" || representante === "N/D" || representante === nomeusuario;
    const pipeline = isBmaxInternal ? "6a2bff35a294cf00226dd600" : "66151c1470449b000d54e914";
    const stage = isBmaxInternal ? "6a2bff35a294cf00226dd602" : "678f7e08dc0b4800142783ac";

    const body = {
        deal: {
            name: negociacao.nome,
            deal_pipeline_id: pipeline,
            deal_stage_id: stage,
            user_id: responsavelId,
            organization_id: organization._id || organization.id,
            deal_custom_fields: [
                { custom_field_id: "66549f56bc9996000f00486d", value: formattedCnpj },
                { custom_field_id: "69de7c5ff84e9d00198ba86d", value: negociacao.cidade },
                { custom_field_id: "69a19ce32db3db00162b7f77", value: negociacao.revenda },
                { custom_field_id: "687562da830acf00229b542f", value: negociacao.representante },
                { custom_field_id: "69a1eaa65a4db30013c0bd1b", value: negociacao.maquinainteresse },
                { custom_field_id: "661405c2d6161a0014264a6b", value: "Lead BMAX" },
                { custom_field_id: "6a3ae56694471c001e755ff8", value: negociacao.pci }
            ]
        }
    };

    return await rdFetch("/deals", "POST", body);
}

async function getLeadByName(leadName) {
    const json = await rdFetch(`/deals?deal_pipeline_id=66151c1470449b000d54e914&q=${encodeURIComponent(leadName)}&limit=50`);
    const deals = (json.deals || []).filter(d =>
        d.deal_stage && d.deal_stage.id !== "66151c1470449b000d54e919" && d.deal_stage.id !== "66151c4859f00e001209d066"
    );

    if (deals.length > 0) return deals[0];

    const json2 = await rdFetch(`/deals?deal_pipeline_id=68b19e2883a5f700170072d3&q=${encodeURIComponent(leadName)}&limit=50`);
    const deals2 = (json2.deals || []).filter(d =>
        d.deal_stage && d.deal_stage.id !== "68b19eeab3e5a3001b7c83b6" && d.deal_stage.id !== "68b19ef1fd3c29001b0a118a"
    );

    return deals2.length > 0 ? deals2[0] : null;
}

async function updateLead(id, body) {
    const v1Body = {};

    if (body?.data?.stage_id) v1Body.deal_stage_id = body.data.stage_id;
    if (body?.data?.owner_id) v1Body.user_id = body.data.owner_id;

    if (body?.data?.custom_fields) {
        const cfMap = {
            "perfil-pci": "6a3ae56694471c001e755ff8",
            "cnpj": "66549f56bc9996000f00486d",
            "cidade": "69de7c5ff84e9d00198ba86d",
            "estado": "67407ad5f612fe001acf4874",
            "revenda-loja": "69a19ce32db3db00162b7f77",
            "representante": "687562da830acf00229b542f",
            "maquina-de-interesse-1": "69a1eaa65a4db30013c0bd1b",
            "notas": "661405c2d6161a0014264a6b",
            "classe-de-preco": null
        };
        v1Body.deal_custom_fields = [];
        for (const [key, val] of Object.entries(body.data.custom_fields)) {
            const cfId = cfMap[key];
            if (cfId) v1Body.deal_custom_fields.push({ custom_field_id: cfId, value: val });
        }
    }

    return await rdFetch(`/deals/${id}`, "PUT", { deal: v1Body });
}

// ─── ORGANIZATIONS ───────────────────────────────────────────

async function getOrg(id) {
    if (id === "Vazio") return "Vazio";
    return await rdFetch(`/organizations/${id}`);
}

async function getOrgByCNPJ(cnpj) {
    const json = await rdFetch(`/organizations?q=${encodeURIComponent(cnpj)}&limit=10`);
    const orgs = json.organizations || [];
    return orgs.length > 0 ? orgs[0] : null;
}

async function createOrg(orgData) {
    return await rdFetch("/organizations", "POST", { organization: orgData });
}

// ─── TASKS ───────────────────────────────────────────────────

async function getTask(id) {
    if (id === "Vazio") return [];
    const json = await rdFetch(`/tasks?deal_id=${id}`);
    return json.tasks || [];
}

async function createTask(taskData) {
    const body = {
        task: {
            deal_id: taskData.deal_id,
            subject: taskData.name || taskData.subject,
            type: taskData.type || "task",
            date: taskData.date,
            hour: taskData.hour,
            user_id: taskData.owner_id || taskData.user_id || "6a312b777a6c170023b6427d"
        }
    };
    return await rdFetch("/tasks", "POST", body);
}

async function updateTask(taskData, id) {
    return await rdFetch(`/tasks/${id}`, "PUT", { task: taskData });
}

// ─── NOTES ───────────────────────────────────────────────────

async function getLeadNotes(deal_id) {
    return await rdFetch(`/annotations?deal_id=${deal_id}`);
}

// ─── MAP DEAL TO CARD ────────────────────────────────────────

const estados = {
    "Acre":"AC","Alagoas":"AL","Amapá":"AP","Amazonas":"AM","Bahia":"BA",
    "Ceará":"CE","Distrito Federal":"DF","Espírito Santo":"ES","Goiás":"GO",
    "Maranhão":"MA","Mato Grosso":"MT","Mato Grosso do Sul":"MS","Minas Gerais":"MG",
    "Pará":"PA","Paraíba":"PB","Paraná":"PR","Pernambuco":"PE","Piauí":"PI",
    "Rio de Janeiro":"RJ","Rio Grande do Norte":"RN","Rio Grande do Sul":"RS",
    "Rondônia":"RO","Roraima":"RR","Santa Catarina":"SC","São Paulo":"SP",
    "Sergipe":"SE","Tocantins":"TO"
};

const estagios = {
    "678f7e08dc0b4800142783ac":"Lead",
    "66151c1470449b000d54e916":"Em Contato",
    "66151c1470449b000d54e917":"Negociação",
    "66153bd8ebb08a0014e92453":"Demonstração",
    "66151c1470449b000d54e919":"Venda Efetivada",
    "66151c4859f00e001209d066":"Perdidos | Sem Perfil",
    "6a2bff35a294cf00226dd602":"Assumido",
    "6a2bff35a294cf00226dd603":"Perdido",
    "6a5a200c4d3424002786a346":"Vendido"
};

async function mapDealToCard(deal, role) {
    const stageId = deal.deal_stage ? deal.deal_stage.id : null;
    const org = deal.organization || {};
    const orgCfs = {};
    if (org.organization_custom_fields) {
        for (const cf of org.organization_custom_fields) {
            if (cf.custom_field) orgCfs[cf.custom_field.label.toUpperCase()] = cf.value;
        }
    }

    const cnpjRaw = getCustomField(deal, "CNPJ") || orgCfs["CNPJ"] || "?????";
    const cnpj = cnpjRaw.replace(/\D/g, "").replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, "$1.$2.$3/$4-$5");
    const cidade = getCustomField(deal, "CIDADE") || orgCfs["CIDADE"] || "?????";
    const estado = getCustomField(deal, "ESTADO") || orgCfs["ESTADO"] || "??";
    const representante = getCustomField(deal, "REPRESENTANTE") || "?????";
    const revenda = getCustomField(deal, "REVENDA/LOJA") || "?????";
    const maquinainteresse = getCustomField(deal, "MÁQUINA DE INTERESSE") || "?????";
    const pci = (getCustomField(deal, "PERFIL PCI") || orgCfs["PERFIL PCI"] || "").replace(/\s/g, "");

    let cashback = 0;
    if (estagios[stageId] === "Venda Efetivada") {
        const pciCashback = pci;
        const classeCashback = (getCustomField(deal, "CLASSE DE PREÇO") || "").replace(/\D/g, "");
        const cashbackRole = role === "adm" ? "revenda" : role;
        const comissao = parseFloat(await lerPlanilhaCashback(pciCashback, cashbackRole, classeCashback)) || 0;
        cashback = Number(deal.amount_total || 0) * Number(comissao || 0);
    }

    const criadoem = new Date(deal.created_at).toLocaleDateString("pt-BR");
    const nextTask = deal.next_task || {};
    const tarefa = nextTask.subject || "Sem Tarefa Ativa";
    let datatarefa = nextTask.date ? " - " + new Date(nextTask.date).toLocaleDateString("pt-BR") : "";
    if (datatarefa === " - Invalid Date") datatarefa = "";

    const tag = estagios[stageId] || "??????";

    return {
        id: deal.id || deal._id || "?????",
        nome: deal.name || "?????",
        cnpj,
        cidade,
        estado,
        maquinainteresse,
        valor: deal.amount_total || 0,
        pci,
        criadoem,
        representante,
        revenda,
        tag,
        cashback,
        tarefa,
        datatarefa
    };
}

module.exports = {
    getLeads,
    createLead,
    updateLead,
    getOrg,
    getTask,
    createTask,
    updateTask,
    createOrg,
    getOrgByCNPJ,
    getLeadByName,
    getLeadNotes,
    mapDealToCard,
    getCustomField
};
