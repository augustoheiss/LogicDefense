"""
main.py -- Orquestrador CLI
Gerador de Ocorrencias Heiss-Lab

Coleta dados do usuario, formaliza o texto via IA,
e gera o PDF final com overlay sobre o template.
"""

import argparse
import json
import os
import sys
from datetime import datetime

import formalizer
import mapper


# --- Constantes -----------------------------------------------
BANNER = """
============================================
   GERADOR DE OCORRENCIAS HEISS-LAB
============================================
"""

CONFIG_PATH = "config.json"


def load_config() -> dict:
    """Carrega a configuracao global do config.json."""
    if not os.path.exists(CONFIG_PATH):
        print(f"[ERRO] Arquivo de configuracao nao encontrado: {CONFIG_PATH}")
        sys.exit(1)

    with open(CONFIG_PATH, "r", encoding="utf-8") as f:
        return json.load(f)


def collect_input_interactive() -> dict:
    """
    Coleta os dados da ocorrencia via input interativo no terminal.

    Returns:
        Dicionario com todos os campos preenchidos.
    """
    print(BANNER)

    data = {}

    # --- Dados basicos ---
    data["nome_aluno"] = input("[+] Nome do(a) aluno(a): ").strip()
    data["turma"] = input("[+] Turma: ").strip()

    data_default = datetime.now().strftime("%d/%m/%Y")
    data_input = input(f"[+] Data [{data_default}]: ").strip()
    data["data"] = data_input if data_input else data_default

    data["telefone"] = input("[+] Telefone de contato: ").strip()

    # --- Descricao da ocorrencia (multi-linha) ---
    print("\n[+] Descricao da ocorrencia (relato informal):")
    print("    (Digite o texto. Pressione ENTER duas vezes para finalizar)\n")
    descricao_lines = []
    empty_count = 0
    while True:
        line = input("    > ")
        if line.strip() == "":
            empty_count += 1
            if empty_count >= 2:
                break
            descricao_lines.append("")
        else:
            empty_count = 0
            descricao_lines.append(line)
    data["descricao_ocorrencia_informal"] = "\n".join(descricao_lines).strip()

    # --- Encaminhamentos (Checkboxes) ---
    print("\n[+] Encaminhamentos:")
    resp_orient = input("    Orientacao ao aluno? (s/n) [s]: ").strip().lower()
    data["checkbox_orientacao_aluno"] = resp_orient != "n"

    resp_convoc = input("    Convocar responsavel? (s/n) [n]: ").strip().lower()
    data["checkbox_convocar_responsavel"] = resp_convoc == "s"

    # --- Compromissos firmados (multi-linha) ---
    print("\n[+] Compromissos firmados:")
    print("    (Digite o texto. Pressione ENTER duas vezes para finalizar)\n")
    compromissos_lines = []
    empty_count = 0
    while True:
        line = input("    > ")
        if line.strip() == "":
            empty_count += 1
            if empty_count >= 2:
                break
            compromissos_lines.append("")
        else:
            empty_count = 0
            compromissos_lines.append(line)
    data["compromissos_firmados_informal"] = "\n".join(compromissos_lines).strip()

    return data


def process_with_ai(data: dict, config: dict, skip_ai: bool = False) -> dict:
    """
    Processa os campos de texto livre atraves da IA para formalizacao.

    Args:
        data: Dados coletados do usuario.
        config: Configuracao global.
        skip_ai: Se True, pula a formalizacao (modo teste).

    Returns:
        Dicionario com campos prontos para carimbar no PDF.
    """
    fields = {}

    # Campos diretos (sem formalizacao)
    fields["nome_aluno"] = data.get("nome_aluno", "")
    fields["turma"] = data.get("turma", "")
    fields["data"] = data.get("data", "")
    fields["telefone"] = data.get("telefone", "")

    # Checkboxes
    fields["checkbox_orientacao_aluno"] = data.get("checkbox_orientacao_aluno", False)
    fields["checkbox_convocar_responsavel"] = data.get("checkbox_convocar_responsavel", False)

    # Responsavel pelo registro (valor estatico do config)
    fields["responsavel_registro"] = config.get("responsavel_registro", "")

    # --- Formalizacao via IA ---
    descricao_informal = data.get("descricao_ocorrencia_informal", "")
    compromissos_informal = data.get("compromissos_firmados_informal", "")

    if skip_ai:
        print("[>>] Modo teste: pulando formalizacao por IA.")
        fields["descricao_ocorrencia"] = descricao_informal
        fields["compromissos_firmados"] = compromissos_informal
    else:
        if descricao_informal:
            print("\n[...] Formalizando descricao da ocorrencia com IA...")
            fields["descricao_ocorrencia"] = formalizer.formalize_text(
                descricao_informal, config, context="descricao da ocorrencia"
            )
            print("[OK] Descricao formalizada!")

            # Mostra preview
            print(f"\n    Original:    {descricao_informal[:100]}...")
            print(f"    Formalizado: {fields['descricao_ocorrencia'][:100]}...")
        else:
            fields["descricao_ocorrencia"] = ""

        if compromissos_informal:
            print("\n[...] Formalizando compromissos firmados com IA...")
            fields["compromissos_firmados"] = formalizer.formalize_commitments(
                compromissos_informal, config
            )
            print("[OK] Compromissos formalizados!")
        else:
            fields["compromissos_firmados"] = ""

    return fields


