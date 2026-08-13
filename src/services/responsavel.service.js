const ExcelJS = require("exceljs");
const path = require("path");

const filePath = path.join(__dirname, "../data/Base IBGE_Area Vendedores Boxer.xlsx");

let cachedWorksheet = null;

async function loadWorksheet() {
    if (cachedWorksheet) return cachedWorksheet;
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile(filePath);
    cachedWorksheet = workbook.getWorksheet("Base IBGE");
    return cachedWorksheet;
}

async function lerPlanilhaResponsavel(municipio, estado) {
    const worksheet = await loadWorksheet();

    let linha = 0;

    worksheet.getColumn(17).eachCell((cell, rowNumber) => {
        if (cell.value === municipio) {
            if (worksheet.getCell(rowNumber, 2).value === estado) {
                linha = rowNumber;
            }
        }
    });

    if (!linha) {
        return null;
    }

    const responsavel = worksheet.getCell(linha, 21).value || null;
    return responsavel;
}

module.exports = {
    lerPlanilhaResponsavel
};
