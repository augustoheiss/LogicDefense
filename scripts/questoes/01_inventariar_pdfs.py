"""Inventaria os PDFs locais de ENEM, SENAI e ETEC, pareia prova <-> gabarito e mede legibilidade do texto.

Grava:
  scripts/questoes/.staging/inventario.json

Uso:
  .\\venv\\Scripts\\python.exe scripts\\questoes\\01_inventariar_pdfs.py
"""
from __future__ import annotations

import hashlib
import json
import re
from pathlib import Path

import fitz

ESCOLA = Path(r"C:\Users\Usuario\Desktop\AHeiss_GoogleDrive\SERVICO-SECULAR\ESCOLA")
RAIZ = Path(__file__).resolve().parents[2]
STAGING = RAIZ / "scripts" / "questoes" / ".staging"


def md5_arquivo(caminho: Path) -> str:
    h = hashlib.md5()
    with caminho.open("rb") as f:
        for bloco in iter(lambda: f.read(65536), b""):
            h.update(bloco)
    return h.hexdigest()


def inspecionar_legibilidade_pdf(caminho: Path, max_paginas: int = 8) -> dict[str, object]:
    """Amostra paginas do PDF para classificar texto_legivel vs visao_obrigatoria."""
    with fitz.open(caminho) as doc:
        num_paginas = len(doc)
        # No ENEM Dia 2, matematica costuma aparecer na segunda metade; amostra inicio, meio e fim.
        indices = sorted({min(i, num_paginas - 1) for i in (0, 1, num_paginas // 3, num_paginas // 2, (2 * num_paginas) // 3, num_paginas - 2, num_paginas - 1)})
        indices = indices[:max_paginas]
        texto_total = ""
        for idx in indices:
            texto_total += "\n" + doc[idx].get_text("text")

    chars = len(re.sub(r"\s+", "", texto_total))
    palavras_pt = len(re.findall(r"[A-Za-zÀ-ÿ]{3,}", texto_total))
    q_markers = len(re.findall(r"(?:QUEST[ÃA]O\s+\d+|\b\d{1,3}\s*[-–.)])", texto_total, re.I))
    estranhos = len(re.findall(r"[\ufffd\x00-\x08\x0b\x0c\x0e-\x1f]", texto_total))
    ratio_estranhos = (estranhos / chars) if chars else 1.0
    legivel = chars >= 600 and palavras_pt >= 80 and ratio_estranhos < 0.03
    return {
        "paginas": num_paginas,
        "chars_amostra": chars,
        "palavras_pt_amostra": palavras_pt,
        "marcadores_questao_amostra": q_markers,
        "ratio_estranhos": round(ratio_estranhos, 4),
        "modo_extracao": "texto_legivel" if legivel else "visao_obrigatoria",
    }


def inventariar_enem() -> tuple[list[dict[str, object]], list[dict[str, object]]]:
    pasta = ESCOLA / "ENEM"
    provas: list[dict[str, object]] = []
    pendencias: list[dict[str, object]] = []
    arquivos = sorted(pasta.glob("*.pdf"))
    gabaritos_por_ano: dict[int, Path] = {}
    provas_por_ano: dict[int, Path] = {}

    for arq in arquivos:
        m = re.match(r"^(\d{4})-(.+)\.pdf$", arq.name)
        if not m:
            continue
        ano = int(m.group(1))
        if ano < 2009:
            continue
        if "GABARITO" in m.group(2).upper():
            gabaritos_por_ano[ano] = arq
        else:
            provas_por_ano[ano] = arq

    for ano in sorted(set(provas_por_ano) | set(gabaritos_por_ano)):
        pv = provas_por_ano.get(ano)
        gb = gabaritos_por_ano.get(ano)
        info = inspecionar_legibilidade_pdf(pv) if pv else {"modo_extracao": "sem_pdf_prova"}
        if pv and not gb:
            pendencias.append({
                "origem": "enem_oficial",
                "provaCodigo": str(ano),
                "motivo": "sem_pdf_gabarito_local",
                "arquivo": pv.name,
            })
        provas.append({
            "origem": "enem_oficial",
            "ano": ano,
            "provaCodigo": str(ano),
            "pdfProva": str(pv) if pv else None,
            "pdfGabarito": str(gb) if gb else None,
            **info,
        })
    return provas, pendencias


def extrair_chave_senai(nome: str) -> tuple[int, str, bool] | None:
    m_cge = re.search(r"SENAI\s+(\d{4})-CGE\s*(\d+)(.*)$", nome, re.I)
    if m_cge:
        ano = int(m_cge.group(1))
        cge = m_cge.group(2)
        eh_gab = "GABARITO" in m_cge.group(3).upper()
        return ano, cge, eh_gab
    m_2023 = re.search(r"senai\s+(\d{4})\s+(gabarito|prova)", nome, re.I)
    if m_2023:
        ano = int(m_2023.group(1))
        eh_gab = m_2023.group(2).lower() == "gabarito"
        return ano, "2215" if ano == 2023 else "0000", eh_gab
    return None


def inventariar_senai() -> tuple[list[dict[str, object]], list[dict[str, object]]]:
    pasta = ESCOLA / "senai-jovem-aprendiz-20230910T192131Z-001"
    grupos: dict[str, dict[str, object]] = {}
    pendencias: list[dict[str, object]] = []
    vistas_md5: dict[str, str] = {}

    for arq in sorted(pasta.rglob("*.pdf")):
        chave = extrair_chave_senai(arq.name)
        if not chave:
            pendencias.append({"origem": "senai_oficial", "motivo": "nome_nao_reconhecido", "arquivo": arq.name})
            continue
        ano, cge, eh_gab = chave
        codigo = f"{ano}-{cge}"
        entry = grupos.setdefault(codigo, {"origem": "senai_oficial", "ano": ano, "cge": cge, "provaCodigo": codigo, "pdfProva": None, "pdfGabarito": None, "duplicatas": []})
        h = md5_arquivo(arq)
        if "(1)" in arq.name or (eh_gab and entry["pdfGabarito"]) or (not eh_gab and entry["pdfProva"]):
            entry["duplicatas"].append({"arquivo": arq.name, "mesmoHashAnterior": h in vistas_md5})
            continue
        vistas_md5[h] = arq.name
        if eh_gab:
            entry["pdfGabarito"] = str(arq)
        else:
            entry["pdfProva"] = str(arq)

    provas: list[dict[str, object]] = []
    for codigo in sorted(grupos):
        item = grupos[codigo]
        pv = Path(item["pdfProva"]) if item["pdfProva"] else None
        info = inspecionar_legibilidade_pdf(pv) if pv else {"modo_extracao": "sem_pdf_prova"}
        if not item["pdfGabarito"]:
            pendencias.append({"origem": "senai_oficial", "provaCodigo": codigo, "motivo": "sem_pdf_gabarito_local", "arquivo": pv.name if pv else None})
        if not item["pdfProva"]:
            pendencias.append({"origem": "senai_oficial", "provaCodigo": codigo, "motivo": "sem_pdf_prova_local", "arquivo": Path(item["pdfGabarito"]).name})
        provas.append({**item, **info})
    return provas, pendencias


def extrair_chave_etec(nome: str) -> tuple[int, int, bool] | None:
    m = re.search(r"(Gabarito|Prova).*?(\d{4})\s*[- ]+\s*(\d)\s*Sem", nome, re.I)
    if not m:
        return None
    eh_gab = m.group(1).lower() == "gabarito"
    ano = int(m.group(2))
    sem = int(m.group(3))
    return ano, sem, eh_gab


def inventariar_etec() -> tuple[list[dict[str, object]], list[dict[str, object]]]:
    pasta = ESCOLA / "vestibulinho-etec-20230910T195836Z-001"
    grupos: dict[str, dict[str, object]] = {}
    pendencias: list[dict[str, object]] = []

    for arq in sorted(pasta.rglob("*.pdf")):
        chave = extrair_chave_etec(arq.name)
        if not chave:
            pendencias.append({"origem": "etec_oficial", "motivo": "nome_nao_reconhecido", "arquivo": arq.name})
            continue
        ano, sem, eh_gab = chave
        codigo = f"{ano}-{sem}"
        entry = grupos.setdefault(codigo, {"origem": "etec_oficial", "ano": ano, "semestre": sem, "provaCodigo": codigo, "pdfProva": None, "pdfGabarito": None})
        if eh_gab:
            entry["pdfGabarito"] = str(arq)
        else:
            entry["pdfProva"] = str(arq)

    provas: list[dict[str, object]] = []
    for codigo in sorted(grupos):
        item = grupos[codigo]
        pv = Path(item["pdfProva"]) if item["pdfProva"] else None
        info = inspecionar_legibilidade_pdf(pv) if pv else {"modo_extracao": "sem_pdf_prova"}
        if not item["pdfProva"]:
            pendencias.append({"origem": "etec_oficial", "provaCodigo": codigo, "motivo": "gabarito_orfao_sem_prova", "arquivo": Path(item["pdfGabarito"]).name})
        if not item["pdfGabarito"]:
            pendencias.append({"origem": "etec_oficial", "provaCodigo": codigo, "motivo": "sem_pdf_gabarito_local", "arquivo": pv.name if pv else None})
        provas.append({**item, **info})
    return provas, pendencias


def main() -> None:
    STAGING.mkdir(parents=True, exist_ok=True)
    enem_p, enem_pend = inventariar_enem()
    senai_p, senai_pend = inventariar_senai()
    etec_p, etec_pend = inventariar_etec()

    payload = {
        "escolaRaiz": str(ESCOLA),
        "enem": enem_p,
        "senai": senai_p,
        "etec": etec_p,
        "pendencias": [*enem_pend, *senai_pend, *etec_pend],
        "resumo": {
            "enem_provas_escopo": len(enem_p),
            "enem_texto_legivel": sum(1 for p in enem_p if p.get("modo_extracao") == "texto_legivel"),
            "enem_visao_obrigatoria": [p["provaCodigo"] for p in enem_p if p.get("modo_extracao") == "visao_obrigatoria"],
            "senai_provas_distintas": len(senai_p),
            "senai_com_prova_e_gabarito": sum(1 for p in senai_p if p.get("pdfProva") and p.get("pdfGabarito")),
            "etec_entradas": len(etec_p),
            "etec_com_prova_e_gabarito": sum(1 for p in etec_p if p.get("pdfProva") and p.get("pdfGabarito")),
            "total_pendencias": len(enem_pend) + len(senai_pend) + len(etec_pend),
        },
    }
    destino = STAGING / "inventario.json"
    destino.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
    print(json.dumps({"destino": str(destino.relative_to(RAIZ)), "resumo": payload["resumo"], "pendencias": payload["pendencias"]}, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
