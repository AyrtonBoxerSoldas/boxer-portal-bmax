// Tarefa A4 (2º adendo, 23/10/2026): o JSON reduzido pra PIPEFY_MAPA_JSON
// precisa sempre incluir BMAX, REVENDA - INTERNO e FUNIL SDR (este último
// acrescentado na Fase 7, 19/11/2026), não só os pipes do painel — senão
// criação de negociação de revenda, checagem de duplicidade, as rotinas de
// renomear/reatribuir e a Consulta de Lead do Motor quebram em produção.
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
    contatosRD: { id: "crd1", campos: {} },
    empresasRD: { id: "erd1", campos: {} },
    membros: { "fulano@boxersoldas.com.br": "999" }
};

describe("gerar-pipefy-mapa-env — montarMapaReduzido (Tarefa A4, 2º adendo)", () => {
    it("com PIPEFY_PIPES_PORTAL só INDÚSTRIA - INTERNO, inclui também BMAX, REVENDA - INTERNO e FUNIL SDR", () => {
        const reduzido = montarMapaReduzido(MAPA_COMPLETO, ["INDÚSTRIA - INTERNO"]);

        expect(Object.keys(reduzido.pipes).sort()).toEqual(["BMAX", "FUNIL SDR", "INDÚSTRIA - INTERNO", "REVENDA - INTERNO"]);
        expect(reduzido.contatos).toEqual(MAPA_COMPLETO.contatos);
        expect(reduzido.empresas).toEqual(MAPA_COMPLETO.empresas);
        expect(reduzido.contatosRD).toEqual(MAPA_COMPLETO.contatosRD);
        expect(reduzido.empresasRD).toEqual(MAPA_COMPLETO.empresasRD);
        expect(reduzido.membros).toEqual(MAPA_COMPLETO.membros);
    });

    it("não duplica BMAX/REVENDA - INTERNO/FUNIL SDR se já estiverem em pipesPortal", () => {
        const reduzido = montarMapaReduzido(MAPA_COMPLETO, ["BMAX", "REVENDA - INTERNO", "FUNIL SDR"]);

        expect(Object.keys(reduzido.pipes).sort()).toEqual(["BMAX", "FUNIL SDR", "REVENDA - INTERNO"]);
    });

    it("ignora (com aviso) um pipe que não existe no mapa completo, sem quebrar os demais", () => {
        const errorSpy = jest.spyOn(console, "error").mockImplementation(() => {});

        const reduzido = montarMapaReduzido(MAPA_COMPLETO, ["PIPE INEXISTENTE"]);

        expect(reduzido.pipes["PIPE INEXISTENTE"]).toBeUndefined();
        expect(Object.keys(reduzido.pipes).sort()).toEqual(["BMAX", "FUNIL SDR", "REVENDA - INTERNO"]);
        expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining("PIPE INEXISTENTE"));

        errorSpy.mockRestore();
    });
});
