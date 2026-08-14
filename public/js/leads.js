let API_LEADS = [];
let LEADS_SEM_REVENDA = [];
let isLoadingLeads = false;

function showSkeleton() {
  $("skeletonGrid").classList.remove("hidden");
  $("grid").classList.add("hidden");
}

function hideSkeleton() {
  $("skeletonGrid").classList.add("hidden");
  $("grid").classList.remove("hidden");
}

async function loadLeads() {
  const token = localStorage.getItem("token");

  if (!token) {
    logout();
    return;
  }

  isLoadingLeads = true;
  showSkeleton();

  try {
    const res = await fetch(`${API_URL}/leads`, {
      headers: { Authorization: `Bearer ${token}` }
    });

    if (res.status === 401) {
      alert("Sessao expirada");
      logout();
      return;
    }

    if (res.status === 403) return;

    if (!res.ok) {
      API_LEADS = [];
      return;
    }

    const data = await res.json();

    if (!Array.isArray(data) || data.length === 0) {
      API_LEADS = [];
      return;
    }

    if (session.role === "adm") {
      const invalidos = ["", "?????", "?", "Vazio", "N/D"];
      LEADS_SEM_REVENDA = data.filter(l => invalidos.includes((l.revenda || "").trim()));
      API_LEADS = data.filter(l => !invalidos.includes((l.revenda || "").trim()));
    } else {
      API_LEADS = data;
      LEADS_SEM_REVENDA = [];
    }
  } catch (err) {
    API_LEADS = [];
  } finally {
    isLoadingLeads = false;
    hideSkeleton();
  }
}

function setupFilter() {
  const sel = $("filter");
  const data = API_LEADS;

  sel.innerHTML = "";

  if (session.role === "revenda") {
    const opt = document.createElement("option");
    const label = session.name || session.username;
    opt.value = label;
    opt.textContent = label;
    sel.appendChild(opt);
    sel.value = label;
    sel.disabled = true;
    return;
  }

  sel.disabled = false;
  const revendas = uniq(data.map(l => l.revenda)).sort();

  const optAll = document.createElement("option");
  optAll.value = "all";
  optAll.textContent = "Todas as revendas";
  sel.appendChild(optAll);

  revendas.forEach(r => {
    const opt = document.createElement("option");
    opt.value = r;
    opt.textContent = r;
    sel.appendChild(opt);
  });

  sel.value = "all";
}

