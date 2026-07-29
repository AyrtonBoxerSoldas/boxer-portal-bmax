
const { RdToken } = require("../database");
const { getRdToken } = require("./rd.token.service");
const RD_AUTH_URL = "https://api.rd.services/oauth2/token";

async function refreshAccessToken(refresh_token) {

    const body = new URLSearchParams({
        grant_type: "refresh_token",
        refresh_token: refresh_token,
        client_id: process.env.RD_CLIENT_ID,
        client_secret: process.env.RD_CLIENT_SECRET
    });

    const response = await fetch(RD_AUTH_URL, {
        method: "POST",
        headers: {
            "Content-Type": "application/x-www-form-urlencoded"
        },
        body: body.toString()
    });

    //const text = await response.text();
    //console.log("Status:", response.status);
    //console.log("Body:", text);
    //console.log(body);

    const data = await response.json();
    
    if (!response.ok) {
        console.log("Erro ao renovar token RD: ", response);
        throw new Error(response?.error_description || "Falha ao renovar token RD");
    }

    console.log("Status: ", response.status);
    console.log("Resposta: ", data);

    await RdToken.update({
        access_token: data.access_token,
        refresh_token: data.refresh_token
    }, {
        where: { id: 1 }
    });

    return data;
}

async function getValidAccessToken() {
    const token = await getRdToken();

    console.log(token.access_token);
    console.log(token.refresh_token);
    try {
        return token;
    } catch (err) {
        const newToken = await refreshAccessToken(token.refresh_token);

        return newToken;
    }
}

module.exports = {
    refreshAccessToken,
    getValidAccessToken
};