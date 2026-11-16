// Performance de Revendas (admin). Dados vêm de GET /api/admin/performance-revendas (componentes aditivos por loja);
// aqui somamos por grupo, aplicamos filtros e recalculamos taxas. Prefixo "perf" evita colisão com os outros scripts.
const PERF = { limite: 45, dados: null, modo: "grupo", sort: { k: "valor", dir: "desc" }, sel: new Set(), colsOcultas: new Set(), carregando: false };
const PERF_SOMAVEIS = ["leads", "vendas", "valor", "cashback_gerado", "cashback_resgatado", "saldo", "pci12_recebidos", "dec12a_revenda", "dec12a_equipe", "dec12b_revenda", "dec12b_equipe", "auto12b", "aguardando", "horas_soma", "horas_n", "a12_assumidos", "a12_vendidos", "a12_valor", "a12_perdidos", "a12_abertos", "a12_vencidos"];

const perfBRL = v => v == null ? "—" : Number(v).toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
const perfData = v => v ? new Date(v).toLocaleDateString("pt-BR") : "—";
const perfNum = v => v == null ? "—" : Number(v).toLocaleString("pt-BR");
const perfPct = v => v == null ? "—" : (v * 100).toLocaleString("pt-BR", { maximumFractionDigits: 1 }) + "%";
const perfDiv = (a, b) => b ? a / b : null;

// key, rótulo, grupo (cabeçalho), formatador, dica. Colunas "d_" são derivadas.
const PERF_COLS = [
  { k: "nome", l: "Revenda", g: "", fixa: true },
  { k: "classe", l: "Classe", g: "Cadastro", txt: true },
  { k: "estado", l: "UF", g: "Cadastro", txt: true },
  { k: "rep", l: "Rep BMax", g: "Cadastro", txt: true },
  { k: "leads", l: "Leads", g: "Vendas", f: perfNum },
  { k: "vendas", l: "Vendas", g: "Vendas", f: perfNum },
  { k: "valor", l: "Valor vendido", g: "Vendas", f: perfBRL },
  { k: "d_conv", l: "Conversão", g: "Vendas", f: perfPct, tip: "Vendas ÷ leads" },
  { k: "d_ticket", l: "Ticket médio", g: "Vendas", f: perfBRL },
  { k: "cashback_gerado", l: "Cashback gerado", g: "Cashback", f: perfBRL, tip: "Créditos menos ajustes de recálculo" },
  { k: "d_cbpct", l: "Cashback ÷ venda", g: "Cashback", f: perfPct },
  { k: "cashback_resgatado", l: "Resgatado", g: "Cashback", f: perfBRL },
  { k: "saldo", l: "Saldo atual", g: "Cashback", f: perfBRL },
  { k: "pci12_recebidos", l: "PCI12 recebidos", g: "PCI12", f: perfNum, tip: "Histórico do rastreio desde 30/07/2026" },
  { k: "d_dec12a", l: "Decididos 12a", g: "PCI12", f: perfNum },
  { k: "d_dec12b", l: "Decididos 12b", g: "PCI12", f: perfNum },
  { k: "auto12b", l: "12b automático (48h)", g: "PCI12", f: perfNum },
  { k: "aguardando", l: "Aguardando decisão", g: "PCI12", f: perfNum },
  { k: "d_horas", l: "Tempo p/ decidir (h)", g: "PCI12", f: v => v == null ? "—" : v.toLocaleString("pt-BR", { maximumFractionDigits: 1 }) },
  { k: "a12_assumidos", l: "12a assumidos", g: "12a", f: perfNum, tip: "Leads em que a revenda assumiu a venda" },
  { k: "a12_vendidos", l: "12a com venda", g: "12a", f: perfNum },
  { k: "a12_valor", l: "Valor vendas 12a", g: "12a", f: perfBRL },
  { k: "d_p12a_vend", l: "% 12a vendidos", g: "12a", f: perfPct },
  { k: "d_p12a_aberto", l: "% 12a em aberto", g: "12a", f: perfPct, tip: "Assumidos ainda não concluídos (nem vendidos, nem perdidos)" },
  { k: "d_p12a_perdido", l: "% 12a perdidos", g: "12a", f: perfPct },
  { k: "a12_vencidos", l: "12a prazo vencido", g: "12a", f: perfNum, tip: "Assumidos arquivados pelo robô ao completar 60 dias sem venda" },
  { k: "d_p12a_vencido", l: "% 12a prazo vencido", g: "12a", f: perfPct }
];
const PERF_PADRAO_OCULTAS = ["rep", "d_ticket", "cashback_resgatado", "saldo", "auto12b", "aguardando", "d_horas", "d_dec12b"];

