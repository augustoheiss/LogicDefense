"""Converte figuras recortadas das provas para WebP otimizado e atualiza os manifestos TS.

Uso principal (Onda 0):
  .\\venv\\Scripts\\python.exe scripts\\questoes\\03_figuras_e_webp.py --converter-existentes

Regras:
  - Testa lossless WebP e lossy quality=88 (method=6) mantendo canal alfa ou RGB limpo;
  - Escolhe o menor WebP desde que reabra sem erro e preserve exatamente (largura, altura);
  - Remove o PNG antigo somente apos validar o .webp salvo em disco;
  - Atualiza as referencias `.png` -> `.webp` apenas para os arquivos efetivamente convertidos em:
      src/games/LogicBattle/ilha/estudo/bancos/figurasEnem.manifest.ts
      src/games/LogicBattle/ilha/estudo/bancos/figurasSenai.manifest.ts
      src/games/LogicBattle/ilha/estudo/bancos/figurasEtec.manifest.ts
"""
from __future__ import annotations

import argparse
import io
import json
from pathlib import Path

from PIL import Image, ImageChops

RAIZ = Path(__file__).resolve().parents[2]
ENEM_PDF_2019 = Path(r"C:\Users\Usuario\Desktop\AHeiss_GoogleDrive\SERVICO-SECULAR\ESCOLA\ENEM\2019-2019_PV_impresso_D2_CD5.pdf")
ENEM_PDF_2018 = Path(r"C:\Users\Usuario\Desktop\AHeiss_GoogleDrive\SERVICO-SECULAR\ESCOLA\ENEM\2018-2DIA_05_AMARELO_BAIXA.pdf")
PASTAS_FIGURAS = (
    RAIZ / "public" / "enem" / "figuras",
    RAIZ / "public" / "senai" / "figuras",
    RAIZ / "public" / "etec" / "figuras",
)
MANIFESTOS = (
    RAIZ / "src" / "games" / "LogicBattle" / "ilha" / "estudo" / "bancos" / "figurasEnem.manifest.ts",
    RAIZ / "src" / "games" / "LogicBattle" / "ilha" / "estudo" / "bancos" / "figurasSenai.manifest.ts",
    RAIZ / "src" / "games" / "LogicBattle" / "ilha" / "estudo" / "bancos" / "figurasEtec.manifest.ts",
)


def codificar_melhor_webp(img: Image.Image, qualidade: int = 88) -> bytes:
    """Compara lossless vs lossy e retorna o menor buffer WebP valido."""
    candidato_base = img if img.mode in ("RGB", "RGBA") else img.convert("RGB")

    buf_lossless = io.BytesIO()
    candidato_base.save(buf_lossless, format="WEBP", lossless=True, method=6)
    bytes_lossless = buf_lossless.getvalue()

    buf_lossy = io.BytesIO()
    candidato_base.save(buf_lossy, format="WEBP", quality=qualidade, method=6)
    bytes_lossy = buf_lossy.getvalue()

    # Se lossy reduzir significativamente em relacao ao lossless (> 12%), adota lossy;
    # caso contrario preserva lossless exato para diagramas/tabelas com texto miudo.
    if len(bytes_lossy) < len(bytes_lossless) * 0.88:
        return bytes_lossy
    return bytes_lossless


def converter_png_para_webp(caminho_png: Path, qualidade: int = 88) -> tuple[bool, int, int, Path]:
    bytes_orig = caminho_png.stat().st_size
    caminho_webp = caminho_png.with_suffix(".webp")
    with Image.open(caminho_png) as img:
        largura, altura = img.size
        dados_webp = codificar_melhor_webp(img, qualidade=qualidade)

    if len(dados_webp) >= bytes_orig and caminho_png.exists():
        # Ainda converte para padronizar extensao caso seja quase igual? So se ficar menor ou <= 105%,
        # mas se lossless/lossy passar muito, mantem png (fallback raro).
        if len(dados_webp) > bytes_orig:
            return False, bytes_orig, bytes_orig, caminho_png

    caminho_webp.write_bytes(dados_webp)
    with Image.open(caminho_webp) as verif:
        verif.load()
        if verif.size != (largura, altura):
            caminho_webp.unlink(missing_ok=True)
            raise RuntimeError(f"Dimensao divergente em {caminho_webp}: {verif.size} != {(largura, altura)}")

    caminho_png.unlink()
    return True, bytes_orig, len(dados_webp), caminho_webp


def converter_existentes(qualidade: int = 88) -> dict[str, object]:
    total_arquivos = 0
    convertidos = 0
    pulados = 0
    bytes_antes = 0
    bytes_depois = 0
    mapa_url_png_para_webp: dict[str, str] = {}

    for pasta in PASTAS_FIGURAS:
        if not pasta.exists():
            continue
        for arquivo in sorted(pasta.rglob("*.png")):
            total_arquivos += 1
            rel_png = "/" + arquivo.relative_to(RAIZ / "public").as_posix()
            ok, b_ant, b_dep, destino = converter_png_para_webp(arquivo, qualidade=qualidade)
            bytes_antes += b_ant
            bytes_depois += b_dep
            if ok:
                convertidos += 1
                rel_webp = "/" + destino.relative_to(RAIZ / "public").as_posix()
                mapa_url_png_para_webp[rel_png] = rel_webp
            else:
                pulados += 1

    # Mede também arquivos já em .webp ou .png restantes em public/{enem,senai,etec}
    total_em_disco = 0
    for sub in ("enem", "senai", "etec"):
        raiz_sub = RAIZ / "public" / sub
        if raiz_sub.exists():
            total_em_disco += sum(p.stat().st_size for p in raiz_sub.rglob("*") if p.is_file())

    manifestos_atualizados: list[str] = []
    for man in MANIFESTOS:
        if not man.exists():
            continue
        texto = man.read_text(encoding="utf-8")
        novo = texto
        for png_url, webp_url in mapa_url_png_para_webp.items():
            novo = novo.replace(png_url, webp_url)
        if novo != texto:
            man.write_text(novo, encoding="utf-8")
            manifestos_atualizados.append(man.relative_to(RAIZ).as_posix())

    economia_pct = round((1 - bytes_depois / bytes_antes) * 100, 2) if bytes_antes else 0.0
    return {
        "pngs_encontrados": total_arquivos,
        "convertidos_para_webp": convertidos,
        "mantidos_png": pulados,
        "mb_pngs_antes": round(bytes_antes / (1024 * 1024), 2),
        "mb_apos_conversao": round(bytes_depois / (1024 * 1024), 2),
        "economia_pct": economia_pct,
        "mb_total_public_figuras": round(total_em_disco / (1024 * 1024), 2),
        "manifestos_atualizados": manifestos_atualizados,
    }


def aparar_e_salvar_webp(img: Image.Image, destino: Path, margem: int = 12, qualidade: int = 88) -> dict[str, int | str]:
    rgb = img.convert("RGB")
    fundo = Image.new("RGB", rgb.size, (255, 255, 255))
    diff = ImageChops.difference(rgb, fundo).convert("L")
    diff = diff.point(lambda p: 255 if p > 12 else 0)
    bbox = diff.getbbox()
    if bbox:
        l, t, r, b = bbox
        l = max(0, l - margem)
        t = max(0, t - margem)
        r = min(rgb.width, r + margem)
        b = min(rgb.height, b + margem)
        rgb = rgb.crop((l, t, r, b))
    dados = codificar_melhor_webp(rgb, qualidade=qualidade)
    destino.parent.mkdir(parents=True, exist_ok=True)
    destino.write_bytes(dados)
    return {"src": "/" + destino.relative_to(RAIZ / "public").as_posix(), "largura": rgb.width, "altura": rgb.height}


def recortar_regioes_alt(pdf_path: Path, page_index: int, regioes: dict[str, tuple[float, float, float, float]], pasta_out: Path, prefixo: str, tipo_visual: str, alt_template: str) -> list[dict[str, object]]:
    import fitz

    saida: list[dict[str, object]] = []
    mat = fitz.Matrix(3.0, 3.0)
    with fitz.open(pdf_path) as doc:
        pg = doc[page_index]
        for letra, (x0, y0, x1, y1) in regioes.items():
            clip = fitz.Rect(x0, y0, x1, y1)
            pix = pg.get_pixmap(matrix=mat, clip=clip, alpha=False)
            im = Image.frombytes("RGB", [pix.width, pix.height], pix.samples)
            dest = pasta_out / f"{prefixo}-alt-{letra.lower()}.webp"
            meta = aparar_e_salvar_webp(im, dest)
            saida.append({
                "src": meta["src"],
                "alt": alt_template.format(letra=letra),
                "largura": meta["largura"],
                "altura": meta["altura"],
                "papel": "alternativa",
                "letra": letra,
                "tipoVisual": tipo_visual,
            })
    return saida


