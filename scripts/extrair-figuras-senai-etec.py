"""Recorta figuras das provas do SENAI (aprendiz) e do vestibulinho da ETEC.

Mesma ideia do extrator do ENEM: o desenho mora no PDF como vetor ou como
imagem embutida. Cada questao com figura vira um PNG e uma entrada no indice
que o LogicBattle consulta.

  public/senai/figuras/{ano}-{cge}/q{n}.png
  public/etec/figuras/{ano}-{semestre}/q{n}.png

Chaves:
  senai:2018:2143:30
  etec:2019:1:12
"""
from __future__ import annotations

import re
import unicodedata
from pathlib import Path

import fitz

ESCOLA = Path(r"C:\Users\Usuario\Desktop\AHeiss_GoogleDrive\SERVICO-SECULAR\ESCOLA")
RAIZ = Path(r"C:\Users\Usuario\Desktop\AHeiss_GoogleDrive\02-Programacao\projetos-IA\LogicDefense")
ZOOM = 2.15


def sem_acento(texto: str) -> str:
    base = unicodedata.normalize("NFD", texto)
    return "".join(c for c in base if unicodedata.category(c) != "Mn").upper()


def unir(rects: list[fitz.Rect]) -> fitz.Rect:
    caixa = rects[0]
    for rect in rects[1:]:
        caixa |= rect
    return caixa


def agrupar(rects: list[fitz.Rect], folga: float = 26) -> list[list[fitz.Rect]]:
    if not rects:
        return []
    ordenados = sorted(rects, key=lambda rect: (rect.y0, rect.x0))
    grupos = [[ordenados[0]]]
    for rect in ordenados[1:]:
        topo = max(item.y1 for item in grupos[-1])
        if rect.y0 - topo > folga:
            grupos.append([rect])
        else:
            grupos[-1].append(rect)
    return grupos


def linhas_da_pagina(pagina: fitz.Page) -> list[list[tuple]]:
    palavras = sorted(pagina.get_text("words"), key=lambda palavra: (palavra[1], palavra[0]))
    linhas: list[list[tuple]] = []
    indice = 0
    while indice < len(palavras):
        linha = [palavras[indice]]
        proximo = indice + 1
        while proximo < len(palavras) and abs(palavras[proximo][1] - palavras[indice][1]) < 8:
            linha.append(palavras[proximo])
            proximo += 1
        linha.sort(key=lambda palavra: palavra[0])
        linhas.append(linha)
        indice = proximo
    return linhas


def questoes_etec(pagina: fitz.Page) -> list[tuple[int, float, float]]:
    achados: list[tuple[int, float, float]] = []
    for linha in linhas_da_pagina(pagina):
        for inicio in range(len(linha)):
            acumulado = ""
            cursor = inicio
            while cursor < len(linha) and len(acumulado) < 7:
                acumulado += sem_acento(linha[cursor][4])
                cursor += 1
                if acumulado == "QUESTAO":
                    if cursor < len(linha) and linha[cursor][4].isdigit():
                        valor = int(linha[cursor][4])
                        if 1 <= valor <= 60:
                            achados.append((valor, linha[inicio][0], linha[inicio][1]))
                    break
                if not "QUESTAO".startswith(acumulado):
                    break
    return sorted(set(achados), key=lambda item: (item[2], item[1]))


def questoes_senai(pagina: fitz.Page) -> list[tuple[int, float, float]]:
    palavras = pagina.get_text("words")
    achados: list[tuple[int, float, float]] = []
    for palavra in palavras:
        token = palavra[4]
        if not re.fullmatch(r"\d{1,2}\.", token):
            continue
        valor = int(token[:-1])
        if not 1 <= valor <= 80:
            continue
        if palavra[0] > 108 or palavra[1] < 40:
            continue
        anterior = None
        for outra in palavras:
            if abs(outra[1] - palavra[1]) > 4 or outra[0] >= palavra[0]:
                continue
            if palavra[0] - outra[2] > 28:
                continue
            if anterior is None or outra[0] > anterior[0]:
                anterior = outra
        if anterior and anterior[4].lower() in {"a.", "b.", "c.", "d.", "e.", "a", "b", "c", "d", "e"}:
            continue
        achados.append((valor, palavra[0], palavra[1]))
    return sorted(set(achados), key=lambda item: (item[2], item[1]))


def e_duas_colunas(questoes: list[tuple[int, float, float]]) -> bool:
    if len(questoes) < 2:
        return False
    xs = [item[1] for item in questoes]
    return max(xs) - min(xs) > 140


