import json, sqlite3, re, unicodedata
from openpyxl import Workbook
from openpyxl.styles import Font, PatternFill, Alignment, Border, Side
from openpyxl.worksheet.datavalidation import DataValidation

ZEN = r"C:\Users\andre.coelho.BXSD\BOXER\Fileserver - Documentos\COMERCIAL\Gestor\Salescope\bsis.db"
OUT = r"C:\Users\andre.coelho.BXSD\BOXER\Dados - Documentos\Comercial\Geral\Estrategia\2026\Projeto BMax\Documentação\Conferencia_ZEN_x_Cadastro_19-11-2026.xlsx"
cad = json.load(open(r"C:\tmp\bmax\cadastro_all.json", encoding="utf-8"))
c = sqlite3.connect(f"file:{ZEN}?mode=ro", uri=True)
def dig(s): return re.sub(r"\D", "", str(s or ""))
def nz(s): return re.sub(r"\s+", " ", unicodedata.normalize("NFD", str(s or "")).encode("ascii", "ignore").decode().lower().strip())
def fmt(c14): c14 = dig(c14); return f"{c14[:2]}.{c14[2:5]}.{c14[5:8]}/{c14[8:12]}-{c14[12:]}" if len(c14) == 14 else c14
cli = c.execute("select cnpj,cnpj_raiz,razao_social,nome_fantasia,entidade_key,entidade_label,faturamento from dim_cliente").fetchall()
por_cnpj = {dig(r[0]): r for r in cli}; por_raiz = {}
for r in cli: por_raiz.setdefault(dig(r[1]) or dig(r[0])[:8], []).append(r)
def vend(cn):
    r12 = c.execute("select coalesce(sum(valor_total_item),0), max(data) from vendas where replace(replace(replace(cnpj,'.',''),'/',''),'-','')=? and valor_total_item>0 and data>=date('2025-11-19')", [cn]).fetchone()
    u = c.execute("select max(data) from vendas where replace(replace(replace(cnpj,'.',''),'/',''),'-','')=? and valor_total_item>0", [cn]).fetchone()[0]
    loc = c.execute("select cidade, estado from vendas where replace(replace(replace(cnpj,'.',''),'/',''),'-','')=? order by data desc limit 1", [cn]).fetchone() or ("", "")
    return round(r12[0]), u, f"{loc[0]}/{loc[1]}" if loc[0] else ""
cnpjs_cadastrados = {dig(x["cnpj"]) for x in cad if dig(x["cnpj"])}
ativas = [x for x in cad if x["ativo"]]
conf, falt, resumo = [], [], []
raizes_vistas = {}
for x in ativas:
    cn = dig(x["cnpj"]); nome = x["nome_rd"] or x["nome"]
    status = ""; sug = ""
    if len(cn) != 14: status = "SEM CNPJ válido no cadastro"
    elif cn in por_cnpj: status = "OK"
    elif cn[:8] in por_raiz: status = "CNPJ não está no ZEN (a raiz existe)"; sug = "; ".join(f"{fmt(r[0])} {r[2]}" for r in por_raiz[cn[:8]][:4])
    else: status = "CNPJ não existe no ZEN"
    if status != "OK":
        m = re.match(r"\s*(\d{4,6})\b", x["nome"] or "")
        cand = []
        toks = [t for t in nz(nome).split() if len(t) > 3]
        if toks:
            for r in cli:
                txt = nz(f"{r[2]} {r[3]}")
                if all(t in txt for t in toks[:2]): cand.append(r)
        if cand and not sug: sug = " | ".join(f"{fmt(r[0])} {r[2]}" for r in cand[:4])
        conf.append([nome, x["grupo"] or "", f'{x["cidade"]}/{x["estado"]}', fmt(cn) if cn else "", x["cep"] or "", status, sug])
    if len(cn) == 14: raizes_vistas.setdefault(cn[:8], []).append(nome)
