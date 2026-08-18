const path = require("path");
const fs = require("fs");

const jsonPath = path.join(__dirname, "../data/bmax_criterios.json");
const xlsxPath = path.join(__dirname, "../data/BMAX CRITERIOS V2.xlsx");

let cachedJson = null;

function loadJson() {
    if (cachedJson) return cachedJson;
    if (fs.existsSync(jsonPath)) {
        cachedJson = JSON.parse(fs.readFileSync(jsonPath, "utf-8"));
        return cachedJson;
    }
    return null;
}

async function lerPlanilhaCashback(pci, role, classepreco) {
    const pciKey = (pci || "").toUpperCase().replace(/\s/g, "");

    const data = loadJson();
    if (data && data.cashback) {
        const roleKey = role === "revenda" ? "revenda" : "representante";
        const entry = data.cashback[roleKey]?.[pciKey];
        if (!entry) return 0;
        if (entry.tipo === "fixo") return entry.valor || 0;
        if (entry.tipo === "por_classe") return entry.valores?.[String(classepreco)] || 0;
        return 0;
    }

    const ExcelJS = require("exceljs");
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile(xlsxPath);
    const worksheet = workbook.getWorksheet("PCI Versão 2 (atual)");

    let porcentagem = 0;
    let linha = 0;
    let coluna = 0;

    worksheet.getRow(2).eachCell((cell, colNumber) => {
        if (colNumber >= 7 && String(cell.value || "").toUpperCase().replace(/\s/g, "") === pciKey) {
            coluna = colNumber;
        }
    });

    switch (role) {
        case "revenda":
            linha = 18;
            break;
        case "representante":
            linha = 16;
            break;
    }

    if (linha !== 0 && coluna !== 0) {
        const cellValue = worksheet.getRow(linha).getCell(coluna).value;
        if (typeof cellValue === "string" && cellValue.includes("-")) {
            linha = role === "revenda" ? 21 : role === "representante" ? 35 : -10;
            linha += classepreco;
            porcentagem = worksheet.getRow(linha).getCell(coluna).value;
        } else {
            porcentagem = cellValue;
        }
    }

    return porcentagem;
}

module.exports = {
    lerPlanilhaCashback
};
