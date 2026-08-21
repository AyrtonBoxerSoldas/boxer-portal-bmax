let CASHBACK_EXTRATO = [];
let CASHBACK_SALDO = 0;
let CASHBACK_SAQUES = [];
let CASHBACK_EXPIRANDO = [];

function fmtBRL(v) { return Number(v).toLocaleString("pt-BR", {minimumFractionDigits:2, maximumFractionDigits:2}); }

async function loadCashbackSaldo() {
    try {
        const token = localStorage.getItem("token");
        const res = await fetch(`${API_URL}/cashback/saldo`, {
            headers: { Authorization: `Bearer ${token}` }
        });
        if (!res.ok) return 0;
        const data = await res.json();
        CASHBACK_SALDO = data.saldo || 0;
        return CASHBACK_SALDO;
    } catch (e) { return 0; }
}

async function loadCashbackExtrato() {
    try {
        const token = localStorage.getItem("token");
        const res = await fetch(`${API_URL}/cashback/extrato`, {
            headers: { Authorization: `Bearer ${token}` }
        });
        if (!res.ok) return;
        const data = await res.json();
        CASHBACK_SALDO = data.saldo || 0;
        CASHBACK_EXTRATO = data.transacoes || [];
    } catch (e) {
        console.error("Erro ao carregar extrato:", e);
    }
}

async function loadCashbackExpirando() {
    try {
        const token = localStorage.getItem("token");
        const res = await fetch(`${API_URL}/cashback/expirando`, {
            headers: { Authorization: `Bearer ${token}` }
        });
        if (!res.ok) return;
        CASHBACK_EXPIRANDO = await res.json();
    } catch (e) {
        console.error("Erro ao carregar expirando:", e);
    }
}

async function loadCashbackSaques() {
    try {
        const token = localStorage.getItem("token");
        const res = await fetch(`${API_URL}/cashback/saques`, {
            headers: { Authorization: `Bearer ${token}` }
        });
        if (!res.ok) return;
        CASHBACK_SAQUES = await res.json();
    } catch (e) {
        console.error("Erro ao carregar saques:", e);
    }
}

function renderExtrato() {
    const wrap = $("extratoBody");
    if (!wrap) return;

    const saldoEl = $("extratoSaldo");
    if (saldoEl) saldoEl.textContent = `R$ ${fmtBRL(CASHBACK_SALDO)}`;

    if (!CASHBACK_EXTRATO.length) {
        wrap.innerHTML = '<div class="empty-state">Nenhuma movimentacao registrada.</div>';
        return;
    }

    let html = `<table class="extrato-table">
        <thead><tr>
            <th>Data</th>
            <th>Tipo</th>
            <th>Descricao</th>
            <th style="text-align:right">Valor</th>
            <th style="text-align:right">Saldo</th>
        </tr></thead><tbody>`;

    for (const t of CASHBACK_EXTRATO) {
        const data = new Date(t.criado_em).toLocaleDateString("pt-BR");
        const isCredito = t.tipo === "credito";
        const cls = isCredito ? "extrato-credito" : "extrato-debito";
        const sinal = isCredito ? "+" : "-";
        const expira = t.expira_em ? ` <span class="expira-tag">exp ${new Date(t.expira_em).toLocaleDateString("pt-BR")}</span>` : "";

        html += `<tr class="${cls}">
            <td>${data}</td>
            <td><span class="tipo-badge ${t.tipo}">${t.tipo}</span></td>
            <td>${esc(t.descricao || "")}${expira}</td>
            <td style="text-align:right;font-weight:600">${sinal} R$ ${fmtBRL(t.valor)}</td>
            <td style="text-align:right;color:#718096">R$ ${fmtBRL(t.saldo_apos)}</td>
        </tr>`;
    }
    html += "</tbody></table>";
    wrap.innerHTML = html;
}

function renderSaques() {
    const wrap = $("saquesBody");
    if (!wrap) return;

    if (!CASHBACK_SAQUES.length) {
        wrap.innerHTML = '<div class="empty-state">Nenhum saque registrado.</div>';
        return;
    }

    const isRep = session.role === "representante" || session.role === "adm";

    let html = `<table class="extrato-table">
        <thead><tr>
            <th>Data</th>
            ${isRep ? "<th>Revenda</th>" : ""}
            <th>Valor</th>
            <th>Tipo</th>
            <th>Status</th>
            <th>Codigo</th>
            ${isRep ? "<th>Acoes</th>" : ""}
        </tr></thead><tbody>`;

    for (const s of CASHBACK_SAQUES) {
        const data = new Date(s.criado_em).toLocaleDateString("pt-BR");
        const tipoLabel = s.tipo_uso === "desconto" ? "Desconto 5%" : "Bonificacao 10%";
        const statusCls = {
            pendente: "status-pendente", aprovado: "status-aprovado",
            recusado: "status-recusado", utilizado: "status-utilizado", expirado: "status-expirado"
        }[s.status] || "";

        html += `<tr>
            <td>${data}</td>
            ${isRep ? `<td>${esc(s.revenda || "")}</td>` : ""}
            <td style="font-weight:600">R$ ${fmtBRL(s.valor)}</td>
            <td>${tipoLabel}</td>
            <td><span class="status-badge ${statusCls}">${s.status}</span></td>
            <td>${s.codigo_cheque ? `<code>${esc(s.codigo_cheque)}</code>` : "-"}</td>`;

        if (isRep && s.status === "pendente") {
            html += `<td>
                <button class="btn btn-sm btn-approve" onclick="aprovarSaque('${s.id}')">Aprovar</button>
                <button class="btn btn-sm btn-reject" onclick="recusarSaque('${s.id}')">Recusar</button>
            </td>`;
        } else if (isRep) {
            html += `<td>-</td>`;
        }
        html += "</tr>";
    }
    html += "</tbody></table>";
    wrap.innerHTML = html;
}

