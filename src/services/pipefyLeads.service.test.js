// Testa a tradução card do Pipefy -> objeto "deal" compatível com
// getCustomField/mapDealToCard/getLeads/caminhoVenda.service.js — sem
// chamar a API real do Pipefy (mock de pipefy.service.js).
//
// Mock padrão de "../database" (Tarefa A6, 2º adendo 23/10/2026): desde que
// o cache tentou persistir no banco, qualquer teste que não mocka
// "../database" explicitamente acabava batendo na conexão REAL (lenta e
// sempre falhando no ambiente de teste). Esse beforeEach de nível de arquivo
// roda ANTES do beforeEach de cada describe (que faz jest.resetModules()) —
// testes que precisam de um comportamento específico do banco (ex.: Tarefa 8,
// A1) chamam o próprio jest.doMock("../database", ...) dentro do `it`, que
// sobrepõe este default.
beforeEach(() => {
    jest.doMock("../database", () => ({ sequelize: { query: jest.fn().mockRejectedValue(new Error("../database não mockado neste teste")) } }));
});

const CAMPOS_COMPARTILHADOS = {
    "Título": "t_tulo",
    "PCI": "pci",
    "CNPJ": "cnpj",
    "Cidade": "cidade",
    "Revenda/Loja": "revenda_loja",
    "Representante": "representante",
    "Máquina de interesse": "m_quina_de_interesse",
    "Valor total": "valor_total",
    "Data de criação no RD": "data_de_cria_o_no_rd",
    "Contato": "contato",
    "Próxima ação": "pr_xima_a_o",
    "Data da próxima ação": "data_da_pr_xima_a_o",
    "ID no RD CRM": "id_no_rd_crm"
};

// No mapa_pipefy.json real, os 4 pipes compartilham os mesmos ids de campo
// (derivados do rótulo pelo Pipefy) — reproduzido aqui com CAMPOS_COMPARTILHADOS.
const MAPA_TESTE = {
    pipes: {
        BMAX: {
            id: "307397065",
            fases: {
                "Leads Revenda": "344532516",
                "Prazo Vencido": "344532517",
                "Venda Efetivada": "344532518",
                "Perdido": "344532575"
            },
            campos: CAMPOS_COMPARTILHADOS
        },
        "INDÚSTRIA - INTERNO": {
            id: "307397025",
            fases: {
                "LEAD": "344500001",
                "EM CONTATO": "344500002",
                "NEGOCIAÇÃO": "344500003",
                "DEMONSTRAÇÃO": "344500004",
                "VENDA EFETIVADA": "344500005",
                "ENTREGA TECNICA": "344500006",
                "PERDIDOS | SEM PERFIL": "344500007"
            },
            campos: CAMPOS_COMPARTILHADOS
        },
        "REVENDA - INTERNO": {
            id: "307397056",
            fases: {
                "LEADS": "344600001",
                "EM CONTATO": "344600002",
                "NEGOCIAÇÕES": "344600003",
                "VENDA EFETIVADA": "344600004",
                "PERDIDOS E SEM PERFIL": "344600005"
            },
            campos: CAMPOS_COMPARTILHADOS
        }
    },
    contatos: { id: "CCt1tB1F", campos: { "Nome": "nome", "E-mail": "e_mail" } },
    empresas: { id: "d-K0ZaIH", campos: {} },
    membros: { "ayrton.oliveira@boxersoldas.com.br": "307413540" }
};

function cardBase(overrides = {}) {
    return {
        id: "999",
        title: "Empresa Teste",
        // Depois do corte de 01/05/2026 que getLeads (rd.leads.service.js)
        // aplica — senão o teste de exclusão por fase filtraria tudo por
        // data, mascarando o que o teste realmente quer checar.
        // created_at/updated_at: nomes confirmados na conta real (20/10/2026,
        // bmax_pipefy_correcoes_adendo.md) — NÃO createdAt.
        created_at: "2026-06-01T10:00:00Z",
        updated_at: "2026-06-01T10:00:00+00:00",
        current_phase: { id: "x", name: "Leads Revenda" },
        fields: [
            { field: { id: "pci" }, value: "PCI 12" },
            { field: { id: "cnpj" }, value: "12345678000199" }
        ],
        assignees: [],
        ...overrides
    };
}

describe("pipefyLeads.service — cardParaDealFake / fetchAllDealsPipefy", () => {
    let RD_STAGE_ASSUMIDO, RD_STAGE_PERDIDO, RD_STAGE_VENDIDO;

    beforeEach(() => {
        jest.resetModules();
        process.env.PIPEFY_MAPA_JSON = JSON.stringify(MAPA_TESTE);
        // Testes aqui usam nomes de fase do pipe BMAX ("Leads Revenda" etc.) —
        // fixa o painel nesse pipe, independente do default real (Tarefa 11).
        process.env.PIPEFY_PIPES_PORTAL = "BMAX";
        ({ RD_STAGE_ASSUMIDO, RD_STAGE_PERDIDO, RD_STAGE_VENDIDO } = require("../config/constants"));
    });

    afterEach(() => {
        delete process.env.PIPEFY_PIPES_PORTAL;
    });

    function loadComMockDeCards(cards) {
        jest.doMock("./pipefy.service", () => ({
            allCardsInPipe: jest.fn().mockResolvedValue(cards)
        }));
        return require("./pipefyLeads.service");
    }

    it("traduz fase 'Leads Revenda' -> RD_STAGE_ASSUMIDO, win null", async () => {
        const { fetchAllDealsPipefy } = loadComMockDeCards([cardBase()]);
        const [deal] = await fetchAllDealsPipefy();

        expect(deal.deal_stage.id).toBe(RD_STAGE_ASSUMIDO);
        expect(deal.deal_stage.name).toBe("Leads Revenda");
        expect(deal.win).toBeNull();
    });

    it("traduz fase 'Venda Efetivada' -> RD_STAGE_VENDIDO, win true, e lê 'Valor total'", async () => {
        const card = cardBase({
            current_phase: { id: "x", name: "Venda Efetivada" },
            fields: [
                { field: { id: "pci" }, value: "PCI 12b" },
                { field: { id: "valor_total" }, value: "R$ 1.234,56" }
            ]
        });
        const { fetchAllDealsPipefy } = loadComMockDeCards([card]);
        const [deal] = await fetchAllDealsPipefy();

        expect(deal.deal_stage.id).toBe(RD_STAGE_VENDIDO);
        expect(deal.win).toBe(true);
        expect(deal.amount_total).toBeCloseTo(1234.56);
    });

    it("traduz fase 'Prazo Vencido' -> RD_STAGE_PERDIDO, win null (não é perda genuína)", async () => {
        const card = cardBase({ current_phase: { id: "x", name: "Prazo Vencido" } });
        const { fetchAllDealsPipefy } = loadComMockDeCards([card]);
        const [deal] = await fetchAllDealsPipefy();

        expect(deal.deal_stage.id).toBe(RD_STAGE_PERDIDO);
        expect(deal.deal_stage.name).toBe("Prazo Vencido");
        expect(deal.win).toBeNull();
    });

    it("traduz fase 'Perdido' -> também RD_STAGE_PERDIDO (pra filtro/bloqueio), win false", async () => {
        const card = cardBase({ current_phase: { id: "x", name: "Perdido" } });
        const { fetchAllDealsPipefy } = loadComMockDeCards([card]);
        const [deal] = await fetchAllDealsPipefy();

        expect(deal.deal_stage.id).toBe(RD_STAGE_PERDIDO);
        expect(deal.deal_stage.name).toBe("Perdido");
        expect(deal.win).toBe(false);
    });

    it("usa o campo 'Data de criação no RD' quando presente (negociação migrada)", async () => {
        const card = cardBase({
            created_at: "2026-06-01T00:00:00Z",
            fields: [
                { field: { id: "pci" }, value: "PCI 12" },
                { field: { id: "data_de_cria_o_no_rd" }, value: "2024-03-15" }
            ]
        });
        const { fetchAllDealsPipefy } = loadComMockDeCards([card]);
        const [deal] = await fetchAllDealsPipefy();

        expect(deal.created_at).toBe("2024-03-15");
    });

    it("cai pro card.created_at quando não tem 'Data de criação no RD' (negociação nova)", async () => {
        const { fetchAllDealsPipefy } = loadComMockDeCards([cardBase()]);
        const [deal] = await fetchAllDealsPipefy();

        expect(deal.created_at).toBe("2026-06-01T10:00:00Z");
    });

    describe.each([
        ["2026-05-12", "2026-05-12"],
        ["12/05/2026", "2026-05-12"],
        ["12/05/2026 10:30", "2026-05-12T10:30"],
        ["lixo", null]
    ])("'Data de criação no RD' = %s (Tarefa B4, 2º adendo)", (valorBruto, esperado) => {
        it(`vira ${esperado}`, async () => {
            const card = cardBase({
                fields: [
                    { field: { id: "pci" }, value: "PCI 12" },
                    { field: { id: "data_de_cria_o_no_rd" }, value: valorBruto }
                ]
            });
            const { fetchAllDealsPipefy } = loadComMockDeCards([card]);
            const [deal] = await fetchAllDealsPipefy();

            if (esperado) {
                expect(deal.created_at).toBe(esperado);
            } else {
                // formato não reconhecido: cai pro created_at do card, não numa data errada silenciosa
                expect(deal.created_at).toBe(card.created_at);
            }
        });
    });

    it("lê nome/e-mail do primeiro assignee como 'user'", async () => {
        const card = cardBase({ assignees: [{ id: "1", name: "Carlos", email: "carlos@boxersoldas.com.br" }] });
        const { fetchAllDealsPipefy } = loadComMockDeCards([card]);
        const [deal] = await fetchAllDealsPipefy();

        expect(deal.user).toEqual({ name: "Carlos", email: "carlos@boxersoldas.com.br" });
    });

    it("sem assignees, user é null (sem equivalente)", async () => {
        const { fetchAllDealsPipefy } = loadComMockDeCards([cardBase({ assignees: [] })]);
        const [deal] = await fetchAllDealsPipefy();

        expect(deal.user).toBeNull();
    });

    it("amount_total aceita formato americano '1234.56'", async () => {
        const card = cardBase({ fields: [{ field: { id: "valor_total" }, value: "1234.56" }] });
        const { fetchAllDealsPipefy } = loadComMockDeCards([card]);
        const [deal] = await fetchAllDealsPipefy();

        expect(deal.amount_total).toBeCloseTo(1234.56);
    });

    it("getLeads (rd.leads.service, CRM_PROVIDER=pipefy) exclui leads em 'Prazo Vencido' e 'Perdido' do painel", async () => {
        process.env.CRM_PROVIDER = "pipefy";
        process.env.RD_CRM_TOKEN = "x";
        const cards = [
            cardBase({ id: "1", current_phase: { id: "x", name: "Leads Revenda" } }),
            cardBase({ id: "2", current_phase: { id: "x", name: "Prazo Vencido" } }),
            cardBase({ id: "3", current_phase: { id: "x", name: "Perdido" } }),
            cardBase({ id: "4", current_phase: { id: "x", name: "Venda Efetivada" } })
        ];
        jest.doMock("./pipefy.service", () => ({
            allCardsInPipe: jest.fn().mockResolvedValue(cards)
        }));
        const { getLeads } = require("./rd.leads.service");

        const leads = await getLeads("adm", "adm");

        const ids = leads.map(l => l.id).sort();
        expect(ids).toEqual(["1", "4"]);
    });
});

