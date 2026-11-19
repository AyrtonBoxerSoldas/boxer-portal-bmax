// CHECAGEM DE ESTABILIDADE do código único (somente leitura). Roda antes da etapa 6. Saída: PASS/FAIL por critério; exit code 1 se algum FAIL.
// Uso: node scripts/codigo-unico/checagem_estabilidade.js [--desde 2026-11-19T22:00:00Z]
const path = require("path");
const ROOT = path.resolve(__dirname, "../..");
process.chdir(ROOT); require("dotenv").config({ quiet: true });
const db = require(ROOT + "/src/database"); const { QueryTypes } = require("sequelize");
const { sbSistemasService } = require(ROOT + "/src/config/supabaseSistemas"); const l = require(ROOT + "/src/services/rd.leads.service");
const { ESPERADOS } = require(ROOT + "/src/services/roboMonitor.service");
const q = (s, r) => db.sequelize.query(s, { replacements: r || {}, type: QueryTypes.SELECT });
const nz = s => String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").trim().toLowerCase().replace(/\s+/g, " ");
const argDesde = process.argv.indexOf("--desde"); const DESDE = argDesde > -1 ? process.argv[argDesde + 1] : "2026-11-19T22:00:00Z";
const res = []; const ok = (nome, passou, detalhe) => { res.push({ nome, passou }); console.log(`${passou ? "PASS" : "FAIL"} | ${nome}${detalhe ? " | " + detalhe : ""}`); };
(async () => {
  // 1) robôs: todos os esperados tiveram sucesso nas últimas 30h e nenhuma falha nas últimas 72h
  const r = await q(`SELECT robo, max(iniciado_em) FILTER (WHERE ok) ult_ok, count(*) FILTER (WHERE NOT ok AND iniciado_em > now() - interval '72 hours') falhas FROM bmax_robo_execucoes GROUP BY robo`); const m = new Map(r.map(x => [x.robo, x]));
  const velhos = Object.entries(ESPERADOS).filter(([robo, h]) => { const x = m.get(robo); return !x || !x.ult_ok || (Date.now() - new Date(x.ult_ok).getTime()) / 3600000 > h; }).map(([robo]) => robo);
  ok("Robôs agendados rodaram com sucesso dentro do prazo", velhos.length === 0, velhos.length ? "atrasados: " + velhos.join(", ") : `${Object.keys(ESPERADOS).length} robôs ok`);
  const ultimos = await q(`SELECT DISTINCT ON (robo) robo, ok, iniciado_em::text i FROM bmax_robo_execucoes ORDER BY robo, iniciado_em DESC`); const ultimoRuim = ultimos.filter(x => !x.ok).map(x => `${x.robo} (${x.i.slice(0, 16)})`);
  const isoladas = r.filter(x => Number(x.falhas) > 0).map(x => `${x.robo}(${x.falhas})`);
  ok("A ÚLTIMA execução de cada robô foi bem-sucedida", ultimoRuim.length === 0, ultimoRuim.join(", ") || (isoladas.length ? "falhas isoladas já recuperadas (72h): " + isoladas.join(", ") : ""));
  // 2) razão: lançamentos novos têm código; saldo de cada carteira = soma dos lançamentos
  const sem = await q(`SELECT revenda, tipo_agente, count(*) n FROM bmax_transacoes WHERE criado_em > :d AND tipo_agente IN ('revenda','representante') AND revenda NOT IN ('Sem Revenda','Sem Representante') AND revenda_id IS NULL AND grupo_id IS NULL AND representante_id IS NULL GROUP BY 1,2`, { d: DESDE });
  const novos = (await q(`SELECT count(*) n FROM bmax_transacoes WHERE criado_em > :d`, { d: DESDE }))[0].n; ok("Lançamentos novos gravam o código", sem.length === 0, `${novos} lançamento(s) novo(s) desde ${DESDE.slice(0, 10)}${sem.length ? "; SEM código: " + JSON.stringify(sem) : ""}`);
  const diverg = await q(`SELECT s.revenda, s.tipo_agente, s.saldo::float, COALESCE(t.v,0)::float soma FROM bmax_saldo s LEFT JOIN (SELECT revenda, tipo_agente, SUM(CASE WHEN tipo='credito' THEN valor ELSE -valor END) v FROM bmax_transacoes GROUP BY 1,2) t USING (revenda, tipo_agente) WHERE abs(s.saldo - COALESCE(t.v,0)) > 0.01`);
  ok("Saldo de cada carteira bate com a soma dos lançamentos", diverg.length === 0, diverg.length ? JSON.stringify(diverg.slice(0, 5)) : `${(await q(`SELECT count(*) n FROM bmax_saldo`))[0].n} carteiras`);
  // 3) cadastro x grupos x RD
  const lojas = await sbSistemasService("/comercial_revendas_bmax?ativo=eq.true&select=id,nome,nome_rd,grupo,grupo_id,user_id");
  const semNomeRd = lojas.filter(x => !String(x.nome_rd || x.nome || "").trim()); ok("Toda loja ativa tem nome (nome no RD ou de cadastro)", semNomeRd.length === 0, semNomeRd.map(x => x.id).join(", "));
  const semGrupoId = lojas.filter(x => x.grupo && !x.grupo_id); ok("Toda loja de grupo está ligada ao código do grupo", semGrupoId.length === 0, semGrupoId.map(x => x.nome).join(", "));
  const tab = await q(`SELECT grupo, revenda_rd FROM bmax_grupos`); const esperado = new Set(lojas.filter(x => x.grupo).map(x => nz(x.grupo) + "|" + nz(x.nome_rd || x.nome)));
  const tabSet = new Set(tab.map(x => nz(x.grupo) + "|" + nz(x.revenda_rd))); const faltam = [...esperado].filter(k => !tabSet.has(k)); ok("bmax_grupos tem uma linha para cada loja de grupo", faltam.length === 0, faltam.join(" ; "));
  const contagem = {}; lojas.forEach(x => { const k = nz(x.nome_rd || x.nome); (contagem[k] = contagem[k] || new Set()).add(nz(x.grupo || "")); });
  const dup = Object.entries(contagem).filter(([, g]) => g.size > 1 || (g.size === 1 && [...g][0] === "" && lojas.filter(x => nz(x.nome_rd || x.nome) === 0).length)).map(([k]) => k);
  const dupReais = lojas.filter(x => !x.grupo).map(x => nz(x.nome_rd || x.nome)).filter((n, i, a) => a.indexOf(n) !== i); ok("Nome no RD repetido só dentro do mesmo grupo", dup.length === 0 && dupReais.length === 0, [...dup, ...dupReais].join(", "));
  const opc = (await l.getOpcoesRevendaRD()).map(String); const nomes = new Set(lojas.map(x => nz(x.nome_rd || x.nome)));
  const semOpcao = lojas.filter(x => !opc.some(o => nz(o) === nz(x.nome_rd || x.nome))).map(x => x.nome_rd || x.nome); ok("Toda loja ativa tem opção no RD", semOpcao.length === 0, semOpcao.join(", "));
  const sobra = opc.filter(o => !nomes.has(nz(o)) && nz(o) !== "sem revenda"); ok("Nenhuma opção do RD sem loja ativa (exceto Sem Revenda)", sobra.length === 0, sobra.join(" | "));
  // 4) cards: todo nome de revenda nos cards resolve para uma loja/grupo ativo (ou Sem Revenda)
  const deals = await l.fetchAllDealsAllPipelines(); const cont = {}; deals.forEach(d => { const v = String(l.getCustomField(d, "REVENDA/LOJA") || ""); if (v) cont[v] = (cont[v] || 0) + 1; });
  const apel = await sbSistemasService("/comercial_bmax_apelidos?select=entidade,entidade_id,apelido_norm&limit=5000"); const ativosRev = new Set(lojas.map(x => x.id)), ativosGrp = new Set(lojas.map(x => x.grupo_id).filter(Boolean));
  const conhecidos = new Set(["sem revenda", ...nomes]); apel.forEach(a => { if ((a.entidade === "revenda" && ativosRev.has(a.entidade_id)) || (a.entidade === "grupo" && ativosGrp.has(a.entidade_id))) conhecidos.add(a.apelido_norm); });
  const EXCECOES = new Set(["dutra maquinas"]);   // decisão do André (19/11/2026): card de "Dutra Máquinas" fica como está
  const orfaos = Object.entries(cont).filter(([v]) => !conhecidos.has(nz(v)) && !EXCECOES.has(nz(v))); ok("Todo nome de REVENDA/LOJA nos cards resolve para loja/grupo ativo", orfaos.length === 0, orfaos.map(([v, n]) => `"${v}"x${n}`).join(", "));
  // 5) logins: todo login de revenda aponta para uma loja ativa
  const logins = await q(`SELECT u.username, r.name, r.revenda_id FROM "Users" u JOIN "Revendas" r ON r.user_id=u.id WHERE u.role='revenda'`); const semLoja = logins.filter(x => !x.revenda_id || !ativosRev.has(x.revenda_id)).map(x => x.username);
  ok("Todo login de revenda está ligado a uma loja ativa", semLoja.length === 0, semLoja.join(", ")); console.log(`\nlojas ativas ${lojas.length} | logins ${logins.length} | cards ${deals.length}`);
  const falhou = res.filter(x => !x.passou).length; console.log(`\nRESULTADO: ${res.length - falhou}/${res.length} critérios OK${falhou ? " — " + falhou + " FALHA(S)" : " — TUDO VERDE"}`);
  process.exit(falhou ? 1 : 0);
})().catch(e => { console.error("ERRO", e.stack || e.message); process.exit(2); });
