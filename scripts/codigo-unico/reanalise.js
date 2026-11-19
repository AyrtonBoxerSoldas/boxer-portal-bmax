// SOMENTE LEITURA: sinais de uso de cada loja ATIVA (login, RD, cashback) -> JSON para a planilha de reanálise
const P = "C:/Users/andre.coelho.BXSD/BOXER/Dados - Documentos/Comercial/Geral/Estrategia/2026/Projeto BMax/boxer-portal-bmax";
process.chdir(P); require(P + "/node_modules/dotenv").config({ quiet: true });
const fs = require("fs");
const db = require(P + "/src/database"); const { QueryTypes } = require(P + "/node_modules/sequelize");
const { sbSistemasService } = require(P + "/src/config/supabaseSistemas"); const l = require(P + "/src/services/rd.leads.service"); const C = require(P + "/src/config/constants");
const q = (s) => db.sequelize.query(s, { type: QueryTypes.SELECT });
const nz = s => String(s || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toLowerCase().replace(/\s+/g, " ");
const dias = d => d ? Math.floor((Date.now() - new Date(d).getTime()) / 86400000) : null;
(async () => {
  const lojas = await sbSistemasService("/comercial_revendas_bmax?ativo=eq.true&select=id,nome,nome_rd,classe,rep,grupo,grupo_id,cidade,estado,cnpj,user_id,email,criado_em,editado_em,editado_por&order=nome");
  const apel = await sbSistemasService("/comercial_bmax_apelidos?select=entidade,entidade_id,apelido_norm&limit=5000");
  const mapa = new Map(); apel.forEach(a => mapa.set(a.apelido_norm, a)); lojas.forEach(x => { for (const n of [x.nome_rd, x.nome]) if (n && !mapa.has(nz(n))) mapa.set(nz(n), { entidade: "revenda", entidade_id: x.id }); });
  const logins = await q(`SELECT u.id uid, u.username, u."createdAt"::text criado, r.name FROM "Users" u JOIN "Revendas" r ON r.user_id=u.id`); const lg = new Map(logins.map(x => [x.uid, x]));
  const ult = await q(`SELECT lower(username) un, max("createdAt")::text ultimo, count(*) filter (where "createdAt" > now() - interval '90 days') n90, count(*) n FROM "AuditLogs" WHERE action='LOGIN_SUCCESS' AND username IS NOT NULL GROUP BY lower(username)`); const um = new Map(ult.map(x => [x.un, x]));
  const deals = await l.fetchAllDealsAllPipelines(); const por = new Map();
  for (const d of deals) { const v = nz(l.getCustomField(d, "REVENDA/LOJA")); const a = mapa.get(v); if (!a) continue; const k = a.entidade + ":" + a.entidade_id; const o = por.get(k) || { total: 0, abertos: 0, vendidos: 0, perdidos: 0, c90: 0, ultCriacao: null, vendasValor: 0, ultVenda: null }; o.total++; if (d.win === true) { o.vendidos++; o.vendasValor += Number(d.amount_total || 0); if (!o.ultVenda || d.closed_at > o.ultVenda) o.ultVenda = d.closed_at; } else if (d.win === false) o.perdidos++; else o.abertos++; if (dias(d.created_at) <= 90) o.c90++; if (!o.ultCriacao || d.created_at > o.ultCriacao) o.ultCriacao = d.created_at; por.set(k, o); }
  const sal = await q(`SELECT revenda_id, grupo_id, sum(saldo)::float s FROM bmax_saldo WHERE tipo_agente='revenda' GROUP BY 1,2`);
  const cred = await q(`SELECT revenda_id, grupo_id, sum(valor) filter (where tipo='credito')::float c, max(criado_em)::text ult FROM bmax_transacoes WHERE tipo_agente='revenda' GROUP BY 1,2`);
  const out = lojas.map(x => {
    const l1 = lg.get(x.user_id) || {}; const u = um.get(String(l1.username || "").toLowerCase()) || {};
    const rd = por.get("revenda:" + x.id) || por.get("grupo:" + x.grupo_id) || {};
    const grp = !!(x.grupo_id && por.get("grupo:" + x.grupo_id));
    const s = sal.find(r => r.revenda_id === x.id || (r.grupo_id && r.grupo_id === x.grupo_id)) || {}; const c = cred.find(r => r.revenda_id === x.id || (r.grupo_id && r.grupo_id === x.grupo_id)) || {};
    return { id: x.id, nome: x.nome_rd || x.nome, nome_cadastro: x.nome, classe: x.classe, rep: x.rep, grupo: x.grupo || "", cidade: x.cidade, uf: x.estado, cnpj: String(x.cnpj || "").replace(/\D/g, ""), cadastro_criado: (x.criado_em || "").slice(0, 10), cadastro_editado: (x.editado_em || "").slice(0, 10), login: l1.username || "", login_criado: (l1.criado || "").slice(0, 10), ultimo_acesso: (u.ultimo || "").slice(0, 10), dias_sem_acesso: u.ultimo ? dias(u.ultimo) : null, acessos_90d: Number(u.n90 || 0), acessos_total: Number(u.n || 0), cards_total: rd.total || 0, cards_abertos: rd.abertos || 0, cards_vendidos: rd.vendidos || 0, cards_perdidos: rd.perdidos || 0, cards_90d: rd.c90 || 0, ultimo_card: (rd.ultCriacao || "").slice(0, 10), venda_rd_valor: Math.round(rd.vendasValor || 0), ultima_venda_rd: (rd.ultVenda || "").slice(0, 10), cards_do_grupo: grp, saldo: Number((s.s || 0).toFixed(2)), creditado: Number((c.c || 0).toFixed(2)), ultimo_credito: (c.ult || "").slice(0, 10) };
  });
  fs.writeFileSync("C:/tmp/bmax/reanalise.json", JSON.stringify(out, null, 1));
  console.log("lojas ativas:", out.length, "| com login:", out.filter(o => o.login).length, "| com card nos últimos 90d:", out.filter(o => o.cards_90d).length, "| acesso nos últimos 60d:", out.filter(o => o.dias_sem_acesso != null && o.dias_sem_acesso <= 60).length);
  const m = out.find(o => /metatr/i.test(o.nome)); console.log("METATRÔNICA:", JSON.stringify(m));
  const dm = deals.filter(d => /metatr/i.test(String(l.getCustomField(d, "REVENDA/LOJA") || ""))).map(d => `${(d.created_at || "").slice(0, 10)} | ${d.name} | ${C.RD_STAGES[d.deal_stage && d.deal_stage.id] || (d.deal_stage && d.deal_stage.name)} | win ${d.win} | valor ${d.amount_total} | rep ${l.getCustomField(d, "REPRESENTANTE")} | PCI ${l.getCustomField(d, "PERFIL PCI")}`); console.log("CARDS Metatrônica:\n  " + dm.join("\n  "));
  process.exit(0);
})().catch(e => { console.error("ERRO", e.stack || e.message); process.exit(1); });