describe("pipefyLeads.service — cache de fetchAllDealsPipefy (Tarefa 4)", () => {
    beforeEach(() => {
        jest.resetModules();
        process.env.PIPEFY_MAPA_JSON = JSON.stringify(MAPA_TESTE);
    });

    it("duas chamadas seguidas fazem só UMA busca real (cache)", async () => {
        const allCardsInPipe = jest.fn().mockResolvedValue([cardBase()]);
        jest.doMock("./pipefy.service", () => ({ allCardsInPipe }));
        const { fetchAllDealsPipefy } = require("./pipefyLeads.service");

        await fetchAllDealsPipefy();
        await fetchAllDealsPipefy();

        expect(allCardsInPipe).toHaveBeenCalledTimes(1);
    });

    it("chamadas concorrentes deduplicam na mesma busca (sem cache ainda quente)", async () => {
        const allCardsInPipe = jest.fn().mockResolvedValue([cardBase()]);
        jest.doMock("./pipefy.service", () => ({ allCardsInPipe }));
        const { fetchAllDealsPipefy } = require("./pipefyLeads.service");

        await Promise.all([fetchAllDealsPipefy(), fetchAllDealsPipefy(), fetchAllDealsPipefy()]);

        expect(allCardsInPipe).toHaveBeenCalledTimes(1);
    });

    it("invalidarCachePipefy força nova busca completa na próxima chamada", async () => {
        const allCardsInPipe = jest.fn().mockResolvedValue([cardBase()]);
        jest.doMock("./pipefy.service", () => ({ allCardsInPipe }));
        const { fetchAllDealsPipefy, invalidarCachePipefy } = require("./pipefyLeads.service");

        await fetchAllDealsPipefy();
        invalidarCachePipefy();
        await fetchAllDealsPipefy();

        expect(allCardsInPipe).toHaveBeenCalledTimes(2);
    });

    it("leitura completa de novo depois de 24h, mesmo com cache ainda dentro do PIPEFY_CACHE_MIN", async () => {
        const allCardsInPipe = jest.fn().mockResolvedValue([cardBase()]);
        jest.doMock("./pipefy.service", () => ({ allCardsInPipe, allCardsAtualizadosDesde: jest.fn() }));
        const { fetchAllDealsPipefy } = require("./pipefyLeads.service");

        const agora = Date.now();
        jest.spyOn(Date, "now").mockReturnValue(agora);
        await fetchAllDealsPipefy();
        jest.spyOn(Date, "now").mockReturnValue(agora + 25 * 60 * 60 * 1000); // +25h
        await fetchAllDealsPipefy();

        expect(allCardsInPipe).toHaveBeenCalledTimes(2);
        Date.now.mockRestore();
    });

    it("entre a leitura inicial e as 24h, usa leitura incremental (allCardsAtualizadosDesde) em vez de completa", async () => {
        const allCardsInPipe = jest.fn().mockResolvedValue([cardBase({ id: "1", updated_at: "2026-06-01T10:00:00+00:00" })]);
        const allCardsAtualizadosDesde = jest.fn().mockResolvedValue([cardBase({ id: "2" })]);
        jest.doMock("./pipefy.service", () => ({ allCardsInPipe, allCardsAtualizadosDesde }));
        const { fetchAllDealsPipefy } = require("./pipefyLeads.service");

        const agora = Date.now();
        jest.spyOn(Date, "now").mockReturnValue(agora);
        await fetchAllDealsPipefy();
        process.env.PIPEFY_CACHE_MIN = "1";
        jest.spyOn(Date, "now").mockReturnValue(agora + 5 * 60 * 1000); // +5 min >= 1 min de cache
        const deals = await fetchAllDealsPipefy();

        expect(allCardsInPipe).toHaveBeenCalledTimes(1);
        // A referência é o maior updated_at JÁ VISTO no cache (achado real,
        // 20/10/2026) — não a hora do relógio local (Date.now()).
        expect(allCardsAtualizadosDesde).toHaveBeenCalledWith("307397025", "2026-06-01T10:00:00+00:00");
        expect(deals.map(d => d.id).sort()).toEqual(["1", "2"]); // mescla com o que já tinha no cache
        Date.now.mockRestore();
        delete process.env.PIPEFY_CACHE_MIN;
    });

    it("sem nenhum updated_at no cache (pipe vazio na leitura inicial), não tenta o filtro incremental", async () => {
        const allCardsInPipe = jest.fn().mockResolvedValue([]);
        const allCardsAtualizadosDesde = jest.fn();
        jest.doMock("./pipefy.service", () => ({ allCardsInPipe, allCardsAtualizadosDesde }));
        const { fetchAllDealsPipefy } = require("./pipefyLeads.service");

        const agora = Date.now();
        jest.spyOn(Date, "now").mockReturnValue(agora);
        await fetchAllDealsPipefy();
        process.env.PIPEFY_CACHE_MIN = "1";
        jest.spyOn(Date, "now").mockReturnValue(agora + 5 * 60 * 1000);
        const deals = await fetchAllDealsPipefy();

        expect(allCardsAtualizadosDesde).not.toHaveBeenCalled();
        expect(allCardsInPipe).toHaveBeenCalledTimes(1);
        expect(deals).toEqual([]);
        Date.now.mockRestore();
        delete process.env.PIPEFY_CACHE_MIN;
    });

    it("se a leitura incremental falhar, cai pra leitura completa sem quebrar", async () => {
        const allCardsInPipe = jest.fn().mockResolvedValue([cardBase({ id: "1" })]);
        const allCardsAtualizadosDesde = jest.fn().mockRejectedValue(new Error("filtro não suportado"));
        jest.doMock("./pipefy.service", () => ({ allCardsInPipe, allCardsAtualizadosDesde }));
        const { fetchAllDealsPipefy } = require("./pipefyLeads.service");

        const agora = Date.now();
        jest.spyOn(Date, "now").mockReturnValue(agora);
        await fetchAllDealsPipefy();
        process.env.PIPEFY_CACHE_MIN = "1";
        jest.spyOn(Date, "now").mockReturnValue(agora + 5 * 60 * 1000);
        const deals = await fetchAllDealsPipefy();

        expect(allCardsAtualizadosDesde).toHaveBeenCalledTimes(1);
        expect(allCardsInPipe).toHaveBeenCalledTimes(2); // fallback: leitura completa de novo
        expect(deals.map(d => d.id)).toEqual(["1"]);
        Date.now.mockRestore();
        delete process.env.PIPEFY_CACHE_MIN;
    });

    it("createLeadPipefy atualiza só o card criado no cache, sem forçar nova leitura completa do pipe", async () => {
        const allCardsInPipe = jest.fn().mockResolvedValue([cardBase({ id: "1" })]);
        const createCard = jest.fn().mockResolvedValue({ id: "novo-card" });
        const getCard = jest.fn().mockResolvedValue(cardBase({ id: "novo-card", pipe: { id: "307397025", name: "INDÚSTRIA - INTERNO" } }));
        jest.doMock("./pipefy.service", () => ({ allCardsInPipe, createCard, getCard }));
        const { fetchAllDealsPipefy, createLeadPipefy } = require("./pipefyLeads.service");

        await fetchAllDealsPipefy(); // aquece o cache do pipe padrão (INDÚSTRIA - INTERNO)
        await createLeadPipefy({ nome: "Cliente X", cnpj: "11222333000144", role: "representante", funil: "industria" });
        const deals = await fetchAllDealsPipefy();

        expect(allCardsInPipe).toHaveBeenCalledTimes(1); // sem releitura completa
        expect(getCard).toHaveBeenCalledWith("novo-card");
        expect(deals.map(d => d.id).sort()).toEqual(["1", "novo-card"]);
    });
});

