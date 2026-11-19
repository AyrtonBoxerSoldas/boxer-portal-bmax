import json, sqlite3, datetime as dt
from openpyxl import Workbook
from openpyxl.styles import Font, PatternFill, Alignment, Border, Side
from openpyxl.worksheet.datavalidation import DataValidation
from openpyxl.formatting.rule import CellIsRule

ZEN = r"C:\Users\andre.coelho.BXSD\BOXER\Fileserver - Documentos\COMERCIAL\Gestor\Salescope\bsis.db"
OUT = r"C:\Users\andre.coelho.BXSD\BOXER\Dados - Documentos\Comercial\Geral\Estrategia\2026\Projeto BMax\Documentação\Reanalise_Revendas_Ativas_19-11-2026.xlsx"
dados = json.load(open(r"C:\tmp\bmax\reanalise.json", encoding="utf-8"))
c = sqlite3.connect(f"file:{ZEN}?mode=ro", uri=True)
hoje = dt.date(2026, 11, 19); d12 = (hoje - dt.timedelta(days=365)).isoformat(); d6 = (hoje - dt.timedelta(days=183)).isoformat()
def zen(cnpjs):
    cnpjs = [x for x in cnpjs if x]
    if not cnpjs: return None, None, None
    ph = ",".join("?" * len(cnpjs))
    r12 = c.execute(f"select coalesce(sum(valor_total_item),0), max(data) from vendas where replace(replace(replace(cnpj,'.',''),'/',''),'-','') in ({ph}) and data>=? and valor_total_item>0", [*cnpjs, d12]).fetchone()
    r6 = c.execute(f"select coalesce(sum(valor_total_item),0) from vendas where replace(replace(replace(cnpj,'.',''),'/',''),'-','') in ({ph}) and data>=? and valor_total_item>0", [*cnpjs, d6]).fetchone()
    ult = c.execute(f"select max(data) from vendas where replace(replace(replace(cnpj,'.',''),'/',''),'-','') in ({ph}) and valor_total_item>0", cnpjs).fetchone()
    return round(r12[0]), round(r6[0]), ult[0]
por_grupo = {}
for d in dados:
    if d["grupo"]: por_grupo.setdefault(d["grupo"], []).append(d["cnpj"])
# acesso do GRUPO: o login de um grupo atende todas as lojas dele
acesso_grupo = {}
for d in dados:
    if d["grupo"] and d["login"]:
        g = acesso_grupo.setdefault(d["grupo"], {"dias": None, "ultimo": "", "n90": 0, "total": 0, "login": d["login"]})
        if d["dias_sem_acesso"] is not None and (g["dias"] is None or d["dias_sem_acesso"] < g["dias"]): g["dias"] = d["dias_sem_acesso"]; g["ultimo"] = d["ultimo_acesso"]
        g["n90"] += d["acessos_90d"]; g["total"] += d["acessos_total"]
for d in dados:
    if d["grupo"] and d["grupo"] in acesso_grupo and not d["login"]:
        g = acesso_grupo[d["grupo"]]; d["dias_sem_acesso"] = g["dias"]; d["ultimo_acesso"] = g["ultimo"]; d["acessos_90d"] = g["n90"]; d["acessos_total"] = g["total"]; d["login_grupo"] = g["login"]
linhas = []
for d in dados:
    cn = por_grupo[d["grupo"]] if d["grupo"] else [d["cnpj"]]
    z12, z6, zult = zen(cn)
    d["zen12"], d["zen6"], d["zenult"] = z12, z6, zult
    alertas = []
    if d["login"] and d["acessos_total"] == 0: alertas.append("login sem nenhum acesso registrado (registro desde 21/08/2026)")
    elif d["login"] and (d["dias_sem_acesso"] or 0) > 60: alertas.append(f"sem acesso há {d['dias_sem_acesso']} dias")
    if not d["login"] and not d["grupo"]: alertas.append("sem login")
    if d["cards_total"] and not d["login"] and not d["grupo"]: alertas.append("tem cards mas não tem login")
    if d["saldo"] > 0: alertas.append(f"cashback R$ {d['saldo']:.2f}")
    if not d["cnpj"]: alertas.append("sem CNPJ")
    if z12 == 0 and cn and any(cn): alertas.append("sem compra no ZEN em 12 meses")
    if cn == [""] or not any(cn): z12 = None
    sinal_acesso = d["dias_sem_acesso"] is not None and d["dias_sem_acesso"] <= 60
    sinal_cards = d["cards_90d"] > 0
    sinal_zen = bool(z6)
    fortes = sum([sinal_acesso, sinal_cards, sinal_zen])
    if fortes >= 2 or (sinal_acesso): sug = "MANTER"
    elif fortes == 1: sug = "REVISAR"
    else: sug = "DESATIVAR?"
    if d["login"] and d["acessos_total"] == 0 and not sinal_zen: sug = "REVISAR" if sug == "MANTER" else sug
    d["alertas"] = "; ".join(alertas); d["sug"] = sug; d["fortes"] = fortes
    linhas.append(d)
