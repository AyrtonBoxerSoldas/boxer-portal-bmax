const { getValidAccessToken, refreshAccessToken } = require("./rd.auth.service");
const { lerPlanilhaCashback } = require("./cashback.service");
const { response } = require("express");

const RD_CRM_URL = 'https://api.rd.services/crm/v2/';

async function getLeads(username, role) {
    let token = await getValidAccessToken();
    let leads = [];
    let pagina = 1;

    console.log("Token Atual:", token.access_token);
    console.log(role);
    let url = `${RD_CRM_URL}deals?filter=pipeline_id:"66151c1470449b000d54e914"%20AND%20-stage_id:"66151c4859f00e001209d066" AND created_at:>"2026-05-01T03:00:00Z"` /* AND stage_id:"678f7e08dc0b4800142783ac"*/ /* AND @pessoa_pci:(1, 2, 3)*/;
    if (role === "revenda")
    {
        if (username.includes("Luitex"))
        {
            url = `${url} AND (@revenda-loja:"Luitex Americana" OR @revenda-loja:"Luitex Sbo" OR @revenda-loja:"Luitex Sumare" OR @revenda-loja:"Luitex Mogi Guacu")`;
        }
        else
        {
            url = `${url} AND @revenda-loja:"${username}"`;
        } 
    }
    else if (role === "representante")
    {
        if (username.includes("Victor VLM"))
        {
            url = `${url} AND @representante:"Victor Lantyer"`;
        }
        else if (username.includes("Caio P Mancini"))
        {
            url = `${url} AND (@representante:"Caio P Mancini" OR @representante:"Caio Tito")`;
        }
        else
        {
            url = `${url} AND @representante:"${username}"`;
        }
    }
    else
    {
        url = `${url}`;
    }

    let urlpagina = `${url}&page[number]=${pagina}&page[size]=50`;

    while (true)
    {
        console.log(urlpagina);
        let res = await fetch(urlpagina, {
            method: "GET",
            headers: {
                "Authorization": `Bearer ${token.access_token}`
            }
        });
    
        console.log("Status da resposta RD Leads:", res.status);
    
        if (res.status === 401) {
            token = await refreshAccessToken(token.refresh_token);

            res = await fetch(urlpagina, {
                method: "GET",
                headers: {
                    "Authorization": `Bearer ${token.access_token}`
                }
            });
        }

        if (res.status === 403) {
            console.warn("RD Leads retornou 403 Forbidden");
        }
        const json = await res.json();
        console.log("Resposta Bruta RD Leads:", json);

        if (res.status === 429) {
            console.warn("RD Leads retornou 429 Rate Limit");
            throw new Error("Rate limit atingido na API do RD Station. Tente novamente em alguns segundos.");
        }

        if (!res.ok) {
            console.log("Erro ao buscar leads RD:", json);
            throw new Error(json?.message || "Erro ao buscar leads do RD");
        }

        if(!json.data || json.data.length === 0)
        {
            break;
        }

        leads = leads.concat(json.data);
        pagina++;
        urlpagina = `${url}&page[number]=${pagina}&page[size]=50`;
    }

    return leads;
}