describe("pipefyLeads.service — cache no banco, sobrevive a instância nova (Tarefa A6, 2º adendo)", () => {
    beforeEach(() => {
        jest.resetModules();
        process.env.PIPEFY_MAPA_JSON = JSON.stringify(MAPA_TESTE);
    });

    it("instância nova (cache em memória vazio) carrega do banco antes de chamar allCardsInPipe, e a 1ª listagem usa allCardsAtualizadosDesde", async () => {
        const agora = Date.now();
        const query = jest.fn().mockImplementation((sql) => {
            if (sql.includes("bmax_pipefy_cache_estado")) {
                return Promise.resolve([{ maior_updated_at: "2026-06-01T10:00:00+00:00", ultima_leitura_completa: new Date(agora - 60 * 60 * 1000) }]);
            }
            if (sql.includes("bmax_pipefy_cache_cards")) {
                return Promise.resolve([{ card_id: "1", card: JSON.stringify(cardBase({ id: "1" })) }]);
            }
            return Promise.resolve([]);
        });
        jest.doMock("../database", () => ({ sequelize: { query } }));
        const allCardsInPipe = jest.fn();
        const allCardsAtualizadosDesde = jest.fn().mockResolvedValue([]);
        jest.doMock("./pipefy.service", () => ({ allCardsInPipe, allCardsAtualizadosDesde }));
        const { fetchAllDealsPipefy } = require("./pipefyLeads.service");

        process.env.PIPEFY_CACHE_MIN = "1"; // cache do banco tem 1h, já vencido
        const deals = await fetchAllDealsPipefy();

        expect(allCardsInPipe).not.toHaveBeenCalled(); // não fez leitura completa
        expect(allCardsAtualizadosDesde).toHaveBeenCalledWith(expect.any(String), "2026-06-01T10:00:00+00:00"); // referência veio do banco
        expect(deals.map(d => d.id)).toEqual(["1"]); // card do banco apareceu no resultado
        delete process.env.PIPEFY_CACHE_MIN;
    });

    it("sem nada no banco (cold start de verdade), faz leitura completa normalmente e grava no banco depois", async () => {
        const query = jest.fn().mockResolvedValue([]); // SELECT não acha nada
        jest.doMock("../database", () => ({ sequelize: { query } }));
        const allCardsInPipe = jest.fn().mockResolvedValue([cardBase({ id: "1" })]);
        jest.doMock("./pipefy.service", () => ({ allCardsInPipe }));
        const { fetchAllDealsPipefy } = require("./pipefyLeads.service");

        await fetchAllDealsPipefy();

        expect(allCardsInPipe).toHaveBeenCalledTimes(1);
        const chamadasInsert = query.mock.calls.filter(([sql]) => sql.includes("INSERT INTO bmax_pipefy_cache"));
        expect(chamadasInsert.length).toBeGreaterThan(0); // gravou estado e/ou cards no banco
    });

    it("falha do banco (query rejeita) não quebra a listagem — segue só com a memória", async () => {
        const query = jest.fn().mockRejectedValue(new Error("conexão recusada"));
        jest.doMock("../database", () => ({ sequelize: { query } }));
        const allCardsInPipe = jest.fn().mockResolvedValue([cardBase({ id: "1" })]);
        jest.doMock("./pipefy.service", () => ({ allCardsInPipe }));
        const { fetchAllDealsPipefy } = require("./pipefyLeads.service");

        const deals = await fetchAllDealsPipefy();

        expect(deals.map(d => d.id)).toEqual(["1"]);
    });
});

describe("pipefyLeads.service — cache no banco em lotes e consistência (3º adendo, 23/10/2026)", () => {
    beforeEach(() => {
        jest.resetModules();
        process.env.PIPEFY_MAPA_JSON = JSON.stringify(MAPA_TESTE);
    });

    it("A1: grava o cache do banco em lotes de 100, não um card por vez", async () => {
        const cards = Array.from({ length: 250 }, (_, i) => cardBase({ id: String(i) }));
        const query = jest.fn().mockResolvedValue([]);
        jest.doMock("../database", () => ({ sequelize: { query } }));
        const allCardsInPipe = jest.fn().mockResolvedValue(cards);
        jest.doMock("./pipefy.service", () => ({ allCardsInPipe }));
        const { fetchAllDealsPipefy } = require("./pipefyLeads.service");

        await fetchAllDealsPipefy();

        const inserts = query.mock.calls.filter(([sql]) => sql.includes("INSERT INTO bmax_pipefy_cache_cards"));
        expect(inserts.length).toBe(3); // 100 + 100 + 50

        const idsGravados = inserts.flatMap(([, opts]) =>
            Object.entries(opts.replacements)
                .filter(([k]) => k.startsWith("id"))
                .map(([, v]) => v)
        );
        expect(idsGravados.length).toBe(250);
        expect(idsGravados.sort((a, b) => a - b)).toEqual(cards.map(c => c.id).sort((a, b) => a - b));
    });

    it("A2.1: a leitura completa de reserva SUBSTITUI o cache (não soma) — cards que sumiram saem", async () => {
        const allCardsInPipe = jest.fn()
            .mockResolvedValueOnce([cardBase({ id: "1" })]) // leitura inicial completa
            .mockResolvedValueOnce([cardBase({ id: "2" })]); // reserva (fallback): "1" sumiu
        const allCardsAtualizadosDesde = jest.fn().mockRejectedValue(new Error("filtro não suportado"));
        const query = jest.fn().mockResolvedValue([]);
        jest.doMock("../database", () => ({ sequelize: { query } }));
        jest.doMock("./pipefy.service", () => ({ allCardsInPipe, allCardsAtualizadosDesde }));
        const { fetchAllDealsPipefy } = require("./pipefyLeads.service");

        const agora = Date.now();
        jest.spyOn(Date, "now").mockReturnValue(agora);
        await fetchAllDealsPipefy();
        process.env.PIPEFY_CACHE_MIN = "1";
        jest.spyOn(Date, "now").mockReturnValue(agora + 5 * 60 * 1000);
        const deals = await fetchAllDealsPipefy();

        expect(deals.map(d => d.id)).toEqual(["2"]); // "1" não soma mais — saiu do cache
        const deletesPorSobra = query.mock.calls.filter(([sql]) => sql.includes("DELETE FROM bmax_pipefy_cache_cards") && sql.includes("NOT IN"));
        expect(deletesPorSobra.length).toBeGreaterThan(0); // também limpou do banco

        Date.now.mockRestore();
        delete process.env.PIPEFY_CACHE_MIN;
    });

    it("A2.2: atualizarCardNoCache apaga a linha do banco quando o card some do Pipefy", async () => {
        const allCardsInPipe = jest.fn().mockResolvedValue([cardBase({ id: "1" })]);
        const getCard = jest.fn().mockResolvedValue(null); // card sumiu
        const createCard = jest.fn().mockResolvedValue({ id: "1" });
        const query = jest.fn().mockResolvedValue([]);
        jest.doMock("../database", () => ({ sequelize: { query } }));
        jest.doMock("./pipefy.service", () => ({ allCardsInPipe, getCard, createCard }));
        const { fetchAllDealsPipefy, createLeadPipefy } = require("./pipefyLeads.service");

        await fetchAllDealsPipefy(); // aquece o cache do pipe padrão
        query.mockClear();
        await createLeadPipefy({ nome: "Cliente W", cnpj: "11222333000144" }); // chama atualizarCardNoCache("1") internamente

        const deletesPontuais = query.mock.calls.filter(([sql]) => sql.includes("DELETE FROM bmax_pipefy_cache_cards") && sql.includes("card_id = :cardId"));
        expect(deletesPontuais.length).toBeGreaterThan(0);
    });
});

