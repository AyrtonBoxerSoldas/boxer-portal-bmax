// Testa a leitura de configuração do Pipefy — nunca chama a API real.
describe("pipefyConstants", () => {
    const MAPA_TESTE = {
        pipes: { BMAX: { id: "307397065", fases: { "Leads Revenda": "1" }, campos: { PCI: "pci" } } },
        contatos: { id: "CCt1tB1F", campos: { "Nome": "nome", "E-mail": "e_mail" } },
        empresas: { id: "d-K0ZaIH", campos: {} }
    };

    beforeEach(() => {
        jest.resetModules();
        delete process.env.PIPEFY_MAPA_JSON;
    });

    it("lê a configuração de PIPEFY_MAPA_JSON quando a variável está definida", () => {
        process.env.PIPEFY_MAPA_JSON = JSON.stringify(MAPA_TESTE);
        const { PIPEFY_PIPE_BMAX, PIPEFY_FASES, PIPEFY_CAMPOS, PIPEFY_TABELA_CONTATOS, PIPEFY_CAMPO_CONTATO_EMAIL } = require("./pipefyConstants");

        expect(PIPEFY_PIPE_BMAX).toBe("307397065");
        expect(PIPEFY_FASES).toEqual({ "Leads Revenda": "1" });
        expect(PIPEFY_CAMPOS).toEqual({ PCI: "pci" });
        expect(PIPEFY_TABELA_CONTATOS).toBe("CCt1tB1F");
        expect(PIPEFY_CAMPO_CONTATO_EMAIL).toBe("e_mail");
    });

    it("lança erro claro quando PIPEFY_MAPA_JSON não é um JSON válido", () => {
        process.env.PIPEFY_MAPA_JSON = "{ isso não é json";

        expect(() => require("./pipefyConstants")).toThrow("PIPEFY_MAPA_JSON não é um JSON válido");
    });

    it("sem PIPEFY_MAPA_JSON e sem mapa_pipefy.json local, tudo fica null/vazio (não quebra)", () => {
        jest.doMock("../../mapa_pipefy.json", () => { throw new Error("Cannot find module"); }, { virtual: true });
        // Simula ausência do arquivo local de outra forma: como o arquivo REALMENTE existe
        // neste repo (uso local do dev), testamos o fallback via require mockado.
        jest.resetModules();
        jest.doMock("../../mapa_pipefy.json", () => {
            throw new Error("Cannot find module '../../mapa_pipefy.json'");
        }, { virtual: false });

        const { PIPEFY_PIPE_BMAX, PIPEFY_FASES, PIPEFY_CAMPOS } = require("./pipefyConstants");

        expect(PIPEFY_PIPE_BMAX).toBeNull();
        expect(PIPEFY_FASES).toEqual({});
        expect(PIPEFY_CAMPOS).toEqual({});
    });

    it("exigirConfig lança erro descritivo quando o valor é vazio", () => {
        const { exigirConfig } = require("./pipefyConstants");
        expect(() => exigirConfig(null, "o ID do pipe BMAX")).toThrow("Pipefy não configurado: falta o ID do pipe BMAX em mapa_pipefy.json");
    });

    it("exigirConfig devolve o valor quando ele existe", () => {
        const { exigirConfig } = require("./pipefyConstants");
        expect(exigirConfig("abc", "qualquer coisa")).toBe("abc");
    });

    // Fase 5 (18/11/2026): campo PCI do CRM BOXER SOLDAS ("Perfil PCI 🤖")
    // usa 12A/12B maiúsculo — pciParaPipefy/pciDoPipefy traduzem nos dois
    // sentidos só pra esse pipe. "Sem PCI" foi adicionado como opção de
    // verdade nesse campo (confirmado ao vivo, 19/11/2026) — não precisa
    // mais de tradução nenhuma, passa como identidade igual a qualquer
    // outro valor.
    it("pciParaPipefy traduz a grafia formal pra do CRM BOXER SOLDAS, e não mexe em outros pipes", () => {
        const { pciParaPipefy } = require("./pipefyConstants");
        expect(pciParaPipefy("CRM BOXER SOLDAS", "PCI 12a")).toBe("PCI 12A");
        expect(pciParaPipefy("CRM BOXER SOLDAS", "PCI 12b")).toBe("PCI 12B");
        expect(pciParaPipefy("CRM BOXER SOLDAS", "Sem PCI")).toBe("Sem PCI");
        expect(pciParaPipefy("CRM BOXER SOLDAS", "PCI 5")).toBe("PCI 5");
        expect(pciParaPipefy("BMAX", "PCI 12a")).toBe("PCI 12a");
    });

    it("pciDoPipefy traduz a grafia do CRM BOXER SOLDAS pra formal, e não mexe em outros pipes", () => {
        const { pciDoPipefy } = require("./pipefyConstants");
        expect(pciDoPipefy("CRM BOXER SOLDAS", "PCI 12A")).toBe("PCI 12a");
        expect(pciDoPipefy("CRM BOXER SOLDAS", "PCI 12B")).toBe("PCI 12b");
        expect(pciDoPipefy("CRM BOXER SOLDAS", "PCI 5")).toBe("PCI 5");
        expect(pciDoPipefy("BMAX", "PCI 12A")).toBe("PCI 12A");
    });
});
