let API_LEADS = [];
let LEADS_SEM_REVENDA = [];

async function loadLeads() {
  const token = localStorage.getItem("token");

  if (!token) {
    logout();
    return;
  }

  try {
    const res = await fetch(`${API_URL}/leads`, {
      headers: { Authorization: `Bearer ${token}` }
    });

    if (res.status === 401) {
      alert("Sessão expirada");
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

  $("statLeads").textContent = data.length;
  $("statRevendas").textContent = uniq(data.map(l => l.revenda)).length;
  $("statCidades").textContent = uniq(data.map(l => l.cidade)).length;
  $("statCashback").textContent = `R$ ${Number(data.reduce((total, card) => total + card.cashback, 0)).toFixed(2)}`;

  const alertEl = $("alertaSemRevenda");
  if (session.role === "adm" && LEADS_SEM_REVENDA.length > 0) {
    $("qtdSemRevenda").textContent = LEADS_SEM_REVENDA.length;
    alertEl.classList.remove("hidden");
    alertEl.style.display = "flex";
  } else {
    alertEl.classList.add("hidden");
    alertEl.style.display = "none";
  }

  const grid = $("grid");
  grid.innerHTML = "";

  $("empty").classList.toggle("hidden", data.length !== 0);

  data.forEach(l => {
    const el = document.createElement("div");
    el.className = "lead";
    el.innerHTML = `
      <div class="lead-top">
        <div class="lead-title">
          <h4 title="${esc(l.nome)}">${esc(l.nome)}</h4>
          <div class="subline">${esc(l.revenda)} • ${esc(l.representante)}</div>
        </div>
        <div class="badge">${esc(l.id).slice(0, 10)}...</div>
      </div>

      <div class="meta">
        <div class="pair"><b>Nome</b><span title="${esc(l.nome)}">${esc(l.nome)}</span></div>
        <div class="pair"><b>CNPJ</b><span title="${esc(l.cnpj)}">${esc(l.cnpj)}</span></div>
        <div class="pair"><b>Cidade/Estado</b><span title="${esc(l.cidade)}/${esc(l.estado)}">${esc(l.cidade)}/${l.estado}</span></div>
        <div class="pair"><b>Máquina De Interesse</b><span title="${esc(l.maquinainteresse)}">${esc(l.maquinainteresse)}</span></div>
        <div class="pair"><b>Representante</b><span title="${esc(l.representante)}">${esc(l.representante)}</span></div>
        <div class="pair"><b>Revenda</b><span title="${esc(l.revenda)}">${esc(l.revenda)}</span></div>
        <div class="pair"><b>Criado Em</b><span title="${esc(l.criadoem)}">${esc(l.criadoem)}</span></div>
        <div class="pair"><b>Valor</b><span title="${esc(l.valor)}">R$ ${esc(l.valor)}</span></div>
      </div>

      <div class="lead-foot">
        <div class="tag" title="${esc(l.tag)}">${esc(l.tag)}</div>
        <div class="cashback" title="cashback">R$ ${Number(esc(l.cashback)).toFixed(2)}</div>
      </div>
      ${session.role === "revenda" && l.tag === "Assumido" && ["PCI12B"].includes(normalizePci(l.pci)) ? `
      <div class="lead-resultado" data-id="${esc(l.id)}">
        <div class="resultado-actions">
          <button type="button" class="resultado-btn vendido" data-id="${esc(l.id)}" data-resultado="vendido">Vendido</button>
          <button type="button" class="resultado-btn perdido" data-id="${esc(l.id)}" data-resultado="perdido">Perdido</button>
        </div>
        <input type="number" class="valor-venda" data-id="${esc(l.id)}" placeholder="Valor numérico da venda" step="any" min="0" inputmode="decimal">
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
      <div class="lead-foot">
        <div class="tarefa" title="${esc(l.tarefa)}">${esc(l.tarefa)}${esc(l.datatarefa)}</div>
      </div>
    `;
    grid.appendChild(el);
  });
}

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
    console.error("Erro ao Definir Caminho de Venda:", res.status, errData);
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
    alert("Informe um valor numérico válido.");
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
    console.error("Erro ao atualizar resultado:", res.status, errData);
    alert(errData?.error || `Erro ao atualizar resultado (${res.status})`);
    return;
  }

  const resultadoArea = card?.querySelector(".lead-resultado");
  if (resultadoArea) resultadoArea.remove();

  alert(resultado === "vendido" ? "Lead marcado como Vendido." : "Lead marcado como Perdido.");
});
