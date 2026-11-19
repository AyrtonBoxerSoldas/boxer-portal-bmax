// Tamoyo = exatamente as 4 unidades reais informadas pelo André: Matriz Itajaí (0001-70), CD Itajaí (0006-84), Balneário Camboriú (0003-31), Porto Belo (0007-65)
const P = "C:/Users/andre.coelho.BXSD/BOXER/Dados - Documentos/Comercial/Geral/Estrategia/2026/Projeto BMax/boxer-portal-bmax";
process.chdir(P); require(P + "/node_modules/dotenv").config({ quiet: true });
const fs = require("fs");
const db = require(P + "/src/database"); const { QueryTypes } = require(P + "/node_modules/sequelize");
const { sbSistemasService } = require(P + "/src/config/supabaseSistemas"); const l = require(P + "/src/services/rd.leads.service");
const { geocodeCep } = require(P + "/src/services/geocode.service"); const { sincronizarGrupoDaLoja } = require(P + "/src/services/grupoLoja.service");
const q = (s, r) => db.sequelize.query(s, { replacements: r || {}, type: QueryTypes.SELECT });
const x = (s, r) => db.sequelize.query(s, { replacements: r || {}, type: QueryTypes.DELETE });
const norm = s => String(s || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toLowerCase().replace(/\s+/g, " ");
const ED = "claude (pedido do André em 19/11/2026)";
const geo = async (cep, cidade, estado) => { try { const g = await geocodeCep(cep, { cidade, estado }); return g && g.lat != null ? { lat: g.lat, lng: g.lng } : {}; } catch (e) { return {}; } };
(async () => {
  const lojas = await sbSistemasService("/comercial_revendas_bmax?grupo=eq.Tamoyo&select=*");
  const por = n => lojas.find(r => r.nome_rd === n);
  const itajai = por("Tamoyo Itajaí"), bc1 = por("Tamoyo Balneário Camboriú 1"), bc2 = por("Tamoyo Balneário Camboriú 2"), pb = por("Tamoyo Porto Belo");
  if (!itajai || !bc1 || !bc2 || !pb) throw new Error("estado inesperado do grupo Tamoyo");
  // garantias: BC 1 e BC 2 (criadas ontem) sem cards e sem razão
  const deals = await l.fetchAllDealsAllPipelines(); const cards = deals.filter(d => /tamoyo balne/i.test(String(l.getCustomField(d, "REVENDA/LOJA") || ""))).length;
  const mov = (await q(`SELECT (SELECT count(*) FROM bmax_transacoes WHERE revenda ILIKE 'tamoyo%') t, (SELECT count(*) FROM bmax_saldo WHERE revenda ILIKE 'tamoyo%') s, (SELECT count(*) FROM bmax_saques WHERE revenda ILIKE 'tamoyo%') q`))[0];
  if (cards || Number(mov.t) || Number(mov.s) || Number(mov.q)) throw new Error(`BC tem movimento: cards ${cards} ${JSON.stringify(mov)}`);
  const apel = await sbSistemasService("/comercial_bmax_apelidos?apelido_norm=ilike.*tamoyo*&select=*");
  const tab = await q(`SELECT * FROM bmax_grupos WHERE grupo='Tamoyo'`);
  fs.writeFileSync("C:/Users/andre.coelho.BXSD/BOXER/Dados - Documentos/Comercial/Geral/Estrategia/2026/Projeto BMax/Documentação/Backups_Banco/tamoyo_ANTES_19-11-2026.json", JSON.stringify({ lojas, apelidos: apel, bmax_grupos: tab }, null, 1));
  // 1) o registro "Tamoyo Itajaí" passa a ser a MATRIZ (CEP dele já era o da matriz): CNPJ 0001-70
  await sbSistemasService(`/comercial_revendas_bmax?id=eq.${itajai.id}`, "PATCH", { cnpj: "76.842.285/0001-70", cep: "88304400", ...(await geo("88304400", "Itajaí", "SC")), editado_em: new Date().toISOString(), editado_por: ED });
  // 2) CD Itajaí: nova loja (CNPJ 0006-84, CEP 88308-620)
  const cdNome = "Tamoyo Itajaí CD";
  const cd = await sbSistemasService("/comercial_revendas_bmax", "POST", { nome: cdNome, nome_rd: cdNome, cidade: "Itajaí", estado: "SC", cnpj: "76.842.285/0006-84", cep: "88308620", classe: "Prata", rep: "Fernando Marques", grupo: "Tamoyo", ativo: true, email: itajai.email || "compras6@tamoyo.com.br", ...(await geo("88308620", "Itajaí", "SC")), editado_por: ED });
  const cdId = (Array.isArray(cd) ? cd[0] : cd).id;
  // 3) Balneário Camboriú é UMA unidade: "BC 1" vira "Tamoyo Balneário Camboriú"; "BC 2" (que eu tinha criado sem CNPJ) é removida
  const bcNome = "Tamoyo Balneário Camboriú";
  await sbSistemasService(`/comercial_revendas_bmax?id=eq.${bc1.id}`, "PATCH", { nome: bcNome, nome_rd: bcNome, editado_em: new Date().toISOString(), editado_por: ED });
  await sbSistemasService(`/comercial_bmax_apelidos?entidade_id=eq.${bc2.id}`, "DELETE");
  await sbSistemasService(`/comercial_revendas_bmax?id=eq.${bc2.id}`, "DELETE");
  await sbSistemasService(`/comercial_bmax_apelidos?entidade_id=eq.${bc1.id}&origem=in.(rd,cadastro)`, "DELETE");
  await x(`DELETE FROM bmax_grupos WHERE revenda_rd IN ('Tamoyo Balneário Camboriú 1','Tamoyo Balneário Camboriú 2')`);
  for (const id of [itajai.id, cdId, bc1.id, pb.id]) await sincronizarGrupoDaLoja(id);
  // 4) lista do RD: cria as 2 opções novas; depois a limpeza tira BC 1 / BC 2 (sem loja e sem cards)
  const ativas = await sbSistemasService("/comercial_revendas_bmax?ativo=eq.true&select=nome,nome_rd");
  console.log("sync RD:", JSON.stringify(await l.syncRevendasToRD(ativas.map(r => (r.nome_rd && r.nome_rd.trim()) || r.nome))).slice(0, 160));
  console.log("grupo Tamoyo:", JSON.stringify((await sbSistemasService("/comercial_revendas_bmax?grupo=eq.Tamoyo&select=nome_rd,cnpj,cep,classe,cidade,ativo,user_id&order=nome_rd"))));
  console.log("bmax_grupos Tamoyo:", JSON.stringify((await q(`SELECT revenda_rd FROM bmax_grupos WHERE grupo='Tamoyo' ORDER BY 1`)).map(r => r.revenda_rd)));
  process.exit(0);
})().catch(e => { console.error("ERRO", e.message); process.exit(1); });