function perfDerivar(r) {
  r.d_conv = perfDiv(r.vendas, r.leads);
  r.d_ticket = perfDiv(r.valor, r.vendas);
  r.d_cbpct = perfDiv(r.cashback_gerado, r.valor);
  r.d_dec12a = r.dec12a_revenda + r.dec12a_equipe;
  r.d_dec12b = r.dec12b_revenda + r.dec12b_equipe;
  r.d_horas = perfDiv(r.horas_soma, r.horas_n);
  r.d_p12a_vend = perfDiv(r.a12_vendidos, r.a12_assumidos);
  r.d_p12a_aberto = perfDiv(r.a12_abertos, r.a12_assumidos);
  r.d_p12a_perdido = perfDiv(r.a12_perdidos, r.a12_assumidos);
  r.d_p12a_vencido = perfDiv(r.a12_vencidos, r.a12_assumidos);
  return r;
}

function perfSomar(destino, origem) { PERF_SOMAVEIS.forEach(k => { destino[k] = (destino[k] || 0) + (origem[k] || 0); }); }

function perfLerPrefs() {
  try { const j = JSON.parse(localStorage.getItem("perfColsOcultas") || "null"); PERF.colsOcultas = new Set(Array.isArray(j) ? j : PERF_PADRAO_OCULTAS); }
  catch { PERF.colsOcultas = new Set(PERF_PADRAO_OCULTAS); }
}
function perfSalvarPrefs() { try { localStorage.setItem("perfColsOcultas", JSON.stringify([...PERF.colsOcultas])); } catch { /* sem storage: segue */ } }

async function carregarPerformance(forcar) {
  const wrap = $("perfBody"); if (!wrap || PERF.carregando) return;
  if (PERF.dados && !forcar) { perfRender(); return; }
  PERF.carregando = true; perfLerPrefs();
  wrap.innerHTML = '<p style="color:var(--muted);padding:16px">Carregando indicadores (pode levar uns 10 segundos)…</p>';
  try {
    const de = $("perfDe")?.value || "", ate = $("perfAte")?.value || "";
    const qs = new URLSearchParams(); if (de) qs.set("de", de); if (ate) qs.set("ate", ate);
    const res = await adminFetch(`${API_URL}/admin/performance-revendas` + (qs.toString() ? "?" + qs : ""), { headers: { Authorization: `Bearer ${localStorage.getItem("token")}` } });
    if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || "Erro " + res.status);
    PERF.dados = await res.json();
    perfPopularFiltros(); perfRender();
  } catch (e) { wrap.innerHTML = `<p style="color:#b91c1c;padding:16px">Não foi possível carregar: ${esc(e.message)}</p>`; }
  finally { PERF.carregando = false; }
}

function perfPopularFiltros() {
  const L = PERF.dados.linhas;
  const preencher = (id, valores, rotulo) => { const el = $(id); if (!el) return; const atual = el.value; el.innerHTML = `<option value="">${rotulo}</option>` + valores.map(v => `<option>${esc(v)}</option>`).join(""); el.value = valores.includes(atual) ? atual : ""; };
  const uniq = k => [...new Set(L.map(r => r[k]).filter(Boolean))].sort((a, b) => a.localeCompare(b, "pt-BR"));
  preencher("perfFEstado", uniq("estado"), "Todos os estados");
  preencher("perfFClasse", uniq("classe"), "Todas as classes");
  preencher("perfFRep", uniq("rep"), "Todos os representantes");
  const pcis = [...new Set(L.flatMap(r => r.detalhes.map(d => d.p)).filter(Boolean))].sort((a, b) => a.localeCompare(b, "pt-BR", { numeric: true }));
  preencher("perfFPci", pcis, "Todos os PCIs");
}