function render() {
  const qRaw = $("q").value.trim();
  const qText = normalizeText(qRaw);
  const qDigits = normalizeDigits(qRaw);
  const rev = $("filter").value;

  let data = API_LEADS;

  if (session.role === "revenda") {
    if (normalizeText(rev).includes("luitex")) {
      data = data.filter(l => normalizeText(l.revenda).includes("luitex"));
    } else {
      data = data.filter(l => normalizeText(l.revenda) === normalizeText(rev));
    }
  } else if (rev !== "all") {
    data = data.filter(l => normalizeText(l.revenda) === normalizeText(rev));
  }

  if (qRaw) {
    data = data.filter(l => {
      const textBlob = normalizeText([
        l.nome, l.cidade, l.atividade, l.segmento, l.vinculo, l.tag, l.revenda, l.representante, l.pci
      ].join(" | "));

      const digitsBlob = normalizeDigits([l.cnpj, l.cep, l.id, l.preco].join(""));

      const matchText = qText && textBlob.includes(qText);
      const matchDigits = qDigits && digitsBlob.includes(qDigits);

      return matchText || matchDigits;
    });
  }

  const vendas = data.filter(l => {
    const t = (l.tag || "").toLowerCase();
    return t.includes("venda") || t === "vendido";
  });

  $("statLeads").textContent = data.length;
  $("statRevendas").textContent = uniq(data.map(l => l.revenda)).length;
  $("statVendas").textContent = vendas.length;

  const cashbackTotal = data.reduce((total, card) => total + (card.cashback || 0), 0);
  const cashValEl = $("statCashbackVal");
  cashValEl.textContent = `R$ ${cashbackTotal.toLocaleString("pt-BR", {minimumFractionDigits:2, maximumFractionDigits:2})}`;
  cashValEl.className = cashbackTotal > 0 ? "cashback-positive" : "";

  const alertEl = $("alertaSemRevenda");
  if (session.role === "adm" && LEADS_SEM_REVENDA.length > 0) {
    $("qtdSemRevenda").textContent = LEADS_SEM_REVENDA.length;
    alertEl.classList.remove("hidden");
  } else {
    alertEl.classList.add("hidden");
  }

  const grid = $("grid");
  grid.innerHTML = "";

  $("empty").classList.toggle("hidden", data.length !== 0);

  data.forEach(l => {
    const el = document.createElement("div");
    el.className = "lead";
    el.dataset.leadJson = JSON.stringify(l);
    const cb = Number(l.cashback || 0);
    const cbClass = cb > 0 ? "cashback cashback-pos" : "cashback";
    el.innerHTML = `
      <div class="lead-top">
        <div class="lead-title">
          <h4 title="${esc(l.nome)}">${esc(l.nome)}</h4>
          <div class="subline">${esc(l.revenda)} &bull; ${esc(l.representante)}</div>
        </div>
        <div class="tag ${tagClass(l.tag)}">${esc(l.tag)}</div>
      </div>

      <div class="meta">
        <div class="pair"><b>CNPJ</b><span title="${esc(l.cnpj)}">${esc(l.cnpj)}</span></div>
        <div class="pair"><b>Cidade/UF</b><span>${esc(l.cidade)}/${esc(l.estado)}</span></div>
        <div class="pair"><b>Maquina</b><span title="${esc(l.maquinainteresse)}">${esc(l.maquinainteresse)}</span></div>
        <div class="pair"><b>Valor</b><span>R$ ${esc(l.valor)}</span></div>
      </div>

      <div class="lead-foot">
        <span style="font-size:11px;color:var(--muted);font-weight:800;">${esc(l.criadoem)}</span>
        <div class="${cbClass}">R$ ${cb.toFixed(2)}</div>
      </div>
      ${session.role === "revenda" && l.tag === "Assumido" && ["PCI12B"].includes(normalizePci(l.pci)) ? `
      <div class="lead-resultado" data-id="${esc(l.id)}">
        <div class="resultado-actions">
          <button type="button" class="resultado-btn vendido" data-id="${esc(l.id)}" data-resultado="vendido">Vendido</button>
          <button type="button" class="resultado-btn perdido" data-id="${esc(l.id)}" data-resultado="perdido">Perdido</button>
        </div>
        <input type="number" class="valor-venda" data-id="${esc(l.id)}" placeholder="Valor numerico da venda" step="any" min="0" inputmode="decimal">
      </div>
      ` : ""}
      ${session.role === "revenda" && l.pci === "PCI12" ? `
      <div class="lead-action">
        <select class="caminho-select" data-id="${esc(l.id)}" data-cidade="${esc(l.cidade)}" data-estado="${esc(l.estado)}">
          <option value="">Selecionar Caminho</option>
          <option value="BOX+REV>IND">BOX+REV>IND</option>
          <option value="BOX>REV">BOX>REV</option>
        </select>
      </div>
      ` : ""}
    `;
    grid.appendChild(el);
  });
}

function openDrawer(leadData) {
  const l = leadData;
  const body = $("drawerBody");
  $("drawerTitle").textContent = l.nome || "Lead";

  body.innerHTML = `
    <div class="drawer-section">
      <h4>Identificacao</h4>
      <div class="drawer-row"><span class="dr-label">Nome</span><span class="dr-value">${esc(l.nome)}</span></div>
      <div class="drawer-row"><span class="dr-label">CNPJ</span><span class="dr-value">${esc(l.cnpj)}</span></div>
      <div class="drawer-row"><span class="dr-label">Cidade</span><span class="dr-value">${esc(l.cidade)}</span></div>
      <div class="drawer-row"><span class="dr-label">Estado</span><span class="dr-value">${esc(l.estado)}</span></div>
    </div>
    <div class="drawer-section">
      <h4>Negociacao</h4>
      <div class="drawer-row"><span class="dr-label">Maquina</span><span class="dr-value">${esc(l.maquinainteresse)}</span></div>
      <div class="drawer-row"><span class="dr-label">PCI</span><span class="dr-value">${esc(l.pci) || "N/D"}</span></div>
      <div class="drawer-row"><span class="dr-label">Valor</span><span class="dr-value">R$ ${esc(l.valor)}</span></div>
      <div class="drawer-row"><span class="dr-label">Cashback</span><span class="dr-value ${Number(l.cashback) > 0 ? "cashback-positive" : ""}">R$ ${Number(l.cashback || 0).toFixed(2)}</span></div>
    </div>
    <div class="drawer-section">
      <h4>Responsaveis</h4>
      <div class="drawer-row"><span class="dr-label">Revenda</span><span class="dr-value">${esc(l.revenda)}</span></div>
      <div class="drawer-row"><span class="dr-label">Representante</span><span class="dr-value">${esc(l.representante)}</span></div>
    </div>
    <div class="drawer-section">
      <h4>Status</h4>
      <div class="drawer-row"><span class="dr-label">Criado em</span><span class="dr-value">${esc(l.criadoem)}</span></div>
      <div class="drawer-tag"><div class="tag ${tagClass(l.tag)}">${esc(l.tag)}</div></div>
    </div>
    <div class="drawer-section">
      <h4>ID RD Station</h4>
      <div class="drawer-row"><span class="dr-label">Deal ID</span><span class="dr-value" style="font-size:11px;opacity:.7;">${esc(l.id)}</span></div>
    </div>
  `;

  $("drawerOverlay").classList.remove("hidden");
}

