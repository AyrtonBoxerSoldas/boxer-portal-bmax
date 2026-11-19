// Desativa (banimento, reversível) as contas ANTIGAS do Motor (Supabase Auth) dos e-mails substituídos. Não apaga.
const P = "C:/Users/andre.coelho.BXSD/BOXER/Dados - Documentos/Comercial/Geral/Estrategia/2026/Projeto BMax/boxer-portal-bmax";
process.chdir(P); require(P + "/node_modules/dotenv").config({ quiet: true });
const U = "https://bmepxcnrsofofoswubuu.supabase.co", K = process.env.SUPABASE_SERVICE_KEY_SISTEMAS;
const H = { apikey: K, Authorization: "Bearer " + K, "Content-Type": "application/json" };
const ALVOS = ["compras1@lojastamoyo.com.br", "paulo.neto@dominik.com.br"], MANTER = ["compras6@tamoyo.com.br", "enoque.almeida@dominik.com.br"];
(async () => {
  let todos = []; for (let p = 1; p < 20; p++) { const r = await (await fetch(`${U}/auth/v1/admin/users?page=${p}&per_page=1000`, { headers: H })).json(); todos = todos.concat(r.users || []); if (!(r.users || []).length || r.users.length < 1000) break; }
  for (const mail of ALVOS) {
    const u = todos.find(x => (x.email || "").toLowerCase() === mail); if (!u) { console.log("não existe no Motor:", mail); continue; }
    const r = await fetch(`${U}/auth/v1/admin/users/${u.id}`, { method: "PUT", headers: H, body: JSON.stringify({ ban_duration: "876000h" }) }); const j = await r.json().catch(() => ({}));
    console.log("banida:", mail, "| HTTP", r.status, "| banned_until:", String(j.banned_until || "").slice(0, 10));
  }
  for (const mail of MANTER) { const u = todos.find(x => (x.email || "").toLowerCase() === mail); console.log("conta nova ativa:", mail, !!u && !u.banned_until); }
  process.exit(0);
})().catch(e => { console.error("ERRO", e.message); process.exit(1); });
