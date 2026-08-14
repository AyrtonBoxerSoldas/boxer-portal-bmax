const API_URL = "/api";

const $ = (id) => document.getElementById(id);
const uniq = (arr) => [...new Set(arr)];
const normalizeText = (s) => (s || "").toString().toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[\.\-_/]/g, " ").replace(/\s+/g, " ").trim();
const normalizeDigits = (s) => (s || "").toString().replace(/\D/g, "");
const normalizePci = (s) => (s || "").toString().replace(/\s/g, "").toUpperCase();
const esc = (str) => (str ?? "").toString()
  .replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;")
  .replaceAll('"',"&quot;").replaceAll("'","&#039;");

function tagClass(tag) {
  const t = (tag || "").toLowerCase();
  if (t === "lead") return "tag-lead";
  if (t === "em contato") return "tag-em-contato";
  if (t.includes("negocia")) return "tag-negociacao";
  if (t.includes("demonstra")) return "tag-demonstracao";
  if (t === "assumido") return "tag-assumido";
  if (t.includes("venda") || t === "vendido") return "tag-venda";
  if (t.includes("perdid")) return "tag-perdido";
  return "tag-default";
}
