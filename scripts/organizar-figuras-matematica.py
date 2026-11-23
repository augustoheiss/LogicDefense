"""Extrator unificado v2 HD para SENAI e ETEC — somente matematica, sem bordas sujas.

Melhorias v2:
  - Normaliza linhas/segmentos 0-pt (`width=0` ou `height=0`) para unir tabelas/eixos completos.
  - ZOOM = 2.8 + absorcao de rotulos curtos e mascara branca em linhas de enunciado corrido.
  - Limpeza Pillow: remove sombras externas/ruido quase branco (>238 em ETEC ou >245 em SENAI),
    faz auto-trim e aplica margem branca uniforme de 14 px.
  - Filtro de matematica SENAI (maior trecho consecutivo) e lista auditada ETEC.
"""
from __future__ import annotations

import importlib.util
import re
import shutil
from pathlib import Path

import fitz
from PIL import Image, ImageChops, ImageDraw, ImageOps

RAIZ = Path(r"C:\Users\Usuario\Desktop\AHeiss_GoogleDrive\02-Programacao\projetos-IA\LogicDefense")
ESCOLA = Path(r"C:\Users\Usuario\Desktop\AHeiss_GoogleDrive\SERVICO-SECULAR\ESCOLA")
ZOOM_HD = 2.8

spec = importlib.util.spec_from_file_location(
    "corte",
    RAIZ / "scripts" / "extrair-figuras-senai-etec.py",
)
corte = importlib.util.module_from_spec(spec)
spec.loader.exec_module(corte)

MATEMATICA = (
    "matematic", "equacao", "expressao algebrica", "produto cartesiano", "conjunto",
    "triangulo", "poligono", "quadrilatero", "perimetro", "area", "volume",
    "porcentagem", "juros", "media aritmetica", "probabilidade", "funcao",
    "grafico", "angulo", "pitagora", "fracao", "geometria", "prisma", "cilindro",
    "circunferencia", "parabola", "coordenada", "razao", "proporc", "metro quadrado",
    "tonelada", "jarda", "regra de tres", "bhaskara", "potencia", "raiz quadrada",
    "solido", "aresta", "vertice", "diagonal", "losango", "trapezio", "hexagono",
    "estatistica", "mediana", "moda", "desvio", "fatorial", "combinat", "altura",
    "emprestimo", "suco", "tecido", "largura", "comprimento",
)
LINGUA = (
    "cancao", "poema", "tirinha", "quadrinhos", "concordancia", "silabica", "crase", "verbo",
    "substantivo", "charge", "cartum", "texto abaixo", "coesao", "coerencia",
    "figura de linguagem", "sujeito", "predicado", "ortograf",
)
CIENCIA = (
    "celula", "atomo", "molecula", "quimica", "dna", "glandula", "manometro",
    "respiracao celular", "circuito", "termometro", "forca aplicada", "optica",
    "rebite", "sangue", "fotossintese", "ecologia", "historia",
    "revolucao", "guerra", "geografia", "territorio",
    "empuxo", "densidade", "soda caustica", "cadeia alimentar", "salina",
    "diafragma", "litosfera", "magma", "espectro", "clonagem", "virus",
    "radiacao", "ultravioleta", "dilatacao", "espelho concavo", "peixe eletrico",
    "proteina", "lipidio", "vitamina", "calor especifico", "agua potavel",
    "gelo seco", "gelo-seco", "refrat", "barra metalica", "condutividade termica",
)

FORA_DE_MATEMATICA = (
    "transformacao quimica", "agua pura", "vestibulinho", "espectro eletromagnet",
    "cadeia alimentar", "soda caustica", "quadrinhos", "temperatura inicial",
    "dilatacao", "espelho concavo", "calor especifico", "lembre-se",
    "leia o texto para responder", "tinyurl.com", "original colorido", "acesso em:",
)


def normalizar(texto: str) -> str:
    return corte.sem_acento(texto).lower()


