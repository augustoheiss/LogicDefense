"""Extrai texto bruto por coluna e renderiza paginas HD (PNG) das secoes de Matematica das provas locais.

Uso (Onda 1 piloto):
  .\\venv\\Scripts\\python.exe scripts\\questoes\\02_extrair_provas.py --exame enem --anos 2019 2018

Grava:
  scripts/questoes/.staging/paginas_hd/enem_{ano}/p{NN}.png
  scripts/questoes/.staging/bruto/enem_{ano}.json
"""
from __future__ import annotations

import argparse
import json
import re
import sys
from pathlib import Path

import fitz

RAIZ = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(RAIZ / "scripts"))
extrair_enem = __import__("extrair-figuras-enem")

STAGING = RAIZ / "scripts" / "questoes" / ".staging"
INVENTARIO_PATH = STAGING / "inventario.json"
INDICE_JOGO_PATH = RAIZ / "public" / "questoes" / "indice.json"
GABARITO_ENEM_TS = RAIZ / "src" / "games" / "LogicBattle" / "ilha" / "estudo" / "bancos" / "gabaritosMatematicaEnem.ts"
FIGURAS_ENEM_MANIFEST = RAIZ / "src" / "games" / "LogicBattle" / "ilha" / "estudo" / "bancos" / "figurasEnem.manifest.ts"
ZOOM_PAGINA = 2.2


def carregar_gabaritos_enem() -> dict[tuple[int, int], str]:
    texto = GABARITO_ENEM_TS.read_text(encoding="utf-8")
    mapa: dict[tuple[int, int], str] = {}
    for m in re.finditer(r"ano:\s*(\d+),\s*questao:\s*(\d+),\s*letra:\s*'([^']+)'", texto):
        mapa[(int(m.group(1)), int(m.group(2)))] = m.group(3)
    return mapa


def carregar_figuras_existentes_enem() -> dict[tuple[int, int], list[dict[str, object]]]:
    texto = FIGURAS_ENEM_MANIFEST.read_text(encoding="utf-8")
    mapa: dict[tuple[int, int], list[dict[str, object]]] = {}
    blocos = re.finditer(r"'(\d{4}):(\d+)':\s*\[(.*?)\]", texto, re.S)
    for b in blocos:
        ano = int(b.group(1))
        q = int(b.group(2))
        itens: list[dict[str, object]] = []
        for entry in re.finditer(r"\{([^}]+)\}", b.group(3)):
            corpo = entry.group(1)
            src_m = re.search(r"src:\s*'([^']+)'", corpo)
            alt_m = re.search(r"alt:\s*'([^']+)'", corpo)
            w_m = re.search(r"largura:\s*(\d+)", corpo)
            h_m = re.search(r"altura:\s*(\d+)", corpo)
            tv_m = re.search(r"tipoVisual:\s*'([^']+)'", corpo)
            if src_m and w_m and h_m:
                item: dict[str, object] = {
                    "src": src_m.group(1),
                    "alt": alt_m.group(1) if alt_m else f"Figura da questao {q} do ENEM {ano}",
                    "largura": int(w_m.group(1)),
                    "altura": int(h_m.group(1)),
                    "papel": "enunciado",
                }
                if tv_m:
                    item["tipoVisual"] = tv_m.group(1)
                itens.append(item)
        if itens:
            mapa[(ano, q)] = itens
    return mapa


def carregar_ja_no_jogo(origem: str) -> set[tuple[int, int]]:
    if not INDICE_JOGO_PATH.exists():
        return set()
    idx = json.loads(INDICE_JOGO_PATH.read_text(encoding="utf-8"))
    return {(int(e["ano"]), int(e["questao"])) for e in idx.get("entradas", []) if e.get("origem") == origem}


def texto_coluna_entre_ys(pagina: fitz.Page, x0: float, x1: float, y0: float, y1: float) -> str:
    palavras = [
        p for p in pagina.get_text("words")
        if (x0 - 8) <= p[0] and p[2] <= (x1 + 8) and (y0 - 2) <= p[1] < (y1 - 2)
    ]
    palavras.sort(key=lambda p: (round(p[1] / 3.5), p[0]))
    linhas: list[str] = []
    if not palavras:
        return ""
    atual = [palavras[0]]
    y_ref = palavras[0][1]
    for p in palavras[1:]:
        if abs(p[1] - y_ref) < 4.5:
            atual.append(p)
        else:
            atual.sort(key=lambda w: w[0])
            linhas.append(" ".join(w[4] for w in atual))
            atual = [p]
            y_ref = p[1]
    atual.sort(key=lambda w: w[0])
    linhas.append(" ".join(w[4] for w in atual))
    return "\n".join(linhas)


