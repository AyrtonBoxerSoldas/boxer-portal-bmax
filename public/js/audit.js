let AUDIT_USERS = [];
let AUDIT_LOGS = [];
let AUDIT_CURRENT_PAGE = 1;
let AUDIT_HAS_NEXT = false;
let AUDIT_HAS_PREV = false;
let AUDIT_TOTAL = 0;
let AUDIT_PAGE_SIZE = 20;
let AUDIT_LOADED = false;

async function loadAuditUsers() {
    try {
        const token = localStorage.getItem("token");
        const res = await fetch(`${API_URL}/audit/users`, { headers: { Authorization: `Bearer ${token}` } });
        if (!res.ok) throw new Error("Erro ao carregar usuarios de auditoria");
        AUDIT_USERS = await res.json();

        const sel = $("adminLogUserFilter");
        if (sel) {
            sel.innerHTML = '<option value="">Todos os usuarios</option>' +
                AUDIT_USERS.map(u => `<option value="${u.user_id}">${esc(u.username)} (${esc(u.role)})</option>`).join("");
        }
    } catch (e) { console.error(e); toast("Erro ao carregar usuarios de auditoria", "error"); }
}

async function loadAuditLogs(page = 1) {
    try {
        const token = localStorage.getItem("token");
        const userId = $("adminLogUserFilter")?.value || "";
        const params = new URLSearchParams({ page, pageSize: AUDIT_PAGE_SIZE });
        if (userId) params.set("userId", userId);

        const res = await fetch(`${API_URL}/audit?${params}`, { headers: { Authorization: `Bearer ${token}` } });
        if (!res.ok) throw new Error("Erro ao carregar logs de auditoria");
        const data = await res.json();

        AUDIT_LOGS = data.logs || [];
        AUDIT_CURRENT_PAGE = data.currentPage || 1;
        AUDIT_HAS_NEXT = !!data.hasNext;
        AUDIT_HAS_PREV = !!data.hasPrev;
        AUDIT_TOTAL = data.total || 0;

        renderAuditLogs();
        renderAuditPagination();
    } catch (e) { console.error(e); toast("Erro ao carregar logs de auditoria", "error"); }
}

function renderAuditLogs() {
    const wrap = $("adminLogsBody");
    if (!wrap) return;

    const filterVal = ($("adminLogFilter")?.value || "").toLowerCase();
    let filtered = AUDIT_LOGS;
    if (filterVal) {
        filtered = filtered.filter(l =>
            (l.action || "").toLowerCase().includes(filterVal) ||
            (l.entity_type || "").toLowerCase().includes(filterVal) ||
            (l.username || "").toLowerCase().includes(filterVal)
        );
    }

    if (!filtered.length) {
        wrap.innerHTML = '<div class="empty-state">Nenhum log encontrado.</div>';
        return;
    }

    const statusBadge = { success: "status-aprovado", error: "status-pendente", failed: "status-pendente" };

    let html = `<table class="extrato-table">
        <thead><tr>
            <th>Data/Hora</th>
            <th>Usuario</th>
            <th>Role</th>
            <th>Acao</th>
            <th>Entidade</th>
            <th>Status</th>
            <th>IP</th>
            <th>Detalhes</th>
        </tr></thead><tbody>`;

    for (const l of filtered) {
        const data = new Date(l.createdAt).toLocaleString("pt-BR");
        const entidade = l.entity_type ? `${esc(l.entity_type)}${l.entity_id ? " #" + esc(l.entity_id) : ""}` : "—";
        const badgeClass = statusBadge[l.status] || "status-utilizado";

        html += `<tr>
            <td style="white-space:nowrap">${esc(data)}</td>
            <td>${esc(l.username || "—")}</td>
            <td>${esc(l.role || "—")}</td>
            <td>${esc(l.action)}</td>
            <td>${entidade}</td>
            <td><span class="status-badge ${badgeClass}">${esc(l.status)}</span></td>
            <td>${esc(l.ip_address || "—")}</td>
            <td><button class="btn btn-sm" onclick="openAuditDetalhesModal(${l.id})">Ver</button></td>
        </tr>`;
    }
    html += "</tbody></table>";

    const stats = `<div class="admin-stats"><span><strong>${AUDIT_TOTAL}</strong> logs registrados</span></div>`;
    wrap.innerHTML = stats + html;
}