// Linhas visíveis: aplica filtros, recalcula leads/vendas pelo PCI quando filtrado, agrupa por grupo se for o caso.
function perfLinhas() {
  const f = { q: ($("perfBusca")?.value || "").toLowerCase(), uf: $("perfFEstado")?.value, cl: $("perfFClasse")?.value, rep: $("perfFRep")?.value, pci: $("perfFPci")?.value, venda: $("perfFVenda")?.value };
  let base = PERF.dados.linhas.map(r => ({ ...r }));
  if (f.pci) base.forEach(r => { const ds = r.detalhes.filter(d => d.p === f.pci); r.leads = ds.length; const v = ds.filter(d => d.s === "venda"); r.vendas = v.length; r.valor = v.reduce((a, d) => a + d.v, 0); });
  if (f.pci) base = base.filter(r => r.leads > 0);
  base = base.filter(r => (!f.uf || r.estado === f.uf) && (!f.cl || r.classe === f.cl) && (!f.rep || r.rep === f.rep));
  let linhas;
  if (PERF.modo === "grupo") {
    const m = new Map();
    for (const r of base) {
      const chave = r.grupo || r.nome; let g = m.get(chave);
      if (!g) { g = { nome: chave, grupo: r.grupo || "", lojas: [], classe: r.classe, estado: r.estado, rep: r.rep, detalhes: [] }; m.set(chave, g); }
      g.lojas.push(r.nome); g.fora_cadastro = g.fora_cadastro || r.fora_cadastro; perfSomar(g, r); g.detalhes.push(...r.detalhes);
      if (g.classe !== r.classe) g.classe = "várias"; if (g.estado !== r.estado) g.estado = "vários"; if (g.rep !== r.rep) g.rep = "vários";
    }
    linhas = [...m.values()];
  } else linhas = base;
  linhas.forEach(perfDerivar);
  if (f.q) linhas = linhas.filter(r => r.nome.toLowerCase().includes(f.q) || (r.lojas || []).some(n => n.toLowerCase().includes(f.q)));
  if (f.venda === "com") linhas = linhas.filter(r => r.vendas > 0);
  if (f.venda === "sem") linhas = linhas.filter(r => !r.vendas);
  const { k, dir } = PERF.sort, mul = dir === "asc" ? 1 : -1;
  linhas.sort((a, b) => {
    const x = a[k], y = b[k];
    if (x == null && y == null) return 0; if (x == null) return 1; if (y == null) return -1;
    return (typeof x === "string" ? x.localeCompare(y, "pt-BR") : x - y) * mul;
  });
  return linhas;
}

function perfCard(rotulo, valor, sub) {
  return `<div class="stat"><div class="k">${rotulo}</div><div class="v">${valor}</div>${sub ? `<div style="font-size:11px;color:var(--muted);margin-top:2px">${sub}</div>` : ""}</div>`;
}

