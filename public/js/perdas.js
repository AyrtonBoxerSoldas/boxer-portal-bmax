// Relatório de motivos de perda (admin). Dados: GET /api/leads/andamento/relatorio/perdas?de=&ate=
let PERDAS = { porRevendaMotivo: [], detalhes: [] };

async function carregarPerdas() {
  const body = document.getElementById("perdasBody"); if (!body) return;
  body.innerHTML = '<p style="color:var(--muted)">Carregando…</p>';
  const de = document.getElementById("perdasDe").value, ate = document.getElementById("perdasAte").value;
  const qs = new URLSearchParams(); if (de) qs.set("de", de); if (ate) qs.set("ate", ate);
  try {
    const res = await fetch("/api/leads/andamento/relatorio/perdas?" + qs, { headers: { Authorization: `Bearer ${localStorage.getItem("token")}` } });
    const d = await res.json().catch(() => ({}));
    if (!res.ok) { body.innerHTML = `<p style="color:var(--danger)">${esc(d.error || "Erro ao carregar o relatório")}</p>`; return; }
    PERDAS = d; renderPerdas();
  } catch (_) { body.innerHTML = '<p style="color:var(--danger)">Erro de conexão ao carregar o relatório.</p>'; }
}

function renderPerdas() {
  const body = document.getElementById("perdasBody");
  const linhas = PERDAS.porRevendaMotivo || [], det = PERDAS.detalhes || [];
  if (!linhas.length) { body.innerHTML = '<p style="color:var(--muted)">Nenhuma perda com motivo registrada neste período.</p>'; return; }
  const total = linhas.reduce((s, r) => s + r.qtd, 0);
  const porMotivo = {}; linhas.forEach(r => porMotivo[r.motivo] = (porMotivo[r.motivo] || 0) + r.qtd);
  const motivos = Object.entries(porMotivo).sort((a, b) => b[1] - a[1]);
  const revendas = {}; linhas.forEach(r => { (revendas[r.revenda] = revendas[r.revenda] || { total: 0, m: {} }); revendas[r.revenda].total += r.qtd; revendas[r.revenda].m[r.motivo] = r.qtd; });
  const listaRev = Object.entries(revendas).sort((a, b) => b[1].total - a[1].total);
  const fmt = v => v ? new Date(v).toLocaleString("pt-BR") : "";
  body.innerHTML = `
    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(320px,1fr));gap:16px;align-items:start">
      <div><h4 style="margin:0 0 8px">Motivos (${total} perda${total > 1 ? "s" : ""})</h4>
        <table><thead><tr><th>Motivo</th><th>Qtd</th><th>%</th></tr></thead><tbody>
        ${motivos.map(([m, q]) => `<tr><td>${esc(m)}</td><td>${q}</td><td>${Math.round(q * 100 / total)}%</td></tr>`).join("")}
        </tbody></table></div>
      <div><h4 style="margin:0 0 8px">Por revenda</h4>
        <table><thead><tr><th>Revenda</th><th>Perdas</th><th>Motivo mais citado</th></tr></thead><tbody>
        ${listaRev.map(([r, v]) => { const top = Object.entries(v.m).sort((a, b) => b[1] - a[1])[0]; return `<tr><td>${esc(r)}</td><td>${v.total}</td><td>${esc(top[0])} (${top[1]})</td></tr>`; }).join("")}
        </tbody></table></div>
    </div>
    <h4 style="margin:18px 0 8px">Leads perdidos${det.length >= 2000 ? " (últimos 2000)" : ""}</h4>
    <div style="overflow-x:auto"><table><thead><tr><th>Data</th><th>Lead</th><th>Revenda</th><th>PCI</th><th>Motivo</th><th>Observação</th><th>Usuário</th></tr></thead><tbody>
    ${det.map(r => `<tr><td>${esc(fmt(r.criado_em))}</td><td>${esc(r.lead_nome || r.deal_id)}</td><td>${esc(r.revenda)}</td><td>${esc(r.pci || "")}</td><td>${esc(r.motivo)}</td><td>${esc(r.observacao || "")}</td><td>${esc(r.usuario || "")}</td></tr>`).join("")}
    </tbody></table></div>`;
}

// CSV com BOM e ponto-e-vírgula: abre direto no Excel em português
function exportarPerdasCsv() {
  const det = PERDAS.detalhes || [];
  if (!det.length) { toast("Não há perdas para exportar neste período.", "warn"); return; }
  const c = v => `"${String(v ?? "").replace(/"/g, '""').replace(/\s+/g, " ")}"`;
  const linhas = [["Data", "Lead", "Revenda", "PCI", "Motivo", "Observação", "Usuário"].map(c).join(";")]
    .concat(det.map(r => [new Date(r.criado_em).toLocaleString("pt-BR"), r.lead_nome || r.deal_id, r.revenda, r.pci, r.motivo, r.observacao, r.usuario].map(c).join(";")));
  const blob = new Blob(["\ufeff" + linhas.join("\r\n")], { type: "text/csv;charset=utf-8" });
  const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = "motivos-de-perda.csv"; a.click(); URL.revokeObjectURL(a.href);
}
