const express = require("express");
const { REPRESENTANTES, RESPONSAVEIS, PCI_POR_CAMINHO } = require("../config/constants");

const router = express.Router();

const SB_SISTEMAS_URL = 'https://bmepxcnrsofofoswubuu.supabase.co';
const SB_SISTEMAS_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJtZXB4Y25yc29mb2Zvc3d1YnV1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk3MTczNzMsImV4cCI6MjA5NTI5MzM3M30.S55ouFczRYlUYNFf5PotYKXBPT5idypTSmbzR-x2Pk0';

const PCIS = [
    "PCI 1", "PCI 2", "PCI 3", "PCI 4", "PCI 5",
    "PCI 6", "PCI 7", "PCI 8", "PCI 9", "PCI 10",
    "PCI 11", "PCI 12", "PCI 13", "PCI 14", "PCI 15"
];

const CAMINHOS = Object.keys(PCI_POR_CAMINHO);

let _revendasCache = { data: null, ts: 0 };
const REVENDAS_TTL = 30 * 60 * 1000;

async function fetchRevendasBmax() {
    if (_revendasCache.data && Date.now() - _revendasCache.ts < REVENDAS_TTL) return _revendasCache.data;
    try {
        const url = `${SB_SISTEMAS_URL}/rest/v1/comercial_revendas_bmax?ativo=eq.true&select=id,nome,cidade,estado,classe&order=nome`;
        const res = await fetch(url, {
            headers: { 'apikey': SB_SISTEMAS_ANON, 'Authorization': `Bearer ${SB_SISTEMAS_ANON}` }
        });
        if (!res.ok) return [];
        const rows = await res.json();
        _revendasCache = { data: rows, ts: Date.now() };
        return rows;
    } catch { return []; }
}

router.get("/", async (req, res) => {
    const revendas = await fetchRevendasBmax();
    res.json({
        representantes: REPRESENTANTES,
        responsaveis: RESPONSAVEIS,
        pcis: PCIS,
        caminhos: CAMINHOS,
        revendas
    });
});

module.exports = router;