def limites_da_coluna(pagina: fitz.Page, x_titulo: float, duas: bool) -> tuple[float, float]:
    if not duas:
        return pagina.rect.x0 + 12, pagina.rect.x1 - 12
    meio = pagina.rect.width / 2
    if x_titulo < meio:
        return pagina.rect.x0 + 10, meio - 6
    return meio + 6, pagina.rect.x1 - 10


def y_das_alternativas(pagina: fitz.Page, estilo: str, x0: float, y0: float, y1: float) -> float:
    if estilo == "senai":
        marcas = ("a.", "b.", "c.", "d.", "e.")
    else:
        marcas = ("(A)", "(B)", "(C)", "(D)", "(E)")
    candidatas = [
        (palavra[1], palavra[4])
        for palavra in pagina.get_text("words")
        if palavra[4] in marcas and x0 - 10 <= palavra[0] <= x0 + 80 and y0 + 18 < palavra[1] < y1
    ]
    candidatas.sort()
    for indice, (y_letra, letra) in enumerate(candidatas):
        if letra != marcas[0]:
            continue
        cursor = y_letra
        ok = True
        for alvo in marcas:
            achou = next(
                (item for item in candidatas[indice:] if item[1] == alvo and cursor - 2 <= item[0] <= cursor + 40),
                None,
            )
            if achou is None:
                ok = False
                break
            cursor = achou[0] + 8
        if ok:
            return y_letra
    return y1


def rects_da_faixa(pagina: fitz.Page, x0: float, x1: float, y0: float, y1: float) -> list[fitz.Rect]:
    faixa: list[fitz.Rect] = []
    for desenho in pagina.get_drawings():
        rect = fitz.Rect(desenho["rect"])
        if rect.width > pagina.rect.width * 0.94 or rect.height > pagina.rect.height * 0.8:
            continue
        if rect.width < 1.2 and rect.height < 1.2:
            continue
        centro_x = (rect.x0 + rect.x1) / 2
        centro_y = (rect.y0 + rect.y1) / 2
        if x0 <= centro_x <= x1 and y0 <= centro_y <= y1:
            faixa.append(rect)
    for info in pagina.get_image_info():
        rect = fitz.Rect(info["bbox"])
        if rect.width < 36 or rect.height < 24:
            continue
        if rect.y0 < 42 and rect.height < 70:
            continue
        if rect.width > pagina.rect.width * 0.94 and rect.height > pagina.rect.height * 0.85:
            continue
        centro_x = (rect.x0 + rect.x1) / 2
        centro_y = (rect.y0 + rect.y1) / 2
        if x0 <= centro_x <= x1 and y0 <= centro_y <= y1:
            faixa.append(rect)
    return faixa


def recortar(pagina: fitz.Page, questoes: list[tuple[int, float, float]], estilo: str, pasta: Path, prefixo_src: str) -> list[dict[str, int | str]]:
    if not questoes:
        return []
    duas = e_duas_colunas(questoes)
    registros: list[dict[str, int | str]] = []
    for numero, x_titulo, y_titulo in questoes:
        x0, x1 = limites_da_coluna(pagina, x_titulo, duas)
        abaixo = [
            item[2]
            for item in questoes
            if item[2] > y_titulo + 8
            and (not duas or (item[1] < pagina.rect.width / 2) == (x_titulo < pagina.rect.width / 2))
        ]
        y_fim = min(abaixo) if abaixo else pagina.rect.y1 - 36
        y_alt = y_das_alternativas(pagina, estilo, x0, y_titulo, y_fim)
        rects = rects_da_faixa(pagina, x0, x1, y_titulo + 12, y_alt - 2)
        blocos: list[tuple[str, int, int]] = []
        for grupo in agrupar(rects):
            caixa = unir(grupo)
            if caixa.width < 42 or caixa.height < 28:
                continue
            clip = fitz.Rect(caixa.x0 - 6, caixa.y0 - 6, caixa.x1 + 6, caixa.y1 + 6) & pagina.rect
            pix = pagina.get_pixmap(matrix=fitz.Matrix(ZOOM, ZOOM), clip=clip, alpha=False)
            if pix.width < 70 or pix.height < 48:
                continue
            sufixo = "" if not blocos else f"-{len(blocos) + 1}"
            nome = f"q{numero}{sufixo}.png"
            pix.save(pasta / nome)
            blocos.append((nome, pix.width, pix.height))
        for nome, largura, altura in blocos:
            registros.append(
                {
                    "questao": numero,
                    "src": f"{prefixo_src}/{nome}",
                    "largura": largura,
                    "altura": altura,
                }
            )
    return registros


