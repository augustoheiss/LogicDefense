"""Monta JSON completo no formato DesafioUnificado a partir de bruto + pedagogia curada.

Evita recitacao de enunciados longos quando a camada de texto e fiel, aplicando
`enunciadoOverride` / `alternativasOverride` somente onde ha formulas, tabelas ou visao.

Uso:
  .\\venv\\Scripts\\python.exe scripts\\questoes\\04_montar_lote.py ^
    --bruto scripts/questoes/.staging/bruto/enem_2019.json ^
    --pedagogia scripts/questoes/.staging/pedagogia/enem_2019_b.json ^
    --saida scripts/questoes/.staging/aprovados/enem_2019_b.json
"""
from __future__ import annotations

import argparse
import json
import re
from pathlib import Path

TITULOS_TEMA = {
    "enem_razoes_escalas": "Razões, Escalas e Conversão de Unidades (ENEM)",
    "enem_porcentagem_financeira": "Porcentagem, Lucro e Matemática Financeira (ENEM)",
    "enem_estatistica_medias": "Médias, Mediana e Interpretação de Dados (ENEM)",
    "enem_probabilidade_contagem": "Probabilidade e Análise Combinatória (ENEM)",
    "enem_funcoes_sequencias": "Funções, Modelagem e Sequências (ENEM)",
    "enem_geometria_medidas": "Geometria Plana, Espacial e Medidas (ENEM)",
    "enem_aritmetica_ciclos": "Aritmética Aplicada, Ciclos e Sistemas (ENEM)",
    "leitura_dados_codigo": "Leitura de Dados, Códigos e Sistemas (ENEM)",
}

LETRAS = ("A", "B", "C", "D", "E")


def limpar_ruido_rodape(texto: str) -> str:
    linhas_limpas: list[str] = []
    for linha in texto.splitlines():
        l = linha.strip()
        if l and not re.sub(r"[\x00-\x1f\s]+", "", l):
            continue
        if re.match(r"^(?:\d+\s+)?(?:MT|CN|LC|CH)\s*[-·•]\s*2[ºo]\s*dia\b", l, re.I):
            continue
        if re.match(r"^\d+\s*[•·]\s*AMARELO(?:\s+\d+)?$", l, re.I):
            continue
        if re.match(r"^\*?0?\d{2,}AMAR\d+\*?$", l, re.I):
            continue
        if re.match(r"^(ENEM\d{4}\s*)+$", l, re.I) or re.match(r"^(?:ENEM|ENEN)\d{4}", l, re.I):
            continue
        if re.match(r"^MATEM[ÁA]TICA E SUAS TECNOLOGIAS(\s*[·•].*)?$", l, re.I):
            continue
        if re.match(r"^Quest[õo]es de 136 a 180$", l, re.I):
            continue
        if re.match(r"^\*?(?:P\d+AMRE\d*|[A-Z]?\d+AM(?:AR|RE)?\d+)\*?$", l, re.I):
            continue
        if re.match(r"^AT\s+EM\s+T\s+CA\b", l, re.I) or re.match(r"^uest[õo]\s+es\s+de\s+136\b", l, re.I):
            continue
        linhas_limpas.append(linha)
    return "\n".join(linhas_limpas)


def juntar_prosa(linhas: list[str]) -> str:
    if not linhas:
        return ""
    blocos: list[str] = []
    atual: list[str] = []
    for raw in linhas:
        l = raw.strip()
        if not l:
            if atual:
                blocos.append(" ".join(atual))
                atual = []
            continue
        eh_bullet = bool(re.match(r"^([•\-*]|\d+[.)])\s+", l))
        terminou_frase = bool(atual and re.search(r"[.!?:]\s*$", atual[-1]))
        comeca_pergunta = bool(atual and re.match(r"^(A|O|Os|As|Um|Uma|Qual|Quais|Quantos|Quantas|Nessas|Nesse|Nessa|Com|Para|Considerando|De|Sabendo|Se|Em|Após)\b", l) and terminou_frase)
        if eh_bullet or comeca_pergunta:
            if atual:
                blocos.append(" ".join(atual))
                atual = []
        if l.startswith("•"):
            l = "- " + l.lstrip("•").strip()
        atual.append(l)
    if atual:
        blocos.append(" ".join(atual))
    return "\n\n".join(blocos)