describe("pipefyLeads.service — valores válidos (Tarefa 5)", () => {
    beforeEach(() => {
        jest.resetModules();
        process.env.PIPEFY_MAPA_JSON = JSON.stringify(MAPA_TESTE);
    });

    it("createLeadPipefy não envia campos vazios (Revenda/Representante ausentes)", async () => {
        const createCard = jest.fn().mockResolvedValue({ id: "1" });
        jest.doMock("./pipefy.service", () => ({ createCard, allCardsInPipe: jest.fn(), getCard: jest.fn().mockResolvedValue(null) }));
        const { createLeadPipefy } = require("./pipefyLeads.service");

        await createLeadPipefy({ nome: "Cliente Y", cnpj: "11222333000144" });

        const camposEnviados = createCard.mock.calls[0][3];
        const vazios = camposEnviados.filter(c => c.field_value === "" || c.field_value == null);
        expect(vazios).toEqual([]);
    });

    it("createLeadPipefy tira espaço nas pontas dos valores de texto", async () => {
        const createCard = jest.fn().mockResolvedValue({ id: "1" });
        jest.doMock("./pipefy.service", () => ({ createCard, allCardsInPipe: jest.fn(), getCard: jest.fn().mockResolvedValue(null) }));
        const { createLeadPipefy } = require("./pipefyLeads.service");

        await createLeadPipefy({ nome: "Cliente Z", cnpj: "11222333000144", revenda: "  Soldas Parana  " });

        const camposEnviados = createCard.mock.calls[0][3];
        const revenda = camposEnviados.find(c => c.field_id === "revenda_loja");
        expect(revenda.field_value).toBe("Soldas Parana");
    });

    it("updateLeadPipefy recusa PCI fora das 21 opções válidas, sem chamar o Pipefy", async () => {
        const updateCardFieldsEmLote = jest.fn();
        jest.doMock("./pipefy.service", () => ({ updateCardFieldsEmLote, moveCardToPhase: jest.fn(), getCard: jest.fn() }));
        const { updateLeadPipefy } = require("./pipefyLeads.service");

        await expect(updateLeadPipefy("123", { data: { custom_fields: { "perfil-pci": "PCI inválido" } } }))
            .rejects.toThrow("PCI inválido para o Pipefy");

        expect(updateCardFieldsEmLote).not.toHaveBeenCalled();
    });

    it("updateLeadPipefy aceita um PCI válido normalmente", async () => {
        const updateCardFieldsEmLote = jest.fn().mockResolvedValue({ success: true });
        jest.doMock("./pipefy.service", () => ({ updateCardFieldsEmLote, moveCardToPhase: jest.fn(), getCard: jest.fn().mockResolvedValue(null) }));
        const { updateLeadPipefy } = require("./pipefyLeads.service");

        await updateLeadPipefy("123", { data: { custom_fields: { "perfil-pci": "PCI 12a" } } });

        expect(updateCardFieldsEmLote).toHaveBeenCalledWith("123", [{ campoId: "pci", valor: "PCI 12a" }]);
    });
});

describe("pipefyLeads.service — valor e responsável em updateLeadPipefy (Tarefa 6)", () => {
    beforeEach(() => {
        jest.resetModules();
        process.env.PIPEFY_MAPA_JSON = JSON.stringify(MAPA_TESTE);
    });

    it("grava amount_total no campo 'Valor total', junto com os demais no mesmo lote", async () => {
        const updateCardFieldsEmLote = jest.fn().mockResolvedValue({ success: true });
        jest.doMock("./pipefy.service", () => ({ updateCardFieldsEmLote, moveCardToPhase: jest.fn(), getCard: jest.fn().mockResolvedValue(null) }));
        const { updateLeadPipefy } = require("./pipefyLeads.service");

        await updateLeadPipefy("123", { data: { amount_total: 1500.5, custom_fields: { "perfil-pci": "PCI 12b" } } });

        expect(updateCardFieldsEmLote).toHaveBeenCalledTimes(1);
        const pares = updateCardFieldsEmLote.mock.calls[0][1];
        expect(pares).toEqual(expect.arrayContaining([
            { campoId: "pci", valor: "PCI 12b" },
            { campoId: "valor_total", valor: "1500.5" }
        ]));
    });

    it("traduz owner_id do RD -> e-mail -> membro do Pipefy e atribui o card", async () => {
        const updateCardAssignees = jest.fn().mockResolvedValue({ success: true });
        jest.doMock("./pipefy.service", () => ({ updateCardAssignees, moveCardToPhase: jest.fn(), updateCardFieldsEmLote: jest.fn(), getCard: jest.fn().mockResolvedValue(null) }));
        jest.doMock("./rd.leads.service", () => ({
            getAliasMaps: jest.fn().mockResolvedValue({ rdToEmail: { "Carlos": "ayrton.oliveira@boxersoldas.com.br" } })
        }));
        const { RD_OWNERS } = require("../config/constants");
        const { updateLeadPipefy } = require("./pipefyLeads.service");

        await updateLeadPipefy("123", { data: { owner_id: RD_OWNERS["Carlos"] } });

        expect(updateCardAssignees).toHaveBeenCalledWith("123", ["307413540"]);
    });

    it("sem membro do Pipefy correspondente ao e-mail, só avisa e não falha", async () => {
        const updateCardAssignees = jest.fn();
        jest.doMock("./pipefy.service", () => ({ updateCardAssignees, moveCardToPhase: jest.fn(), updateCardFieldsEmLote: jest.fn(), getCard: jest.fn().mockResolvedValue(null) }));
        jest.doMock("./rd.leads.service", () => ({
            getAliasMaps: jest.fn().mockResolvedValue({ rdToEmail: { "Carlos": "carlos@naoemembro.com" } })
        }));
        const { RD_OWNERS } = require("../config/constants");
        const { updateLeadPipefy } = require("./pipefyLeads.service");

        await expect(updateLeadPipefy("123", { data: { owner_id: RD_OWNERS["Carlos"] } })).resolves.toEqual({ id: "123" });
        expect(updateCardAssignees).not.toHaveBeenCalled();
    });
});

