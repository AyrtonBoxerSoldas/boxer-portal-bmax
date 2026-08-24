const SB_SISTEMAS_URL = 'https://bmepxcnrsofofoswubuu.supabase.co';
const SB_SISTEMAS_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJtZXB4Y25yc29mb2Zvc3d1YnV1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk3MTczNzMsImV4cCI6MjA5NTI5MzM3M30.S55ouFczRYlUYNFf5PotYKXBPT5idypTSmbzR-x2Pk0';

let _comCache = { data: null, ts: 0 };
const COM_CACHE_TTL = 10 * 60 * 1000;

async function fetchComTabela() {
    if (_comCache.data && Date.now() - _comCache.ts < COM_CACHE_TTL) return _comCache.data;

    const url = `${SB_SISTEMAS_URL}/rest/v1/comercial_bmax_config?chave=eq.comissao_tabela&select=valor`;
    const res = await fetch(url, {
        headers: {
            'apikey': SB_SISTEMAS_ANON,
            'Authorization': `Bearer ${SB_SISTEMAS_ANON}`
        }
    });

    if (!res.ok) {
        console.error('Erro ao buscar comissao_tabela do boxer-sistemas:', res.status);
        return null;
    }

    const rows = await res.json();
    if (!rows.length) return null;

    const parsed = typeof rows[0].valor === 'string' ? JSON.parse(rows[0].valor) : rows[0].valor;
    _comCache = { data: parsed, ts: Date.now() };
    return parsed;
}

async function lerPlanilhaCashback(pci, role, classepreco) {
    const pciKey = (pci || '').toUpperCase().replace(/\s/g, '');
    const agente = role === 'revenda' ? 'Revenda' : 'Rep';

    const tabela = await fetchComTabela();
    if (!tabela || !tabela.linhas) return 0;

    const linha = tabela.linhas.find(l => l.pci === pciKey && l.agente === agente);
    if (!linha) return 0;

    const idx = classepreco ? parseInt(classepreco, 10) - 1 : 0;
    const val = linha.valores[idx >= 0 && idx < linha.valores.length ? idx : 0];
    if (!val || val <= 0) return 0;

    return val / 100;
}

module.exports = {
    lerPlanilhaCashback
};