def recortar_alternativas_piloto() -> dict[str, list[dict[str, object]]]:
    resultado: dict[str, list[dict[str, object]]] = {}
    # 1. ENEM 2019 Q139 (pag 18, idx 17): A..E empilhadas na coluna esquerda
    resultado["2019:139"] = recortar_regioes_alt(
        ENEM_PDF_2019,
        17,
        {
            "A": (46.0, 411.0, 272.0, 476.0),
            "B": (46.0, 476.5, 272.0, 540.5),
            "C": (46.0, 541.0, 272.0, 605.0),
            "D": (46.0, 605.5, 272.0, 669.5),
            "E": (46.0, 670.0, 272.0, 738.0),
        },
        RAIZ / "public" / "enem" / "figuras" / "2019",
        "q139",
        "ilustracao",
        "Sombra projetada da alternativa {letra} (ENEM 2019 Q139)",
    )
    # 2. ENEM 2019 Q163 (pag 25, idx 24): graficos PxV A,B,C esquerda e D,E direita
    resultado["2019:163"] = recortar_regioes_alt(
        ENEM_PDF_2019,
        24,
        {
            "A": (44.0, 224.0, 256.0, 389.0),
            "B": (44.0, 395.0, 256.0, 560.0),
            "C": (44.0, 566.0, 256.0, 734.0),
            "D": (287.0, 224.0, 501.0, 389.0),
            "E": (287.0, 395.0, 501.0, 560.0),
        },
        RAIZ / "public" / "enem" / "figuras" / "2019",
        "q163",
        "grafico",
        "Gráfico PxV da alternativa {letra} (ENEM 2019 Q163)",
    )
    # 3. ENEM 2018 Q146 (pag 19, idx 18): pecas 3D A,B,C esquerda e D,E direita (bbox exato das imagens + margem)
    resultado["2018:146"] = recortar_regioes_alt(
        ENEM_PDF_2018,
        18,
        {
            "A": (75.0, 498.0, 219.0, 582.0),
            "B": (75.0, 583.0, 219.0, 666.0),
            "C": (75.0, 667.0, 219.0, 752.0),
            "D": (321.0, 498.0, 466.0, 582.0),
            "E": (321.0, 583.0, 466.0, 666.0),
        },
        RAIZ / "public" / "enem" / "figuras" / "2018",
        "q146",
        "geometria",
        "Peça 3D complementar da alternativa {letra} (ENEM 2018 Q146)",
    )
    # 4. ENEM 2018 Q174 (pag 28, idx 27): graficos A,B,C esquerda e D,E direita
    resultado["2018:174"] = recortar_regioes_alt(
        ENEM_PDF_2018,
        27,
        {
            "A": (77.0, 398.0, 286.0, 521.0),
            "B": (77.0, 517.0, 286.0, 640.0),
            "C": (77.0, 636.0, 286.0, 761.0),
            "D": (323.0, 398.0, 536.0, 521.0),
            "E": (323.0, 517.0, 536.0, 640.0),
        },
        RAIZ / "public" / "enem" / "figuras" / "2018",
        "q174",
        "grafico",
        "Gráfico Distância x Tempo da alternativa {letra} (ENEM 2018 Q174)",
    )
    # 5. Re-recorte limpo da figura do radar de ENEM 2019 Q175 (pag 29, idx 28) com legenda completa
    import fitz as _fitz
    with _fitz.open(ENEM_PDF_2019) as _doc29:
        _pix = _doc29[28].get_pixmap(matrix=_fitz.Matrix(3.0, 3.0), clip=_fitz.Rect(30.0, 134.0, 535.0, 450.0), alpha=False)
        _im = Image.frombytes("RGB", [_pix.width, _pix.height], _pix.samples)
        _meta175 = aparar_e_salvar_webp(_im, RAIZ / "public" / "enem" / "figuras" / "2019" / "q175.webp")
    resultado["2019:175_enunciado"] = [{
        "src": _meta175["src"],
        "alt": "Gráfico radar de vendas da semana (ENEM 2019 Q175)",
        "largura": _meta175["largura"],
        "altura": _meta175["altura"],
        "papel": "enunciado",
        "tipoVisual": "grafico",
    }]
    out_json = RAIZ / "scripts" / "questoes" / ".staging" / "alt_figuras_piloto.json"
    out_json.write_text(json.dumps(resultado, ensure_ascii=False, indent=2), encoding="utf-8")
    return resultado


def recortar_enunciado_regiao(
    pdf_path: Path,
    pagina_idx: int,
    rect_tuple: tuple[float, float, float, float],
    destino_webp: Path,
    alt_texto: str,
    tipo_visual: str,
) -> list[dict[str, object]]:
    import fitz as _fitz

    with _fitz.open(pdf_path) as doc:
        pix = doc[pagina_idx].get_pixmap(matrix=_fitz.Matrix(3.0, 3.0), clip=_fitz.Rect(*rect_tuple), alpha=False)
        im = Image.frombytes("RGB", [pix.width, pix.height], pix.samples)
        meta = aparar_e_salvar_webp(im, destino_webp)
    return [{
        "src": meta["src"],
        "alt": alt_texto,
        "largura": meta["largura"],
        "altura": meta["altura"],
        "papel": "enunciado",
        "tipoVisual": tipo_visual,
    }]


def recortar_figuras_2021() -> dict[str, list[dict[str, object]]]:
    pdf_2021 = ENEM_PDF_2019.parent / "2021-2021_PV_impresso_D2_CD5.pdf"
    dir_2021 = RAIZ / "public" / "enem" / "figuras" / "2021"
    resultado: dict[str, list[dict[str, object]]] = {}

    # Alternativas graficas A-E
    resultado["2021:154"] = recortar_regioes_alt(
        pdf_2021,
        20,
        {
            "A": (49.0, 194.0, 224.0, 356.0),
            "B": (49.0, 428.0, 224.0, 530.0),
            "C": (49.0, 598.0, 224.0, 700.0),
            "D": (303.0, 194.0, 480.0, 356.0),
            "E": (303.0, 428.0, 480.0, 530.0),
        },
        dir_2021,
        "q154",
        "grafico",
        "Gráfico Imposto x Preço da alternativa {letra} (ENEM 2021 Q154)",
    )
    resultado["2021:155"] = recortar_regioes_alt(
        pdf_2021,
        21,
        {
            "A": (44.0, 175.0, 274.0, 332.0),
            "B": (44.0, 367.0, 286.0, 524.0),
            "C": (44.0, 551.0, 280.0, 706.0),
            "D": (292.0, 175.0, 540.0, 332.0),
            "E": (292.0, 367.0, 540.0, 524.0),
        },
        dir_2021,
        "q155",
        "grafico",
        "Gráfico Arrecadação x Desconto da alternativa {letra} (ENEM 2021 Q155)",
    )
    # Mascara em branco o canto superior direito de q155-alt-b onde o badge circular 'E' encosta acima de 'Desconto'
    import fitz as _fitz_b
    with _fitz_b.open(pdf_2021) as _doc22:
        _pix_b = _doc22[21].get_pixmap(matrix=_fitz_b.Matrix(3.0, 3.0), clip=_fitz_b.Rect(44.0, 367.0, 286.0, 524.0), alpha=False)
        _im_b = Image.frombytes("RGB", [_pix_b.width, _pix_b.height], _pix_b.samples)
        from PIL import ImageDraw as _ImageDraw
        _draw_b = _ImageDraw.Draw(_im_b)
        _draw_b.rectangle([int((276.0 - 44.0) * 3.0), 0, _pix_b.width, int((386.0 - 367.0) * 3.0)], fill=(255, 255, 255))
        _meta_b = aparar_e_salvar_webp(_im_b, dir_2021 / "q155-alt-b.webp")
        for _entry in resultado["2021:155"]:
            if _entry["letra"] == "B":
                _entry["largura"] = _meta_b["largura"]
                _entry["altura"] = _meta_b["altura"]
    resultado["2021:180_alt"] = recortar_regioes_alt(
        pdf_2021,
        30,
        {
            "A": (310.0, 419.0, 391.0, 513.0),
            "B": (310.0, 534.0, 391.0, 613.0),
            "C": (310.0, 653.0, 391.0, 710.0),
            "D": (443.0, 437.0, 524.0, 495.0),
            "E": (443.0, 529.0, 524.0, 618.0),
        },
        dir_2021,
        "q180",
        "geometria",
        "Projeção ortogonal do trajeto da alternativa {letra} (ENEM 2021 Q180)",
    )

    # Figuras de enunciado limpas e completas
    enunciados_especs = [
        (144, 17, (308.0, 441.0, 515.0, 623.0), "q144.webp", "Estrutura de hastes em cubos concêntricos (ENEM 2021 Q144)", "geometria"),
        (145, 18, (42.0, 145.0, 268.0, 246.0), "q145.webp", "Octaedro regular e planificação numerada (ENEM 2021 Q145)", "geometria"),
        (146, 18, (48.0, 416.0, 274.0, 520.0), "q146.webp", "Triângulo instrumento musical e altura h = 8 cm (ENEM 2021 Q146)", "geometria"),
        (147, 18, (338.0, 113.0, 515.0, 248.0), "q147.webp", "Caneca em tronco de cone com diâmetros D, d e altura h (ENEM 2021 Q147)", "geometria"),
        (161, 23, (38.0, 416.0, 534.0, 636.0), "q161.webp", "Sistema massa-mola e gráfico posição x tempo (ENEM 2021 Q161)", "grafico"),
        (165, 25, (40.0, 183.0, 274.0, 391.0), "q165.webp", "Gráfico de receitas e despesas de janeiro a maio (ENEM 2021 Q165)", "grafico"),
        (166, 25, (31.0, 578.0, 281.0, 728.5), "q166.webp", "Evolução do volume de vendas de 2005 a 2009 (ENEM 2021 Q166)", "grafico"),
        (167, 25, (290.0, 418.0, 535.0, 612.0), "q167.webp", "Histograma de distribuição dos preços dos imóveis (ENEM 2021 Q167)", "grafico"),
        (168, 26, (92.0, 213.0, 478.0, 440.0), "q168.webp", "Gráfico de frequência das letras A a Z em O guarani (ENEM 2021 Q168)", "grafico"),
        (170, 27, (33.0, 128.0, 276.0, 346.0), "q170.webp", "Nível de ocupação e capacidade dos reservatórios I a V (ENEM 2021 Q170)", "grafico"),
        (171, 27, (88.0, 509.0, 232.0, 648.0), "q171.webp", "Gráfico de frequência de ocorrência das idades (ENEM 2021 Q171)", "grafico"),
        (180, 30, (288.0, 123.0, 537.0, 373.0), "q180.webp", "Fotografia do monumento Atomium em Bruxelas (ENEM 2021 Q180)", "ilustracao"),
    ]
    for qnum, p_idx, rect_t, fname, alt, tv in enunciados_especs:
        resultado[f"2021:{qnum}_enunciado"] = recortar_enunciado_regiao(
            pdf_2021, p_idx, rect_t, dir_2021 / fname, alt, tv
        )

    out_json = RAIZ / "scripts" / "questoes" / ".staging" / "alt_figuras_2021.json"
    out_json.write_text(json.dumps(resultado, ensure_ascii=False, indent=2), encoding="utf-8")
    return resultado


