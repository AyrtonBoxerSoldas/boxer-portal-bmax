let ADMIN_REVENDAS = [];
let ADMIN_USERS = [];
let ADMIN_GRUPOS = [];

async function loadAdminRevendas() {
    try {
        const token = localStorage.getItem("token");
        const res = await fetch(`${API_URL}/admin/revendas-rd`, { headers: { Authorization: `Bearer ${token}` } });
        if (!res.ok) throw new Error("Erro ao carregar revendas");
        ADMIN_REVENDAS = await res.json();
    } catch (e) { console.error(e); toast("Erro ao carregar revendas RD", "error"); }
}

async function loadAdminUsers() {
    try {
        const token = localStorage.getItem("token");
        const res = await fetch(`${API_URL}/admin/users`, { headers: { Authorization: `Bearer ${token}` } });
        if (!res.ok) throw new Error("Erro ao carregar usuarios");
        ADMIN_USERS = await res.json();
    } catch (e) { console.error(e); toast("Erro ao carregar usuarios", "error"); }
}

async function loadAdminGrupos() {
    try {
        const token = localStorage.getItem("token");
        const res = await fetch(`${API_URL}/admin/grupos`, { headers: { Authorization: `Bearer ${token}` } });
        if (!res.ok) throw new Error("Erro ao carregar grupos");
        ADMIN_GRUPOS = await res.json();
    } catch (e) { console.error(e); }
}

function renderAdminRevendas() {
    const wrap = $("adminRevendasBody");
    if (!wrap) return;

    const filterVal = ($("adminRevendaFilter")?.value || "").toLowerCase();
    const grupoFilter = $("adminGrupoFilter")?.value || "all";

    let filtered = ADMIN_REVENDAS;
    if (filterVal) filtered = filtered.filter(r => r.nome.toLowerCase().includes(filterVal));
    if (grupoFilter === "sem-grupo") filtered = filtered.filter(r => !r.grupo);
    else if (grupoFilter === "com-grupo") filtered = filtered.filter(r => !!r.grupo);
    else if (grupoFilter !== "all") filtered = filtered.filter(r => r.grupo === grupoFilter);

    const gruposDistintos = [...new Set(ADMIN_REVENDAS.filter(r => r.grupo).map(r => r.grupo))].sort();

    const grupoSelect = $("adminGrupoFilter");
    if (grupoSelect && grupoSelect.options.length <= 3) {
        gruposDistintos.forEach(g => {
            const opt = document.createElement("option");
            opt.value = g; opt.textContent = g;
            grupoSelect.appendChild(opt);
        });
    }

    if (!filtered.length) {
        wrap.innerHTML = '<div class="empty-state">Nenhuma revenda encontrada.</div>';
        return;
    }

    let html = `<table class="extrato-table">
        <thead><tr>
            <th>Revenda (RD Station)</th>
            <th>Grupo</th>
            <th>Email Responsavel</th>
            <th>Acoes</th>
        </tr></thead><tbody>`;

    for (const r of filtered) {
        html += `<tr>
            <td><strong>${esc(r.nome)}</strong></td>
            <td>${r.grupo ? `<span class="tipo-badge credito">${esc(r.grupo)}</span>` : '<span style="color:var(--muted)">—</span>'}</td>
            <td>${r.email_responsavel ? esc(r.email_responsavel) : '<span style="color:var(--muted)">—</span>'}</td>
            <td><button class="btn btn-sm" onclick="openGrupoModal('${esc(r.nome)}','${esc(r.grupo || "")}','${esc(r.email_responsavel || "")}')">Editar</button></td>
        </tr>`;
    }
    html += "</tbody></table>";

    const stats = `<div class="admin-stats">
        <span><strong>${ADMIN_REVENDAS.length}</strong> revendas no RD</span>
        <span><strong>${ADMIN_REVENDAS.filter(r => r.grupo).length}</strong> com grupo</span>
        <span><strong>${ADMIN_REVENDAS.filter(r => !r.grupo).length}</strong> sem grupo</span>
        <span><strong>${gruposDistintos.length}</strong> grupos</span>
    </div>`;

    wrap.innerHTML = stats + html;
}