def escrever_manifesto(destino: Path, registros: list[tuple[str, dict[str, int | str]]], rotulo: str) -> None:
    por_chave: dict[str, list[dict[str, int | str]]] = {}
    for chave, item in registros:
        por_chave.setdefault(chave, []).append(item)
    linhas = [
        f"/** Gerado por scripts/extrair-figuras-senai-etec.py. Figuras {rotulo}. Nao edite a mao. */",
        "export interface FiguraManifesto {",
        "  readonly src: string",
        "  readonly alt: string",
        "  readonly largura: number",
        "  readonly altura: number",
        "}",
        "",
        "export const FIGURAS: Readonly<Record<string, readonly FiguraManifesto[]>> = {",
    ]
    for chave in sorted(por_chave, key=lambda texto: tuple(int(parte) if parte.isdigit() else 0 for parte in re.findall(r"\d+", texto))):
        linhas.append(f"  '{chave}': [")
        for item in por_chave[chave]:
            alt = f"Figura oficial da questao {item['questao']} ({rotulo}, {chave})."
            linhas.append(
                "    { src: '%s', alt: '%s', largura: %s, altura: %s },"
                % (item["src"], alt.replace("'", ""), item["largura"], item["altura"])
            )
        linhas.append("  ],")
    linhas.append("}")
    linhas.append("")
    destino.write_text("\n".join(linhas), encoding="utf-8")


def codigo_senai(caminho: Path, documento: fitz.Document) -> tuple[int, str] | None:
    if "gabarito" in caminho.name.lower() or "(1)" in caminho.name:
        return None
    texto = documento[0].get_text("text")
    cge = re.search(r"CGE\s*(\d{4})", texto, re.I)
    ano = re.search(r"(20\d{2})", caminho.name)
    if not ano:
        ano = re.search(r"(20\d{2})", texto)
    if not cge or not ano:
        return None
    return int(ano.group(1)), cge.group(1)


def codigo_etec(caminho: Path) -> tuple[int, int] | None:
    if "gabarito" in caminho.name.lower() or "prova" not in caminho.name.lower():
        return None
    ano = re.search(r"(20\d{2})", caminho.name)
    semestre = re.search(r"(\d)\s*sem", caminho.name, re.I)
    if not ano or not semestre:
        return None
    return int(ano.group(1)), int(semestre.group(1))


def processar_senai() -> list[tuple[str, dict[str, int | str]]]:
    raiz = next(ESCOLA.glob("senai-jovem-aprendiz-*"))
    registros: list[tuple[str, dict[str, int | str]]] = []
    vistos: set[str] = set()
    for caminho in sorted(raiz.rglob("*.pdf")):
        documento = fitz.open(caminho)
        codigo = codigo_senai(caminho, documento)
        if codigo is None or f"{codigo[0]}-{codigo[1]}" in vistos:
            documento.close()
            continue
        vistos.add(f"{codigo[0]}-{codigo[1]}")
        ano, cge = codigo
        pasta = RAIZ / "public" / "senai" / "figuras" / f"{ano}-{cge}"
        pasta.mkdir(parents=True, exist_ok=True)
        total = 0
        for pagina in documento:
            questoes = questoes_senai(pagina)
            novos = recortar(pagina, questoes, "senai", pasta, f"/senai/figuras/{ano}-{cge}")
            for item in novos:
                registros.append((f"senai:{ano}:{cge}:{item['questao']}", item))
            total += len(novos)
        documento.close()
        print("SENAI", ano, cge, "figuras", total)
    return registros


def processar_etec() -> list[tuple[str, dict[str, int | str]]]:
    raiz = next(ESCOLA.glob("vestibulinho-etec-*"))
    registros: list[tuple[str, dict[str, int | str]]] = []
    for caminho in sorted(raiz.rglob("*.pdf")):
        codigo = codigo_etec(caminho)
        if codigo is None:
            continue
        ano, semestre = codigo
        documento = fitz.open(caminho)
        pasta = RAIZ / "public" / "etec" / "figuras" / f"{ano}-{semestre}"
        pasta.mkdir(parents=True, exist_ok=True)
        total = 0
        for pagina in documento:
            questoes = questoes_etec(pagina)
            novos = recortar(pagina, questoes, "etec", pasta, f"/etec/figuras/{ano}-{semestre}")
            for item in novos:
                registros.append((f"etec:{ano}:{semestre}:{item['questao']}", item))
            total += len(novos)
        documento.close()
        print("ETEC", ano, semestre, "figuras", total)
    return registros


def main() -> None:
    senai = processar_senai()
    etec = processar_etec()
    bancos = RAIZ / "src" / "games" / "LogicBattle" / "ilha" / "estudo" / "bancos"
    escrever_manifesto(bancos / "figurasSenai.manifest.ts", senai, "SENAI")
    escrever_manifesto(bancos / "figurasEtec.manifest.ts", etec, "ETEC")
    print("senai", len(senai), "etec", len(etec))


if __name__ == "__main__":
    main()
