jest.mock("../database", () => ({ sequelize: { query: jest.fn() } }));
jest.mock("../logger", () => ({ logger: { warn: jest.fn(), info: jest.fn(), error: jest.fn() } }));
const { sequelize } = require("../database");
const svc = require("./negociacaoStatus.service");

describe("negociacaoStatus.service", () => {
    beforeEach(() => sequelize.query.mockReset());
    test("validação de status e motivo", () => {
        expect(svc.validar({ tipo: "status", status: "Em contato" })).toBeNull();
        expect(svc.validar({ tipo: "status", status: "xyz" })).toBe("Status inválido");
        expect(svc.validar({ tipo: "perda", motivo: "" })).toBe("Informe o motivo da perda");
        expect(svc.validar({ tipo: "perda", motivo: "Outro" })).toMatch(/Outro/);
        expect(svc.validar({ tipo: "perda", motivo: "Outro", observacao: "x" })).toBeNull();
    });
    test("grava histórico e a anotação do card sem acento", async () => {
        sequelize.query.mockResolvedValueOnce([{ id: 7 }]).mockResolvedValueOnce([]);
        const createNote = jest.fn().mockResolvedValue({});
        const r = await svc.registrar({ dealId: "d1", tipo: "perda", motivo: "Preço acima do esperado", revenda: "Aldesoldas", usuario: "ald" }, createNote);
        expect(r).toEqual({ id: 7, notaGravada: true });
        const texto = createNote.mock.calls[0][1];
        expect(texto).toMatch(/PERDIDO PELA REVENDA - Motivo: Preco acima do esperado/);
        expect(texto).not.toMatch(/[À-ÿ]/);
    });
    test("falha na anotação não perde o registro", async () => {
        sequelize.query.mockResolvedValueOnce([{ id: 8 }]);
        const r = await svc.registrar({ dealId: "d1", tipo: "status", status: "Pendente", revenda: "A", usuario: "a" }, jest.fn().mockRejectedValue(new Error("rd fora")));
        expect(r).toEqual({ id: 8, notaGravada: false });
    });
});
