const { DataTypes } = require("sequelize");

module.exports = (sequelize) => {
    const Revenda = sequelize.define("Revenda", {
        user_id: {
            type: DataTypes.INTEGER,
            allowNull: false,
            unique: true,
            primaryKey: true,
            references: {
                model: "Users",
                key: "id"
            },
            onDelete: "CASCADE"
        },
        name: {
            type: DataTypes.STRING,
            allowNull: true
        },
        email: {
            type: DataTypes.STRING,
            allowNull: true
        },
        telefone: {
            type: DataTypes.STRING(20),
            allowNull: true
        },
        grupo: {
            type: DataTypes.STRING,
            allowNull: true
        },
        cnpj: {
            type: DataTypes.STRING(14),
            allowNull: false,
            unique: true,
            validate: {
                len: [14, 14],
                isNumeric: true
            }
        },
        cep: {
            type: DataTypes.STRING(8),
            allowNull: false,
            validate: {
                len: [8, 8],
                isNumeric: true
            }
        },
        cidade: {
            type: DataTypes.STRING,
            allowNull: false
        },
        estado: {
            type: DataTypes.STRING(2),
            allowNull: false
        }
    }, {
        tableName: "Revendas",
        timestamps: false
    });

    return Revenda;
};