ordem = {"DESATIVAR?": 0, "REVISAR": 1, "MANTER": 2}
linhas.sort(key=lambda x: (ordem[x["sug"]], x["nome"].lower()))
F = "Arial"; azul = PatternFill("solid", fgColor="1D327B"); amarelo = PatternFill("solid", fgColor="FFF2CC")
fino = Side(style="thin", color="BFBFBF"); borda = Border(left=fino, right=fino, top=fino, bottom=fino)
wb = Workbook(); ws = wb.active; ws.title = "Reanálise"
ws["A1"] = "Reanálise das revendas ATIVAS (19/11/2026) — preencha só a coluna amarela 'Sua decisão'"; ws["A1"].font = Font(name=F, bold=True, size=13)
ws["A2"] = ("Sinais de uso: acesso ao Portal (60 dias), cards no RD (90 dias) e compra no ZEN (6 meses). MANTER = acessa ou tem 2+ sinais; REVISAR = 1 sinal só; "
            "DESATIVAR? = nenhum sinal. Para grupos, os números de cards, saldo e ZEN são do grupo inteiro. É só uma sugestão: a decisão é sua.")
ws["A2"].font = Font(name=F, size=10); ws["A2"].alignment = Alignment(wrap_text=True, vertical="top"); ws.merge_cells("A2:V2"); ws.row_dimensions[2].height = 42
cab = ["Revenda (nome no RD)", "Grupo", "Classe", "Representante", "Cidade/UF", "Login", "Último acesso", "Acessos 90d", "Cards RD (total)", "Cards 90d", "Cards abertos", "Cards vendidos", "Última venda RD", "Cashback saldo (R$)", "ZEN 12m (R$)", "ZEN 6m (R$)", "Última compra ZEN", "Alertas", "Sugestão", "Sua decisão", "Observação", "id (não editar)"]
for i, h in enumerate(cab, 1):
    x = ws.cell(row=4, column=i, value=h); x.fill = azul; x.font = Font(name=F, bold=True, color="FFFFFF", size=10); x.alignment = Alignment(wrap_text=True, vertical="center"); x.border = borda
dv = DataValidation(type="list", formula1='"Manter ativa,Desativar,Reclassificar,Decidir depois"', allow_blank=True); ws.add_data_validation(dv)
for r, d in enumerate(linhas, 5):
    vals = [d["nome"], d["grupo"], d["classe"], d["rep"], f'{d["cidade"]}/{d["uf"]}', d["login"] or (("login do grupo: " + d["login_grupo"]) if d.get("login_grupo") else "—"), d["ultimo_acesso"] or ("sem registro" if d["login"] else ""), d["acessos_90d"], d["cards_total"], d["cards_90d"], d["cards_abertos"], d["cards_vendidos"], d["ultima_venda_rd"], d["saldo"], d["zen12"], d["zen6"], d["zenult"] or "", d["alertas"], d["sug"], None, None, d["id"]]
    for i, v in enumerate(vals, 1):
        x = ws.cell(row=r, column=i, value=v); x.font = Font(name=F, size=9); x.border = borda; x.alignment = Alignment(vertical="top", wrap_text=(i in (18, 21)))
        if i in (14, 15, 16): x.number_format = '#,##0.00' if i == 14 else '#,##0'
    ws.cell(row=r, column=20).fill = amarelo; ws.cell(row=r, column=21).fill = amarelo; dv.add(ws.cell(row=r, column=20))
last = 4 + len(linhas)
rng = f"S5:S{last}"
ws.conditional_formatting.add(rng, CellIsRule(operator="equal", formula=['"MANTER"'], fill=PatternFill("solid", bgColor="E2EFDA")))
ws.conditional_formatting.add(rng, CellIsRule(operator="equal", formula=['"REVISAR"'], fill=PatternFill("solid", bgColor="FFF2CC")))
ws.conditional_formatting.add(rng, CellIsRule(operator="equal", formula=['"DESATIVAR?"'], fill=PatternFill("solid", bgColor="F8CBAD")))
for col, w in zip("ABCDEFGHIJKLMNOPQRSTUV", (26, 14, 10, 18, 20, 30, 12, 9, 9, 8, 9, 9, 12, 12, 12, 12, 12, 44, 12, 16, 30, 10)): ws.column_dimensions[col].width = w
ws.freeze_panes = "B5"; ws.auto_filter.ref = f"A4:V{last}"
w2 = wb.create_sheet("Resumo")
w2["A1"] = "Resumo"; w2["A1"].font = Font(name=F, bold=True, size=13)
cont = {k: sum(1 for d in linhas if d["sug"] == k) for k in ("MANTER", "REVISAR", "DESATIVAR?")}
for i, (k, v) in enumerate(cont.items(), 3): w2.cell(row=i, column=1, value=k).font = Font(name=F, size=10); w2.cell(row=i, column=2, value=v).font = Font(name=F, size=10)
w2.cell(row=7, column=1, value="Total de lojas ativas").font = Font(name=F, bold=True, size=10); w2.cell(row=7, column=2, value=len(linhas)).font = Font(name=F, bold=True, size=10)
w2.column_dimensions["A"].width = 28
wb.save(OUT)
print("ok", cont, len(linhas))
for d in linhas:
    if d["sug"] != "MANTER": print(f'{d["sug"]:11} {d["nome"][:30]:30} acesso:{d["ultimo_acesso"] or "-":10} cards90:{d["cards_90d"]} zen6:{d["zen6"]} | {d["alertas"][:90]}')