describe("pipefyLeads.service — tarefas/notas como comentário (Tarefa 7)", () => {
    beforeEach(() => {
        jest.resetModules();
        process.env.PIPEFY_MAPA_JSON = JSON.stringify(MAPA_TESTE);
    });

    it("createTaskPipefy cria um comentário com tipo/prazo/assunto e grava os campos de próxima ação", async () => {
        const createComment = jest.fn().mockResolvedValue({ id: "c1" });
        const updateCardFieldsEmLote = jest.fn().mockResolvedValue({ success: true });
        const getCard = jest.fn().mockResolvedValue(null); // "123" não parece ID do RD: resolverCardId nem chama getCard; nomePipeDoCard chama pra descobrir o pipe (cai no fallback "BMAX")
        jest.doMock("./pipefy.service", () => ({ createComment, updateCardFieldsEmLote, getCard }));
        const { createTaskPipefy } = require("./pipefyLeads.service");

        await createTaskPipefy({ deal_id: "123", name: "Ligar pro cliente", date: "2026-12-01", notes: "Combinar entrega" });

        expect(createComment).toHaveBeenCalledWith("123", expect.stringContaining("Ligar pro cliente"));
        expect(createComment).toHaveBeenCalledWith("123", expect.stringContaining("Combinar entrega"));
        expect(updateCardFieldsEmLote).toHaveBeenCalledWith("123", expect.arrayContaining([
            { campoId: "pr_xima_a_o", valor: "Ligar pro cliente" },
            { campoId: "data_da_pr_xima_a_o", valor: "2026-12-01" }
        ]));
    });

    it("createNotePipefy grava o texto como comentário no card", async () => {
        const createComment = jest.fn().mockResolvedValue({ id: "c2", text: "Nota qualquer" });
        jest.doMock("./pipefy.service", () => ({ createComment }));
        const { createNotePipefy } = require("./pipefyLeads.service");

        const resultado = await createNotePipefy("123", "Nota qualquer");

        expect(createComment).toHaveBeenCalledWith("123", "Nota qualquer");
        expect(resultado).toEqual({ id: "c2", text: "Nota qualquer" });
    });

    it("getLeadNotesPipefy devolve os comentários no formato {data:[...]} que formatarHistoricoNotas já lê", async () => {
        const getCardComments = jest.fn().mockResolvedValue([
            { text: "Comentário 1", created_at: "2026-01-01", author: { name: "Carlos" } }
        ]);
        jest.doMock("./pipefy.service", () => ({ getCardComments }));
        const { getLeadNotesPipefy } = require("./pipefyLeads.service");

        const resultado = await getLeadNotesPipefy("123");

        expect(resultado).toEqual({ data: [{ text: "Comentário 1", created_at: "2026-01-01", author: { name: "Carlos" } }] });
    });

    it("updateTaskPipefy atualiza só os campos de próxima ação informados", async () => {
        const updateCardFieldsEmLote = jest.fn().mockResolvedValue({ success: true });
        const getCard = jest.fn().mockResolvedValue(null);
        jest.doMock("./pipefy.service", () => ({ updateCardFieldsEmLote, getCard }));
        const { updateTaskPipefy } = require("./pipefyLeads.service");

        await updateTaskPipefy({ subject: "Novo assunto", date: "2026-12-10" }, "123");

        expect(updateCardFieldsEmLote).toHaveBeenCalledWith("123", [
            { campoId: "pr_xima_a_o", valor: "Novo assunto" },
            { campoId: "data_da_pr_xima_a_o", valor: "2026-12-10" }
        ]);
    });
});

describe("pipefyLeads.service — pipes configuráveis (Tarefa 11)", () => {
    afterEach(() => {
        delete process.env.PIPEFY_PIPES_PORTAL;
    });

    it("padrão (sem PIPEFY_PIPES_PORTAL): lê só o pipe INDÚSTRIA - INTERNO (único que o painel RD lê hoje)", async () => {
        jest.resetModules();
        process.env.PIPEFY_MAPA_JSON = JSON.stringify(MAPA_TESTE);
        const allCardsInPipe = jest.fn().mockResolvedValue([cardBase()]);
        jest.doMock("./pipefy.service", () => ({ allCardsInPipe }));
        const { fetchAllDealsPipefy } = require("./pipefyLeads.service");

        await fetchAllDealsPipefy();

        expect(allCardsInPipe).toHaveBeenCalledTimes(1);
        expect(allCardsInPipe).toHaveBeenCalledWith("307397025");
    });

    it("com PIPEFY_PIPES_PORTAL=BMAX,FUNIL SDR: lê os dois pipes e junta os resultados", async () => {
        jest.resetModules();
        process.env.PIPEFY_PIPES_PORTAL = "BMAX,FUNIL SDR";
        const mapaComDoisPipes = {
            ...MAPA_TESTE,
            pipes: {
                ...MAPA_TESTE.pipes,
                "FUNIL SDR": { id: "307397042", fases: {}, campos: MAPA_TESTE.pipes.BMAX.campos }
            }
        };
        process.env.PIPEFY_MAPA_JSON = JSON.stringify(mapaComDoisPipes);
        const allCardsInPipe = jest.fn()
            .mockResolvedValueOnce([cardBase({ id: "1" })])
            .mockResolvedValueOnce([cardBase({ id: "2" })]);
        jest.doMock("./pipefy.service", () => ({ allCardsInPipe }));
        const { fetchAllDealsPipefy } = require("./pipefyLeads.service");

        const deals = await fetchAllDealsPipefy();

        expect(allCardsInPipe).toHaveBeenCalledTimes(2);
        expect(allCardsInPipe).toHaveBeenCalledWith("307397065");
        expect(allCardsInPipe).toHaveBeenCalledWith("307397042");
        expect(deals.map(d => d.id).sort()).toEqual(["1", "2"]);
    });

    it("pipe sem tabela fase->etapa RD configurada fica com deal_stage.id null (e avisa em log)", async () => {
        jest.resetModules();
        process.env.PIPEFY_PIPES_PORTAL = "FUNIL SDR";
        const mapaOutroPipe = {
            pipes: { "FUNIL SDR": { id: "307397042", fases: {}, campos: MAPA_TESTE.pipes.BMAX.campos } },
            contatos: MAPA_TESTE.contatos,
            empresas: MAPA_TESTE.empresas
        };
        process.env.PIPEFY_MAPA_JSON = JSON.stringify(mapaOutroPipe);
        const allCardsInPipe = jest.fn().mockResolvedValue([cardBase()]);
        jest.doMock("./pipefy.service", () => ({ allCardsInPipe }));
        const { fetchAllDealsPipefy } = require("./pipefyLeads.service");

        const [deal] = await fetchAllDealsPipefy();

        expect(deal.deal_stage.id).toBeNull();
    });
});

describe("pipefyLeads.service — re-busca antes de confirmar duplicata (Tarefa 10)", () => {
    beforeEach(() => {
        jest.resetModules();
        process.env.PIPEFY_MAPA_JSON = JSON.stringify(MAPA_TESTE);
    });

    // Desde a Tarefa 5/6 (bmax_pipefy_correcoes_adendo.md), a checagem de
    // duplicata varre PIPEFY_PIPES_PORTAL (padrão só "INDÚSTRIA - INTERNO",
    // id "307397025") + "BMAX" (id "307397065") sempre — os 2 pipes onde
    // createLeadPipefy pode criar o card.

    it("encontrou em qualquer um dos pipes verificados: não faz segunda rodada de busca", async () => {
        const allCardsInPipe = jest.fn().mockImplementation((pipeId) => Promise.resolve(
            pipeId === "307397065" // BMAX
                ? [cardBase({ fields: [{ field: { id: "cnpj" }, value: "11222333000144" }] })]
                : []
        ));
        jest.doMock("./pipefy.service", () => ({ allCardsInPipe }));
        const { getLeadByCnpjPipefy } = require("./pipefyLeads.service");

        const encontrado = await getLeadByCnpjPipefy("11222333000144");

        expect(encontrado).not.toBeNull();
        expect(allCardsInPipe).toHaveBeenCalledTimes(2); // 1 por pipe verificado, sem re-busca
    });

    it("não encontrou em nenhum pipe: a re-busca é INCREMENTAL, não completa (Tarefa A5, 2º adendo)", async () => {
        const allCardsInPipe = jest.fn().mockResolvedValue([cardBase({ fields: [{ field: { id: "cnpj" }, value: "00000000000000" }] })]);
        const allCardsAtualizadosDesde = jest.fn().mockResolvedValue([]);
        jest.doMock("./pipefy.service", () => ({ allCardsInPipe, allCardsAtualizadosDesde }));
        const { getLeadByCnpjPipefy } = require("./pipefyLeads.service");

        const encontrado = await getLeadByCnpjPipefy("11222333000144");

        expect(encontrado).toBeNull();
        expect(allCardsInPipe).toHaveBeenCalledTimes(2); // só a leitura completa inicial, 1 por pipe
        expect(allCardsAtualizadosDesde).toHaveBeenCalledTimes(2); // re-busca força incremental, não completa de novo
    });

    it("não encontrou em nenhum pipe (sem allCardsAtualizadosDesde mockado): cai pra completa de novo como fallback", async () => {
        const allCardsInPipe = jest.fn().mockResolvedValue([cardBase({ fields: [{ field: { id: "cnpj" }, value: "00000000000000" }] })]);
        jest.doMock("./pipefy.service", () => ({ allCardsInPipe }));
        const { getLeadByCnpjPipefy } = require("./pipefyLeads.service");

        const encontrado = await getLeadByCnpjPipefy("11222333000144");

        expect(encontrado).toBeNull();
        expect(allCardsInPipe).toHaveBeenCalledTimes(4); // 2 pipes x 2 rodadas (cache + fallback da re-busca)
    });

    it("duplicata criada após a primeira busca aparece na segunda (re-busca)", async () => {
        const chamadasPorPipe = {};
        const allCardsInPipe = jest.fn().mockImplementation((pipeId) => {
            chamadasPorPipe[pipeId] = (chamadasPorPipe[pipeId] || 0) + 1;
            if (pipeId === "307397065" && chamadasPorPipe[pipeId] === 2) {
                return Promise.resolve([cardBase({ fields: [{ field: { id: "cnpj" }, value: "11222333000144" }] })]);
            }
            return Promise.resolve([]);
        });
        jest.doMock("./pipefy.service", () => ({ allCardsInPipe }));
        const { getLeadByCnpjPipefy } = require("./pipefyLeads.service");

        const encontrado = await getLeadByCnpjPipefy("11222333000144");

        expect(encontrado).not.toBeNull();
        expect(allCardsInPipe).toHaveBeenCalledTimes(4);
    });
});

