// Correções com base no cruzamento cadastro x ZEN (19/11/2026): Ipanema (CNPJ), Cascavel Padre Anchieta (CEP), Ultra Maquinas (CNPJ certo + 2 unidades SP, grupo Ultra Maquinas)
const P = "C:/Users/andre.coelho.BXSD/BOXER/Dados - Documentos/Comercial/Geral/Estrategia/2026/Projeto BMax/boxer-portal-bmax";
process.chdir(P); require(P + "/node_modules/dotenv").config({ quiet: true });
const fs = require("fs"); const db = require(P + "/src/database"); const { QueryTypes } = require(P + "/node_modules/sequelize");
const { sbSistemasService } = require(P + "/src/config/supabaseSistemas"); const l = require(P + "/src/services/rd.leads.service");
const { geocodeCep } = require(P + "/src/services/geocode.service"); const { sincronizarGrupoDaLoja } = require(P + "/src/services/grupoLoja.service");
const q = (s, r) => db.sequelize.query(s, { replacements: r || {}, type: QueryTypes.SELECT });
const ED = "claude (pedido do André em 19/11/2026 — cruzamento ZEN)";
const geo = async (cep, cidade, estado) => { try { const g = await geocodeCep(cep, { cidade, estado }); return g && g.lat != null ? { lat: g.lat, lng: g.lng } : {}; } catch (e) { return {}; } };
const patch = (id, b) => sbSistemasService(`/comercial_revendas_bmax?id=eq.${id}`, "PATCH", { ...b, editado_em: new Date().toISOString(), editado_por: ED });
(async () => {
  const tudo = await sbSistemasService("/comercial_revendas_bmax?select=id,nome,nome_rd,cnpj,cep,ativo,user_id,email,classe,rep,grupo");
  fs.writeFileSync("C:/Users/andre.coelho.BXSD/BOXER/Dados - Documentos/Comercial/Geral/Estrategia/2026/Projeto BMax/Documentação/Backups_Banco/cadastro_ANTES_correcoes_zen_19-11-2026.json", JSON.stringify(tudo));
  const dig = s => String(s || "").replace(/\D/g, "");
  const usado = c => tudo.find(x => dig(x.cnpj) === dig(c));
  // 1) Ipanema Soldas (LT): sem CNPJ; ZEN (mesma cidade e mesmo vendedor) = 31.283.413/0001-54
  const ip = tudo.find(x => x.nome_rd === "Ipanema Soldas (LT)"); if (usado("31283413000154")) throw new Error("CNPJ da Ipanema já em uso");
  await patch(ip.id, { cnpj: "31.283.413/0001-54", cep: ip.cep || "18070671", ...(await geo(ip.cep || "18070671", "Sorocaba", "SP")) }); console.log("Ipanema: CNPJ 31.283.413/0001-54");
  // 2) Cascavel Soldas Padre Anchieta (CNPJ 0001-18): CEP do cadastro estava igual ao da outra unidade
  const ca = tudo.find(x => x.nome_rd === "Cascavel Soldas Padre Anchieta"); await patch(ca.id, { cep: "85813740", ...(await geo("85813740", "Cascavel", "PR")) }); console.log("Cascavel Padre Anchieta: CEP 85813-740");
  // 3) Ultra Maquinas: o CNPJ do cadastro (01.876.195/0001-09) não é da empresa; a unidade de Campinas é 00.314.550/0003-47 (mesmo CEP)
  const ul = tudo.find(x => x.nome_rd === "Ultra Maquinas"); const outras = [["Ultra Maquinas São Paulo 0002", "00.314.550/0002-66", "03523015"], ["Ultra Maquinas São Paulo 0006", "00.314.550/0006-90", "03444000"]];
  for (const [, c] of [["", "00.314.550/0003-47"], ...outras]) if (usado(c)) throw new Error("CNPJ já cadastrado: " + c);
  const opc = await l.getOpcoesRevendaRD(); for (const [n] of outras) if (tudo.some(x => (x.nome_rd || x.nome) === n)) throw new Error("nome já existe " + n);
  await patch(ul.id, { cnpj: "00.314.550/0003-47", grupo: "Ultra Maquinas" }); const ids = [ul.id];
  for (const [nome, cnpj, cep] of outras) {
    const r = await sbSistemasService("/comercial_revendas_bmax", "POST", { nome, nome_rd: nome, cidade: "São Paulo", estado: "SP", cnpj, cep, classe: ul.classe || "Ouro", rep: ul.rep || "Victor VLM", grupo: "Ultra Maquinas", ativo: true, email: ul.email || null, ...(await geo(cep, "São Paulo", "SP")), editado_por: ED });
    ids.push((Array.isArray(r) ? r[0] : r).id); console.log("criada:", nome, cnpj);
  }
  for (const id of ids) await sincronizarGrupoDaLoja(id);
  const ativas = await sbSistemasService("/comercial_revendas_bmax?ativo=eq.true&select=nome,nome_rd");
  console.log("sync RD:", JSON.stringify(await l.syncRevendasToRD(ativas.map(r => (r.nome_rd && r.nome_rd.trim()) || r.nome))).slice(0, 150));
  console.log("grupo Ultra:", JSON.stringify(await sbSistemasService("/comercial_revendas_bmax?grupo=eq.Ultra Maquinas&select=nome_rd,cnpj,cep,cidade,classe,rep,user_id")));
  console.log("login Ultra:", JSON.stringify(await q(`SELECT name, grupo FROM "Revendas" WHERE user_id=107`)), "| bmax_grupos:", JSON.stringify((await q(`SELECT revenda_rd FROM bmax_grupos WHERE grupo='Ultra Maquinas' ORDER BY 1`)).map(r => r.revenda_rd)));
  process.exit(0);
})().catch(e => { console.error("ERRO", e.message); process.exit(1); });