function renderAuditPagination() {
    const wrap = $("adminLogsPagination");
    if (!wrap) return;

    const totalPages = Math.max(1, Math.ceil(AUDIT_TOTAL / AUDIT_PAGE_SIZE));
    wrap.innerHTML = `
        <button class="btn btn-sm" ${AUDIT_HAS_PREV ? "" : "disabled"} onclick="loadAuditLogs(${AUDIT_CURRENT_PAGE - 1})">&larr; Anterior</button>
        <span>Pagina ${AUDIT_CURRENT_PAGE} de ${totalPages}</span>
        <button class="btn btn-sm" ${AUDIT_HAS_NEXT ? "" : "disabled"} onclick="loadAuditLogs(${AUDIT_CURRENT_PAGE + 1})">Proxima &rarr;</button>`;
}

function openAuditDetalhesModal(id) {
    const log = AUDIT_LOGS.find(l => String(l.id) === String(id));
    if (!log) return;

    const modal = $("adminModal");
    const content = $("adminModalContent");
    content.innerHTML = `
        <h3>Detalhes do Log</h3>
        <div class="form-row">
            <label>Metadata</label>
            <pre style="background:var(--bg-alt);padding:12px;border-radius:8px;overflow:auto;max-height:300px;font-size:12px">${esc(JSON.stringify(log.metadata || {}, null, 2))}</pre>
        </div>
        <div class="form-row">
            <label>User Agent</label>
            <p style="font-size:12px;color:var(--muted);word-break:break-all">${esc(log.user_agent || "—")}</p>
        </div>
        <div class="form-actions">
            <button class="btn" onclick="closeAdminModal()">Fechar</button>
        </div>`;
    modal.classList.add("show");
}

// ─── Acessos: quem entrou no Portal e quando ─────────────────
let ACESSOS = { usuarios: [], falhasDesconhecidas: 0 };

async function loadAcessos() {
    const wrap = $("acessosBody");
    if (wrap) wrap.innerHTML = '<div class="empty-state">Carregando...</div>';
    try {
        const token = localStorage.getItem("token");
        const dias = $("acessosPeriodo")?.value || "30";
        const res = await fetch(`${API_URL}/audit/acessos?dias=${dias}`, { headers: { Authorization: `Bearer ${token}` } });
        if (!res.ok) throw new Error("Erro ao carregar acessos");
        ACESSOS = await res.json();
        renderAcessos();
    } catch (e) { console.error(e); toast(e.message || "Erro ao carregar acessos", "error"); }
}

function renderAcessos() {
    const wrap = $("acessosBody");
    if (!wrap) return;
    const busca = ($("acessosBusca")?.value || "").toLowerCase();
    const filtro = $("acessosFiltro")?.value || "";
    let linhas = ACESSOS.usuarios || [];
    if (busca) linhas = linhas.filter(u => (u.username || "").toLowerCase().includes(busca) || (u.revenda || "").toLowerCase().includes(busca));
    if (filtro === "sem-acesso") linhas = linhas.filter(u => !u.acessos);
    if (filtro === "falhas") linhas = linhas.filter(u => u.falhas > 0);

    const fmt = d => d ? new Date(d).toLocaleString("pt-BR") : "—";
    const dias = ACESSOS.dias || 30;
    const comAcesso = (ACESSOS.usuarios || []).filter(u => u.acessos > 0).length;
    const resumo = `<div class="admin-stats">
        <span><strong>${comAcesso}</strong> de ${(ACESSOS.usuarios || []).length} usuarios acessaram nos ultimos ${dias} dias</span>
        <span><strong>${ACESSOS.falhasDesconhecidas || 0}</strong> tentativas com usuario inexistente</span>
    </div>`;

    if (!linhas.length) { wrap.innerHTML = resumo + '<div class="empty-state">Nenhum usuario encontrado.</div>'; return; }

    wrap.innerHTML = resumo + `<table class="extrato-table"><thead><tr>
        <th>Usuario</th><th>Perfil</th><th>Revenda</th><th>Ultimo acesso</th><th style="text-align:right">Acessos (${dias}d)</th><th style="text-align:right">Falhas</th><th>Ultimo IP</th>
    </tr></thead><tbody>${linhas.map(u => `<tr>
        <td>${esc(u.username)}</td>
        <td>${esc(u.role || "—")}</td>
        <td>${esc(u.revenda || "—")}</td>
        <td style="white-space:nowrap">${u.ultimo_acesso_geral ? esc(fmt(u.ultimo_acesso_geral)) : '<span style="color:#e30613">nunca acessou</span>'}</td>
        <td style="text-align:right">${u.acessos}</td>
        <td style="text-align:right;${u.falhas > 0 ? "color:#e30613;font-weight:600" : ""}">${u.falhas}</td>
        <td>${esc(u.ultimo_ip || "—")}</td>
    </tr>`).join("")}</tbody></table>`;
}

async function initAuditLogs() {
    if (AUDIT_LOADED) return;
    AUDIT_LOADED = true;
    await loadAuditUsers();
    await loadAuditLogs(1);
}