function closeDrawer() {
  $("drawerOverlay").classList.add("hidden");
}

document.addEventListener("click", (e) => {
  const card = e.target.closest(".lead");
  if (!card) return;
  if (e.target.closest(".caminho-select, .resultado-btn, .valor-venda, .lead-action, .lead-resultado")) return;

  try {
    const data = JSON.parse(card.dataset.leadJson);
    openDrawer(data);
  } catch(err) {}
});

$("drawerOverlay").addEventListener("click", (e) => {
  if (e.target === $("drawerOverlay")) closeDrawer();
});
$("drawerClose").addEventListener("click", closeDrawer);
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && !$("drawerOverlay").classList.contains("hidden")) closeDrawer();
});

document.addEventListener("change", async (e) => {
  if (!e.target.classList.contains("caminho-select")) return;
  if (session.role !== "revenda") return;

  const dealId = e.target.dataset.id;
  const caminho = e.target.value;
  let cidade = e.target.dataset.cidade || "";
  const estado = e.target.dataset.estado || "";

  if (cidade.includes(" - ")) {
    cidade = cidade.split(" - ")[0];
  }

  if (!caminho) return;

  const token = localStorage.getItem("token");

  const res = await fetch("/api/leads/pci", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${token}`
    },
    body: JSON.stringify({ dealId, caminho, cidade, estado })
  });

  if (!res.ok) {
    const errData = await res.json().catch(() => null);
    alert(errData?.error || `Erro ao Definir Caminho de Venda (${res.status})`);
    return;
  }

  const leadAction = e.target.closest(".lead-action");
  await loadLeads();
  render();

  if (leadAction) {
    leadAction.remove();
  } else {
    e.target.remove();
  }

  alert("Caminho de Venda Definido Com Sucesso");
});

document.addEventListener("click", async (e) => {
  const btn = e.target.closest(".resultado-btn");
  if (!btn || session.role !== "revenda") return;

  const card = btn.closest(".lead");
  const resultado = btn.dataset.resultado;
  const dealId = btn.dataset.id;
  const inputValor = card?.querySelector(".valor-venda");
  const valor = inputValor?.value?.trim();

  if (!valor) {
    alert("Informe um valor antes de marcar o resultado.");
    inputValor?.focus();
    return;
  }

  const valorNumero = Number(valor.replace(",", "."));

  if (!Number.isFinite(valorNumero) || valorNumero < 0) {
    alert("Informe um valor numerico valido.");
    inputValor?.focus();
    return;
  }

  const token = localStorage.getItem("token");

  const res = await fetch("/api/leads/resultado", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${token}`
    },
    body: JSON.stringify({ dealId, resultado, valor: valorNumero })
  });

  if (!res.ok) {
    const errData = await res.json().catch(() => null);
    alert(errData?.error || `Erro ao atualizar resultado (${res.status})`);
    return;
  }

  const resultadoArea = card?.querySelector(".lead-resultado");
  if (resultadoArea) resultadoArea.remove();

  alert(resultado === "vendido" ? "Lead marcado como Vendido." : "Lead marcado como Perdido.");
});
