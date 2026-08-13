function renderCadastroFields() {
  const tipo = $("cadTipo").value;
  const campos = $("cadastroCampos");

  if (tipo === "adm") {
    campos.innerHTML = `
      <div class="field">
        <label>Nome</label>
        <input type="text" id="cadNome" placeholder="Nome do Administrador">
      </div>
      <div class="field">
        <label>Senha</label>
        <input type="password" id="cadSenha" placeholder="#Senha12345">
      </div>
    `;
    return;
  }

  if (tipo === "representante") {
    campos.innerHTML = `
      <div class="field">
        <label>Nome</label>
        <input type="text" id="cadNome" placeholder="Nome do Representante">
      </div>
      <div class="field">
        <label>E-mail</label>
        <input type="email" id="cadEmail" placeholder="representante@empresa.com.br">
      </div>
      <div class="field">
        <label>Senha</label>
        <input type="password" id="cadSenha" placeholder="#Senha12345">
      </div>
    `;
    return;
  }

  if (tipo === "revenda") {
    campos.innerHTML = `
      <div class="field">
        <label>E-mail</label>
        <input type="email" id="cadEmail" placeholder="revenda@empresa.com.br">
      </div>
      <div class="field">
        <label>CNPJ</label>
        <input type="text" id="cadCnpj" placeholder="00.000.000/0000-00">
      </div>
      <div class="field">
        <label>Nome</label>
        <input type="text" id="cadNome" placeholder="Nome da Revenda">
      </div>
      <div class="field">
        <label>CEP</label>
        <input type="text" id="cadCep" placeholder="00000-000">
      </div>
      <div class="field">
        <label>Cidade</label>
        <input type="text" id="cadCidade" placeholder="São Paulo">
      </div>
      <div class="field">
        <label>Estado</label>
        <input type="text" id="cadEstado" placeholder="SP">
      </div>
      <div class="field full">
        <label>Senha</label>
        <input type="password" id="cadSenha" placeholder="#Senha12345">
      </div>
    `;
  }
}

$("cadTipo").addEventListener("change", renderCadastroFields);

$("btnSalvarConta").addEventListener("click", async () => {
  const role = $("cadTipo").value;
  const payload = {
    role,
    password: $("cadSenha").value,
    name: $("cadNome")?.value || ""
  };

  if (role === "representante" || role === "revenda") {
    payload.email = $("cadEmail")?.value || "";
  }

  if (role === "revenda") {
    payload.cnpj = $("cadCnpj")?.value || "";
    payload.cep = $("cadCep")?.value || "";
    payload.cidade = $("cadCidade")?.value || "";
    payload.estado = $("cadEstado")?.value || "";
  }

  const token = localStorage.getItem("token");

  const res = await fetch("/api/users", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${token}`
    },
    body: JSON.stringify(payload)
  });

  if (!res.ok) {
    const errData = await res.json().catch(() => null);
    alert(errData?.error || "Erro ao criar conta");
    return;
  }

  await res.json().catch(() => null);
  renderCadastroFields();
  alert("Conta criada com sucesso!");
});