describe("pipefyLeads.service — resolução de ID RD <-> Pipefy (Tarefa 8)", () => {
    beforeEach(() => {
        jest.resetModules();
        process.env.PIPEFY_MAPA_JSON = JSON.stringify(MAPA_TESTE);
    });

    it("id que já parece card do Pipefy (só dígitos) é devolvido direto, sem consultar o banco nem o Pipefy", async () => {
        const query = jest.fn();
        jest.doMock("../database", () => ({ sequelize: { query } }));
        jest.doMock("./pipefy.service", () => ({ findCardByRdId: jest.fn(), getCard: jest.fn().mockResolvedValue(cardBase()) }));
        const { resolverCardId } = require("./pipefyLeads.service");

        const cardId = await resolverCardId("555222");

        expect(cardId).toBe("555222");
        expect(query).not.toHaveBeenCalled();
    });

    it("id do RD já mapeado na tabela devolve o card id sem chamar findCardByRdId", async () => {
        const query = jest.fn().mockResolvedValue([{ pipefy_card_id: "999888" }]);
        const findCardByRdId = jest.fn();
        jest.doMock("../database", () => ({ sequelize: { query } }));
        jest.doMock("./pipefy.service", () => ({ findCardByRdId, getCard: jest.fn() }));
        const { resolverCardId } = require("./pipefyLeads.service");

        const cardId = await resolverCardId("66151c1470449b000d54e919");

        expect(cardId).toBe("999888");
        expect(findCardByRdId).not.toHaveBeenCalled();
    });

    it("id do RD ainda não mapeado busca via findCardByRdId no primeiro pipe (padrão: INDÚSTRIA - INTERNO) e grava na tabela", async () => {
        const query = jest.fn().mockResolvedValue([]); // SELECT não acha nada
        const findCardByRdId = jest.fn().mockResolvedValue({ id: "777666" });
        jest.doMock("../database", () => ({ sequelize: { query } }));
        jest.doMock("./pipefy.service", () => ({ findCardByRdId, getCard: jest.fn() }));
        const { resolverCardId } = require("./pipefyLeads.service");

        const cardId = await resolverCardId("66151c1470449b000d54e919");

        expect(cardId).toBe("777666");
        expect(findCardByRdId).toHaveBeenCalledWith("307397025", "id_no_rd_crm", "66151c1470449b000d54e919");
        // 1ª chamada = SELECT, 2ª = INSERT ... ON CONFLICT
        expect(query).toHaveBeenCalledTimes(2);
    });

    it("id do RD não encontrado no 1º pipe (INDÚSTRIA - INTERNO) é procurado no 2º (BMAX) — Tarefa A2, 2º adendo", async () => {
        const query = jest.fn().mockResolvedValue([]);
        const findCardByRdId = jest.fn()
            .mockImplementation((pipeId) => Promise.resolve(pipeId === "307397065" ? { id: "888999" } : null));
        jest.doMock("../database", () => ({ sequelize: { query } }));
        jest.doMock("./pipefy.service", () => ({ findCardByRdId, getCard: jest.fn() }));
        const { resolverCardId } = require("./pipefyLeads.service");

        const cardId = await resolverCardId("66151c1470449b000d54e919");

        expect(cardId).toBe("888999");
        expect(findCardByRdId).toHaveBeenCalledWith("307397025", "id_no_rd_crm", "66151c1470449b000d54e919"); // tentou INDÚSTRIA primeiro
        expect(findCardByRdId).toHaveBeenCalledWith("307397065", "id_no_rd_crm", "66151c1470449b000d54e919"); // achou no BMAX
    });

    it("id do RD sem card correspondente no Pipefy lança erro claro", async () => {
        const query = jest.fn().mockResolvedValue([]);
        const findCardByRdId = jest.fn().mockResolvedValue(null);
        jest.doMock("../database", () => ({ sequelize: { query } }));
        jest.doMock("./pipefy.service", () => ({ findCardByRdId, getCard: jest.fn() }));
        const { resolverCardId } = require("./pipefyLeads.service");

        await expect(resolverCardId("66151c1470449b000d54e919")).rejects.toThrow("Nenhum card do Pipefy encontrado");
    });

    it("getDealByIdPipefy resolve o id e devolve o card traduzido", async () => {
        const query = jest.fn().mockResolvedValue([{ pipefy_card_id: "555222" }]);
        const getCard = jest.fn().mockResolvedValue(cardBase({ id: "555222" }));
        jest.doMock("../database", () => ({ sequelize: { query } }));
        jest.doMock("./pipefy.service", () => ({ findCardByRdId: jest.fn(), getCard }));
        const { getDealByIdPipefy } = require("./pipefyLeads.service");

        const deal = await getDealByIdPipefy("66151c1470449b000d54e919");

        expect(getCard).toHaveBeenCalledWith("555222");
        expect(deal.id).toBe("555222");
    });

    it("getDealByIdPipefy traduz pela tabela do pipe DO CARD, não sempre BMAX (Tarefa A2, 2º adendo)", async () => {
        const query = jest.fn().mockResolvedValue([{ pipefy_card_id: "555222" }]);
        const card = cardBase({
            id: "555222",
            pipe: { id: "307397025", name: "INDÚSTRIA - INTERNO" },
            current_phase: { id: "x", name: "VENDA EFETIVADA" }
        });
        const getCard = jest.fn().mockResolvedValue(card);
        jest.doMock("../database", () => ({ sequelize: { query } }));
        jest.doMock("./pipefy.service", () => ({ findCardByRdId: jest.fn(), getCard }));
        const { getDealByIdPipefy } = require("./pipefyLeads.service");
        const { RD_STAGE_VENDA_EFETIVADA } = require("../config/constants");

        const deal = await getDealByIdPipefy("66151c1470449b000d54e919");

        expect(deal.deal_stage.id).toBe(RD_STAGE_VENDA_EFETIVADA);
        expect(deal.win).toBe(true);
    });
});

