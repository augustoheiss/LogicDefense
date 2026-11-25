"""Recorta as figuras vetoriais e raster das questoes de matematica do ENEM (caderno 5 amarelo).

Versao 2 (HD + limpeza Pillow):
  - ZOOM = 3.0 para nitidez editorial.
  - Normaliza segmentos/bordas 0-pt (`width=0` ou `height=0`) para nao perder colunas/eixos no `|=` do PyMuPDF.
  - Unifica vetores (`get_drawings`) + imagens embutidas (`get_image_info`).
  - Absorve rotulos adjacentes (eixos, unidades, escalas, Figura 1/2) sem engolir paragrafos corridos.
  - Mascara em branco (#FFFFFF) linhas de enunciado que tangenciem o recorte, aplica auto-trim e margem limpa de 16 px.

Grava:
  public/enem/figuras/{ano}/q{numero}[-N].png
  src/games/LogicBattle/ilha/estudo/bancos/figurasEnem.manifest.ts
"""
from __future__ import annotations

import re
import shutil
import unicodedata
from pathlib import Path

import fitz
from PIL import Image, ImageChops, ImageDraw, ImageOps

PROVAS = Path(r"C:\Users\Usuario\Desktop\AHeiss_GoogleDrive\SERVICO-SECULAR\ESCOLA\ENEM")
RAIZ = Path(r"C:\Users\Usuario\Desktop\AHeiss_GoogleDrive\02-Programacao\projetos-IA\LogicDefense")
SAIDA = RAIZ / "public" / "enem" / "figuras"
MANIFESTO = RAIZ / "src" / "games" / "LogicBattle" / "ilha" / "estudo" / "bancos" / "figurasEnem.manifest.ts"
ZOOM = 3.0
MIN_ESP = 0.9


def sem_acento(texto: str) -> str:
    base = unicodedata.normalize("NFD", texto)
    return "".join(c for c in base if unicodedata.category(c) != "Mn").upper()


def normalizar_rect(rect: fitz.Rect) -> fitz.Rect:
    x0, y0, x1, y1 = float(rect.x0), float(rect.y0), float(rect.x1), float(rect.y1)
    if x1 - x0 < MIN_ESP * 2:
        cx = (x0 + x1) / 2
        x0, x1 = cx - MIN_ESP, cx + MIN_ESP
    if y1 - y0 < MIN_ESP * 2:
        cy = (y0 + y1) / 2
        y0, y1 = cy - MIN_ESP, cy + MIN_ESP
    return fitz.Rect(x0, y0, x1, y1)


def unir(rects: list[fitz.Rect]) -> fitz.Rect:
    caixa = fitz.Rect(rects[0])
    for rect in rects[1:]:
        caixa |= rect
    return caixa


def linhas_da_pagina(pagina: fitz.Page, x0: float | None = None, x1: float | None = None) -> list[list[tuple]]:
    palavras_brutas = pagina.get_text("words")
    if x0 is not None and x1 is not None:
        palavras_brutas = [p for p in palavras_brutas if x0 - 4 <= p[0] and p[2] <= x1 + 4]
    palavras = sorted(palavras_brutas, key=lambda p: (round(p[1] / 3.0), p[0]))
    linhas: list[list[tuple]] = []
    indice = 0
    while indice < len(palavras):
        y_ref = palavras[indice][1]
        linha = [palavras[indice]]
        proximo = indice + 1
        while proximo < len(palavras) and abs(palavras[proximo][1] - y_ref) < 4.5:
            linha.append(palavras[proximo])
            proximo += 1
        linha.sort(key=lambda p: p[0])
        linhas.append(linha)
        indice = proximo
    return linhas


def linha_e_paragrafo_enunciado(linha: list[tuple]) -> bool:
    texto = " ".join(p[4] for p in linha)
    if re.search(r"^(Figura|Gr[aá]fico|Tabela|Fonte)\b", texto, re.I):
        return False
    larg = linha[-1][2] - linha[0][0]
    palavras_texto = [p[4] for p in linha if sum(ch.islower() for ch in p[4]) >= 2]
    if len(palavras_texto) >= 4 and larg >= 115:
        return True
    if re.search(r"[?!]\s*$", texto) and len(palavras_texto) >= 2:
        return True
    if re.search(r"[.,;:]\s*$", texto) and len(palavras_texto) >= 3 and larg >= 100:
        return True
    return False


