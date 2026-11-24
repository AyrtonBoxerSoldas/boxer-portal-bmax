// Acrescenta a opção "PCI X" (produto não BMax) ao picklist PERFIL PCI do RD. Faz backup das opções antes.
// Uso: node scripts/codigo-unico/add_pci_x_rd.js [--aplicar]
const path = require("path"); const fs = require("fs");
const ROOT = path.resolve(__dirname, "../.."); process.chdir(ROOT); require("dotenv").config({ quiet: true });
const T = process.env.RD_CRM_TOKEN; const OPCAO = "PCI X";
const APLICAR = process.argv.includes("--aplicar");
(async () => {
  const lista = await (await fetch(`https://crm.rdstation.com/api/v1/custom_fields?token=${T}`)).json();
  const campos = (Array.isArray(lista) ? lista : (lista.custom_fields || [])).filter(f => /perfil pci/i.test(f.label || "") && f.for === "deal");
  console.log("campos encontrados:", campos.map(f => `${f.label} [${f._id || f.id}] for=${f.for}`));
  for (const f of campos) {
    const id = f._id || f.id;
    const campo = await (await fetch(`https://crm.rdstation.com/api/v1/custom_fields/${id}?token=${T}`)).json();
    const opts = campo.opts || [];
    console.log(`\n${campo.label}: ${opts.length} opções ->`, JSON.stringify(opts));
    if (opts.some(o => String(o).trim().toLowerCase() === OPCAO.toLowerCase())) { console.log("já tem", OPCAO); continue; }
    if (!APLICAR) { console.log("(dry) acrescentaria", OPCAO); continue; }
    const bk = path.resolve(ROOT, "../Documentação/Backups_Banco/rd_opcoes_perfil_pci_ANTES_pci_x_23-11-2026.json");
    fs.writeFileSync(bk, JSON.stringify({ id, label: campo.label, opts }, null, 1));
    const r = await fetch(`https://crm.rdstation.com/api/v1/custom_fields/${id}?token=${T}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ opts: [...opts, OPCAO] }) });
    const depois = await (await fetch(`https://crm.rdstation.com/api/v1/custom_fields/${id}?token=${T}`)).json();
    console.log("PUT", r.status, "| opções agora:", (depois.opts || []).length, "| tem PCI X:", (depois.opts || []).includes(OPCAO), "| backup:", bk);
  }
})().catch(e => { console.error("ERRO", e.message); process.exit(1); });
