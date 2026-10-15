// Orçamentos anexados à Nova Negociação (André, 14/10/2026).
// O arquivo fica no Storage do Supabase (bucket privado) e o card do RD recebe UMA nota com links fixos do
// Portal (/api/orcamento/<token>). O link nunca expira e abre SEM login (quem acessa é o time Boxer no RD):
// ao abrir, o Portal gera na hora um link temporário do Storage e redireciona. Zero credencial que vence
// (não usa a API v2 do RD, que exige OAuth com refresh token rotativo). Link revogável (revogado_em).
const crypto = require("crypto");
const { QueryTypes } = require("sequelize");
const { sequelize } = require("../database");
const { SB_SISTEMAS_URL } = require("../config/supabaseSistemas");
const { logger } = require("../logger");

const BUCKET = "bmax-orcamentos";
const MAX_BYTES = 10 * 1024 * 1024;
const MAX_ARQUIVOS = 3;
const EXTENSOES = new Set(["pdf", "png", "jpg", "jpeg", "xlsx", "xls", "docx", "doc"]);
const PORTAL_URL = process.env.PORTAL_URL || "https://bmax.boxersoldas.com.br";

function serviceKey() {
    const key = process.env.SUPABASE_SERVICE_KEY_SISTEMAS;
    if (!key) throw new Error("SUPABASE_SERVICE_KEY_SISTEMAS não configurada");
    return key;
}
const hdr = () => ({ apikey: serviceKey(), Authorization: `Bearer ${serviceKey()}`, "Content-Type": "application/json" });

// Nome seguro para o caminho do objeto (sem acento, espaço ou símbolo)
function nomeSeguro(nome) {
    const base = String(nome || "arquivo").normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^A-Za-z0-9._-]+/g, "_").replace(/^_+|_+$/g, "");
    return base.slice(-80) || "arquivo";
}

function extensaoDe(nome) {
    const m = /\.([A-Za-z0-9]{2,5})$/.exec(String(nome || ""));
    return m ? m[1].toLowerCase() : "";
}

// 1) Emite a URL de upload direto (navegador -> Storage). Não passa pela Vercel (limite de 4,5 MB de corpo).
async function gerarUploadUrl(user, { nome, tamanho, tipo }) {
    const ext = extensaoDe(nome);
    if (!EXTENSOES.has(ext)) throw new Error("Tipo de arquivo não permitido. Use PDF, imagem (PNG/JPG), Word ou Excel.");
    const tam = Number(tamanho) || 0;
    if (tam <= 0) throw new Error("Arquivo vazio.");
    if (tam > MAX_BYTES) throw new Error("Arquivo maior que 10 MB.");

    // Limpeza preguiçosa: uploads que nunca viraram negociação (> 3 dias) — sem cron novo
    limparPendentesAntigos().catch(() => {});

    const token = crypto.randomBytes(24).toString("hex");           // 192 bits
    const caminho = `${new Date().getFullYear()}/${crypto.randomUUID()}/${nomeSeguro(nome)}`;

    const r = await fetch(`${SB_SISTEMAS_URL}/storage/v1/object/upload/sign/${BUCKET}/${caminho}`, { method: "POST", headers: hdr(), body: "{}" });
    if (!r.ok) throw new Error(`Storage ${r.status}: não foi possível preparar o envio do arquivo.`);
    const j = await r.json();
    const uploadUrl = j.url && j.url.startsWith("http") ? j.url : `${SB_SISTEMAS_URL}/storage/v1${j.url}`;

    const rows = await sequelize.query(
        `INSERT INTO bmax_orcamentos (token, user_id, nome_arquivo, mime, tamanho, caminho) VALUES (:token, :userId, :nome, :mime, :tam, :caminho) RETURNING id`,
        { replacements: { token, userId: user.id, nome: String(nome).slice(0, 200), mime: String(tipo || "").slice(0, 100) || null, tam, caminho }, type: QueryTypes.SELECT }
    );
    return { id: rows[0].id, uploadUrl };
}

async function limparPendentesAntigos() {
    const velhos = await sequelize.query(
        `SELECT id, caminho FROM bmax_orcamentos WHERE status = 'pendente' AND criado_em < now() - interval '3 days' LIMIT 20`,
        { type: QueryTypes.SELECT }
    );
    for (const o of velhos) {
        await fetch(`${SB_SISTEMAS_URL}/storage/v1/object/${BUCKET}/${o.caminho}`, { method: "DELETE", headers: hdr() }).catch(() => {});
        await sequelize.query(`DELETE FROM bmax_orcamentos WHERE id = :id`, { replacements: { id: o.id }, type: QueryTypes.DELETE });
    }
}

// O objeto realmente chegou no Storage? (devolve o tamanho real)
async function tamanhoNoStorage(caminho) {
    const r = await fetch(`${SB_SISTEMAS_URL}/storage/v1/object/info/${BUCKET}/${caminho}`, { headers: hdr() });
    if (!r.ok) return null;
    const j = await r.json().catch(() => null);
    return j ? Number(j.size ?? j.metadata?.size ?? 0) || 0 : null;
}