def questoes_na_pagina(pagina: fitz.Page) -> list[tuple[int, float, float]]:
    """Detecta cabecalhos 'QUESTAO 136..180' evitando falsos positivos no miolo do texto."""
    achados: list[tuple[int, float, float]] = []
    for linha in linhas_da_pagina(pagina):
        if linha[0][1] < 45 or linha[0][1] > pagina.rect.height - 40:
            continue
        for inicio in range(len(linha)):
            acumulado = ""
            cursor = inicio
            while cursor < len(linha) and len(acumulado) < 7:
                acumulado += sem_acento(linha[cursor][4])
                cursor += 1
                if acumulado in ("QUESTAO", "UESA"):
                    if cursor < len(linha) and linha[cursor][4].isascii() and linha[cursor][4].isdigit():
                        valor = int(linha[cursor][4])
                        if 136 <= valor <= 180:
                            achados.append((valor, linha[inicio][0], linha[inicio][1]))
                    break
                if not ("QUESTAO".startswith(acumulado) or "UESA".startswith(acumulado)):
                    break
    # Fallback somente se o titulo nao contiver palavra QUESTAO (provas 2009-2010 espaçadas)
    if not achados:
        for linha in linhas_da_pagina(pagina):
            if linha[0][4] in ("A", "B", "C", "D", "E"):
                continue
            if len(linha) <= 3:
                for p in linha:
                    if p[4].isascii() and p[4].isdigit():
                        val = int(p[4])
                        if 136 <= val <= 180 and (p[0] < 110 or 270 < p[0] < 395) and 60 <= p[1] <= pagina.rect.height - 60:
                            achados.append((val, max(20.0, p[0] - 40.0), p[1]))
                            break
    vistos: dict[int, tuple[int, float, float]] = {}
    for item in sorted(achados, key=lambda t: (t[2], t[1])):
        if item[0] not in vistos:
            vistos[item[0]] = item
    return sorted(vistos.values(), key=lambda t: (t[2], t[1]))


def e_duas_colunas(questoes: list[tuple[int, float, float]], pagina: fitz.Page) -> bool:
    if len(questoes) >= 2:
        xs = [item[1] for item in questoes]
        if max(xs) - min(xs) > 140:
            return True
    # Mesmo com 1 questao detectada, caderno ENEM regular e 2 colunas (~280-315pt centro)
    return pagina.rect.width > 480


def limites_da_coluna(pagina: fitz.Page, x_titulo: float, duas: bool) -> tuple[float, float]:
    if not duas:
        return pagina.rect.x0 + 20, pagina.rect.x1 - 20
    meio = pagina.rect.width / 2
    if x_titulo < meio - 12:
        return pagina.rect.x0 + 18, meio - 8
    return meio + 8, pagina.rect.x1 - 18


def y_das_alternativas(linhas: list[list[tuple]], x0: float, x1: float, y_titulo: float, y_fim: float) -> float:
    candidatas: list[tuple[float, str]] = []
    for linha in linhas:
        y = linha[0][1]
        if not (y_titulo + 26 < y < y_fim):
            continue
        for p in linha:
            if p[4] in ("A", "B", "C", "D", "E") and x0 - 6 <= p[0] <= x0 + 48:
                candidatas.append((p[1], p[4]))
                break
    candidatas.sort()
    for idx, (y_a, letra) in enumerate(candidatas):
        if letra != "A":
            continue
        cursor = y_a
        ok = True
        for alvo in "ABCDE":
            achou = next((it for it in candidatas[idx:] if it[1] == alvo and cursor - 3 <= it[0] <= cursor + 42), None)
            if achou is None:
                ok = False
                break
            cursor = achou[0] + 6
        if ok:
            return y_a
    return y_fim


