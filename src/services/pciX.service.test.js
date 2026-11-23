jest.mock("../database", () => ({ sequelize: { query: jest.fn() } }));
const px = require("./pciX.service");
const { resolverComissao } = require("./cashback.service");

describe("PCI X", () => {
    test("reconhece o PCI X em qualquer grafia", () => {
        expect(px.ehPciX("PCI X")).toBe(true); expect(px.ehPciX("pcix")).toBe(true); expect(px.ehPciX("PCI 12a")).toBe(false);
    });
    test("alertas: dias 15, 25, 30 e depois a cada 7, sem repetir", () => {
        expect(px.deveAlertar(15.2, 0)).toBe(true);
        expect(px.deveAlertar(15.9, 15)).toBe(false);
        expect(px.deveAlertar(20, 0)).toBe(false);
        expect(px.deveAlertar(25, 15)).toBe(true);
        expect(px.deveAlertar(30, 25)).toBe(true);
        expect(px.deveAlertar(37, 30)).toBe(true);
        expect(px.deveAlertar(38, 37)).toBe(false);
        expect(px.deveAlertar(44, 37)).toBe(true);
    });
    test("prazo de 30 dias: vence no dia 30", () => {
        const agora = Date.now(), dia = 86_400_000;
        expect(px.situacao(agora - 29 * dia, agora)).toMatchObject({ dias: 29, restantes: 1, vencido: false });
        expect(px.situacao(agora - 30 * dia, agora).vencido).toBe(true);
    });
    test("PCI X nunca gera comissão", async () => {
        expect(await resolverComissao("PCI X", "Revenda", "1")).toBe(0);
        expect(await resolverComissao("PCI X", "Rep", "3")).toBe(0);
    });
});