function openGrupoModal(revenda, grupo, email) {
    const modal = $("adminModal");
    const content = $("adminModalContent");
    content.innerHTML = `
        <h3>Configurar Grupo</h3>
        <div class="form-row">
            <label>Revenda (RD)</label>
            <input type="text" id="modalRevenda" value="${esc(revenda)}" readonly style="background:var(--bg-alt);color:var(--muted)">
        </div>
        <div class="form-row">
            <label>Grupo Comercial</label>
            <input type="text" id="modalGrupo" value="${esc(grupo)}" placeholder="Ex: Luitex, Ferrox..." list="gruposSugestao">
            <datalist id="gruposSugestao">${[...new Set(ADMIN_REVENDAS.filter(r=>r.grupo).map(r=>r.grupo))].map(g=>`<option value="${esc(g)}">`).join("")}</datalist>
        </div>
        <div class="form-row">
            <label>Email Responsavel</label>
            <input type="email" id="modalEmail" value="${esc(email)}" placeholder="usuario@empresa.com.br" list="emailsSugestao">
            <datalist id="emailsSugestao">${ADMIN_USERS.filter(u=>u.role==="revenda").map(u=>`<option value="${esc(u.username)}">`).join("")}</datalist>
        </div>
        <div class="form-actions">
            <button class="btn" onclick="closeAdminModal()">Cancelar</button>
            <button class="btn primary" onclick="salvarGrupo()">Salvar</button>
        </div>`;
    modal.classList.add("show");
}

async function salvarGrupo() {
    const revenda_rd = $("modalRevenda").value;
    const grupo = $("modalGrupo").value.trim();
    const email_responsavel = $("modalEmail").value.trim();

    try {
        const token = localStorage.getItem("token");
        const res = await fetch(`${API_URL}/admin/grupos`, {
            method: "POST",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
            body: JSON.stringify({ revenda_rd, grupo, email_responsavel })
        });
        if (!res.ok) { const e = await res.json(); throw new Error(e.error); }

        const idx = ADMIN_REVENDAS.findIndex(r => r.nome === revenda_rd);
        if (idx >= 0) {
            ADMIN_REVENDAS[idx].grupo = grupo || null;
            ADMIN_REVENDAS[idx].email_responsavel = email_responsavel || null;
        }

        closeAdminModal();
        renderAdminRevendas();
        toast("Grupo salvo com sucesso!");
    } catch (e) {
        toast(e.message || "Erro ao salvar", "error");
    }
}

function renderAdminUsers() {
    const wrap = $("adminUsersBody");
    if (!wrap) return;

    const filterVal = ($("adminUserFilter")?.value || "").toLowerCase();
    const roleFilter = $("adminRoleFilter")?.value || "all";

    let filtered = ADMIN_USERS;
    if (filterVal) filtered = filtered.filter(u => u.username.toLowerCase().includes(filterVal) || (u.revenda || "").toLowerCase().includes(filterVal) || (u.email || "").toLowerCase().includes(filterVal));
    if (roleFilter !== "all") filtered = filtered.filter(u => u.role === roleFilter);

    const counts = { adm: 0, representante: 0, revenda: 0 };
    ADMIN_USERS.forEach(u => counts[u.role]++);

    let html = `<div class="admin-stats">
        <span><strong>${ADMIN_USERS.length}</strong> usuarios</span>
        <span><strong>${counts.adm}</strong> admins</span>
        <span><strong>${counts.representante}</strong> representantes</span>
        <span><strong>${counts.revenda}</strong> revendas</span>
    </div>`;

    html += `<table class="extrato-table">
        <thead><tr>
            <th>ID</th>
            <th>Login</th>
            <th>Tipo</th>
            <th>Detalhes</th>
            <th>Grupo</th>
            <th>Acoes</th>
        </tr></thead><tbody>`;

    for (const u of filtered) {
        let detalhes = "";
        if (u.role === "revenda") detalhes = `${esc(u.revenda || "?")} — ${esc(u.cidade || "")}/${esc(u.estado || "")} — CNPJ: ${esc(u.cnpj || "")}`;
        else if (u.role === "representante") detalhes = esc(u.email || "");
        else detalhes = "—";

        const roleBadge = { adm: "status-aprovado", representante: "status-pendente", revenda: "status-utilizado" }[u.role] || "";

        html += `<tr>
            <td>${u.id}</td>
            <td><strong>${esc(u.username)}</strong></td>
            <td><span class="status-badge ${roleBadge}">${u.role}</span></td>
            <td style="font-size:12px">${detalhes}</td>
            <td>${u.grupo ? `<span class="tipo-badge credito">${esc(u.grupo)}</span>` : '<span style="color:var(--muted)">—</span>'}</td>
            <td style="white-space:nowrap">
                <button class="btn btn-sm" onclick="openResetSenhaModal(${u.id},'${esc(u.username)}')">Senha</button>
                <button class="btn btn-sm btn-danger" onclick="deleteUser(${u.id},'${esc(u.username)}')">Excluir</button>
            </td>
        </tr>`;
    }
    html += "</tbody></table>";
    wrap.innerHTML = html;
}