def coletar_elementos_faixa(
    pagina: fitz.Page, x0: float, x1: float, y0: float, y1: float
) -> list[fitz.Rect]:
    meio = pagina.rect.width / 2
    elementos: list[fitz.Rect] = []
    for d in pagina.get_drawings():
        r = fitz.Rect(d["rect"])
        # Ignora ondas de cabecalho, marcas de corte/margem e rodapes
        if r.y0 < 54 or r.y1 > pagina.rect.height - 34 or r.x0 < 16 or r.x1 > pagina.rect.width - 12:
            continue
        # Ignora filete divisor vertical central ou micro-colunas laterais
        if r.height > 150 and r.width < 5.0 and abs(((r.x0 + r.x1) / 2) - meio) < 20:
            continue
        # Ignora coluna vertical de bolinhas das alternativas A..E (2009-2013)
        if r.width < 12 and 35 < r.height < 85 and (abs(r.x0 - x0) < 38 or abs(r.x0 - (meio + 8)) < 38):
            continue
        if r.width > pagina.rect.width * 0.88 or r.height > pagina.rect.height * 0.72:
            continue
        if r.width < 1.0 and r.height < 1.0:
            continue
        rn = normalizar_rect(r)
        cx = (rn.x0 + rn.x1) / 2
        cy = (rn.y0 + rn.y1) / 2
        if x0 <= cx <= x1 and y0 <= cy <= y1:
            elementos.append(rn)

    for info in pagina.get_image_info():
        r = fitz.Rect(info["bbox"])
        if r.y0 < 54 or r.y1 > pagina.rect.height - 34 or r.x0 < 14:
            continue
        if r.width < 26 or r.height < 20:
            continue
        if r.height < 22 and r.width > 120:
            continue
        if r.width > pagina.rect.width * 0.88 and r.height > pagina.rect.height * 0.72:
            continue
        rn = normalizar_rect(r)
        cx = (rn.x0 + rn.x1) / 2
        cy = (rn.y0 + rn.y1) / 2
        if x0 <= cx <= x1 and y0 <= cy <= y1:
            elementos.append(rn)
    return elementos


def agrupar_2d(rects: list[fitz.Rect], folga_x: float = 24, folga_y: float = 24) -> list[list[fitz.Rect]]:
    """Agrupa elementos vetoriais/imagem em 2D usando flood-fill por proximidade."""
    restantes = list(rects)
    grupos: list[list[fitz.Rect]] = []
    while restantes:
        semente = restantes.pop(0)
        grupo = [semente]
        caixa = fitz.Rect(semente)
        mudou = True
        while mudou:
            mudou = False
            novos_restantes = []
            expandida = fitz.Rect(caixa.x0 - folga_x, caixa.y0 - folga_y, caixa.x1 + folga_x, caixa.y1 + folga_y)
            for r in restantes:
                if expandida.intersects(r):
                    grupo.append(r)
                    caixa |= r
                    expandida = fitz.Rect(caixa.x0 - folga_x, caixa.y0 - folga_y, caixa.x1 + folga_x, caixa.y1 + folga_y)
                    mudou = True
                else:
                    novos_restantes.append(r)
            restantes = novos_restantes
        grupos.append(grupo)
    grupos.sort(key=lambda g: (min(r.y0 for r in g), min(r.x0 for r in g)))
    return grupos


def linha_residual_fora_figura(linha: list[tuple]) -> bool:
    texto = " ".join(p[4] for p in linha).strip()
    if re.search(r"^(Figura|Gr[aá]fico|Tabela|Fonte)\b", texto, re.I):
        return False
    if re.match(r"^[A-E]\s+\S+", texto) and not re.match(r"^[A-E]\s*$", texto):
        # Evita confundir rotulo isolado "A" de grafico; exige palavra apos letra
        if len(linha) >= 2 and (linha[1][0] - linha[0][2]) >= 3:
            return True
    palavras_texto = [p[4] for p in linha if sum(ch.isalpha() for ch in p[4]) >= 2]
    if re.search(r"[.:?]\s*$", texto) and len(palavras_texto) >= 2:
        return True
    return linha_e_paragrafo_enunciado(linha)


