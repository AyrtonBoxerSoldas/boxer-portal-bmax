const express = require("express");
const { REPRESENTANTES, RESPONSAVEIS, PCI_POR_CAMINHO } = require("../config/constants");

const router = express.Router();

const PCIS = [
    "PCI 1", "PCI 2", "PCI 3", "PCI 4", "PCI 5",
    "PCI 6", "PCI 7", "PCI 8", "PCI 9", "PCI 10",
    "PCI 11", "PCI 12", "PCI 13", "PCI 14", "PCI 15"
];

const CAMINHOS = Object.keys(PCI_POR_CAMINHO);

let cached = null;

router.get("/", (req, res) => {
    if (!cached) {
        cached = {
            representantes: REPRESENTANTES,
            responsaveis: RESPONSAVEIS,
            pcis: PCIS,
            caminhos: CAMINHOS
        };
    }
    res.json(cached);
});

module.exports = router;
