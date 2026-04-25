"""
auto_mapper.py -- Utilitario de Mapeamento de Coordenadas
Gerador de Ocorrencias Heiss-Lab

Mapeia automaticamente as coordenadas dos campos de um template PDF
e exporta para template_map.json.

Modos:
  --mode auto        : Busca automatica por anchor strings (bounding boxes)
  --mode interactive : GUI Tkinter para clicar e marcar coordenadas
  --mode hybrid      : Auto-discovery + GUI para campos restantes
"""

import argparse
import json
import os
import sys

import fitz  # PyMuPDF

# Tkinter e Pillow sao importados condicionalmente no modo interativo
try:
    import tkinter as tk
    from tkinter import messagebox, simpledialog
    from PIL import Image, ImageTk
    HAS_GUI = True
except ImportError:
    HAS_GUI = False


# --- Constantes -----------------------------------------------
DEFAULT_OUTPUT = "template_map.json"
OFFSET_RIGHT = 8  # Pontos a direita do anchor para insercao
RENDER_DPI = 150   # DPI para renderizacao da pagina na GUI

# Campos padrao esperados no formulario
DEFAULT_FIELDS = [
    "nome_aluno",
    "turma",
    "data",
    "telefone",
    "descricao_ocorrencia",
    "checkbox_orientacao_aluno",
    "checkbox_convocar_responsavel",
    "compromissos_firmados",
    "responsavel_registro",
]

# Mapeamento campo -> tipo
FIELD_TYPES = {
    "nome_aluno": "text",
    "turma": "text",
    "data": "text",
    "telefone": "text",
    "descricao_ocorrencia": "textarea",
    "checkbox_orientacao_aluno": "checkbox",
    "checkbox_convocar_responsavel": "checkbox",
    "compromissos_firmados": "textarea",
    "responsavel_registro": "text",
}

# Labels legiveis para cada campo (exibidos na GUI)
FIELD_LABELS = {
    "nome_aluno": "Nome do(a) aluno(a)",
    "turma": "Turma",
    "data": "Data",
    "telefone": "Telefone de contato",
    "descricao_ocorrencia": "Descricao da Ocorrencia",
    "checkbox_orientacao_aluno": "Checkbox: Orientacao ao aluno",
    "checkbox_convocar_responsavel": "Checkbox: Convocar responsavel",
    "compromissos_firmados": "Compromissos Firmados",
    "responsavel_registro": "Responsavel pelo Registro",
}


# ==============================================================
#  MODO 1: AUTO-DISCOVERY (Bounding Boxes)
# ==============================================================

def auto_discover(pdf_path: str, anchors: dict[str, str]) -> dict:
    """
    Busca anchor strings no PDF e extrai coordenadas de insercao.

    Args:
        pdf_path: Caminho para o PDF template.
        anchors: Dicionario {campo: 'texto_ancora'} para buscar.

    Returns:
        Dicionario com coordenadas mapeadas para cada campo encontrado.
    """
    doc = fitz.open(pdf_path)
    page = doc[0]  # Trabalha com a primeira pagina
    page_rect = page.rect

    results = {}
    found_count = 0

    print(f"\n[SCAN] Auto-Discovery no PDF: {pdf_path}")
    print(f"       Pagina: {page_rect.width:.1f} x {page_rect.height:.1f} pts")
    print(f"       Buscando {len(anchors)} anchors...\n")

    for field_name, anchor_text in anchors.items():
        instances = page.search_for(anchor_text)

        if instances:
            # Usa a primeira ocorrencia
            rect = instances[0]
            # Ponto de insercao: a direita do texto encontrado
            insert_x = rect.x1 + OFFSET_RIGHT
            insert_y = rect.y0  # Alinhado ao topo do texto

            results[field_name] = {
                "x": round(insert_x, 1),
                "y": round(insert_y, 1),
                "max_width": round(page_rect.width - insert_x - 40, 1),
                "font_size": 10,
                "type": FIELD_TYPES.get(field_name, "text"),
                "label": FIELD_LABELS.get(field_name, field_name),
                "_anchor_found": anchor_text,
                "_anchor_rect": [round(rect.x0, 1), round(rect.y0, 1),
                                 round(rect.x1, 1), round(rect.y1, 1)],
            }
            found_count += 1
            print(f"   [OK] '{anchor_text}' -> ({insert_x:.1f}, {insert_y:.1f})")

            # Anota visualmente no PDF (para debug)
            highlight = page.add_rect_annot(rect)
            highlight.set_colors(stroke=(0, 0.7, 0))
            highlight.update()
        else:
            print(f"   [!!] '{anchor_text}' nao encontrado no PDF")

    # Salva versao anotada para visualizacao
    debug_path = pdf_path.replace(".pdf", "_debug_anchors.pdf")
    doc.save(debug_path)
    doc.close()
    print(f"\n   Preview anotado salvo: {debug_path}")
    print(f"   {found_count}/{len(anchors)} anchors encontrados")

    return results


