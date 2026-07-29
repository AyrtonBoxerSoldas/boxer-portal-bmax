const { DataTypes } = require("sequelize");

module.exports = (sequelize) => {
    const RdToken = sequelize.define("RdToken", {
        id: {
            type: DataTypes.INTEGER,
            primaryKey: true,
            autoIncrement: true
        },
        access_token: {
            type: DataTypes.TEXT,
            allowNull: false
        },
        refresh_token: {
            type: DataTypes.TEXT,
            allowNull: false
        }
    }, {
        tableName: "rd_tokens",
        timestamps: true
    });

    return RdToken;
};