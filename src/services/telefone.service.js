// Normaliza telefone brasileiro para o formato do WhatsApp (E.164: +55 + DDD + celular de 9 dígitos).
// O WhatsApp só entrega em celular; número fixo ou de 10 dígitos é recusado com o motivo.
function normalizarCelularBR(raw) {
    let d = String(raw ?? "").replace(/\D/g, "");
    if (!d) return { valido: false, e164: null, nacional: null, motivo: "vazio" };
    if (d.startsWith("0055")) d = d.slice(4);
    else if (d.startsWith("55") && d.length >= 12) d = d.slice(2);
    d = d.replace(/^0+/, "");
    if (d.length === 11) {
        const ddd = Number(d.slice(0, 2));
        if (ddd < 11 || ddd > 99 || d[2] !== "9") return { valido: false, e164: null, nacional: null, motivo: "11 dígitos mas não parece celular (falta o 9 depois do DDD)" };
        return { valido: true, e164: "+55" + d, nacional: `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`, motivo: null };
    }
    if (d.length === 10) return { valido: false, e164: null, nacional: null, motivo: "10 dígitos: parece telefone fixo ou celular sem o 9" };
    return { valido: false, e164: null, nacional: null, motivo: `${d.length} dígitos (esperado DDD + 9 dígitos)` };
}

module.exports = { normalizarCelularBR };
