// Testa o cliente GraphQL de baixo nível pro Pipefy com `fetch` simulado —
// nunca chama a API real (ver bmax_pipefy_correcoes.md, regra 4).
describe("pipefy.service", () => {
    let originalFetch;

    beforeEach(() => {
        jest.resetModules();
        process.env.PIPEFY_TOKEN = "token-teste";
        originalFetch = global.fetch;
    });

    afterEach(() => {
        global.fetch = originalFetch;
    });

    function mockFetchOnce(data, status = 200) {
        global.fetch = jest.fn().mockResolvedValue({
            ok: status < 400,
            status,
            json: async () => ({ data })
        });
    }

    it("findContatoPorEmail declara $tabela como String! (não ID!) — bug real corrigido", async () => {
        mockFetchOnce({ findRecords: { edges: [] } });
        const { findContatoPorEmail } = require("./pipefy.service");

        await findContatoPorEmail("CCt1tB1F", "e_mail", "cliente@exemplo.com");

        const body = JSON.parse(global.fetch.mock.calls[0][1].body);
        expect(body.query).toContain("$tabela: String!");
        expect(body.query).not.toContain("$tabela: ID!");
        expect(body.variables).toEqual({ tabela: "CCt1tB1F", campo: "e_mail", valor: "cliente@exemplo.com" });
    });

    it("findContatoPorEmail devolve null quando não encontra nada", async () => {
        mockFetchOnce({ findRecords: { edges: [] } });
        const { findContatoPorEmail } = require("./pipefy.service");

        const resultado = await findContatoPorEmail("CCt1tB1F", "e_mail", "ninguem@exemplo.com");

        expect(resultado).toBeNull();
    });

    it("findContatoPorEmail devolve o registro encontrado", async () => {
        mockFetchOnce({ findRecords: { edges: [{ node: { id: "123", title: "Fulano" } }] } });
        const { findContatoPorEmail } = require("./pipefy.service");

        const resultado = await findContatoPorEmail("CCt1tB1F", "e_mail", "fulano@exemplo.com");

        expect(resultado).toEqual({ id: "123", title: "Fulano" });
    });

    it("pipefyFetch lança erro claro em HTTP 429 (limite do Pipefy)", async () => {
        mockFetchOnce({}, 429);
        const { pipefyFetch } = require("./pipefy.service");

        await expect(pipefyFetch("query { x }")).rejects.toThrow(/429/);
    });

    it("pipefyFetch lança erro quando o corpo traz errors[] (HTTP 200)", async () => {
        global.fetch = jest.fn().mockResolvedValue({
            ok: true,
            status: 200,
            json: async () => ({ errors: [{ message: "Campo inválido" }] })
        });
        const { pipefyFetch } = require("./pipefy.service");

        await expect(pipefyFetch("query { x }")).rejects.toThrow("Campo inválido");
    });

    it("pipefyFetch exige PIPEFY_TOKEN configurado", async () => {
        delete process.env.PIPEFY_TOKEN;
        const { pipefyFetch } = require("./pipefy.service");

        await expect(pipefyFetch("query { x }")).rejects.toThrow("PIPEFY_TOKEN");
    });

    it("updateFieldEmVariosCards divide em lotes de 30 (Tarefa B1, 2º adendo 23/10/2026)", async () => {
        mockFetchOnce({});
        const { updateFieldEmVariosCards } = require("./pipefy.service");
        const cardIds = Array.from({ length: 75 }, (_, i) => String(i + 1));

        const resultado = await updateFieldEmVariosCards("campo1", "valor novo", cardIds);

        expect(global.fetch).toHaveBeenCalledTimes(3); // 30 + 30 + 15
        expect(resultado).toEqual({ success: true, atualizados: 75, falharam: 0 });
    });

    it("updateFieldEmVariosCards: um lote falhar não impede os outros", async () => {
        let chamada = 0;
        global.fetch = jest.fn().mockImplementation(() => {
            chamada++;
            if (chamada === 2) return Promise.resolve({ ok: false, status: 500, json: async () => ({}) });
            return Promise.resolve({ ok: true, status: 200, json: async () => ({ data: {} }) });
        });
        const { updateFieldEmVariosCards } = require("./pipefy.service");
        const cardIds = Array.from({ length: 75 }, (_, i) => String(i + 1));

        const resultado = await updateFieldEmVariosCards("campo1", "valor novo", cardIds);

        expect(global.fetch).toHaveBeenCalledTimes(3);
        expect(resultado).toEqual({ success: false, atualizados: 45, falharam: 30 }); // lotes 1 e 3 ok (30+15), lote 2 falhou (30)
    });

    it("findCardsByFieldValue repete sem paginação se o Pipefy recusar first/after (Tarefa B2, 2º adendo)", async () => {
        let chamada = 0;
        global.fetch = jest.fn().mockImplementation(() => {
            chamada++;
            if (chamada === 1) {
                return Promise.resolve({
                    ok: true, status: 200,
                    json: async () => ({ errors: [{ message: "Field 'findCards' doesn't accept argument 'first'" }] })
                });
            }
            return Promise.resolve({
                ok: true, status: 200,
                json: async () => ({ data: { findCards: { edges: [{ node: { id: "1", title: "Card 1", current_phase: { name: "x" } } }] } } })
            });
        });
        const { findCardsByFieldValue } = require("./pipefy.service");

        const cards = await findCardsByFieldValue("pipe1", "campo1", "valor");

        expect(cards).toEqual([{ id: "1", title: "Card 1", current_phase: { name: "x" } }]);
        expect(global.fetch).toHaveBeenCalledTimes(2); // 1ª tentativa (paginada, falhou) + 2ª sem paginação
        const segundaQuery = JSON.parse(global.fetch.mock.calls[1][1].body).query;
        expect(segundaQuery).not.toMatch(/first|after/);
    });

    it("findCardsByFieldValue repassa qualquer outro erro sem tentar de novo", async () => {
        mockFetchOnce({}, 500);
        const { findCardsByFieldValue } = require("./pipefy.service");

        await expect(findCardsByFieldValue("pipe1", "campo1", "valor")).rejects.toThrow();
        expect(global.fetch).toHaveBeenCalledTimes(1);
    });
});