function openSaqueModal() {
    const modal = $("saqueModal");
    if (modal) modal.classList.add("show");
    $("saqueValor").value = "";
    $("saqueTipo").value = "desconto";
}

function closeSaqueModal() {
    const modal = $("saqueModal");
    if (modal) modal.classList.remove("show");
}

async function submitSaque() {
    const valor = parseFloat($("saqueValor").value);
    const tipo = $("saqueTipo").value;

    if (!valor || valor <= 0) { toast("Informe um valor valido", "warn"); return; }
    if (valor > CASHBACK_SALDO) { toast(`Saldo insuficiente. Disponivel: R$ ${fmtBRL(CASHBACK_SALDO)}`, "error"); return; }

    const btn = $("btnSubmitSaque");
    btnLoading(btn, true);
    try {
        const token = localStorage.getItem("token");
        const res = await fetch(`${API_URL}/cashback/saques`, {
            method: "POST",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
            body: JSON.stringify({ valor, tipo_uso: tipo })
        });
        const data = await res.json();
        if (!res.ok) { toast(data.error || "Erro ao solicitar saque", "error"); return; }
        toast("Saque solicitado! Aguarde aprovacao do representante.");
        closeSaqueModal();
        await refreshCashback();
    } catch (e) {
        toast("Erro de conexao", "error");
    } finally {
        btnLoading(btn, false);
    }
}

async function aprovarSaque(id) {
    if (!confirm("Aprovar este saque?")) return;
    try {
        const token = localStorage.getItem("token");
        const res = await fetch(`${API_URL}/cashback/saques/${id}/aprovar`, {
            method: "POST",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` }
        });
        const data = await res.json();
        if (!res.ok) { toast(data.error || "Erro ao aprovar", "error"); return; }
        toast(`Saque aprovado! Cheque: ${data.codigo_cheque}`);
        await refreshCashback();
    } catch (e) {
        toast("Erro de conexao", "error");
    }
}

async function recusarSaque(id) {
    const motivo = prompt("Motivo da recusa (opcional):");
    try {
        const token = localStorage.getItem("token");
        const res = await fetch(`${API_URL}/cashback/saques/${id}/recusar`, {
            method: "POST",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
            body: JSON.stringify({ motivo: motivo || "" })
        });
        if (!res.ok) { const d = await res.json(); toast(d.error || "Erro", "error"); return; }
        toast("Saque recusado.");
        await refreshCashback();
    } catch (e) {
        toast("Erro de conexao", "error");
    }
}

function renderExpirando() {
    const container = $("extratoExpirando");
    if (!container) return;
    if (!CASHBACK_EXPIRANDO.length) { container.classList.add("hidden"); return; }

    container.classList.remove("hidden");
    const total = CASHBACK_EXPIRANDO.reduce((s, c) => s + Number(c.valor), 0);
    let html = `<div class="expirando-header"><span class="alert-icon" style="color:#e30613">⚠</span> <strong>R$ ${fmtBRL(total)}</strong> em creditos expirando nos proximos 30 dias</div><ul class="expirando-list">`;
    for (const c of CASHBACK_EXPIRANDO) {
        const dias = Math.ceil((new Date(c.expira_em) - Date.now()) / (24 * 60 * 60 * 1000));
        html += `<li><span class="expirando-valor">R$ ${fmtBRL(c.valor)}</span> — ${esc(c.descricao || "")} — <span class="expirando-dias ${dias <= 15 ? "urgente" : ""}">${dias} dias restantes</span></li>`;
    }
    html += "</ul>";
    container.innerHTML = html;
}

async function refreshCashback() {
    await Promise.all([loadCashbackExtrato(), loadCashbackSaques(), loadCashbackExpirando()]);
    renderExtrato();
    renderSaques();
    renderExpirando();
}

function updateDashCashback() {
    if (session.role !== "revenda") return;
    const el = $("statCashbackVal");
    if (!el) return;
    el.textContent = `R$ ${fmtBRL(CASHBACK_SALDO)}`;
    el.className = CASHBACK_SALDO > 0 ? "cashback-positive" : "";
}

function showExtratoTab(tab, el) {
    document.querySelectorAll(".extrato-tab-content").forEach(p => p.classList.add("hidden"));
    document.querySelectorAll(".extrato-tab").forEach(t => t.classList.remove("active"));
    $("extrato-" + tab).classList.remove("hidden");
    el.classList.add("active");
}
