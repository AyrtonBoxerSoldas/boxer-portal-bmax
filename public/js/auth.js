const dotenv = require("dotenv");
dotenv.config();

const response = await fetch("/api/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username: user, password: pass, role: role })
});

if (!response.ok) {
    throw new Error("Erro no login");
}

const data = await response.json();

if (!data.token) {
    throw new Error("Token não recebido");
}

localStorage.setItem("token", data.token);

const leadsResponse = await fetch("http://localhost:3000/api/leads", {
    method: "GET",
    headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${data.token}`
    }
});

if (!leadsResponse.ok) {
    console.log("Erro ao buscar leads: ", leadsResponse.status);
}

const leads = await leadsResponse.json();
console.log("Teste: ", leads);

fetch("http://localhost:3000/api/leads", {
    headers: {
        Authorization: `Bearer ${data.token}`
    }
});