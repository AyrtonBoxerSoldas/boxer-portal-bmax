// Tarefa A4 (2º adendo, 23/10/2026): o JSON reduzido pra PIPEFY_MAPA_JSON
// precisa sempre incluir BMAX e REVENDA - INTERNO, não só os pipes do
// painel — senão criação de negociação de revenda, checagem de duplicidade
// e as rotinas de renomear/reatribuir quebram em produção.
const { montarMapaReduzido } = require("./gerar-pipefy-mapa-env");

const MAPA_COMPLETO = {
    pipes: {
        "INDÚSTRIA - INTERNO": { id: "1", fases: {}, campos: {} },
        "FUNIL SDR": { id: "2", fases: {}, campos: {} },
        "REVENDA - INTERNO": { id: "3", fases: {}, campos: {} },
        "BMAX": { id: "4", fases: {}, campos: {} }
    },
    contatos: { id: "c1", campos: {} },
    empresas: { id: "e1", campos: {} },
    membros: { "fulano@boxersoldas.com.br": "999" }
};

describe("gerar-pipefy-mapa-env — montarMapaReduzido (Tarefa A4, 2º adendo)", () => {
    it("com PIPEFY_PIPES_PORTAL só INDÚSTRIA - INTERNO, inclui também BMAX e REVENDA - INTERNO", () => {
        const reduzido = montarMapaReduzido(MAPA_COMPLETO, ["INDÚSTRIA - INTERNO"]);

        expect(Object.keys(reduzido.pipes).sort()).toEqual(["BMAX", "INDÚSTRIA - INTERNO", "REVENDA - INTERNO"]);
        expect(reduzido.contatos).toEqual(MAPA_COMPLETO.contatos);
        expect(reduzido.empresas).toEqual(MAPA_COMPLETO.empresas);
        expect(reduzido.membros).toEqual(MAPA_COMPLETO.membros);
    });

    it("não duplica BMAX/REVENDA - INTERNO se já estiverem em pipesPortal", () => {
        const reduzido = montarMapaReduzido(MAPA_COMPLETO, ["BMAX", "REVENDA - INTERNO"]);

        expect(Object.keys(reduzido.pipes).sort()).toEqual(["BMAX", "REVENDA - INTERNO"]);
    });

    it("ignora (com aviso) um pipe que não existe no mapa completo, sem quebrar os demais", () => {
        const errorSpy = jest.spyOn(console, "error").mockImplementation(() => {});

        const reduzido = montarMapaReduzido(MAPA_COMPLETO, ["PIPE INEXISTENTE"]);

        expect(reduzido.pipes["PIPE INEXISTENTE"]).toBeUndefined();
        expect(Object.keys(reduzido.pipes).sort()).toEqual(["BMAX", "REVENDA - INTERNO"]);
        expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining("PIPE INEXISTENTE"));

        errorSpy.mockRestore();
    });
});
