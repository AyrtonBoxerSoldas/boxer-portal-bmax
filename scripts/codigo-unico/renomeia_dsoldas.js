// Renomeia no RD os cards REVENDA/LOJA "D. SOLDAS" -> "Aldesoldas" (pedido do André, 18/11/2026). Guarda os ids antes.
const P = "C:/Users/andre.coelho.BXSD/BOXER/Dados - Documentos/Comercial/Geral/Estrategia/2026/Projeto BMax/boxer-portal-bmax";
process.chdir(P); require(P + "/node_modules/dotenv").config({ quiet: true });
const fs = require("fs"); const l = require(P + "/src/services/rd.leads.service");
(async () => {
  const opc = await l.getOpcoesRevendaRD(); if (!opc.includes("Aldesoldas")) throw new Error("Aldesoldas não existe no picklist do RD");
  const deals = await l.fetchAllDealsAllPipelines();
  const alvo = deals.filter(d => /^\s*d\.?\s*soldas\s*$/i.test(String(l.getCustomField(d, "REVENDA/LOJA") || ""))).map(d => ({ id: d.id, nome: d.name, valor_antigo: l.getCustomField(d, "REVENDA/LOJA") }));
  fs.writeFileSync("C:/Users/andre.coelho.BXSD/BOXER/Dados - Documentos/Comercial/Geral/Estrategia/2026/Projeto BMax/Documentação/Backups_Banco/cards_d_soldas_ANTES_18-11-2026.json", JSON.stringify(alvo, null, 1));
  console.log("cards a renomear:", alvo.length);
  const r = await l.renomearRevendaNoRD("D. SOLDAS", "Aldesoldas", { maxMs: 45000 });
  console.log("resultado:", JSON.stringify(r).slice(0, 400));
  const depois = await l.fetchAllDealsAllPipelines(); // cache de 60s: força releitura abaixo
  process.exit(0);
})().catch(e => { console.error("ERRO", e.stack || e.message); process.exit(1); });
