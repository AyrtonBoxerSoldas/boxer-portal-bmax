const express = require("express");
const { authenticate, authorize } = require("../middlewares/auth");
const { getCachedLeads } = require("../services/cache.service");
const { getLeads, mapDealToCard } = require("../services/rd.leads.service");

const router = express.Router();

router.get(
    "/leads",
    authenticate,
    authorize(["adm"]),
    async (req, res) => {
        try {
            const cacheKey = `adm:${req.user.username}`;
            let cards;
            try {
                cards = await getCachedLeads(cacheKey);
            } catch (_) {}

            if (!cards) {
                const leads = await getLeads(req.user.username, "adm");
                cards = await Promise.all(leads.map(l => mapDealToCard(l, "adm")));
            }

            if (!cards || !cards.length) {
                return res.status(404).json({ error: "Nenhum lead encontrado" });
            }

            const headers = ["Nome", "CNPJ", "Cidade", "Estado", "Revenda", "Representante", "PCI", "Maquina", "Valor", "Cashback", "Status", "Criado em"];
            const rows = cards.map(l => [
                l.nome || "",
                l.cnpj || "",
                l.cidade || "",
                l.estado || "",
                l.revenda || "",
                l.representante || "",
                l.pci || "",
                l.maquinainteresse || "",
                l.valor || "",
                l.cashback || 0,
                l.tag || "",
                l.criadoem || ""
            ]);

            let csv = "﻿";
            csv += headers.join(";") + "\n";
            rows.forEach(r => {
                csv += r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(";") + "\n";
            });

            res.setHeader("Content-Type", "text/csv; charset=utf-8");
            res.setHeader("Content-Disposition", 'attachment; filename="leads_bmax.csv"');
            res.send(csv);
        } catch (err) {
            console.error("Erro export:", err);
            res.status(500).json({ error: "Falha ao exportar leads" });
        }
    }
);

module.exports = router;