describe("pipefyLeads.service — traduz ID do RD em toda operação (Tarefa A1, 2º adendo)", () => {
    const RD_ID = "66151c1470449b000d54e919"; // 24 chars hex
    const CARD_ID = "444555";

    beforeEach(() => {
        jest.resetModules();
        process.env.PIPEFY_MAPA_JSON = JSON.stringify(MAPA_TESTE);
    });

    function mockBancoComMapa() {
        const query = jest.fn().mockResolvedValue([{ pipefy_card_id: CARD_ID }]); // já mapeado
        jest.doMock("../database", () => ({ sequelize: { query } }));
        return query;
    }

    it("updateLeadPipefy resolve o ID do RD antes de chamar o Pipefy", async () => {
        mockBancoComMapa();
        const updateCardFieldsEmLote = jest.fn().mockResolvedValue({ success: true });
        const getCard = jest.fn().mockResolvedValue(null); // sem cache: cai no fallback "BMAX"
        jest.doMock("./pipefy.service", () => ({ updateCardFieldsEmLote, moveCardToPhase: jest.fn(), getCard }));
        const { updateLeadPipefy } = require("./pipefyLeads.service");

        await updateLeadPipefy(RD_ID, { data: { custom_fields: { "perfil-pci": "PCI 12a" } } });

        expect(updateCardFieldsEmLote).toHaveBeenCalledWith(CARD_ID, [{ campoId: "pci", valor: "PCI 12a" }]);
    });

    it("createTaskPipefy resolve taskData.deal_id (ID do RD) antes de chamar o Pipefy", async () => {
        mockBancoComMapa();
        const createComment = jest.fn().mockResolvedValue({ id: "c1" });
        const updateCardFieldsEmLote = jest.fn().mockResolvedValue({ success: true });
        const getCard = jest.fn().mockResolvedValue(null);
        jest.doMock("./pipefy.service", () => ({ createComment, updateCardFieldsEmLote, getCard }));
        const { createTaskPipefy } = require("./pipefyLeads.service");

        await createTaskPipefy({ deal_id: RD_ID, name: "Ligar" });

        expect(createComment).toHaveBeenCalledWith(CARD_ID, expect.stringContaining("Ligar"));
    });

    it("updateTaskPipefy resolve o ID do RD antes de chamar o Pipefy", async () => {
        mockBancoComMapa();
        const updateCardFieldsEmLote = jest.fn().mockResolvedValue({ success: true });
        const getCard = jest.fn().mockResolvedValue(null);
        jest.doMock("./pipefy.service", () => ({ updateCardFieldsEmLote, getCard }));
        const { updateTaskPipefy } = require("./pipefyLeads.service");

        await updateTaskPipefy({ subject: "x" }, RD_ID);

        expect(updateCardFieldsEmLote).toHaveBeenCalledWith(CARD_ID, expect.anything());
    });

    it("createNotePipefy resolve o ID do RD antes de chamar o Pipefy", async () => {
        mockBancoComMapa();
        const createComment = jest.fn().mockResolvedValue({ id: "c1" });
        jest.doMock("./pipefy.service", () => ({ createComment }));
        const { createNotePipefy } = require("./pipefyLeads.service");

        await createNotePipefy(RD_ID, "texto");

        expect(createComment).toHaveBeenCalledWith(CARD_ID, "texto");
    });

    it("getLeadNotesPipefy resolve o ID do RD antes de chamar o Pipefy", async () => {
        mockBancoComMapa();
        const getCardComments = jest.fn().mockResolvedValue([]);
        jest.doMock("./pipefy.service", () => ({ getCardComments }));
        const { getLeadNotesPipefy } = require("./pipefyLeads.service");

        await getLeadNotesPipefy(RD_ID);

        expect(getCardComments).toHaveBeenCalledWith(CARD_ID);
    });
});

describe("pipefyLeads.service — updateLeadPipefy ciente do pipe do card (Tarefa A3, 2º adendo)", () => {
    beforeEach(() => {
        jest.resetModules();
        process.env.PIPEFY_MAPA_JSON = JSON.stringify(MAPA_TESTE);
    });

    it("move um card do INDÚSTRIA - INTERNO pra fase certa (RD_STAGE_NEGOCIACAO -> NEGOCIAÇÃO)", async () => {
        const { RD_STAGE_NEGOCIACAO } = require("../config/constants");
        const moveCardToPhase = jest.fn().mockResolvedValue({ success: true });
        const getCard = jest.fn().mockResolvedValue(cardBase({ id: "1", pipe: { id: "307397025", name: "INDÚSTRIA - INTERNO" } }));
        jest.doMock("./pipefy.service", () => ({ moveCardToPhase, updateCardFieldsEmLote: jest.fn(), getCard }));
        const { updateLeadPipefy } = require("./pipefyLeads.service");

        await updateLeadPipefy("1", { data: { stage_id: RD_STAGE_NEGOCIACAO } });

        expect(moveCardToPhase).toHaveBeenCalledWith("1", "344500003"); // id da fase "NEGOCIAÇÃO" no fixture
    });

    it("move um card do BMAX pra 'Prazo Vencido' (não 'Perdido') quando a etapa é RD_STAGE_PERDIDO", async () => {
        const { RD_STAGE_PERDIDO } = require("../config/constants");
        const moveCardToPhase = jest.fn().mockResolvedValue({ success: true });
        const getCard = jest.fn().mockResolvedValue(cardBase({ id: "2", pipe: { id: "307397065", name: "BMAX" } }));
        jest.doMock("./pipefy.service", () => ({ moveCardToPhase, updateCardFieldsEmLote: jest.fn(), getCard }));
        const { updateLeadPipefy } = require("./pipefyLeads.service");

        await updateLeadPipefy("2", { data: { stage_id: RD_STAGE_PERDIDO } });

        expect(moveCardToPhase).toHaveBeenCalledWith("2", "344532517"); // id da fase "Prazo Vencido" no fixture
    });

    it("etapa do RD sem fase correspondente no pipe do card lança erro e não chama o Pipefy", async () => {
        const { RD_STAGE_LEAD } = require("../config/constants"); // não existe no BMAX
        const moveCardToPhase = jest.fn();
        const updateCardFieldsEmLote = jest.fn();
        const getCard = jest.fn().mockResolvedValue(cardBase({ id: "3", pipe: { id: "307397065", name: "BMAX" } }));
        jest.doMock("./pipefy.service", () => ({ moveCardToPhase, updateCardFieldsEmLote, getCard }));
        const { updateLeadPipefy } = require("./pipefyLeads.service");

        await expect(updateLeadPipefy("3", { data: { stage_id: RD_STAGE_LEAD, custom_fields: { "perfil-pci": "PCI 12" } } }))
            .rejects.toThrow("sem fase correspondente");

        expect(moveCardToPhase).not.toHaveBeenCalled();
        expect(updateCardFieldsEmLote).not.toHaveBeenCalled();
    });
});

describe("rd.leads.service — bloqueio de escrita não migrada pro Pipefy (Tarefa 9)", () => {
    beforeEach(() => {
        jest.resetModules();
        jest.unmock("./rd.leads.service");
        process.env.CRM_PROVIDER = "pipefy";
        process.env.RD_CRM_TOKEN = "x";
    });

    afterEach(() => {
        delete process.env.CRM_PROVIDER;
    });

    // renomearRepresentanteNoRD/renomearRevendaNoRD/reatribuirRepresentanteDaRevendaNoRD
    // saíram daqui na Tarefa 9 do adendo (19/10/2026) — passaram a despachar
    // pro Pipefy em vez de bloquear (ver describe "rename/reatribuição" abaixo).
    it.each([
        ["syncRevendasToRD", (m) => m.syncRevendasToRD(["Revenda X"])],
        ["syncRepresentantesToRD", (m) => m.syncRepresentantesToRD(["Rep X"])]
    ])("%s lança erro explícito em modo pipefy, sem chamar o RD", async (_nome, chamar) => {
        const modulo = require("./rd.leads.service");
        await expect(chamar(modulo)).rejects.toThrow(/não migrada para o Pipefy/);
    });
});

