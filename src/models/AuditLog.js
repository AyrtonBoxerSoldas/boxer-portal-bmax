const { DataTypes } = require("sequelize");

module.exports = (sequelize) => {
    const AuditLog = sequelize.define("AuditLog", {
        id: {
            type: DataTypes.BIGINT,
            autoIncrement: true,
            primaryKey: true
        },
        user_id: {
            type: DataTypes.INTEGER,
            allowNull: true,
            references: {
                model: "Users",
                key: "id"
            },
            onDelete: "SET NULL"
        },
        username: {
            type: DataTypes.STRING,
            allowNull: true
        },
        role: {
            type: DataTypes.STRING,
            allowNull: true
        },
        action: {
            type: DataTypes.STRING(80),
            allowNull: false
        },
        entity_type: {
            type: DataTypes.STRING(80),
            allowNull: true
        },
        entity_id: {
            type: DataTypes.STRING(120),
            allowNull: true
        },
        status: {
            type: DataTypes.STRING(30),
            allowNull: false,
            defaultValue: "success"
        },
        ip_address: {
            type: DataTypes.STRING(80),
            allowNull: true
        },
        user_agent: {
            type: DataTypes.TEXT,
            allowNull: true
        },
        metadata: {
            type: DataTypes.JSON,
            allowNull: true
        }
    }, {
        tableName: "AuditLogs"
    });

    return AuditLog;
}