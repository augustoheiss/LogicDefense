"""Extrai texto legivel por recorte de coluna/questao via Windows.Media.Ocr (pt-BR).

Uso:
  .\\venv\\Scripts\\python.exe scripts\\questoes\\02b_ocr_winrt.py --ano 2021 --min-q 151
"""
from __future__ import annotations

import argparse
import json
import subprocess
import sys
from pathlib import Path

import fitz

RAIZ = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(RAIZ / "scripts"))
extrair_enem = __import__("extrair-figuras-enem")

STAGING = RAIZ / "scripts" / "questoes" / ".staging"
INVENTARIO_PATH = STAGING / "inventario.json"
PS_SCRIPT = RAIZ / "scripts" / "questoes" / "ocr_winrt.ps1"
DPI_SCALE = 3.0


def main() -> None:
    parser = argparse.ArgumentParser(description="Preenche ocorrencias de bruto/enem_{ano}.json via WinRT OCR")
    parser.add_argument("--ano", type=int, required=True)
    parser.add_argument("--min-q", type=int, default=136)
    args = parser.parse_args()

    inv = json.loads(INVENTARIO_PATH.read_text(encoding="utf-8"))
    entry = [e for e in inv.get("enem", []) if int(e["ano"]) == args.ano]
    if not entry:
        raise KeyError(f"ENEM {args.ano} nao encontrado em inventario.json")
    pdf_path = Path(str(entry[0]["pdfProva"]))

    bruto_path = STAGING / "bruto" / f"enem_{args.ano}.json"
    bruto = json.loads(bruto_path.read_text(encoding="utf-8"))
    por_num = {int(q["questao"]): q for q in bruto["questoes"]}

    crops_dir = STAGING / "ocr_crops" / f"enem_{args.ano}"
    crops_dir.mkdir(parents=True, exist_ok=True)
    for antigo in crops_dir.glob("*.png"):
        antigo.unlink()

    crop_rects: dict[int, list[dict[str, object]]] = {}
    ultima_q_pagina_ant: tuple[int, int, str] | None = None

    with fitz.open(pdf_path) as doc:
        for p_idx in range(len(doc)):
            pagina = doc[p_idx]
            achadas = extrair_enem.questoes_na_pagina(pagina)
            if not achadas:
                continue

            duas = extrair_enem.e_duas_colunas(achadas, pagina)
            mid_x = pagina.rect.width / 2.0
            words_pag = pagina.get_text("words")
            por_col: dict[str, list[tuple[int, float, float, float, float]]] = {"esq": [], "dir": []}
            for num, xt, yt in achadas:
                x0, x1 = extrair_enem.limites_da_coluna(pagina, xt, duas)
                col_key = "esq" if x0 < mid_x - 20 else "dir"
                por_col[col_key].append((num, xt, yt, x0, x1))

            for k in ("esq", "dir"):
                por_col[k].sort(key=lambda t: t[2])

            # Se nao ha questoes na coluna direita, verifica se ha linhas corridas atravessando a pagina inteira
            if not por_col["dir"] and por_col["esq"]:
                tem_largura_total = any(
                    w[0] < mid_x - 10 and w[2] > mid_x + 15 and w[1] > 60 and w[3] < pagina.rect.height - 35
                    for w in words_pag
                ) or any(w[0] > mid_x + 30 and w[1] > 60 and w[3] < pagina.rect.height - 35 for w in words_pag)
                if tem_largura_total:
                    por_col["esq"] = [
                        (num, xt, yt, 28.0, pagina.rect.width - 28.0)
                        for (num, xt, yt, _x0, _x1) in por_col["esq"]
                    ]

            # Continuacao no topo da coluna esquerda vindo da pagina anterior
            if por_col["esq"] and por_col["esq"][0][2] > 95 and ultima_q_pagina_ant is not None:
                prev_q = ultima_q_pagina_ant[0]
                if prev_q in por_num:
                    x0_e, x1_e = por_col["esq"][0][3], por_col["esq"][0][4]
                    clip = fitz.Rect(max(0.0, x0_e - 6), 62.0, min(pagina.rect.width, x1_e + 6), por_col["esq"][0][2] - 4)
                    if clip.height > 20:
                        idx_occ = len(crop_rects.get(prev_q, []))
                        nome = f"q{prev_q}_{idx_occ}.png"
                        pagina.get_pixmap(matrix=fitz.Matrix(DPI_SCALE, DPI_SCALE), clip=clip, alpha=False).save(str(crops_dir / nome))
                        crop_rects.setdefault(prev_q, []).append({
                            "arquivo": nome,
                            "pagina": p_idx + 1,
                            "coluna": "esquerda",
                        })

            # Demais ocorrencias da coluna esquerda
            for i, (num, _xt, yt, x0, x1) in enumerate(por_col["esq"]):
                y_fim = por_col["esq"][i + 1][2] - 4 if i + 1 < len(por_col["esq"]) else pagina.rect.height - 32
                if num in por_num and num >= args.min_q:
                    clip = fitz.Rect(max(0.0, x0 - 6), max(0.0, yt - 4), min(pagina.rect.width, x1 + 6), y_fim)
                    idx_occ = len(crop_rects.get(num, []))
                    nome = f"q{num}_{idx_occ}.png"
                    pagina.get_pixmap(matrix=fitz.Matrix(DPI_SCALE, DPI_SCALE), clip=clip, alpha=False).save(str(crops_dir / nome))
                    crop_rects.setdefault(num, []).append({
                        "arquivo": nome,
                        "pagina": p_idx + 1,
                        "coluna": "esquerda",
                    })

            # Continuacao no topo da coluna direita vinda da ultima questao da coluna esquerda
            if por_col["dir"] and por_col["dir"][0][2] > 95 and por_col["esq"]:
                last_esq_q = por_col["esq"][-1][0]
                if last_esq_q in por_num and last_esq_q >= args.min_q:
                    x0_d, x1_d = por_col["dir"][0][3], por_col["dir"][0][4]
                    clip = fitz.Rect(max(0.0, x0_d - 6), 62.0, min(pagina.rect.width, x1_d + 6), por_col["dir"][0][2] - 4)
                    if clip.height > 20:
                        idx_occ = len(crop_rects.get(last_esq_q, []))
                        nome = f"q{last_esq_q}_{idx_occ}.png"
                        pagina.get_pixmap(matrix=fitz.Matrix(DPI_SCALE, DPI_SCALE), clip=clip, alpha=False).save(str(crops_dir / nome))
                        crop_rects.setdefault(last_esq_q, []).append({
                            "arquivo": nome,
                            "pagina": p_idx + 1,
                            "coluna": "direita",
                        })

            # Demais ocorrencias da coluna direita
            for i, (num, _xt, yt, x0, x1) in enumerate(por_col["dir"]):
                y_fim = por_col["dir"][i + 1][2] - 4 if i + 1 < len(por_col["dir"]) else pagina.rect.height - 32
                if num in por_num and num >= args.min_q:
                    clip = fitz.Rect(max(0.0, x0 - 6), max(0.0, yt - 4), min(pagina.rect.width, x1 + 6), y_fim)
                    idx_occ = len(crop_rects.get(num, []))
                    nome = f"q{num}_{idx_occ}.png"
                    pagina.get_pixmap(matrix=fitz.Matrix(DPI_SCALE, DPI_SCALE), clip=clip, alpha=False).save(str(crops_dir / nome))
                    crop_rects.setdefault(num, []).append({
                        "arquivo": nome,
                        "pagina": p_idx + 1,
                        "coluna": "direita",
                    })

            if por_col["dir"]:
                ultima_q_pagina_ant = (por_col["dir"][-1][0], p_idx + 1, "direita")
            elif por_col["esq"]:
                ultima_q_pagina_ant = (por_col["esq"][-1][0], p_idx + 1, "esquerda")

    ocr_json_path = STAGING / "bruto" / f"enem_{args.ano}_ocr_raw.json"
    cmd = [
        "powershell",
        "-NoProfile",
        "-ExecutionPolicy",
        "Bypass",
        "-File",
        str(PS_SCRIPT),
        "-InputDir",
        str(crops_dir),
        "-OutputJson",
        str(ocr_json_path),
    ]
    subprocess.run(cmd, check=True)
    ocr_map = json.loads(ocr_json_path.read_text(encoding="utf-8"))

    resumo = []
    for num in sorted(crop_rects):
        q_obj = por_num[num]
        novas_occs = []
        pags = set()
        pngs = set()
        total_chars = 0
        for rec in crop_rects[num]:
            texto = str(ocr_map.get(rec["arquivo"], "")).strip()
            total_chars += len(texto)
            p_num = int(rec["pagina"])
            pags.add(p_num)
            p_rel = f"scripts\\questoes\\.staging\\paginas_hd\\enem_{args.ano}\\p{p_num:02d}.png"
            pngs.add(p_rel)
            novas_occs.append({
                "pagina": p_num,
                "paginaPng": p_rel,
                "coluna": rec["coluna"],
                "texto": texto,
                "fonteTexto": "winrt_ocr_pt_br",
            })
        q_obj["ocorrencias"] = novas_occs
        q_obj["paginas"] = sorted(pags)
        q_obj["paginasPng"] = sorted(pngs)
        resumo.append((num, len(novas_occs), total_chars))

    bruto_path.write_text(json.dumps(bruto, ensure_ascii=False, indent=2), encoding="utf-8")
    for num, n_occ, chars in resumo:
        print(f"Q{num}: occs={n_occ} chars={chars}")
    print(f"02b_ocr_winrt: atualizado {len(resumo)} questoes em {bruto_path}")


if __name__ == "__main__":
    main()
