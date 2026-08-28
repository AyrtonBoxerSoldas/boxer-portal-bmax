// Cliente compartilhado para o Supabase REST (projeto boxer-sistemas) usando a
// chave anon. A chave vem de SUPABASE_ANON_KEY_SISTEMAS (env) — não deve ser
// hardcoded no código-fonte: é um segredo de longa duração e commitá-lo impede
// rotação sem um deploy, além de já ter vazado no histórico do git uma vez.
const SB_SISTEMAS_URL = "https://bmepxcnrsofofoswubuu.supabase.co";

function anonKey() {
    const key = process.env.SUPABASE_ANON_KEY_SISTEMAS;
    if (!key) throw new Error("SUPABASE_ANON_KEY_SISTEMAS não configurada");
    return key;
}

async function sbSistemasAnon(path, method = "GET", body = null, extraHeaders = null) {
    const headers = {
        apikey: anonKey(),
        Authorization: `Bearer ${anonKey()}`,
        "Content-Type": "application/json",
        Prefer: method === "POST" || method === "PATCH" ? "return=representation" : "",
        ...extraHeaders
    };
    const opts = { method, headers };
    if (body) opts.body = JSON.stringify(body);

    const res = await fetch(`${SB_SISTEMAS_URL}/rest/v1${path}`, opts);
    if (!res.ok) {
        const e = await res.text();
        throw new Error(`Supabase ${res.status}: ${e}`);
    }
    return method === "DELETE" ? res : res.json().catch(() => ({}));
}

module.exports = { SB_SISTEMAS_URL, sbSistemasAnon };