def recortar_figuras_2025() -> dict[str, object]:
    """Recorta alternativas graficas A-E (Q144, Q167) e limpa/extrai figuras de enunciado do ENEM 2025."""
    pdf_2025 = ENEM_PDF_2019.parent / "2025-2025_PV_impresso_D2_CD5.pdf"
    dir_2025 = RAIZ / "public" / "enem" / "figuras" / "2025"
    resultado: dict[str, object] = {}

    resultado["2025:144_alt"] = recortar_regioes_alt(
        pdf_2025,
        17,
        {
            "A": (41.0, 333.0, 203.0, 466.0),
            "B": (41.0, 465.0, 203.0, 598.0),
            "C": (41.0, 596.0, 203.0, 729.0),
            "D": (301.0, 333.0, 463.5, 466.0),
            "E": (301.0, 464.0, 463.5, 597.0),
        },
        dir_2025,
        "q144",
        "geometria",
        "Projeções ortogonais da alternativa {letra} (ENEM 2025 Q144)",
    )
    resultado["2025:167_alt"] = recortar_regioes_alt(
        pdf_2025,
        26,
        {
            "A": (34.0, 215.5, 239.0, 385.0),
            "B": (34.0, 389.0, 239.0, 558.5),
            "C": (34.0, 561.5, 239.0, 731.0),
            "D": (294.0, 215.5, 499.0, 385.0),
            "E": (294.0, 389.0, 499.0, 558.5),
        },
        dir_2025,
        "q167",
        "grafico",
        "Gráfico de linhas da alternativa {letra} (ENEM 2025 Q167)",
    )

    enunciados_especs = [
        (140, 16, (21.0, 153.0, 276.0, 342.0), "q140.webp", "Rótulos nutricionais dos cinco alimentos (ENEM 2025 Q140)", "ilustracao"),
        (142, 16, (293.0, 231.0, 530.0, 397.0), "q142.webp", "Gráfico frequência respiratória x tempo (ENEM 2025 Q142)", "grafico"),
        (150, 20, (29.5, 498.0, 530.5, 586.5), "q150.webp", "Telas de deslocamento I a V e suas escalas (ENEM 2025 Q150)", "ilustracao"),
        (158, 23, (39.0, 445.0, 535.0, 581.0), "q158.webp", "Esquema de tempos acumulados e por trecho de 1 km (ENEM 2025 Q158)", "grafico"),
        (160, 24, (294.5, 219.0, 529.0, 391.0), "q160.webp", "Planta dos quarteirões com pontos A, P, Q, R, S, T e bússola (ENEM 2025 Q160)", "ilustracao"),
        (168, 27, (28.0, 140.0, 283.0, 253.5), "q168.webp", "Projeto da medalha circular com quadrado inscrito ABCD e espessura 3 mm (ENEM 2025 Q168)", "geometria"),
    ]
    for qnum, p_idx, rect_t, fname, alt, tv in enunciados_especs:
        resultado[f"2025:{qnum}_enunciado"] = recortar_enunciado_regiao(
            pdf_2025, p_idx, rect_t, dir_2025 / fname, alt, tv
        )

    out_json = RAIZ / "scripts" / "questoes" / ".staging" / "alt_figuras_2025.json"
    out_json.write_text(json.dumps(resultado, ensure_ascii=False, indent=2), encoding="utf-8")
    return resultado


def recortar_figuras_2026() -> dict[str, object]:
    """Recorta alternativas graficas A-E (Q168, Q175) e figuras de enunciado do ENEM 2026."""
    pdf_2026 = ENEM_PDF_2019.parent / "2026-2026_PV_impresso_D2_CD5.pdf"
    dir_2026 = RAIZ / "public" / "enem" / "figuras" / "2026"
    dir_2026.mkdir(parents=True, exist_ok=True)
    resultado: dict[str, object] = {}

    resultado["2026:168_alt"] = recortar_regioes_alt(
        pdf_2026,
        24,
        {
            "A": (34.0, 431.5, 88.0, 518.5),
            "B": (34.0, 540.0, 88.0, 627.5),
            "C": (34.0, 648.0, 88.0, 735.5),
            "D": (162.5, 431.5, 233.0, 518.5),
            "E": (162.5, 539.0, 216.5, 626.5),
        },
        dir_2026,
        "q168",
        "geometria",
        "Projeção ortogonal da alternativa {letra} sobre o plano alfa (ENEM 2026 Q168)",
    )
    resultado["2026:175_alt"] = recortar_regioes_alt(
        pdf_2026,
        28,
        {
            "A": (34.0, 278.0, 105.0, 418.0),
            "B": (34.0, 440.0, 105.0, 579.5),
            "C": (34.0, 600.5, 105.0, 740.0),
            "D": (294.0, 278.0, 365.0, 418.0),
            "E": (294.0, 440.0, 365.0, 579.5),
        },
        dir_2026,
        "q175",
        "grafico",
        "Gráfico comprimento OT x tempo da alternativa {letra} (ENEM 2026 Q175)",
    )

    enunciados_especs = [
        ("2026:136_enunciado", 15, (32.0, 157.0, 279.0, 286.0), "q136.webp", "Escala do violão entre rastilho e pestana medindo 22 3/4 polegadas (ENEM 2026 Q136)", "geometria"),
        ("2026:138_enunciado", 15, (322.0, 121.0, 515.0, 311.5), "q138.webp", "Cupom fiscal com valores e alíquotas de imposto dos três produtos (ENEM 2026 Q138)", "ilustracao"),
        ("2026:143_enunciado", 16, (298.0, 402.5, 525.5, 615.0), "q143.webp", "Quadrado ABCD no plano cartesiano com vértices D(5;7) e C(7;3) (ENEM 2026 Q143)", "geometria"),
        ("2026:145_enunciado", 17, (36.0, 418.0, 275.0, 520.0), "q145.webp", "Bancada de 60 cm por 200 cm com faixa sombreada de 5 cm entre fogão e pia (ENEM 2026 Q145)", "geometria"),
        ("2026:146_enunciado", 17, (293.5, 134.0, 544.0, 323.0), "q146.webp", "Gráfico de temperaturas máxima e mínima nos primeiros 15 dias (ENEM 2026 Q146)", "grafico"),
        ("2026:148_enunciado", 18, (42.0, 159.0, 255.0, 314.0), "q148.webp", "Tabuleiro formado por quatro círculos tangentes de raio 10 cm e disco de raio r (ENEM 2026 Q148)", "geometria"),
        ("2026:152_enunciado", 19, (34.0, 199.0, 277.0, 435.5), "q152.webp", "Trajetória parabólica do projétil com parâmetros D1, D2 e k (ENEM 2026 Q152)", "grafico"),
        ("2026:158_enunciado", 20, (291.0, 216.5, 532.0, 408.0), "q158.webp", "Matriz de notas atribuídas pelos diretores D1 a D5 aos candidatos C1 a C5 (ENEM 2026 Q158)", "ilustracao"),
        ("2026:160_enunciado", 21, (40.0, 145.0, 271.0, 364.5), "q160.webp", "Canteiros retangulares I, II e III delimitando triângulo retângulo central (ENEM 2026 Q160)", "geometria"),
        ("2026:162_enunciado", 21, (296.0, 289.0, 541.0, 585.0), "q162.webp", "Gráfico da Carga Tributária Bruta para t = 0, 1 e 2 (ENEM 2026 Q162)", "grafico"),
        ("2026:164_enunciado", 22, (25.0, 396.5, 272.0, 641.5), "q164.webp", "Mesa quadrada de bilhar com lado 206 cm e trajetória poligonal da bola branca (ENEM 2026 Q164)", "geometria"),
        ("2026:165_enunciado", 22, (289.0, 170.0, 534.0, 420.5), "q165.webp", "Modelo cilíndrico de foguete envolto por manta protetora (ENEM 2026 Q165)", "geometria"),
        ("2026:166_enunciado", 23, (123.5, 122.0, 450.5, 300.5), "q166.webp", "Planta baixa da escola em malha quadriculada 10 cm x 10 cm na escala 1:80 (ENEM 2026 Q166)", "geometria"),
        ("2026:168_enunciado", 24, (40.0, 158.0, 257.0, 396.0), "q168.webp", "Empilhamento de blocos retangulares frente aos planos alfa e beta (ENEM 2026 Q168)", "geometria"),
        ("2026:169_g1", 24, (291.0, 304.0, 533.0, 495.5), "q169.webp", "Gráfico 1 — Porcentagens de escolhas de alternativas na questão 1 por grupo (ENEM 2026 Q169)", "grafico"),
        ("2026:169_g2", 24, (305.0, 524.0, 535.0, 648.0), "q169-2.webp", "Gráfico 2 — Distribuição dos candidatos por grupo N0 a N5 (ENEM 2026 Q169)", "grafico"),
        ("2026:170_enunciado", 25, (35.5, 308.5, 538.5, 646.5), "q170.webp", "Gráficos de frequência relativa das notas de atratividade dos usuários 1 a 5 (ENEM 2026 Q170)", "grafico"),
        ("2026:171_enunciado", 26, (59.0, 146.0, 237.5, 316.5), "q171.webp", "Tampo da mesa obtido pela intersecção de três círculos centrados em A, B e C (ENEM 2026 Q171)", "geometria"),
        ("2026:174_enunciado", 27, (43.0, 177.0, 531.0, 455.5), "q174.webp", "Gráfico de unidades vendidas em jan/fev e estimativa no segundo semestre (ENEM 2026 Q174)", "grafico"),
        ("2026:175_enunciado", 28, (65.0, 143.0, 495.0, 228.0), "q175.webp", "Esquemas de deslocamento da câmera P nos instantes 0s, 10s e 15s (ENEM 2026 Q175)", "geometria"),
        ("2026:176_f1", 29, (53.5, 136.5, 257.5, 329.5), "q176-1.webp", "Figura 1 — Vista superior do mobiliário de cozinha 3,5 m x 3,5 m (ENEM 2026 Q176)", "geometria"),
        ("2026:176_f2", 29, (29.5, 374.5, 279.5, 567.5), "q176-2.webp", "Figura 2 — Planta baixa original para reforma (ENEM 2026 Q176)", "geometria"),
        ("2026:177_enunciado", 29, (355.0, 134.0, 482.0, 274.0), "q177.webp", "Quadro Abaporu com dimensões indicadas de 85 cm x 73 cm (ENEM 2026 Q177)", "ilustracao"),
    ]
    for chave, p_idx, rect_t, fname, alt, tv in enunciados_especs:
        resultado[chave] = recortar_enunciado_regiao(
            pdf_2026, p_idx, rect_t, dir_2026 / fname, alt, tv
        )

    out_json = RAIZ / "scripts" / "questoes" / ".staging" / "alt_figuras_2026.json"
    out_json.write_text(json.dumps(resultado, ensure_ascii=False, indent=2), encoding="utf-8")
    return resultado