// Painel "12a perto do prazo": leads 12a ainda abertos há PERF.limite dias ou mais (prazo total: 60 dias desde que a revenda assumiu)
function perfLimite(v) { PERF.limite = Number(v) || 45; perfRender(); }
function perfPrazoHtml() {
  const lista = (PERF.dados.prazo12a || []).filter(x => x.dias >= PERF.limite);
  const vencidos = lista.filter(x => x.restam <= 0).length;
  const porRev = {}; lista.forEach(x => { porRev[x.revenda] = (porRev[x.revenda] || 0) + 1; });
  const chips = Object.entries(porRev).sort((a, b) => b[1] - a[1]).map(([n, q]) => `<span style="background:var(--surface2);border:1px solid var(--line);border-radius:999px;padding:2px 10px;font-size:12px"><b>${esc(n)}</b> ${q}</span>`).join(" ");
  const cor = r => r <= 0 ? "#b91c1c" : r <= 10 ? "#b45309" : "var(--muted)";
  const rotulo = r => r < 0 ? `venceu há ${-r} d` : r === 0 ? "vence hoje" : `faltam ${r} d`;
  let h = `<div style="border:1px solid var(--line);border-radius:10px;padding:12px;margin:0 0 12px;background:var(--panel)">
    <div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap;margin-bottom:8px"><b>12a perto do prazo</b>
      <span style="font-size:12px;color:var(--muted)">leads em que a revenda assumiu a venda e ainda não foram concluídos; o prazo é de 60 dias desde o aceite</span>
      <label style="font-size:12px;margin-left:auto">A partir de <select onchange="perfLimite(this.value)" style="max-width:110px">${[30, 40, 45, 50, 55, 60].map(n => `<option value="${n}" ${n === PERF.limite ? "selected" : ""}>${n} dias</option>`).join("")}</select></label></div>`;
  if (!lista.length) return h + `<p style="color:var(--muted);margin:0;font-size:13px">Nenhum lead 12a aberto com ${PERF.limite} dias ou mais.</p></div>`;
  h += `<p style="margin:0 0 8px;font-size:13px"><b>${lista.length}</b> leads${vencidos ? ` · <b style="color:#b91c1c">${vencidos} já passaram do prazo</b>` : ""}</p><div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:10px">${chips}</div>
    <div style="overflow-x:auto"><table class="extrato-table" style="margin:0"><thead><tr><th>Revenda</th><th>Lead</th><th>Etapa</th><th style="text-align:right">Valor</th><th>Assumiu em</th><th>Vence em</th><th style="text-align:right">Dias</th><th>Prazo</th></tr></thead><tbody>`;
  h += lista.map(x => `<tr><td>${esc(x.revenda)}</td><td>${esc(x.lead)}</td><td>${esc(x.etapa)}</td><td style="text-align:right">${x.valor ? perfBRL(x.valor) : "—"}</td><td>${perfData(x.assumido)}${x.aceite_registrado ? "" : ' <span title="Sem registro do aceite no Portal: a data é a do dia em que o robô viu o lead pela primeira vez e pode não ser a real" style="color:#b45309;cursor:help">*</span>'}</td><td>${perfData(new Date(new Date(x.assumido).getTime() + 60 * 864e5))}</td><td style="text-align:right;font-variant-numeric:tabular-nums">${x.dias}</td><td style="color:${cor(x.restam)};font-weight:700">${rotulo(x.restam)}</td></tr>`).join("");
  return h + "</tbody></table></div><p style=\"margin:8px 0 0;font-size:11px;color:var(--muted)\">Data de assumir = dia em que a revenda clicou em \"Eu assumo a venda\" no Portal (registro de auditoria). * = sem esse registro; a data é estimada.</p></div>";
}

