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
            <th>Acoes</th>
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
        } else if (s.status === "aprovado" && s.codigo_cheque) {
            html += `<td><button class="btn btn-sm" onclick='gerarChequePDF(${JSON.stringify(s).replace(/'/g,"&#39;")})'>Cheque PDF</button></td>`;
        } else {
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
    if (session.role === "representante") {
        const saldoEl = $("statSaldoRevendas");
        const saldoVal = $("statSaldoRevendasVal");
        if (saldoEl) saldoEl.classList.remove("hidden");
        if (saldoVal) {
            saldoVal.textContent = `R$ ${fmtBRL(CASHBACK_SALDO)}`;
            saldoVal.className = CASHBACK_SALDO > 0 ? "cashback-positive" : "";
        }
        return;
    }
    if (session.role !== "revenda") return;
    const el = $("statCashbackVal");
    if (!el) return;
    el.textContent = `R$ ${fmtBRL(CASHBACK_SALDO)}`;
    el.className = CASHBACK_SALDO > 0 ? "cashback-positive" : "";
}

function gerarChequePDF(saque) {
    const tipoLabel = saque.tipo_uso === "desconto" ? "Desconto (max 5% do pedido)" : "Bonificacao (max 10% do pedido)";
    const expiraFormatted = saque.expira_em ? new Date(saque.expira_em).toLocaleDateString("pt-BR") : "N/D";
    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Cheque ${saque.codigo_cheque}</title>
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:Arial,sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh;background:#f0f0f0}
.cheque{width:700px;border:3px solid #1d327b;border-radius:16px;overflow:hidden;background:#fff;box-shadow:0 8px 32px rgba(0,0,0,.15)}
.cheque-header{background:linear-gradient(135deg,#1d327b,#162666);color:#fff;padding:24px 32px;text-align:center}
.cheque-header h1{font-size:22px;margin-bottom:4px}
.cheque-header p{font-size:12px;opacity:.7}
.cheque-body{padding:32px}
.cheque-row{display:flex;justify-content:space-between;padding:12px 0;border-bottom:1px solid #eee}
.cheque-row:last-child{border:none}
.cheque-label{color:#666;font-size:14px}
.cheque-value{font-weight:700;font-size:14px;color:#1a202c}
.cheque-code{font-size:28px;color:#1d327b;text-align:center;padding:20px 0;font-weight:900;letter-spacing:2px}
.cheque-valor{font-size:32px;color:#16a34a;text-align:center;font-weight:900}
.cheque-footer{background:#f7fafc;padding:16px 32px;border-top:2px solid #e2e8f0;font-size:11px;color:#888;text-align:center}
.cheque-validade{color:#e30613;font-weight:700}
@media print{body{background:#fff}@page{margin:1cm}}
</style></head><body>
<div class="cheque">
<div class="cheque-header"><h1>BMAX — Cheque Cashback</h1><p>Programa de Bonificacao Boxer Soldas</p></div>
<div class="cheque-body">
<div class="cheque-code">${esc(saque.codigo_cheque)}</div>
<div class="cheque-valor">R$ ${fmtBRL(saque.valor)}</div>
<div class="cheque-row"><span class="cheque-label">Revenda</span><span class="cheque-value">${esc(saque.revenda)}</span></div>
<div class="cheque-row"><span class="cheque-label">Tipo de Uso</span><span class="cheque-value">${tipoLabel}</span></div>
<div class="cheque-row"><span class="cheque-label">Data de Aprovacao</span><span class="cheque-value">${saque.aprovado_em ? new Date(saque.aprovado_em).toLocaleDateString("pt-BR") : "—"}</span></div>
<div class="cheque-row"><span class="cheque-label">Validade</span><span class="cheque-value cheque-validade">Ate ${expiraFormatted}</span></div>
</div>
<div class="cheque-footer">Insira o codigo <strong>${esc(saque.codigo_cheque)}</strong> no campo Observacao do pedido no ZEN. Este cheque e valido por 30 dias.</div>
</div>
<script>window.onload=function(){window.print()}<\/script>
</body></html>`;
    const w = window.open("", "_blank");
    if (w) { w.document.write(html); w.document.close(); }
    else toast("Popup bloqueado. Permita popups para gerar o cheque.", "error");
}

function showExtratoTab(tab, el) {
    document.querySelectorAll(".extrato-tab-content").forEach(p => p.classList.add("hidden"));
    document.querySelectorAll(".extrato-tab").forEach(t => t.classList.remove("active"));
    $("extrato-" + tab).classList.remove("hidden");
    el.classList.add("active");
}