# ==============================================================
#  MODO 2: INTERACTIVE CLICK (GUI Tkinter)
# ==============================================================

class InteractiveMapper:
    """GUI Tkinter para mapeamento interativo de coordenadas."""

    def __init__(self, pdf_path: str, fields_to_map: list[str],
                 existing_results: dict = None):
        """
        Args:
            pdf_path: Caminho para o PDF template.
            fields_to_map: Lista de nomes de campos para mapear.
            existing_results: Resultados ja mapeados (do auto-discovery).
        """
        self.pdf_path = pdf_path
        self.fields_to_map = list(fields_to_map)
        self.current_field_idx = 0
        self.results = existing_results or {}
        self.markers = []  # Referencias aos marcadores visuais

        # Renderiza a pagina do PDF como imagem
        doc = fitz.open(pdf_path)
        self.page = doc[0]
        self.page_rect = self.page.rect
        self.page_width = self.page_rect.width
        self.page_height = self.page_rect.height

        # Renderiza como pixmap
        mat = fitz.Matrix(RENDER_DPI / 72, RENDER_DPI / 72)
        pix = self.page.get_pixmap(matrix=mat)
        img_data = pix.tobytes("png")
        doc.close()

        # Converte para PIL Image
        import io
        self.pil_image = Image.open(io.BytesIO(img_data))
        self.img_width = self.pil_image.width
        self.img_height = self.pil_image.height

        # Fatores de escala: pixel -> ponto PDF
        self.scale_x = self.page_width / self.img_width
        self.scale_y = self.page_height / self.img_height

    def run(self) -> dict:
        """Abre a GUI e retorna os resultados apos o mapeamento."""
        if not self.fields_to_map:
            print("   Nenhum campo para mapear interativamente.")
            return self.results

        self.root = tk.Tk()
        self.root.title("Heiss-Lab - Mapeador Interativo de Coordenadas")
        self.root.configure(bg="#1a1a2e")

        # --- Frame principal ---
        main_frame = tk.Frame(self.root, bg="#1a1a2e")
        main_frame.pack(fill=tk.BOTH, expand=True)

        # --- Painel lateral de instrucoes ---
        side_panel = tk.Frame(main_frame, bg="#16213e", width=320)
        side_panel.pack(side=tk.RIGHT, fill=tk.Y)
        side_panel.pack_propagate(False)

        tk.Label(
            side_panel, text="MAPEADOR INTERATIVO",
            font=("Segoe UI", 14, "bold"), fg="#e94560", bg="#16213e"
        ).pack(pady=(20, 5))

        tk.Label(
            side_panel,
            text="Clique na imagem para marcar\no ponto de insercao de cada campo.",
            font=("Segoe UI", 10), fg="#a0a0b0", bg="#16213e",
            justify=tk.CENTER
        ).pack(pady=(0, 20))

        # Label do campo atual
        self.field_label = tk.Label(
            side_panel, text="", font=("Segoe UI", 12, "bold"),
            fg="#0f3460", bg="#e94560", padx=10, pady=8, wraplength=280
        )
        self.field_label.pack(pady=10, padx=15, fill=tk.X)

        # Info de coordenadas
        self.coord_label = tk.Label(
            side_panel, text="Aguardando clique...",
            font=("Consolas", 10), fg="#53d8fb", bg="#16213e"
        )
        self.coord_label.pack(pady=10)

        # Progresso
        self.progress_label = tk.Label(
            side_panel, text="",
            font=("Segoe UI", 10), fg="#a0a0b0", bg="#16213e"
        )
        self.progress_label.pack(pady=5)

        # --- Botoes ---
        btn_frame = tk.Frame(side_panel, bg="#16213e")
        btn_frame.pack(pady=20, padx=15, fill=tk.X)

        self.btn_undo = tk.Button(
            btn_frame, text="<< Refazer Ultimo", command=self._undo_last,
            font=("Segoe UI", 10), bg="#e94560", fg="white",
            activebackground="#c73e54", relief=tk.FLAT, padx=10, pady=6
        )
        self.btn_undo.pack(fill=tk.X, pady=3)

        self.btn_skip = tk.Button(
            btn_frame, text=">> Pular Campo", command=self._skip_field,
            font=("Segoe UI", 10), bg="#0f3460", fg="white",
            activebackground="#0a2647", relief=tk.FLAT, padx=10, pady=6
        )
        self.btn_skip.pack(fill=tk.X, pady=3)

        self.btn_save = tk.Button(
            btn_frame, text="SALVAR E SAIR", command=self._save_and_exit,
            font=("Segoe UI", 10, "bold"), bg="#53d8fb", fg="#1a1a2e",
            activebackground="#3ec4e6", relief=tk.FLAT, padx=10, pady=8
        )
        self.btn_save.pack(fill=tk.X, pady=(15, 3))

        # --- Lista de campos mapeados ---
        tk.Label(
            side_panel, text="Campos Mapeados:",
            font=("Segoe UI", 10, "bold"), fg="#a0a0b0", bg="#16213e",
            anchor=tk.W
        ).pack(padx=15, pady=(20, 5), fill=tk.X)

        self.mapped_list = tk.Text(
            side_panel, font=("Consolas", 9), bg="#0f3460", fg="#53d8fb",
            height=10, state=tk.DISABLED, relief=tk.FLAT, padx=8, pady=5
        )
        self.mapped_list.pack(padx=15, fill=tk.BOTH, expand=True, pady=(0, 15))

        # --- Canvas com a imagem do PDF ---
        canvas_frame = tk.Frame(main_frame, bg="#1a1a2e")
        canvas_frame.pack(side=tk.LEFT, fill=tk.BOTH, expand=True)

        # Scrollbars
        h_scroll = tk.Scrollbar(canvas_frame, orient=tk.HORIZONTAL)
        h_scroll.pack(side=tk.BOTTOM, fill=tk.X)
        v_scroll = tk.Scrollbar(canvas_frame, orient=tk.VERTICAL)
        v_scroll.pack(side=tk.RIGHT, fill=tk.Y)

        self.canvas = tk.Canvas(
            canvas_frame, bg="#0d0d1a",
            xscrollcommand=h_scroll.set, yscrollcommand=v_scroll.set
        )
        self.canvas.pack(fill=tk.BOTH, expand=True)

        h_scroll.config(command=self.canvas.xview)
        v_scroll.config(command=self.canvas.yview)

        # Carrega imagem no canvas
        self.tk_image = ImageTk.PhotoImage(self.pil_image)
        self.canvas.create_image(0, 0, anchor=tk.NW, image=self.tk_image)
        self.canvas.config(scrollregion=(0, 0, self.img_width, self.img_height))

        # Bind de clique
        self.canvas.bind("<Button-1>", self._on_click)

        # Mostra campos ja mapeados (do auto-discovery) em verde
        self._draw_existing_markers()

        # Inicia no primeiro campo
        self._update_current_field()

        # Centraliza janela
        self.root.geometry(f"{min(self.img_width + 320, 1400)}x{min(self.img_height, 900)}")
        self.root.mainloop()

        return self.results

    def _update_current_field(self):
        """Atualiza a UI para o campo atual."""
        if self.current_field_idx >= len(self.fields_to_map):
            self.field_label.config(
                text="[OK] Todos os campos mapeados!",
                bg="#53d8fb", fg="#1a1a2e"
            )
            self.coord_label.config(text="Clique 'Salvar e Sair'")
            return

        field = self.fields_to_map[self.current_field_idx]
        label = FIELD_LABELS.get(field, field)
        field_type = FIELD_TYPES.get(field, "text")

        self.field_label.config(text=f"Clique: {label}")
        self.progress_label.config(
            text=f"Campo {self.current_field_idx + 1} de {len(self.fields_to_map)} "
                 f"({field_type})"
        )

    def _on_click(self, event):
        """Registra coordenada ao clicar na imagem."""
        if self.current_field_idx >= len(self.fields_to_map):
            return

        # Coordenadas no canvas (com scroll)
        canvas_x = self.canvas.canvasx(event.x)
        canvas_y = self.canvas.canvasy(event.y)

        # Converte para pontos PDF
        pdf_x = canvas_x * self.scale_x
        pdf_y = canvas_y * self.scale_y

        field_name = self.fields_to_map[self.current_field_idx]
        field_type = FIELD_TYPES.get(field_name, "text")

        # Registra coordenada
        field_result = {
            "x": round(pdf_x, 1),
            "y": round(pdf_y, 1),
            "font_size": 12 if field_type == "checkbox" else 10 if field_type == "text" else 9,
            "type": field_type,
            "label": FIELD_LABELS.get(field_name, field_name),
        }

        # Adiciona max_width e max_lines para textareas
        if field_type == "textarea":
            field_result["max_width"] = round(self.page_width - pdf_x - 40, 1)
            field_result["max_lines"] = 14 if "descricao" in field_name else 6

        elif field_type == "text":
            field_result["max_width"] = round(min(300, self.page_width - pdf_x - 40), 1)

        self.results[field_name] = field_result

        # Desenha marcador vermelho
        marker_size = 6
        marker = self.canvas.create_oval(
            canvas_x - marker_size, canvas_y - marker_size,
            canvas_x + marker_size, canvas_y + marker_size,
            fill="#e94560", outline="white", width=2
        )
        label_text = self.canvas.create_text(
            canvas_x + 12, canvas_y,
            text=FIELD_LABELS.get(field_name, field_name)[:25],
            fill="#e94560", anchor=tk.W,
            font=("Segoe UI", 8, "bold")
        )
        self.markers.append((marker, label_text, field_name))

        # Atualiza info
        self.coord_label.config(
            text=f"PDF: ({pdf_x:.1f}, {pdf_y:.1f}) pts\n"
                 f"Pixel: ({canvas_x:.0f}, {canvas_y:.0f})"
        )

        # Atualiza lista de mapeados
        self._update_mapped_list()

        # Avanca para o proximo campo
        self.current_field_idx += 1
        self._update_current_field()

    def _draw_existing_markers(self):
        """Desenha marcadores azuis para campos ja mapeados."""
        for field_name, field_data in self.results.items():
            pdf_x = field_data.get("x", 0)
            pdf_y = field_data.get("y", 0)
            canvas_x = pdf_x / self.scale_x
            canvas_y = pdf_y / self.scale_y

            marker_size = 6
            self.canvas.create_oval(
                canvas_x - marker_size, canvas_y - marker_size,
                canvas_x + marker_size, canvas_y + marker_size,
                fill="#53d8fb", outline="white", width=2
            )
            self.canvas.create_text(
                canvas_x + 12, canvas_y,
                text=f"[OK] {FIELD_LABELS.get(field_name, field_name)[:20]}",
                fill="#53d8fb", anchor=tk.W,
                font=("Segoe UI", 8)
            )

        self._update_mapped_list()

    def _update_mapped_list(self):
        """Atualiza a lista lateral de campos mapeados."""
        self.mapped_list.config(state=tk.NORMAL)
        self.mapped_list.delete("1.0", tk.END)
        for name, data in self.results.items():
            label = FIELD_LABELS.get(name, name)[:22]
            x = data.get("x", 0)
            y = data.get("y", 0)
            self.mapped_list.insert(tk.END, f"[OK] {label:<22} ({x:.0f}, {y:.0f})\n")
        self.mapped_list.config(state=tk.DISABLED)

    def _undo_last(self):
        """Refaz o ultimo campo mapeado."""
        if self.current_field_idx <= 0:
            return

        self.current_field_idx -= 1
        field_name = self.fields_to_map[self.current_field_idx]

        # Remove do resultado
        if field_name in self.results:
            del self.results[field_name]

        # Remove marcador visual
        if self.markers:
            marker, label, _ = self.markers.pop()
            self.canvas.delete(marker)
            self.canvas.delete(label)

        self._update_mapped_list()
        self._update_current_field()
        self.coord_label.config(text="Ultimo campo desfeito. Clique novamente.")

    def _skip_field(self):
        """Pula o campo atual sem mapear."""
        if self.current_field_idx >= len(self.fields_to_map):
            return

        field_name = self.fields_to_map[self.current_field_idx]
        print(f"   [>>] Campo pulado: {FIELD_LABELS.get(field_name, field_name)}")
        self.current_field_idx += 1
        self._update_current_field()

    def _save_and_exit(self):
        """Salva e fecha a GUI."""
        self.root.quit()
        self.root.destroy()