function perfRender() {
  const wrap = $("perfBody"); if (!wrap || !PERF.dados) return;
  const linhas = perfLinhas(); const T = {}; linhas.forEach(r => perfSomar(T, r)); perfDerivar(T);
  const sem = PERF.dados.sem_revenda;
  const h = PERF.dados.historico_pci12;
  let html = `<div class="stats" style="grid-template-columns:repeat(auto-fit,minmax(150px,1fr));margin-bottom:10px">
    ${perfCard("Revendas", perfNum(linhas.length), PERF.modo === "grupo" ? "grupos/lojas com atividade" : "lojas com atividade")}
    ${perfCard("Leads", perfNum(T.leads || 0))}
    ${perfCard("Vendas", perfNum(T.vendas || 0), "conversão " + perfPct(T.d_conv))}
    ${perfCard("Valor vendido", perfBRL(T.valor || 0), "ticket " + perfBRL(T.d_ticket))}
    ${perfCard("Cashback gerado", perfBRL(T.cashback_gerado || 0), perfPct(T.d_cbpct) + " da venda")}
    ${perfCard("PCI12 recebidos", perfNum(T.pci12_recebidos || 0), (T.aguardando || 0) + " aguardando decisão")}
    ${perfCard("Decididos 12a", perfNum(T.d_dec12a || 0), "revenda " + (T.dec12a_revenda || 0) + " · equipe " + (T.dec12a_equipe || 0))}
    ${perfCard("Decididos 12b", perfNum(T.d_dec12b || 0), "revenda " + (T.dec12b_revenda || 0) + " · equipe " + (T.dec12b_equipe || 0) + " · auto " + (T.auto12b || 0))}
    ${perfCard("12a assumidos", perfNum(T.a12_assumidos || 0), (T.a12_vendidos || 0) + " vendidos · " + perfBRL(T.a12_valor || 0))}
    ${perfCard("% 12a em aberto", perfPct(T.d_p12a_aberto), (T.a12_abertos || 0) + " ainda não concluídos")}
    ${perfCard("% 12a perdidos", perfPct(T.d_p12a_perdido), (T.a12_perdidos || 0) + " perdidos")}
    ${perfCard("% 12a prazo vencido", perfPct(T.d_p12a_vencido), (T.a12_vencidos || 0) + " passaram de 60 dias")}
    ${perfCard("12a perto do prazo", perfNum((PERF.dados.prazo12a || []).filter(x => x.dias >= PERF.limite).length), "abertos há " + PERF.limite + " dias ou mais")}
    ${perfCard("% 12a vendidos", perfPct(T.d_p12a_vend), "dos assumidos")}
  </div>
  ${perfPrazoHtml()}
  <p style="font-size:12px;color:var(--muted);margin:0 0 10px">Sem revenda (fora da tabela): <b>${perfNum(sem.leads)}</b> leads · <b>${perfNum(sem.vendas)}</b> vendas · <b>${perfBRL(sem.valor)}</b>. Histórico PCI12: rastreio de 48h desde ${esc(h.rastreio_48h_desde.split("-").reverse().join("/"))}; escolhas 12a/12b e assumidos desde ${esc(h.escolhas_e_assumidos_desde.split("-").reverse().join("/"))} — antes disso não há registro.</p>`;

  const cols = PERF_COLS.filter(c => c.fixa || !PERF.colsOcultas.has(c.k));
  const grupos = []; cols.forEach(c => { const u = grupos[grupos.length - 1]; if (u && u.g === c.g) u.n++; else grupos.push({ g: c.g, n: 1 }); });
  html += `<div style="overflow-x:auto;border:1px solid var(--line);border-radius:10px"><table class="extrato-table" style="min-width:900px;margin:0">
    <thead><tr><th rowspan="2" style="width:28px"></th>${grupos.map(g => `<th colspan="${g.n}" style="text-align:center;font-size:10px;letter-spacing:.4px;text-transform:uppercase;color:var(--muted)">${esc(g.g)}</th>`).join("")}</tr><tr>
    ${cols.map(c => { const at = PERF.sort.k === c.k; return `<th style="cursor:pointer;white-space:nowrap;${c.txt || c.k === "nome" ? "" : "text-align:right"}" title="${esc(c.tip || "Clique para ordenar")}" onclick="perfOrdenar('${c.k}')">${esc(c.l)} <span style="opacity:${at ? 1 : .25}">${at ? (PERF.sort.dir === "asc" ? "▲" : "▼") : "↕"}</span></th>`; }).join("")}</tr></thead><tbody>`;
  for (const r of linhas) {
    html += `<tr><td><input type="checkbox" ${PERF.sel.has(r.nome) ? "checked" : ""} onchange="perfSelecionar('${esc(r.nome).replace(/'/g, "\\'")}',this.checked)"></td>` + cols.map(c => {
      if (c.k === "nome") return `<td><a href="#" style="font-weight:700;color:var(--blue)" onclick="perfDetalhe('${esc(r.nome).replace(/'/g, "\\'")}');return false">${esc(r.nome)}</a>${r.lojas && r.lojas.length > 1 ? `<div style="font-size:11px;color:var(--muted)">${r.lojas.length} lojas</div>` : ""}${r.fora_cadastro ? '<div style="font-size:11px;color:#b45309" title="Nome do campo REVENDA/LOJA do RD que não corresponde a nenhuma revenda cadastrada em Revendas BMax">sem cadastro</div>' : ""}</td>`;
      if (c.txt) return `<td>${esc(r[c.k] || "—")}</td>`;
      return `<td style="text-align:right;font-variant-numeric:tabular-nums">${c.f(r[c.k])}</td>`;
    }).join("") + "</tr>";
  }
  html += `</tbody><tfoot><tr style="font-weight:800;background:var(--surface2)"><td></td>${cols.map((c, i) => i === 0 ? "<td>Total</td>" : c.txt ? "<td></td>" : `<td style="text-align:right;font-variant-numeric:tabular-nums">${c.f(T[c.k])}</td>`).join("")}</tr></tfoot></table></div>`;
  if (!linhas.length) html += '<p style="color:var(--muted);padding:12px">Nenhuma revenda com os filtros atuais.</p>';
  wrap.innerHTML = html;
  const b = $("perfBtnComparar"); if (b) { b.disabled = PERF.sel.size < 2; b.textContent = `Comparar selecionadas (${PERF.sel.size})`; }
}