def norm_rect(r: fitz.Rect) -> fitz.Rect:
    x0, y0, x1, y1 = float(r.x0), float(r.y0), float(r.x1), float(r.y1)
    if x1 - x0 < 1.8:
        cx = (x0 + x1) / 2
        x0, x1 = cx - 0.9, cx + 0.9
    if y1 - y0 < 1.8:
        cy = (y0 + y1) / 2
        y0, y1 = cy - 0.9, cy + 0.9
    return fitz.Rect(x0, y0, x1, y1)


def unir_norm(rects: list[fitz.Rect]) -> fitz.Rect:
    caixa = fitz.Rect(rects[0])
    for r in rects[1:]:
        caixa |= r
    return caixa


def pontuar(texto: str) -> int:
    base = normalizar(texto)
    nota = sum(2 for termo in MATEMATICA if termo in base)
    nota -= sum(3 for termo in LINGUA if termo in base)
    nota -= sum(3 for termo in CIENCIA if termo in base)
    if re.search(r"\d+\s*(%|m2|m3|cm|km|kg|g|l)\b", base):
        nota += 1
    return nota


def texto_da_questao(pagina: fitz.Page, y0: float, y1: float) -> str:
    palavras = [p[4] for p in pagina.get_text("words") if y0 - 2 <= p[1] < y1]
    return " ".join(palavras)


def bloco_matematica_senai(numeros_notas: list[tuple[int, int]]) -> set[int]:
    por_numero: dict[int, int] = {}
    for numero, nota in numeros_notas:
        por_numero[numero] = max(por_numero.get(numero, -999), nota)
    melhor: list[int] = []
    melhor_soma = -1
    atual: list[int] = []

    def fechar() -> None:
        nonlocal atual, melhor, melhor_soma
        fortes = sum(1 for n in atual if por_numero[n] >= 2)
        if fortes >= 4 and len(atual) >= 6:
            total = sum(max(por_numero[n], 0) for n in atual)
            if total > melhor_soma:
                melhor = list(atual)
                melhor_soma = total
        atual = []

    for numero in sorted(por_numero):
        nota = por_numero[numero]
        if nota < 0 or (atual and numero != atual[-1] + 1):
            fechar()
        if nota < 0:
            continue
        atual.append(numero)
    fechar()
    return set(melhor)


def letras_das_alternativas(pagina: fitz.Page, estilo: str, x0: float, y0: float, y1: float) -> list[tuple[str, float, float]]:
    marcas = {"a.": "A", "b.": "B", "c.": "C", "d.": "D", "e.": "E"} if estilo == "senai" else {"(A)": "A", "(B)": "B", "(C)": "C", "(D)": "D", "(E)": "E"}
    achadas = []
    for p in pagina.get_text("words"):
        letra = marcas.get(p[4])
        if letra and x0 - 12 <= p[0] <= x0 + 90 and y0 + 10 < p[1] < y1:
            achadas.append((letra, p[0], p[1]))
    achadas.sort(key=lambda item: item[2])
    vistas = []
    usadas = set()
    for item in achadas:
        if item[0] in usadas:
            continue
        usadas.add(item[0])
        vistas.append(item)
    return vistas


def papel_do_bloco(caixa: fitz.Rect, letras: list[tuple[str, float, float]], y_primeira: float) -> tuple[str, str | None]:
    centro_y = (caixa.y0 + caixa.y1) / 2
    if letras and centro_y >= letras[0][2] - 8:
        melhor = None
        melhor_dist = 10**9
        for letra, _x, y in letras:
            dist = abs(centro_y - y)
            if dist < melhor_dist:
                melhor = letra
                melhor_dist = dist
        if melhor and melhor_dist < 70:
            return "alternativa", melhor
    return "enunciado", None


def palavras_na_caixa(pagina: fitz.Page, caixa: fitz.Rect) -> list:
    return [p for p in pagina.get_text("words") if caixa.x0 - 4 <= p[0] <= caixa.x1 + 4 and caixa.y0 - 4 <= p[1] <= caixa.y1 + 4]


def texto_da_caixa(palavras: list) -> str:
    return normalizar(" ".join(p[4] for p in palavras))


