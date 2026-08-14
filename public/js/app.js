const session = {
  role: null,
  username: null,
  name: null,
  revenda: null,
  repName: null,
  repRevendas: []
};

function show(screen) {
  $("screenLogin").classList.toggle("hidden", screen !== "login");
  $("screenDash").classList.toggle("hidden", screen !== "dash");
  $("screenCadastro").classList.toggle("hidden", screen !== "cadastro");
  $("screenNegociacoes").classList.toggle("hidden", screen !== "negociacoes");
  $("btnGoLogin").classList.toggle("hidden", screen !== "login");
  $("btnLogout").classList.toggle("hidden", screen === "login");
  $("btnCriarConta").classList.toggle("hidden", !(session.role === "adm" && screen !== "login"));
  $("blocoCamposRepresentante").classList.toggle("hidden", session.role !== "representante");
}

function setWhoAmI(user, access) {
  $("whoami").innerHTML = `<span class="whoami-wrap">
    <span class="dot"></span>
    <b>${esc(user)}</b>
    <span class="sep">&bull;</span>
    <span>${esc(access)}</span>
  </span>`;
}

function setDashHeader() {
  const btnNovaNegociacao = $("btnNovaNegociacao");

  switch (session.role) {
    case "adm":
      $("dashTitle").textContent = "Painel • ADM";
      $("dashSub").textContent = "Visibilidade total: todas as negociacoes e revendas";
      setWhoAmI("Admin", "Acesso total");
      btnNovaNegociacao.classList.remove("hidden");
      break;

    case "representante":
      $("dashTitle").textContent = "Painel • Representante";
      $("dashSub").textContent = "Visibilidade: leads de todas as revendas que o representante atende";
      setWhoAmI("Representante", `Revendas: ${API_LEADS.length}`);
      btnNovaNegociacao.classList.remove("hidden");
      break;

    case "revenda":
      $("dashTitle").textContent = "Painel • Revenda";
      $("dashSub").textContent = "Visibilidade: somente leads que atendem os criterios da revenda";
      setWhoAmI("Revenda", "Minha revenda");
      btnNovaNegociacao.classList.remove("hidden");
      break;

    default:
      btnNovaNegociacao.classList.add("hidden");
      break;
  }
}

function setLoginLoading(loading) {
  $("btnLoginText").classList.toggle("hidden", loading);
  $("btnLoginSpinner").classList.toggle("hidden", !loading);
  $("btnLogin").disabled = loading;
  $("btnLogin").style.opacity = loading ? "0.7" : "1";
}

async function login() {
  const role = $("role").value;
  const user = $("user").value;
  const pass = $("pass").value;

  if (!user || !pass) {
    alert("Informe usuario e senha");
    return;
  }

  setLoginLoading(true);

  try {
    const res = await fetch(`${API_URL}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: user, password: pass, role: role })
    });

    if (!res.ok) {
      const errData = await res.json().catch(() => null);
      alert(errData?.error || errData?.message || "Falha no login");
      setLoginLoading(false);
      return;
    }

    const data = await res.json();
    localStorage.setItem("token", data.token);
    localStorage.setItem("session", JSON.stringify({
      role: role,
      username: user,
      name: data.user.name
    }));
    session.role = role;
    session.username = user;
    session.name = data.user.name;

    show("dash");
    setDashHeader();
    await loadLeads();
    await loadNegociacoes();
    $("filter").value = "all";
    setupFilter();
    setDashHeader();
    render();
  } catch (err) {
    alert("API indisponivel");
  } finally {
    setLoginLoading(false);
  }
}

function logout() {
  localStorage.removeItem("token");
  localStorage.removeItem("session");

  session.role = null;
  session.username = null;
  session.name = null;
  session.revenda = null;
  session.repName = null;
  session.repRevendas = [];
  LEADS_SEM_REVENDA = [];

  $("filter").innerHTML = "";
  $("filter").disabled = false;

  setWhoAmI("Desconectado", "faca login");
  show("login");
}

function restoreSession() {
  const token = localStorage.getItem("token");
  const savedSession = localStorage.getItem("session");

  if (!token || !savedSession) return false;

  const parsed = JSON.parse(savedSession);
  session.role = parsed.role;
  session.username = parsed.username;
  session.name = parsed.name;

  return true;
}

async function init() {
  const ok = restoreSession();

  if (!ok) {
    setWhoAmI("Desconectado", "faca login");
    show("login");
    return;
  }

  show("dash");
  setDashHeader();
  await loadLeads();
  await loadNegociacoes();
  setupFilter();
  setDashHeader();
  render();
  renderNegociacoes();
}

// Events
$("btnLogin").addEventListener("click", login);
$("btnLogout").addEventListener("click", logout);
$("btnGoLogin").addEventListener("click", () => {
  const token = localStorage.getItem("token");
  if (token) {
    logout();
  } else {
    show("login");
  }
  window.scrollTo({ top: 0, behavior: "smooth" });
});
$("btnCriarConta").addEventListener("click", () => {
  renderCadastroFields();
  show("cadastro");
  window.scrollTo({ top: 0, behavior: "smooth" });
});
$("btnNovaNegociacao").addEventListener("click", () => show("negociacoes"));
$("btnVoltarCadastro").addEventListener("click", () => show("dash"));
$("btnVoltarDash").addEventListener("click", () => show("dash"));
$("q").addEventListener("input", render);
$("filter").addEventListener("change", render);
document.addEventListener("keydown", (e) => {
  if (e.key === "Enter" && !$("screenLogin").classList.contains("hidden")) {
    login();
  }
});

renderCadastroFields();
init();
