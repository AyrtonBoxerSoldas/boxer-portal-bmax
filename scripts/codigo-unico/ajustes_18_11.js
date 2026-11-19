// 18/11/2026 (pedido do André): logins Tamoyo/Dominik (senha padrão + acesso ao Motor), nomes alinhados ao RD, CNPJ/CEP Tamoyo, unidades Bittencourt.
const P = "C:/Users/andre.coelho.BXSD/BOXER/Dados - Documentos/Comercial/Geral/Estrategia/2026/Projeto BMax/boxer-portal-bmax";
process.chdir(P); require(P + "/node_modules/dotenv").config({ quiet: true });
const bcrypt = require(P + "/node_modules/bcryptjs");
const db = require(P + "/src/database"); const { QueryTypes } = require(P + "/node_modules/sequelize");
const { sbSistemasService } = require(P + "/src/config/supabaseSistemas"); const { syncRevendasToRD, getOpcoesRevendaRD } = require(P + "/src/services/rd.leads.service");
const { geocodeCep } = require(P + "/src/services/geocode.service"); const { sincronizarGrupoDaLoja } = require(P + "/src/services/grupoLoja.service");
const { sbSistemasAuthProvision } = require(P + "/src/controllers/users.controller");
const q = (s, r) => db.sequelize.query(s, { replacements: r || {}, type: QueryTypes.SELECT });
const x = (s, r) => db.sequelize.query(s, { replacements: r || {}, type: QueryTypes.UPDATE });
const norm = s => String(s || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toLowerCase().replace(/\s+/g, " ");
const EDITOR = "claude (pedido do André em 18/11/2026)";
const geo = async (cep, cidade, estado) => { try { const g = await geocodeCep(cep, { cidade, estado }); return g && g.lat != null ? { lat: g.lat, lng: g.lng } : {}; } catch (e) { return {}; } };
async function loginPadrao(userId, emailNovo) {
  const mail = emailNovo.trim().toLowerCase();
  const outro = await q(`SELECT id FROM "Users" WHERE lower(username)=:m AND id<>:id`, { m: mail, id: userId }); if (outro.length) throw new Error("e-mail já é login de outro usuário: " + mail);
  const senha = mail.split("@")[0]; const hash = await bcrypt.hash(senha, 10);
  await x(`UPDATE "Users" SET username=:m, password=:h, "updatedAt"=now() WHERE id=:id`, { m: mail, h: hash, id: userId });
  await x(`UPDATE "Revendas" SET email=:m WHERE user_id=:id`, { m: mail, id: userId });
  let motor = "ok"; try { await sbSistemasAuthProvision(mail, senha); } catch (e) { motor = "FALHA: " + e.message; }
  return { mail, motor };
}
(async () => {
  // 1) logins com senha no padrão do projeto + acesso ao Motor
  const dom = (await q(`SELECT u.id, u.username FROM "Users" u JOIN "Revendas" r ON r.user_id=u.id WHERE r.name='Dominik'`));
  if (dom.length !== 1) throw new Error("login Dominik: achei " + dom.length);
  console.log("Tamoyo:", JSON.stringify(await loginPadrao(54, "compras6@tamoyo.com.br")), "| Dominik (era " + dom[0].username + "):", JSON.stringify(await loginPadrao(dom[0].id, "enoque.almeida@dominik.com.br")));
  // 2) nomes alinhados ao RD: cadastro (nome_rd) = login = opção do RD
  const opc = await getOpcoesRevendaRD();
  for (const [nome, rd] of [["COAMASSA", "Coamassa"], ["TOTAL SOLDAS", "Total Soldas"], ["DEMIL", "Demil"], ["BISMARK", "Bismark"]]) {
    if (!opc.includes(rd)) throw new Error("não existe no RD: " + rd);
    const l = (await sbSistemasService(`/comercial_revendas_bmax?nome=eq.${encodeURIComponent(nome)}&ativo=eq.true&select=id`))[0]; if (!l) throw new Error("loja não achada " + nome);
    await sbSistemasService(`/comercial_revendas_bmax?id=eq.${l.id}`, "PATCH", { nome_rd: rd, editado_em: new Date().toISOString(), editado_por: EDITOR });
    await sbSistemasService("/comercial_bmax_apelidos?on_conflict=origem,apelido_norm", "POST", [{ entidade: "revenda", entidade_id: l.id, origem: "rd", apelido: rd, apelido_norm: norm(rd) }], { Prefer: "resolution=merge-duplicates,return=minimal" });
    console.log("nome_rd:", nome, "->", rd);
  }
  if (!opc.includes("VR")) throw new Error("não existe no RD: VR");
  await x(`UPDATE "Revendas" SET name='VR' WHERE name='Vr Abrasivos Ltda'`); console.log('login "Vr Abrasivos Ltda" -> "VR" (igual ao RD e ao cadastro)');
  // 3) Tamoyo: CNPJ e CEP informados pelo André
  const tam = async (nomeRd, cnpj, cep) => { const l = (await sbSistemasService(`/comercial_revendas_bmax?nome_rd=eq.${encodeURIComponent(nomeRd)}&select=id,cidade,estado`))[0]; const outro = cnpj ? await sbSistemasService(`/comercial_revendas_bmax?cnpj=eq.${encodeURIComponent(cnpj)}&select=id`) : []; if (outro.some(o => o.id !== l.id)) throw new Error("CNPJ já em outra loja: " + cnpj); const upd = { cep, editado_em: new Date().toISOString(), editado_por: EDITOR, ...(await geo(cep, l.cidade, l.estado)) }; if (cnpj) upd.cnpj = cnpj; await sbSistemasService(`/comercial_revendas_bmax?id=eq.${l.id}`, "PATCH", upd); console.log("Tamoyo", nomeRd, "->", cnpj || "(cnpj mantido)", cep); };
  await tam("Tamoyo Balneário Camboriú 1", "76.842.285/0003-31", "88330003");
  await tam("Tamoyo Porto Belo", "76.842.285/0007-65", "88210000");
  await tam("Tamoyo Itajaí", null, "88308620"); // CEP do CD, que é o CNPJ 0006-84 desta loja
  // 4) Bittencourt (Casa dos Parafusos): grupo com as 4 unidades do ZEN
  const GRUPO = "Bittencourt", EMAIL = "compras@casadosparafusos.com.br";
  const base = (await sbSistemasService(`/comercial_revendas_bmax?nome_rd=eq.${encodeURIComponent("A Bittencourt (Casa dos Parafusos)")}&select=id`))[0];
  const unidades = [
    { nome: "A Bittencourt Umuarama 0001", cnpj: "75.104.406/0001-13", cep: "87501000", cidade: "Umuarama", estado: "PR" },
    { nome: "A Bittencourt Umuarama 0003", cnpj: "75.104.406/0003-85", cep: "87507011", cidade: "Umuarama", estado: "PR" },
    { nome: "A Bittencourt Naviraí 0006", cnpj: "75.104.406/0006-28", cep: "79950000", cidade: "Naviraí", estado: "MS" }
  ];
  const ativas = await sbSistemasService("/comercial_revendas_bmax?select=id,nome,nome_rd,cnpj");
  const ids = [base.id];
  for (const u of unidades) {
    if (ativas.some(a => String(a.nome_rd || a.nome).toLowerCase() === u.nome.toLowerCase())) throw new Error("nome já existe: " + u.nome);
    if (ativas.some(a => a.cnpj === u.cnpj)) throw new Error("CNPJ já cadastrado: " + u.cnpj);
    const r = await sbSistemasService("/comercial_revendas_bmax", "POST", { nome: u.nome, nome_rd: u.nome, cidade: u.cidade, estado: u.estado, cnpj: u.cnpj, cep: u.cep, classe: "Prata", rep: "Hugo Carpanese", grupo: GRUPO, ativo: true, email: EMAIL, ...(await geo(u.cep, u.cidade, u.estado)), editado_por: EDITOR });
    ids.push((Array.isArray(r) ? r[0] : r).id); console.log("criada:", u.nome, u.cnpj);
  }
  await sbSistemasService(`/comercial_revendas_bmax?id=eq.${base.id}`, "PATCH", { grupo: GRUPO });
  for (const id of ids) await sincronizarGrupoDaLoja(id);
  const g = (await sbSistemasService(`/comercial_bmax_grupos?nome=eq.${GRUPO}&select=id`))[0];
  await sbSistemasService("/comercial_bmax_apelidos?on_conflict=origem,apelido_norm", "POST", [{ entidade: "grupo", entidade_id: g.id, origem: "rd", apelido: GRUPO, apelido_norm: norm(GRUPO) }, ...unidades.map((u, i) => ({ entidade: "revenda", entidade_id: ids[i + 1], origem: "rd", apelido: u.nome, apelido_norm: norm(u.nome) }))], { Prefer: "resolution=merge-duplicates,return=minimal" });
  await x(`UPDATE "Revendas" SET grupo_id=:g WHERE grupo=:n`, { g: g.id, n: GRUPO });
  // 5) lista do RD (cria as 3 opções novas) e conferência
  const todas = await sbSistemasService("/comercial_revendas_bmax?ativo=eq.true&select=nome,nome_rd");
  console.log("sync RD:", JSON.stringify(await syncRevendasToRD(todas.map(r => (r.nome_rd && r.nome_rd.trim()) || r.nome))).slice(0, 200));
  console.log("lojas ativas:", todas.length, "| login 37:", JSON.stringify(await q(`SELECT name, grupo FROM "Revendas" WHERE user_id=37`)), "| bmax_grupos Bittencourt:", JSON.stringify((await q(`SELECT revenda_rd FROM bmax_grupos WHERE grupo=:g`, { g: GRUPO })).map(r => r.revenda_rd)));
  process.exit(0);
})().catch(e => { console.error("ERRO", e.message); process.exit(1); });
