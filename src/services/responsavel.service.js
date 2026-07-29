const ExcelJS = require("exceljs");
const path = require("path");

const filePath = path.join(__dirname, "../data/Base IBGE_Area Vendedores Boxer.xlsx");

async function lerPlanilhaResponsavel(municipio, estado) {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile(filePath);

    const worksheet = workbook.getWorksheet("Base IBGE");

    let linha = 0;

    worksheet.getColumn(17).eachCell((cell, rowNumber) => {

        if (cell.value === municipio) {
            console.log(`Linha ${rowNumber}:`, cell.value);
            if (worksheet.getCell(rowNumber, 2).value === estado)
            {
                console.log("Encontrou o município!");
                linha = rowNumber;
            }
        }
    });

    if (!linha) {
        console.log("Município/estado não encontrado na planilha.");
        return null;
    }
    
    const responsavel = worksheet.getCell(linha, 21).value || null;

    console.log("Responsável:", responsavel);
    return responsavel;
}

module.exports = {
    lerPlanilhaResponsavel
};