# ==============================================================
#  EXPORT
# ==============================================================

def export_template_map(
    results: dict,
    page_width: float,
    page_height: float,
    output_path: str
):
    """
    Exporta as coordenadas mapeadas para um arquivo JSON.

    Args:
        results: Dicionario campo->coordenadas.
        page_width: Largura da pagina em pontos.
        page_height: Altura da pagina em pontos.
        output_path: Caminho de saida do JSON.
    """
    # Remove campos internos de debug
    clean_results = {}
    for name, data in results.items():
        clean = {k: v for k, v in data.items() if not k.startswith("_")}
        clean_results[name] = clean

    template_map = {
        "page_width": round(page_width, 2),
        "page_height": round(page_height, 2),
        "coordinate_system": "pymupdf_top_left",
        "fields": clean_results,
    }

    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(template_map, f, ensure_ascii=False, indent=2)

    print(f"\n[SAVE] Mapa exportado para: {output_path}")
    print(f"       {len(clean_results)} campos mapeados")


# ==============================================================
#  CLI
# ==============================================================

def parse_anchors(anchor_string: str) -> dict[str, str]:
    """
    Parseia a string de anchors do CLI.

    Formato: "campo1=Texto Ancora 1,campo2=Texto Ancora 2"
    Ou simplificado: "Nome do(a) aluno(a):,Data:,Turma:"
    (nesse caso, tenta mapear automaticamente)

    Returns:
        Dicionario {campo: texto_ancora}.
    """
    anchors = {}
    parts = [p.strip() for p in anchor_string.split(",") if p.strip()]

    # Mapeamento de anchor -> nome do campo (heuristica)
    anchor_to_field = {
        "nome": "nome_aluno",
        "aluno": "nome_aluno",
        "turma": "turma",
        "data": "data",
        "telefone": "telefone",
        "contato": "telefone",
        "descricao": "descricao_ocorrencia",
        "ocorrencia": "descricao_ocorrencia",
        "orientacao": "checkbox_orientacao_aluno",
        "convocar": "checkbox_convocar_responsavel",
        "responsavel": "checkbox_convocar_responsavel",
        "compromisso": "compromissos_firmados",
        "registro": "responsavel_registro",
    }

    for part in parts:
        if "=" in part:
            field_name, anchor_text = part.split("=", 1)
            anchors[field_name.strip()] = anchor_text.strip()
        else:
            # Tenta inferir o campo pelo texto do anchor
            anchor_lower = part.lower()
            matched = False
            for keyword, field_name in anchor_to_field.items():
                if keyword in anchor_lower:
                    anchors[field_name] = part
                    matched = True
                    break
            if not matched:
                print(f"   [!] Nao foi possivel inferir campo para anchor: '{part}'")
                anchors[f"unknown_{len(anchors)}"] = part

    return anchors


