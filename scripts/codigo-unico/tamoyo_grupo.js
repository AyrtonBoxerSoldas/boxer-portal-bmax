// 18/11/2026 (pedido do André): Tamoyo = grupo de 4 filiais com UM login (compras6@tamoyo.com.br), seguindo o padrão de grupo.
const P = "C:/Users/andre.coelho.BXSD/BOXER/Dados - Documentos/Comercial/Geral/Estrategia/2026/Projeto BMax/boxer-portal-bmax";
process.chdir(P); require(P + "/node_modules/dotenv").config({ quiet: true });
const db = require(P + "/src/database"); const { QueryTypes } = require(P + "/node_modules/sequelize");
const { sbSistemasService } = require(P + "/src/config/supabaseSistemas"); const { syncRevendasToRD, getOpcoesRevendaRD } = require(P + "/src/services/rd.leads.service");
const { geocodeCep } = require(P + "/src/services/geocode.service"); const { sincronizarGrupoDaLoja } = require(P + "/src/services/grupoLoja.service");
const q = (s, r) => db.sequelize.query(s, { replacements: r || {}, type: QueryTypes.SELECT });
const EMAIL = "compras6@tamoyo.com.br", ITAJAI = "8ea4e0be-2af1-4d09-a361-42b18026fa0d";
const NOVAS = [
  { nome: "Tamoyo Balneário Camboriú 1", cidade: "Balneário Camboriú" },
  { nome: "Tamoyo Balneário Camboriú 2", cidade: "Balneário Camboriú" },
  { nome: "Tamoyo Porto Belo", cidade: "Porto Belo" }
];
const norm = s => String(s || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toLowerCase().replace(/\s+/g, " ");
(async () => {
  const opc = await getOpcoesRevendaRD(); const ativas = await sbSistemasService("/comercial_revendas_bmax?select=id,nome,nome_rd,ativo");
  for (const n of NOVAS) { if (!opc.includes(n.nome)) throw new Error("não existe no RD: " + n.nome); if (ativas.some(r => String(r.nome_rd || r.nome).trim().toLowerCase() === n.nome.toLowerCase())) throw new Error("já existe loja: " + n.nome); }
  if ((await q(`SELECT 1 FROM "Users" WHERE lower(username)=:e`, { e: EMAIL })).length) throw new Error("e-mail já é login de outro usuário");
  const ids = [ITAJAI];
  // 3 filiais novas, com o MESMO nome do RD, classe Prata, mesmo representante, grupo Tamoyo
  for (const n of NOVAS) {
    let lat = null, lng = null; try { const g = await geocodeCep(null, { cidade: n.cidade, estado: "SC" }); if (g && g.lat != null) { lat = g.lat; lng = g.lng; } } catch (e) {}
    const r = await sbSistemasService("/comercial_revendas_bmax", "POST", { nome: n.nome, nome_rd: n.nome, cidade: n.cidade, estado: "SC", classe: "Prata", rep: "Fernando Marques", grupo: "Tamoyo", ativo: true, email: EMAIL, lat, lng, editado_por: "claude (pedido do André em 18/11/2026)" });
    const id = (Array.isArray(r) ? r[0] : r).id; ids.push(id); console.log("criada:", n.nome, "| coords:", lat != null ? "sim" : "NÃO");
  }
  await sbSistemasService(`/comercial_revendas_bmax?id=eq.${ITAJAI}`, "PATCH", { grupo: "Tamoyo", email: EMAIL });
  for (const id of ids) await sincronizarGrupoDaLoja(id);
  const g = (await sbSistemasService("/comercial_bmax_grupos?nome=eq.Tamoyo&select=id"))[0];
  const ap = [{ entidade: "grupo", entidade_id: g.id, origem: "rd", apelido: "Tamoyo" }, ...NOVAS.map((n, i) => ({ entidade: "revenda", entidade_id: ids[i + 1], origem: "rd", apelido: n.nome }))].map(a => ({ ...a, apelido_norm: norm(a.apelido) }));
  await sbSistemasService("/comercial_bmax_apelidos?on_conflict=origem,apelido_norm", "POST", ap, { Prefer: "resolution=merge-duplicates,return=minimal" });
  // login único do grupo: mantém a senha atual; só troca o e-mail de acesso
  await db.sequelize.query(`UPDATE "Users" SET username = :e, "updatedAt" = now() WHERE id = 54`, { replacements: { e: EMAIL }, type: QueryTypes.UPDATE });
  await db.sequelize.query(`UPDATE "Revendas" SET email = :e, grupo = 'Tamoyo', grupo_id = :g WHERE user_id = 54`, { replacements: { e: EMAIL, g: g.id }, type: QueryTypes.UPDATE });
  const todas = await sbSistemasService("/comercial_revendas_bmax?ativo=eq.true&select=nome,nome_rd");
  console.log("sync RD:", JSON.stringify(await syncRevendasToRD(todas.map(r => (r.nome_rd && r.nome_rd.trim()) || r.nome))).slice(0, 160));
  console.log("login:", JSON.stringify(await q(`SELECT u.username, r.name, r.grupo FROM "Users" u JOIN "Revendas" r ON r.user_id=u.id WHERE u.id=54`)));
  console.log("bmax_grupos Tamoyo:", JSON.stringify((await q(`SELECT revenda_rd FROM bmax_grupos WHERE grupo='Tamoyo' ORDER BY 1`)).map(x => x.revenda_rd)));
  console.log("lojas do grupo:", JSON.stringify(await sbSistemasService("/comercial_revendas_bmax?grupo=eq.Tamoyo&select=nome_rd,classe,ativo,cidade,cnpj,user_id,lat")));
  process.exit(0);
})().catch(e => { console.error("ERRO", e.message); process.exit(1); });