def parsear_ocorrencias_enem(ocorrencias: list[dict[str, object]], num: int) -> tuple[str, dict[str, str]]:
    textos = [limpar_ruido_rodape(str(o.get("texto", ""))) for o in ocorrencias]
    bruto = "\n".join(textos).strip()
    linhas = bruto.splitlines()
    if linhas and re.match(rf"^(?:QUEST[ÃA]O|U\s+ES\s+[ÃA])\s+{num}\b", linhas[0].strip(), re.I):
        linhas = linhas[1:]

    # Localiza o ultimo conjunto ordenado A, B, C, D, E no inicio de linha
    indices_letras: dict[str, list[int]] = {l: [] for l in LETRAS}
    for idx, raw in enumerate(linhas):
        m = re.match(r"^([A-E])\s+(.*)$", raw.strip())
        if m:
            indices_letras[m.group(1)].append(idx)

    pos_a_e: list[int] | None = None
    for idx_e in reversed(indices_letras["E"]):
        cand = [idx_e]
        ok = True
        cursor = idx_e
        for letra in ("D", "C", "B", "A"):
            anteriores = [i for i in indices_letras[letra] if i < cursor]
            if not anteriores:
                ok = False
                break
            cursor = anteriores[-1]
            cand.append(cursor)
        if ok:
            pos_a_e = list(reversed(cand))
            break

    if not pos_a_e:
        return juntar_prosa(linhas), {l: "" for l in LETRAS}

    enunciado = juntar_prosa(linhas[: pos_a_e[0]])
    alts: dict[str, str] = {}
    for i, letra in enumerate(LETRAS):
        ini = pos_a_e[i]
        fim = pos_a_e[i + 1] if i + 1 < 5 else len(linhas)
        pedaco: list[str] = []
        for j in range(ini, fim):
            t = linhas[j].strip()
            if j == ini:
                t = re.sub(rf"^{letra}\s+(?:{letra}\s+)?", "", t)
            if t:
                pedaco.append(t)
        alts[letra] = " ".join(pedaco).strip()
    return enunciado, alts


def tentar_numero(rotulo: str) -> float | None:
    s = rotulo.strip().rstrip(".").replace(" ", "")
    if re.fullmatch(r"-?\d+(,\d+)?", s):
        return float(s.replace(",", "."))
    return None


