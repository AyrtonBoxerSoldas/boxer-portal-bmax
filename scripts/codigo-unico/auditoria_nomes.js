// SOMENTE LEITURA: nome único — cadastro (nome_rd||nome) x login x opções do RD x grupos x razão
const P = "C:/Users/andre.coelho.BXSD/BOXER/Dados - Documentos/Comercial/Geral/Estrategia/2026/Projeto BMax/boxer-portal-bmax";
process.chdir(P); require(P + "/node_modules/dotenv").config({ quiet: true });
const db = require(P + "/src/database"); const { QueryTypes } = require(P + "/node_modules/sequelize");
const { sbSistemasService } = require(P + "/src/config/supabaseSistemas"); const l = require(P + "/src/services/rd.leads.service");
const q = (s) => db.sequelize.query(s, { type: QueryTypes.SELECT });
const t = s => String(s || "").trim();
(async () => {
  const cad = await sbSistemasService("/comercial_revendas_bmax?select=id,nome,nome_rd,ativo,user_id,grupo&ativo=eq.true");
  const logins = await q(`SELECT r.name, r.user_id, u.username FROM "Revendas" r JOIN "Users" u ON u.id=r.user_id`); const lm = new Map(logins.map(x => [x.user_id, x]));
  const opc = new Set((await l.getOpcoesRevendaRD()).map(t)); const canon = c => t(c.nome_rd) || t(c.nome);
  const prob = { dup: [], semOpcaoRD: [], loginDifere: [], loginSemLoja: [], semLogin: 0 };
  const cont = {}; cad.forEach(c => { const k = canon(c).toLowerCase(); cont[k] = (cont[k] || 0) + 1; }); Object.entries(cont).filter(([, n]) => n > 1).forEach(([k, n]) => prob.dup.push(`${k} x${n}`));
  for (const c of cad) { if (!opc.has(canon(c))) prob.semOpcaoRD.push(canon(c)); if (c.user_id) { const lg = lm.get(c.user_id); if (!lg) prob.loginSemLoja.push(`${canon(c)} (user ${c.user_id} inexistente)`); else if (t(lg.name) !== canon(c) && !c.grupo) prob.loginDifere.push(`${canon(c)} <> login "${lg.name}"`); } else prob.semLogin++; }
  const cadTodos = await sbSistemasService("/comercial_revendas_bmax?select=nome,nome_rd,ativo"); const nomesCad = new Set(cadTodos.map(c => canon(c)));
  const grp = new Set((await q(`SELECT DISTINCT grupo FROM bmax_grupos`)).map(x => t(x.grupo))); const tabRd = (await q(`SELECT revenda_rd FROM bmax_grupos`)).map(x => t(x.revenda_rd));
  const optSemCad = [...opc].filter(o => !nomesCad.has(o) && !grp.has(o) && !tabRd.includes(o));
  const loginsSemLojaAtiva = logins.filter(lg => !cad.some(c => c.user_id === lg.user_id)).map(lg => `${lg.name} <${lg.username}>`);
  console.log("lojas ativas:", cad.length, "| logins:", logins.length, "| opções no RD:", opc.size);
  console.log("NOME DUPLICADO entre ativas:", prob.dup.join(" | ") || "nenhum");
  console.log("ATIVA SEM opção no RD:", prob.semOpcaoRD.join(" | ") || "nenhuma");
  console.log("LOGIN com nome diferente do cadastro (lojas sem grupo):", prob.loginDifere.join(" | ") || "nenhum");
  console.log("LOGIN que sobrou sem loja ativa:", loginsSemLojaAtiva.join(" | ") || "nenhum");
  console.log("OPÇÕES DO RD sem loja no cadastro nem em grupo (" + optSemCad.length + "):", optSemCad.join(" | "));
  process.exit(0);
})().catch(e => { console.error("ERRO", e.stack || e.message); process.exit(1); });
