// 18/11/2026 (pedido do André): ativa Tamoyo (Prata) e Casa dos Parafusos Umuarama, com o MESMO nome no RD, no login e no cadastro.
const P = "C:/Users/andre.coelho.BXSD/BOXER/Dados - Documentos/Comercial/Geral/Estrategia/2026/Projeto BMax/boxer-portal-bmax";
process.chdir(P); require(P + "/node_modules/dotenv").config({ quiet: true });
const db = require(P + "/src/database"); const { QueryTypes } = require(P + "/node_modules/sequelize");
const { sbSistemasService } = require(P + "/src/config/supabaseSistemas"); const { syncRevendasToRD, getOpcoesRevendaRD } = require(P + "/src/services/rd.leads.service");
const { geocodeCep } = require(P + "/src/services/geocode.service"); const { sincronizarGrupoDaLoja } = require(P + "/src/services/grupoLoja.service");
const q = (s, r) => db.sequelize.query(s, { replacements: r || {}, type: QueryTypes.SELECT });
const ALVOS = [
  { id: "8ea4e0be-2af1-4d09-a361-42b18026fa0d", classe: "Prata", rd: "Tamoyo Itajaí", user: 54 },
  { id: "e24e008b-b77c-426f-be6e-21c95e18097a", classe: "Prata", rd: "A Bittencourt (Casa dos Parafusos)", user: 37, cnpjLogin: true }
];
(async () => {
  const opc = await getOpcoesRevendaRD();
  const ativas = await sbSistemasService("/comercial_revendas_bmax?ativo=eq.true&select=id,nome,nome_rd");
  for (const a of ALVOS) {
    if (!opc.includes(a.rd)) throw new Error("nome não existe no picklist do RD: " + a.rd);
    if (ativas.some(r => r.id !== a.id && String(r.nome_rd || r.nome).trim().toLowerCase() === a.rd.toLowerCase())) throw new Error("nome no RD já usado por outra ativa: " + a.rd);
    const lg = (await q(`SELECT r.name, r.cnpj, r.cep, r.cidade, r.estado FROM "Revendas" r WHERE r.user_id = :u`, { u: a.user }))[0];
    if (!lg || lg.name !== a.rd) throw new Error(`login ${a.user} tem nome "${lg && lg.name}" diferente de "${a.rd}"`);
    const l = (await sbSistemasService(`/comercial_revendas_bmax?id=eq.${a.id}&select=*`))[0];
    const upd = { ativo: true, classe: a.classe, nome_rd: a.rd, editado_em: new Date().toISOString(), editado_por: "claude (pedido do André em 18/11/2026)" };
    if (a.cnpjLogin && !l.cnpj && lg.cnpj) { const d = String(lg.cnpj).replace(/\D/g, ""); upd.cnpj = d.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, "$1.$2.$3/$4-$5"); }
    if ((l.lat == null || l.lng == null)) { const cep = l.cep || lg.cep; if (cep) { const g = await geocodeCep(cep, { cidade: l.cidade, estado: l.estado }); if (g && g.lat != null) { upd.lat = g.lat; upd.lng = g.lng; if (!l.cep) upd.cep = cep; } } }
    await sbSistemasService(`/comercial_revendas_bmax?id=eq.${a.id}`, "PATCH", upd);
    await sincronizarGrupoDaLoja(a.id);
    await sbSistemasService("/comercial_bmax_apelidos?on_conflict=origem,apelido_norm", "POST", [{ entidade: "revenda", entidade_id: a.id, origem: "rd", apelido: a.rd, apelido_norm: a.rd.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase() }], { Prefer: "resolution=merge-duplicates,return=minimal" });
    await db.sequelize.query(`UPDATE "Revendas" SET revenda_id = :r WHERE user_id = :u`, { replacements: { r: a.id, u: a.user }, type: QueryTypes.UPDATE });
    const c = (await sbSistemasService(`/comercial_revendas_bmax?id=eq.${a.id}&select=nome,nome_rd,classe,ativo,cnpj,cep,lat,lng,user_id,rep`))[0];
    console.log("ativada:", JSON.stringify(c));
  }
  const todas = await sbSistemasService("/comercial_revendas_bmax?ativo=eq.true&select=nome,nome_rd");
  console.log("sync RD:", JSON.stringify(await syncRevendasToRD(todas.map(r => (r.nome_rd && r.nome_rd.trim()) || r.nome))).slice(0, 200));
  console.log("ativas agora:", todas.length);
  process.exit(0);
})().catch(e => { console.error("ERRO", e.message); process.exit(1); });
