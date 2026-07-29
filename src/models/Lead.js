const { DataTypes } = require("sequelize");

module.exports = (sequelize) => {
    const Lead = sequelize.define("Lead", {
        id: {
            type: DataTypes.INTEGER,
            primaryKey: true,
            autoIncrement: true
        },
        nome: DataTypes.STRING,
        cnpj: DataTypes.STRING,
        cidade: DataTypes.STRING,
        revenda: DataTypes.STRING,
        representante: DataTypes.STRING
    });

    return Lead;
};