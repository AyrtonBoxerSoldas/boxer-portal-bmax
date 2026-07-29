const ExcelJS = require("exceljs");
const path = require("path");

const filePath = path.join(__dirname, "../data/BMAX CRITERIOS V2.xlsx");

async function lerPlanilhaCashback(pci, role, classepreco) {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile(filePath);

    const worksheet = workbook.getWorksheet("PCI Versão 2 (atual)");

    let porcentagem = 0;
    let linha = 0;
    let coluna = 0;

    worksheet.getRow(2).eachCell((cell, colNumber) => {
        console.log(`Coluna ${colNumber}:`, cell.value);

        if (cell.value === pci && colNumber >= 7) {
            console.log("Encontrou o valor!");
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

    console.log("linha: ", linha);
    console.log("coluna: ", coluna);
    if (linha !== 0 && coluna !== 0) {
        const cellValue = worksheet.getRow(linha).getCell(coluna).value;

        console.log(typeof cellValue);

        if (typeof cellValue === "string" && cellValue.includes("-")) {
            linha = role === "revenda" ? 21 : role === "representante" ? 35 : -10;

            linha += classepreco;

            porcentagem = worksheet.getRow(rowNumber).getCell(coluna).value;

        } else {
            porcentagem = cellValue;
        }
    }

    console.log(`Porcentagem: ${porcentagem}`);

    return porcentagem;
}

module.exports = {
    lerPlanilhaCashback
};