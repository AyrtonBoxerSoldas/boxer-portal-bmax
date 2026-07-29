import sequelize from "../PortalBoxer/src/database/index.js";
import RdToken from "../PortalBoxer/src/models/RdToken.js";
import dotenv from "dotenv";

dotenv.config();

async function seed() {
    console.log("DB_PASSWORD:", process.env.DB_PASSWORD);
    await sequelize.sync({ alter: true });

    const existing = await RdToken.findOne();

    if (existing) {
        console.log("Token já existe no banco.");
        return;
    }

    await RdToken.create({
        access_token: process.env.RD_ACCESS_TOKEN,
        refresh_token: process.env.RD_REFRESH_TOKEN
    });

    console.log("Token inicial inserido com sucesso!");
}

seed();