def recortar_figuras_2024() -> dict[str, object]:
    """Recorta alternativas graficas A-E (Q146, Q153, Q162) e limpa figuras de enunciado do ENEM 2024."""
    pdf_2024 = ENEM_PDF_2019.parent / "2024-2024_PV_impresso_D2_CD5.pdf"
    dir_2024 = RAIZ / "public" / "enem" / "figuras" / "2024"
    dir_2024.mkdir(parents=True, exist_ok=True)
    resultado: dict[str, object] = {}

    resultado["2024:146_alt"] = recortar_regioes_alt(
        pdf_2024,
        18,
        {
            "A": (44.5, 191.0, 282.0, 340.5),
            "B": (44.5, 384.0, 282.0, 534.5),
            "C": (44.5, 578.0, 280.0, 728.5),
            "D": (299.8, 191.0, 535.0, 340.5),
            "E": (299.8, 384.0, 538.5, 534.5),
        },
        dir_2024,
        "q146",
        "grafico",
        "Gráfico oscilatório da alternativa {letra} (ENEM 2024 Q146)",
    )
    resultado["2024:153_alt"] = recortar_regioes_alt(
        pdf_2024,
        22,
        {
            "A": (44.5, 306.0, 225.0, 448.0),
            "B": (44.5, 448.0, 225.0, 587.5),
            "C": (44.5, 588.0, 225.0, 729.5),
            "D": (299.8, 306.0, 480.0, 448.0),
            "E": (299.8, 448.0, 480.0, 587.5),
        },
        dir_2024,
        "q153",
        "grafico",
        "Gráfico maior altura x tempo da alternativa {letra} (ENEM 2024 Q153)",
    )
    resultado["2024:162_alt"] = recortar_regioes_alt(
        pdf_2024,
        25,
        {
            "A": (302.8, 456.0, 391.5, 546.0),
            "B": (302.8, 550.5, 391.5, 640.5),
            "C": (302.8, 645.5, 391.5, 735.5),
            "D": (429.0, 456.0, 517.5, 545.5),
            "E": (429.0, 550.5, 517.5, 640.5),
        },
        dir_2024,
        "q162",
        "geometria",
        "Projeção ortogonal da trajetória ABCDEF na alternativa {letra} (ENEM 2024 Q162)",
    )

    enunciados_especs = [
        ("2024:142_enunciado", 16, (310.0, 200.0, 517.0, 413.8), "q142.webp", "Comparação visual das telas de 3 1/2 polegadas e 4 5/6 polegadas (ENEM 2024 Q142)", "geometria"),
        ("2024:162_enunciado", 25, (296.0, 165.0, 531.0, 426.0), "q162.webp", "Trajetória retilínea ABCDEF entre paredes ortogonais (ENEM 2024 Q162)", "geometria"),
        ("2024:163_enunciado", 26, (62.0, 260.0, 249.0, 481.0), "q163.webp", "Microscópio óptico indicando lente ocular e lentes objetivas (ENEM 2024 Q163)", "ilustracao"),
        ("2024:168_enunciado", 27, (296.0, 133.0, 531.0, 591.0), "q168.webp", "Gráficos relacionando as grandezas I e II e as grandezas II e III (ENEM 2024 Q168)", "grafico"),
        ("2024:169_enunciado", 28, (33.5, 122.0, 278.5, 264.8), "q169.webp", "Quadro de etapas de inserção e cópia de carinhas no visor (ENEM 2024 Q169)", "ilustracao"),
        ("2024:171_enunciado", 28, (362.0, 230.5, 465.0, 388.0), "q171.webp", "Trapézio retângulo PQRS afixado pelo lado PS na vareta de rotação (ENEM 2024 Q171)", "geometria"),
        ("2024:175_enunciado", 29, (290.0, 149.0, 537.0, 354.5), "q175.webp", "Gráfico de exportações e importações entre junho de 2009 e junho de 2010 (ENEM 2024 Q175)", "grafico"),
        ("2024:179_enunciado", 30, (293.0, 152.0, 534.0, 348.5), "q179.webp", "Gráfico da temperatura da caneca ao longo do tempo em minuto (ENEM 2024 Q179)", "grafico"),
    ]
    for chave, p_idx, rect_t, fname, alt, tv in enunciados_especs:
        resultado[chave] = recortar_enunciado_regiao(
            pdf_2024, p_idx, rect_t, dir_2024 / fname, alt, tv
        )

    out_json = RAIZ / "scripts" / "questoes" / ".staging" / "alt_figuras_2024.json"
    out_json.write_text(json.dumps(resultado, ensure_ascii=False, indent=2), encoding="utf-8")
    return resultado


def recortar_figuras_2023() -> dict[str, list[dict[str, object]]]:
    """Recorta alternativas graficas A-E (Q153, Q167, Q172) e figuras de enunciado do ENEM 2023."""
    pdf_2023 = ENEM_PDF_2019.parent / "2023-2023_PV_impresso_D2_CD5.pdf"
    dir_2023 = RAIZ / "public" / "enem" / "figuras" / "2023"
    dir_2023.mkdir(parents=True, exist_ok=True)
    resultado: dict[str, object] = {}

    resultado["2023:153_alt"] = recortar_regioes_alt(
        pdf_2023,
        21,
        {
            "A": (305.0, 128.0, 524.0, 210.0),
            "B": (305.0, 227.0, 524.0, 309.0),
            "C": (305.0, 321.0, 524.0, 403.0),
            "D": (305.0, 415.0, 524.0, 497.0),
            "E": (305.0, 509.0, 524.0, 591.0),
        },
        dir_2023,
        "q153",
        "grafico",
        "Gráfico Altura x Tempo da alternativa {letra} (ENEM 2023 Q153)",
    )
    resultado["2023:167_alt"] = recortar_regioes_alt(
        pdf_2023,
        26,
        {
            "A": (47.0, 263.0, 226.0, 357.8),
            "B": (47.0, 358.6, 226.0, 451.8),
            "C": (47.0, 452.6, 226.0, 544.5),
            "D": (47.0, 545.2, 226.0, 636.4),
            "E": (47.0, 637.1, 226.0, 731.0),
        },
        dir_2023,
        "q167",
        "grafico",
        "Gráfico Volume de água x Tempo da alternativa {letra} (ENEM 2023 Q167)",
    )
    resultado["2023:172_alt"] = recortar_regioes_alt(
        pdf_2023,
        27,
        {
            "A": (309.5, 302.0, 362.0, 358.0),
            "B": (309.5, 366.0, 362.0, 422.0),
            "C": (309.5, 428.0, 362.0, 476.0),
            "D": (309.5, 484.0, 412.0, 540.0),
            "E": (309.5, 546.0, 402.0, 603.0),
        },
        dir_2023,
        "q172",
        "geometria",
        "Vista superior da trajetória do vigilante na alternativa {letra} (ENEM 2023 Q172)",
    )

    enunciados_especs = [
        ("2023:138_enunciado", 15, (288.5, 411.5, 536.5, 503.0), "q138.webp", "Tela do instrumento de controle de voo mostrando altitude em função da distância (ENEM 2023 Q138)", "grafico"),
        ("2023:146_enunciado", 19, (30.5, 279.0, 278.5, 445.0), "q146.webp", "Foto da construção da cisterna cilíndrica (ENEM 2023 Q146)", "ilustracao"),
        ("2023:147_enunciado", 19, (292.0, 72.0, 536.0, 200.0), "q147.webp", "Campo com jogadores Q1 a Q6, trave AB e ângulo alfa (ENEM 2023 Q147)", "geometria"),
        ("2023:152_enunciado", 21, (40.0, 150.0, 268.0, 338.8), "q152.webp", "Seis primeiros números figurados pentagonais: 1, 5, 12, 22, 35 e 51 (ENEM 2023 Q152)", "geometria"),
        ("2023:154_enunciado", 22, (31.5, 180.5, 278.0, 316.0), "q154.webp", "Gráfico de dispersão de massa corporal (kg) e altura (m) de dez estudantes (ENEM 2023 Q154)", "grafico"),
        ("2023:162_enunciado", 24, (33.0, 392.0, 275.0, 593.6), "q162.webp", "Gráfico comparando valores das criptomoedas A e B ao longo do tempo (ENEM 2023 Q162)", "grafico"),
        ("2023:172_enunciado", 27, (288.0, 62.0, 536.0, 256.0), "q172.webp", "Gráfico da distância do vigilante à base em função do tempo (ENEM 2023 Q172)", "grafico"),
    ]
    for chave, p_idx, rect_t, fname, alt, tv in enunciados_especs:
        resultado[chave] = recortar_enunciado_regiao(
            pdf_2023, p_idx, rect_t, dir_2023 / fname, alt, tv
        )

    out_json = RAIZ / "scripts" / "questoes" / ".staging" / "alt_figuras_2023.json"
    out_json.write_text(json.dumps(resultado, ensure_ascii=False, indent=2), encoding="utf-8")
    return resultado