def extrair_enem_ano(ano: int, entry_inv: dict[str, object], gabaritos: dict[tuple[int, int], str], figuras_mapa: dict[tuple[int, int], list[dict[str, object]]], ja_no_jogo: set[tuple[int, int]]) -> dict[str, object]:
    pdf_path = entry_inv.get("pdfProva")
    if not pdf_path:
        raise FileNotFoundError(f"Sem pdfProva para ENEM {ano} no inventario")
    pdf = Path(str(pdf_path))
    dir_hd = STAGING / "paginas_hd" / f"enem_{ano}"
    dir_hd.mkdir(parents=True, exist_ok=True)
    dir_bruto = STAGING / "bruto"
    dir_bruto.mkdir(parents=True, exist_ok=True)

    ocorrencias_por_q: dict[int, list[dict[str, object]]] = {}
    paginas_matematica: set[int] = set()

    with fitz.open(pdf) as doc:
        inicio_mt_idx = None
        for p_idx in range(len(doc)):
            if any(q == 136 for q, _, _ in extrair_enem.questoes_na_pagina(doc[p_idx])):
                inicio_mt_idx = p_idx
                break
        if inicio_mt_idx is None:
            inicio_mt_idx = 0
            for p_idx in range(2, len(doc)):
                txt_norm = extrair_enem.sem_acento(doc[p_idx].get_text("text"))
                if "MATEMATICA E SUAS TECNOLOGIAS" in txt_norm or "QUESTOES DE 136 A 180" in txt_norm:
                    inicio_mt_idx = p_idx
                    break

        ultima_q_pagina_ant: int | None = None
        for p_idx in range(inicio_mt_idx, len(doc)):
            pagina = doc[p_idx]
            achadas = extrair_enem.questoes_na_pagina(pagina)
            if not achadas:
                continue
            paginas_matematica.add(p_idx + 1)
            duas = extrair_enem.e_duas_colunas(achadas, pagina)
            mid_x = pagina.rect.width / 2.0
            words_pag = pagina.get_text("words")
            # Organiza por coluna para determinar y_fim ate a proxima questao da mesma coluna
            por_col: dict[str, list[tuple[int, float, float, float, float]]] = {"esq": [], "dir": []}
            for num, xt, yt in achadas:
                x0, x1 = extrair_enem.limites_da_coluna(pagina, xt, duas)
                col_key = "esq" if x0 < mid_x - 20 else "dir"
                por_col[col_key].append((num, xt, yt, x0, x1))

            for k in ("esq", "dir"):
                por_col[k].sort(key=lambda t: t[2])

            if not por_col["dir"] and por_col["esq"]:
                tem_largura_total = any(
                    w[0] < mid_x - 10 and w[2] > mid_x + 15 and w[1] > 60 and w[3] < pagina.rect.height - 35
                    for w in words_pag
                ) or any(w[0] > mid_x + 30 and w[1] > 60 and w[3] < pagina.rect.height - 35 for w in words_pag)
                if tem_largura_total:
                    por_col["esq"] = [
                        (num, xt, yt, 24.0, pagina.rect.width - 24.0)
                        for (num, xt, yt, _x0, _x1) in por_col["esq"]
                    ]

            if por_col["esq"] and por_col["esq"][0][2] > 95 and ultima_q_pagina_ant is not None:
                x0_e, x1_e = por_col["esq"][0][3], por_col["esq"][0][4]
                txt_cont = texto_coluna_entre_ys(pagina, x0_e, x1_e, 66.0, por_col["esq"][0][2])
                if txt_cont.strip():
                    ocorrencias_por_q.setdefault(ultima_q_pagina_ant, []).append({
                        "pagina": p_idx + 1,
                        "paginaPng": str((dir_hd / f"p{p_idx + 1:02d}.png").relative_to(RAIZ)),
                        "coluna": "esquerda",
                        "texto": txt_cont,
                    })

            for i, (num, _xt, yt, x0, x1) in enumerate(por_col["esq"]):
                y_fim = por_col["esq"][i + 1][2] if i + 1 < len(por_col["esq"]) else pagina.rect.height - 32
                texto = texto_coluna_entre_ys(pagina, x0, x1, yt, y_fim)
                ocorrencias_por_q.setdefault(num, []).append({
                    "pagina": p_idx + 1,
                    "paginaPng": str((dir_hd / f"p{p_idx + 1:02d}.png").relative_to(RAIZ)),
                    "coluna": "esquerda",
                    "texto": texto,
                })

            if por_col["dir"] and por_col["dir"][0][2] > 95 and por_col["esq"]:
                last_esq_q = por_col["esq"][-1][0]
                x0_d, x1_d = por_col["dir"][0][3], por_col["dir"][0][4]
                txt_cont_d = texto_coluna_entre_ys(pagina, x0_d, x1_d, 66.0, por_col["dir"][0][2])
                if txt_cont_d.strip():
                    ocorrencias_por_q.setdefault(last_esq_q, []).append({
                        "pagina": p_idx + 1,
                        "paginaPng": str((dir_hd / f"p{p_idx + 1:02d}.png").relative_to(RAIZ)),
                        "coluna": "direita",
                        "texto": txt_cont_d,
                    })

            for i, (num, _xt, yt, x0, x1) in enumerate(por_col["dir"]):
                y_fim = por_col["dir"][i + 1][2] if i + 1 < len(por_col["dir"]) else pagina.rect.height - 32
                texto = texto_coluna_entre_ys(pagina, x0, x1, yt, y_fim)
                ocorrencias_por_q.setdefault(num, []).append({
                    "pagina": p_idx + 1,
                    "paginaPng": str((dir_hd / f"p{p_idx + 1:02d}.png").relative_to(RAIZ)),
                    "coluna": "direita",
                    "texto": texto,
                })

            if por_col["dir"]:
                ultima_q_pagina_ant = por_col["dir"][-1][0]
            elif por_col["esq"]:
                ultima_q_pagina_ant = por_col["esq"][-1][0]

        # Garante tambem renderizar eventuais paginas intermediarias dentro da faixa matematica
        if paginas_matematica:
            p_min, p_max = min(paginas_matematica), max(paginas_matematica)
            for p_num in range(p_min, p_max + 1):
                destino_png = dir_hd / f"p{p_num:02d}.png"
                if not destino_png.exists():
                    pix = doc[p_num - 1].get_pixmap(matrix=fitz.Matrix(ZOOM_PAGINA, ZOOM_PAGINA), alpha=False)
                    pix.save(str(destino_png))

    questoes_faltantes: list[dict[str, object]] = []
    anuladas: list[int] = []
    ja_existentes: list[int] = []
    sem_gabarito: list[int] = []

    for q in range(136, 181):
        gab = gabaritos.get((ano, q))
        if gab == "anulada":
            anuladas.append(q)
            continue
        if (ano, q) in ja_no_jogo:
            ja_existentes.append(q)
            continue
        if not gab:
            sem_gabarito.append(q)
            continue
        occs = ocorrencias_por_q.get(q, [])
        questoes_faltantes.append({
            "ano": ano,
            "questao": q,
            "gabaritoOficial": gab,
            "paginas": sorted({o["pagina"] for o in occs}),
            "paginasPng": sorted({o["paginaPng"] for o in occs}),
            "figurasExistentes": figuras_mapa.get((ano, q), []),
            "ocorrencias": occs,
        })

    payload = {
        "origem": "enem_oficial",
        "ano": ano,
        "modoExtracaoInventario": entry_inv.get("modo_extracao"),
        "paginasMatematica": sorted(paginas_matematica),
        "jaNoJogo": ja_existentes,
        "anuladas": anuladas,
        "semGabarito": sem_gabarito,
        "faltantesCount": len(questoes_faltantes),
        "questoes": questoes_faltantes,
    }
    destino_json = dir_bruto / f"enem_{ano}.json"
    destino_json.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
    return {
        "ano": ano,
        "modo": entry_inv.get("modo_extracao"),
        "paginas": f"{min(paginas_matematica)}..{max(paginas_matematica)}" if paginas_matematica else "none",
        "ja_no_jogo": len(ja_existentes),
        "anuladas": anuladas,
        "sem_gabarito": sem_gabarito,
        "faltantes": len(questoes_faltantes),
        "nao_localizadas_no_texto": [q["questao"] for q in questoes_faltantes if not q["ocorrencias"]],
        "arquivo": str(destino_json.relative_to(RAIZ)),
    }


def main() -> None:
    parser = argparse.ArgumentParser(description="Extrator bruto + PNG HD para curadoria das provas")
    parser.add_argument("--exame", choices=("enem",), required=True)
    parser.add_argument("--anos", type=int, nargs="+", required=True)
    args = parser.parse_args()

    inv = json.loads(INVENTARIO_PATH.read_text(encoding="utf-8"))
    gabaritos = carregar_gabaritos_enem()
    figuras_mapa = carregar_figuras_existentes_enem()
    ja_no_jogo = carregar_ja_no_jogo("enem_oficial")

    relatorio = []
    por_ano = {int(e["ano"]): e for e in inv.get("enem", [])}
    for ano in args.anos:
        if ano not in por_ano:
            raise KeyError(f"ENEM {ano} nao encontrado em inventario.json")
        relatorio.append(extrair_enem_ano(ano, por_ano[ano], gabaritos, figuras_mapa, ja_no_jogo))

    print(json.dumps(relatorio, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