def absorver_rotulos_adjacentes(
    caixa: fitz.Rect,
    linhas_faixa: list[list[tuple]],
    x_lim0: float,
    x_lim1: float,
    y_lim0: float,
    y_lim1: float,
) -> tuple[fitz.Rect, list[fitz.Rect]]:
    """Expande a caixa da figura para englobar eixos, numeros e legendas curtas,
    devolvendo tambem as caixas de linhas de enunciado corrido fora do miolo que precisem ser mascaradas.
    """
    expandida = fitz.Rect(caixa)
    mascarar: list[fitz.Rect] = []
    # 2 passadas para encadear rotulos proximos (ex.: eixo Y -> unidade acima, ou ticks X -> titulo do eixo abaixo)
    for _ in range(2):
        zona = fitz.Rect(
            max(x_lim0, expandida.x0 - 42),
            max(y_lim0, expandida.y0 - 22),
            min(x_lim1, expandida.x1 + 36),
            min(y_lim1, expandida.y1 + 26),
        )
        for linha in linhas_faixa:
            lr = fitz.Rect(linha[0][0], min(p[1] for p in linha), linha[-1][2], max(p[3] for p in linha))
            if lr.y0 < y_lim0 or lr.y1 > y_lim1:
                continue
            if not zona.intersects(lr):
                continue
            cy_linha = (lr.y0 + lr.y1) / 2
            dentro_vertical_miolo = (caixa.y0 + 2 <= cy_linha <= caixa.y1 - 2)
            if not dentro_vertical_miolo and linha_residual_fora_figura(linha):
                mascarar.append(fitz.Rect(lr.x0 - 3, lr.y0 - 2, lr.x1 + 3, lr.y1 + 2))
                continue
            if not dentro_vertical_miolo or lr.x0 < expandida.x0 or lr.x1 > expandida.x1:
                expandida |= lr

    # Garante mascara em qualquer linha residual que ainda tangencie a caixa expandida fora do miolo
    clip_prev = fitz.Rect(expandida.x0 - 8, expandida.y0 - 8, expandida.x1 + 8, expandida.y1 + 8)
    for linha in linhas_faixa:
        lr = fitz.Rect(linha[0][0], min(p[1] for p in linha), linha[-1][2], max(p[3] for p in linha))
        if not clip_prev.intersects(lr):
            continue
        cy_linha = (lr.y0 + lr.y1) / 2
        dentro_vertical_miolo = (caixa.y0 + 2 <= cy_linha <= caixa.y1 - 2)
        if not dentro_vertical_miolo and linha_residual_fora_figura(linha):
            mascarar.append(fitz.Rect(lr.x0 - 3, lr.y0 - 2, lr.x1 + 3, lr.y1 + 2))

    return expandida, mascarar


def limpar_imagem_hd(
    pix: fitz.Pixmap,
    clip_rect: fitz.Rect,
    mascaras_pdf: list[fitz.Rect],
    margem_px: int = 16,
) -> Image.Image | None:
    img = Image.frombytes("RGB", [pix.width, pix.height], pix.samples)
    draw = ImageDraw.Draw(img)

    # Mascara em branco puro eventuais linhas de enunciado corrido que invadiram o recorte
    for m in mascaras_pdf:
        inter = m & clip_rect
        if inter.is_empty:
            continue
        x0 = max(0, int((inter.x0 - clip_rect.x0) * ZOOM) - 2)
        y0 = max(0, int((inter.y0 - clip_rect.y0) * ZOOM) - 2)
        x1 = min(img.width, int((inter.x1 - clip_rect.x0) * ZOOM) + 2)
        y1 = min(img.height, int((inter.y1 - clip_rect.y0) * ZOOM) + 2)
        if x1 > x0 and y1 > y0:
            draw.rectangle([x0, y0, x1, y1], fill=(255, 255, 255))

    # Normaliza fundo quase branco (>246 em todos canais) para branco puro #ffffff
    # preservando antialiasing e preenchimentos coloridos suaves
    gray = img.convert("L")
    # Encontra bounding box de qualquer pixel nao branco (< 244 de luminancia ou colorido)
    bg = Image.new("RGB", img.size, (255, 255, 255))
    diff = ImageChops.difference(img, bg)
    diff_gray = diff.convert("L").point(lambda p: 255 if p > 10 else 0)
    bbox = diff_gray.getbbox()
    if not bbox:
        return None
    l, t, r, b = bbox
    if r - l < 55 or b - t < 40:
        return None
    recortada = img.crop((l, t, r, b))
    # Limpeza leve das bordas
    final = ImageOps.expand(recortada, border=margem_px, fill=(255, 255, 255))
    del gray
    return final


