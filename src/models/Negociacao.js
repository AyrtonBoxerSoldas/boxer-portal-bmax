const { DataTypes } = require("sequelize");

module.exports = (sequelize) => {
    const Negociacao = sequelize.define("Negociacao", {
        id: {
            type: DataTypes.INTEGER,
            autoIncrement: true,
            primaryKey: true,
            unique: true
        },
        user_id: {
            type: DataTypes.INTEGER,
            allowNull: false,
            references: {
                model: "Users",
                key: "id"
            },
            onDelete: "CASCADE"
        },
        cnpj: {
            type: DataTypes.STRING,
            allowNull: false,
            // O CNPJ pode se repetir em negociações diferentes.
            validate: {
                len: [14, 14],
                isNumeric: true
            }
        },
        nome: {
            type: DataTypes.STRING,
            allowNull: false
        },
        cidade: {
            type: DataTypes.STRING
        },
        cep: {
            type: DataTypes.STRING,
            allowNull: false,
            validate: {
                len: [8, 8],
                isNumeric: true
            }
        },
        maquina: {
            type: DataTypes.STRING
        },
        arquivo: {
            type: DataTypes.STRING
        },
        revenda: {
            type: DataTypes.STRING,
            allowNull: false
        },
        representante: {
            type: DataTypes.STRING,
            allowNull: true
        },
        status: {
            type: DataTypes.STRING,
            defaultValue: "Ativa"
        },
        expires_at: {
            type: DataTypes.DATE
        }
    }, {
        tableName: "Negociacoes"
    });
    return Negociacao;
};
