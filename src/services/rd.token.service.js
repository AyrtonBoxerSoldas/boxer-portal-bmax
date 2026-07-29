const { RdToken } = require("../database");

async function getRdToken() {
    const token = await RdToken.findOne();

    if (!token) {
        throw new Error("Token RD nè´™o encontrado no banco");
    }
    //console.log(token);
    return token;
}

module.exports = {
    getRdToken
}