def generate_output(fields: dict, config: dict) -> str:
    """
    Gera o PDF final com overlay sobre o template.

    Args:
        fields: Campos preenchidos e formalizados.
        config: Configuracao global.

    Returns:
        Caminho do arquivo gerado.
    """
    template_path = config.get("template_path", "template.pdf")
    template_map_path = config.get("template_map_path", "template_map.json")
    output_dir = config.get("output_dir", "output")

    # Gera nome com timestamp para evitar sobrescrita
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    nome_aluno_slug = fields.get("nome_aluno", "aluno").replace(" ", "_")[:20]
    final_filename = f"ocorrencia_{nome_aluno_slug}_{timestamp}.pdf"

    output_path = os.path.join(output_dir, final_filename)

    # Carrega o mapa de coordenadas
    template_map = mapper.load_template_map(template_map_path)

    print(f"\n[...] Gerando PDF...")
    print(f"      Template: {template_path}")
    print(f"      Mapa: {template_map_path}")

    result_path = mapper.generate_pdf(
        template_path=template_path,
        fields=fields,
        template_map=template_map,
        config=config,
        output_path=output_path,
    )

    return result_path


def run_test_mode(config: dict):
    """Executa o pipeline com dados de teste fixos (sem IA)."""
    print(BANNER)
    print("[TESTE] Dados ficticios, sem IA\n")

    test_data = {
        "nome_aluno": "Maria Oliveira Santos",
        "turma": "8o B",
        "data": "25/04/2026",
        "telefone": "(11) 98765-4321",
        "descricao_ocorrencia_informal": (
            "A Maria ficou usando o celular durante a aula inteira e quando "
            "a professora pediu pra guardar ela respondeu de forma grosseira "
            "e saiu da sala batendo a porta."
        ),
        "checkbox_orientacao_aluno": True,
        "checkbox_convocar_responsavel": True,
        "compromissos_firmados_informal": (
            "A aluna se comprometeu a nao usar mais o celular durante as aulas "
            "e pedir desculpas para a professora. A mae vai acompanhar mais de perto."
        ),
    }

    fields = process_with_ai(test_data, config, skip_ai=True)

    try:
        result = generate_output(fields, config)
        print(f"\n[OK] PDF gerado com sucesso: {result}")
    except FileNotFoundError as e:
        print(f"\n{e}")
        print("[DICA] Coloque um arquivo 'template.pdf' no diretorio do projeto.")


def main():
    """Entry point principal."""
    parser = argparse.ArgumentParser(
        description="Gerador de Ocorrencias Heiss-Lab",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Exemplos de uso:
  python main.py              # Modo interativo com IA
  python main.py --test       # Modo teste (dados ficticios, sem IA)
  python main.py --no-ai      # Modo interativo sem formalizacao IA
        """
    )
    parser.add_argument(
        "--test", action="store_true",
        help="Executa com dados de teste ficticios (sem IA)"
    )
    parser.add_argument(
        "--no-ai", action="store_true",
        help="Desabilita a formalizacao por IA (usa texto original)"
    )

    args = parser.parse_args()
    config = load_config()

    if args.test:
        run_test_mode(config)
        return

    # --- Modo interativo ---
    try:
        data = collect_input_interactive()
        fields = process_with_ai(data, config, skip_ai=args.no_ai)
        result = generate_output(fields, config)
        print(f"\n{'='*45}")
        print(f"  [OK] OCORRENCIA GERADA COM SUCESSO!")
        print(f"  Arquivo: {result}")
        print(f"{'='*45}")

    except FileNotFoundError as e:
        print(f"\n{e}")
        sys.exit(1)
    except EnvironmentError as e:
        print(f"\n{e}")
        sys.exit(1)
    except KeyboardInterrupt:
        print("\n\n[!] Operacao cancelada pelo usuario.")
        sys.exit(0)


if __name__ == "__main__":
    main()