async function createLead(negociacao) {
    let token = await getValidAccessToken();
    let url = `${RD_CRM_URL}deals`;

    const formattedCnpj = negociacao.cnpj.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, "$1.$2.$3/$4-$5");
    const formattedCep = String(negociacao.cep || "").replace(/\D/g, "").replace(/^(\d{5})(\d{3})$/, "$1-$2");
    
    let organization = await getOrgByCNPJ(formattedCnpj);

    if (!organization) {
        const orgData = {
            name: negociacao.nome,
            owner_id: "6a312b777a6c170023b6427d",
            custom_fields: {
                "cnpj": formattedCnpj,
                "cep": formattedCep,
                "cidade": negociacao.cidade
            }
        };
        organization = await createOrg(orgData);
    }

    const organization_id = organization.id;
    
    const pci = negociacao.pci || "PCI 12";
    const representante = negociacao.representante || "N/D";
    let nomeusuario;
    
    switch (negociacao.usuario)
    {
        case "Caio P Mancini":
            nomeusuario = "Caio Tito";
            break;
        case "Victor VLM":
            nomeusuario = "Victor Lantyer";
            break;
        case "Patrick":
            nomeusuario = "Patrick Ferreira";
            break;
        case "Carlos":
            nomeusuario = "Carlos Alberto";
            break;
        case "Weberson":
            nomeusuario = "Weberson Rodrigues";
            break;
        default:
            nomeusuario = negociacao.usuario;
            break;
    }
    
    const IdPorResponsavel = {
        "Carlos": "66152391467aac000da67451",
        "Lucas Ferreira": "69c5314a81439100135437c7",
        "Max": "6a2007b8b9704500268c5624",
        "Revenda": "661572a5823cb7000e85e146",
        "Representante": "661572a5823cb7000e85e146"
    }
    
    const responsavelId = IdPorResponsavel[negociacao.responsavel];
    
    const pipeline = responsavelId === "661572a5823cb7000e85e146" ? "6a2bff35a294cf00226dd600" : representante === "N/D" ? "6a2bff35a294cf00226dd600" : representante === nomeusuario ? "6a2bff35a294cf00226dd600" : "66151c1470449b000d54e914";
    const stage = responsavelId === "661572a5823cb7000e85e146" ? "6a2bff35a294cf00226dd602" : representante === "N/D" ? "6a2bff35a294cf00226dd602" : representante === nomeusuario ? "6a2bff35a294cf00226dd602" : "678f7e08dc0b4800142783ac";

    const body = {
        data: {
            name: negociacao.nome,
            pipeline_id: `${pipeline}`,
            stage_id: `${stage}`,
            owner_id: `${responsavelId}`,
            organization_id: organization_id,
            custom_fields: {
                "cnpj": formattedCnpj,
                "cidade": negociacao.cidade,
                "revenda-loja": negociacao.revenda,
                "representante": negociacao.representante,
                "maquina-de-interesse-1": negociacao.maquinainteresse,
                "notas": "Lead BMAX",
                "perfil-pci": negociacao.pci
            }
        }
    };

    console.log("URL:", url);
    console.log("Token:", token.access_token);
    console.log("Body:", JSON.stringify(body, null, 2));

    let res = await fetch(url, {
        method: "POST",
        headers: {
            "Authorization": `Bearer ${token.access_token}`,
            "Content-Type": "application/json"
        },
        body: JSON.stringify(body)
    });

    console.log("Status da resposta RD Cria Lead:", res.status);

    if (res.status === 401) {
        token = await refreshAccessToken(token.refresh_token);

        res = await fetch(url, {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${token.access_token}`,
                "Content-Type": "application/json"
            },
            body: JSON.stringify(body)
        });
    }

    const jsonResponse = await res.json();

    console.log("STATUS:", res.status);
    console.log("HEADERS:", Object.fromEntries(res.headers.entries()));
    console.log("BODY (parsed):", jsonResponse);

    if (!res.ok)
    {
        // Usa a mensagem do JSON se disponível, ou a mensagem padrão
        throw new Error(`Erro ao criar Lead no RD ${res.status}: ${jsonResponse?.message || JSON.stringify(jsonResponse)}`);
    }

    return jsonResponse; // Retorna o objeto JSON parseado
}

async function getLeadByName(leadName) {
    let token = await getValidAccessToken();
    // A API do RD CRM permite filtrar leads (deals) por nome
    let url = `${RD_CRM_URL}deals?filter=pipeline_id:"66151c1470449b000d54e914"%20AND%20-stage_id:"66151c1470449b000d54e919"%20AND%20-stage_id:"66151c4859f00e001209d066"%20AND%20name:"${leadName}"`;

    console.log("URL (getLeadByName):", url);

    let res = await fetch(url, {
        method: "GET",
        headers: {
            "Authorization": `Bearer ${token.access_token}`
        }
    });

    console.log("Status da resposta RD Buscar Lead por Nome Funil Indústria - Interno:", res.status);

    if (res.status === 401) {
        token = await refreshAccessToken(token.refresh_token);

        res = await fetch(url, {
            method: "GET",
            headers: {
                "Authorization": `Bearer ${token.access_token}`
            }
        });
    }

    let json = await res.json();

    if (!res.ok) {
        console.log("Erro ao buscar Lead por Nome RD:", json);
        throw new Error(json?.message || "Erro ao buscar Lead por Nome no RD");
    }

    if (res.status === 200 && Array.isArray(json?.data) && json.data.length === 0)
    {
        token = await getValidAccessToken();
        url = `${RD_CRM_URL}deals?filter=pipeline_id:"68b19e2883a5f700170072d3"%20AND%20-stage_id:"68b19eeab3e5a3001b7c83b6"%20AND%20-stage_id:"68b19ef1fd3c29001b0a118a"%20AND%20name:"${leadName}"`;

        res = await fetch(url, {
            method: "GET",
            headers: {
                "Authorization": `Bearer ${token.access_token}`
            }
        });
    
        console.log("Status da resposta RD Buscar Lead por Nome Funil SDR:", res.status);

        if (res.status === 401) {
            token = await refreshAccessToken(token.refresh_token);

            res = await fetch(url, {
                method: "GET",
                headers: {
                    "Authorization": `Bearer ${token.access_token}`
                }
            })
        }

        json = await res.json();
    }
    // A API retorna um array de leads. Retornamos o primeiro se houver.
    // Se não houver resultados, json.data será um array vazio.
    return json.data && json.data.length > 0 ? json.data[0] : null;
}

async function updateLead(id, body)
{
    let token = await getValidAccessToken();
    let url = `${RD_CRM_URL}deals/${id}`;

    let res = await fetch(url, {
        method: "PUT",
        headers: {
            "Authorization": `Bearer ${token.access_token}`,
            "Content-Type": "application/json"
        },
        body: JSON.stringify(body)
    });

    console.log("Body RD Update Lead:", body);
    console.log("Status da resposta RD Update Lead:", res.status);

    if (res.status === 401) {
        token = await refreshAccessToken(token.refresh_token);

        res = await fetch(url, {
            method: "PUT",
            headers: {
                "Authorization": `Bearer ${token.access_token}`,
                "Content-Type": "application/json"
            },
            body: JSON.stringify(body)
        });
    }

    if (res.status === 403) {
        console.warn("RD Update retornou 403 Forbidden");
    }

    if (res.status === 429) {
        console.warn("RD Update retornou 429 Rate Limit");
        throw new Error("Rate limit atingido na API do RD Station. Tente novamente em alguns segundos.");
    }

    const json = await res.json();

    return json;
}

async function getOrg(id) {
    console.log(id);
    if (id === "Vazio")
    {
        return "Vazio";
    }
    let token = await getValidAccessToken();
    let url = `${RD_CRM_URL}organizations/${id}`;

    console.log(url);

    let res = await fetch(url, {
        method: "GET",
        headers: {
            "Authorization": `Bearer ${token.access_token}`
        }
    });

    console.log("Status da resposta RD Revenda:", res.status);

    if (res.status === 401) {
        token = await refreshAccessToken(token.refresh_token);

        res = await fetch(url, {
            method: "GET",
            headers: {
                "Authorization": `Bearer ${token.access_token}`,
                "Content-type": "application/json"
            }
        });
    }

    if (res.status === 403) {
        console.warn("RD Revenda retornou 403 Forbidden");
    }
    const json = await res.json();
    //console.log("Resposta Bruta RD Revenda:", json);

    if (!res.ok) {
        console.log("Erro ao buscar Revenda RD:", json);
        throw new Error(json?.message || "Erro ao buscar Revenda do RD");
    }

    //console.log("Cidade:", json.data.custom_fields.cidade || "Não Tem");
    console.log("Data RD Revenda:", json.data);
    return json.data;
}

async function getTask(id) {
    console.log("ID Tarefa: ", id);
    let token = await getValidAccessToken();
    let url = `${RD_CRM_URL}tasks?filter=deal_id:${id}`;

    console.log("URL Tarefa: ", url);

    let res = await fetch(url, {
        method: "GET",
        headers: {
            "Authorization": `Bearer ${token.access_token}`
        }
    });

    console.log("Resposta RD Tarefa:", res);
    console.log("Status da resposta RD Tarefa:", res.status);

    if (res.status === 401) {
        token = await refreshAccessToken(token.refresh_token);

        res = await fetch(url, {
            method: "GET",
            headers: {
                "Authorization": `Bearer ${token.access_token}`
            }
        });
    }

    if (res.status === 403)
    {
        console.warn("RD Tarefa retornou 403 Forbidden");
    }
    const json = await res.json();

    if (!res.ok) {
        console.log("Erro ao buscar Tarefa RD:", json);
        throw new Error(json?.message || "Erro ao buscar Tarefa do RD");
    }

    console.log("Data RD Tarefa:", json);
    return json.data;
}

async function createTask(taskData) {
    let token = await getValidAccessToken();
    let url = `${RD_CRM_URL}tasks`;

    const body = {
        data: taskData
    };

    let res = await fetch(url, {
        method: "POST",
        headers: {
            "Authorization": `Bearer ${token.access_token}`,
            "Content-Type": "application/json"
        },
        body: JSON.stringify(body)
    });

    console.log("Status da resposta RD Criar Tarefa:", res.status);

    if (res.status === 401) {
        token = await refreshAccessToken(token.refresh_token);

        res = await fetch(url, {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${token.access_token}`,
                "Content-Type": "application/json"
            },
            body: JSON.stringify(body)
        });
    }

    const json = await res.json();

    if (!res.ok) {
        console.log("Erro ao criar Tarefa RD:", json);
        throw new Error(json?.message || "Erro ao criar Tarefa no RD");
    }

    return json.data;
}