def rects_norm_da_faixa(pagina: fitz.Page, x0: float, x1: float, y0: float, y1: float) -> list[fitz.Rect]:
    faixa: list[fitz.Rect] = []
    for desenho in pagina.get_drawings():
        r = fitz.Rect(desenho["rect"])
        if r.width > pagina.rect.width * 0.92 or r.height > pagina.rect.height * 0.78:
            continue
        if r.width < 1.0 and r.height < 1.0:
            continue
        rn = norm_rect(r)
        cx, cy = (rn.x0 + rn.x1) / 2, (rn.y0 + rn.y1) / 2
        if x0 <= cx <= x1 and y0 <= cy <= y1:
            faixa.append(rn)
    for info in pagina.get_image_info():
        r = fitz.Rect(info["bbox"])
        if r.width < 34 or r.height < 24:
            continue
        if r.y0 < 42 and r.height < 70:
            continue
        if r.width > pagina.rect.width * 0.92 and r.height > pagina.rect.height * 0.82:
            continue
        rn = norm_rect(r)
        cx, cy = (rn.x0 + rn.x1) / 2, (rn.y0 + rn.y1) / 2
        if x0 <= cx <= x1 and y0 <= cy <= y1:
            faixa.append(rn)
    return faixa


def caixa_e_quadro_dados(pagina: fitz.Page, rect: fitz.Rect) -> bool:
    texto = texto_da_caixa(palavras_na_caixa(pagina, rect))
    return texto.startswith(("dado:", "dados:", "lembre-se", "considere que"))


def caixas_de_figura(pagina: fitz.Page, grupo: list[fitz.Rect]) -> list[fitz.Rect]:
    grupo_limpo = [r for r in grupo if not caixa_e_quadro_dados(pagina, r)]
    if not grupo_limpo:
        return []
    caixa = unir_norm(grupo_limpo)
    palavras = palavras_na_caixa(pagina, caixa)
    texto = texto_da_caixa(palavras)
    if texto.startswith(("dado:", "dados:", "lembre-se", "considere que")):
        return []
    proibido = any(termo in texto for termo in FORA_DE_MATEMATICA)
    if not proibido and len(palavras) < 40:
        return [caixa]
    miudas = []
    for rect in grupo_limpo:
        if rect.width < 34 or rect.height < 22:
            continue
        internas = palavras_na_caixa(pagina, rect)
        miudo = texto_da_caixa(internas)
        if any(termo in miudo for termo in FORA_DE_MATEMATICA):
            continue
        if len(internas) >= 18:
            continue
        miudas.append(rect)
    return [unir_norm(sub) for sub in corte.agrupar(miudas, 18)]


def linhas_texto_para_mascara(pagina: fitz.Page, caixa: fitz.Rect, y_min: float, y_max: float) -> list[fitz.Rect]:
    mascarar: list[fitz.Rect] = []
    for linha in corte.linhas_da_pagina(pagina):
        lr = fitz.Rect(linha[0][0], min(p[1] for p in linha), linha[-1][2], max(p[3] for p in linha))
        if lr.y1 < y_min - 2 or lr.y0 > y_max + 2:
            continue
        raw = " ".join(p[4] for p in linha).strip()
        txt = normalizar(raw)
        e_legenda_lixo = any(t in txt for t in ("tinyurl", "acesso em", "original colorido", "fonte:", "questao", "dado:", "dados:"))
        palavras_alfa = [p[4] for p in linha if sum(ch.isalpha() for ch in p[4]) >= 2]
        e_alternativa = bool(re.match(r"^(?:\([A-E]\)|[a-e]\.)\s*\S*", txt, re.I))
        termina_pontuacao = bool(re.search(r"[.:?]\s*$", raw)) and len(palavras_alfa) >= 2
        larg = lr.width
        e_texto_corrido = (len(linha) >= 5 and larg >= 120) or e_legenda_lixo or e_alternativa or termina_pontuacao
        if not e_texto_corrido:
            continue
        # Mascarar se tangenciar fora do miolo, for alternativa, frase pontuada ou contiver URL/fonte
        if e_legenda_lixo or e_alternativa or lr.y0 < caixa.y0 + 5 or lr.y1 > caixa.y1 - 5:
            mascarar.append(fitz.Rect(lr.x0 - 4, lr.y0 - 3, lr.x1 + 4, lr.y1 + 3))
    return mascarar


