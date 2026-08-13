const ExcelJS = require("exceljs");
const path = require("path");

const filePath = path.join(__dirname, "../data/BMAX CRITERIOS V2.xlsx");

let cachedWorksheet = null;

async function loadWorksheet() {
    if (cachedWorksheet) return cachedWorksheet;
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile(filePath);
    cachedWorksheet = workbook.getWorksheet("PCI Versão 2 (atual)");
    return cachedWorksheet;
}

async function lerPlanilhaCashback(pci, role, classepreco) {
    const worksheet = await loadWorksheet();

    let porcentagem = 0;
    let linha = 0;
    let coluna = 0;

    worksheet.getRow(2).eachCell((cell, colNumber) => {
        if (cell.value === pci && colNumber >= 7) {
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
