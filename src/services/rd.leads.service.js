const { lerPlanilhaCashback } = require("./cashback.service");
const {
    RD_PIPELINE_INDUSTRIA,
    RD_PIPELINE_BMAX_INTERNO,
    RD_PIPELINE_REVENDAS,
    RD_STAGES,
    RD_STAGE_EXCLUIDO,
    RD_STAGE_ASSUMIDO,
    RD_STAGE_LEAD,
    RD_STAGE_VENDIDO,
    RD_STAGE_PERDIDO,
    RD_STAGE_VENDA_EFETIVADA,
    RD_STAGES_EXCLUIDOS_REVENDAS,
    RD_CUSTOM_FIELDS,
    RD_CF_SLUG_MAP,
    RD_OWNERS,
    RD_OWNER_DEFAULT,
    USERNAME_TO_RD,
    ESTADOS
} = require("../config/constants");

const RD_CRM_V1 = "https://crm.rdstation.com/api/v1";

function rdToken() {
    return process.env.RD_CRM_TOKEN;
}

function getCustomField(deal, label) {
    const cf = (deal.deal_custom_fields || []).find(
        f => f.custom_field && f.custom_field.label.trim().toUpperCase() === label.trim().toUpperCase()
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

let _leadsCache = { data: null, ts: 0 };
const LEADS_CACHE_TTL = 5 * 60 * 1000;

async function fetchAllDealsFromRD() {
    if (_leadsCache.data && Date.now() - _leadsCache.ts < LEADS_CACHE_TTL) return _leadsCache.data;

    let allDeals = [];
    let page = 1;
    while (true) {
        const json = await rdFetch(
            `/deals?deal_pipeline_id=${RD_PIPELINE_INDUSTRIA}&created_at_start=2026-05-01&page=${page}&limit=200`
        );
        const deals = json.deals || [];
        if (deals.length === 0) break;
        allDeals = allDeals.concat(deals);
        if (!json.has_more) break;
        page++;
    }
    _leadsCache = { data: allDeals, ts: Date.now() };
    return allDeals;
}

async function getLeads(username, role) {
    let allDeals = await fetchAllDealsFromRD();

    const excludeStages = new Set([
        RD_STAGE_EXCLUIDO,
        RD_STAGE_PERDIDO
    ]);
    const cutoffDate = new Date("2026-05-01T00:00:00");
    allDeals = allDeals.filter(d => {
        if (!d.deal_stage || excludeStages.has(d.deal_stage.id)) return false;
        const created = new Date(d.created_at);
        return created >= cutoffDate;
    });

    if (role === "revenda") {
        const grupo = typeof arguments[2] === "string" ? arguments[2] : null;
        let grupoRevendas = null;
        if (grupo) {
            const { sequelize } = require("../database");
            const { QueryTypes } = require("sequelize");
            const rows = await sequelize.query(
                `SELECT revenda_rd FROM bmax_grupos WHERE grupo = :grupo`,
                { replacements: { grupo }, type: QueryTypes.SELECT }
            );
            grupoRevendas = new Set(rows.map(r => r.revenda_rd));
        }
        allDeals = allDeals.filter(d => {
            const revenda = getCustomField(d, "REVENDA/LOJA");
            if (grupoRevendas) return grupoRevendas.has(revenda);
            return revenda === username;
        });
    } else if (role === "representante") {
        const { USERNAME_TO_RD, RD_TO_USERNAME } = require("../config/constants");
        const rdName = USERNAME_TO_RD[username] || username;
        const portalAliases = [username, rdName, ...Object.entries(RD_TO_USERNAME).filter(([, v]) => v === username).map(([k]) => k)];
        const nameSet = new Set(portalAliases);

        allDeals = allDeals.filter(d => {
            const rep = getCustomField(d, "REPRESENTANTE");
            return nameSet.has(rep);
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
            user_id: RD_OWNER_DEFAULT,
        });
    }

    const pci = negociacao.pci || "PCI 12";
    const representante = negociacao.representante || "N/D";

    const nomeusuario = USERNAME_TO_RD[negociacao.usuario] || negociacao.usuario;

    const responsavelId = RD_OWNERS[negociacao.responsavel];
    const isBmaxInternal = responsavelId === RD_OWNERS["Revenda"] || representante === "N/D" || representante === nomeusuario;
    const pipeline = isBmaxInternal ? RD_PIPELINE_BMAX_INTERNO : RD_PIPELINE_INDUSTRIA;
    const stage = isBmaxInternal ? RD_STAGE_ASSUMIDO : RD_STAGE_LEAD;

    const body = {
        deal: {
            name: negociacao.nome,
            deal_pipeline_id: pipeline,
            deal_stage_id: stage,
            user_id: responsavelId,
            organization_id: organization._id || organization.id,
            deal_custom_fields: [
                { custom_field_id: RD_CUSTOM_FIELDS.CNPJ, value: formattedCnpj },
                { custom_field_id: RD_CUSTOM_FIELDS.CIDADE, value: negociacao.cidade },
                { custom_field_id: RD_CUSTOM_FIELDS.REVENDA_LOJA, value: negociacao.revenda },
                { custom_field_id: RD_CUSTOM_FIELDS.REPRESENTANTE, value: negociacao.representante },
                { custom_field_id: RD_CUSTOM_FIELDS.MAQUINA, value: negociacao.maquinainteresse },
                { custom_field_id: RD_CUSTOM_FIELDS.NOTAS, value: "Lead BMAX" },
                { custom_field_id: RD_CUSTOM_FIELDS.PERFIL_PCI, value: negociacao.pci }
            ]
        }
    };

    return await rdFetch("/deals", "POST", body);
}

function normalizeCnpj(raw) {
    return (raw || '').replace(/[.\-\/\s]/g, '');
}

async function getLeadByCnpj(cnpj) {
    const cnpjClean = normalizeCnpj(cnpj);
    if (!cnpjClean) return null;

    const json = await rdFetch(`/deals?deal_pipeline_id=${RD_PIPELINE_INDUSTRIA}&q=${encodeURIComponent(cnpjClean)}&limit=200`);
    const deals = (json.deals || []).filter(d => {
        if (!d.deal_stage || d.deal_stage.id === RD_STAGE_VENDA_EFETIVADA || d.deal_stage.id === RD_STAGE_EXCLUIDO) return false;
        const dealCnpj = normalizeCnpj(getCustomField(d, 'CNPJ'));
        return dealCnpj === cnpjClean;
    });

    return deals.length > 0 ? deals[0] : null;
}

async function updateLead(id, body) {
    const v1Body = {};

    if (body?.data?.stage_id) v1Body.deal_stage_id = body.data.stage_id;
    if (body?.data?.owner_id) v1Body.user_id = body.data.owner_id;

    if (body?.data?.custom_fields) {
        v1Body.deal_custom_fields = [];
        for (const [key, val] of Object.entries(body.data.custom_fields)) {
            const cfId = RD_CF_SLUG_MAP[key];
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
            user_id: taskData.owner_id || taskData.user_id || RD_OWNER_DEFAULT
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

const estados = ESTADOS;
const estagios = RD_STAGES;

async function mapDealToCard(deal, role, creditosMap) {
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
    const pciRaw = (getCustomField(deal, "PERFIL PCI") || orgCfs["PERFIL PCI"] || "").trim();
    const pci = pciRaw.replace(/\s/g, "");

    let cashback = 0;
    const dealId = deal.id || deal._id || "";
    const stageLabel = estagios[stageId] || "";
    if (stageLabel === "Venda Efetivada" || stageLabel === "Vendido") {
        if (creditosMap && dealId in creditosMap) {
            cashback = creditosMap[dealId];
        } else {
            const pciCashback = pci;
            const classeCashback = (getCustomField(deal, "CLASSE DE PREÇO") || "").replace(/\D/g, "");
            const cashbackRole = role === "adm" ? "revenda" : role;
            const comissao = parseFloat(await lerPlanilhaCashback(pciCashback, cashbackRole, classeCashback)) || 0;
            cashback = Number(deal.amount_total || 0) * Number(comissao || 0);
        }
    }

    const criadoem = new Date(deal.created_at).toLocaleDateString("pt-BR");
    const nextTask = deal.next_task || {};
    const tarefa = nextTask.subject || "Sem Tarefa Ativa";
    let datatarefa = nextTask.date ? " - " + new Date(nextTask.date).toLocaleDateString("pt-BR") : "";
    if (datatarefa === " - Invalid Date") datatarefa = "";

    const tag = estagios[stageId] || "??????";

    const classePreco = (getCustomField(deal, "CLASSE DE PREÇO") || "").replace(/\D/g, "");

    return {
        id: deal.id || deal._id || "?????",
        nome: deal.name || "?????",
        cnpj,
        cidade,
        estado,
        maquinainteresse,
        valor: deal.amount_total || 0,
        pci,
        classePreco,
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
    getLeadByCnpj,
    getLeadNotes,
    mapDealToCard,
    getCustomField
};
