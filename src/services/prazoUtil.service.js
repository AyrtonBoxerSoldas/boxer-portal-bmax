// Contagem de prazos SEM fins de semana (André, 14/10/2026): sábado e domingo não contam
// contra a revenda nos prazos de 24h/48h (PCI12 pendente) nem no de 60 dias do PCI12a.
// Dia útil = segunda a sexta no horário de Brasília (UTC-3, sem horário de verão). Feriados
// NÃO são descontados (não há calendário de feriados no sistema).
const BRT_MS = 3 * 3_600_000;

// Horas decorridas entre `inicio` e `fim` descontando sábados e domingos.
function horasUteisEntre(inicio, fim = new Date()) {
    const a = new Date(inicio).getTime();
    const b = new Date(fim).getTime();
    if (!(b > a)) return 0;
    let cur = a - BRT_MS;            // desloca para "relógio de Brasília" e usa getUTC*
    const end = b - BRT_MS;
    let total = 0;
    while (cur < end) {
        const d = new Date(cur);
        const proximaMeiaNoite = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() + 1);
        const fimTrecho = Math.min(proximaMeiaNoite, end);
        const dow = d.getUTCDay();   // 0 = domingo, 6 = sábado
        if (dow !== 0 && dow !== 6) total += fimTrecho - cur;
        cur = fimTrecho;
    }
    return total / 3_600_000;
}

// Dias "úteis" decorridos (24h de dia útil = 1 dia).
const diasUteisEntre = (inicio, fim = new Date()) => horasUteisEntre(inicio, fim) / 24;

module.exports = { horasUteisEntre, diasUteisEntre };