function perfOrdenar(k) {
  PERF.sort = PERF.sort.k === k ? { k, dir: PERF.sort.dir === "asc" ? "desc" : "asc" } : { k, dir: ["nome", "classe", "estado", "rep"].includes(k) ? "asc" : "desc" };
  perfRender();
}
function perfSelecionar(nome, on) { on ? PERF.sel.add(nome) : PERF.sel.delete(nome); const b = $("perfBtnComparar"); if (b) { b.disabled = PERF.sel.size < 2; b.textContent = `Comparar selecionadas (${PERF.sel.size})`; } }
function perfModo(m) { PERF.modo = m; PERF.sel.clear(); document.querySelectorAll(".perfModoBtn").forEach(b => b.classList.toggle("primary", b.dataset.m === m)); perfRender(); }
function perfLimparFiltros() { ["perfBusca", "perfFEstado", "perfFClasse", "perfFRep", "perfFPci", "perfFVenda"].forEach(id => { const e = $(id); if (e) e.value = ""; }); perfRender(); }

function perfAbrirModal(titulo, corpo, largo) {
  let ov = $("perfOverlay");
  if (!ov) { ov = document.createElement("div"); ov.id = "perfOverlay"; ov.style.cssText = "position:fixed;inset:0;background:rgba(0,8,59,.45);z-index:2000;display:flex;align-items:center;justify-content:center;padding:16px"; ov.onclick = e => { if (e.target === ov) ov.remove(); }; document.body.appendChild(ov); }
  ov.innerHTML = `<div style="background:var(--panel);border-radius:12px;padding:20px;max-width:${largo ? "1100px" : "760px"};width:100%;max-height:88vh;overflow:auto;box-shadow:0 20px 60px rgba(0,0,0,.25)"><div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px"><h3 style="margin:0">${esc(titulo)}</h3><button class="btn btn-sm" onclick="document.getElementById('perfOverlay').remove()">Fechar</button></div>${corpo}</div>`;
}

function perfComparar() {
  const todas = perfLinhas(); const escolhidas = todas.filter(r => PERF.sel.has(r.nome));
  if (escolhidas.length < 2) { toast("Marque ao menos 2 revendas", "warn"); return; }
  const cols = PERF_COLS.filter(c => !c.fixa && !c.txt);
  let html = `<div style="overflow-x:auto"><table class="extrato-table"><thead><tr><th>Indicador</th>${escolhidas.map(r => `<th style="text-align:right">${esc(r.nome)}</th>`).join("")}</tr></thead><tbody>`;
  for (const c of cols) {
    const vals = escolhidas.map(r => r[c.k]); const nums = vals.filter(v => v != null); const melhor = nums.length ? Math.max(...nums) : null;
    html += `<tr><td>${esc(c.l)}</td>${escolhidas.map((r, i) => `<td style="text-align:right;font-variant-numeric:tabular-nums;${vals[i] != null && vals[i] === melhor && nums.length > 1 && melhor > 0 ? "font-weight:800;color:var(--blue)" : ""}">${c.f(vals[i])}</td>`).join("")}</tr>`;
  }
  perfAbrirModal("Comparação de revendas", html + "</tbody></table></div><p style='font-size:11px;color:var(--muted)'>Em azul, o maior valor de cada indicador.</p>", true);
}