async function updateTask(taskData, id) {
    let token = await getValidAccessToken();
    let url = `${RD_CRM_URL}tasks/${id}`;

    const body = {
        data: taskData
    };

    let res = await fetch(url, {
        method: "PUT",
        headers: {
            "Authorization": `Bearer ${token.access_token}`,
            "Content-Type": "application/json"
        },
        body: JSON.stringify(body)
    });

    console.log("Status da resposta RD Atualizar Tarefa:", res.status);

    if (res.status === 401) {
        token = await refreshAccessToken(token.refresh_token);

        res = await fetch(url, {
            method: "PUT",
            headers: {
                "Authorization": `Bearer ${token.access_token}`,
                "Content-Type": "application/json"
            },
            body: JSON.stringify(body)
        });
    }

    const json = await res.json();

    if (!res.ok) {
        console.log("Erro ao atualizar Tarefa RD:", json);
        throw new Error(json?.message || "Erro ao atualizar Tarefa no RD");
    }

    return json.data;
}

async function createOrg(orgData) {
    let token = await getValidAccessToken();
    let url = `${RD_CRM_URL}organizations`;

    // O RD CRM espera os dados da organização dentro da chave 'data'
    const body = {
        data: orgData
    };

    console.log("URL (createOrg):", url);
    console.log("Body (createOrg):", JSON.stringify(body, null, 2));

    let res = await fetch(url, {
        method: "POST",
        headers: {
            "Authorization": `Bearer ${token.access_token}`,
            "Content-Type": "application/json"
        },
        body: JSON.stringify(body)
    });

    console.log("Status da resposta RD Criar Organização:", res.status);

    if (res.status === 401) {
        token = await refreshAccessToken(token.refresh_token);

        res = await fetch(url, {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${token.access_token}`,
                "Content-Type": "application/json"
            },
            body: JSON.stringify(body)
        });
    }

    const json = await res.json();

    if (!res.ok) {
        console.log("Erro ao criar Organização RD:", json);
        throw new Error(json?.message || "Erro ao criar Organização no RD");
    }

    return json.data;
}

async function  getOrgByCNPJ(cnpj) {
    let token = await getValidAccessToken();
    let url = `${RD_CRM_URL}organizations?filter=@cnpj:"${cnpj}"`;

    console.log("URL (getOrgByCNPJ):", url);

    let res = await fetch(url, {
        method: "GET",
        headers: {
            "Authorization": `Bearer ${token.access_token}`
        }
    });

    console.log("Status da resposta RD Buscar Organização por CNPJ:", res.status);

    if (res.status === 401) {
        token = await refreshAccessToken(token.refresh_token);

        res = await fetch(url, {
            method: "GET",
            headers: {
                "Authorization": `Bearer ${token.access_token}`
            }
        });
    }

    const json = await res.json();

    if (!res.ok) {
        console.log("Erro ao buscar Organização por CNPJ RD:", json);
        throw new Error(json?.message || "Erro ao buscar Organização por CNPJ no RD");
    }

    // A API retorna um array de organizações. Retornamos a primeira se houver.
    // Se não houver resultados, json.data será um array vazio.
    return json.data.length > 0 ? json.data[0] : null;
}

async function getLeadNotes(deal_id) {
    let token = await getValidAccessToken();
    let url = `${RD_CRM_URL}deals/${deal_id}/notes`;

    console.log("URL (getLeadNotes):", url);

    let res = await fetch(url, {
        method: "GET",
        headers: {
            "Authorization": `Bearer ${token.access_token}`
        }
    });

    console.log("Status da resposta RD buscar histórico do lead:", res.status);

    if (res.status === 401) {
        token = await refreshAccessToken(token.refresh_token);

        res = await fetch(url, {
            method: "GET",
            headers: {
                "Authorization": `Bearer ${token.access_token}`
            }
        });
    }

    const json = await res.json();

    if (!res.ok) {
        console.log("Erro ao buscar histórico do lead RD:", json);
        throw new Error(json?.message || "Erro ao buscar histórico do lead RD");
    }

    return json;
}
const estados = {
    "Acre": "AC",
    "Alagoas": "AL",
    "Amapá": "AP",
    "Amazonas": "AM",
    "Bahia": "BA",
    "Ceará": "CE",
    "Distrito Federal": "DF",
    "Espírito Santo": "ES",
    "Goiás": "GO",
    "Maranhão": "MA",
    "Mato Grosso": "MT",
    "Mato Grosso do Sul": "MS",
    "Minas Gerais": "MG",
    "Pará": "PA",
    "Paraíba": "PB",
    "Paraná": "PR",
    "Pernambuco": "PE",
    "Piauí": "PI",
    "Rio de Janeiro": "RJ",
    "Rio Grande do Norte": "RN",
    "Rio Grande do Sul": "RS",
    "Rondônia": "RO",
    "Roraima": "RR",
    "Santa Catarina": "SC",
    "São Paulo": "SP",
    "Sergipe": "SE",
    "Tocantins": "TO"
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
    console.log("Deal:", deal);
    const task = await getTask(deal?.id || "Vazio");
    console.log("Teste Task: ", task);
    const org = await getOrg(deal?.organization_id || "Vazio");
    const cnpj = (deal?.custom_fields?.cnpj || org.custom_fields?.cnpj).replace(/\D/g, "").replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/,"$1.$2.$3/$4-$5") || "?????";
    const cidade = deal?.custom_fields?.cidade || org?.custom_fields?.cidade || "?????";
    const estado = deal?.custom_fields?.estado || "??";
    const representante = deal?.custom_fields?.representante || "?????";
    const revenda = deal?.custom_fields?.['revenda-loja'] || "?????";
    const maquinainteresse = deal?.custom_fields?.['maquina-de-interesse-1'] || "?????";
    const pci = deal?.custom_fields?.["perfil-pci"]?.replace(/\s/g, "") || org?.custom_fields?.["perfil-pci"]?.replace(/\s/g, "");
    /*
    if (pci === "PCI15")
    {
        const created_at = new Date(deal?.created_at);
        const agora = new Date();
        const diffHoras = (agora - created_at) / (1000 * 60 * 60);
        if (diffHoras > 24) {
            const body = {
                data: {
                    custom_fields: {
                        "perfil-pci": "PCI 16"
                    }
                }
            };
            await updateLead(deal?.id, body);
        }
    }
    */
    let cashback = 0;
    if (estagios[deal?.stage_id] === "Venda Efetivada"/*66151c1470449b000d54e919*/)
    {
        console.log("Venda Efetivada: ", org?.custom_fields?.["perfil-pci"]?.replace(/\s/g, ""));
        const comissao = parseFloat(await lerPlanilhaCashback(org?.custom_fields?.["perfil-pci"]?.replace(/\s/g, "") || "", role, deal?.["classe-de-preco"]?.replace(/\D/g, "") || "")) || 0;
        console.log("Comissao: ", comissao);
        cashback = Number(deal?.total_price || 0) * Number(comissao || 0);
        console.log("Cashback: ", cashback);
    }
    const criadoem = new Date(deal?.created_at).toLocaleDateString("pt-BR") || "?????";
    const tarefa = task[0]?.name || "Sem Tarefa Ativa";
    let datatarefa = " - " + new Date(task?.created_at).toLocaleDateString("pt-BR") || "";
    if (datatarefa === " - Invalid Date")
    {
        datatarefa = "";
    }

    console.log("Encontrou Cidade:", cidade);
    
    /*
    if (cidadeRaw !== "Vazio")
    {
        const cidade = cidadeRaw.split("-")[0].trim();
        const sigla = estados[cidadeRaw.split("-")[1].split("/")[0].trim()] || "??";
        cidadeCard = `${cidade}/${sigla}`;
    }
    */
    const tag = estagios[deal?.stage_id] || "??????";
    
    console.log("Tag:", tag);
    return {
        id: deal.id || "?????",
        nome: deal.name || "?????",
        cnpj: cnpj,
        cidade: cidade,
        estado: estado,
        maquinainteresse: maquinainteresse,
        valor: deal?.total_price || 0,
        pci: pci,
        criadoem: criadoem,
        representante: representante,
        revenda: revenda,
        tag: tag,
        cashback: cashback,
        tarefa: tarefa,
        datatarefa: datatarefa
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
    mapDealToCard
}