def main():
    """Entry point do utilitario de mapeamento."""
    parser = argparse.ArgumentParser(
        description="Heiss-Lab - Mapeador de Coordenadas de Template PDF",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Exemplos de uso:

  Modo automatico (busca por textos-ancora):
    python auto_mapper.py --mode auto --pdf template.pdf
      --anchors "nome_aluno=Nome do(a) aluno(a):,data=Data:,turma=Turma:"

  Modo interativo (GUI para clicar):
    python auto_mapper.py --mode interactive --pdf template.pdf

  Modo hibrido (auto + GUI para campos restantes):
    python auto_mapper.py --mode hybrid --pdf template.pdf
      --anchors "Nome do(a) aluno(a):,Data:,Turma:"

  Modo simplificado (infere campos pelo texto):
    python auto_mapper.py --mode auto --pdf template.pdf
      --anchors "Nome,Data,Turma,Telefone"
        """
    )

    parser.add_argument(
        "--mode", choices=["auto", "interactive", "hybrid"],
        default="hybrid",
        help="Modo de mapeamento (default: hybrid)"
    )
    parser.add_argument(
        "--pdf", required=True,
        help="Caminho para o PDF template"
    )
    parser.add_argument(
        "--anchors", default="",
        help="Textos-ancora para busca automatica (separados por virgula)"
    )
    parser.add_argument(
        "--output", default=DEFAULT_OUTPUT,
        help=f"Caminho de saida do JSON (default: {DEFAULT_OUTPUT})"
    )
    parser.add_argument(
        "--fields", default="",
        help="Lista de campos para mapear interativamente (separados por virgula). "
             "Default: todos os campos padrao."
    )

    args = parser.parse_args()

    if not os.path.exists(args.pdf):
        print(f"[ERRO] PDF nao encontrado: {args.pdf}")
        sys.exit(1)

    # Obtem dimensoes da pagina
    doc = fitz.open(args.pdf)
    page = doc[0]
    page_width = page.rect.width
    page_height = page.rect.height
    doc.close()

    print(f"\n{'='*50}")
    print(f"  HEISS-LAB - MAPEADOR DE COORDENADAS")
    print(f"{'='*50}")
    print(f"  PDF: {args.pdf}")
    print(f"  Pagina: {page_width:.1f} x {page_height:.1f} pts")
    print(f"  Modo: {args.mode}")
    print(f"{'='*50}")

    results = {}

    # --- Modo AUTO ---
    if args.mode in ("auto", "hybrid"):
        if not args.anchors:
            print("\n[!] Modo auto/hybrid requer --anchors. Use --mode interactive para GUI.")
            if args.mode == "auto":
                sys.exit(1)
        else:
            anchors = parse_anchors(args.anchors)
            results = auto_discover(args.pdf, anchors)

    # --- Modo INTERACTIVE / HYBRID ---
    if args.mode in ("interactive", "hybrid"):
        if not HAS_GUI:
            print("\n[ERRO] Tkinter e/ou Pillow nao disponiveis para modo interativo.")
            print("       Instale com: pip install Pillow")
            sys.exit(1)

        # Determina campos restantes para mapear
        if args.fields:
            fields_to_map = [f.strip() for f in args.fields.split(",")]
        else:
            # Todos os campos padrao que ainda nao foram mapeados
            fields_to_map = [f for f in DEFAULT_FIELDS if f not in results]

        if fields_to_map:
            print(f"\n[GUI] Abrindo GUI para mapear {len(fields_to_map)} campos...")
            mapper_gui = InteractiveMapper(
                args.pdf, fields_to_map, existing_results=results
            )
            results = mapper_gui.run()
        else:
            print("\n[OK] Todos os campos ja foram mapeados automaticamente!")

    # --- Exporta resultado ---
    if results:
        export_template_map(results, page_width, page_height, args.output)
        print(f"\n[OK] Mapeamento concluido! Use o arquivo '{args.output}' no main.py.")
    else:
        print("\n[!] Nenhum campo foi mapeado.")


if __name__ == "__main__":
    main()
