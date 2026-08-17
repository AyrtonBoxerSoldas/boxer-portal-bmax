const createUserModel = require("../models/User");
const createRepresentanteModel = require("../models/Representante");
const createRevendaModel = require("../models/Revenda");
const createNegociacaoModel = require("../models/Negociacao");
const createAuditLogModel = require("../models/AuditLog");
const dotenv = require("dotenv");
const { Sequelize } = require("sequelize");

dotenv.config();

const dialect = process.env.DB_DIALECT || "mysql";

const sequelize = process.env.DATABASE_URL
    ? new Sequelize(process.env.DATABASE_URL, {
        dialect: dialect,
        logging: false,
        ...(dialect === "postgres" && {
            dialectOptions: {
                ssl: { require: true, rejectUnauthorized: false }
            }
        })
    })
    : new Sequelize(
        process.env.DB_NAME,
        process.env.DB_USER,
        process.env.DB_PASS,
        {
            host: process.env.DB_HOST,
            port: process.env.DB_PORT || (dialect === "postgres" ? 5432 : 3306),
            dialect: dialect,
            logging: false,
        }
    );

// Inicializa models
const User = createUserModel(sequelize);
const Representante = createRepresentanteModel(sequelize);
const Revenda = createRevendaModel(sequelize);
const Negociacao = createNegociacaoModel(sequelize);
const AuditLog = createAuditLogModel(sequelize);

// Relacionamentos
User.hasOne(Representante, { foreignKey: "user_id" });
Representante.belongsTo(User, { foreignKey: "user_id" });
User.hasOne(Revenda, { foreignKey: "user_id"});
Revenda.belongsTo(User, { foreignKey: "user_id" });
User.hasOne(Negociacao, { foreignKey: "user_id" });
Negociacao.belongsTo(User, { foreignKey: "user_id" });

// Exporta tudo
module.exports = {
    sequelize,
    User,
    Representante,
    Revenda,
    Negociacao,
    AuditLog
};