// 2) Ao salvar a negociação: valida os ids enviados (do próprio usuário, ainda pendentes, até 3, já no Storage).
async function validarParaAnexar(user, ids) {
    const lista = [...new Set((Array.isArray(ids) ? ids : []).map(Number).filter(Number.isInteger))];
    if (!lista.length) return [];
    if (lista.length > MAX_ARQUIVOS) throw new Error(`Anexe no máximo ${MAX_ARQUIVOS} arquivos por negociação.`);
    const rows = await sequelize.query(
        `SELECT * FROM bmax_orcamentos WHERE id IN (:ids) AND user_id = :userId AND status = 'pendente' AND revogado_em IS NULL`,
        { replacements: { ids: lista, userId: user.id }, type: QueryTypes.SELECT }
    );
    if (rows.length !== lista.length) throw new Error("Um dos orçamentos anexados não é válido. Envie o arquivo novamente.");
    for (const o of rows) {
        const tam = await tamanhoNoStorage(o.caminho);
        if (!tam) throw new Error(`O arquivo "${o.nome_arquivo}" não foi enviado por completo. Envie novamente.`);
        if (tam > MAX_BYTES) throw new Error(`O arquivo "${o.nome_arquivo}" passa de 10 MB.`);
    }
    return rows;
}

// 3) Depois que o card existe no RD: vincula e escreve UMA nota com os links fixos.
async function anexarENotificarRD(orcamentos, { negociacaoId, dealId, createNote }) {
    if (!orcamentos.length) return;
    await sequelize.query(
        `UPDATE bmax_orcamentos SET status = 'anexado', negociacao_id = :negociacaoId, deal_id = :dealId WHERE id IN (:ids)`,
        { replacements: { negociacaoId: negociacaoId || null, dealId, ids: orcamentos.map(o => o.id) }, type: QueryTypes.UPDATE }
    );
    await escreverNota(dealId, createNote);
}

// Texto da nota SEM acento: o endpoint /activities do RD corrompe acentuação (mojibake).
const semAcento = s => String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^\x20-\x7E]/g, "");

async function escreverNota(dealId, createNote) {
    const arquivos = await sequelize.query(
        `SELECT id, token, nome_arquivo FROM bmax_orcamentos WHERE deal_id = :dealId AND status = 'anexado' AND revogado_em IS NULL ORDER BY id`,
        { replacements: { dealId }, type: QueryTypes.SELECT }
    );
    if (!arquivos.length) return false;
    // O RD só transforma em link clicável o HTML <a href> (testado no card EmpresaTeste3, 15/10/2026):
    // URL pura e markdown aparecem como texto morto. Nome do arquivo escapado para HTML.
    const esc = s => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
    const linhas = arquivos.map((a, i) => `${i + 1}) <a href="${PORTAL_URL}/api/orcamento/${a.token}" target="_blank">${esc(semAcento(a.nome_arquivo))}</a>`);
    const texto = `ORCAMENTO anexado no Portal BMAX (${arquivos.length} ${arquivos.length === 1 ? "arquivo" : "arquivos"}):\n${linhas.join("\n")}`;
    await createNote(dealId, texto);
    await sequelize.query(`UPDATE bmax_orcamentos SET nota_rd_em = now() WHERE deal_id = :dealId AND status = 'anexado' AND nota_rd_em IS NULL`,
        { replacements: { dealId }, type: QueryTypes.UPDATE });
    return true;
}

// Nota que falhou na hora: o cron já existente (sync-revenda-rep-rd) chama isto e tenta de novo.
async function reenviarNotasPendentes(createNote) {
    const deals = await sequelize.query(
        `SELECT DISTINCT deal_id FROM bmax_orcamentos WHERE status = 'anexado' AND nota_rd_em IS NULL AND revogado_em IS NULL AND deal_id IS NOT NULL LIMIT 20`,
        { type: QueryTypes.SELECT }
    );
    let ok = 0;
    for (const d of deals) {
        try { if (await escreverNota(d.deal_id, createNote)) ok++; }
        catch (e) { logger.error({ message: "Falha ao reenviar nota de orçamento ao RD", dealId: d.deal_id, error: e.message }); }
    }
    return ok;
}

// 4) Link fixo: devolve uma URL temporária (5 min) do Storage, ou null se o link não existe/foi revogado.
async function resolverLink(token) {
    if (!/^[a-f0-9]{48}$/.test(String(token || ""))) return null;
    const rows = await sequelize.query(
        `SELECT id, caminho, nome_arquivo FROM bmax_orcamentos WHERE token = :token AND status = 'anexado' AND revogado_em IS NULL`,
        { replacements: { token }, type: QueryTypes.SELECT }
    );
    if (!rows.length) return null;
    const o = rows[0];
    const r = await fetch(`${SB_SISTEMAS_URL}/storage/v1/object/sign/${BUCKET}/${o.caminho}`, {
        method: "POST", headers: hdr(), body: JSON.stringify({ expiresIn: 300 })
    });
    if (!r.ok) throw new Error(`Storage ${r.status}`);
    const j = await r.json();
    await sequelize.query(`UPDATE bmax_orcamentos SET aberturas = aberturas + 1, ultima_abertura_em = now() WHERE id = :id`,
        { replacements: { id: o.id }, type: QueryTypes.UPDATE });
    const rel = j.signedURL || j.signedUrl;
    const url = rel.startsWith("http") ? rel : `${SB_SISTEMAS_URL}/storage/v1${rel}`;
    return url; // sem download=: PDF e imagem abrem direto no navegador (Word/Excel são baixados)
}

module.exports = { gerarUploadUrl, validarParaAnexar, anexarENotificarRD, reenviarNotasPendentes, resolverLink, MAX_ARQUIVOS, MAX_BYTES };