def limpar_imagem(pix: fitz.Pixmap, clip: fitz.Rect, mascaras: list[fitz.Rect], limpar_sombra_etec: bool) -> Image.Image | None:
    img = Image.frombytes("RGB", [pix.width, pix.height], pix.samples)
    draw = ImageDraw.Draw(img)
    for m in mascaras:
        inter = m & clip
        if inter.is_empty:
            continue
        x0 = max(0, int((inter.x0 - clip.x0) * ZOOM_HD) - 2)
        y0 = max(0, int((inter.y0 - clip.y0) * ZOOM_HD) - 2)
        x1 = min(img.width, int((inter.x1 - clip.x0) * ZOOM_HD) + 2)
        y1 = min(img.height, int((inter.y1 - clip.y0) * ZOOM_HD) + 2)
        if x1 > x0 and y1 > y0:
            draw.rectangle([x0, y0, x1, y1], fill=(255, 255, 255))

    # Em imagens da ETEC, a borda extrema costuma carregar drop-shadow cinza do PDF: remove anel cinza periferico muito claro
    if limpar_sombra_etec:
        px = img.load()
        w, h = img.size
        marg = min(18, w // 12, h // 12)
        for y in range(h):
            for x in range(w):
                if x < marg or x >= w - marg or y < marg or y >= h - marg:
                    r, g, b = px[x, y]
                    # Sombra cinza neutra externa clara (> 175)
                    if max(r, g, b) - min(r, g, b) < 12 and r > 175:
                        px[x, y] = (255, 255, 255)

    bg = Image.new("RGB", img.size, (255, 255, 255))
    diff = ImageChops.difference(img, bg).convert("L").point(lambda p: 255 if p > 12 else 0)
    bbox = diff.getbbox()
    if not bbox:
        return None
    l, t, r, b = bbox
    if r - l < 58 or b - t < 42:
        return None
    return ImageOps.expand(img.crop((l, t, r, b)), border=14, fill=(255, 255, 255))


def organizar_prova(
    caminho: Path,
    estilo: str,
    pasta: Path,
    prefixo_src: str,
    chave_de: callable,
    so_questoes: set[int] | None = None,
) -> tuple[list[tuple[str, dict]], set[int]]:
    documento = fitz.open(caminho)
    notas: list[tuple[int, int, int, float]] = []
    for indice, pagina in enumerate(documento):
        questoes = corte.questoes_senai(pagina) if estilo == "senai" else corte.questoes_etec(pagina)
        for pos, (numero, _x, y0) in enumerate(questoes):
            y1 = questoes[pos + 1][2] if pos + 1 < len(questoes) else pagina.rect.height - 30
            notas.append((numero, pontuar(texto_da_questao(pagina, y0, y1)), indice, y0))
    if estilo == "senai":
        aceitas = bloco_matematica_senai([(numero, nota) for numero, nota, _i, _y in notas])
    else:
        aceitas = so_questoes if so_questoes is not None else {numero for numero, nota, _i, _y in notas if nota >= 4}

    registros: list[tuple[str, dict]] = []
    for pagina in documento:
        todas = corte.questoes_senai(pagina) if estilo == "senai" else corte.questoes_etec(pagina)
        questoes = [item for item in todas if item[0] in aceitas]
        if not questoes:
            continue
        duas = corte.e_duas_colunas(todas)
        for numero, x_titulo, y_titulo in questoes:
            if so_questoes is not None and numero not in so_questoes:
                continue
            x0, x1 = corte.limites_da_coluna(pagina, x_titulo, duas)
            abaixo = [
                item[2]
                for item in todas
                if item[2] > y_titulo + 8
                and (not duas or (item[1] < pagina.rect.width / 2) == (x_titulo < pagina.rect.width / 2))
            ]
            y_fim = min(abaixo) if abaixo else pagina.rect.height - 36
            letras = letras_das_alternativas(pagina, estilo, x0, y_titulo, y_fim)
            y_alt = letras[0][2] if letras else y_fim
            y_ini = y_titulo + 12
            rects = rects_norm_da_faixa(pagina, x0, x1, y_ini, y_fim - 4)
            # Se nao houver figuras abaixo das alternativas, limita blocos de enunciado acima de y_alt
            tem_bloco_alt = any(((r.y0 + r.y1) / 2) >= y_alt - 8 and not caixa_e_quadro_dados(pagina, r) and r.width >= 38 and r.height >= 26 for r in rects)
            if letras and not tem_bloco_alt:
                rects = [r for r in rects if r.y1 <= y_alt - 4 and not caixa_e_quadro_dados(pagina, r)]
            blocos = []
            for grupo in corte.agrupar(rects):
                for caixa in caixas_de_figura(pagina, grupo):
                    if caixa.width < 38 or caixa.height < 26:
                        continue
                    papel, letra = papel_do_bloco(caixa, letras, y_alt)
                    teto_y = y_alt - 4 if papel == "enunciado" and letras and not tem_bloco_alt else y_fim - 2
                    clip = fitz.Rect(caixa.x0 - 4, max(y_ini, caixa.y0 - 4), caixa.x1 + 4, min(teto_y, caixa.y1 + 4)) & pagina.rect
                    if clip.width < 36 or clip.height < 24:
                        continue
                    pix = pagina.get_pixmap(matrix=fitz.Matrix(ZOOM_HD, ZOOM_HD), clip=clip, alpha=False)
                    mascaras = linhas_texto_para_mascara(pagina, caixa, clip.y0, clip.y1)
                    img = limpar_imagem(pix, clip, mascaras, limpar_sombra_etec=(estilo == "etec"))
                    if img is None or img.width < 70 or img.height < 48:
                        continue
                    blocos.append((papel, letra, img))

            letras_vistas = {letra for papel, letra, _img in blocos if papel == "alternativa" and letra}
            if len(letras_vistas) < 3:
                blocos = [("enunciado", None, img) for _papel, _letra, img in blocos]
            for ordem, (papel, letra, img) in enumerate(blocos, start=1):
                miolo = f"-{letra.lower()}" if letra else ""
                extra = "" if ordem == 1 or letra else f"-{ordem}"
                nome = f"q{numero}{miolo}{extra}.png"
                img.save(pasta / nome, format="PNG", optimize=True)
                registros.append(
                    (
                        chave_de(numero),
                        {
                            "src": f"{prefixo_src}/{nome}",
                            "largura": img.width,
                            "altura": img.height,
                            "papel": papel,
                            "letra": letra or "",
                            "questao": numero,
                        },
                    )
                )
    documento.close()
    return registros, aceitas


def escrever(destino: Path, registros: list[tuple[str, dict]], rotulo: str) -> None:
    por_chave: dict[str, list[dict]] = {}
    for chave, item in registros:
        por_chave.setdefault(chave, []).append(item)
    linhas = [
        f"/** Gerado por scripts/organizar-figuras-matematica.py (v2 HD). So matematica. {rotulo}. */",
        "export interface FiguraManifesto {",
        "  readonly src: string",
        "  readonly alt: string",
        "  readonly largura: number",
        "  readonly altura: number",
        "  readonly papel: 'enunciado' | 'alternativa'",
        "  readonly letra?: 'A' | 'B' | 'C' | 'D' | 'E'",
        "}",
        "",
        "export const FIGURAS: Readonly<Record<string, readonly FiguraManifesto[]>> = {",
    ]

    def ordem(chave: str) -> tuple:
        return tuple(int(parte) for parte in re.findall(r"\d+", chave))

    for chave in sorted(por_chave, key=ordem):
        linhas.append(f"  '{chave}': [")
        for item in por_chave[chave]:
            papel = "da questao" if item["papel"] == "enunciado" else f"da alternativa {item['letra']} da questao"
            alt = f"Figura {papel} {item['questao']} de matematica ({rotulo})"
            letra = f", letra: '{item['letra']}'" if item["letra"] else ""
            linhas.append(
                "    { src: '%s', alt: '%s', largura: %s, altura: %s, papel: '%s'%s },"
                % (item["src"], alt, item["largura"], item["altura"], item["papel"], letra)
            )
        linhas.append("  ],")
    linhas.append("}")
    linhas.append("")
    destino.write_text("\n".join(linhas), encoding="utf-8")


def main() -> None:
    bancos = RAIZ / "src" / "games" / "LogicBattle" / "ilha" / "estudo" / "bancos"
    senai_dir = RAIZ / "public" / "senai" / "figuras"
    etec_dir = RAIZ / "public" / "etec" / "figuras"
    senai_dir.mkdir(parents=True, exist_ok=True)
    etec_dir.mkdir(parents=True, exist_ok=True)

    senai_registros: list[tuple[str, dict]] = []
    etec_registros: list[tuple[str, dict]] = []
    senai_usados: set[Path] = set()
    etec_usados: set[Path] = set()

    raiz_senai = next(ESCOLA.glob("senai-jovem-aprendiz-*"))
    vistos = set()
    for caminho in sorted(raiz_senai.rglob("*.pdf")):
        documento = fitz.open(caminho)
        codigo = corte.codigo_senai(caminho, documento)
        documento.close()
        if codigo is None or codigo in vistos:
            continue
        vistos.add(codigo)
        ano, cge = codigo
        pasta = senai_dir / f"{ano}-{cge}"
        pasta.mkdir(parents=True, exist_ok=True)
        registros, aceitas = organizar_prova(
            caminho,
            "senai",
            pasta,
            f"/senai/figuras/{ano}-{cge}",
            lambda numero, ano=ano, cge=cge: f"senai:{ano}:{cge}:{numero}",
        )
        senai_registros.extend(registros)
        for _c, it in registros:
            senai_usados.add(pasta / Path(str(it["src"])).name)
        print("SENAI", ano, cge, "questoes", sorted(aceitas), "figuras", len(registros))

    etec_figura_ok = {
        (2016, 2): {26, 29},
        (2017, 1): {10},
        (2017, 2): {32, 35},
        (2018, 2): {31},
        (2019, 1): {49},
        (2020, 1): {33},
    }
    raiz_etec = next(ESCOLA.glob("vestibulinho-etec-*"))
    for caminho in sorted(raiz_etec.rglob("*.pdf")):
        codigo = corte.codigo_etec(caminho)
        if codigo is None:
            continue
        ano, semestre = codigo
        alvos = etec_figura_ok.get((ano, semestre), set())
        if not alvos:
            continue
        pasta = etec_dir / f"{ano}-{semestre}"
        pasta.mkdir(parents=True, exist_ok=True)
        registros, aceitas = organizar_prova(
            caminho,
            "etec",
            pasta,
            f"/etec/figuras/{ano}-{semestre}",
            lambda numero, ano=ano, semestre=semestre: f"etec:{ano}:{semestre}:{numero}",
            alvos,
        )
        etec_registros.extend(registros)
        for _c, it in registros:
            etec_usados.add(pasta / Path(str(it["src"])).name)
        print("ETEC", ano, semestre, "questoes", sorted(aceitas), "figuras", len(registros))

    ap_s = 0
    for f in senai_dir.rglob("*.png"):
        if f not in senai_usados:
            f.unlink(missing_ok=True)
            ap_s += 1
    ap_e = 0
    for f in etec_dir.rglob("*.png"):
        if f not in etec_usados:
            f.unlink(missing_ok=True)
            ap_e += 1

    escrever(bancos / "figurasSenai.manifest.ts", senai_registros, "SENAI")
    escrever(bancos / "figurasEtec.manifest.ts", etec_registros, "ETEC")
    print("Finais -> SENAI:", len(senai_registros), f"(apag {ap_s}) | ETEC:", len(etec_registros), f"(apag {ap_e})")


if __name__ == "__main__":
    main()