def recortar_figuras_2022() -> dict[str, object]:
    """Recorta alternativas graficas A-E (Q158, Q163, Q165, Q178) e limpa figuras de enunciado do ENEM 2022."""
    pdf_2022 = ENEM_PDF_2019.parent / "2022-2022_PV_impresso_D2_CD5.pdf"
    dir_2022 = RAIZ / "public" / "enem" / "figuras" / "2022"
    dir_2022.mkdir(parents=True, exist_ok=True)
    resultado: dict[str, object] = {}

    resultado["2022:158_alt"] = recortar_regioes_alt(
        pdf_2022,
        22,
        {
            "A": (308.0, 93.0, 389.5, 155.5),
            "B": (308.0, 158.0, 389.5, 220.5),
            "C": (308.0, 223.0, 389.5, 285.5),
            "D": (308.0, 288.5, 389.5, 351.0),
            "E": (308.0, 353.5, 389.5, 416.0),
        },
        dir_2022,
        "q158",
        "geometria",
        "Planificação do cubo na alternativa {letra} (ENEM 2022 Q158)",
    )
    resultado["2022:163_alt"] = recortar_regioes_alt(
        pdf_2022,
        24,
        {
            "A": (49.5, 484.5, 158.0, 593.0),
            "B": (220.5, 484.5, 329.0, 593.0),
            "C": (389.5, 484.5, 498.5, 593.0),
            "D": (49.5, 613.5, 158.0, 722.0),
            "E": (220.5, 613.5, 329.0, 722.0),
        },
        dir_2022,
        "q163",
        "geometria",
        "Figura plana desdobrada da alternativa {letra} (ENEM 2022 Q163)",
    )
    resultado["2022:165_alt"] = recortar_regioes_alt(
        pdf_2022,
        25,
        {
            "A": (306.5, 379.5, 365.5, 438.5),
            "B": (306.5, 451.0, 365.5, 509.5),
            "C": (306.5, 522.0, 365.5, 581.0),
            "D": (306.5, 593.5, 365.5, 652.0),
            "E": (306.5, 665.0, 365.5, 723.5),
        },
        dir_2022,
        "q165",
        "geometria",
        "Vista superior da projeção ortogonal na alternativa {letra} (ENEM 2022 Q165)",
    )
    resultado["2022:178_alt"] = recortar_regioes_alt(
        pdf_2022,
        30,
        {
            "A": (46.0, 437.0, 200.0, 472.0),
            "B": (46.0, 499.0, 200.0, 534.0),
            "C": (46.0, 560.5, 200.0, 596.0),
            "D": (46.0, 621.5, 200.0, 657.0),
            "E": (46.0, 681.5, 200.0, 717.0),
        },
        dir_2022,
        "q178",
        "geometria",
        "Projeção ortogonal do trajeto do robô na alternativa {letra} (ENEM 2022 Q178)",
    )

    enunciados_especs = [
        ("2022:158_f1", 22, (91.0, 394.0, 218.0, 510.5), "q158.webp", "Figura 1 — Planificação modelo do cubo sem faces pintadas (ENEM 2022 Q158)", "geometria"),
        ("2022:162_f1", 23, (296.0, 227.5, 527.0, 330.0), "q162.webp", "Figura 1 — Exemplos de preenchimento em linha, coluna e diagonal no bingo (ENEM 2022 Q162)", "ilustracao"),
        ("2022:162_f2", 23, (367.0, 431.0, 450.0, 526.2), "q162-2.webp", "Figura 2 — Cartela de Pedro com 03, 48, 27 e 07 assinalados (ENEM 2022 Q162)", "ilustracao"),
        ("2022:163_f1", 24, (57.0, 132.0, 507.0, 250.5), "q163.webp", "Figuras 1, 2 e 3 — Sequência de duas dobras do quadrado ao redor do ponto O (ENEM 2022 Q163)", "geometria"),
        ("2022:163_f2", 24, (169.0, 331.0, 402.0, 454.5), "q163-2.webp", "Figuras 4 e 5 — Arco de centro R e raio OM/2 recortado no papel dobrado (ENEM 2022 Q163)", "geometria"),
        ("2022:165_enunciado", 25, (293.0, 161.0, 530.0, 338.0), "q165.webp", "Globo terrestre com Meridianos 1 e 2, Linha do Equador e plano alfa (ENEM 2022 Q165)", "geometria"),
        ("2022:171_f2", 27, (294.0, 419.0, 521.0, 596.0), "q171-2.webp", "Detalhe do espaçamento de 1 metro entre os encostos das fileiras (ENEM 2022 Q171)", "geometria"),
        ("2022:179_enunciado", 30, (288.0, 151.5, 535.0, 336.5), "q179.webp", "Planta baixa com varanda em L e medidas 16 cm, 5 cm, 18,4 cm e 4 cm na escala 1:50 (ENEM 2022 Q179)", "geometria"),
        ("2022:180_enunciado", 30, (287.5, 518.0, 537.0, 653.0), "q180.webp", "Gráfico linear das vendas dos setores Adulto e Infantil entre os dias 10 e 30 (ENEM 2022 Q180)", "grafico"),
    ]
    for chave, p_idx, rect_t, fname, alt, tv in enunciados_especs:
        resultado[chave] = recortar_enunciado_regiao(
            pdf_2022, p_idx, rect_t, dir_2022 / fname, alt, tv
        )

    out_json = RAIZ / "scripts" / "questoes" / ".staging" / "alt_figuras_2022.json"
    out_json.write_text(json.dumps(resultado, ensure_ascii=False, indent=2), encoding="utf-8")
    return resultado


def recortar_figuras_2020() -> dict[str, object]:
    """Recorta alternativas graficas A-E (Q136, Q137, Q159, Q173) e limpa/adiciona figuras de enunciado do ENEM 2020."""
    pdf_2020 = ENEM_PDF_2019.parent / "2020-2020_PV_impresso_D2_CD5.pdf"
    dir_2020 = RAIZ / "public" / "enem" / "figuras" / "2020"
    dir_2020.mkdir(parents=True, exist_ok=True)
    resultado: dict[str, object] = {}

    resultado["2020:136_alt"] = recortar_regioes_alt(
        pdf_2020,
        15,
        {
            "A": (51.0, 313.0, 228.5, 442.0),
            "B": (53.5, 451.0, 231.0, 580.0),
            "C": (55.5, 594.0, 230.5, 724.0),
            "D": (307.0, 314.5, 482.0, 444.5),
            "E": (306.5, 448.5, 481.5, 584.0),
        },
        dir_2020,
        "q136",
        "grafico",
        "Gráfico do lucro em função da quantidade de itens produzidos na alternativa {letra} (ENEM 2020 Q136)",
    )
    resultado["2020:137_alt"] = recortar_regioes_alt(
        pdf_2020,
        16,
        {
            "A": (55.5, 326.5, 187.0, 458.5),
            "B": (55.5, 462.5, 187.0, 594.5),
            "C": (55.5, 598.5, 187.0, 730.0),
            "D": (306.0, 326.5, 438.0, 458.5),
            "E": (306.0, 462.5, 438.0, 594.5),
        },
        dir_2020,
        "q137",
        "geometria",
        "Projeções ortogonais do sólido de quatro cubos nos três planos na alternativa {letra} (ENEM 2020 Q137)",
    )
    resultado["2020:159_alt"] = recortar_regioes_alt(
        pdf_2020,
        24,
        {
            "A": (52.5, 283.0, 133.5, 343.0),
            "B": (52.5, 348.0, 133.5, 408.0),
            "C": (52.5, 413.0, 133.0, 473.0),
            "D": (176.5, 283.0, 256.5, 341.8),
            "E": (176.5, 345.0, 256.5, 400.0),
        },
        dir_2020,
        "q159",
        "geometria",
        "Planta do telhado de três caídas de água na alternativa {letra} (ENEM 2020 Q159)",
    )
    resultado["2020:173_alt"] = recortar_regioes_alt(
        pdf_2020,
        28,
        {
            "A": (311.0, 113.0, 412.5, 194.0),
            "B": (310.5, 196.5, 412.5, 277.5),
            "C": (311.0, 279.5, 412.5, 360.8),
            "D": (311.5, 363.5, 412.5, 443.0),
            "E": (311.0, 447.0, 410.5, 524.5),
        },
        dir_2020,
        "q173",
        "grafico",
        "Gráfico da altura do líquido em função do tempo na alternativa {letra} (ENEM 2020 Q173)",
    )

    enunciados_especs = [
        ("2020:136_enunciado", 15, (183.5, 137.0, 376.0, 278.8), "q136.webp", "Gráfico de receita e custo de produção em função da quantidade de itens produzidos (ENEM 2020 Q136)", "grafico"),
        ("2020:142_enunciado", 18, (100.0, 494.5, 209.0, 582.8), "q142.webp", "Malha quadriculada 5 por 5 representando as ruas do condomínio e os pontos A, C e B (ENEM 2020 Q142)", "geometria"),
        ("2020:149_enunciado", 20, (287.0, 251.5, 538.0, 355.5), "q149.webp", "Mapa dos 42 assentos do ônibus destacando em escuro os 16 já vendidos (ENEM 2020 Q149)", "ilustracao"),
        ("2020:151_enunciado", 21, (28.5, 399.5, 279.0, 621.0), "q151.webp", "Gráficos de barras de peças produzidas e horas trabalhadas do Dia 1 ao Dia 5 (ENEM 2020 Q151)", "grafico"),
        ("2020:155_enunciado", 23, (35.5, 158.0, 268.5, 275.5), "q155.webp", "Gráfico de colunas sobre jovens em atividade entre 15 e 29 anos em percentual (ENEM 2020 Q155)", "grafico"),
        ("2020:159_enunciado", 24, (31.5, 158.0, 273.5, 232.0), "q159.webp", "Figura 1 com casa e planta de telhado de duas águas e Figura 2 com casa de telhado de três caídas (ENEM 2020 Q159)", "geometria"),
        ("2020:167_f1", 26, (293.5, 172.0, 532.0, 350.0), "q167.webp", "Gráfico de colunas com o preço unitário em real dos perfumes I a V (ENEM 2020 Q167)", "grafico"),
        ("2020:167_f2", 26, (297.5, 366.0, 525.5, 550.0), "q167-2.webp", "Gráfico de setores com a porcentagem da quantidade vendida de cada perfume (ENEM 2020 Q167)", "grafico"),
        ("2020:180_enunciado", 30, (290.0, 170.5, 535.5, 359.0), "q180.webp", "Esquema tridimensional do pergolado com vãos de 30 cm entre vigas paralelas e detalhe ampliado (ENEM 2020 Q180)", "geometria"),
    ]
    for chave, p_idx, rect_t, fname, alt, tv in enunciados_especs:
        resultado[chave] = recortar_enunciado_regiao(
            pdf_2020, p_idx, rect_t, dir_2020 / fname, alt, tv
        )

    out_json = RAIZ / "scripts" / "questoes" / ".staging" / "alt_figuras_2020.json"
    out_json.write_text(json.dumps(resultado, ensure_ascii=False, indent=2), encoding="utf-8")
    return resultado


