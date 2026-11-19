// Resolvedor nome -> código (código único de revenda/grupo/representante). Supabase é simulado.
jest.mock("../config/supabaseSistemas", () => ({ sbSistemasService: jest.fn() }));
jest.mock("../logger", () => ({ logger: { warn: jest.fn(), info: jest.fn(), error: jest.fn() } }));
const { sbSistemasService } = require("../config/supabaseSistemas");

const DADOS = {
    apelidos: [
        { entidade: "revenda", entidade_id: "L1", apelido_norm: "42863 alphabras pocos de caldas 1" },
        { entidade: "grupo", entidade_id: "G1", apelido_norm: "alphabras" },
        { entidade: "representante", entidade_id: "R9", apelido_norm: "santos" }
    ],
    lojas: [
        { id: "L1", nome: "42863, Alpha Abras", nome_rd: "Alphabras", ativo: true, grupo: "Alphabras", grupo_id: "G1" },
        { id: "L2", nome: "Aldesoldas", nome_rd: "Aldesoldas", ativo: true, grupo: null, grupo_id: null },
        { id: "L3", nome: "Alphabras SJBV", nome_rd: "Alphabras", ativo: true, grupo: "Alphabras", grupo_id: "G1" }
    ],
    reps: [{ id: "R1", nome: "Caio P Mancini", rd_alias: "Caio Tito" }],
    grupos: [{ id: "G1", nome: "Alphabras" }]
};
function carregarMock() {
    sbSistemasService.mockImplementation(async (path) => {
        if (path.startsWith("/comercial_bmax_apelidos")) return DADOS.apelidos;
        if (path.startsWith("/comercial_revendas_bmax")) return DADOS.lojas;
        if (path.startsWith("/comercial_representantes_bmax")) return DADOS.reps;
        if (path.startsWith("/comercial_bmax_grupos")) return DADOS.grupos;
        return [];
    });
}

describe("codigoUnico.service", () => {
    const svc = require("./codigoUnico.service");
    beforeEach(() => { sbSistemasService.mockReset(); carregarMock(); svc.limparCache(); });

    test("revenda pelo nome do cadastro (sem acento/caixa)", async () => {
        expect(await svc.codigoDe("ALDESOLDAS", "revenda")).toEqual({ revenda_id: "L2", grupo_id: null, representante_id: null });
    });
    test("nome do grupo vira código de GRUPO (apelido tem prioridade sobre a loja de mesmo nome)", async () => {
        expect(await svc.codigoDe("Alphabras", "revenda")).toEqual({ revenda_id: null, grupo_id: "G1", representante_id: null });
    });
    test("nome antigo do ZEN resolve pela loja via apelido", async () => {
        expect((await svc.codigoDe("42863 Alphabras Poços de Caldas 1", "revenda")).revenda_id).toBe("L1");
    });
    test("representante por nome, alias do RD e apelido", async () => {
        expect((await svc.codigoDe("Caio P Mancini", "representante")).representante_id).toBe("R1");
        expect((await svc.codigoDe("caio tito", "representante")).representante_id).toBe("R1");
        expect((await svc.codigoDe("SANTOS", "representante")).representante_id).toBe("R9");
    });
    test("sem entidade: vendedor interno, nome desconhecido e vazio ficam sem código (e nunca lançam erro)", async () => {
        const vazio = { revenda_id: null, grupo_id: null, representante_id: null };
        expect(await svc.codigoDe("Billy", "vendedor_interno")).toEqual(vazio);
        expect(await svc.codigoDe("nome que nao existe", "revenda")).toEqual(vazio);
        expect(await svc.codigoDe("", "revenda")).toEqual(vazio);
    });
    test("falha do banco não bloqueia: devolve vazio", async () => {
        sbSistemasService.mockReset(); sbSistemasService.mockRejectedValue(new Error("fora do ar")); svc.limparCache();
        expect(await svc.codigoDe("Aldesoldas", "revenda")).toEqual({ revenda_id: null, grupo_id: null, representante_id: null });
    });
    test("códigos do grupo: id do grupo e das lojas (pelo nome do grupo)", async () => {
        expect(await svc.codigosDoGrupo("alphabras")).toEqual({ grupoId: "G1", lojaIds: ["L1", "L3"] });
        expect(await svc.codigosDoGrupo("grupo inexistente")).toEqual({ grupoId: null, lojaIds: [] });
    });
    test("semRecarga não refaz a consulta quando o nome não existe", async () => {
        await svc.codigoDe("Aldesoldas", "revenda"); const chamadas = sbSistemasService.mock.calls.length;
        await svc.codigoDe("nome que nao existe", "revenda", { semRecarga: true });
        expect(sbSistemasService.mock.calls.length).toBe(chamadas);
    });
});