for raiz, nomes in raizes_vistas.items():
    for r in por_raiz.get(raiz, []):
        cn = dig(r[0])
        if cn in cnpjs_cadastrados: continue
        f12, ult, loc = vend(cn)
        falt.append([", ".join(sorted(set(nomes)))[:60], fmt(cn), r[2], r[3] or "", loc, f12, ult or "", r[5] or ""])
falt.sort(key=lambda a: -a[5])
F = "Arial"; azul = PatternFill("solid", fgColor="1D327B"); amar = PatternFill("solid", fgColor="FFF2CC"); fino = Side(style="thin", color="BFBFBF"); bd = Border(left=fino, right=fino, top=fino, bottom=fino)
wb = Workbook()
def aba(ws, titulo, cab, linhas, larg, decisao=None):
    ws["A1"] = titulo; ws["A1"].font = Font(name=F, bold=True, size=12)
    for i, h in enumerate(cab, 1):
        x = ws.cell(row=3, column=i, value=h); x.fill = azul; x.font = Font(name=F, bold=True, color="FFFFFF", size=10); x.border = bd; x.alignment = Alignment(wrap_text=True, vertical="center")
    for r, l in enumerate(linhas, 4):
        for i, v in enumerate(l, 1):
            x = ws.cell(row=r, column=i, value=v); x.font = Font(name=F, size=9); x.border = bd; x.alignment = Alignment(vertical="top", wrap_text=True)
            if isinstance(v, (int, float)) and cab[i - 1].startswith("ZEN"): x.number_format = "#,##0"
        if decisao:
            for k in decisao: ws.cell(row=r, column=k).fill = amar
    for i, w in enumerate(larg): ws.column_dimensions[chr(65 + i)].width = w
    ws.freeze_panes = "A4"; ws.auto_filter.ref = f"A3:{chr(64 + len(cab))}{3 + len(linhas)}"
ws1 = wb.active; ws1.title = "Filiais no ZEN sem cadastro"
for l in falt: l.extend([None, None])
aba(ws1, "Empresas do mesmo CNPJ-raiz de uma revenda ativa que estão no ZEN e NÃO estão cadastradas no Portal (possíveis filiais que faltam)", ["Revenda(s) ativa(s) da mesma raiz", "CNPJ no ZEN", "Razão social (ZEN)", "Nome fantasia (ZEN)", "Cidade/UF", "ZEN 12m (R$)", "Última compra", "Entidade no BAV", "É do BMax? (sua decisão)", "Observação"], falt, (32, 20, 36, 28, 18, 12, 12, 26, 18, 30), decisao=(9, 10))
dv = DataValidation(type="list", formula1='"Sim - cadastrar,Não faz parte do BMax,Verificar"', allow_blank=True); ws1.add_data_validation(dv); dv.add(f"I4:I{3 + len(falt)}")
ws2 = wb.create_sheet("CNPJ do cadastro não confere")
aba(ws2, "Revendas ativas cujo CNPJ do cadastro não bate com o ZEN (CNPJ errado, ausente ou de outra empresa)", ["Revenda", "Grupo", "Cidade/UF", "CNPJ no cadastro", "CEP", "Situação", "Candidatos no ZEN (pelo nome / mesma raiz)"], conf, (30, 18, 20, 22, 12, 34, 90))
wb.save(OUT)
print("lojas ativas:", len(ativas), "| CNPJ não confere/ausente:", len(conf), "| filiais no ZEN sem cadastro:", len(falt), "| revendas com raiz no ZEN:", len(raizes_vistas))
print("--- CNPJ NÃO CONFERE ---")
for l in conf: print(f"  {l[0][:30]:30} {l[3]:20} {l[5][:34]:34} | {l[6][:110]}")
print("--- FILIAIS NO ZEN SEM CADASTRO (top 25 por faturamento 12m) ---")
for l in falt[:25]: print(f"  {l[0][:28]:28} {l[1]:20} {l[2][:34]:34} {l[4]:18} R$ {l[5]:>10,} ult {l[6]}")
