// 19/11/2026 (pedido do André): (A) cadastra as 2 unidades Bittencourt do ZEN; (B) card "Ipanema Soldas" -> "Ipanema Soldas (LT)"; (C) unifica os nomes do grupo Alphabras em TODO lugar.
const P = "C:/Users/andre.coelho.BXSD/BOXER/Dados - Documentos/Comercial/Geral/Estrategia/2026/Projeto BMax/boxer-portal-bmax";
process.chdir(P); require(P + "/node_modules/dotenv").config({ quiet: true });
const fs = require("fs"); const db = require(P + "/src/database"); const { QueryTypes } = require(P + "/node_modules/sequelize");
const { sbSistemasService } = require(P + "/src/config/supabaseSistemas"); const l = require(P + "/src/services/rd.leads.service");
const { geocodeCep } = require(P + "/src/services/geocode.service"); const { sincronizarGrupoDaLoja } = require(P + "/src/services/grupoLoja.service");
const q = (s, r) => db.sequelize.query(s, { replacements: r || {}, type: QueryTypes.SELECT });
const x = (s, r, t) => db.sequelize.query(s, { replacements: r || {}, type: t || QueryTypes.UPDATE });
const nz = s => String(s || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toLowerCase().replace(/\s+/g, " ");
const ED = "claude (pedido do André em 19/11/2026)"; const T = process.env.RD_CRM_TOKEN, B = "https://crm.rdstation.com/api/v1";
const geo = async (cep, cidade, estado) => { try { const g = await geocodeCep(cep, { cidade, estado }); return g && g.lat != null ? { lat: g.lat, lng: g.lng } : {}; } catch (e) { return {}; } };
const patch = (id, b) => sbSistemasService(`/comercial_revendas_bmax?id=eq.${id}`, "PATCH", { ...b, editado_em: new Date().toISOString(), editado_por: ED });
const addApelidos = list => sbSistemasService("/comercial_bmax_apelidos?on_conflict=origem,apelido_norm", "POST", list.map(([ent, id, origem, ap]) => ({ entidade: ent, entidade_id: id, origem, apelido: ap, apelido_norm: nz(ap) })), { Prefer: "resolution=merge-duplicates,return=minimal" });
async function renomearCards(valoresAntigos, novo) {
  const arr = await (await fetch(`${B}/custom_fields?token=${T}`)).json(); const cfs = arr.custom_fields || arr; const idDe = lb => { const f = cfs.find(z => z.label && z.label.trim() === lb && (z.for === "deal" || !z.for)); return f._id || f.id; };
  const deals = await l.fetchAllDealsAllPipelines(); const alvo = deals.filter(d => valoresAntigos.includes(String(l.getCustomField(d, "REVENDA/LOJA") || ""))); let ok = 0, pend = [];
  for (const d of alvo) {
    const id = d.id || d._id; const put = async campos => { const r = await fetch(`${B}/deals/${id}?token=${T}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ deal: { deal_custom_fields: campos } }) }); return { s: r.status, j: await r.json().catch(() => ({})) }; };
    let r = await put([{ custom_field_id: idDe("REVENDA/LOJA"), value: novo }]);
    if (r.s === 422) { const req = (r.j.errors && r.j.errors.deal_required_custom_fields) || r.j.deal_required_custom_fields || []; const falt = req.flatMap(z => Object.values(z).map(v => v.custom_field.label)); const dd = await (await fetch(`${B}/deals/${id}?token=${T}`)).json();
      if (dd.win === true || dd.win === false) { const extra = []; if (falt.includes("CLASSE DE PREÇO")) extra.push({ custom_field_id: idDe("CLASSE DE PREÇO"), value: "Sem Classe" }); if (falt.includes("SEGMENTO DE PRODUTO")) extra.push({ custom_field_id: idDe("SEGMENTO DE PRODUTO"), value: "Não se aplica" }); if (extra.length === falt.length) r = await put([{ custom_field_id: idDe("REVENDA/LOJA"), value: novo }, ...extra]); } }
    if (r.s === 200) ok++; else pend.push(id + ":" + r.s);
  }
  return { total: alvo.length, ok, pend };
}
(async () => {
  const tudo = await sbSistemasService("/comercial_revendas_bmax?select=*"); fs.writeFileSync("C:/Users/andre.coelho.BXSD/BOXER/Dados - Documentos/Comercial/Geral/Estrategia/2026/Projeto BMax/Documentação/Backups_Banco/cadastro_ANTES_unificacao_19-11-2026.json", JSON.stringify(tudo));
  const dig = s => String(s || "").replace(/\D/g, ""); const por = n => tudo.find(z => (z.nome_rd || z.nome) === n);
  // ===== A) Bittencourt =====
  const base = por("A Bittencourt (Casa dos Parafusos)"); const novas = [["A Bittencourt Umuarama 0007", "75.104.406/0007-09", "87506370", "Umuarama", "PR"], ["A Bittencourt Nova Andradina 0008", "75.104.406/0008-90", "79756000", "Nova Andradina", "MS"]]; const idsB = [];
  for (const [nome, cnpj, cep, cid, uf] of novas) {
    if (tudo.some(z => dig(z.cnpj) === dig(cnpj) || (z.nome_rd || z.nome) === nome)) { console.log("A) já existe:", nome); continue; }
    const r = await sbSistemasService("/comercial_revendas_bmax", "POST", { nome, nome_rd: nome, cidade: cid, estado: uf, cnpj, cep, classe: "Prata", rep: "Hugo Carpanese", grupo: "Bittencourt", ativo: true, email: base.email || "compras@casadosparafusos.com.br", ...(await geo(cep, cid, uf)), editado_por: ED });
    idsB.push((Array.isArray(r) ? r[0] : r).id); console.log("A) criada:", nome, cnpj);
  }
  for (const id of idsB) await sincronizarGrupoDaLoja(id);
  // ===== B) Ipanema =====
  const ipB = await renomearCards(["Ipanema Soldas"], "Ipanema Soldas (LT)"); console.log("B) cards 'Ipanema Soldas' ->", JSON.stringify(ipB));
  // ===== C) Alphabras =====
  const A = por("alphabras"), Bq = por("42546 Alphabras Poços de Caldas 2"), Cq = por("31490 Alphabras SJBV ") || tudo.find(z => (z.nome_rd || "").trim() === "31490 Alphabras SJBV");
  if (!A || !Bq || !Cq) throw new Error("lojas Alphabras não encontradas");
  const NA = "Alphabras Poços de Caldas 1", NB = "Alphabras Poços de Caldas 2", NC = "Alphabras SJBV";
  const conflito = await q(`SELECT 1 FROM bmax_saldo WHERE revenda=:n AND tipo_agente='revenda'`, { n: NA }); if (conflito.length) throw new Error("já existe carteira com o nome novo");
  const antes = (await q(`SELECT sum(saldo)::text s, count(*) n FROM bmax_saldo`))[0]; const emailResp = (await q(`SELECT email_responsavel e FROM bmax_grupos WHERE grupo='Alphabras' AND email_responsavel IS NOT NULL LIMIT 1`))[0]; const grpAntes = await q(`SELECT * FROM bmax_grupos WHERE grupo='Alphabras'`);
  fs.writeFileSync("C:/Users/andre.coelho.BXSD/BOXER/Dados - Documentos/Comercial/Geral/Estrategia/2026/Projeto BMax/Documentação/Backups_Banco/alphabras_ANTES_unificacao_19-11-2026.json", JSON.stringify({ bmax_grupos: grpAntes, saldo: await q(`SELECT * FROM bmax_saldo WHERE revenda ILIKE '%alphabras%'`) }, null, 1));
  await patch(A.id, { nome_rd: NA }); await patch(Bq.id, { nome_rd: NB }); await patch(Cq.id, { nome_rd: NC });
  const ativas = await sbSistemasService("/comercial_revendas_bmax?ativo=eq.true&select=nome,nome_rd"); console.log("C) sync RD:", JSON.stringify(await l.syncRevendasToRD(ativas.map(r => (r.nome_rd && r.nome_rd.trim()) || r.nome))).slice(0, 120));
  // cards no RD (o robô de comissões ignora o NOME ao comparar o crédito do card, então a ordem não gera crédito duplicado)
  const c1 = await renomearCards(["42863 Alphabras Poços de Caldas 1", "alphabras"], NA); const c2 = await renomearCards(["31490 Alphabras SJBV ", "31490 Alphabras SJBV"], NC);
  console.log("C) cards ->", NA, JSON.stringify(c1), "|", NC, JSON.stringify(c2));
  if (c1.pend.length || c2.pend.length) throw new Error("cards pendentes, paro antes de mexer no razão: " + JSON.stringify([c1.pend, c2.pend]));
  // razão (cashback/saques): mesmo nome novo, carteira e histórico preservados (as linhas já têm o código da loja)
  const velho = "42863 Alphabras Poços de Caldas 1";
  for (const t of ["bmax_saldo", "bmax_transacoes", "bmax_saques"]) await x(`UPDATE ${t} SET revenda=:n WHERE revenda=:v`, { n: NA, v: velho });
  // grupos: o grupo Alphabras passa a ter exatamente os 3 nomes únicos (insere os novos, depois apaga os antigos)
  for (const n of [NA, NB, NC]) await x(`INSERT INTO bmax_grupos (revenda_rd, grupo, email_responsavel) VALUES (:n, 'Alphabras', :e) ON CONFLICT (revenda_rd) DO UPDATE SET grupo='Alphabras'`, { n, e: emailResp ? emailResp.e : null }, QueryTypes.INSERT);
  await x(`DELETE FROM bmax_grupos WHERE grupo='Alphabras' AND revenda_rd NOT IN (:n)`, { n: [NA, NB, NC] }, QueryTypes.DELETE);
  await addApelidos([["revenda", A.id, "rd", NA], ["revenda", A.id, "cadastro", NA], ["revenda", Bq.id, "rd", NB], ["revenda", Bq.id, "cadastro", NB], ["revenda", Cq.id, "rd", NC], ["revenda", Cq.id, "cadastro", NC]]);
  const dep = (await q(`SELECT sum(saldo)::text s, count(*) n FROM bmax_saldo`))[0];
  console.log("C) soma dos saldos:", antes.s, "->", dep.s, "| carteiras:", antes.n, "->", dep.n, "| carteira nova:", JSON.stringify(await q(`SELECT revenda, saldo::text FROM bmax_saldo WHERE revenda=:n`, { n: NA })));
  console.log("C) bmax_grupos Alphabras:", JSON.stringify((await q(`SELECT revenda_rd FROM bmax_grupos WHERE grupo='Alphabras' ORDER BY 1`)).map(r => r.revenda_rd)));
  console.log("C) lojas:", JSON.stringify((await sbSistemasService("/comercial_revendas_bmax?grupo=eq.Alphabras&select=nome_rd,cidade,user_id,ativo")).map(r => r.nome_rd)));
  process.exit(0);
})().catch(e => { console.error("ERRO", e.stack || e.message); process.exit(1); });