def classificar_tipo_visual(grupo: list[fitz.Rect], tem_img: bool) -> str:
    horizontais = sum(1 for r in grupo if r.height <= 3.0 and r.width >= 25)
    verticais = sum(1 for r in grupo if r.width <= 3.0 and r.height >= 14)
    if horizontais >= 4 and verticais >= 3:
        return "tabela"
    if len(grupo) >= 6 and (horizontais >= 2 or verticais >= 2):
        return "grafico"
    if not tem_img and len(grupo) >= 2:
        return "geometria"
    return "ilustracao"


def recortar_pagina(
    pagina: fitz.Page,
    ano: int,
    pasta: Path,
    chaves_vistas: set[tuple[int, int]],
) -> list[dict[str, int | str]]:
    questoes = questoes_na_pagina(pagina)
    if not questoes:
        return []
    duas = e_duas_colunas(questoes, pagina)
    linhas_all = linhas_da_pagina(pagina)
    meio = pagina.rect.width / 2
    registros: list[dict[str, int | str]] = []

    for numero, x_titulo, y_titulo in questoes:
        if (ano, numero) in chaves_vistas:
            continue
        x0, x1 = limites_da_coluna(pagina, x_titulo, duas)
        mesma_coluna = [
            item[2]
            for item in questoes
            if item[2] > y_titulo + 8 and (not duas or (item[1] < meio) == (x_titulo < meio))
        ]
        y_fim = min(mesma_coluna) if mesma_coluna else pagina.rect.height - 36
        linhas_col = linhas_da_pagina(pagina, x0, x1)
        y_alternativas = y_das_alternativas(linhas_col, x0, x1, y_titulo, y_fim)
        y_inicio = y_titulo + 15
        y_limite = max(y_inicio + 10, y_alternativas - 3)

        rects = coletar_elementos_faixa(pagina, x0, x1, y_inicio, y_limite)
        # Apenas amplia para largura total se NAO houver outra questao na coluna oposta nesta faixa
        # e houver realmente figura/tabela de grande porte cruzando o divisor central
        if duas:
            outra_coluna_ocupa = any(
                (item[1] < meio) != (x_titulo < meio)
                and item[2] <= y_limite
                and (item[2] + 90 >= y_inicio)
                for item in questoes
            )
            if not outra_coluna_ocupa:
                larga_faixa = coletar_elementos_faixa(pagina, pagina.rect.x0 + 18, pagina.rect.x1 - 18, y_inicio, y_limite)
                cruza_divisor = any(
                    r.x0 < meio - 35
                    and r.x1 > meio + 35
                    and r.height >= 18
                    and r.width < pagina.rect.width * 0.78
                    for r in larga_faixa
                )
                if cruza_divisor:
                    x0 = pagina.rect.x0 + 18
                    x1 = pagina.rect.x1 - 18
                    rects = larga_faixa
                    linhas_col = linhas_da_pagina(pagina, x0, x1)

        linhas_faixa = [l for l in linhas_col if y_inicio - 4 <= l[0][1] <= y_limite + 4]
        imagens_na_faixa = [fitz.Rect(im["bbox"]) for im in pagina.get_image_info()]

        blocos_salvos: list[tuple[str, int, int, str]] = []
        for grupo in agrupar_2d(rects, folga_x=26, folga_y=26):
            caixa = unir(grupo)
            if caixa.width < 36 or caixa.height < 24:
                continue
            caixa_rotulos, mascaras = absorver_rotulos_adjacentes(caixa, linhas_faixa, x0, x1, y_inicio, y_limite)

            # Descarta falsos positivos de faixa de cabecalho ou texto sem desenho real
            palavras_dentro = sum(
                len(l) for l in linhas_faixa if caixa_rotulos.intersects(fitz.Rect(l[0][0], l[0][1], l[-1][2], l[-1][3]))
            )
            tem_img = any(caixa.intersects(ir) and ir.width > 28 and ir.height > 24 for ir in imagens_na_faixa)
            if palavras_dentro >= 42 and len(grupo) < 4 and not tem_img:
                continue

            clip = fitz.Rect(
                max(x0, caixa_rotulos.x0 - 8),
                max(y_inicio, caixa_rotulos.y0 - 8),
                min(x1, caixa_rotulos.x1 + 8),
                min(y_limite + 2, caixa_rotulos.y1 + 8),
            ) & pagina.rect
            if clip.width < 38 or clip.height < 26:
                continue

            pix = pagina.get_pixmap(matrix=fitz.Matrix(ZOOM, ZOOM), clip=clip, alpha=False)
            limpa = limpar_imagem_hd(pix, clip, mascaras, margem_px=16)
            if limpa is None or limpa.width < 75 or limpa.height < 52:
                continue

            sufixo = "" if not blocos_salvos else f"-{len(blocos_salvos) + 1}"
            nome = f"q{numero}{sufixo}.png"
            limpa.save(pasta / nome, format="PNG", optimize=True)
            tipo_vis = classificar_tipo_visual(grupo, tem_img)
            blocos_salvos.append((nome, limpa.width, limpa.height, tipo_vis))

        if blocos_salvos:
            chaves_vistas.add((ano, numero))
            for ordem, (nome, largura, altura, tipo_vis) in enumerate(blocos_salvos, start=1):
                registros.append(
                    {
                        "ano": ano,
                        "questao": numero,
                        "src": f"/enem/figuras/{ano}/{nome}",
                        "largura": largura,
                        "altura": altura,
                        "ordem": ordem,
                        "tipoVisual": tipo_vis,
                    }
                )
    return registros