function openResetSenhaModal(id, username) {
    const modal = $("adminModal");
    const content = $("adminModalContent");
    content.innerHTML = `
        <h3>Resetar Senha</h3>
        <p style="margin-bottom:12px;color:var(--muted)">Usuario: <strong>${esc(username)}</strong></p>
        <div class="form-row">
            <label>Nova Senha</label>
            <input type="text" id="modalNovaSenha" placeholder="Minimo 6 caracteres">
        </div>
        <div class="form-actions">
            <button class="btn" onclick="closeAdminModal()">Cancelar</button>
            <button class="btn primary" onclick="resetSenha(${id})">Salvar</button>
        </div>`;
    modal.classList.add("show");
}

async function resetSenha(id) {
    const password = $("modalNovaSenha").value;
    if (!password || password.length < 6) { toast("Senha deve ter no minimo 6 caracteres", "error"); return; }

    try {
        const token = localStorage.getItem("token");
        const res = await fetch(`${API_URL}/admin/users/${id}/reset-password`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
            body: JSON.stringify({ password })
        });
        if (!res.ok) { const e = await res.json(); throw new Error(e.error); }
        closeAdminModal();
        toast("Senha atualizada!");
    } catch (e) {
        toast(e.message || "Erro ao resetar senha", "error");
    }
}

async function deleteUser(id, username) {
    if (!confirm(`Excluir usuario "${username}"? Esta acao nao pode ser desfeita.`)) return;

    try {
        const token = localStorage.getItem("token");
        const res = await fetch(`${API_URL}/admin/users/${id}`, {
            method: "DELETE",
            headers: { Authorization: `Bearer ${token}` }
        });
        if (!res.ok) { const e = await res.json(); throw new Error(e.error); }

        ADMIN_USERS = ADMIN_USERS.filter(u => u.id !== id);
        renderAdminUsers();
        toast("Usuario excluido!");
    } catch (e) {
        toast(e.message || "Erro ao excluir", "error");
    }
}