def recortar_figuras_2017() -> dict[str, object]:
    """Recorta alternativas graficas A-E (Q156) e limpa/adiciona figuras de enunciado do ENEM 2017."""
    pdf_2017 = ENEM_PDF_2019.parent / "2017-2017_PV_impresso_D2_CD5.pdf"
    dir_2017 = RAIZ / "public" / "enem" / "figuras" / "2017"
    dir_2017.mkdir(parents=True, exist_ok=True)
    resultado: dict[str, object] = {}

    resultado["2017:156_alt"] = recortar_regioes_alt(
        pdf_2017,
        21,
        {
            "A": (65.3, 253.6, 225.5, 387.6),
            "B": (65.1, 386.0, 223.4, 518.5),
            "C": (65.1, 521.6, 223.1, 653.8),
            "D": (319.0, 253.7, 479.2, 387.8),
            "E": (319.0, 386.0, 479.2, 520.1),
        },
        dir_2017,
        "q156",
        "grafico",
        "Gráfico do tempo de funcionamento da bomba até encher o reservatório na alternativa {letra} (ENEM 2017 Q156)",
    )

    enunciados_especs: list[tuple[str, int, tuple[float, float, float, float], str, str, str]] = [
        ("2017:158_enunciado", 22, (292.8, 201.0, 545.5, 367.5), "q158.webp", "Mapa do bairro com quadras numeradas de 1 a 16, pontos de ônibus de 1 a 5, localização X da padaria e rosa dos ventos (ENEM 2017 Q158)", "geometria"),
        ("2017:173_enunciado", 27, (35.8, 124.5, 543.4, 495.6), "q173.webp", "Gráfico da quantidade de água armazenada ao longo das horas do dia nos reservatórios A e B com eixos verticais distintos (ENEM 2017 Q173)", "grafico"),
        ("2017:176_enunciado", 29, (88.5, 133.5, 492.6, 276.0), "q176.webp", "Figura 1 com a capela da Lagoa da Pampulha e Figura 2 com a vista frontal da abóbada parabólica de altura H e base 5 m (ENEM 2017 Q176)", "geometria"),
        ("2017:177_f1", 29, (106.0, 500.0, 281.0, 646.0), "q177.webp", "Gráfico de setores com a distribuição percentual dos clientes por tempo de acesso na sexta-feira (ENEM 2017 Q177)", "grafico"),
        ("2017:177_f2", 29, (307.0, 500.0, 473.0, 646.0), "q177-2.webp", "Gráfico de setores com a distribuição percentual dos clientes por tempo de acesso no sábado (ENEM 2017 Q177)", "grafico"),
        ("2017:178_f1", 30, (42.0, 134.0, 270.0, 327.5), "q178.webp", "Gráfico 1 de colunas completo com eixo vertical de 0% a 70% para os candidatos A e B (ENEM 2017 Q178)", "grafico"),
        ("2017:178_f2", 30, (42.0, 360.0, 270.0, 531.5), "q178-2.webp", "Gráfico 2 de colunas truncado com eixo vertical de 20% a 70% para os candidatos A e B (ENEM 2017 Q178)", "grafico"),
        ("2017:180_enunciado", 30, (293.6, 461.6, 545.6, 606.8), "q180.webp", "Esquema da seção circular do melão esférico de centro O, raio r e calota inferior de altura h a ser cortada (ENEM 2017 Q180)", "geometria"),
    ]
    for chave, p_idx, rect_t, fname, alt, tv in enunciados_especs:
        resultado[chave] = recortar_enunciado_regiao(
            pdf_2017, p_idx, rect_t, dir_2017 / fname, alt, tv
        )

    out_json = RAIZ / "scripts" / "questoes" / ".staging" / "alt_figuras_2017.json"
    out_json.write_text(json.dumps(resultado, ensure_ascii=False, indent=2), encoding="utf-8")
    return resultado


def recortar_figuras_2016() -> dict[str, object]:
    """Recorta alternativas graficas A-E (Q172, Q178) e limpa figuras de enunciado (Q159, Q171) do ENEM 2016."""
    pdf_2016 = ENEM_PDF_2019.parent / "2016-2016_PV_impresso_D2_CD5.pdf"
    dir_2016 = RAIZ / "public" / "enem" / "figuras" / "2016"
    dir_2016.mkdir(parents=True, exist_ok=True)
    resultado: dict[str, object] = {}

    resultado["2016:172_alt"] = recortar_regioes_alt(
        pdf_2016,
        28,
        {
            "A": (78.0, 419.0, 175.0, 509.0),
            "B": (78.0, 534.0, 175.0, 594.0),
            "C": (78.0, 622.0, 175.0, 645.0),
            "D": (78.0, 670.0, 175.0, 692.0),
            "E": (78.0, 720.0, 175.0, 752.0),
        },
        dir_2016,
        "q172",
        "geometria",
        "Projeção ortogonal no plano alfa do caminho ABC traçado no globo terrestre na alternativa {letra} (ENEM 2016 Q172)",
    )
    resultado["2016:178_alt"] = recortar_regioes_alt(
        pdf_2016,
        30,
        {
            "A": (74.0, 322.0, 112.0, 373.0),
            "B": (74.0, 412.0, 112.0, 463.0),
            "C": (74.0, 503.0, 112.0, 573.0),
            "D": (74.0, 592.0, 112.0, 666.0),
            "E": (74.0, 684.0, 112.0, 759.0),
        },
        dir_2016,
        "q178",
        "geometria",
        "Esboço da vista lateral da cadeira dobrável fechada na alternativa {letra} (ENEM 2016 Q178)",
    )

    enunciados_especs: list[tuple[str, int, tuple[float, float, float, float], str, str, str]] = [
        ("2016:159_enunciado", 24, (115.0, 322.2, 255.0, 446.0), "q159.webp", "Bloco de madeira com perfurações quadrada Q, retangular R, triangular equilátera T e circular pontilhada C (ENEM 2016 Q159)", "geometria"),
        ("2016:171_enunciado", 27, (345.0, 435.5, 535.0, 588.8), "q171.webp", "Sistema cartesiano xOy mostrando os pontos F(-1, 1) e B(1, -1) ligados por segmento retilíneo e semicircunferência (ENEM 2016 Q171)", "geometria"),
    ]
    for chave, p_idx, rect_t, fname, alt, tv in enunciados_especs:
        resultado[chave] = recortar_enunciado_regiao(
            pdf_2016, p_idx, rect_t, dir_2016 / fname, alt, tv
        )

    out_json = RAIZ / "scripts" / "questoes" / ".staging" / "alt_figuras_2016.json"
    out_json.write_text(json.dumps(resultado, ensure_ascii=False, indent=2), encoding="utf-8")
    return resultado


