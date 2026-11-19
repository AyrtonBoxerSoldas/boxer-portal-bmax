// Mapeia valores ANTIGOS de REVENDA/LOJA nos cards (com código ZEN) para o nome único da loja. Uso: node legado_cards.js [--aplicar]
const P = "C:/Users/andre.coelho.BXSD/BOXER/Dados - Documentos/Comercial/Geral/Estrategia/2026/Projeto BMax/boxer-portal-bmax";
process.chdir(P); require(P + "/node_modules/dotenv").config({ quiet: true });
const fs = require("fs"); const { sbSistemasService } = require(P + "/src/config/supabaseSistemas"); const l = require(P + "/src/services/rd.leads.service"); const C = require(P + "/src/config/constants");
const T = process.env.RD_CRM_TOKEN, B = "https://crm.rdstation.com/api/v1";
const nz = s => String(s || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toLowerCase().replace(/\s+/g, " ");
const APLICAR = process.argv.includes("--aplicar");
(async () => {
  const lojas = await sbSistemasService("/comercial_revendas_bmax?select=id,nome,nome_rd,ativo,grupo");
  const canon = new Set(lojas.filter(x => x.ativo).map(x => nz(x.nome_rd || x.nome)));
  const deals = await l.fetchAllDealsAllPipelines(); const legado = {};
  deals.forEach(d => { const v = String(l.getCustomField(d, "REVENDA/LOJA") || ""); if (v && !canon.has(nz(v)) && nz(v) !== "sem revenda") (legado[v] = legado[v] || []).push(d); });
  const plano = [];
  for (const [v, ds] of Object.entries(legado)) {
    const cod = (v.match(/^\s*(\d{4,6})\b/) || [])[1]; const cand = cod ? lojas.filter(x => x.ativo && (new RegExp("^\\s*" + cod + "\\b")).test(x.nome || "")) : [];
    const alvo = cand.length === 1 ? (cand[0].nome_rd || cand[0].nome) : null;
    console.log(`"${v}" x${ds.length} -> ${alvo ? '"' + alvo + '"' : "(sem correspondência automática" + (cand.length > 1 ? ": " + cand.length + " lojas com o código" : "") + ")"} | cards: ${ds.map(d => `${C.RD_STAGES[d.deal_stage && d.deal_stage.id] || (d.deal_stage && d.deal_stage.name)}${d.win === true ? "/ganho" : d.win === false ? "/perdido" : "/aberto"}`).join(", ")}`);
    if (alvo && !ds.some(d => d.win === true)) plano.push({ de: v, para: alvo, ids: ds.map(d => d.id || d._id) }); else if (alvo) console.log('   (tem card GANHO: não renomeio automaticamente — envolve cashback)');
  }
  if (APLICAR) {
    fs.writeFileSync("C:/Users/andre.coelho.BXSD/BOXER/Dados - Documentos/Comercial/Geral/Estrategia/2026/Projeto BMax/Documentação/Backups_Banco/cards_nomes_legados_ANTES_19-11-2026.json", JSON.stringify(plano, null, 1));
    const arr = (await (await fetch(`${B}/custom_fields?token=${T}`)).json()); const cfs = arr.custom_fields || arr; const idDe = lb => { const f = cfs.find(x => x.label && x.label.trim() === lb && (x.for === "deal" || !x.for)); return f._id || f.id; };
    for (const p of plano) for (const id of p.ids) {
      const put = async campos => { const r = await fetch(`${B}/deals/${id}?token=${T}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ deal: { deal_custom_fields: campos } }) }); return { s: r.status, j: await r.json().catch(() => ({})) }; };
      let r = await put([{ custom_field_id: idDe("REVENDA/LOJA"), value: p.para }]);
      if (r.s === 422) { const req = (r.j.errors && r.j.errors.deal_required_custom_fields) || r.j.deal_required_custom_fields || []; const falt = req.flatMap(x => Object.values(x).map(v => v.custom_field.label)); const d = await (await fetch(`${B}/deals/${id}?token=${T}`)).json();
        if (d.win === true || d.win === false) { const extra = []; if (falt.includes("CLASSE DE PREÇO")) extra.push({ custom_field_id: idDe("CLASSE DE PREÇO"), value: "Sem Classe" }); if (falt.includes("SEGMENTO DE PRODUTO")) extra.push({ custom_field_id: idDe("SEGMENTO DE PRODUTO"), value: "Não se aplica" }); if (extra.length === falt.length) r = await put([{ custom_field_id: idDe("REVENDA/LOJA"), value: p.para }, ...extra]); } else console.log("  CARD ABERTO com campos faltando — NÃO alterado:", id, falt.join(",")); }
      console.log("  ", id, "->", p.para, "| HTTP", r.s);
    }
  }
  process.exit(0);
})().catch(e => { console.error("ERRO", e.stack || e.message); process.exit(1); });