function openCriarUsuarioModal() {
    const modal = $("adminModal");
    const content = $("adminModalContent");

    const gruposDistintos = [...new Set(ADMIN_REVENDAS.filter(r => r.grupo).map(r => r.grupo))].sort();

    content.innerHTML = `
        <h3>Novo Usuario</h3>
        <div class="form-row">
            <label>Tipo</label>
            <select id="modalNovoTipo" onchange="toggleModalCampos()">
                <option value="revenda">Revenda</option>
                <option value="representante">Representante</option>
                <option value="adm">ADM</option>
            </select>
        </div>
        <div class="form-row">
            <label>Nome / Username</label>
            <input type="text" id="modalNovoNome" placeholder="Nome">
        </div>
        <div class="form-row" id="modalCampoEmail">
            <label>Email</label>
            <input type="email" id="modalNovoEmail" placeholder="usuario@empresa.com.br">
        </div>
        <div class="form-row">
            <label>Senha</label>
            <input type="text" id="modalNovoSenha" placeholder="Minimo 6 caracteres">
        </div>
        <div id="modalCamposRevenda">
            <div class="form-row">
                <label>CNPJ</label>
                <input type="text" id="modalNovoCnpj" placeholder="00000000000000">
            </div>
            <div class="form-row" style="display:grid;grid-template-columns:2fr 1fr;gap:8px">
                <div><label>Cidade</label><input type="text" id="modalNovoCidade" placeholder="Cidade"></div>
                <div><label>Estado</label><input type="text" id="modalNovoEstado" placeholder="SP" maxlength="2"></div>
            </div>
            <div class="form-row">
                <label>CEP</label>
                <input type="text" id="modalNovoCep" placeholder="00000000">
            </div>
            <div class="form-row">
                <label>Grupo Comercial</label>
                <select id="modalNovoGrupo">
                    <option value="">Sem grupo</option>
                    ${gruposDistintos.map(g => `<option value="${esc(g)}">${esc(g)}</option>`).join("")}
                </select>
            </div>
        </div>
        <div class="form-actions">
            <button class="btn" onclick="closeAdminModal()">Cancelar</button>
            <button class="btn primary" onclick="criarUsuario()">Criar</button>
        </div>`;
    modal.classList.add("show");
}

function toggleModalCampos() {
    const tipo = $("modalNovoTipo").value;
    const revFields = $("modalCamposRevenda");
    const emailField = $("modalCampoEmail");
    if (revFields) revFields.style.display = tipo === "revenda" ? "block" : "none";
    if (emailField) emailField.style.display = tipo === "adm" ? "none" : "block";
}

async function criarUsuario() {
    const role = $("modalNovoTipo").value;
    const name = $("modalNovoNome").value.trim();
    const email = $("modalNovoEmail")?.value?.trim() || "";
    const password = $("modalNovoSenha").value;

    if (!name || !password) { toast("Nome e senha sao obrigatorios", "error"); return; }
    if (password.length < 6) { toast("Senha minimo 6 caracteres", "error"); return; }

    const payload = { role, name, password };
    if (role !== "adm") payload.email = email;

    if (role === "revenda") {
        payload.cnpj = ($("modalNovoCnpj")?.value || "").replace(/\D/g, "");
        payload.cep = ($("modalNovoCep")?.value || "").replace(/\D/g, "");
        payload.cidade = $("modalNovoCidade")?.value?.trim() || "";
        payload.estado = ($("modalNovoEstado")?.value?.trim() || "").toUpperCase();
        if (!payload.cnpj || !payload.cep || !payload.cidade || !payload.estado || !email) {
            toast("Preencha todos os campos da revenda", "error"); return;
        }
    }

    try {
        const token = localStorage.getItem("token");
        const res = await fetch(`${API_URL}/users`, {
            method: "POST",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
            body: JSON.stringify(payload)
        });
        if (!res.ok) { const e = await res.json(); throw new Error(e.error); }
        const created = await res.json();

        const grupo = $("modalNovoGrupo")?.value;
        if (role === "revenda" && grupo) {
            await fetch(`${API_URL}/admin/users/${created.id}/grupo`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
                body: JSON.stringify({ grupo })
            });
        }

        closeAdminModal();
        await loadAdminUsers();
        renderAdminUsers();
        toast("Usuario criado!");
    } catch (e) {
        toast(e.message || "Erro ao criar usuario", "error");
    }
}

function closeAdminModal() {
    $("adminModal").classList.remove("show");
}

function showAdminTab(tab, el) {
    document.querySelectorAll(".admin-tab-content").forEach(p => p.classList.add("hidden"));
    document.querySelectorAll(".admin-tab").forEach(t => t.classList.remove("active"));
    document.getElementById("admin-" + tab).classList.remove("hidden");
    el.classList.add("active");
}

async function initGestao() {
    await Promise.all([loadAdminRevendas(), loadAdminUsers(), loadAdminGrupos()]);
    renderAdminRevendas();
    renderAdminUsers();
}