describe("rd.leads.service — rename/reatribuição de representante/revenda no Pipefy (Tarefa 9)", () => {
    beforeEach(() => {
        jest.resetModules();
        jest.unmock("./rd.leads.service");
        process.env.CRM_PROVIDER = "pipefy";
        process.env.RD_CRM_TOKEN = "x";
        process.env.PIPEFY_MAPA_JSON = JSON.stringify(MAPA_TESTE);
    });

    afterEach(() => {
        delete process.env.CRM_PROVIDER;
    });

    it("renomearRepresentanteNoRD despacha pro Pipefy (nunca chama o RD) e varre só BMAX", async () => {
        const getStartFormFields = jest.fn().mockResolvedValue([{ id: "representante", uuid: "uuid-rep", label: "Representante", options: ["Antigo"] }]);
        const updatePhaseField = jest.fn().mockResolvedValue({ id: "representante", label: "Representante" });
        const findCardsByFieldValue = jest.fn().mockResolvedValue([{ id: "1" }, { id: "2" }]);
        const updateFieldEmVariosCards = jest.fn().mockResolvedValue({ success: true, atualizados: 2, falharam: 0 });
        jest.doMock("./pipefy.service", () => ({ getStartFormFields, updatePhaseField, findCardsByFieldValue, updateFieldEmVariosCards }));
        const { renomearRepresentanteNoRD } = require("./rd.leads.service");

        const resultado = await renomearRepresentanteNoRD("Antigo", "Novo");

        expect(findCardsByFieldValue).toHaveBeenCalledTimes(1);
        expect(findCardsByFieldValue).toHaveBeenCalledWith("307397065", "representante", "Antigo");
        expect(updatePhaseField).toHaveBeenCalledWith("representante", "uuid-rep", "Representante", ["Antigo", "Novo"]);
        expect(updateFieldEmVariosCards).toHaveBeenCalledWith("representante", "Novo", ["1", "2"]);
        expect(resultado).toEqual({ done: true, total: 2, updated: 2, failed: 0 });
    });

    it("não acrescenta a opção de novo se ela já existir no campo", async () => {
        const getStartFormFields = jest.fn().mockResolvedValue([{ id: "representante", uuid: "uuid-rep", label: "Representante", options: ["Antigo", "Novo"] }]);
        const updatePhaseField = jest.fn();
        const findCardsByFieldValue = jest.fn().mockResolvedValue([]);
        const updateFieldEmVariosCards = jest.fn();
        jest.doMock("./pipefy.service", () => ({ getStartFormFields, updatePhaseField, findCardsByFieldValue, updateFieldEmVariosCards }));
        const { renomearRepresentanteNoRD } = require("./rd.leads.service");

        await renomearRepresentanteNoRD("Antigo", "Novo");

        expect(updatePhaseField).not.toHaveBeenCalled();
    });

    it("renomearRevendaNoRD varre BMAX e REVENDA - INTERNO", async () => {
        const getStartFormFields = jest.fn().mockResolvedValue([{ id: "revenda_loja", uuid: "uuid-rev", label: "Revenda/Loja", options: ["Antiga"] }]);
        const updatePhaseField = jest.fn().mockResolvedValue({});
        const findCardsByFieldValue = jest.fn().mockResolvedValue([{ id: "9" }]);
        const updateFieldEmVariosCards = jest.fn().mockResolvedValue({ success: true, atualizados: 1, falharam: 0 });
        jest.doMock("./pipefy.service", () => ({ getStartFormFields, updatePhaseField, findCardsByFieldValue, updateFieldEmVariosCards }));
        const { renomearRevendaNoRD } = require("./rd.leads.service");

        const resultado = await renomearRevendaNoRD("Antiga", "Nova");

        expect(findCardsByFieldValue).toHaveBeenCalledWith("307397065", "revenda_loja", "Antiga"); // BMAX
        expect(findCardsByFieldValue).toHaveBeenCalledWith("307397056", "revenda_loja", "Antiga"); // REVENDA - INTERNO
        expect(resultado).toEqual({ done: true, total: 2, updated: 2, failed: 0 });
    });

    // Tarefa C1 (2º adendo, 23/10/2026): antes, esse teste mockava
    // sbSistemasService como `{}` (não uma função) — getAliasMaps real caía
    // no catch, devolvia mapas vazios, e repNoRd virava sempre o próprio
    // `novoRep` sem passar pela tradução de verdade. Agora mocka
    // sbSistemasService como função de verdade, com um representante cujo
    // nome de cadastro difere do alias usado no RD (mesmo exemplo real
    // documentado em rd.leads.service.js: "Caio P Mancini" -> RD "Caio
    // Tito") — prova que a tradução nome->alias realmente acontece.
    it("reatribuirRepresentanteDaRevendaNoRD traduz o nome de cadastro pro alias do RD antes de gravar", async () => {
        const getStartFormFields = jest.fn().mockResolvedValue([{ id: "representante", uuid: "uuid-rep", label: "Representante", options: [] }]);
        const updatePhaseField = jest.fn().mockResolvedValue({});
        const findCardsByFieldValue = jest.fn().mockResolvedValue([{ id: "5" }]);
        const updateFieldEmVariosCards = jest.fn().mockResolvedValue({ success: true, atualizados: 1, falharam: 0 });
        jest.doMock("./pipefy.service", () => ({ getStartFormFields, updatePhaseField, findCardsByFieldValue, updateFieldEmVariosCards }));
        const sbSistemasService = jest.fn().mockResolvedValue([
            { nome: "Caio P Mancini", email: "caio@boxersoldas.com.br", rd_alias: "Caio Tito", ativo: true }
        ]);
        jest.doMock("../config/supabaseSistemas", () => ({ sbSistemasAnon: {}, sbSistemasService }));
        const { reatribuirRepresentanteDaRevendaNoRD } = require("./rd.leads.service");

        await reatribuirRepresentanteDaRevendaNoRD("Revenda X", "Caio P Mancini");

        expect(findCardsByFieldValue).toHaveBeenCalledWith("307397065", "revenda_loja", "Revenda X");
        // grava o ALIAS do RD ("Caio Tito"), não o nome de cadastro recebido
        expect(updateFieldEmVariosCards).toHaveBeenCalledWith("representante", "Caio Tito", ["5"]);
    });

    it("dryRun só conta, sem chamar updatePhaseField/updateFieldEmVariosCards", async () => {
        const getStartFormFields = jest.fn();
        const updatePhaseField = jest.fn();
        const findCardsByFieldValue = jest.fn().mockResolvedValue([{ id: "1" }, { id: "2" }]);
        const updateFieldEmVariosCards = jest.fn();
        jest.doMock("./pipefy.service", () => ({ getStartFormFields, updatePhaseField, findCardsByFieldValue, updateFieldEmVariosCards }));
        const { renomearRepresentanteNoRD } = require("./rd.leads.service");

        const resultado = await renomearRepresentanteNoRD("Antigo", "Novo", { dryRun: true });

        expect(updatePhaseField).not.toHaveBeenCalled();
        expect(updateFieldEmVariosCards).not.toHaveBeenCalled();
        expect(resultado).toEqual({ done: true, total: 2, updated: 0, failed: 0, dryRun: true }); // só BMAX é varrido por renomearRepresentanteNoRD
    });
});

describe("rd.leads.service — despacho de tarefas/notas pro Pipefy (Tarefa 7)", () => {
    beforeEach(() => {
        jest.resetModules();
        jest.unmock("./rd.leads.service"); // um describe anterior mockou este módulo
        process.env.CRM_PROVIDER = "pipefy";
        process.env.RD_CRM_TOKEN = "x";
    });

    afterEach(() => {
        delete process.env.CRM_PROVIDER;
    });

    it("createTask em modo pipefy nunca chama o RD", async () => {
        const createTaskPipefy = jest.fn().mockResolvedValue({ skipped: false });
        jest.doMock("./pipefyLeads.service", () => ({ createTaskPipefy }));
        const { createTask } = require("./rd.leads.service");

        await createTask({ deal_id: "123", name: "Tarefa" });

        expect(createTaskPipefy).toHaveBeenCalledWith({ deal_id: "123", name: "Tarefa" });
    });

    it("createNote em modo pipefy nunca chama o RD", async () => {
        const createNotePipefy = jest.fn().mockResolvedValue({ id: "c1" });
        jest.doMock("./pipefyLeads.service", () => ({ createNotePipefy }));
        const { createNote } = require("./rd.leads.service");

        await createNote("123", "texto");

        expect(createNotePipefy).toHaveBeenCalledWith("123", "texto");
    });

    it("getLeadNotes em modo pipefy nunca chama o RD", async () => {
        const getLeadNotesPipefy = jest.fn().mockResolvedValue({ data: [] });
        jest.doMock("./pipefyLeads.service", () => ({ getLeadNotesPipefy }));
        const { getLeadNotes } = require("./rd.leads.service");

        await getLeadNotes("123");

        expect(getLeadNotesPipefy).toHaveBeenCalledWith("123");
    });

    it("updateTask em modo pipefy nunca chama o RD", async () => {
        const updateTaskPipefy = jest.fn().mockResolvedValue({ id: "123" });
        jest.doMock("./pipefyLeads.service", () => ({ updateTaskPipefy }));
        const { updateTask } = require("./rd.leads.service");

        await updateTask({ subject: "x" }, "123");

        expect(updateTaskPipefy).toHaveBeenCalledWith({ subject: "x" }, "123");
    });
});
