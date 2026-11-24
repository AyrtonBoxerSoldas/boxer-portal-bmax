// Gráfico pequeno de motivos de perda, na aba Performance. Usa o mesmo período (De/Até) da Performance.
// Dados: GET /api/leads/andamento/relatorio/perdas?de=&ate=  ->  { porRevendaMotivo: [{revenda, motivo, qtd}] }
async function carregarPerdasGrafico() {
  const box = document.getElementById("perdasGrafico"); if (!box) return;
  const de = document.getElementById("perfDe")?.value || "", ate = document.getElementById("perfAte")?.value || "";
  const qs = new URLSearchParams(); if (de) qs.set("de", de); if (ate) qs.set("ate", ate);
  try {
    const res = await fetch("/api/leads/andamento/relatorio/perdas?" + qs, { headers: { Authorization: `Bearer ${localStorage.getItem("token")}` } });
    if (!res.ok) { box.classList.add("hidden"); return; }
    const d = await res.json();
    const por = {}; (d.porRevendaMotivo || []).forEach(r => { por[r.motivo] = (por[r.motivo] || 0) + r.qtd; });
    const itens = Object.entries(por).sort((a, b) => b[1] - a[1]);
    const total = itens.reduce((s, [, q]) => s + q, 0);
    if (!total) { box.classList.add("hidden"); return; }
    const max = itens[0][1];
    box.innerHTML = `<div class="perdas-tit">Por que as revendas perdem vendas <span>${total} perda${total > 1 ? "s" : ""} com motivo informado (PCI 12a e PCI X)</span></div>` +
      itens.map(([m, q]) => `<div class="perdas-linha" title="${esc(m)}: ${q} (${Math.round(q * 100 / total)}%)"><span class="perdas-rot">${esc(m)}</span><span class="perdas-barra"><i style="width:${Math.max(4, Math.round(q * 100 / max))}%"></i></span><b>${q}</b></div>`).join("");
    box.classList.remove("hidden");
  } catch (_) { box.classList.add("hidden"); }
}