def recortar_figuras_2015() -> dict[str, object]:
    """Recorta alternativas graficas A-E (Q138, Q148) e limpa/re-recorta figuras (Q142, Q143, Q147, Q148, Q150) do ENEM 2015."""
    pdf_2015 = ENEM_PDF_2019.parent / "2015-2015_PV_impresso_D2_CD5.pdf"
    dir_2015 = RAIZ / "public" / "enem" / "figuras" / "2015"
    dir_2015.mkdir(parents=True, exist_ok=True)
    resultado: dict[str, object] = {}

    resultado["2015:138_alt"] = recortar_regioes_alt(
        pdf_2015,
        18,
        {
            "A": (322.0, 214.0, 496.0, 317.0),
            "B": (322.0, 322.0, 496.0, 425.0),
            "C": (322.0, 430.0, 496.0, 533.0),
            "D": (322.0, 536.0, 496.0, 639.0),
            "E": (322.0, 643.5, 496.0, 745.2),
        },
        dir_2015,
        "q138",
        "grafico",
        "Gráfico do valor mensal pago em reais pelo número de ligações na alternativa {letra} (ENEM 2015 Q138)",
    )
    resultado["2015:148_alt"] = recortar_regioes_alt(
        pdf_2015,
        22,
        {
            "A": (55.0, 382.0, 114.0, 436.0),
            "B": (55.0, 453.0, 114.0, 507.0),
            "C": (55.0, 524.0, 114.0, 578.0),
            "D": (55.0, 595.0, 114.0, 651.0),
            "E": (55.0, 668.0, 114.0, 722.0),
        },
        dir_2015,
        "q148",
        "geometria",
        "Formato da bandeirinha após desdobrar a folha cortada na alternativa {letra} (ENEM 2015 Q148)",
    )

    enunciados_especs: list[tuple[str, int, tuple[float, float, float, float], str, str, str]] = [
        ("2015:142_enunciado", 20, (34.0, 212.0, 288.0, 384.0), "q142.webp", "Tabela completa de notas das escolas de samba I a V nos quesitos 1 a 4 e Total (ENEM 2015 Q142)", "tabela"),
        ("2015:143_enunciado", 20, (296.0, 145.0, 558.0, 353.0), "q143.webp", "Contêiner modelo de dimensões 6,4 m por 2,5 m por 2,5 m (Figura 1) (ENEM 2015 Q143)", "ilustracao"),
        ("2015:147_enunciado", 21, (356.0, 506.0, 484.0, 572.5), "q147.webp", "Imagem da caneta aplicadora de insulina com refil (ENEM 2015 Q147)", "ilustracao"),
        ("2015:148_enunciado", 22, (73.0, 213.0, 246.0, 325.0), "q148.webp", "Figura 1 (folha quadrada ABCD) e Figura 2 (folha dobrada com pontos médios O, N, ponto M e linhas pontilhadas de corte) (ENEM 2015 Q148)", "geometria"),
        ("2015:150_enunciado", 22, (294.0, 374.0, 547.0, 538.5), "q150.webp", "Gráficos de setores PET RECICLADO 2010: Usos Finais e subdivisão de Usos Finais Têxteis (ENEM 2015 Q150)", "grafico"),
    ]
    for chave, p_idx, rect_t, fname, alt, tv in enunciados_especs:
        resultado[chave] = recortar_enunciado_regiao(
            pdf_2015, p_idx, rect_t, dir_2015 / fname, alt, tv
        )

    out_json = RAIZ / "scripts" / "questoes" / ".staging" / "alt_figuras_2015.json"
    out_json.write_text(json.dumps(resultado, ensure_ascii=False, indent=2), encoding="utf-8")
    return resultado


def recortar_figuras_2014() -> dict[str, object]:
    """Recorta alternativas graficas A-E (Q139, Q140, Q153, Q154) e limpa figuras de enunciado (Q136-2, Q141, Q148-2, Q153, Q154, Q157, Q172) do ENEM 2014."""
    pdf_2014 = ENEM_PDF_2019.parent / "2014-2014_PV_impresso_D2_CD5.pdf"
    dir_2014 = RAIZ / "public" / "enem" / "figuras" / "2014"
    dir_2014.mkdir(parents=True, exist_ok=True)
    resultado: dict[str, object] = {}

    resultado["2014:139_alt"] = recortar_regioes_alt(
        pdf_2014,
        19,
        {
            "A": (54.0, 300.0, 144.0, 370.0),
            "B": (54.0, 390.0, 144.0, 460.0),
            "C": (54.0, 480.0, 144.0, 550.0),
            "D": (54.0, 569.0, 144.0, 638.0),
            "E": (54.0, 657.5, 144.0, 727.0),
        },
        dir_2014,
        "q139",
        "grafico",
        "Gráfico da altura h da água em função do tempo t na alternativa {letra} (ENEM 2014 Q139)",
    )
    resultado["2014:140_alt"] = recortar_regioes_alt(
        pdf_2014,
        19,
        {
            "A": (314.0, 202.0, 422.0, 280.0),
            "B": (314.0, 326.0, 422.0, 383.0),
            "C": (314.0, 432.0, 422.0, 523.0),
            "D": (314.0, 541.5, 422.0, 630.5),
            "E": (314.0, 656.0, 422.0, 732.5),
        },
        dir_2014,
        "q140",
        "geometria",
        "Forma do adesivo planificado para o cone na alternativa {letra} (ENEM 2014 Q140)",
    )
    resultado["2014:153_alt"] = recortar_regioes_alt(
        pdf_2014,
        23,
        {
            "A": (312.0, 504.0, 360.0, 550.0),
            "B": (312.0, 552.0, 360.0, 598.0),
            "C": (312.0, 599.5, 360.0, 646.0),
            "D": (312.0, 647.5, 360.0, 694.0),
            "E": (312.0, 695.5, 360.0, 742.0),
        },
        dir_2014,
        "q153",
        "ilustracao",
        "Placa de sinalização com limite de velocidade na alternativa {letra} (ENEM 2014 Q153)",
    )
    resultado["2014:154_alt"] = recortar_regioes_alt(
        pdf_2014,
        24,
        {
            "A": (50.0, 343.0, 134.0, 411.0),
            "B": (50.0, 430.0, 134.0, 492.0),
            "C": (50.0, 499.0, 134.0, 579.0),
            "D": (50.0, 587.0, 134.0, 656.0),
            "E": (50.0, 670.0, 134.0, 735.0),
        },
        dir_2014,
        "q154",
        "geometria",
        "Projeção ortogonal sobre o piso na alternativa {letra} (ENEM 2014 Q154)",
    )

    enunciados_especs: list[tuple[str, int, tuple[float, float, float, float], str, str, str]] = [
        ("2014:136_2_enunciado", 18, (36.0, 371.0, 281.0, 608.6), "q136-2.webp", "Figura 2: Folha de papel 42 cm x 30 cm com margens proibidas de 3 cm e região disponível (ENEM 2014 Q136)", "geometria"),
        ("2014:141_enunciado", 20, (35.5, 134.0, 286.0, 250.5), "q141.webp", "Gráfico completo de taxas de desemprego aberto, oculto e total de Jan. a Dez. (ENEM 2014 Q141)", "grafico"),
        ("2014:148_2_enunciado", 22, (35.5, 413.0, 286.0, 623.0), "q148-2.webp", "Gráfico 2: Número de funcionários por grau de instrução em 2013 e 2014 (ENEM 2014 Q148)", "grafico"),
        ("2014:153_enunciado", 23, (302.0, 122.2, 536.0, 313.8), "q153.webp", "Ilustração do sistema de dois radares separados por 2,1 km para medição de velocidade média (ENEM 2014 Q153)", "ilustracao"),
        ("2014:154_enunciado", 24, (93.0, 162.5, 229.0, 295.6), "q154.webp", "Escada circular com pilar central P e pontos A, B, C, D e E (ENEM 2014 Q154)", "geometria"),
        ("2014:157_enunciado", 25, (62.0, 154.5, 258.0, 380.0), "q157.webp", "Gráfico de valor mensal em reais pelo tempo mensal em minutos dos planos A a E (ENEM 2014 Q157)", "grafico"),
        ("2014:172_enunciado", 29, (33.5, 151.0, 286.0, 317.0), "q172.webp", "Gráfico das bactérias das espécies I e II de Seg. a Dom. (ENEM 2014 Q172)", "grafico"),
    ]
    for chave, p_idx, rect_t, fname, alt, tv in enunciados_especs:
        resultado[chave] = recortar_enunciado_regiao(
            pdf_2014, p_idx, rect_t, dir_2014 / fname, alt, tv
        )

    out_json = RAIZ / "scripts" / "questoes" / ".staging" / "alt_figuras_2014.json"
    out_json.write_text(json.dumps(resultado, ensure_ascii=False, indent=2), encoding="utf-8")
    return resultado