def main() -> None:
    parser = argparse.ArgumentParser(description="Montador deterministico de lotes DesafioUnificado")
    parser.add_argument("--bruto", required=True)
    parser.add_argument("--pedagogia", required=True)
    parser.add_argument("--saida", required=True)
    args = parser.parse_args()

    bruto_doc = json.loads(Path(args.bruto).read_text(encoding="utf-8"))
    ped_list = json.loads(Path(args.pedagogia).read_text(encoding="utf-8"))
    ano = int(bruto_doc["ano"])
    por_num = {int(q["questao"]): q for q in bruto_doc["questoes"]}

    saida_itens = []
    for p in ped_list:
        num = int(p["questao"])
        if num not in por_num:
            raise KeyError(f"Questao {num} nao encontrada em {args.bruto}")
        raw = por_num[num]
        correta = str(raw["gabaritoOficial"]).strip().upper()
        if correta not in LETRAS:
            raise ValueError(f"Gabarito invalido em ENEM {ano} Q{num}: {correta}")

        enunc_parseado, alts_parseadas = parsear_ocorrencias_enem(raw.get("ocorrencias", []), num)
        if p.get("enunciadoOverride"):
            enunciado = str(p["enunciadoOverride"]).strip()
        else:
            enunciado = enunc_parseado.strip()
            limpar_apos = p.get("enunciadoLimparApos")
            limpar_incluindo = p.get("enunciadoLimparIncluindo")
            if isinstance(limpar_incluindo, str) and limpar_incluindo and not limpar_apos:
                idx_inc = enunciado.find(limpar_incluindo)
                if idx_inc == -1:
                    raise ValueError(f"enunciadoLimparIncluindo nao encontrado em ENEM {ano} Q{num}: {limpar_incluindo!r}")
                enunciado = enunciado[:idx_inc].strip()
            elif limpar_apos:
                anchor = str(limpar_apos)
                idx_anchor = enunciado.find(anchor)
                if idx_anchor == -1:
                    raise ValueError(f"enunciadoLimparApos nao encontrado em ENEM {ano} Q{num}: {anchor!r}")
                corte = idx_anchor if limpar_incluindo else idx_anchor + len(anchor)
                enunciado = enunciado[:corte].strip()
            for par in p.get("enunciadoPatches") or []:
                if not isinstance(par, (list, tuple)) or len(par) != 2:
                    raise ValueError(f"Patch invalido em ENEM {ano} Q{num}: {par!r}")
                old_txt, new_txt = str(par[0]), str(par[1])
                if old_txt not in enunciado:
                    raise ValueError(f"Patch nao encontrado em ENEM {ano} Q{num}: {old_txt!r}")
                enunciado = enunciado.replace(old_txt, new_txt, 1).strip()
            prefixo = str(p.get("enunciadoPrefixo") or "").strip()
            sufixo = str(p.get("enunciadoSufixo") or "").strip()
            if prefixo:
                enunciado = f"{prefixo}\n\n{enunciado}".strip()
            if sufixo:
                enunciado = f"{enunciado}\n\n{sufixo}".strip()
        alts_override = p.get("alternativasOverride") or {}
        vals_override = p.get("valorNumericoPorLetra") or {}
        diags = p["diagnosticosPorLetra"]
        tags = p.get("tagsErroPorLetra") or {}

        alternativas = []
        for letra in LETRAS:
            rotulo = str(alts_override.get(letra) if letra in alts_override else alts_parseadas.get(letra, "")).strip()
            if not rotulo:
                raise ValueError(f"Alternativa {letra} vazia em ENEM {ano} Q{num}")
            alt_obj: dict[str, object] = {
                "id": f"enem_{ano}_q{num}_{letra}",
                "letra": letra,
                "rotulo": rotulo,
                "correta": letra == correta,
                "diagnosticoPt": str(diags[letra]).strip(),
            }
            val = vals_override[letra] if letra in vals_override else tentar_numero(rotulo)
            if val is not None:
                alt_obj["valorNumerico"] = val
            if letra != correta:
                alt_obj["tagErro"] = str(tags.get(letra) or "calculo_aritmetico")
            alternativas.append(alt_obj)

        tema_id = str(p["temaId"])
        if tema_id not in TITULOS_TEMA:
            raise ValueError(f"temaId invalido em ENEM {ano} Q{num}: {tema_id}")

        dicas_txt = p["dicas"]
        if len(dicas_txt) != 3:
            raise ValueError(f"Esperava 3 dicas em ENEM {ano} Q{num}")
        dicas = [
            {"nivel": 1, "titulo": "Foco & Leitura", "textoPt": str(dicas_txt[0]).strip()},
            {"nivel": 2, "titulo": "Resumo de Boteco", "textoPt": str(dicas_txt[1]).strip()},
            {"nivel": 3, "titulo": "Primeiro Passo & Armadilha", "textoPt": str(dicas_txt[2]).strip()},
        ]

        figuras = p["figurasOverride"] if "figurasOverride" in p else raw.get("figurasExistentes", [])
        qid = f"enem_{ano}_d2_c5_q{num}"
        item: dict[str, object] = {
            "id": qid,
            "assinatura": qid,
            "origem": "enem_oficial",
            "grau": int(p["grau"]),
            "temaId": tema_id,
            "temaTituloPt": TITULOS_TEMA[tema_id],
            "arquetipoOuItemId": qid,
            "nivelCuradoria": "completa",
            "disciplinaVerificada": "matematica",
            "referenciaOficial": {
                "exame": "ENEM",
                "ano": ano,
                "aplicacao": "regular",
                "dia": 2,
                "caderno": "5_amarelo",
                "questao": num,
                "licenca": "CC-BY-ND-3.0",
                "citacaoCurta": f"ENEM {ano} · 2º Dia · Caderno 5 Amarelo · Q.{num} (INEP)",
            },
            "enunciadoMarkdown": enunciado,
            "alternativas": alternativas,
            "altarFisicoCompativel": False,
            "dicas": dicas,
            "posAcerto": {
                "solucaoCompletaPt": str(p["solucaoCompletaPt"]).strip(),
                "metodos": [
                    {"selo": "Mapa no guardanapo", "resumo": str(p["atalhoPt"]).strip()},
                    {"selo": "Outro caminho", "resumo": str(p["outroCaminhoPt"]).strip()},
                ],
                "dicaVidaRealPt": str(p["dicaVidaRealPt"]).strip(),
            },
        }
        if figuras or "figurasOverride" in p:
            item["figuras"] = figuras
        saida_itens.append(item)

    destino = Path(args.saida)
    destino.parent.mkdir(parents=True, exist_ok=True)
    destino.write_text(json.dumps(saida_itens, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"04_montar_lote: gravadas {len(saida_itens)} questoes em {destino}")


if __name__ == "__main__":
    main()