def escrever_manifesto(registros: list[dict[str, int | str]]) -> None:
    por_chave: dict[str, list[dict[str, int | str]]] = {}
    for item in registros:
        por_chave.setdefault(f"{item['ano']}:{item['questao']}", []).append(item)
    linhas = [
        "/** Gerado por scripts/extrair-figuras-enem.py (v2 HD). Nao edite a mao. */",
        "export interface FiguraManifesto {",
        "  readonly src: string",
        "  readonly alt: string",
        "  readonly largura: number",
        "  readonly altura: number",
        "  readonly papel: 'enunciado'",
        "  readonly tipoVisual?: 'grafico' | 'tabela' | 'geometria' | 'ilustracao'",
        "}",
        "",
        "export const FIGURAS_ENEM: Readonly<Record<string, readonly FiguraManifesto[]>> = {",
    ]
    for chave in sorted(por_chave, key=lambda texto: (int(texto.split(":")[0]), int(texto.split(":")[1]))):
        ano, questao = chave.split(":")
        linhas.append(f"  '{chave}': [")
        for item in por_chave[chave]:
            alt = f"Figura da questao {questao} do ENEM {ano} (Caderno 5 Amarelo)"
            linhas.append(
                "    { src: '%s', alt: '%s', largura: %s, altura: %s, papel: 'enunciado', tipoVisual: '%s' },"
                % (item["src"], alt, item["largura"], item["altura"], item["tipoVisual"])
            )
        linhas.append("  ],")
    linhas.append("}")
    linhas.append("")
    MANIFESTO.write_text("\n".join(linhas), encoding="utf-8")


def main() -> None:
    SAIDA.mkdir(parents=True, exist_ok=True)
    registros: list[dict[str, int | str]] = []
    usados: set[Path] = set()
    provas = sorted(caminho for caminho in PROVAS.glob("*.pdf") if "GABARITO" not in caminho.name.upper())
    for prova in provas:
        ano = int(prova.name[:4])
        if ano < 2009:
            continue
        pasta = SAIDA / str(ano)
        pasta.mkdir(parents=True, exist_ok=True)
        documento = fitz.open(prova)
        na_matematica = False
        do_ano = 0
        chaves_vistas: set[tuple[int, int]] = set()
        for pagina in documento:
            texto = sem_acento(pagina.get_text("text"))
            if "MATEM" in texto and "TECNOLOG" in texto:
                na_matematica = True
            if not na_matematica:
                continue
            novos = recortar_pagina(pagina, ano, pasta, chaves_vistas)
            registros.extend(novos)
            for item in novos:
                usados.add(pasta / Path(str(item["src"])).name)
            do_ano += len(novos)
        documento.close()
        print("ENEM", ano, "figuras", do_ano)
    removidos = 0
    for antigo in SAIDA.rglob("*.png"):
        if antigo not in usados:
            antigo.unlink(missing_ok=True)
            removidos += 1
    escrever_manifesto(registros)
    print("total ENEM", len(registros), "removidos", removidos, "manifesto", MANIFESTO)


if __name__ == "__main__":
    main()
