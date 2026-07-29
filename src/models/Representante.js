const { DataTypes } = require("sequelize");

module.exports = (sequelize) => {
    const Representante = sequelize.define("Representante", {
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
        email: {
            type: DataTypes.STRING,
            allowNull: false,
            unique: true,
            validate: {
                isEmail: true
            }
        }
    }, {
        tableName: "Representantes",
        timestamps: false
    });

    return Representante;
};