function perfDetalhe(nome) {
  const r = perfLinhas().find(x => x.nome === nome); if (!r) return;
  const ordem = { venda: 0, aberto: 1, vencido: 2, perdido: 3 };
  const ds = [...r.detalhes].sort((a, b) => ordem[a.s] - ordem[b.s] || b.v - a.v);
  const cor = { venda: "#15803d", aberto: "#b45309", vencido: "#7c3aed", perdido: "#b91c1c" };
  let html = `<p style="font-size:12px;color:var(--muted);margin:0 0 8px">${r.lojas ? esc(r.lojas.join(", ")) : ""} ${r.classe ? "· classe " + esc(r.classe) : ""} ${r.rep ? "· rep " + esc(r.rep) : ""}</p>
  <div style="display:flex;gap:16px;flex-wrap:wrap;font-size:13px;margin-bottom:10px"><span><b>${perfNum(r.leads)}</b> leads</span><span><b>${perfNum(r.vendas)}</b> vendas</span><span><b>${perfBRL(r.valor)}</b></span><span>cashback <b>${perfBRL(r.cashback_gerado)}</b></span><span>12a: <b>${r.a12_assumidos}</b> assumidos · ${r.a12_vendidos} vendidos · ${r.a12_abertos} em aberto · ${r.a12_vencidos} prazo vencido · ${r.a12_perdidos} perdidos</span></div>
  <table class="extrato-table"><thead><tr><th>Lead</th><th>Etapa</th><th>PCI</th><th style="text-align:right">Valor</th><th>Situação</th><th>Criado</th></tr></thead><tbody>`;
  html += ds.map(d => `<tr><td>${esc(d.n)}</td><td>${esc(d.e)}</td><td>${esc(d.p || "—")}</td><td style="text-align:right">${d.v ? perfBRL(d.v) : "—"}</td><td style="color:${cor[d.s]};font-weight:700">${d.s}</td><td>${d.c ? new Date(d.c).toLocaleDateString("pt-BR") : "—"}</td></tr>`).join("") || '<tr><td colspan="6" style="color:var(--muted)">Sem leads no período.</td></tr>';
  perfAbrirModal(r.nome, html + "</tbody></table>");
}

function perfColunas() {
  const html = ["Cadastro", "Vendas", "Cashback", "PCI12", "12a"].map(g => `<div style="margin-bottom:10px"><b style="font-size:12px;color:var(--muted);text-transform:uppercase">${g}</b><div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:4px;margin-top:4px">${PERF_COLS.filter(c => c.g === g).map(c => `<label style="font-size:13px"><input type="checkbox" ${PERF.colsOcultas.has(c.k) ? "" : "checked"} onchange="perfAlternarColuna('${c.k}',this.checked)"> ${esc(c.l)}</label>`).join("")}</div></div>`).join("");
  perfAbrirModal("Colunas da tabela", html + '<button class="btn" onclick="PERF.colsOcultas=new Set(PERF_PADRAO_OCULTAS);perfSalvarPrefs();perfRender();document.getElementById(\'perfOverlay\').remove()">Restaurar padrão</button>');
}
function perfAlternarColuna(k, on) { on ? PERF.colsOcultas.delete(k) : PERF.colsOcultas.add(k); perfSalvarPrefs(); perfRender(); }

function perfExportar() {
  const linhas = perfLinhas(); const cols = PERF_COLS.filter(c => c.fixa || !PERF.colsOcultas.has(c.k));
  const cel = (c, r) => { const v = r[c.k]; if (v == null) return ""; if (c.txt || c.k === "nome") return `"${String(v).replace(/"/g, '""')}"`; return String(typeof v === "number" ? Number(v.toFixed(4)) : v).replace(".", ","); };
  const csv = "\uFEFF" + cols.map(c => c.l).join(";") + "\n" + linhas.map(r => cols.map(c => cel(c, r)).join(";")).join("\n");
  const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
  a.download = `performance-revendas-${new Date().toISOString().slice(0, 10)}.csv`; a.click(); URL.revokeObjectURL(a.href);
}
