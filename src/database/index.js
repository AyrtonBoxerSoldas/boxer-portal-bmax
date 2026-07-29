const createUserModel = require("../models/User");
const createRepresentanteModel = require("../models/Representante");
const createRevendaModel = require("../models/Revenda");
const createRdTokenModel = require("../models/RdToken");
const createNegociacaoModel = require("../models/Negociacao");
const dotenv = require("dotenv");
const { Sequelize } = require("sequelize");

dotenv.config();

const sequelize = new Sequelize(
    process.env.DB_NAME, // nome do banco
    process.env.DB_USER, // usuário
    process.env.DB_PASS, // senha
    {
        host: process.env.DB_HOST,
        dialect: "mysql",
        logging: false,
        /*
        dialectOptions: {
            ssl: {
                require: true,
                rejectUnauthorized: false
            }
        }
        */
    }
);

// Inicializa models
const User = createUserModel(sequelize);
const Representante = createRepresentanteModel(sequelize);
const Revenda = createRevendaModel(sequelize);
const RdToken = createRdTokenModel(sequelize);
const Negociacao = createNegociacaoModel(sequelize);

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
    RdToken,
    Negociacao
};