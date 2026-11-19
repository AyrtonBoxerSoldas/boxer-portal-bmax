// Move o único card de "Ap Máquinas " para "Sem Revenda" (pedido do André, 19/11/2026)
const P = "C:/Users/andre.coelho.BXSD/BOXER/Dados - Documentos/Comercial/Geral/Estrategia/2026/Projeto BMax/boxer-portal-bmax";
process.chdir(P); require(P + "/node_modules/dotenv").config({ quiet: true });
const T = process.env.RD_CRM_TOKEN, B = "https://crm.rdstation.com/api/v1", ID = "6a4c5767173ce50001f60785";
const get = async p => (await fetch(`${B}${p}${p.includes("?") ? "&" : "?"}token=${T}`)).json();
(async () => {
  const cfs = await get("/custom_fields"); const arr = cfs.custom_fields || cfs;
  const idDe = l => { const f = arr.find(x => x.label && x.label.trim() === l && (x.for === "deal" || !x.for)); return f._id || f.id; };
  const d = await get(`/deals/${ID}`);
  console.log("antes:", d.name, "| etapa:", d.deal_stage && d.deal_stage.name, "| win:", d.win, "| REVENDA/LOJA:", JSON.stringify((d.deal_custom_fields.find(c => /REVENDA/.test(c.custom_field.label)) || {}).value));
  require("fs").writeFileSync("C:/Users/andre.coelho.BXSD/BOXER/Dados - Documentos/Comercial/Geral/Estrategia/2026/Projeto BMax/Documentação/Backups_Banco/card_ap_maquinas_ANTES_19-11-2026.json", JSON.stringify({ id: ID, campos: d.deal_custom_fields.map(c => ({ label: c.custom_field.label, value: c.value })) }, null, 1));
  const put = async (campos) => { const r = await fetch(`${B}/deals/${ID}?token=${T}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ deal: { deal_custom_fields: campos } }) }); return { status: r.status, body: await r.json().catch(() => ({})) }; };
  let r = await put([{ custom_field_id: idDe("REVENDA/LOJA"), value: "Sem Revenda" }]);
  console.log("PUT 1:", r.status);
  if (r.status === 422) {
    const req = (r.body.errors && r.body.errors.deal_required_custom_fields) || r.body.deal_required_custom_fields || [];
    const faltam = req.flatMap(x => Object.values(x).map(v => v.custom_field.label)); console.log("obrigatórios faltando:", faltam.join(", "));
    const extra = []; if (faltam.includes("CLASSE DE PREÇO")) extra.push({ custom_field_id: idDe("CLASSE DE PREÇO"), value: "Sem Classe" }); if (faltam.includes("SEGMENTO DE PRODUTO")) extra.push({ custom_field_id: idDe("SEGMENTO DE PRODUTO"), value: "Não se aplica" });
    if (extra.length && extra.length === faltam.length) { r = await put([{ custom_field_id: idDe("REVENDA/LOJA"), value: "Sem Revenda" }, ...extra]); console.log("PUT 2 (com campos neutros):", r.status); }
  }
  const d2 = await get(`/deals/${ID}`); console.log("depois: REVENDA/LOJA =", JSON.stringify((d2.deal_custom_fields.find(c => /REVENDA/.test(c.custom_field.label)) || {}).value), "| etapa:", d2.deal_stage && d2.deal_stage.name, "| win:", d2.win);
  process.exit(0);
})().catch(e => { console.error("ERRO", e.message); process.exit(1); });