def recortar_figuras_2013() -> dict[str, object]:
    """Recorta alternativas graficas A-E (Q138, Q142, Q160, Q173) e limpa/adiciona figuras de enunciado (Q136, Q138, Q139, Q145, Q150, Q169, Q171, Q172, Q178) do ENEM 2013."""
    pdf_2013 = ENEM_PDF_2019.parent / "2013-dia2_caderno5_amarelo.pdf"
    dir_2013 = RAIZ / "public" / "enem" / "figuras" / "2013"
    dir_2013.mkdir(parents=True, exist_ok=True)
    resultado: dict[str, object] = {}

    resultado["2013:138_alt"] = recortar_regioes_alt(
        pdf_2013,
        18,
        {
            "A": (310.0, 353.0, 395.0, 504.0),
            "B": (310.0, 510.0, 390.0, 651.0),
            "C": (310.0, 659.0, 396.0, 738.0),
            "D": (460.0, 392.0, 542.0, 468.0),
            "E": (460.0, 540.0, 542.0, 616.0),
        },
        dir_2013,
        "q138",
        "grafico",
        "Gráfico Força x Tempo dos cinco satélites na alternativa {letra} (ENEM 2013 Q138)",
    )
    resultado["2013:142_alt"] = recortar_regioes_alt(
        pdf_2013,
        20,
        {
            "A": (66.0, 250.0, 212.0, 395.0),
            "B": (66.0, 424.0, 212.0, 569.0),
            "C": (66.0, 586.0, 212.0, 725.0),
            "D": (328.0, 250.0, 472.0, 394.0),
            "E": (328.0, 421.0, 472.0, 565.0),
        },
        dir_2013,
        "q142",
        "grafico",
        "Representação dos cinco conjuntos no plano cartesiano na alternativa {letra} (ENEM 2013 Q142)",
    )
    resultado["2013:160_alt"] = recortar_regioes_alt(
        pdf_2013,
        25,
        {
            "A": (50.0, 254.0, 162.0, 324.0),
            "B": (50.0, 335.0, 162.0, 406.0),
            "C": (50.0, 417.0, 162.0, 488.0),
            "D": (50.0, 501.0, 162.0, 611.0),
            "E": (50.0, 622.0, 162.0, 734.0),
        },
        dir_2013,
        "q160",
        "geometria",
        "Nova figura obtida por simetria em relação ao ponto O na alternativa {letra} (ENEM 2013 Q160)",
    )
    resultado["2013:173_alt"] = recortar_regioes_alt(
        pdf_2013,
        28,
        {
            "A": (335.0, 456.0, 428.0, 488.0),
            "B": (335.0, 492.0, 428.0, 528.0),
            "C": (335.0, 538.0, 428.0, 610.0),
            "D": (335.0, 614.0, 428.0, 680.0),
            "E": (335.0, 685.0, 428.0, 742.0),
        },
        dir_2013,
        "q173",
        "geometria",
        "Projeção ortogonal no chão das trajetórias A e B na alternativa {letra} (ENEM 2013 Q173)",
    )

    enunciados_especs: list[tuple[str, int, tuple[float, float, float, float], str, str, str]] = [
        ("2013:136_enunciado", 18, (98.0, 139.0, 226.0, 292.0), "q136.webp", "Interior parabólico da taça com vértice V no eixo x e altura C do líquido (ENEM 2013 Q136)", "geometria"),
        ("2013:138_enunciado", 18, (358.0, 205.5, 483.0, 324.2), "q138.webp", "Esquema das trajetórias circulares dos satélites A, B, C, D e E em torno da Terra (ENEM 2013 Q138)", "geometria"),
        ("2013:139_enunciado", 19, (36.0, 144.0, 282.0, 311.5), "q139.webp", "Gráfico Crescimento - Indústria: Brasil, São Paulo (Estado), São Paulo (Capital) e Guarulhos (ENEM 2013 Q139)", "grafico"),
        ("2013:145_enunciado", 21, (358.0, 58.0, 482.0, 176.2), "q145.webp", "Planta circular da piscina de raio R com ilha de lazer concêntrica de raio r (ENEM 2013 Q145)", "geometria"),
        ("2013:150_enunciado", 22, (325.0, 166.0, 490.0, 296.8), "q150.webp", "Gráfico de setores dos 200 hotéis por valor da diária A, B, C e D (ENEM 2013 Q150)", "grafico"),
        ("2013:169_enunciado", 27, (364.0, 108.0, 477.0, 196.2), "q169.webp", "Forma de bolo composta por dois troncos de cone concêntricos (ENEM 2013 Q169)", "geometria"),
        ("2013:171_enunciado", 28, (115.0, 128.0, 202.0, 278.0), "q171.webp", "Taça com raios AC na borda superior e BD na base circular (ENEM 2013 Q171)", "geometria"),
        ("2013:172_enunciado", 28, (62.0, 657.0, 255.0, 738.0), "q172.webp", "Dois postes AC=4 m e BD=6 m ligados por cabos AD e BC com haste central EF (ENEM 2013 Q172)", "geometria"),
        ("2013:178_enunciado", 30, (106.0, 414.0, 216.0, 520.4), "q178.webp", "Três canos de raio 30 cm soldados dentro de um cano de raio R com folga de 10 cm (ENEM 2013 Q178)", "geometria"),
    ]
    for chave, p_idx, rect_t, fname, alt, tv in enunciados_especs:
        resultado[chave] = recortar_enunciado_regiao(
            pdf_2013, p_idx, rect_t, dir_2013 / fname, alt, tv
        )

    # Mascara em branco o canto superior esquerdo de q178.webp onde o final "a:" de "conforme a figura:" vaza acima do arco
    import fitz as _fitz_178
    with _fitz_178.open(pdf_2013) as _doc178:
        _pix178 = _doc178[30].get_pixmap(matrix=_fitz_178.Matrix(3.0, 3.0), clip=_fitz_178.Rect(106.0, 414.0, 216.0, 520.4), alpha=False)
        _im178 = Image.frombytes("RGB", [_pix178.width, _pix178.height], _pix178.samples)
        from PIL import ImageDraw as _ImageDraw178
        _ImageDraw178.Draw(_im178).rectangle([0, 0, int((120.0 - 106.0) * 3.0), int((424.0 - 414.0) * 3.0)], fill=(255, 255, 255))
        _meta178 = aparar_e_salvar_webp(_im178, dir_2013 / "q178.webp")
        resultado["2013:178_enunciado"][0]["largura"] = _meta178["largura"]
        resultado["2013:178_enunciado"][0]["altura"] = _meta178["altura"]

    out_json = RAIZ / "scripts" / "questoes" / ".staging" / "alt_figuras_2013.json"
    out_json.write_text(json.dumps(resultado, ensure_ascii=False, indent=2), encoding="utf-8")
    return resultado


def main() -> None:
    parser = argparse.ArgumentParser(description="Otimizador e conversor WebP de figuras de provas")
    parser.add_argument("--converter-existentes", action="store_true", help="Converte PNGs existentes para WebP")
    parser.add_argument("--recortar-alt-piloto", action="store_true", help="Recorta alternativas graficas A-E do piloto 2018/2019")
    parser.add_argument("--recortar-alt-2021", action="store_true", help="Recorta alternativas graficas e limpa figuras de enunciado do ENEM 2021")
    parser.add_argument("--recortar-alt-2025", action="store_true", help="Recorta alternativas graficas e limpa figuras de enunciado do ENEM 2025")
    parser.add_argument("--recortar-alt-2026", action="store_true", help="Recorta alternativas graficas e limpa figuras de enunciado do ENEM 2026")
    parser.add_argument("--recortar-alt-2024", action="store_true", help="Recorta alternativas graficas e limpa figuras de enunciado do ENEM 2024")
    parser.add_argument("--recortar-alt-2023", action="store_true", help="Recorta alternativas graficas e limpa figuras de enunciado do ENEM 2023")
    parser.add_argument("--recortar-alt-2022", action="store_true", help="Recorta alternativas graficas e limpa figuras de enunciado do ENEM 2022")
    parser.add_argument("--recortar-alt-2020", action="store_true", help="Recorta alternativas graficas e limpa/adiciona figuras de enunciado do ENEM 2020")
    parser.add_argument("--recortar-alt-2017", action="store_true", help="Recorta alternativas graficas e limpa/adiciona figuras de enunciado do ENEM 2017")
    parser.add_argument("--recortar-alt-2016", action="store_true", help="Recorta alternativas graficas e limpa figuras de enunciado do ENEM 2016")
    parser.add_argument("--recortar-alt-2015", action="store_true", help="Recorta alternativas graficas e limpa figuras de enunciado do ENEM 2015")
    parser.add_argument("--recortar-alt-2014", action="store_true", help="Recorta alternativas graficas e limpa figuras de enunciado do ENEM 2014")
    parser.add_argument("--recortar-alt-2013", action="store_true", help="Recorta alternativas graficas e limpa figuras de enunciado do ENEM 2013")
    parser.add_argument("--qualidade", type=int, default=88, help="Qualidade WebP lossy (padrao 88)")
    args = parser.parse_args()

    if args.recortar_alt_piloto:
        res = recortar_alternativas_piloto()
        print(json.dumps({k: len(v) for k, v in res.items()}, ensure_ascii=False, indent=2))
        return

    if args.recortar_alt_2021:
        res = recortar_figuras_2021()
        print(json.dumps({k: len(v) for k, v in res.items()}, ensure_ascii=False, indent=2))
        return

    if args.recortar_alt_2025:
        res = recortar_figuras_2025()
        print(json.dumps({k: len(v) for k, v in res.items()}, ensure_ascii=False, indent=2))
        return

    if args.recortar_alt_2026:
        res = recortar_figuras_2026()
        print(json.dumps({k: len(v) for k, v in res.items()}, ensure_ascii=False, indent=2))
        return

    if args.recortar_alt_2024:
        res = recortar_figuras_2024()
        print(json.dumps({k: len(v) for k, v in res.items()}, ensure_ascii=False, indent=2))
        return

    if args.recortar_alt_2023:
        res = recortar_figuras_2023()
        print(json.dumps({k: len(v) for k, v in res.items()}, ensure_ascii=False, indent=2))
        return

    if args.recortar_alt_2022:
        res = recortar_figuras_2022()
        print(json.dumps({k: len(v) for k, v in res.items()}, ensure_ascii=False, indent=2))
        return

    if args.recortar_alt_2020:
        res = recortar_figuras_2020()
        print(json.dumps({k: len(v) for k, v in res.items()}, ensure_ascii=False, indent=2))
        return

    if args.recortar_alt_2017:
        res = recortar_figuras_2017()
        print(json.dumps({k: len(v) for k, v in res.items()}, ensure_ascii=False, indent=2))
        return

    if args.recortar_alt_2016:
        res = recortar_figuras_2016()
        print(json.dumps({k: len(v) for k, v in res.items()}, ensure_ascii=False, indent=2))
        return

    if args.recortar_alt_2015:
        res = recortar_figuras_2015()
        print(json.dumps({k: len(v) for k, v in res.items()}, ensure_ascii=False, indent=2))
        return

    if args.recortar_alt_2014:
        res = recortar_figuras_2014()
        print(json.dumps({k: len(v) for k, v in res.items()}, ensure_ascii=False, indent=2))
        return

    if args.recortar_alt_2013:
        res = recortar_figuras_2013()
        print(json.dumps({k: len(v) for k, v in res.items()}, ensure_ascii=False, indent=2))
        return

    if not args.converter_existentes:
        parser.print_help()
        return

    resumo = converter_existentes(qualidade=args.qualidade)
    print(json.dumps(resumo, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
