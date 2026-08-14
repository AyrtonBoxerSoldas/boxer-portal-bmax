let negociacoes = [];

async function loadNegociacoes() {
  try {
    const token = localStorage.getItem("token");

    const res = await fetch(`${API_URL}/negociacoes`, {
      headers: { Authorization: `Bearer ${token}` }
    });

    if (!res.ok) throw new Error("Erro ao carregar negociações");

    negociacoes = await res.json();
    renderNegociacoes();
  } catch (err) {
    console.error(err);
  }
}

function renderNegociacoes() {
  const grid = $("gridNegociacoes");
  grid.innerHTML = "";

  negociacoes.forEach(n => {
    const el = document.createElement("div");
    el.className = "lead";

    el.innerHTML = `
      <div class="lead-top">
        <div class="lead-title">
          <h4>${esc(n.nome)}</h4>
          <div class="subline">${esc(n.cnpj)}</div>
        </div>
      </div>

      <div class="meta">
        <div class="pair"><b>Cidade</b><span>${esc(n.cidade)}</span></div>
        <div class="pair"><b>Máquina</b><span>${esc(n.maquina)}</span></div>
        <div class="pair"><b>Revenda</b><span>${esc(n.revenda)}</span></div>
        <div class="pair"><b>Representante</b><span>${esc(n.representante || "Não informado")}</span></div>
      </div>
    `;

    grid.appendChild(el);
  });
}

$("btnSalvarNegociacao").addEventListener("click", async () => {
  const novaNegociacao = {
    cnpj: $("negCnpj").value,
    cep: $("negCep").value,
    nome: $("negNome").value,
    cidade: $("negCidade").value,
    maquinainteresse: $("negMaquina").value,
    usuario: session.username
  };

  if (!novaNegociacao.nome.trim()) return alert("Informe o Nome do Cliente.");
  if (!novaNegociacao.cnpj.trim()) return alert("Informe o CNPJ.");
  if (!novaNegociacao.cidade.trim()) return alert("Informe a Cidade.");

  if (session.role === "revenda") {
    novaNegociacao.revenda = session.name;
  } else {
    novaNegociacao.revenda = $("negRevenda").value;
  }

  if (session.role === "representante") {
    if (!$("negRepresentante").value) return alert("Selecione um Representante.");
    if (!$("negResponsavel").value) return alert("Selecione um Responsável.");
    if (!$("negPci").value) return alert("Selecione um PCI.");
    novaNegociacao.representante = $("negRepresentante").value;
    novaNegociacao.responsavel = $("negResponsavel").value;
    novaNegociacao.pci = $("negPci").value;
  }

  const token = localStorage.getItem("token");

  const res = await fetch("/api/negociacoes", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${token}`
    },
    body: JSON.stringify(novaNegociacao)
  });

  if (!res.ok) {
    if (res.status === 400) {
      const errData = await res.json().catch(() => null);
      alert(errData?.error || "Dados inválidos para a negociação");
      return;
    }

    const errData = await res.json().catch(() => null);
    alert(errData?.error || "Erro ao salvar negociação");
    return;
  }

  await res.json();
  loadNegociacoes();

  $("negCnpj").value = "";
  $("negCep").value = "";
  $("negNome").value = "";
  $("negCidade").value = "";
  $("negMaquina").value = "";
  $("negRepresentante").value = "";
  $("negResponsavel").value = "";
  $("negRevenda").value = "";
  $("negPci").value = "";

  alert("Negociação Registrada!");
});
