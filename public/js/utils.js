const API_URL = "/api";

const $ = (id) => document.getElementById(id);
const uniq = (arr) => [...new Set(arr)];
const normalizeText = (s) => (s || "").toString().toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[\.\-_/]/g, " ").replace(/\s+/g, " ").trim();
const normalizeDigits = (s) => (s || "").toString().replace(/\D/g, "");
const normalizePci = (s) => (s || "").toString().replace(/\s/g, "").toUpperCase();
const esc = (str) => (str ?? "").toString()
  .replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;")
  .replaceAll('"',"&quot;").replaceAll("'","&#039;");
