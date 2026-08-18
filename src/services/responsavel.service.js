const path = require("path");
const fs = require("fs");

const jsonPath = path.join(__dirname, "../data/ibge_responsaveis.json");
const xlsxPath = path.join(__dirname, "../data/Base IBGE_Area Vendedores Boxer.xlsx");

let cachedData = null;

function loadData() {
    if (cachedData) return cachedData;

    if (fs.existsSync(jsonPath)) {
        const raw = fs.readFileSync(jsonPath, "utf-8");
        cachedData = JSON.parse(raw).data;
        return cachedData;
    }

    const ExcelJS = require("exceljs");
    return null;
}

async function lerPlanilhaResponsavel(municipio, estado) {
    let data = loadData();

    if (data) {
        const entry = data.find(
            e => e.municipio === municipio && e.estado === estado
        );
        return entry ? entry.responsavel : null;
    }

    const ExcelJS = require("exceljs");
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile(xlsxPath);
    const worksheet = workbook.getWorksheet("Base IBGE");

    let linha = 0;
    worksheet.getColumn(17).eachCell((cell, rowNumber) => {
        if (cell.value === municipio) {
            if (worksheet.getCell(rowNumber, 2).value === estado) {
                linha = rowNumber;
            }
        }
    });

    if (!linha) return null;
    return worksheet.getCell(linha, 21).value || null;
}

module.exports = {
    lerPlanilhaResponsavel
};
