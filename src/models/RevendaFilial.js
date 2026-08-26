const { DataTypes } = require("sequelize");

module.exports = (sequelize) => {
    const RevendaFilial = sequelize.define("RevendaFilial", {
        id: {
            type: DataTypes.INTEGER,
            primaryKey: true,
            autoIncrement: true
        },
        user_id: {
            type: DataTypes.INTEGER,
            allowNull: false,
            references: {
                model: "Revendas",
                key: "user_id"
            },
            onDelete: "CASCADE"
        },
        nome: {
            type: DataTypes.STRING,
            allowNull: false
        },
        telefone: {
            type: DataTypes.STRING(20),
            allowNull: true
        },
        email: {
            type: DataTypes.STRING,
            allowNull: true
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
        },
        endereco: {
            type: DataTypes.STRING,
            allowNull: true
        },
        numero: {
            type: DataTypes.STRING,
            allowNull: true
        },
        complemento: {
            type: DataTypes.STRING,
            allowNull: true
        },
        principal: {
            type: DataTypes.BOOLEAN,
            defaultValue: false
        }
    }, {
        tableName: "RevendaFiliais",
        timestamps: false
    });

    return RevendaFilial;
};
