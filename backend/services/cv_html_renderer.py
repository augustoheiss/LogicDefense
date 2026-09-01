"""
CV HTML Renderer Service — LogicDefense & CV Maker 2.0
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Converte múltiplos arquétipos YAML / JSON Resume em um Super Dashboard HTML
100% autônomo e standalone, com troca dinâmica de:
  • 5 Personas IA
  • 9 Modelos A4 de Layout (Slot-and-Blueprint)
  • 5 Temas Visuais
  • 3 Modos de Visualização (Currículo A4, Cover Letter, Dossiê 2 Páginas)
em tempo real (zero servidor / 100% offline), com suporte a upload de foto,
download de YAML individual, cópia e exportação de Pacote ZIP.
"""

import html
import json
import re
import yaml
from typing import Dict, Any, Optional

PERSONA_METADATA = {
    "professional": {
        "label": "💼 1. Executivo IBM (Senior Lead)",
        "desc": "Foco em liderança, governança, métricas de ROI e arquiteturas de alta criticidade.",
        "filename": "curriculo_executivo.yaml"
    },
    "architect": {
        "label": "🧠 2. Arquiteto de IA & Soluções",
        "desc": "Foco em microsserviços FastAPI, RAG, pipelines assíncronos e nuvem híbrida.",
        "filename": "curriculo_arquiteto_ia.yaml"
    },
    "historian": {
        "label": "📜 3. Biógrafo / Evolução Estratégica",
        "desc": "Narrativa coesa da jornada, contexto de negócios e legado sustentável.",
        "filename": "curriculo_biografo.yaml"
    },
    "didactic": {
        "label": "🎓 4. Didático / Learning Velocity",
        "desc": "Foco em raciocínio analítico, comunicação técnica e velocidade de aprendizado.",
        "filename": "curriculo_didatico.yaml"
    },
    "alien": {
        "label": "🤖 5. Relatório Alien (Sci-Fi & Humor)",
        "desc": "Relatório biológico e técnico intergaláctico sobre o espécime e seu código.",
        "filename": "curriculo_alien.yaml"
    },
}

TEXTURE_PRESETS = {
    "none": "none",
    "bg-grid-tech": "https://www.heisslab.com.br/cv-backgrounds/bg-grid-tech.jpg",
    "bg-luxury-minimal": "https://www.heisslab.com.br/cv-backgrounds/bg-luxury-minimal.jpg",
    "bg-geometric-line": "https://www.heisslab.com.br/cv-backgrounds/bg-geometric-line.jpg",
    "bg-corporate-waves": "https://www.heisslab.com.br/cv-backgrounds/bg-corporate-waves.jpg",
    "bg-stationery-clean": "https://www.heisslab.com.br/cv-backgrounds/bg-stationery-clean.jpg",
    "bg-technical-blueprint": "https://www.heisslab.com.br/cv-backgrounds/bg-technical-blueprint.jpg",
    "/cv-backgrounds/bg-grid-tech.jpg": "https://www.heisslab.com.br/cv-backgrounds/bg-grid-tech.jpg",
    "/cv-backgrounds/bg-luxury-minimal.jpg": "https://www.heisslab.com.br/cv-backgrounds/bg-luxury-minimal.jpg",
    "/cv-backgrounds/bg-geometric-line.jpg": "https://www.heisslab.com.br/cv-backgrounds/bg-geometric-line.jpg",
    "/cv-backgrounds/bg-corporate-waves.jpg": "https://www.heisslab.com.br/cv-backgrounds/bg-corporate-waves.jpg",
    "/cv-backgrounds/bg-stationery-clean.jpg": "https://www.heisslab.com.br/cv-backgrounds/bg-stationery-clean.jpg",
    "/cv-backgrounds/bg-technical-blueprint.jpg": "https://www.heisslab.com.br/cv-backgrounds/bg-technical-blueprint.jpg",
}

LAYOUT_METADATA = {
    "modular": {
        "label": "📐 Modelo A4 01 (Modular)",
        "icon": "📐",
        "desc": "Header dinâmico com avatar, badges em pílula e blocos modulares em caixas suaves."
    },
    "linear": {
        "label": "📄 Modelo A4 02 (Linear)",
        "icon": "📄",
        "desc": "Linha contínua compacta estilo clássico/ATS com divisores finos e alta densidade."
    },
    "sidebar": {
        "label": "📑 Modelo A4 03 (Sidebar)",
        "icon": "📑",
        "desc": "2 Colunas com barra lateral dedicada para perfil, contatos, competências e idiomas."
    },
    "compact_split": {
        "label": "🏛️ Modelo A4 04 (Executive Duo)",
        "icon": "🏛️",
        "desc": "Coluna esquerda com bio, expertise e hobbies circulares; coluna direita com timeline e referências."
    },
    "editorial_accent": {
        "label": "🏷️ Modelo A4 05 (Brand Block)",
        "icon": "🏷️",
        "desc": "Bloco de topo marcante ('hello, i am'), foto vertical, badges de ano sólidos e marcadores em seta."
    },
    "corporate_timeline": {
        "label": "⏱️ Modelo A4 06 (Navy Timeline)",
        "icon": "⏱️",
        "desc": "Sidebar sólida em Dark Navy, timeline com nós conectados, dados civis/CNH e barras de nível."
    },
    "warm_magazine": {
        "label": "📰 Modelo A4 07 (Warm Editorial)",
        "icon": "📰",
        "desc": "Fundo bege editorial elegante, tipografia imponente, selo circular sobre o avatar e medidores visuais."
    },
    "hero_matrix": {
        "label": "🖼️ Modelo A4 08 (Hero Matrix)",
        "icon": "🖼️",
        "desc": "Barra superior de contatos, hero header com foto à direita, grid duplo e matriz inferior de habilidades."
    },
    "dynamic_math": {
        "label": "🧮 Modelo A4 09 (Grid Math)",
        "icon": "🧮",
        "desc": "Grid matemático balanceado (3x2, 2x2, 3x3) com caixas em acento, divisor colorido e densidade editorial."
    },
    "canvas_livre": {
        "label": "🎨 Modo Livre (Block Canvas)",
        "icon": "🎨",
        "desc": "Construtor de blocos atômicos livre com 12 colunas, arrastar/reordenar, formas de foto e tipografia independente."
    }
}

I18N = {
    "pt": {
        "print_btn": "🖨️ Imprimir / Salvar PDF",
        "download_yaml": "📥 Baixar YAML",
        "download_zip": "📦 Baixar 5 Versões (ZIP)",
        "copy_yaml": "📋 Copiar YAML",
        "yaml_copied": "Copiado!",
        "photo_btn": "📷 Foto / Avatar",
        "photo_modal_title": "📷 Foto / Avatar Profissional",
        "photo_modal_desc": "Carregue sua foto de perfil ou insira o link direto de uma imagem (ex: LinkedIn, GitHub ou CDN).",
        "photo_choose_file": "📁 Escolher do Computador",
        "photo_remove": "🗑️ Remover Foto",
        "photo_url_label": "Ou cole o link direto da imagem:",
        "photo_shape_circle": "⚪ Círculo (Modelos 01, 03, 04, 05, 06, 09)",
        "photo_shape_rect": "🔲 Retângulo (Modelos 02, 08)",
        "photo_zoom": "🔍 Zoom / Escala",
        "photo_pos_x": "↔ Posição Horizontal (X)",
        "photo_pos_y": "↕ Posição Vertical (Y)",
        "photo_drag_hint": "💡 Dica: Clique e arraste dentro do quadro para mover a foto livremente.",
        "photo_reset_framing": "Resetar",
        "photo_no_photo": "Deixar sem Foto",
        "photo_save": "Salvar e Aplicar",
        "work": "💼 Experiência Profissional",
        "projects": "🚀 Projetos em Destaque",
        "skills": "⚡ Competências & Habilidades Técnicas",
        "education": "🎓 Formação Acadêmica",
        "certificates": "📜 Licenças & Certificações",
        "publications": "✍️ Artigos & Publicações",
        "languages": "🌐 Idiomas",
        "interests": "🎯 Interesses & Pesquisa",
        "present": "Presente",
        "in_progress": "Em andamento",
        "persona_label": "Persona IA:",
        "layout_label": "Layout A4:",
        "theme_label": "Tema:",
        "viewmode_label": "Visualização:",
        "mode_cv": "📄 Currículo A4",
        "mode_cover_letter": "✉️ Cover Letter",
        "mode_both": "📑 Dossiê (2 Páginas)",
        "opt_executive": "👔 Executivo",
        "opt_creative": "🎨 Criativo",
        "opt_minimalist": "🔹 Minimalista",
        "opt_white": "📄 White",
        "opt_terminal": ">_ Terminal",
        "design_btn": "🎨 Design & Estilo",
        "design_modal_title": "🎨 Personalizar Design & Estilo",
        "design_font_pair": "Tipografia & Fontes",
        "design_font_scale": "Escala de Fonte",
        "design_colors": "Paleta de Cores",
        "design_background": "Textura de Fundo (IA)",
        "design_reset": "Restaurar Padrão",
        "design_close": "Concluir",
    },
    "en": {
        "print_btn": "🖨️ Print / Save as PDF",
        "download_yaml": "📥 Download YAML",
        "download_zip": "📦 Download 5 CVs (ZIP)",
        "copy_yaml": "📋 Copy YAML",
        "yaml_copied": "Copied!",
        "photo_btn": "📷 Photo / Avatar",
        "photo_modal_title": "📷 Profile Photo & Framing",
        "photo_modal_desc": "Upload your photo and adjust position (Pan) and zoom (Scale) by dragging the preview or using the sliders.",
        "photo_choose_file": "📁 Upload from Device",
        "photo_remove": "🗑️ Remove Photo",
        "photo_url_label": "Or paste a direct image URL:",
        "photo_shape_circle": "⚪ Circle (Layouts 01, 03, 04, 05, 06, 09)",
        "photo_shape_rect": "🔲 Rectangle (Layouts 02, 08)",
        "photo_zoom": "🔍 Zoom / Scale",
        "photo_pos_x": "↔ Horizontal Position (X)",
        "photo_pos_y": "↕ Vertical Position (Y)",
        "photo_drag_hint": "💡 Tip: Click and drag inside the frame to move photo freely.",
        "photo_reset_framing": "Reset",
        "photo_no_photo": "No Photo",
        "photo_save": "Save & Apply",
        "work": "💼 Professional Experience",
        "projects": "🚀 Featured Projects & Systems",
        "skills": "⚡ Core Competencies & Technical Skills",
        "education": "🎓 Education & Academic Background",
        "certificates": "📜 Licenses & Certifications",
        "publications": "✍️ Articles & Publications",
        "languages": "🌐 Languages",
        "interests": "🎯 Technical Research & Interests",
        "present": "Present",
        "in_progress": "In Progress",
        "persona_label": "AI Persona:",
        "layout_label": "A4 Layout:",
        "theme_label": "Theme:",
        "viewmode_label": "View:",
        "mode_cv": "📄 A4 Resume",
        "mode_cover_letter": "✉️ Cover Letter",
        "mode_both": "📑 Full Dossier (2 Pages)",
        "opt_executive": "👔 Executive",
        "opt_creative": "🎨 Creative",
        "opt_minimalist": "🔹 Minimalist",
        "opt_white": "📄 White",
        "opt_terminal": ">_ Terminal",
        "design_btn": "🎨 Design & Style",
        "design_modal_title": "🎨 Customize Design & Style",
        "design_font_pair": "Typography & Fonts",
        "design_font_scale": "Font Scale",
        "design_colors": "Color Palette",
        "design_background": "Background Texture (AI)",
        "design_reset": "Reset to Default",
        "design_close": "Done",
    },
    "es": {
        "print_btn": "🖨️ Imprimir / Guardar PDF",
        "download_yaml": "📥 Descargar YAML",
        "download_zip": "📦 Descargar 5 Versiones (ZIP)",
        "copy_yaml": "📋 Copiar YAML",
        "yaml_copied": "¡Copiado!",
        "photo_btn": "📷 Foto / Avatar",
        "photo_modal_title": "📷 Foto / Avatar Profesional",
        "photo_modal_desc": "Carga tu foto de perfil o inserta el enlace directo de una imagen (ej: LinkedIn, GitHub o CDN).",
        "photo_choose_file": "📁 Elegir del Dispositivo",
        "photo_remove": "🗑️ Eliminar Foto",
        "photo_url_label": "O pega el enlace directo de la imagen:",
        "photo_no_photo": "Dejar sin Foto",
        "photo_save": "Guardar y Aplicar",
        "work": "💼 Experiencia Profesional",
        "projects": "🚀 Proyectos Destacados",
        "skills": "⚡ Competencias & Habilidades Técnicas",
        "education": "🎓 Educación & Formación Académica",
        "certificates": "📜 Licencias & Certificaciones",
        "publications": "✍️ Artículos & Publicaciones",
        "languages": "🌐 Idiomas",
        "interests": "🎯 Intereses & Investigación",
        "present": "Presente",
        "in_progress": "En curso",
        "persona_label": "Persona IA:",
        "layout_label": "Diseño A4:",
        "theme_label": "Tema:",
        "viewmode_label": "Vista:",
        "mode_cv": "📄 Currículum A4",
        "mode_cover_letter": "✉️ Carta de Presentación",
        "mode_both": "📑 Dossier (2 Páginas)",
        "opt_executive": "👔 Ejecutivo",
        "opt_creative": "🎨 Creativo",
        "opt_minimalist": "🔹 Minimalista",
        "opt_white": "📄 White",
        "opt_terminal": ">_ Terminal",
        "design_btn": "🎨 Diseño y Estilo",
        "design_modal_title": "🎨 Personalizar Diseño y Estilo",
        "design_font_pair": "Tipografía y Fuentes",
        "design_font_scale": "Escala de Fuente",
        "design_colors": "Paleta de Colores",
        "design_background": "Textura de Fondo (IA)",
        "design_reset": "Restaurar Predeterminado",
        "design_close": "Listo",
    },
}

def get_grid_class(count: int) -> str:
    """
    Retorna a classe CSS de grid dinâmico com base na contagem exata de itens (apenas para áreas amplas):
    - count == 1 -> 'cv-grid-1' (1 coluna, 100% largura)
    - count == 2 -> 'cv-grid-2' (2 colunas)
    - count == 3 -> 'cv-grid-3' (3 colunas)
    - count == 4 -> 'cv-grid-4' (2 colunas: 2x2)
    - count == 5 -> 'cv-grid-5' (3 colunas na 1ª linha, 2 na 2ª linha)
    - count % 3 == 0 -> 'cv-grid-3' (3 colunas)
    - count % 3 == 1 -> 'cv-grid-2' (2 colunas para não sobrar 1 isolado)
    - count % 3 == 2 -> 'cv-grid-split-3-2' (3 na 1ª linha, 2 na 2ª linha)
    """
    if count <= 1:
        return "cv-grid-1"
    elif count == 2:
        return "cv-grid-2"
    elif count == 3:
        return "cv-grid-3"
    elif count == 4:
        return "cv-grid-4"
    elif count == 5:
        return "cv-grid-5"
    elif count % 3 == 0:
        return "cv-grid-3"
    elif count % 3 == 1:
        return "cv-grid-2"
    else:
        return "cv-grid-split-3-2"


def _render_cover_letter_html(data: dict, t: dict) -> str:
    """Renderiza a página A4 da Cover Letter (Carta de Apresentação)."""
    basics = data.get("basics", {})
    name = html.escape(basics.get("name", "Candidato"))
    label = html.escape(basics.get("label", ""))
    email_val = html.escape(basics.get("email", ""))
    phone_val = html.escape(basics.get("phone", ""))
    city = basics.get("location", {}).get("city", "")
    region = basics.get("location", {}).get("region", "")
    loc_str = html.escape(f"{city} - {region}" if city and region else (city or region or ""))

    cover_letter = data.get("coverLetter") or {}
    raw_recipient = cover_letter.get("recipient", "Prezada Equipe de Recrutamento")
    if isinstance(raw_recipient, dict):
        rec_name = raw_recipient.get("name") or "Prezada Equipe"
        rec_title = raw_recipient.get("title") or ""
        rec_comp = raw_recipient.get("company") or cover_letter.get("company", "Empresa Contratante")
        recipient = html.escape(f"{rec_name} ({rec_title})" if rec_title else rec_name)
        company = html.escape(str(rec_comp))
    else:
        recipient = html.escape(str(raw_recipient))
        company = html.escape(str(cover_letter.get("company", "Empresa Contratante")))

    subject = html.escape(str(cover_letter.get("subject", f"Candidatura à Oportunidade em {label or 'Tecnologia'}")))
    date_val = html.escape(str(cover_letter.get("date", "São Paulo, SP")))
    
    raw_paragraphs = cover_letter.get("paragraphs")
    if isinstance(raw_paragraphs, list) and raw_paragraphs:
        body_paragraphs = [html.escape(str(p)).strip() for p in raw_paragraphs if str(p).strip()]
    else:
        body = cover_letter.get("body", "")
        if not body:
            body = f"""Gostaria de apresentar minha candidatura à oportunidade em sua organização. Com sólida trajetória técnica e de liderança em engenharia de software e inteligência artificial, tenho dedicado minha carreira ao desenvolvimento de sistemas escaláveis, seguros e de alta performance.

Ao longo da minha jornada, liderei a concepção de arquiteturas críticas, automações inteligentes e microsserviços de alto throughput, sempre com rigoroso foco em governança, código limpo e impacto mensurável de negócios.

Estou entusiasmado com a possibilidade de agregar essa experiência aos objetivos estratégicos de sua equipe e fico à disposição para uma conversa detalhada.

Atenciosamente,
{name}"""
        body_paragraphs = [html.escape(p).strip() for p in str(body).split("\n\n") if p.strip()]

    body_html = "".join(f"<p style='margin-bottom: 1.15rem; line-height: 1.65; text-align: justify;'>{p.replace(chr(10), '<br>')}</p>" for p in body_paragraphs)

    return f"""
    <div class="cv-page-a4 cv-cover-letter-page">
      <div class="cv-card cv-cover-letter-card">
        <header class="cv-cover-letter-header" style="border-bottom: 2px solid currentColor; padding-bottom: 1rem; margin-bottom: 1.5rem;">
          <h1 class="cv-name" style="font-size: 1.8rem; font-weight: 800; margin: 0 0 0.25rem 0;">{name}</h1>
          {f'<div class="cv-label" style="font-size: 0.95rem; font-weight: 600; opacity: 0.9;">{label}</div>' if label else ''}
          <div class="cv-contacts" style="display: flex; flex-wrap: wrap; gap: 0.85rem; margin-top: 0.6rem; font-size: 0.82rem;">
            {f'<span>✉ {email_val}</span>' if email_val else ''}
            {f'<span>📞 {phone_val}</span>' if phone_val else ''}
            {f'<span>📍 {loc_str}</span>' if loc_str else ''}
          </div>
        </header>

        <div style="font-size: 0.88rem; color: inherit; line-height: 1.6;">
          <div style="display: flex; justify-content: space-between; margin-bottom: 1.25rem; font-weight: 600; opacity: 0.85;">
            <div>Para: <strong>{recipient}</strong> — {company}</div>
            <div>{date_val}</div>
          </div>
          <div style="font-size: 1rem; font-weight: 700; margin-bottom: 1.25rem; border-left: 3px solid currentColor; padding-left: 0.6rem;">
            Assunto: {subject}
          </div>
          <div class="cover-letter-body">
            {body_html}
          </div>
          <div style="margin-top: 2.5rem;">
            <div>Atenciosamente,</div>
            <div style="font-weight: 800; font-size: 1.05rem; margin-top: 0.35rem;">{name}</div>
            <div style="font-size: 0.82rem; opacity: 0.85;">{label}</div>
          </div>
        </div>
      </div>
    </div>
    """


def _render_canvas_livre_html(data: dict, t: dict) -> str:
    basics = data.get("basics", {})
    work = data.get("work", [])
    education = data.get("education", [])
    projects = data.get("projects", [])
    skills = data.get("skills", [])
    languages = data.get("languages", [])
    interests = data.get("interests", [])

    name = html.escape(basics.get("name", "Candidato"))
    label = html.escape(basics.get("label", ""))
    summary_val = html.escape(basics.get("summary", "")).replace("\n", "<br>")
    image_val = html.escape(str(basics.get("image", "") or ""))
    has_image = bool(image_val and image_val.strip() and image_val != "None")
    image_pos_x = basics.get("imagePosX", 50)
    image_pos_y = basics.get("imagePosY", 50)
    image_scale = basics.get("imageScale", 1.0)
    try:
        image_pos_x = int(image_pos_x) if image_pos_x is not None else 50
    except:
        image_pos_x = 50
    try:
        image_pos_y = int(image_pos_y) if image_pos_y is not None else 50
    except:
        image_pos_y = 50
    try:
        image_scale = float(image_scale) if image_scale is not None else 1.0
    except:
        image_scale = 1.0

    img_style = f"object-position: {image_pos_x}% {image_pos_y}%; transform: scale({image_scale}); transform-origin: {image_pos_x}% {image_pos_y}%; {'display:block;' if has_image else 'display:none;'}"

    work_items = "".join(f"""
      <div class="card avoid-break">
        <div class="item-header">
          <span class="item-title">{html.escape(w.get("position", ""))}</span>
          <span class="item-date">{html.escape(str(w.get("startDate", "")))} — {html.escape(str(w.get("endDate", t["present"])))}</span>
        </div>
        <div class="item-sub">{html.escape(w.get("name", ""))}</div>
        {f'<p class="item-desc">{html.escape(w.get("summary", ""))}</p>' if w.get("summary") else ''}
      </div>
    """ for w in work)

    skills_tags = "".join(f"""
      <div class="skill-group cv-math-skill-card avoid-break">
        <div class="skill-title">⚡ {html.escape(sk.get("name", ""))}</div>
        <div class="tags">{"".join(f'<span class="badge">{html.escape(k)}</span>' for k in sk.get("keywords", []))}</div>
      </div>
    """ for sk in skills)

    projects_items = "".join(f"""
      <div class="project-card avoid-break">
        <div class="item-header"><span class="item-title">{html.escape(pr.get("name", ""))}</span></div>
        <p class="item-desc">{html.escape(pr.get("description", ""))}</p>
        <div class="tags">{"".join(f'<span class="badge">{html.escape(k)}</span>' for k in pr.get("keywords", []))}</div>
      </div>
    """ for pr in projects)

    edu_items = "".join(f"""
      <div class="geo-card avoid-break">
        <div class="card-top"><span class="geo-icon">🎓</span><span class="item-date">{html.escape(str(ed.get("startDate", "")))} — {html.escape(str(ed.get("endDate", t["in_progress"])))}</span></div>
        <div class="item-title">{html.escape(ed.get("area", ""))}</div>
        <div class="item-sub">{html.escape(ed.get("institution", ""))}</div>
      </div>
    """ for ed in education)

    langs_items = "".join(f"""
      <div class="lang-card avoid-break" style="display:flex; justify-content:space-between; align-items:center; width:100%;">
        <span>{html.escape(l.get("language", ""))}</span>
        <span class="badge">{html.escape(l.get("fluency", ""))}</span>
      </div>
    """ for l in languages)

    ints_items = "".join(f"""
      <div class="interest-card avoid-break">
        <div style="font-weight:700; margin-bottom:0.25rem;">◈ {html.escape(it.get("name", ""))}</div>
        <div class="tags">{"".join(f'<span class="badge">{html.escape(k)}</span>' for k in it.get("keywords", []))}</div>
      </div>
    """ for it in interests)

    return f"""
    <div class="cv-canvas-workspace">
      <aside class="cv-canvas-palette cv-no-print" aria-label="Paleta de Blocos do YAML">
        <div class="cv-canvas-palette__header">
          <h3 class="cv-canvas-palette__title"><span>📦</span> Campos do YAML</h3>
          <span style="font-size: 0.72rem; color: #10b981; font-weight: 700; background: rgba(16,185,129,0.1); padding: 0.15rem 0.45rem; border-radius: 4px;">
            9 blocos
          </span>
        </div>
        <div class="cv-canvas-palette__body">
          <div class="cv-canvas-palette__presets">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.2rem;">
              <span style="font-size: 0.72rem; font-weight: 700; color: #94a3b8; text-transform: uppercase;">Templates Rápidos</span>
              <button type="button" onclick="clearCanvasBlocks()" style="background: transparent; border: none; color: #f87171; font-size: 0.7rem; cursor: pointer; font-weight: 600;">🗑️ Limpar</button>
            </div>
            <button type="button" class="cv-canvas-preset-btn" onclick="applyCanvasPreset('executive_balanced')"><span>👔 Executivo Balanceado</span><span style="opacity: 0.6; font-size: 0.7rem;">9 blocos</span></button>
            <button type="button" class="cv-canvas-preset-btn" onclick="applyCanvasPreset('two_column')"><span>📑 Duas Colunas</span><span style="opacity: 0.6; font-size: 0.7rem;">9 blocos</span></button>
            <button type="button" class="cv-canvas-preset-btn" onclick="applyCanvasPreset('tech_hero')"><span>🚀 Hero Tech & Projetos</span><span style="opacity: 0.6; font-size: 0.7rem;">9 blocos</span></button>
          </div>
          <div class="cv-canvas-palette__section">
            <div class="cv-canvas-palette__sec-title">👤 Identidade & Contato</div>
            <button type="button" class="cv-canvas-item-btn" onclick="addCanvasBlock('header')"><span>👤 Nome & Título</span><span class="item-add-plus">+</span></button>
            <button type="button" class="cv-canvas-item-btn" onclick="addCanvasBlock('photo')"><span>📷 Foto / Avatar</span><span class="item-add-plus">+</span></button>
            <button type="button" class="cv-canvas-item-btn" onclick="addCanvasBlock('contacts')"><span>📞 Contatos & Links</span><span class="item-add-plus">+</span></button>
          </div>
          <div class="cv-canvas-palette__section">
            <div class="cv-canvas-palette__sec-title">📝 Trajetória & Conteúdo</div>
            <button type="button" class="cv-canvas-item-btn" onclick="addCanvasBlock('summary')"><span>📄 Sobre Mim / Resumo</span><span class="item-add-plus">+</span></button>
            <button type="button" class="cv-canvas-item-btn" onclick="addCanvasBlock('work')"><span>💼 Experiência Profissional</span><span class="item-add-plus">+</span></button>
            <button type="button" class="cv-canvas-item-btn" onclick="addCanvasBlock('projects')"><span>🚀 Projetos em Destaque</span><span class="item-add-plus">+</span></button>
          </div>
          <div class="cv-canvas-palette__section">
            <div class="cv-canvas-palette__sec-title">⚡ Competências & Níveis</div>
            <button type="button" class="cv-canvas-item-btn" onclick="addCanvasBlock('skills_tags')"><span>⚡ Competências (Tags)</span><span class="item-add-plus">+</span></button>
            <button type="button" class="cv-canvas-item-btn" onclick="addCanvasBlock('skills_bars')"><span>📊 Barras de Nível</span><span class="item-add-plus">+</span></button>
          </div>
          <div class="cv-canvas-palette__section">
            <div class="cv-canvas-palette__sec-title">🎓 Formação & Certificações</div>
            <button type="button" class="cv-canvas-item-btn" onclick="addCanvasBlock('education')"><span>🎓 Formação Acadêmica</span><span class="item-add-plus">+</span></button>
            <button type="button" class="cv-canvas-item-btn" onclick="addCanvasBlock('certificates')"><span>📜 Certificações</span><span class="item-add-plus">+</span></button>
          </div>
          <div class="cv-canvas-palette__section">
            <div class="cv-canvas-palette__sec-title">🌐 Idiomas & Interesses</div>
            <button type="button" class="cv-canvas-item-btn" onclick="addCanvasBlock('languages')"><span>🌐 Idiomas</span><span class="item-add-plus">+</span></button>
            <button type="button" class="cv-canvas-item-btn" onclick="addCanvasBlock('interests')"><span>🎯 Interesses</span><span class="item-add-plus">+</span></button>
          </div>
        </div>
      </aside>

      <main class="cv-canvas-center-stage">
        <div class="cv-canvas-sheet-info-bar cv-no-print">
          <span>📄 <strong>Folha A4 Livre</strong> (210 × 297 mm) | 9 blocos</span>
          <span style="font-size: 0.74rem; color: #34d399; font-weight: 700;">Pronto para Impressão A4</span>
        </div>
        <div class="cv-canvas-sheet-wrapper">
          <div class="cv-canvas-sheet">
            <div class="cv-canvas-block cv-col-12">
              <div class="cv-header" style="margin-bottom: 0.5rem;">
                <h1 class="name" style="font-size: 1.85rem; font-weight: 800; margin: 0 0 0.2rem 0;">{name}</h1>
                <div class="label" style="font-size: 0.95rem; font-weight: 600; opacity: 0.9;">{label}</div>
              </div>
            </div>
            <div class="cv-canvas-block cv-col-4">
              <div style="display: flex; justify-content: center; width: 100%; margin: 0.25rem 0;">
                <div class="cv-avatar-container {'has-photo' if has_image else ''}" onclick="openPhotoModal()" style="width: 95px; height: 95px; border-radius: 50%; overflow: hidden; display: block; background: #e2e8f0; cursor: pointer;">
                  <img class="cv-avatar-img" src="{image_val if has_image else ''}" alt="Avatar" style="{img_style}" />
                  <div class="cv-avatar-placeholder" style="{'display:none;' if has_image else 'display:flex;'}">
                    <span class="avatar-icon">👤</span>
                    <span class="avatar-hint" style="font-size: 0.65rem;">+ Foto</span>
                  </div>
                </div>
              </div>
            </div>
            <div class="cv-canvas-block cv-col-8">
              {f'<div class="summary">{summary_val}</div>' if summary_val else ''}
            </div>
            <div class="cv-canvas-block cv-col-12">
              {f'<section class="avoid-break"><h2 class="section-title">{t["work"]}</h2>{work_items}</section>' if work_items else ''}
            </div>
            <div class="cv-canvas-block cv-col-6">
              {f'<section class="avoid-break"><h2 class="section-title">{t["skills"]}</h2><div class="skills-grid cv-math-grid cv-grid-2">{skills_tags}</div></section>' if skills_tags else ''}
            </div>
            <div class="cv-canvas-block cv-col-6">
              {f'<section class="avoid-break"><h2 class="section-title">{t["education"]}</h2><div class="education-grid cv-math-grid cv-grid-2">{edu_items}</div></section>' if edu_items else ''}
            </div>
            <div class="cv-canvas-block cv-col-12">
              {f'<section class="avoid-break"><h2 class="section-title">{t["projects"]}</h2><div class="projects-grid cv-math-grid cv-grid-2">{projects_items}</div></section>' if projects_items else ''}
            </div>
            <div class="cv-canvas-block cv-col-6">
              {f'<section class="avoid-break"><h2 class="section-title">{t["languages"]}</h2><div class="languages-grid cv-math-grid cv-grid-2">{langs_items}</div></section>' if langs_items else ''}
            </div>
            <div class="cv-canvas-block cv-col-6">
              {f'<section class="avoid-break"><h2 class="section-title">{t["interests"]}</h2><div class="interests-grid cv-math-grid cv-grid-2">{ints_items}</div></section>' if ints_items else ''}
            </div>
          </div>
        </div>
      </main>
    </div>
    """


def _render_cv_layout_html(data: dict, layout: str, t: dict, view_mode: str = "cv") -> str:
    """
    Renderiza o HTML do currículo aplicando o Blueprint de Layout correspondente
    (modular, linear, sidebar, compact_split, editorial_accent, corporate_timeline,
    warm_magazine, hero_matrix, dynamic_math, canvas_livre).
    """
    if view_mode == "cover_letter":
        return _render_cover_letter_html(data, t)

    if layout == "canvas_livre":
        return _render_canvas_livre_html(data, t)

    basics = data.get("basics", {})
    work = data.get("work", [])
    education = data.get("education", [])
    projects = data.get("projects", [])
    skills = data.get("skills", [])
    languages = data.get("languages", [])
    interests = data.get("interests", [])
    certificates = data.get("certificates", [])
    publications = data.get("publications", [])

    email_val = basics.get("email", "")
    phone_val = basics.get("phone", "")
    clean_phone = re.sub(r"[^\d+]", "", str(phone_val))
    city = basics.get("location", {}).get("city", "")
    region = basics.get("location", {}).get("region", "")
    loc_str = f"{city} - {region}" if city and region else (city or region or "")
    url_val = basics.get("url", "")
    image_val = html.escape(str(basics.get("image", "") or ""))
    has_image = bool(image_val and image_val.strip() and image_val != "None")
    
    # Enquadramento de foto (Pan e Zoom)
    image_pos_x = basics.get("imagePosX", 50)
    image_pos_y = basics.get("imagePosY", 50)
    image_scale = basics.get("imageScale", 1.0)
    try:
        image_pos_x = int(image_pos_x) if image_pos_x is not None else 50
    except Exception:
        image_pos_x = 50
    try:
        image_pos_y = int(image_pos_y) if image_pos_y is not None else 50
    except Exception:
        image_pos_y = 50
    try:
        image_scale = float(image_scale) if image_scale is not None else 1.0
    except Exception:
        image_scale = 1.0

    img_style = f"object-position: {image_pos_x}% {image_pos_y}%; transform: scale({image_scale}); transform-origin: {image_pos_x}% {image_pos_y}%; {'display:block;' if has_image else 'display:none;'}"

    # Links de perfis sociais
    profiles_links = []
    for p in basics.get("profiles", []):
        network = html.escape(p.get("network", ""))
        url = html.escape(p.get("url", ""))
        user = html.escape(p.get("username", ""))
        if url:
            profiles_links.append(f'<a href="{url}" target="_blank" class="cv-link">🔗 {network}: @{user}</a>')
        elif user:
            profiles_links.append(f'<span>{network}: {user}</span>')
    profiles_html = " &nbsp;•&nbsp; ".join(profiles_links)

    # Avatar Component: em tela interativa mostra gatilho; na impressão (@media print) se !has_image é completamente ocultado
    avatar_html = f"""
      <div class="cv-avatar-container {'has-photo' if has_image else ''}" onclick="openPhotoModal()" title="{t['photo_btn']}">
        <img class="cv-avatar-img" src="{image_val if has_image else ''}" alt="Avatar" style="{img_style}" />
        <div class="cv-avatar-placeholder" style="{'display:none;' if has_image else 'display:flex;'}">
          <span class="avatar-icon">👤</span>
          <span class="avatar-hint" style="font-size: 0.65rem; opacity: 0.85;">{t['photo_btn']}</span>
        </div>
      </div>
    """

    avatar_rect_html = f"""
      <div class="cv-avatar-container cv-avatar-rect {'has-photo' if has_image else ''}" onclick="openPhotoModal()" title="{t['photo_btn']}">
        <img class="cv-avatar-img" src="{image_val if has_image else ''}" alt="Avatar" style="{img_style}" />
        <div class="cv-avatar-placeholder" style="{'display:none;' if has_image else 'display:flex;'}">
          <span class="avatar-icon">👤</span>
          <span class="avatar-hint" style="font-size: 0.65rem; opacity: 0.85;">{t['photo_btn']}</span>
        </div>
      </div>
    """

    # Work Timeline items
    work_items_html = ""
    for w in work:
        pos = html.escape(w.get("position", ""))
        company = html.escape(w.get("name", ""))
        w_url = html.escape(w.get("url", ""))
        start_date = html.escape(str(w.get("startDate", "")))
        end_date = w.get("endDate")
        if not end_date or str(end_date).strip().lower() in ["null", "none", "present", "atual", "presente", ""]:
            date_str = f"{start_date} — {t['present']}"
        else:
            date_str = f"{start_date} — {html.escape(str(end_date))}"
        summary = html.escape(w.get("summary", ""))
        highlights = w.get("highlights", [])
        hl_html = "".join(f"<li>{html.escape(h)}</li>" for h in highlights)

        work_items_html += f"""
        <div class="card avoid-break">
            <div class="item-header">
                <span class="item-title">{pos}</span>
                <span class="item-date">{date_str}</span>
            </div>
            <div class="item-sub">{f'<a href="{w_url}" target="_blank">{company} ↗</a>' if w_url else company}</div>
            {f'<p class="item-desc">{summary}</p>' if summary else ''}
            {f'<ul class="bullets">{hl_html}</ul>' if highlights else ''}
        </div>
        """

    # Projects
    projects_items_html = ""
    for pr in projects:
        name = html.escape(pr.get("name", ""))
        desc = html.escape(pr.get("description", ""))
        pr_url = html.escape(pr.get("url", ""))
        kws = "".join(f"<span class='badge'>{html.escape(k)}</span>" for k in pr.get("keywords", []))
        highlights = pr.get("highlights", [])
        hl_html = "".join    # Skills (Horizontal / Grid & Vertical Stack)
    skills_items_html = ""
    for sk in skills:
        cat_name = html.escape(sk.get("name", ""))
        kws = "".join(f"<span class='badge'>{html.escape(k)}</span>" for k in sk.get("keywords", []))
        skills_items_html += f"""
        <div class="skill-group cv-math-skill-card avoid-break">
            <div class="skill-title cv-math-skill-title">⚡ {cat_name}</div>
            <div class="tags cv-math-tags">{kws}</div>
        </div>
        """

    # Skills com Barras de Progresso (Expertise / Matriz de Competências)
    def _calc_skill_percent(lvl_str, lvl_pct):
        if isinstance(lvl_pct, (int, float)) and 0 <= lvl_pct <= 100:
            return int(lvl_pct)
        if not lvl_str:
            return 75
        norm = str(lvl_str).lower().strip()
        if any(w in norm for w in ["expert", "especialista", "master", "principal", "lead", "staff"]):
            return 95
        if any(w in norm for w in ["senior", "sênior", "avançad", "advanced", "alto"]):
            return 85
        if any(w in norm for w in ["pleno", "intermediár", "intermediate", "proficient", "médio"]):
            return 70
        if any(w in norm for w in ["júnior", "junior", "básic", "basic", "iniciante"]):
            return 40
        return 75

    skills_bars_html = ""
    for sk in skills:
        sk_name = html.escape(sk.get("name", ""))
        sk_level = html.escape(sk.get("level", ""))
        sk_pct = _calc_skill_percent(sk.get("level"), sk.get("levelPercent"))
        skills_bars_html += f"""
        <div class="cv-skill-bar-wrapper avoid-break" style="width: 100%; margin-bottom: 0.45rem;">
            <div class="cv-skill-bar-label" style="display: flex; justify-content: space-between; align-items: center; font-size: 0.82rem; font-weight: 700; margin-bottom: 0.2rem;">
                <span>{sk_name}</span>
                <span style="opacity: 0.8; font-size: 0.75rem; font-weight: 600;">{sk_level or f'{sk_pct}%'}</span>
            </div>
            <div class="cv-skill-bar-bg" style="width: 100%; height: 5px; background: rgba(125,125,125,0.2); border-radius: 999px; overflow: hidden;">
                <div class="cv-skill-bar-fill" style="width: {sk_pct}%; height: 100%; background: currentColor; border-radius: 999px;"></div>
            </div>
        </div>
        """

    # Education
    education_items_html = ""
    for ed in education:
        inst = html.escape(ed.get("institution", ""))
        area = html.escape(ed.get("area", ""))
        study_type = html.escape(ed.get("studyType", ""))
        ed_start = html.escape(str(ed.get("startDate", "")))
        ed_end = ed.get("endDate")
        if not ed_end or str(ed_end).strip().lower() in ["null", "none", "present", "atual", "presente", ""]:
            ed_date = f"{ed_start} — {t['in_progress']}"
        else:
            ed_date = f"{ed_start} — {html.escape(str(ed_end))}"
        courses = ed.get("courses", [])
        c_html = "".join(f"<span class='badge' style='margin-top:0.25rem;'>{html.escape(c)}</span>" for c in courses)

        education_items_html += f"""
        <div class="geo-card cv-math-edu-card avoid-break">
            <div class="card-top"><span class="geo-icon">🎓</span><span class="item-date">{ed_date}</span></div>
            <div class="item-title" style="font-weight: 700; font-size: 0.85rem;">{area}</div>
            <div class="item-sub" style="font-size: 0.8rem;">{inst} • {study_type}</div>
            {f'<div class="tags cv-math-tags" style="margin-top:0.3rem;">{c_html}</div>' if courses else ''}
        </div>
        """

    # Languages (Full width row items)
    lang_cards_html = "".join(
        f"""
        <div class="lang-card avoid-break" style="display: flex; justify-content: space-between; align-items: center; width: 100%;">
            <span style="font-weight: 600;">{html.escape(l.get('language', ''))}</span>
            <span class="badge">{html.escape(l.get('fluency', ''))}</span>
        </div>
        """ for l in languages
    )

    # Certificates
    certificates_items_html = ""
    for cert in certificates:
        name = html.escape(cert.get("name", ""))
        issuer = html.escape(cert.get("issuer", ""))
        date = html.escape(str(cert.get("date", "")))
        url = html.escape(cert.get("url", ""))

        certificates_items_html += f"""
        <div class="geo-card cv-math-cert-card avoid-break">
            <div class="card-top"><span class="geo-icon">🎖️</span><span class="item-date">{date}</span></div>
            <div class="item-title" style="font-weight: 700; font-size: 0.85rem;">{f'<a href="{url}" target="_blank">{name} ↗</a>' if url else name}</div>
            <div class="issuer-pill">{issuer}</div>
        </div>
        """

    # Publications
    publications_html = ""
    for pub in publications:
        p_name = html.escape(pub.get("name", ""))
        p_pub = html.escape(pub.get("publisher", ""))
        p_date = html.escape(str(pub.get("releaseDate", "")))
        p_url = html.escape(pub.get("url", ""))
        p_sum = html.escape(pub.get("summary", ""))

        publications_html += f"""
        <div class="card avoid-break" style="margin-bottom: 0.5rem;">
            <div class="item-header" style="font-size: 0.88rem;">
                <span class="item-title">{f'<a href="{p_url}" target="_blank">{p_name} ↗</a>' if p_url else p_name}</span>
                <span class="item-date">{p_date}</span>
            </div>
            <div class="item-sub">{p_pub}</div>
            {f'<p class="item-desc">{p_sum}</p>' if p_sum else ''}
        </div>
        """

    # Interests
    interest_items_html = ""
    for it in interests:
        kws = "".join(f"<span class='badge'>{html.escape(k)}</span>" for k in it.get("keywords", []))
        interest_items_html += f"""
        <div class="interest-card cv-math-interest-card avoid-break">
            <div style="font-weight: 700; font-size: 0.85rem; margin-bottom: 0.3rem;">◈ {html.escape(it.get('name', ''))}</div>
            <div class="tags cv-math-tags">{kws}</div>
        </div>
        """

    # Hobbies com Ícones Circulares (Modelo 04 Executive Duo)
    hobby_icons_map = {
        "camera": "📷", "palette": "🎨", "plane": "✈️", "book": "📚",
        "code": "💻", "music": "🎵", "coffee": "☕", "globe": "🌐",
        "chess": "♟️", "gym": "🏋️"
    }
    hobbies_circles_html = ""
    for it in interests:
        it_name = html.escape(it.get("name", ""))
        it_icon_key = str(it.get("icon", "")).lower()
        it_icon = hobby_icons_map.get(it_icon_key, "🎯")
        hobbies_circles_html += f"""
        <div style="display: flex; flex-direction: column; align-items: center; gap: 0.2rem;">
            <div class="cv-hobby-circle" style="width: 36px; height: 36px; border-radius: 50%; border: 1.5px solid currentColor; display: flex; align-items: center; justify-content: center; font-size: 1.1rem; margin: 0 auto 0.2rem auto;">{it_icon}</div>
            <div class="cv-hobby-label" style="font-size: 0.72rem; font-weight: 700; text-align: center; max-width: 75px; word-break: break-word;">{it_name}</div>
        </div>
        """

    # ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    # 1. MODELO A4 09: Dynamic Grid Math (Augusto Heiss / Mathematical Balance)
    # ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    if layout == "dynamic_math":
        cv_body = f"""
        <div class="layout-dynamic_math">
            <header class="cv-math-header">
              <div class="cv-math-header-profile">
                {avatar_html}
                <div>
                  <h1 class="cv-math-name name">{html.escape(basics.get("name", ""))}</h1>
                  <div class="cv-math-label label">{html.escape(basics.get("label", ""))}</div>
                </div>
              </div>
              <div class="cv-math-contacts">
                {f'<div>✉ <a href="mailto:{html.escape(email_val)}" class="cv-link">{html.escape(email_val)}</a></div>' if email_val else ''}
                {f'<div>📞 <a href="tel:{clean_phone}" class="cv-link">{html.escape(phone_val)}</a></div>' if phone_val else ''}
                {f'<div>📍 {html.escape(loc_str)}</div>' if loc_str else ''}
                {f'<div>🌐 <a href="{html.escape(url_val)}" target="_blank" class="cv-link">{html.escape(url_val)}</a></div>' if url_val else ''}
                {f'<div class="cv-math-profiles">{profiles_html}</div>' if profiles_html else ''}
              </div>
            </header>

            {f'<div class="cv-math-summary summary">{html.escape(basics.get("summary", "")).replace(chr(10), "<br>")}</div>' if basics.get("summary") else ''}

            {f'<section class="avoid-break"><h2 class="cv-math-section-title section-title">{t["work"]}</h2><div class="cv-math-work-list">{work_items_html}</div></section>' if work else ''}

            {f'<section class="avoid-break"><h2 class="cv-math-section-title section-title">{t["projects"]}</h2><div class="projects-grid cv-math-grid {get_grid_class(len(projects))}">{projects_items_html}</div></section>' if projects else ''}

            {f'<section class="avoid-break"><h2 class="cv-math-section-title section-title">{t["skills"]}</h2><div class="skills-grid cv-math-grid {get_grid_class(len(skills))}">{skills_items_html}</div></section>' if skills else ''}

            {f'<section class="avoid-break"><h2 class="cv-math-section-title section-title">{t["education"]}</h2><div class="education-grid cv-math-grid {get_grid_class(len(education))}">{education_items_html}</div></section>' if education else ''}

            {f'<section class="avoid-break"><h2 class="cv-math-section-title section-title">{t["certificates"]}</h2><div class="certs-grid cv-math-grid {get_grid_class(len(certificates))}">{certificates_items_html}</div></section>' if certificates else ''}

            {f'<section class="avoid-break"><h2 class="cv-math-section-title section-title">{t["publications"]}</h2>{publications_html}</section>' if publications else ''}

            {f'<section class="avoid-break"><h2 class="cv-math-section-title section-title">{t["languages"]}</h2><div class="languages-grid cv-math-grid {get_grid_class(len(languages))}">{lang_cards_html}</div></section>' if languages else ''}

            {f'<section class="avoid-break"><h2 class="cv-math-section-title section-title">{t["interests"]}</h2><div class="interests-grid cv-math-grid {get_grid_class(len(interests))}">{interest_items_html}</div></section>' if interests else ''}
        </div>
        """

    # ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    # 2. MODELO A4 05: Brand Accent Block (Editorial Accent)
    # ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    elif layout == "editorial_accent":
        cv_body = f"""
        <div class="layout-editorial_accent">
            <header class="header" style="display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid currentColor; padding-bottom: 1rem; margin-bottom: 1.25rem;">
                <div>
                    <span class="cv-brand-greeting" style="background: currentColor; color: #fff; padding: 0.15rem 0.5rem; font-size: 0.75rem; font-weight: 700; border-radius: 3px; display: inline-block; margin-bottom: 0.25rem;">HELLO, I AM</span>
                    <h1 class="name" style="font-size: 1.85rem; font-weight: 800; margin: 0 0 0.2rem 0;">{html.escape(basics.get("name", ""))}</h1>
                    <div class="label" style="font-size: 0.95rem; font-weight: 600; opacity: 0.9;">{html.escape(basics.get("label", ""))}</div>
                </div>
                {avatar_html}
            </header>

            <div class="cv-editorial-grid" style="display: grid; grid-template-columns: 220px 1fr; gap: 1.75rem; align-items: start;">
                <aside class="cv-editorial-left cv-sidebar-stack">
                    <div class="sidebar-section">
                        <h4 class="section-title" style="font-size: 0.85rem; margin-top: 0;">CONTATO</h4>
                        <div class="contacts" style="font-size: 0.8rem; line-height: 1.5; text-align: left;">
                            {f'<div>✉ {html.escape(email_val)}</div>' if email_val else ''}
                            {f'<div>📞 {html.escape(phone_val)}</div>' if phone_val else ''}
                            {f'<div>📍 {html.escape(loc_str)}</div>' if loc_str else ''}
                            {f'<div>🌐 <a href="{html.escape(url_val)}" target="_blank" class="cv-link">{html.escape(url_val)}</a></div>' if url_val else ''}
                        </div>
                    </div>
                    {f'<div class="sidebar-section"><h4 class="section-title" style="font-size: 0.85rem;">EXPERTISE</h4><div class="cv-skills-progress-list">{skills_bars_html}</div></div>' if skills else ''}
                    {f'<div class="sidebar-section"><h4 class="section-title" style="font-size: 0.85rem;">{t["languages"]}</h4><div class="cv-sidebar-stack">{lang_cards_html}</div></div>' if languages else ''}
                    {f'<div class="sidebar-section"><h4 class="section-title" style="font-size: 0.85rem;">{t["certificates"]}</h4><div class="cv-sidebar-stack">{certificates_items_html}</div></div>' if certificates else ''}
                    {f'<div class="sidebar-section"><h4 class="section-title" style="font-size: 0.85rem;">{t["interests"]}</h4><div class="cv-sidebar-stack">{interest_items_html}</div></div>' if interests else ''}
                </aside>

                <main class="cv-editorial-main">
                    {f'<div class="summary" style="margin-bottom: 1.25rem;">{html.escape(basics.get("summary", "")).replace(chr(10), "<br>")}</div>' if basics.get("summary") else ''}
                    {f'<section class="avoid-break"><h2 class="section-title">{t["work"]}</h2>{work_items_html}</section>' if work else ''}
                    {f'<section class="avoid-break"><h2 class="section-title">{t["projects"]}</h2><div class="cv-sidebar-stack" style="display: flex; flex-direction: column; gap: 0.65rem; width: 100%;">{projects_items_html}</div></section>' if projects else ''}
                    {f'<section class="avoid-break"><h2 class="section-title">{t["education"]}</h2><div class="cv-sidebar-stack" style="display: flex; flex-direction: column; gap: 0.65rem; width: 100%;">{education_items_html}</div></section>' if education else ''}
                </main>
            </div>
        </div>
        """

    # ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    # 3. MODELO A4 06: Navy Solid Timeline (Corporate Timeline)
    # ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    elif layout == "corporate_timeline":
        cv_body = f"""
        <div class="layout-corporate_timeline">
            <div class="cv-navy-layout" style="display: grid; grid-template-columns: 240px 1fr; gap: 1.5rem;">
                <aside class="cv-navy-sidebar cv-sidebar-stack" style="background: #0f172a; color: #f8fafc; padding: 1.5rem; border-radius: 8px;">
                    {avatar_html}
                    <div style="text-align: center;">
                        <h2 style="font-size: 1.3rem; margin: 0 0 0.25rem 0; font-weight: 800; color: #fff;">{html.escape(basics.get("name", ""))}</h2>
                        <div style="font-size: 0.85rem; color: #f97316; font-weight: 700;">{html.escape(basics.get("label", ""))}</div>
                    </div>
                    <div class="contacts" style="font-size: 0.8rem; line-height: 1.45; text-align: left; border-top: 1px solid rgba(255,255,255,0.15); padding-top: 0.85rem;">
                        {f'<div>✉ {html.escape(email_val)}</div>' if email_val else ''}
                        {f'<div>📞 {html.escape(phone_val)}</div>' if phone_val else ''}
                        {f'<div>📍 {html.escape(loc_str)}</div>' if loc_str else ''}
                    </div>
                    {f'<div><h4 style="font-size: 0.85rem; color: #f8fafc; border-bottom: 1px solid rgba(255,255,255,0.2); padding-bottom: 0.25rem; margin-bottom: 0.5rem;">EXPERTISE</h4><div class="cv-skills-progress-list">{skills_bars_html}</div></div>' if skills else ''}
                    {f'<div><h4 style="font-size: 0.85rem; color: #f8fafc; border-bottom: 1px solid rgba(255,255,255,0.2); padding-bottom: 0.25rem; margin-bottom: 0.5rem;">{t["languages"]}</h4><div class="cv-sidebar-stack">{lang_cards_html}</div></div>' if languages else ''}
                    {f'<div><h4 style="font-size: 0.85rem; color: #f8fafc; border-bottom: 1px solid rgba(255,255,255,0.2); padding-bottom: 0.25rem; margin-bottom: 0.5rem;">{t["interests"]}</h4><div class="cv-sidebar-stack">{interest_items_html}</div></div>' if interests else ''}
                </aside>

                <main class="cv-navy-main">
                    {f'<div class="summary">{html.escape(basics.get("summary", "")).replace(chr(10), "<br>")}</div>' if basics.get("summary") else ''}
                    {f'<section class="avoid-break"><h2 class="section-title">{t["work"]}</h2>{work_items_html}</section>' if work else ''}
                    {f'<section class="avoid-break"><h2 class="section-title">{t["education"]}</h2><div class="cv-sidebar-stack" style="display: flex; flex-direction: column; gap: 0.65rem; width: 100%;">{education_items_html}</div></section>' if education else ''}
                    {f'<section class="avoid-break"><h2 class="section-title">{t["projects"]}</h2><div class="cv-sidebar-stack" style="display: flex; flex-direction: column; gap: 0.65rem; width: 100%;">{projects_items_html}</div></section>' if projects else ''}
                    {f'<section class="avoid-break"><h2 class="section-title">{t["certificates"]}</h2><div class="cv-sidebar-stack" style="display: flex; flex-direction: column; gap: 0.65rem; width: 100%;">{certificates_items_html}</div></section>' if certificates else ''}
                </main>
            </div>
        </div>
        """

    # ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    # 4. MODELO A4 08: Hero Matrix (Mary Smith)
    # ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    elif layout == "hero_matrix":
        cv_body = f"""
        <div class="layout-hero_matrix">
            <div class="cv-top-contact-bar" style="display: flex; justify-content: space-between; font-size: 0.8rem; font-weight: 600; border-bottom: 1px solid rgba(125,125,125,0.2); padding-bottom: 0.4rem; margin-bottom: 1rem;">
                <span>✉ {html.escape(email_val)}</span>
                <span>📞 {html.escape(phone_val)}</span>
                <span>📍 {html.escape(loc_str)}</span>
            </div>
            <header class="cv-hero-banner" style="display: flex; justify-content: space-between; align-items: center; background: rgba(125,125,125,0.06); padding: 1.25rem 1.5rem; border-radius: 8px; margin-bottom: 1.25rem;">
                <div>
                    <h1 class="name" style="font-size: 1.85rem; font-weight: 800; margin: 0 0 0.25rem 0;">{html.escape(basics.get("name", ""))}</h1>
                    <div class="label" style="font-size: 0.95rem; font-weight: 600; opacity: 0.9;">{html.escape(basics.get("label", ""))}</div>
                </div>
                {avatar_rect_html}
            </header>

            {f'<div class="summary" style="margin-bottom: 1rem;">{html.escape(basics.get("summary", "")).replace(chr(10), "<br>")}</div>' if basics.get("summary") else ''}

            <div style="display: grid; grid-template-columns: 1.2fr 1fr; gap: 1.5rem; margin-bottom: 1.25rem; align-items: start;">
                <div>
                    {f'<section class="avoid-break"><h2 class="section-title">{t["work"]}</h2>{work_items_html}</section>' if work else ''}
                </div>
                <div>
                    {f'<section class="avoid-break"><h2 class="section-title">{t["education"]}</h2><div class="cv-sidebar-stack" style="display: flex; flex-direction: column; gap: 0.65rem; width: 100%;">{education_items_html}</div></section>' if education else ''}
                    {f'<section class="avoid-break"><h2 class="section-title">{t["projects"]}</h2><div class="cv-sidebar-stack" style="display: flex; flex-direction: column; gap: 0.65rem; width: 100%;">{projects_items_html}</div></section>' if projects else ''}
                </div>
            </div>

            {f'<section class="avoid-break" style="border-top: 1px solid rgba(125,125,125,0.2); padding-top: 0.85rem; margin-top: 0.5rem;"><h2 class="section-title">⚡ MATRIZ DE COMPETÊNCIAS</h2><div class="cv-skills-progress-list">{skills_bars_html}</div></section>' if skills else ''}
            {f'<section class="avoid-break"><h2 class="section-title">{t["languages"]}</h2><div class="languages-grid cv-math-grid {get_grid_class(len(languages))}">{lang_cards_html}</div></section>' if languages else ''}
            {f'<section class="avoid-break"><h2 class="section-title">{t["certificates"]}</h2><div class="certs-grid cv-math-grid {get_grid_class(len(certificates))}">{certificates_items_html}</div></section>' if certificates else ''}
            {f'<section class="avoid-break"><h2 class="section-title">{t["interests"]}</h2><div class="interests-grid cv-math-grid {get_grid_class(len(interests))}">{interest_items_html}</div></section>' if interests else ''}
        </div>
        """

    # ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    # 5. MODELO A4 04: Split Duo / Executive Duo (Victoria Wotton)
    # ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    elif layout == "compact_split":
        cv_body = f"""
        <div class="layout-compact_split">
            <div class="cv-duo-layout" style="display: grid; grid-template-columns: 210px 1fr; gap: 1.5rem; align-items: start;">
                <aside class="cv-duo-left cv-sidebar-stack" style="border-right: 1px solid rgba(125,125,125,0.25); padding-right: 1.25rem;">
                    {avatar_html}
                    {f'<div class="sidebar-section avoid-break"><h4 class="section-title" style="font-size: 0.85rem; margin-top: 0;">PERFIL</h4><p class="summary" style="font-size: 0.82rem; line-height: 1.5;">{html.escape(basics.get("summary", "")).replace(chr(10), "<br>")}</p></div>' if basics.get("summary") else ''}
                    {f'<div class="sidebar-section avoid-break"><h4 class="section-title" style="font-size: 0.85rem;">EXPERTISE</h4><div class="cv-skills-progress-list">{skills_bars_html}</div></div>' if skills else ''}
                    {f'<div class="sidebar-section avoid-break"><h4 class="section-title" style="font-size: 0.85rem;">HOBBIES</h4><div class="cv-hobbies-grid" style="display: flex; justify-content: space-around; width: 100%;">{hobbies_circles_html}</div></div>' if interests else ''}
                    {f'<div class="sidebar-section avoid-break"><h4 class="section-title" style="font-size: 0.85rem;">{t["languages"]}</h4><div class="cv-sidebar-stack">{lang_cards_html}</div></div>' if languages else ''}
                </aside>

                <main class="cv-duo-right">
                    <header class="cv-duo-header" style="display: flex; flex-direction: column; align-items: flex-start; border-bottom: 2px solid currentColor; padding-bottom: 0.85rem; margin-bottom: 1.25rem; width: 100%;">
                        <h1 class="name" style="font-size: 1.85rem; font-weight: 800; margin: 0 0 0.25rem 0;">{html.escape(basics.get("name", ""))}</h1>
                        <div class="label" style="font-size: 0.95rem; font-weight: 700; opacity: 0.9; margin-bottom: 0.5rem;">{html.escape(basics.get("label", ""))}</div>
                        <div class="contacts" style="display: flex; flex-wrap: wrap; gap: 0.45rem 0.85rem; font-size: 0.82rem; text-align: left; width: 100%; word-break: break-word; overflow-wrap: anywhere;">
                            {f'<span>✉ <a href="mailto:{html.escape(email_val)}" class="cv-link">{html.escape(email_val)}</a></span>' if email_val else ''}
                            {f'<span>📞 <a href="tel:{clean_phone}" class="cv-link">{html.escape(phone_val)}</a></span>' if phone_val else ''}
                            {f'<span>📍 {html.escape(loc_str)}</span>' if loc_str else ''}
                            {f'<span>🌐 <a href="{html.escape(url_val)}" target="_blank" class="cv-link">{html.escape(url_val)}</a></span>' if url_val else ''}
                            {f'<span>{profiles_html}</span>' if profiles_html else ''}
                        </div>
                    </header>

                    {f'<section class="avoid-break"><h2 class="section-title">{t["work"]}</h2>{work_items_html}</section>' if work else ''}
                    {f'<section class="avoid-break"><h2 class="section-title">{t["education"]}</h2><div class="cv-sidebar-stack" style="display: flex; flex-direction: column; gap: 0.65rem; width: 100%;">{education_items_html}</div></section>' if education else ''}
                    {f'<section class="avoid-break"><h2 class="section-title">{t["projects"]}</h2><div class="cv-sidebar-stack" style="display: flex; flex-direction: column; gap: 0.65rem; width: 100%;">{projects_items_html}</div></section>' if projects else ''}
                    {f'<section class="avoid-break"><h2 class="section-title">{t["certificates"]}</h2><div class="cv-sidebar-stack" style="display: flex; flex-direction: column; gap: 0.65rem; width: 100%;">{certificates_items_html}</div></section>' if certificates else ''}
                </main>
            </div>
        </div>
        """

    # ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    # 6. MODELO A4 03: Executive Sidebar
    # ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    elif layout == "sidebar":
        cv_body = f"""
        <div class="layout-sidebar">
            <div style="display: grid; grid-template-columns: 230px 1fr; gap: 1.5rem; align-items: start;">
                <aside class="cv-sidebar-stack" style="border-right: 1px solid rgba(125,125,125,0.2); padding-right: 1.25rem;">
                    {avatar_html}
                    <div>
                        <h2 class="name" style="font-size: 1.25rem; font-weight: 800; margin: 0 0 0.2rem 0;">{html.escape(basics.get("name", ""))}</h2>
                        <div class="label" style="font-size: 0.85rem; opacity: 0.85; font-weight: 600;">{html.escape(basics.get("label", ""))}</div>
                    </div>
                    <div class="contacts" style="font-size: 0.8rem; line-height: 1.45; text-align: left;">
                        {f'<div>✉ {html.escape(email_val)}</div>' if email_val else ''}
                        {f'<div>📞 {html.escape(phone_val)}</div>' if phone_val else ''}
                        {f'<div>📍 {html.escape(loc_str)}</div>' if loc_str else ''}
                        {f'<div>🌐 <a href="{html.escape(url_val)}" target="_blank" class="cv-link">{html.escape(url_val)}</a></div>' if url_val else ''}
                    </div>
                    {f'<div class="sidebar-section"><h4 class="section-title" style="font-size: 0.82rem; margin-top: 0.5rem;">{t["skills"]}</h4><div class="cv-sidebar-stack">{skills_items_html}</div></div>' if skills else ''}
                    {f'<div class="sidebar-section"><h4 class="section-title" style="font-size: 0.82rem; margin-top: 0.5rem;">{t["languages"]}</h4><div class="cv-sidebar-stack">{lang_cards_html}</div></div>' if languages else ''}
                    {f'<div class="sidebar-section"><h4 class="section-title" style="font-size: 0.82rem; margin-top: 0.5rem;">{t["certificates"]}</h4><div class="cv-sidebar-stack">{certificates_items_html}</div></div>' if certificates else ''}
                    {f'<div class="sidebar-section"><h4 class="section-title" style="font-size: 0.82rem; margin-top: 0.5rem;">{t["interests"]}</h4><div class="cv-sidebar-stack">{interest_items_html}</div></div>' if interests else ''}
                </aside>

                <main>
                    {f'<div class="summary">{html.escape(basics.get("summary", "")).replace(chr(10), "<br>")}</div>' if basics.get("summary") else ''}
                    {f'<section class="avoid-break"><h2 class="section-title">{t["work"]}</h2>{work_items_html}</section>' if work else ''}
                    {f'<section class="avoid-break"><h2 class="section-title">{t["projects"]}</h2><div class="cv-sidebar-stack" style="display: flex; flex-direction: column; gap: 0.65rem; width: 100%;">{projects_items_html}</div></section>' if projects else ''}
                    {f'<section class="avoid-break"><h2 class="section-title">{t["education"]}</h2><div class="cv-sidebar-stack" style="display: flex; flex-direction: column; gap: 0.65rem; width: 100%;">{education_items_html}</div></section>' if education else ''}
                </main>
            </div>
        </div>
        """

    # ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    # 6. MODELO A4 02: Linear ATS (Foto Retangular à Direita)
    # ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    elif layout == "linear":
        cv_body = f"""
        <div class="layout-linear">
            <header class="header layout-linear-header" style="display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid currentColor; padding-bottom: 0.85rem; margin-bottom: 1.25rem;">
              <div style="flex: 1; padding-right: 1.5rem;">
                <h1 class="name" style="font-size: 1.85rem; font-weight: 800; margin: 0 0 0.25rem 0;">{html.escape(basics.get("name", ""))}</h1>
                <div class="label" style="font-size: 0.95rem; font-weight: 700; opacity: 0.9; margin-bottom: 0.5rem;">{html.escape(basics.get("label", ""))}</div>
                <div class="contacts" style="display: flex; flex-wrap: wrap; gap: 0.85rem; font-size: 0.82rem; text-align: left;">
                  {f'<span>✉ <a href="mailto:{html.escape(email_val)}" class="cv-link">{html.escape(email_val)}</a></span>' if email_val else ''}
                  {f'<span>📞 <a href="tel:{clean_phone}" class="cv-link">{html.escape(phone_val)}</a></span>' if phone_val else ''}
                  {f'<span>📍 {html.escape(loc_str)}</span>' if loc_str else ''}
                  {f'<span>🌐 <a href="{html.escape(url_val)}" target="_blank" class="cv-link">{html.escape(url_val)}</a></span>' if url_val else ''}
                  {f'<span>{profiles_html}</span>' if profiles_html else ''}
                </div>
              </div>
              {avatar_rect_html}
            </header>

            {f'<div class="summary">{html.escape(basics.get("summary", "")).replace(chr(10), "<br>")}</div>' if basics.get("summary") else ''}

            {f'<section class="avoid-break"><h2 class="section-title">{t["work"]}</h2>{work_items_html}</section>' if work else ''}

            {f'<section class="avoid-break"><h2 class="section-title">{t["projects"]}</h2><div class="projects-grid cv-math-grid {get_grid_class(len(projects))}">{projects_items_html}</div></section>' if projects else ''}

            {f'<section class="avoid-break"><h2 class="section-title">{t["skills"]}</h2><div class="skills-grid cv-math-grid {get_grid_class(len(skills))}">{skills_items_html}</div></section>' if skills else ''}

            {f'<section class="avoid-break"><h2 class="section-title">{t["education"]}</h2><div class="education-grid cv-math-grid {get_grid_class(len(education))}">{education_items_html}</div></section>' if education else ''}

            {f'<section class="avoid-break"><h2 class="section-title">{t["certificates"]}</h2><div class="certs-grid cv-math-grid {get_grid_class(len(certificates))}">{certificates_items_html}</div></section>' if certificates else ''}

            {f'<section class="avoid-break"><h2 class="section-title">{t["publications"]}</h2>{publications_html}</section>' if publications else ''}

            {f'<section class="avoid-break"><h2 class="section-title">{t["languages"]}</h2><div class="languages-grid cv-math-grid {get_grid_class(len(languages))}">{lang_cards_html}</div></section>' if languages else ''}

            {f'<section class="avoid-break"><h2 class="section-title">{t["interests"]}</h2><div class="interests-grid cv-math-grid {get_grid_class(len(interests))}">{interest_items_html}</div></section>' if interests else ''}
        </div>
        """

    # ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    # 7. MODELO A4 01 (Modular) e 07 (Warm Magazine)
    # ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    else:
        cv_body = f"""
        <div class="layout-{layout}">
            <header class="header">
              <div class="cv-header-profile">
                {avatar_html}
                <div>
                  <h1 class="name">{html.escape(basics.get("name", ""))}</h1>
                  <div class="label">{html.escape(basics.get("label", ""))}</div>
                </div>
              </div>
              <div class="contacts">
                {f'<div>✉ <a href="mailto:{html.escape(email_val)}" class="cv-link">{html.escape(email_val)}</a></div>' if email_val else ''}
                {f'<div>📞 <a href="tel:{clean_phone}" class="cv-link">{html.escape(phone_val)}</a></div>' if phone_val else ''}
                {f'<div>📍 {html.escape(loc_str)}</div>' if loc_str else ''}
                {f'<div>🌐 <a href="{html.escape(url_val)}" target="_blank" class="cv-link">{html.escape(url_val)}</a></div>' if url_val else ''}
                {f'<div style="margin-top: 0.25rem;">{profiles_html}</div>' if profiles_html else ''}
              </div>
            </header>

            {f'<div class="summary">{html.escape(basics.get("summary", "")).replace(chr(10), "<br>")}</div>' if basics.get("summary") else ''}

            {f'<section class="avoid-break"><h2 class="section-title">{t["work"]}</h2>{work_items_html}</section>' if work else ''}

            {f'<section class="avoid-break"><h2 class="section-title">{t["projects"]}</h2><div class="projects-grid cv-math-grid {get_grid_class(len(projects))}">{projects_items_html}</div></section>' if projects else ''}

            {f'<section class="avoid-break"><h2 class="section-title">{t["skills"]}</h2><div class="skills-grid cv-math-grid {get_grid_class(len(skills))}">{skills_items_html}</div></section>' if skills else ''}

            {f'<section class="avoid-break"><h2 class="section-title">{t["education"]}</h2><div class="education-grid cv-math-grid {get_grid_class(len(education))}">{education_items_html}</div></section>' if education else ''}

            {f'<section class="avoid-break"><h2 class="section-title">{t["certificates"]}</h2><div class="certs-grid cv-math-grid {get_grid_class(len(certificates))}">{certificates_items_html}</div></section>' if certificates else ''}

            {f'<section class="avoid-break"><h2 class="section-title">{t["publications"]}</h2>{publications_html}</section>' if publications else ''}

            {f'<section class="avoid-break"><h2 class="section-title">{t["languages"]}</h2><div class="languages-grid cv-math-grid {get_grid_class(len(languages))}">{lang_cards_html}</div></section>' if languages else ''}

            {f'<section class="avoid-break"><h2 class="section-title">{t["interests"]}</h2><div class="interests-grid cv-math-grid {get_grid_class(len(interests))}">{interest_items_html}</div></section>' if interests else ''}
        </div>
        """

    if view_mode == "both":
        return f"""
        <div class="cv-dossier-wrapper">
          {cv_body}
          <div class="cv-page-break-indicator" style="page-break-before: always; margin: 2rem 0; text-align: center; border-top: 2px dashed rgba(125,125,125,0.4); padding-top: 1rem; color: #64748b; font-size: 0.8rem; font-family: monospace;">
            <span>✂ ─── Quebra de Página A4 (Dossiê de 2 Páginas) ───</span>
          </div>
          {_render_cover_letter_html(data, t)}
        </div>
        """

    return cv_body


def _render_cv_body_html(data: dict, t: dict) -> str:
    """Compatibilidade legada que delega para _render_cv_layout_html com modelo dynamic_math."""
    return _render_cv_layout_html(data, "dynamic_math", t, "cv")


def render_multi_cv_dashboard_html(
    archetypes: Dict[str, Any],
    default_persona: str = "professional",
    default_theme: str = "executive",
    default_layout: str = "dynamic_math",
    lang: str = "auto",
    view_mode: str = "cv",
    background_pattern: Optional[str] = None,
    design_config: Optional[dict] = None
) -> str:
    """
    Renderiza um Super Dashboard HTML Standalone contendo TODOS os 5 arquétipos gerados.
    Permite ao usuário alternar entre as 5 Personas, os 9 Modelos A4 de Layout, os 5 Temas Visuais
    e os 3 Modos de Visualização (Currículo / Cover Letter / Dossiê) em tempo real,
    com botões de Impressão PDF, upload de foto, download de YAML individual e exportação ZIP.
    """
    if isinstance(archetypes, str) or not isinstance(archetypes, dict):
        archetypes = {"professional": archetypes}

    parsed_archetypes = {}
    raw_yamls = {}

    for key, val in archetypes.items():
        if isinstance(val, str):
            raw_yamls[key] = val
            try:
                parsed_archetypes[key] = yaml.safe_load(val) or {}
            except Exception:
                parsed_archetypes[key] = {}
        elif isinstance(val, dict):
            parsed_archetypes[key] = val
            raw_yamls[key] = yaml.dump(val, sort_keys=False, allow_unicode=True)

    # Detect language
    sample_text = ""
    for v in raw_yamls.values():
        sample_text += v + " "

    if lang == "auto":
        if any(w in sample_text.lower() for w in ["developer", "software engineer", "intern", "experience", "education"]):
            if "desenvolvedor" in sample_text.lower() or "experiência" in sample_text.lower():
                selected_lang = "pt"
            else:
                selected_lang = "en"
        else:
            selected_lang = "pt"
    else:
        selected_lang = lang if lang in I18N else "pt"

    t = I18N[selected_lang]
    valid_theme = default_theme if default_theme in ["executive", "creative", "minimalist", "white", "terminal"] else "executive"
    valid_layout = default_layout if default_layout in LAYOUT_METADATA else "dynamic_math"

    # Resolução da textura de fundo
    resolved_bg = "none"
    if background_pattern:
        resolved_bg = TEXTURE_PRESETS.get(background_pattern, background_pattern)
    elif design_config and design_config.get("backgroundPattern"):
        bp = design_config.get("backgroundPattern")
        resolved_bg = TEXTURE_PRESETS.get(bp, bp)

    persona_order = ["professional", "architect", "historian", "didactic", "alien"]
    available_keys = [k for k in persona_order if k in parsed_archetypes] or list(parsed_archetypes.keys())
    active_persona = default_persona if default_persona in available_keys else available_keys[0]

    # Renderiza os painéis de cada persona
    panels_html = ""
    scripts_yaml_html = ""

    for p_key in available_keys:
        p_data = parsed_archetypes[p_key]
        p_raw = raw_yamls.get(p_key, "")
        p_body = _render_cv_layout_html(p_data, valid_layout, t, view_mode)
        is_active = (p_key == active_persona)

        panels_html += f"""
        <div id="cv-persona-{p_key}" class="cv-persona-panel {'active' if is_active else ''}" style="{'display:block;' if is_active else 'display:none;'}">
            {p_body}
        </div>
        """

        scripts_yaml_html += f"""
        <script id="raw-yaml-{p_key}" type="text/yaml">
{html.escape(p_raw)}
        </script>
        """

    # Opções do seletor de persona
    persona_options_html = ""
    for p_key in available_keys:
        meta = PERSONA_METADATA.get(p_key, {"label": p_key.capitalize(), "desc": ""})
        selected = "selected" if p_key == active_persona else ""
        persona_options_html += f'<option value="{p_key}" {selected}>{meta["label"]}</option>'

    # Opções do seletor de layout A4
    layout_options_html = ""
    for l_key, l_meta in LAYOUT_METADATA.items():
        selected = "selected" if l_key == valid_layout else ""
        layout_options_html += f'<option value="{l_key}" {selected}>{l_meta["label"]}</option>'

    first_data = parsed_archetypes.get(active_persona, {})
    candidate_name = first_data.get("basics", {}).get("name", "Currículo")
    active_basics = first_data.get("basics", {})
    initial_image = str(active_basics.get("image", "") or "")
    initial_pos_x = active_basics.get("imagePosX", 50)
    initial_pos_y = active_basics.get("imagePosY", 50)
    initial_scale = active_basics.get("imageScale", 1.0)
    try:
        initial_pos_x = int(initial_pos_x) if initial_pos_x is not None else 50
    except Exception:
        initial_pos_x = 50
    try:
        initial_pos_y = int(initial_pos_y) if initial_pos_y is not None else 50
    except Exception:
        initial_pos_y = 50
    try:
        initial_scale = float(initial_scale) if initial_scale is not None else 1.0
    except Exception:
        initial_scale = 1.0

    i18n_json_str = json.dumps(t, ensure_ascii=False)
    archetypes_json_str = json.dumps(parsed_archetypes, ensure_ascii=False)

    bg_css_val = f'url("{resolved_bg}")' if resolved_bg and resolved_bg != "none" else "none"

    html_content = f"""<!DOCTYPE html>
<html lang="{selected_lang}">
<head>
  <meta charset="UTF-8">
  <title>{html.escape(candidate_name)} — Central de Currículos Multi-Persona</title>
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <script src="https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js"></script>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Cinzel:wght@500;700;800;900&family=Courier+Prime:ital,wght@0,400;0,700;1,400&family=Fira+Code:wght@400;500;600;700&family=Inter:wght@300;400;500;600;700;800&family=Lora:ital,wght@0,400;0,600;0,700;1,400&family=Merriweather:ital,wght@0,300;0,400;0,700;0,900;1,400&family=Montserrat:wght@400;500;600;700;800&family=Open+Sans:ital,wght@0,300;0,400;0,600;0,700;1,400&family=Outfit:wght@400;500;600;700;800&family=Plus+Jakarta+Sans:ital,wght@0,400;0,500;0,600;0,700;0,800;1,400&family=Poppins:wght@300;400;500;600;700;800&family=Roboto:ital,wght@0,300;0,400;0,500;0,700;1,400&display=swap');

    :root {{
      --cv-font-heading: 'Plus Jakarta Sans', sans-serif;
      --cv-font-body: 'Inter', sans-serif;
      --cv-font-scale: 1.0;
      --cv-color-primary: #0284c7;
      --cv-color-secondary: #0369a1;
      --cv-color-text: #0f172a;
      --cv-color-text-muted: #64748b;
      --cv-color-bg: #ffffff;
      --cv-color-surface: #f8fafc;
      --cv-color-border: #e2e8f0;
      --cv-color-accent: #f97316;
      --cv-avatar-pos-x: {initial_pos_x}%;
      --cv-avatar-pos-y: {initial_pos_y}%;
      --cv-avatar-scale: {initial_scale};
      --cv-bg-image: {bg_css_val};
    }}

    * {{ box-sizing: border-box; margin: 0; padding: 0; }}

    body {{
      background: #0b0f19;
      color: #1e293b;
      line-height: 1.55;
      font-size: 10pt;
      padding: 4.2rem 1rem 2rem 1rem;
      transition: background 0.2s ease;
    }}

    /* ── Floating Toolbar ── */
    .toolbar {{
      position: fixed;
      top: 0.75rem;
      left: 50%;
      transform: translateX(-50%);
      display: flex;
      flex-wrap: wrap;
      gap: 0.45rem;
      z-index: 999;
      background: rgba(15, 23, 42, 0.94);
      padding: 0.45rem 0.85rem;
      border-radius: 9999px;
      backdrop-filter: blur(14px);
      box-shadow: 0 10px 30px rgba(0,0,0,0.4);
      border: 1px solid rgba(255,255,255,0.12);
      align-items: center;
      max-width: 96vw;
    }}

    .toolbar-group {{
      display: flex;
      align-items: center;
      gap: 0.35rem;
    }}

    .toolbar select {{
      background: #1e293b;
      color: #f8fafc;
      border: 1px solid #475569;
      padding: 0.4rem 0.75rem;
      border-radius: 9999px;
      font-size: 0.82rem;
      font-weight: 600;
      cursor: pointer;
      outline: none;
      transition: all 0.2s;
    }}
    .toolbar select:hover {{
      border-color: #38bdf8;
    }}

    .toolbar button {{
      background: #0284c7;
      color: #fff;
      border: none;
      padding: 0.4rem 0.85rem;
      border-radius: 9999px;
      font-size: 0.8rem;
      font-weight: 600;
      cursor: pointer;
      display: flex;
      align-items: center;
      gap: 0.3rem;
      white-space: nowrap;
      transition: all 0.2s ease;
    }}
    .toolbar button:hover {{ background: #0369a1; transform: translateY(-1px); }}

    .toolbar button.btn-sec {{
      background: #334155;
    }}
    .toolbar button.btn-sec:hover {{
      background: #475569;
    }}

    .toolbar button.btn-accent {{
      background: #059669;
    }}
    .toolbar button.btn-accent:hover {{
      background: #047857;
    }}

    /* ── Base Container ── */
    .container {{
      max-width: 880px;
      margin: 0 auto;
      background-color: var(--cv-color-bg, #ffffff);
      background-image: var(--cv-bg-image, none);
      background-size: cover;
      background-position: center;
      padding: 2.5rem 3rem;
      border-radius: 12px;
      box-shadow: 0 12px 40px rgba(0,0,0,0.2);
      transition: all 0.2s ease;
      min-height: 297mm;
      font-family: var(--cv-font-body, 'Inter', sans-serif);
      color: var(--cv-color-text, #0f172a);
    }}

    /* ── Avatar Profile & Photo Styling ── */
    .cv-header-profile {{
      display: flex;
      align-items: center;
      gap: 1.25rem;
    }}

    .cv-avatar-container {{
      position: relative;
      width: 78px;
      height: 78px;
      flex-shrink: 0;
      border-radius: 50%;
      overflow: hidden;
      border: 2.5px solid currentColor;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      background: #f1f5f9;
      transition: transform 0.2s ease, box-shadow 0.2s ease;
    }}
    .cv-avatar-container:hover {{
      transform: scale(1.06);
      box-shadow: 0 6px 18px rgba(0,0,0,0.18);
    }}
    .cv-avatar-img {{
      width: 100%;
      height: 100%;
      object-fit: cover;
      object-position: var(--cv-avatar-pos-x, 50%) var(--cv-avatar-pos-y, 50%);
      transform: scale(var(--cv-avatar-scale, 1.0));
      transform-origin: var(--cv-avatar-pos-x, 50%) var(--cv-avatar-pos-y, 50%);
      transition: transform 0.1s ease-out;
    }}
    .cv-avatar-placeholder {{
      width: 100%;
      height: 100%;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      font-size: 0.65rem;
      color: #64748b;
      background: rgba(0, 0, 0, 0.04);
      text-align: center;
      padding: 0.2rem;
      user-select: none;
    }}
    .cv-avatar-placeholder .avatar-icon {{
      font-size: 1.4rem;
      line-height: 1;
      margin-bottom: 0.15rem;
    }}

    /* Modal Backdrop & Dialog */
    .cv-modal-backdrop {{
      display: none;
      position: fixed;
      inset: 0;
      background: rgba(0, 0, 0, 0.75);
      z-index: 9999;
      align-items: center;
      justify-content: center;
      backdrop-filter: blur(6px);
    }}
    .cv-modal-backdrop.active {{
      display: flex;
    }}
    .cv-modal-card {{
      background: #0f172a;
      color: #f8fafc;
      border: 1px solid #334155;
      border-radius: 12px;
      width: 90%;
      max-width: 440px;
      padding: 1.5rem;
      box-shadow: 0 20px 50px rgba(0, 0, 0, 0.6);
      display: flex;
      flex-direction: column;
      gap: 1.25rem;
    }}
    .cv-modal-header {{
      display: flex;
      justify-content: space-between;
      align-items: center;
      border-bottom: 1px solid #334155;
      padding-bottom: 0.75rem;
    }}
    .cv-modal-header h3 {{
      margin: 0;
      font-size: 1.1rem;
      font-weight: 700;
      color: #38bdf8;
    }}
    .cv-modal-close {{
      background: transparent;
      border: none;
      color: #94a3b8;
      font-size: 1.2rem;
      cursor: pointer;
      padding: 0.2rem;
      line-height: 1;
    }}
    .cv-modal-close:hover {{
      color: #f8fafc;
    }}
    .cv-modal-body {{
      display: flex;
      flex-direction: column;
      gap: 1rem;
    }}
    .cv-modal-footer {{
      display: flex;
      justify-content: flex-end;
      gap: 0.5rem;
      border-top: 1px solid #334155;
      padding-top: 0.75rem;
    }}
    .modal-input {{
      width: 100%;
      background: #1e293b;
      border: 1px solid #475569;
      color: #f8fafc;
      padding: 0.5rem 0.75rem;
      border-radius: 6px;
      font-size: 0.85rem;
      outline: none;
      box-sizing: border-box;
    }}
    .modal-input:focus {{
      border-color: #38bdf8;
    }}
    .modal-btn {{
      padding: 0.45rem 0.9rem;
      border-radius: 6px;
      font-size: 0.82rem;
      font-weight: 600;
      cursor: pointer;
      border: none;
    }}
    .modal-btn-pri {{
      background: #0284c7;
      color: #fff;
    }}
    .modal-btn-pri:hover {{
      background: #0369a1;
    }}
    .modal-btn-sec {{
      background: #334155;
      color: #e2e8f0;
    }}
    .modal-btn-sec:hover {{
      background: #475569;
    }}

    /* ── Typography & General Structure ── */
    .header {{
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      padding-bottom: 1.25rem;
      margin-bottom: 1.25rem;
      gap: 1.5rem;
    }}
    .name {{
      font-family: var(--cv-font-heading, 'Plus Jakarta Sans', sans-serif) !important;
      color: var(--cv-color-primary, #0284c7) !important;
      font-size: calc(1.85rem * var(--cv-font-scale, 1.0)) !important;
      font-weight: 800;
      line-height: 1.15;
      margin-bottom: 0.25rem;
    }}
    .label {{
      font-family: var(--cv-font-body, 'Inter', sans-serif) !important;
      color: var(--cv-color-secondary, #0369a1) !important;
      font-size: calc(0.95rem * var(--cv-font-scale, 1.0)) !important;
      font-weight: 600;
      line-height: 1.35;
    }}
    .contacts {{
      font-size: calc(0.8rem * var(--cv-font-scale, 1.0)) !important;
      line-height: 1.5;
      text-align: right;
      flex-shrink: 0;
    }}
    .summary {{
      font-family: var(--cv-font-body, 'Inter', sans-serif) !important;
      color: var(--cv-color-text, #0f172a) !important;
      font-size: calc(0.86rem * var(--cv-font-scale, 1.0)) !important;
      line-height: calc(1.55 * var(--cv-font-scale, 1.0)) !important;
      text-align: justify;
      margin-bottom: 1.25rem;
    }}

    .section-title, .cv-math-section-title {{
      font-family: var(--cv-font-heading, 'Plus Jakarta Sans', sans-serif) !important;
      color: var(--cv-color-primary, #0284c7) !important;
      font-size: calc(0.98rem * var(--cv-font-scale, 1.0)) !important;
      font-weight: 800;
      letter-spacing: 0.04em;
      text-transform: uppercase;
      padding-bottom: 0.35rem;
      margin-top: 1.25rem;
      margin-bottom: 0.85rem;
      display: flex;
      align-items: center;
      gap: 0.4rem;
      border-bottom: 1.5px solid var(--cv-color-border, #e2e8f0);
    }}

    .item {{
      margin-bottom: 1rem;
    }}
    .item-header {{
      display: flex;
      justify-content: space-between;
      align-items: baseline;
      gap: 0.75rem;
    }}
    .item-title {{
      font-family: var(--cv-font-heading, 'Plus Jakarta Sans', sans-serif) !important;
      color: var(--cv-color-text, #0f172a) !important;
      font-size: calc(0.92rem * var(--cv-font-scale, 1.0)) !important;
      font-weight: 700;
    }}
    .item-date {{
      font-size: calc(0.78rem * var(--cv-font-scale, 1.0)) !important;
      color: var(--cv-color-text-muted, #64748b) !important;
      white-space: nowrap;
      flex-shrink: 0;
    }}
    .item-sub {{
      color: var(--cv-color-secondary, #0369a1) !important;
      font-size: calc(0.84rem * var(--cv-font-scale, 1.0)) !important;
      font-weight: 600;
      margin-bottom: 0.3rem;
    }}
    .item-desc {{
      font-family: var(--cv-font-body, 'Inter', sans-serif) !important;
      color: var(--cv-color-text, #0f172a) !important;
      font-size: calc(0.84rem * var(--cv-font-scale, 1.0)) !important;
      line-height: calc(1.5 * var(--cv-font-scale, 1.0)) !important;
      margin-bottom: 0.35rem;
      text-align: justify;
    }}
    .bullets {{
      margin: 0.25rem 0 0.4rem 1.2rem;
      padding: 0;
      font-size: 0.82rem;
      line-height: 1.45;
    }}
    .bullets li {{
      margin-bottom: 0.25rem;
    }}

    /* ── Mathematical Dynamic Grid System (Apenas para áreas amplas) ── */
    .projects-grid, .skills-grid, .education-grid, .certs-grid, .languages-grid, .interests-grid, .cv-math-grid {{
      display: grid;
      gap: 0.75rem;
      width: 100%;
      box-sizing: border-box;
    }}

    .cv-grid-1 {{ grid-template-columns: 1fr !important; }}
    .cv-grid-2 {{ grid-template-columns: repeat(2, minmax(0, 1fr)) !important; }}
    .cv-grid-3 {{ grid-template-columns: repeat(3, minmax(0, 1fr)) !important; }}
    .cv-grid-4 {{ grid-template-columns: repeat(2, minmax(0, 1fr)) !important; }}
    .cv-grid-5 {{
      display: grid !important;
      grid-template-columns: repeat(6, minmax(0, 1fr)) !important;
    }}
    .cv-grid-5 > *:nth-child(1), .cv-grid-5 > *:nth-child(2), .cv-grid-5 > *:nth-child(3) {{
      grid-column: span 2 !important;
    }}
    .cv-grid-5 > *:nth-child(4), .cv-grid-5 > *:nth-child(5) {{
      grid-column: span 3 !important;
    }}

    .cv-grid-split-3-2 {{
      display: grid !important;
      grid-template-columns: repeat(6, minmax(0, 1fr)) !important;
    }}
    .cv-grid-split-3-2 > * {{
      grid-column: span 2 !important;
    }}
    .cv-grid-split-3-2 > *:nth-last-child(1),
    .cv-grid-split-3-2 > *:nth-last-child(2) {{
      grid-column: span 3 !important;
    }}

    /* ── Sidebar Vertical Stack (Para colunas estreitas verticais) ── */
    .cv-sidebar-stack {{
      display: flex !important;
      flex-direction: column !important;
      gap: 0.65rem !important;
      width: 100% !important;
      min-width: 0 !important;
    }}
    .cv-sidebar-stack > * {{
      width: 100% !important;
      box-sizing: border-box !important;
    }}

    /* ── Cards & Tags ── */
    .project-card, .skill-group, .geo-card, .interest-card, .lang-card,
    .cv-math-project-card, .cv-math-skill-card, .cv-math-edu-card, .cv-math-cert-card, .cv-math-interest-card {{
      padding: 0.85rem;
      border-radius: 6px;
      box-sizing: border-box;
      display: flex;
      flex-direction: column;
      gap: 0.35rem;
      width: 100%;
    }}

    .tags, .cv-math-tags {{
      display: flex;
      flex-wrap: wrap;
      gap: 0.35rem;
      margin-top: 0.35rem;
    }}

    .badge {{
      display: inline-block;
      padding: 0.15rem 0.45rem;
      border-radius: 4px;
      font-size: 0.72rem;
      font-weight: 600;
      white-space: normal;
      word-break: break-word;
      max-width: 100%;
    }}

    .avoid-break {{
      break-inside: avoid !important;
      page-break-inside: avoid !important;
    }}

    a, .cv-link {{
      text-decoration: none;
      font-weight: 500;
      word-break: break-word;
      overflow-wrap: anywhere;
    }}
    a:hover, .cv-link:hover {{ text-decoration: underline; }}

    /* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
       ■  TEMAS VISUAIS (Executive, Creative, Minimalist, White, Terminal)
       ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
    .theme-executive {{
      font-family: 'Merriweather', Georgia, serif;
      color: #1a1a1a;
      background: #ffffff;
    }}
    .theme-executive .header {{ border-bottom: 2px solid #111827; }}
    .theme-executive .name {{ color: #050505; }}
    .theme-executive .label {{ color: #374151; }}
    .theme-executive .section-title, .theme-executive .cv-math-section-title {{ color: #111827; border-bottom: 1.5px solid #374151; }}
    .theme-executive .item-title {{ color: #111827; }}
    .theme-executive .item-sub {{ color: #1f2937; }}
    .theme-executive a, .theme-executive .cv-link {{ color: #1f2937; text-decoration: underline; }}
    .theme-executive .project-card, .theme-executive .skill-group, .theme-executive .geo-card,
    .theme-executive .interest-card, .theme-executive .lang-card,
    .theme-executive .cv-math-project-card, .theme-executive .cv-math-skill-card,
    .theme-executive .cv-math-edu-card, .theme-executive .cv-math-cert-card,
    .theme-executive .cv-math-interest-card {{
      background: #ffffff;
      border: 1px solid #d1d5db;
      border-left: 3.5px solid #111827;
      border-radius: 0;
    }}
    .theme-executive .badge, .theme-executive .issuer-pill {{
      background: transparent;
      color: #374151;
      border: 1px solid #9ca3af;
      border-radius: 0;
      font-family: 'Courier Prime', monospace;
    }}

    .theme-creative {{
      font-family: 'Poppins', 'Segoe UI', sans-serif;
      color: #1e293b;
      background: #ffffff;
    }}
    .theme-creative .header {{ border-bottom: 3px solid #2563eb; }}
    .theme-creative .name {{ color: #1e3a8a; font-weight: 800; }}
    .theme-creative .label {{ color: #f97316; font-weight: 600; }}
    .theme-creative .section-title, .theme-creative .cv-math-section-title {{ color: #1e3a8a; border-bottom: 2px solid #bfdbfe; }}
    .theme-creative .item-title {{ color: #1e1b4b; }}
    .theme-creative .item-sub {{ color: #2563eb; }}
    .theme-creative a, .theme-creative .cv-link {{ color: #2563eb; }}
    .theme-creative .project-card, .theme-creative .cv-math-project-card {{
      background: #eff6ff;
      border: 1px solid #bfdbfe;
      border-left: 3.5px solid #2563eb;
      border-radius: 8px;
    }}
    .theme-creative .skill-group, .theme-creative .geo-card, .theme-creative .lang-card,
    .theme-creative .cv-math-skill-card, .theme-creative .cv-math-edu-card, .theme-creative .cv-math-cert-card {{
      background: #eff6ff;
      border: 1px solid #bfdbfe;
      border-left: 3.5px solid #2563eb;
      border-radius: 8px;
    }}
    .theme-creative .interest-card, .theme-creative .cv-math-interest-card {{
      background: #faf5ff;
      border: 1px solid #e9d5ff;
      border-left: 3.5px solid #9333ea;
      border-radius: 8px;
    }}
    .theme-creative .badge {{
      background: #dbeafe;
      color: #1e3a8a;
      border: 1px solid #bfdbfe;
      border-radius: 4px;
    }}
    .theme-creative .issuer-pill {{
      background: #ffedd5;
      color: #c2410c;
      border: 1px solid #fed7aa;
      border-radius: 4px;
    }}

    .theme-minimalist {{
      font-family: 'Inter', system-ui, sans-serif;
      color: #0f172a;
      background: #ffffff;
    }}
    .theme-minimalist .header {{ border-bottom: 1px solid #e2e8f0; }}
    .theme-minimalist .name {{ color: #0f172a; font-weight: 800; letter-spacing: -0.04em; }}
    .theme-minimalist .label {{ color: #64748b; font-weight: 500; }}
    .theme-minimalist .section-title, .theme-minimalist .cv-math-section-title {{ color: #475569; border-bottom: 1px solid #e2e8f0; letter-spacing: 0.1em; }}
    .theme-minimalist .item-title {{ color: #0f172a; }}
    .theme-minimalist .item-sub {{ color: #334155; }}
    .theme-minimalist a, .theme-minimalist .cv-link {{ color: #475569; }}
    .theme-minimalist .project-card, .theme-minimalist .skill-group, .theme-minimalist .geo-card,
    .theme-minimalist .interest-card, .theme-minimalist .lang-card,
    .theme-minimalist .cv-math-project-card, .theme-minimalist .cv-math-skill-card,
    .theme-minimalist .cv-math-edu-card, .theme-minimalist .cv-math-cert-card,
    .theme-minimalist .cv-math-interest-card {{
      background: #ffffff;
      border: 1px solid #e2e8f0;
      border-left: 3.5px solid #0f172a;
      border-radius: 6px;
    }}
    .theme-minimalist .badge, .theme-minimalist .issuer-pill {{
      background: #f1f5f9;
      color: #334155;
      border: 1px solid #e2e8f0;
      border-radius: 4px;
    }}

    .theme-white {{
      font-family: 'Inter', system-ui, sans-serif;
      color: #000000;
      background: #ffffff;
    }}
    .theme-white .header {{ border-bottom: 1.5px solid #000000; }}
    .theme-white .name {{ color: #000000; font-weight: 800; }}
    .theme-white .label {{ color: #404040; }}
    .theme-white .section-title, .theme-white .cv-math-section-title {{ color: #000000; border-bottom: 1px solid #000000; }}
    .theme-white .item-title {{ color: #000000; }}
    .theme-white .item-sub {{ color: #262626; }}
    .theme-white a, .theme-white .cv-link {{ color: #000000; }}
    .theme-white .project-card, .theme-white .skill-group, .theme-white .geo-card,
    .theme-white .interest-card, .theme-white .lang-card,
    .theme-white .cv-math-project-card, .theme-white .cv-math-skill-card,
    .theme-white .cv-math-edu-card, .theme-white .cv-math-cert-card,
    .theme-white .cv-math-interest-card {{
      background: #ffffff;
      border: 1px solid #d4d4d4;
      border-left: 3.5px solid #000000;
      border-radius: 0;
    }}
    .theme-white .badge, .theme-white .issuer-pill {{
      background: transparent;
      color: #000000;
      border: 1px solid #a3a3a3;
      border-radius: 0;
    }}

    .theme-terminal {{
      font-family: 'Courier Prime', monospace;
      color: #22c55e;
      background: #020617;
    }}
    .theme-terminal .header {{ border-bottom: 2px solid #22c55e; }}
    .theme-terminal .name {{ color: #4ade80; font-weight: 700; }}
    .theme-terminal .label {{ color: #86efac; }}
    .theme-terminal .section-title, .theme-terminal .cv-math-section-title {{ color: #4ade80; border-bottom: 1px dashed #22c55e; }}
    .theme-terminal .item-title {{ color: #4ade80; }}
    .theme-terminal .item-sub {{ color: #86efac; }}
    .theme-terminal a, .theme-terminal .cv-link {{ color: #22c55e; }}
    .theme-terminal .project-card, .theme-terminal .skill-group, .theme-terminal .geo-card,
    .theme-terminal .interest-card, .theme-terminal .lang-card,
    .theme-terminal .cv-math-project-card, .theme-terminal .cv-math-skill-card,
    .theme-terminal .cv-math-edu-card, .theme-terminal .cv-math-cert-card,
    .theme-terminal .cv-math-interest-card {{
      background: #090d16;
      border: 1px solid #1e3a29;
      border-left: 3.5px solid #22c55e;
      border-radius: 4px;
    }}
    .theme-terminal .badge, .theme-terminal .issuer-pill {{
      background: #052e16;
      color: #4ade80;
      border: 1px solid #22c55e;
      border-radius: 2px;
    }}

    /* ── Layout Specific CSS Rules ── */
    .layout-dynamic_math {{
      display: flex;
      flex-direction: column;
      gap: 1.2rem;
    }}
    .cv-math-header {{
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      gap: 1.5rem;
      border-bottom: 2px solid rgba(125, 125, 125, 0.25);
      padding-bottom: 1.25rem;
    }}
    .cv-math-header-profile {{
      display: flex;
      align-items: center;
      gap: 1.25rem;
    }}
    .cv-math-name {{
      font-size: 1.75rem;
      font-weight: 800;
      margin: 0 0 0.25rem 0;
      line-height: 1.15;
    }}
    .cv-math-label {{
      font-size: 0.92rem;
      font-weight: 600;
      opacity: 0.9;
      line-height: 1.35;
    }}
    .cv-math-contacts {{
      font-size: 0.8rem;
      line-height: 1.5;
      text-align: right;
      display: flex;
      flex-direction: column;
      gap: 0.2rem;
      flex-shrink: 0;
    }}
    .cv-math-summary {{
      font-size: 0.88rem;
      line-height: 1.6;
      text-align: justify;
    }}
    .cv-math-section-title {{
      font-size: 0.95rem;
      font-weight: 800;
      letter-spacing: 0.04em;
      text-transform: uppercase;
      border-bottom: 1.5px solid currentColor;
      padding-bottom: 0.35rem;
      margin-bottom: 0.85rem;
      display: flex;
      align-items: center;
      gap: 0.4rem;
    }}

    /* ── Avatar Retangular (Modelo 02 Linear & Modelo 08 Hero Matrix) ── */
    .cv-avatar-container.cv-avatar-rect {{
      width: 85px !important;
      height: 95px !important;
      border-radius: 8px !important;
      overflow: hidden !important;
      border: 2px solid currentColor !important;
      flex-shrink: 0 !important;
    }}
    .cv-avatar-container.cv-avatar-rect .cv-avatar-img {{
      width: 100% !important;
      height: 100% !important;
      object-fit: cover !important;
      border-radius: 6px !important;
    }}

    /* ── Regras de Contenção de Sidebars ── */
    aside,
    .cv-sidebar-stack,
    .cv-navy-sidebar,
    .cv-editorial-left,
    .cv-duo-left,
    .cv-sidebar-col,
    .layout-corporate_timeline aside,
    .layout-editorial_accent aside,
    .layout-sidebar aside,
    .layout-compact_split aside {{
      min-width: 0 !important;
      max-width: 100% !important;
      box-sizing: border-box !important;
      display: flex !important;
      flex-direction: column !important;
      gap: 0.65rem !important;
    }}

    aside .languages-grid,
    aside .interests-grid,
    aside .certs-grid,
    aside .skills-grid,
    aside .education-grid,
    aside .projects-grid,
    aside .cv-math-grid,
    .cv-sidebar-stack .languages-grid,
    .cv-sidebar-stack .interests-grid,
    .cv-sidebar-stack .certs-grid,
    .cv-sidebar-stack .skills-grid,
    .cv-sidebar-stack .education-grid,
    .cv-sidebar-stack .projects-grid,
    .cv-sidebar-stack .cv-math-grid {{
      display: flex !important;
      flex-direction: column !important;
      grid-template-columns: 1fr !important;
      width: 100% !important;
      max-width: 100% !important;
      gap: 0.45rem !important;
    }}

    aside .lang-card,
    .cv-sidebar-stack .lang-card {{
      width: 100% !important;
      max-width: 100% !important;
      box-sizing: border-box !important;
      display: flex !important;
      flex-direction: row !important;
      justify-content: space-between !important;
      align-items: center !important;
      padding: 0.35rem 0.6rem !important;
    }}

    aside .interest-card,
    .cv-sidebar-stack .interest-card {{
      width: 100% !important;
      max-width: 100% !important;
      box-sizing: border-box !important;
      display: flex !important;
      flex-direction: column !important;
      padding: 0.45rem 0.6rem !important;
    }}

    /* ── Contenção e Layout Compact Split (Modelo A4 04) ── */
    .layout-compact_split .cv-duo-layout {{
      display: grid !important;
      grid-template-columns: 210px 1fr !important;
      gap: 1.5rem !important;
      align-items: start !important;
      width: 100% !important;
      max-width: 100% !important;
      box-sizing: border-box !important;
    }}
    .layout-compact_split .cv-duo-right {{
      min-width: 0 !important;
      max-width: 100% !important;
      box-sizing: border-box !important;
    }}
    .layout-compact_split .cv-duo-header,
    .layout-compact_split .header {{
      display: flex !important;
      flex-direction: column !important;
      align-items: flex-start !important;
      justify-content: flex-start !important;
      width: 100% !important;
      max-width: 100% !important;
      border-bottom: 2px solid currentColor !important;
      padding-bottom: 0.85rem !important;
      margin-bottom: 1.25rem !important;
      box-sizing: border-box !important;
    }}
    .layout-compact_split .cv-duo-header .name,
    .layout-compact_split .header .name {{
      width: 100% !important;
      margin: 0 0 0.25rem 0 !important;
    }}
    .layout-compact_split .cv-duo-header .label,
    .layout-compact_split .header .label {{
      width: 100% !important;
      margin-bottom: 0.5rem !important;
    }}
    .layout-compact_split .cv-duo-header .contacts,
    .layout-compact_split .header .contacts,
    .layout-compact_split .contacts,
    .cv-duo-right .contacts {{
      display: flex !important;
      flex-direction: row !important;
      flex-wrap: wrap !important;
      gap: 0.45rem 0.85rem !important;
      width: 100% !important;
      max-width: 100% !important;
      box-sizing: border-box !important;
      word-break: break-word !important;
      overflow-wrap: anywhere !important;
      text-align: left !important;
    }}
    .layout-compact_split .contacts span,
    .layout-compact_split .contacts a,
    .cv-duo-right .contacts span,
    .cv-duo-right .contacts a {{
      word-break: break-word !important;
      overflow-wrap: anywhere !important;
      max-width: 100% !important;
      display: inline-flex !important;
      align-items: center !important;
      gap: 0.25rem !important;
    }}

    /* ── Canvas Livre (Interactive Block Builder) ── */
    .cv-canvas-workspace {{
      display: grid;
      grid-template-columns: 280px 1fr;
      gap: 1.5rem;
      width: 100%;
      min-height: calc(100vh - 120px);
      box-sizing: border-box;
      align-items: start;
    }}
    @media (max-width: 1100px) {{
      .cv-canvas-workspace {{
        grid-template-columns: 1fr;
      }}
    }}
    .cv-canvas-palette {{
      background: #090d16;
      border: 1px solid #1e293b;
      border-radius: 12px;
      display: flex;
      flex-direction: column;
      box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.4);
      position: sticky;
      top: 5.5rem;
      height: calc(100vh - 160px);
      max-height: calc(100vh - 160px);
      min-height: 380px;
      overflow: hidden;
      z-index: 20;
    }}
    .cv-canvas-palette__header {{
      display: flex;
      justify-content: space-between;
      align-items: center;
      border-bottom: 1px solid #1e293b;
      padding: 1rem 1.15rem;
      background: #090d16;
      flex-shrink: 0;
    }}
    .cv-canvas-palette__body {{
      flex: 1;
      overflow-y: auto !important;
      overflow-x: hidden;
      padding: 1rem 1.15rem 2.5rem 1.15rem;
      display: flex;
      flex-direction: column;
      gap: 1.15rem;
      overscroll-behavior: contain;
      scrollbar-width: thin;
      scrollbar-color: #38bdf8 #0f172a;
    }}
    .cv-canvas-palette__body::-webkit-scrollbar {{
      width: 6px;
    }}
    .cv-canvas-palette__body::-webkit-scrollbar-track {{
      background: #0f172a;
      border-radius: 4px;
    }}
    .cv-canvas-palette__body::-webkit-scrollbar-thumb {{
      background: #38bdf8;
      border-radius: 4px;
    }}
    .cv-canvas-palette__body::-webkit-scrollbar-thumb:hover {{
      background: #0284c7;
    }}
    .cv-canvas-palette__title {{
      font-size: 0.95rem;
      font-weight: 700;
      color: #f8fafc;
      display: flex;
      align-items: center;
      gap: 0.5rem;
      margin: 0;
    }}
    .cv-canvas-palette__presets {{
      display: flex;
      flex-direction: column;
      gap: 0.45rem;
      background: #0f172a;
      padding: 0.75rem;
      border-radius: 8px;
      border: 1px solid #1e293b;
    }}
    .cv-canvas-preset-btn {{
      display: flex;
      align-items: center;
      justify-content: space-between;
      background: #1e293b;
      border: 1px solid #334155;
      color: #e2e8f0;
      padding: 0.45rem 0.65rem;
      border-radius: 6px;
      font-size: 0.78rem;
      font-weight: 600;
      cursor: pointer;
      text-align: left;
    }}
    .cv-canvas-preset-btn:hover {{
      background: #0284c7;
      border-color: #38bdf8;
      color: #fff;
    }}
    .cv-canvas-palette__section {{
      display: flex;
      flex-direction: column;
      gap: 0.45rem;
    }}
    .cv-canvas-palette__sec-title {{
      font-size: 0.72rem;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      color: #64748b;
      font-weight: 700;
      margin: 0.25rem 0 0.15rem 0;
    }}
    .cv-canvas-item-btn {{
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 0.6rem;
      background: #0b1120;
      border: 1px solid #1e293b;
      color: #cbd5e1;
      padding: 0.55rem 0.75rem;
      border-radius: 8px;
      font-size: 0.8rem;
      font-weight: 600;
      cursor: pointer;
      text-align: left;
    }}
    .cv-canvas-item-btn:hover {{
      background: #1e293b;
      border-color: #10b981;
      color: #fff;
    }}
    .cv-canvas-center-stage {{
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 1rem;
      width: 100%;
    }}
    .cv-canvas-sheet-info-bar {{
      display: flex;
      justify-content: space-between;
      align-items: center;
      width: 100%;
      max-width: 820px;
      background: #090d16;
      border: 1px solid #1e293b;
      padding: 0.5rem 1rem;
      border-radius: 8px;
      font-size: 0.8rem;
      color: #94a3b8;
    }}
    .cv-canvas-sheet-wrapper {{
      position: relative;
      display: flex;
      justify-content: center;
      width: 100%;
    }}
    .cv-canvas-sheet {{
      width: 100%;
      max-width: 820px;
      min-height: 1160px;
      background-color: var(--cv-color-bg, #ffffff);
      background-image: var(--cv-bg-image, none);
      background-size: cover;
      background-position: center;
      font-family: var(--cv-font-body, 'Inter', sans-serif);
      color: var(--cv-color-text, #0f172a);
      box-shadow: 0 15px 35px -5px rgba(0, 0, 0, 0.5), 0 0 0 1px rgba(0, 0, 0, 0.08);
      border-radius: 4px;
      padding: 2.2rem 2.2rem;
      box-sizing: border-box;
      position: relative;
      display: grid;
      grid-template-columns: repeat(12, 1fr);
      gap: 1.25rem 1.25rem;
      align-content: start;
    }}
    .cv-canvas-block {{
      position: relative;
      border-radius: 6px;
      transition: all 0.2s ease;
      min-width: 0;
      box-sizing: border-box;
    }}
    .cv-canvas-block:hover {{
      outline: 2px dashed rgba(56, 189, 248, 0.6);
      outline-offset: 4px;
    }}
    .cv-canvas-block__actions {{
      position: absolute;
      top: -16px;
      right: 8px;
      display: none;
      align-items: center;
      gap: 4px;
      background: #0f172a;
      border: 1px solid #38bdf8;
      border-radius: 6px;
      padding: 3px 6px;
      z-index: 100;
      box-shadow: 0 4px 12px rgba(0,0,0,0.5);
    }}
    .cv-canvas-block:hover .cv-canvas-block__actions {{
      display: flex;
    }}
    .cv-canvas-act-btn {{
      background: #1e293b;
      color: #f8fafc;
      border: 1px solid #334155;
      border-radius: 4px;
      padding: 2px 6px;
      font-size: 0.72rem;
      font-weight: 700;
      cursor: pointer;
    }}
    .cv-canvas-act-btn:hover {{
      background: #0284c7;
      color: #fff;
    }}
    .cv-canvas-act-btn--danger:hover {{
      background: #ef4444;
      border-color: #f87171;
    }}
    /* Col Spans */
    .cv-col-12 {{ grid-column: span 12 / span 12; }}
    .cv-col-8 {{ grid-column: span 8 / span 12; }}
    .cv-col-6 {{ grid-column: span 6 / span 12; }}
    .cv-col-4 {{ grid-column: span 4 / span 12; }}
    .cv-col-3 {{ grid-column: span 3 / span 12; }}

    /* ── Print Media Optimization (Strict CSS Paged Media) ── */
    @media print {{
      body {{
        background: #ffffff !important;
        color: #000000 !important;
        padding: 0 !important;
        margin: 0 !important;
        font-size: 9.5pt !important;
      }}
      .toolbar, .cv-modal-backdrop {{
        display: none !important;
      }}
      .container {{
        box-shadow: none !important;
        border-radius: 0 !important;
        padding: 0 !important;
        max-width: 100% !important;
      }}
      .cv-persona-panel {{
        display: none !important;
      }}
      .cv-persona-panel.active {{
        display: block !important;
      }}
      /* Se NÃO tem foto, oculta completamente no PDF sem deixar espaço vazio */
      .cv-avatar-container:not(.has-photo),
      .cv-avatar-placeholder,
      .cv-avatar-container:not(.has-photo) * {{
        display: none !important;
        width: 0 !important;
        height: 0 !important;
        margin: 0 !important;
        padding: 0 !important;
        border: none !important;
      }}
      .cv-avatar-container.has-photo {{
        border-width: 2px !important;
        box-shadow: none !important;
        display: block !important;
        visibility: visible !important;
        overflow: hidden !important;
        -webkit-print-color-adjust: exact !important;
        print-color-adjust: exact !important;
      }}
      .cv-avatar-img {{
        display: block !important;
        visibility: visible !important;
        opacity: 1 !important;
        width: 100% !important;
        height: 100% !important;
        object-fit: cover !important;
        -webkit-print-color-adjust: exact !important;
        print-color-adjust: exact !important;
      }}
      /* ── Impressão do Canvas Livre ── */
      .cv-canvas-workspace {{
        display: block !important;
        padding: 0 !important;
        margin: 0 !important;
      }}
      .cv-canvas-palette,
      .cv-canvas-sheet-info-bar,
      .cv-canvas-block__actions,
      .cv-canvas-overflow-badge,
      .cv-no-print {{
        display: none !important;
        visibility: hidden !important;
      }}
      .cv-canvas-sheet {{
        box-shadow: none !important;
        border: none !important;
        padding: 0 !important;
        margin: 0 !important;
        max-width: 100% !important;
        min-height: auto !important;
      }}
      .cv-canvas-block {{
        border: none !important;
        box-shadow: none !important;
        page-break-inside: avoid !important;
      }}
      /* ── Impressão Tema Terminal: Fundo Branco + Tipografia Verde Monospace ── */
      .theme-terminal,
      .theme-terminal .container,
      .theme-terminal .cv-card {{
        background: #ffffff !important;
        background-color: #ffffff !important;
        color: #166534 !important;
        font-family: 'Courier Prime', 'Fira Code', monospace !important;
      }}
      .theme-terminal p,
      .theme-terminal span,
      .theme-terminal li,
      .theme-terminal div,
      .theme-terminal .summary,
      .theme-terminal .item-desc,
      .theme-terminal .contacts,
      .theme-terminal .bullets li {{
        color: #15803d !important;
        font-family: 'Courier Prime', monospace !important;
      }}
      .theme-terminal h1,
      .theme-terminal h2,
      .theme-terminal h3,
      .theme-terminal h4,
      .theme-terminal .name {{
        color: #14532d !important;
        font-weight: 800 !important;
        font-family: 'Courier Prime', monospace !important;
      }}
      .theme-terminal .label {{
        color: #16a34a !important;
        font-family: 'Courier Prime', monospace !important;
        font-weight: 700 !important;
      }}
      .theme-terminal .section-title,
      .theme-terminal .cv-math-section-title {{
        color: #15803d !important;
        border-bottom: 1.5px dashed #22c55e !important;
        font-family: 'Courier Prime', monospace !important;
      }}
      .theme-terminal .item-title {{
        color: #14532d !important;
        font-family: 'Courier Prime', monospace !important;
        font-weight: 700 !important;
      }}
      .theme-terminal .item-sub,
      .theme-terminal .item-date {{
        color: #16a34a !important;
        font-family: 'Courier Prime', monospace !important;
      }}
      .theme-terminal .project-card,
      .theme-terminal .skill-group,
      .theme-terminal .geo-card,
      .theme-terminal .interest-card,
      .theme-terminal .lang-card,
      .theme-terminal .cv-math-project-card,
      .theme-terminal .cv-math-skill-card,
      .theme-terminal .cv-math-edu-card,
      .theme-terminal .cv-math-cert-card,
      .theme-terminal .cv-math-interest-card {{
        background: #f0fdf4 !important;
        border: 1px solid #bbf7d0 !important;
        border-left: 3.5px solid #22c55e !important;
        border-radius: 4px !important;
      }}
      .theme-terminal .badge,
      .theme-terminal .issuer-pill {{
        background: #dcfce7 !important;
        color: #14532d !important;
        border: 1px solid #86efac !important;
        border-radius: 3px !important;
        font-family: 'Courier Prime', monospace !important;
        font-weight: 600 !important;
      }}
      .theme-terminal a,
      .theme-terminal .cv-link {{
        color: #15803d !important;
        text-decoration: underline !important;
      }}
      @page {{
        size: A4 portrait;
        margin: 6mm 8mm 6mm 8mm !important;
      }}
    }}
  </style>
</head>
<body>

  <!-- Floating Multi-Control Toolbar -->
  <div class="toolbar">
    <div class="toolbar-group">
      <select id="persona-switcher" onchange="switchPersona(this.value)" title="{t['persona_label']}">
        {persona_options_html}
      </select>
    </div>

    <div class="toolbar-group">
      <select id="layout-switcher" onchange="switchLayout(this.value)" title="{t['layout_label']}">
        {layout_options_html}
      </select>
    </div>

    <div class="toolbar-group">
      <select id="viewmode-switcher" onchange="switchViewMode(this.value)" title="{t['viewmode_label']}">
        <option value="cv" {'selected' if view_mode == 'cv' else ''}>{t['mode_cv']}</option>
        <option value="cover_letter" {'selected' if view_mode == 'cover_letter' else ''}>{t['mode_cover_letter']}</option>
        <option value="both" {'selected' if view_mode == 'both' else ''}>{t['mode_both']}</option>
      </select>
    </div>

    <div class="toolbar-group">
      <select id="theme-switcher" onchange="switchTheme(this.value)" title="{t['theme_label']}">
        <option value="executive" {'selected' if valid_theme == 'executive' else ''}>{t["opt_executive"]}</option>
        <option value="creative" {'selected' if valid_theme == 'creative' else ''}>{t["opt_creative"]}</option>
        <option value="minimalist" {'selected' if valid_theme == 'minimalist' else ''}>{t["opt_minimalist"]}</option>
        <option value="white" {'selected' if valid_theme == 'white' else ''}>{t["opt_white"]}</option>
        <option value="terminal" {'selected' if valid_theme == 'terminal' else ''}>{t["opt_terminal"]}</option>
      </select>
    </div>

    <button onclick="openDesignModal()" class="btn-sec" title="{t['design_btn']}">{t["design_btn"]}</button>
    <button onclick="openPhotoModal()" class="btn-sec" title="{t['photo_btn']}">{t["photo_btn"]}</button>
    <button onclick="printCV()">{t["print_btn"]}</button>
    <button onclick="downloadActiveYaml()" class="btn-sec">{t["download_yaml"]}</button>
    <button onclick="downloadAllZip()" class="btn-accent">{t["download_zip"]}</button>
    <button id="copy-btn" onclick="copyActiveYaml()" class="btn-sec">{t["copy_yaml"]}</button>
  </div>

  <!-- Main Viewport Container -->
  <div id="cv-viewport" class="container theme-{valid_theme}">
    {panels_html}
  </div>

  <!-- Design & Estilo Customizer Modal -->
  <div id="design-modal" class="cv-modal-backdrop" onclick="closeDesignModal(event)">
    <div class="cv-modal-card" style="max-width: 540px; max-height: 85vh; overflow-y: auto;" onclick="event.stopPropagation()">
      <div class="cv-modal-header">
        <h3>{t['design_modal_title']}</h3>
        <button class="cv-modal-close" onclick="closeDesignModal()">✕</button>
      </div>
      <div class="cv-modal-body">
        <!-- 1. Font Presets -->
        <div>
          <div style="font-size: 0.85rem; font-weight: 700; color: #38bdf8; margin-bottom: 0.5rem;">{t['design_font_pair']}</div>
          <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 0.4rem;">
            <button class="modal-btn modal-btn-sec" style="text-align: left; padding: 0.4rem 0.6rem;" onclick="applyFontPreset('Plus Jakarta Sans', 'Inter')">
              <div style="font-weight: 700; font-family: 'Plus Jakarta Sans', sans-serif;">Modern Clean</div>
              <div style="font-size: 0.72rem; opacity: 0.75;">Plus Jakarta + Inter</div>
            </button>
            <button class="modal-btn modal-btn-sec" style="text-align: left; padding: 0.4rem 0.6rem;" onclick="applyFontPreset('Merriweather', 'Lora')">
              <div style="font-weight: 700; font-family: 'Merriweather', serif;">Executive Serif</div>
              <div style="font-size: 0.72rem; opacity: 0.75;">Merriweather + Lora</div>
            </button>
            <button class="modal-btn modal-btn-sec" style="text-align: left; padding: 0.4rem 0.6rem;" onclick="applyFontPreset('Cinzel', 'Montserrat')">
              <div style="font-weight: 700; font-family: 'Cinzel', serif;">Editorial High-End</div>
              <div style="font-size: 0.72rem; opacity: 0.75;">Cinzel + Montserrat</div>
            </button>
            <button class="modal-btn modal-btn-sec" style="text-align: left; padding: 0.4rem 0.6rem;" onclick="applyFontPreset('Roboto', 'Open Sans')">
              <div style="font-weight: 700; font-family: 'Roboto', sans-serif;">Tech Minimalist</div>
              <div style="font-size: 0.72rem; opacity: 0.75;">Roboto + Open Sans</div>
            </button>
            <button class="modal-btn modal-btn-sec" style="text-align: left; padding: 0.4rem 0.6rem;" onclick="applyFontPreset('Poppins', 'Inter')">
              <div style="font-weight: 700; font-family: 'Poppins', sans-serif;">Creative Geometric</div>
              <div style="font-size: 0.72rem; opacity: 0.75;">Poppins + Inter</div>
            </button>
            <button class="modal-btn modal-btn-sec" style="text-align: left; padding: 0.4rem 0.6rem;" onclick="applyFontPreset('Courier Prime', 'Courier Prime')">
              <div style="font-weight: 700; font-family: 'Courier Prime', monospace;">Terminal Code</div>
              <div style="font-size: 0.72rem; opacity: 0.75;">Courier Prime Monospace</div>
            </button>
          </div>
        </div>

        <!-- 2. Font Scale Slider -->
        <div style="margin-top: 0.5rem;">
          <div style="display: flex; justify-content: space-between; font-size: 0.85rem; font-weight: 700; color: #38bdf8; margin-bottom: 0.35rem;">
            <span>{t['design_font_scale']}</span>
            <span id="font-scale-val">1.00x</span>
          </div>
          <input id="font-scale-slider" type="range" min="0.85" max="1.20" step="0.05" value="1.0" style="width: 100%; cursor: pointer;" oninput="applyFontScale(this.value)" />
        </div>

        <!-- 3. Color Palettes -->
        <div style="margin-top: 0.5rem;">
          <div style="font-size: 0.85rem; font-weight: 700; color: #38bdf8; margin-bottom: 0.5rem;">{t['design_colors']}</div>
          <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 0.4rem;">
            <button class="modal-btn modal-btn-sec" style="display: flex; align-items: center; gap: 0.4rem; padding: 0.4rem;" onclick="applyColorPreset('#0284c7', '#0369a1', '#f97316', '#f8fafc', '#ffffff', '#0f172a')">
              <span style="width: 14px; height: 14px; border-radius: 50%; background: #0284c7; display: inline-block;"></span>
              <span style="font-size: 0.75rem;">Executive Navy</span>
            </button>
            <button class="modal-btn modal-btn-sec" style="display: flex; align-items: center; gap: 0.4rem; padding: 0.4rem;" onclick="applyColorPreset('#4f46e5', '#6366f1', '#ec4899', '#eef2ff', '#ffffff', '#1e1b4b')">
              <span style="width: 14px; height: 14px; border-radius: 50%; background: #4f46e5; display: inline-block;"></span>
              <span style="font-size: 0.75rem;">Criativo Indigo</span>
            </button>
            <button class="modal-btn modal-btn-sec" style="display: flex; align-items: center; gap: 0.4rem; padding: 0.4rem;" onclick="applyColorPreset('#059669', '#10b981', '#065f46', '#ecfdf5', '#ffffff', '#064e3b')">
              <span style="width: 14px; height: 14px; border-radius: 50%; background: #059669; display: inline-block;"></span>
              <span style="font-size: 0.75rem;">Emerald Tech</span>
            </button>
            <button class="modal-btn modal-btn-sec" style="display: flex; align-items: center; gap: 0.4rem; padding: 0.4rem;" onclick="applyColorPreset('#b45309', '#d97706', '#78350f', '#fffbeb', '#ffffff', '#1c1917')">
              <span style="width: 14px; height: 14px; border-radius: 50%; background: #b45309; display: inline-block;"></span>
              <span style="font-size: 0.75rem;">Amber Editorial</span>
            </button>
            <button class="modal-btn modal-btn-sec" style="display: flex; align-items: center; gap: 0.4rem; padding: 0.4rem;" onclick="applyColorPreset('#334155', '#475569', '#0284c7', '#f1f5f9', '#ffffff', '#0f172a')">
              <span style="width: 14px; height: 14px; border-radius: 50%; background: #334155; display: inline-block;"></span>
              <span style="font-size: 0.75rem;">Slate Minimal</span>
            </button>
            <button class="modal-btn modal-btn-sec" style="display: flex; align-items: center; gap: 0.4rem; padding: 0.4rem;" onclick="applyColorPreset('#9f1239', '#881337', '#e11d48', '#fff1f2', '#ffffff', '#1c1917')">
              <span style="width: 14px; height: 14px; border-radius: 50%; background: #9f1239; display: inline-block;"></span>
              <span style="font-size: 0.75rem;">Burgundy</span>
            </button>
          </div>
        </div>

        <!-- 4. Backgrounds -->
        <div style="margin-top: 0.5rem;">
          <div style="font-size: 0.85rem; font-weight: 700; color: #38bdf8; margin-bottom: 0.5rem;">{t['design_background']}</div>
          <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 0.4rem;">
            <button class="modal-btn modal-btn-sec" style="padding: 0.4rem; font-size: 0.75rem;" onclick="applyBgPattern('none')">
              Branco ATS
            </button>
            <button class="modal-btn modal-btn-sec" style="padding: 0.4rem; font-size: 0.75rem;" onclick="applyBgPattern('/cv-backgrounds/bg-grid-tech.jpg')">
              Tech Grid
            </button>
            <button class="modal-btn modal-btn-sec" style="padding: 0.4rem; font-size: 0.75rem;" onclick="applyBgPattern('/cv-backgrounds/bg-luxury-minimal.jpg')">
              Luxury Gold
            </button>
            <button class="modal-btn modal-btn-sec" style="padding: 0.4rem; font-size: 0.75rem;" onclick="applyBgPattern('/cv-backgrounds/bg-geometric-line.jpg')">
              Geometric Line
            </button>
            <button class="modal-btn modal-btn-sec" style="padding: 0.4rem; font-size: 0.75rem;" onclick="applyBgPattern('/cv-backgrounds/bg-corporate-waves.jpg')">
              Corporate Wave
            </button>
            <button class="modal-btn modal-btn-sec" style="padding: 0.4rem; font-size: 0.75rem;" onclick="applyBgPattern('/cv-backgrounds/bg-stationery-clean.jpg')">
              Stationery Cream
            </button>
            <button class="modal-btn modal-btn-sec" style="padding: 0.4rem; font-size: 0.75rem;" onclick="applyBgPattern('/cv-backgrounds/bg-technical-blueprint.jpg')">
              Blueprint Arq
            </button>
          </div>
        </div>
      </div>
      <div class="cv-modal-footer">
        <button class="modal-btn modal-btn-sec" onclick="resetDesign()">
          {t['design_reset']}
        </button>
        <button class="modal-btn modal-btn-pri" onclick="closeDesignModal()">
          {t['design_close']}
        </button>
      </div>
    </div>
  </div>

  <!-- Photo Uploader Modal with Interactive Framing -->
  <div id="photo-modal" class="cv-modal-backdrop" onclick="closePhotoModal(event)">
    <div class="cv-modal-card" style="max-width: 500px; max-height: 90vh; overflow-y: auto;" onclick="event.stopPropagation()">
      <div class="cv-modal-header">
        <h3>{t['photo_modal_title']}</h3>
        <button class="cv-modal-close" onclick="closePhotoModal()">✕</button>
      </div>
      <div class="cv-modal-body" style="display: flex; flex-direction: column; gap: 1rem;">
        <p style="margin: 0; font-size: 0.85rem; color: #94a3b8;">
          {t['photo_modal_desc']}
        </p>

        <!-- Preview Box and Controls -->
        <div style="display: flex; flex-direction: column; align-items: center; gap: 0.85rem; padding: 1.25rem; background: #06090f; border-radius: 0.75rem; border: 1px solid #1e293b;">
          <div style="display: flex; gap: 0.5rem; margin-bottom: 0.25rem;">
            <button
              id="shape-btn-circle"
              type="button"
              class="modal-btn modal-btn-sec active"
              style="font-size: 0.75rem; padding: 0.25rem 0.6rem; border: 1.5px solid #10b981;"
              onclick="setModalPreviewShape('circle')"
            >
              {t['photo_shape_circle']}
            </button>
            <button
              id="shape-btn-rect"
              type="button"
              class="modal-btn modal-btn-sec"
              style="font-size: 0.75rem; padding: 0.25rem 0.6rem;"
              onclick="setModalPreviewShape('rect')"
            >
              {t['photo_shape_rect']}
            </button>
          </div>

          <div
            id="modal-preview-box"
            style="width: 120px; height: 120px; border-radius: 50%; overflow: hidden; border: 3px solid #10b981; display: flex; align-items: center; justify-content: center; background: #1e293b; position: relative; cursor: grab; user-select: none; box-shadow: 0 8px 24px rgba(0,0,0,0.5);"
            title="{t['photo_drag_hint']}"
          >
            <img
              id="modal-preview-img"
              src=""
              alt="Preview"
              draggable="false"
              style="width: 100%; height: 100%; object-fit: cover; object-position: 50% 50%; transform: scale(1); transform-origin: 50% 50%; display: none;"
              onerror="onPhotoPreviewError()"
            />
            <span id="modal-preview-placeholder" style="font-size: 2.5rem;">👤</span>
          </div>

          <span id="modal-drag-hint-text" style="font-size: 0.75rem; color: #64748b; text-align: center; display: none;">
            {t['photo_drag_hint']}
          </span>

          <!-- Controls for Scale and Position -->
          <div id="modal-framing-controls" style="width: 100%; display: none; flex-direction: column; gap: 0.75rem; background: #0b1120; padding: 0.85rem; border-radius: 6px; box-sizing: border-box;">
            <div style="display: flex; align-items: center; justify-content: space-between;">
              <label style="font-size: 0.78rem; font-weight: 600; color: #cbd5e1;">{t['photo_zoom']}: <strong id="modal-scale-label">1.0x</strong></label>
              <button type="button" onclick="resetModalFraming()" style="background: transparent; border: none; color: #38bdf8; font-size: 0.75rem; cursor: pointer;">{t['photo_reset_framing']}</button>
            </div>
            <input
              id="modal-scale-slider"
              type="range"
              min="1.0"
              max="2.5"
              step="0.05"
              value="1.0"
              oninput="onModalScaleChange(parseFloat(this.value))"
              style="width: 100%; accent-color: #10b981; cursor: pointer;"
            />

            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.85rem;">
              <div>
                <label style="font-size: 0.75rem; color: #94a3b8; display: block; margin-bottom: 0.2rem;">{t['photo_pos_x']}: <strong id="modal-posx-label">50%</strong></label>
                <input
                  id="modal-posx-slider"
                  type="range"
                  min="0"
                  max="100"
                  value="50"
                  oninput="onModalPosXChange(parseInt(this.value))"
                  style="width: 100%; accent-color: #38bdf8; cursor: pointer;"
                />
              </div>
              <div>
                <label style="font-size: 0.75rem; color: #94a3b8; display: block; margin-bottom: 0.2rem;">{t['photo_pos_y']}: <strong id="modal-posy-label">50%</strong></label>
                <input
                  id="modal-posy-slider"
                  type="range"
                  min="0"
                  max="100"
                  value="50"
                  oninput="onModalPosYChange(parseInt(this.value))"
                  style="width: 100%; accent-color: #38bdf8; cursor: pointer;"
                />
              </div>
            </div>
          </div>

          <!-- File Upload & Remove Buttons -->
          <div style="display: flex; gap: 0.75rem; width: 100%; justify-content: center;">
            <label class="modal-btn modal-btn-sec" style="cursor: pointer; text-align: center; flex: 1;">
              {t['photo_choose_file']}
              <input type="file" accept="image/*" onchange="handlePhotoFileUpload(event)" style="display: none;" />
            </label>
            <button id="modal-remove-btn" class="modal-btn modal-btn-sec" style="color: #f87171; display: none;" onclick="removeModalPhoto()">
              {t['photo_remove']}
            </button>
          </div>
        </div>

        <div style="display: flex; flex-direction: column; gap: 0.4rem;">
          <label style="font-size: 0.8rem; font-weight: 600; color: #cbd5e1;">{t['photo_url_label']}</label>
          <input
            id="modal-url-input"
            type="url"
            class="modal-input"
            placeholder="https://exemplo.com/minha-foto.jpg"
            oninput="handlePhotoUrlInput(this.value)"
          />
        </div>
      </div>
      <div class="cv-modal-footer">
        <button class="modal-btn modal-btn-sec" onclick="clearAndSaveNoPhoto()">
          {t['photo_no_photo']}
        </button>
        <button class="modal-btn modal-btn-pri" onclick="saveAndApplyPhoto()">
          {t['photo_save']}
        </button>
      </div>
    </div>
  </div>

  <!-- Canvas Block Inspector Modal -->
  <div id="canvas-inspector-modal" class="cv-modal-backdrop" onclick="if(event.target===this) closeCanvasBlockInspector()">
    <div class="cv-modal-box" style="max-width: 500px; max-height: 90vh; overflow-y: auto;">
      <div class="cv-modal-header">
        <h3 id="inspector-modal-title" style="margin: 0; font-size: 1.1rem; color: #38bdf8;">⚙️ Configurar Bloco</h3>
        <button class="cv-modal-close" onclick="closeCanvasBlockInspector()">✕</button>
      </div>
      <div class="cv-modal-body" id="inspector-modal-content" style="display: flex; flex-direction: column; gap: 1rem; padding: 1.25rem;">
        <!-- Preenchido dinamicamente por openCanvasBlockInspector -->
      </div>
      <div class="cv-modal-footer">
        <button class="modal-btn modal-btn-pri" onclick="closeCanvasBlockInspector()">Salvar & Fechar</button>
      </div>
    </div>
  </div>

  <!-- Raw Embedded YAMLs -->
  {scripts_yaml_html}

  <script>
    let currentPersona = '{active_persona}';
    let currentTheme = '{valid_theme}';
    let currentLayout = '{valid_layout}';
    let currentViewMode = '{view_mode}';
    let currentPhoto = localStorage.getItem('cv_user_photo') || '{initial_image}';
    let currentPhotoPosX = parseInt(localStorage.getItem('cv_user_photo_pos_x') || '{initial_pos_x}') || 50;
    let currentPhotoPosY = parseInt(localStorage.getItem('cv_user_photo_pos_y') || '{initial_pos_y}') || 50;
    let currentPhotoScale = parseFloat(localStorage.getItem('cv_user_photo_scale') || '{initial_scale}') || 1.0;
    let modalPreviewShape = 'circle';
    let modalPhotoInput = currentPhoto;
    let modalPosX = currentPhotoPosX;
    let modalPosY = currentPhotoPosY;
    let modalScale = currentPhotoScale;
    let isDragging = false;
    let dragStartX = 0, dragStartY = 0, dragInitPosX = 50, dragInitPosY = 50;

    const PERSONA_FILENAMES = {{
        'professional': 'curriculo_executivo_ibm.yaml',
        'architect': 'curriculo_arquiteto_ia.yaml',
        'historian': 'curriculo_biografo.yaml',
        'didactic': 'curriculo_didatico.yaml',
        'alien': 'curriculo_alien.yaml'
    }};

    const I18N_T = {i18n_json_str};
    const EMBEDDED_DATA = {archetypes_json_str};

    function getGridClass(count) {{
      if (count <= 1) return 'cv-grid-1';
      if (count === 2) return 'cv-grid-2';
      if (count === 3) return 'cv-grid-3';
      if (count === 4) return 'cv-grid-4';
      if (count === 5) return 'cv-grid-5';
      if (count % 3 === 0) return 'cv-grid-3';
      if (count % 3 === 1) return 'cv-grid-2';
      return 'cv-grid-split-3-2';
    }}

    function getActivePersonaData(personaKey) {{
      if (EMBEDDED_DATA && EMBEDDED_DATA[personaKey]) {{
        return EMBEDDED_DATA[personaKey];
      }}
      return {{}};
    }}

    /* ── Canvas Livre State & Actions ── */
    function loadSavedCanvasBlocks() {{
      try {{
        const saved = localStorage.getItem('cv_standalone_canvas_blocks');
        if (saved) {{
          const parsed = JSON.parse(saved);
          if (Array.isArray(parsed) && parsed.length > 0) return parsed;
        }}
      }} catch(e) {{}}
      return [
        {{ id: 'b_hdr', type: 'header', colSpan: 12 }},
        {{ id: 'b_pht', type: 'photo', colSpan: 4, photoShape: 'circle', photoSize: 95, photoShadow: true, photoAlign: 'center', hideContainerBox: false }},
        {{ id: 'b_sum', type: 'summary', colSpan: 8 }},
        {{ id: 'b_wrk', type: 'work', colSpan: 12 }},
        {{ id: 'b_skl', type: 'skills_tags', colSpan: 6 }},
        {{ id: 'b_edu', type: 'education', colSpan: 6 }},
        {{ id: 'b_prj', type: 'projects', colSpan: 12 }},
        {{ id: 'b_lng', type: 'languages', colSpan: 6 }},
        {{ id: 'b_int', type: 'interests', colSpan: 6 }}
      ];
    }}

    let standaloneCanvasBlocks = loadSavedCanvasBlocks();
    let currentInspectedBlockId = null;

    function saveCanvasBlocks() {{
      localStorage.setItem('cv_standalone_canvas_blocks', JSON.stringify(standaloneCanvasBlocks));
    }}

    function addCanvasBlock(type) {{
      const id = 'b_' + Date.now() + '_' + Math.floor(Math.random()*1000);
      const isPhoto = type === 'photo';
      const defaultSpan = (type === 'header' || type === 'work' || type === 'projects') ? 12 : (isPhoto ? 4 : 6);
      standaloneCanvasBlocks.push({{
        id: id,
        type: type,
        colSpan: defaultSpan,
        photoShape: 'circle',
        photoSize: 95,
        photoShadow: true,
        photoAlign: 'center',
        hideContainerBox: false
      }});
      saveCanvasBlocks();
      updateActivePanelContent();
    }}

    function moveCanvasBlock(idx, dir) {{
      const targetIdx = idx + dir;
      if (targetIdx < 0 || targetIdx >= standaloneCanvasBlocks.length) return;
      const temp = standaloneCanvasBlocks[idx];
      standaloneCanvasBlocks[idx] = standaloneCanvasBlocks[targetIdx];
      standaloneCanvasBlocks[targetIdx] = temp;
      saveCanvasBlocks();
      updateActivePanelContent();
    }}

    function changeCanvasBlockColSpan(id, colSpan) {{
      const b = standaloneCanvasBlocks.find(x => x.id === id);
      if (b) {{
        b.colSpan = parseInt(colSpan) || 12;
        saveCanvasBlocks();
        updateActivePanelContent();
      }}
    }}

    function deleteCanvasBlock(id) {{
      standaloneCanvasBlocks = standaloneCanvasBlocks.filter(x => x.id !== id);
      saveCanvasBlocks();
      updateActivePanelContent();
    }}

    function clearCanvasBlocks() {{
      if (confirm('Deseja limpar todos os blocos do modo livre?')) {{
        standaloneCanvasBlocks = [];
        saveCanvasBlocks();
        updateActivePanelContent();
      }}
    }}

    function applyCanvasPreset(name) {{
      if (name === 'executive_balanced') {{
        standaloneCanvasBlocks = [
          {{ id: 'b_hdr', type: 'header', colSpan: 12 }},
          {{ id: 'b_pht', type: 'photo', colSpan: 4, photoShape: 'circle', photoSize: 95, photoShadow: true, photoAlign: 'center', hideContainerBox: false }},
          {{ id: 'b_sum', type: 'summary', colSpan: 8 }},
          {{ id: 'b_wrk', type: 'work', colSpan: 12 }},
          {{ id: 'b_skl', type: 'skills_tags', colSpan: 6 }},
          {{ id: 'b_edu', type: 'education', colSpan: 6 }},
          {{ id: 'b_prj', type: 'projects', colSpan: 12 }},
          {{ id: 'b_lng', type: 'languages', colSpan: 6 }},
          {{ id: 'b_int', type: 'interests', colSpan: 6 }}
        ];
      }} else if (name === 'two_column') {{
        standaloneCanvasBlocks = [
          {{ id: 'b_hdr', type: 'header', colSpan: 12 }},
          {{ id: 'b_pht', type: 'photo', colSpan: 4, photoShape: 'rounded', photoSize: 110, photoShadow: true, photoAlign: 'center', hideContainerBox: false }},
          {{ id: 'b_cnt', type: 'contacts', colSpan: 4 }},
          {{ id: 'b_sum', type: 'summary', colSpan: 4 }},
          {{ id: 'b_wrk', type: 'work', colSpan: 7 }},
          {{ id: 'b_skl', type: 'skills_bars', colSpan: 5 }},
          {{ id: 'b_prj', type: 'projects', colSpan: 7 }},
          {{ id: 'b_edu', type: 'education', colSpan: 5 }},
          {{ id: 'b_lng', type: 'languages', colSpan: 12 }}
        ];
      }} else if (name === 'tech_hero') {{
        standaloneCanvasBlocks = [
          {{ id: 'b_hdr', type: 'header', colSpan: 8 }},
          {{ id: 'b_pht', type: 'photo', colSpan: 4, photoShape: 'hexagon', photoSize: 105, photoShadow: true, photoAlign: 'center', hideContainerBox: false }},
          {{ id: 'b_sum', type: 'summary', colSpan: 12 }},
          {{ id: 'b_skl', type: 'skills_tags', colSpan: 12 }},
          {{ id: 'b_prj', type: 'projects', colSpan: 12 }},
          {{ id: 'b_wrk', type: 'work', colSpan: 12 }},
          {{ id: 'b_edu', type: 'education', colSpan: 6 }},
          {{ id: 'b_int', type: 'interests', colSpan: 6 }}
        ];
      }}
      saveCanvasBlocks();
      updateActivePanelContent();
    }}

    function openCanvasBlockInspector(id) {{
      const b = standaloneCanvasBlocks.find(x => x.id === id);
      if (!b) return;
      currentInspectedBlockId = id;
      const modal = document.getElementById('canvas-inspector-modal');
      const title = document.getElementById('inspector-modal-title');
      const content = document.getElementById('inspector-modal-content');
      if (!modal || !content) return;

      const typeLabels = {{
        header: '👤 Cabeçalho (Nome & Título)',
        photo: '📷 Foto / Avatar',
        contacts: '📞 Contatos & Links',
        summary: '📄 Resumo / Sobre Mim',
        work: '💼 Experiência Profissional',
        projects: '🚀 Projetos em Destaque',
        skills_tags: '⚡ Competências (Tags)',
        skills_bars: '📊 Barras de Nível',
        education: '🎓 Formação Acadêmica',
        certificates: '📜 Certificações',
        languages: '🌐 Idiomas',
        interests: '🎯 Interesses'
      }};

      title.innerText = '⚙️ ' + (typeLabels[b.type] || 'Configurar Bloco');

      let htmlFields = '';

      if (b.type === 'photo') {{
        const curShape = b.photoShape || 'circle';
        const curSize = b.photoSize || 90;
        const curAlign = b.photoAlign || 'center';
        const curBorder = b.photoBorderWidth || 0;
        const curShadow = b.photoShadow !== false;
        const curFloating = b.hideContainerBox !== false;

        const shapes = [
          {{ key: 'circle', label: '⚪ Círculo' }},
          {{ key: 'square', label: '🔲 Quadrado' }},
          {{ key: 'rounded', label: '🔲 Arredondado' }},
          {{ key: 'vertical', label: '📱 Editorial 3:4' }},
          {{ key: 'pill', label: '💊 Pílula' }},
          {{ key: 'hexagon', label: '⬡ Hexágono' }},
          {{ key: 'diamond', label: '💎 Losango' }},
          {{ key: 'shield', label: '🛡️ Brasão' }}
        ];

        htmlFields += `
          <div>
            <label style="font-size: 0.8rem; font-weight: 700; color: #38bdf8; display: block; margin-bottom: 0.35rem;">Formato Geométrico da Foto</label>
            <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 0.35rem;">
              ${{shapes.map(s => `
                <button type="button" class="modal-btn ${{curShape === s.key ? 'modal-btn-pri' : 'modal-btn-sec'}}" style="font-size: 0.72rem; padding: 0.4rem 0.2rem; text-align: center;" onclick="updateInspectorPhotoField('photoShape', '${{s.key}}')">
                  ${{s.label}}
                </button>
              `).join('')}}
            </div>
          </div>

          <div>
            <div style="display: flex; justify-content: space-between; font-size: 0.8rem; font-weight: 700; color: #38bdf8; margin-bottom: 0.25rem;">
              <span>Tamanho da Foto</span>
              <span id="insp-photo-size-lbl">${{curSize}}px</span>
            </div>
            <input type="range" min="50" max="240" step="5" value="${{curSize}}" style="width: 100%; accent-color: #38bdf8; cursor: pointer;" oninput="updateInspectorPhotoField('photoSize', parseInt(this.value)); document.getElementById('insp-photo-size-lbl').innerText = this.value + 'px';" />
          </div>

          <div>
            <label style="font-size: 0.8rem; font-weight: 700; color: #38bdf8; display: block; margin-bottom: 0.35rem;">Alinhamento</label>
            <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 0.35rem;">
              <button type="button" class="modal-btn ${{curAlign === 'left' ? 'modal-btn-pri' : 'modal-btn-sec'}}" style="font-size: 0.75rem; padding: 0.35rem;" onclick="updateInspectorPhotoField('photoAlign', 'left')">⬅ Esquerda</button>
              <button type="button" class="modal-btn ${{curAlign === 'center' ? 'modal-btn-pri' : 'modal-btn-sec'}}" style="font-size: 0.75rem; padding: 0.35rem;" onclick="updateInspectorPhotoField('photoAlign', 'center')">↔ Centro</button>
              <button type="button" class="modal-btn ${{curAlign === 'right' ? 'modal-btn-pri' : 'modal-btn-sec'}}" style="font-size: 0.75rem; padding: 0.35rem;" onclick="updateInspectorPhotoField('photoAlign', 'right')">➡ Direita</button>
            </div>
          </div>

          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.75rem;">
            <div>
              <label style="font-size: 0.8rem; font-weight: 700; color: #38bdf8; display: block; margin-bottom: 0.25rem;">Borda</label>
              <select class="modal-input" onchange="updateInspectorPhotoField('photoBorderWidth', parseInt(this.value))">
                <option value="0" ${{curBorder === 0 ? 'selected' : ''}}>Sem borda</option>
                <option value="2" ${{curBorder === 2 ? 'selected' : ''}}>Fina (2px)</option>
                <option value="4" ${{curBorder === 4 ? 'selected' : ''}}>Média (4px)</option>
                <option value="6" ${{curBorder === 6 ? 'selected' : ''}}>Grossa (6px)</option>
              </select>
            </div>
            <div>
              <label style="font-size: 0.8rem; font-weight: 700; color: #38bdf8; display: block; margin-bottom: 0.25rem;">Sombra</label>
              <label style="display: flex; align-items: center; gap: 0.5rem; font-size: 0.8rem; color: #cbd5e1; margin-top: 0.4rem; cursor: pointer;">
                <input type="checkbox" ${{curShadow ? 'checked' : ''}} onchange="updateInspectorPhotoField('photoShadow', this.checked)" />
                Sombra suave
              </label>
            </div>
          </div>

          <div style="background: rgba(15,23,42,0.6); padding: 0.65rem; border-radius: 6px; border: 1px solid rgba(255,255,255,0.08);">
            <label style="display: flex; align-items: center; gap: 0.5rem; font-size: 0.8rem; color: #cbd5e1; cursor: pointer;">
              <input type="checkbox" ${{curFloating ? 'checked' : ''}} onchange="updateInspectorPhotoField('hideContainerBox', this.checked)" />
              <strong>Foto Flutuante</strong> (Sem card / sem caixa ao redor)
            </label>
          </div>
        `;
      }} else {{
        const curFont = b.fontFamily || 'inherit';
        const curScale = b.fontSizeScale || 1.0;
        const curTitle = b.customTitle || '';

        htmlFields += `
          <div>
            <label style="font-size: 0.8rem; font-weight: 700; color: #38bdf8; display: block; margin-bottom: 0.25rem;">Título Customizado do Bloco</label>
            <input type="text" class="modal-input" placeholder="Ex: Formação & Cursos" value="${{curTitle}}" oninput="updateInspectorBlockField('customTitle', this.value)" />
          </div>

          <div>
            <div style="display: flex; justify-content: space-between; font-size: 0.8rem; font-weight: 700; color: #38bdf8; margin-bottom: 0.25rem;">
              <span>Escala da Fonte</span>
              <span id="insp-font-scale-lbl">${{curScale}}x</span>
            </div>
            <input type="range" min="0.75" max="1.40" step="0.05" value="${{curScale}}" style="width: 100%; accent-color: #38bdf8; cursor: pointer;" oninput="updateInspectorBlockField('fontSizeScale', parseFloat(this.value)); document.getElementById('insp-font-scale-lbl').innerText = this.value + 'x';" />
          </div>

          <div>
            <label style="font-size: 0.8rem; font-weight: 700; color: #38bdf8; display: block; margin-bottom: 0.25rem;">Tipografia</label>
            <select class="modal-input" onchange="updateInspectorBlockField('fontFamily', this.value)">
              <option value="inherit" ${{curFont === 'inherit' ? 'selected' : ''}}>Padrão do Tema</option>
              <option value="Inter" ${{curFont === 'Inter' ? 'selected' : ''}}>Inter (Moderna)</option>
              <option value="Merriweather" ${{curFont === 'Merriweather' ? 'selected' : ''}}>Merriweather (Executiva)</option>
              <option value="Poppins" ${{curFont === 'Poppins' ? 'selected' : ''}}>Poppins (Geométrica)</option>
              <option value="Courier Prime" ${{curFont === 'Courier Prime' ? 'selected' : ''}}>Courier Prime (Monospace)</option>
            </select>
          </div>
        `;
      }}

      content.innerHTML = htmlFields;
      modal.style.display = 'flex';
    }}

    function updateInspectorPhotoField(field, value) {{
      const b = standaloneCanvasBlocks.find(x => x.id === currentInspectedBlockId);
      if (b) {{
        b[field] = value;
        saveCanvasBlocks();
        updateActivePanelContent();
        openCanvasBlockInspector(currentInspectedBlockId);
      }}
    }}

    function updateInspectorBlockField(field, value) {{
      const b = standaloneCanvasBlocks.find(x => x.id === currentInspectedBlockId);
      if (b) {{
        b[field] = value;
        saveCanvasBlocks();
        updateActivePanelContent();
      }}
    }}

    function closeCanvasBlockInspector() {{
      const modal = document.getElementById('canvas-inspector-modal');
      if (modal) modal.style.display = 'none';
      currentInspectedBlockId = null;
    }}

    function renderCanvasLivreLayout(data) {{
      const basics = data.basics || {{}};
      const name = basics.name || 'Candidato';
      const label = basics.label || '';
      const email = basics.email || '';
      const phone = basics.phone || '';
      const cleanPhone = phone.replace(/[^\\d+]/g, '');
      const city = (basics.location && basics.location.city) || '';
      const region = (basics.location && basics.location.region) || '';
      const locStr = (city && region) ? (city + ' - ' + region) : (city || region || '');
      const url = basics.url || '';
      const summary = (basics.summary || '').replace(/\\n/g, '<br>');
      const photoSrc = currentPhoto || (basics.image || '');
      const hasPhoto = Boolean(photoSrc && photoSrc.trim() && photoSrc !== 'None');

      // Helper rendering atomic blocks
      function renderBlockInner(b) {{
        switch (b.type) {{
          case 'header':
            return `
              <div class="cv-header" style="margin-bottom: 0.5rem;">
                <h1 class="name" style="font-size: 1.85rem; font-weight: 800; margin: 0 0 0.2rem 0;">${{name}}</h1>
                <div class="label" style="font-size: 0.95rem; font-weight: 600; opacity: 0.9;">${{label}}</div>
              </div>
            `;
          case 'photo':
            const shape = b.photoShape || 'circle';
            const size = b.photoSize || 90;
            const bWidth = b.photoBorderWidth || 0;
            const bColor = b.photoBorderColor || '#0284c7';
            const shadow = b.photoShadow !== false;
            const align = b.photoAlign || 'center';
            const clipMap = {{
              hexagon: 'polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%)',
              diamond: 'polygon(50% 0%, 100% 50%, 50% 100%, 0% 50%)',
              shield: 'polygon(0% 0%, 100% 0%, 100% 70%, 50% 100%, 0% 70%)'
            }};
            const radMap = {{
              circle: '50%',
              pill: '50%',
              rounded: '14px',
              vertical: '8px',
              square: '0px'
            }};
            const rad = clipMap[shape] ? '0' : (radMap[shape] || '50%');
            const hPx = shape === 'vertical' ? Math.round(size * 1.32) : size;
            const cClip = clipMap[shape] ? `clip-path: ${{clipMap[shape]}};` : '';
            const cBorder = bWidth > 0 ? `border: ${{bWidth}}px solid ${{bColor}};` : 'border: none;';
            const cShadow = shadow && !clipMap[shape] ? 'box-shadow: 0 8px 20px -4px rgba(0,0,0,0.25);' : '';
            const justify = align === 'left' ? 'flex-start' : align === 'right' ? 'flex-end' : 'center';

            if (!hasPhoto) {{
              return `
                <div style="display: flex; justify-content: ${{justify}}; width: 100%;">
                  <div class="cv-avatar-container cv-no-print" onclick="openPhotoModal()" style="width: ${{size}}px; height: ${{hPx}}px; border-radius: ${{rad}}; ${{cClip}} border: 2px dashed #475569; display: flex; flex-direction: column; align-items: center; justify-content: center; background: rgba(15,23,42,0.5); color: #94a3b8; cursor: pointer;">
                    <span style="font-size: 1.5rem;">👤</span>
                    <span style="font-size: 0.7rem;">+ Foto</span>
                  </div>
                </div>
              `;
            }}

            return `
              <div style="display: flex; justify-content: ${{justify}}; width: 100%; margin: 0.25rem 0;">
                <div class="cv-avatar-container has-photo" onclick="openPhotoModal()" style="width: ${{size}}px; height: ${{hPx}}px; border-radius: ${{rad}}; ${{cClip}} ${{cBorder}} ${{cShadow}} overflow: hidden; display: block; background: #e2e8f0; cursor: pointer;">
                  <img class="cv-avatar-img" src="${{photoSrc}}" alt="Avatar" style="width: 100%; height: 100%; object-fit: cover; object-position: ${{currentPhotoPosX}}% ${{currentPhotoPosY}}%; transform: scale(${{currentPhotoScale}}); transform-origin: ${{currentPhotoPosX}}% ${{currentPhotoPosY}}%; display: block;" />
                </div>
              </div>
            `;
          case 'contacts':
            return `
              <div class="contacts" style="display: flex; flex-wrap: wrap; gap: 0.65rem 1rem; font-size: 0.85rem;">
                ${{email ? `<div>✉ <a href="mailto:${{email}}" class="cv-link">${{email}}</a></div>` : ''}}
                ${{phone ? `<div>📞 <a href="tel:${{cleanPhone}}" class="cv-link">${{phone}}</a></div>` : ''}}
                ${{locStr ? `<div>📍 ${{locStr}}</div>` : ''}}
                ${{url ? `<div>🌐 <a href="${{url}}" target="_blank" class="cv-link">${{url}}</a></div>` : ''}}
              </div>
            `;
          case 'summary':
            return summary ? `<div class="summary">${{summary}}</div>` : '';
          case 'work':
            let wHtml = '';
            (data.work || []).forEach(w => {{
              const pos = w.position || '';
              const comp = w.name || '';
              const start = w.startDate || '';
              const end = w.endDate || I18N_T.present || 'Presente';
              const sum = w.summary || '';
              const hl = (w.highlights || []).map(h => `<li>${{h}}</li>`).join('');
              wHtml += `
                <div class="card avoid-break">
                  <div class="item-header"><span class="item-title">${{pos}}</span><span class="item-date">${{start}} — ${{end}}</span></div>
                  <div class="item-sub">${{comp}}</div>
                  ${{sum ? `<p class="item-desc">${{sum}}</p>` : ''}}
                  ${{hl ? `<ul class="item-highlights">${{hl}}</ul>` : ''}}
                </div>
              `;
            }});
            return wHtml ? `<section class="avoid-break"><h2 class="section-title">${{I18N_T.work || 'Experiência'}}</h2>${{wHtml}}</section>` : '';
          case 'projects':
            let pjHtml = '';
            (data.projects || []).forEach(pr => {{
              const pName = pr.name || '';
              const pDesc = pr.description || '';
              const kws = (pr.keywords || []).map(k => `<span class="badge">${{k}}</span>`).join('');
              pjHtml += `
                <div class="project-card avoid-break">
                  <div class="item-header"><span class="item-title">${{pName}}</span></div>
                  ${{pDesc ? `<p class="item-desc">${{pDesc}}</p>` : ''}}
                  ${{kws ? `<div class="tags">${{kws}}</div>` : ''}}
                </div>
              `;
            }});
            return pjHtml ? `<section class="avoid-break"><h2 class="section-title">${{I18N_T.projects || 'Projetos'}}</h2><div class="projects-grid cv-math-grid cv-grid-2">${{pjHtml}}</div></section>` : '';
          case 'skills_tags':
            let skHtml = '';
            (data.skills || []).forEach(sk => {{
              const sName = sk.name || '';
              const kws = (sk.keywords || []).map(k => `<span class="badge">${{k}}</span>`).join('');
              skHtml += `
                <div class="skill-group cv-math-skill-card avoid-break">
                  <div class="skill-title">⚡ ${{sName}}</div>
                  <div class="tags">${{kws}}</div>
                </div>
              `;
            }});
            return skHtml ? `<section class="avoid-break"><h2 class="section-title">${{I18N_T.skills || 'Competências'}}</h2><div class="skills-grid cv-math-grid cv-grid-2">${{skHtml}}</div></section>` : '';
          case 'skills_bars':
            let sbHtml = (data.skills || []).map(sk => {{
              const sName = sk.name || '';
              const lvl = parseInt(sk.level || 85);
              return `
                <div class="cv-skill-bar-item avoid-break" style="margin-bottom: 0.5rem; width: 100%;">
                  <div style="display: flex; justify-content: space-between; font-size: 0.78rem; font-weight: 700; margin-bottom: 0.2rem;">
                    <span>${{sName}}</span>
                    <span>${{lvl}}%</span>
                  </div>
                  <div style="height: 6px; background: rgba(125,125,125,0.2); border-radius: 3px; overflow: hidden;">
                    <div style="height: 100%; width: ${{lvl}}%; background: currentColor; border-radius: 3px;"></div>
                  </div>
                </div>
              `;
            }}).join('');
            return sbHtml ? `<section class="avoid-break"><h2 class="section-title">⚡ NÍVEIS DE HABILIDADE</h2><div class="cv-skills-progress-list">${{sbHtml}}</div></section>` : '';
          case 'education':
            let edHtml = '';
            (data.education || []).forEach(ed => {{
              const inst = ed.institution || '';
              const area = ed.area || '';
              const start = ed.startDate || '';
              const end = ed.endDate || I18N_T.in_progress || 'Em andamento';
              edHtml += `
                <div class="geo-card avoid-break">
                  <div class="card-top"><span class="geo-icon">🎓</span><span class="item-date">${{start}} — ${{end}}</span></div>
                  <div class="item-title">${{area}}</div>
                  <div class="item-sub">${{inst}}</div>
                </div>
              `;
            }});
            return edHtml ? `<section class="avoid-break"><h2 class="section-title">${{I18N_T.education || 'Formação'}}</h2><div class="education-grid cv-math-grid cv-grid-2">${{edHtml}}</div></section>` : '';
          case 'certificates':
            let cHtml = '';
            (data.certificates || []).forEach(cert => {{
              const cName = cert.name || '';
              const cIssuer = cert.issuer || '';
              const cDate = cert.date || '';
              cHtml += `
                <div class="geo-card avoid-break">
                  <div class="card-top"><span class="geo-icon">🎖️</span><span class="item-date">${{cDate}}</span></div>
                  <div class="item-title">${{cName}}</div>
                  <div class="item-sub">${{cIssuer}}</div>
                </div>
              `;
            }});
            return cHtml ? `<section class="avoid-break"><h2 class="section-title">${{I18N_T.certificates || 'Certificações'}}</h2><div class="certs-grid cv-math-grid cv-grid-2">${{cHtml}}</div></section>` : '';
          case 'languages':
            let lgHtml = (data.languages || []).map(l => `
              <div class="lang-card avoid-break" style="display: flex; justify-content: space-between; align-items: center; width: 100%;">
                <span style="font-weight: 600;">${{l.language || ''}}</span>
                <span class="badge">${{l.fluency || ''}}</span>
              </div>
            `).join('');
            return lgHtml ? `<section class="avoid-break"><h2 class="section-title">${{I18N_T.languages || 'Idiomas'}}</h2><div class="languages-grid cv-math-grid cv-grid-2">${{lgHtml}}</div></section>` : '';
          case 'interests':
            let itHtml = '';
            (data.interests || []).forEach(it => {{
              const itName = it.name || '';
              const kws = (it.keywords || []).map(k => `<span class="badge">${{k}}</span>`).join('');
              itHtml += `
                <div class="interest-card avoid-break">
                  <div style="font-weight: 700; margin-bottom: 0.25rem;">◈ ${{itName}}</div>
                  <div class="tags">${{kws}}</div>
                </div>
              `;
            }});
            return itHtml ? `<section class="avoid-break"><h2 class="section-title">${{I18N_T.interests || 'Interesses'}}</h2><div class="interests-grid cv-math-grid cv-grid-2">${{itHtml}}</div></section>` : '';
          default:
            return '';
        }}
      }}

      // Render blocks inside 12-col grid
      let blocksHtml = '';
      standaloneCanvasBlocks.forEach((b, idx) => {{
        const colClass = 'cv-col-' + (b.colSpan || 12);
        const isPhoto = b.type === 'photo';
        const isFloating = isPhoto && b.hideContainerBox !== false;
        const fontFam = b.fontFamily && b.fontFamily !== 'inherit' ? `font-family: "${{b.fontFamily}}", sans-serif;` : '';
        const fontSc = b.fontSizeScale ? `font-size: ${{b.fontSizeScale}}em;` : '';
        const tColor = b.customTextColor ? `color: ${{b.customTextColor}};` : '';
        const bBg = isFloating ? 'background: transparent;' : (b.customBgColor && b.customBgColor !== 'transparent' ? `background: ${{b.customBgColor}};` : '');
        const pMap = {{ none: '0', compact: '0.35rem', normal: '0.65rem', spacious: '1.15rem' }};
        const bPad = isFloating ? 'padding: 0;' : `padding: ${{pMap[b.padding || 'normal']}};`;

        blocksHtml += `
          <div class="cv-canvas-block ${{colClass}}" style="${{fontFam}} ${{fontSc}} ${{tColor}} ${{bBg}} ${{bPad}}">
            <div class="cv-canvas-block__actions cv-no-print">
              <button type="button" class="cv-canvas-act-btn" onclick="moveCanvasBlock(${{idx}}, -1)" ${{idx === 0 ? 'disabled' : ''}} title="Mover para cima">▲</button>
              <button type="button" class="cv-canvas-act-btn" onclick="moveCanvasBlock(${{idx}}, 1)" ${{idx === standaloneCanvasBlocks.length - 1 ? 'disabled' : ''}} title="Mover para baixo">▼</button>
              <select class="cv-canvas-act-btn" onchange="changeCanvasBlockColSpan('${{b.id}}', this.value)" title="Largura da coluna">
                <option value="12" ${{b.colSpan === 12 ? 'selected' : ''}}>100%</option>
                <option value="8" ${{b.colSpan === 8 ? 'selected' : ''}}>66%</option>
                <option value="6" ${{b.colSpan === 6 ? 'selected' : ''}}>50%</option>
                <option value="4" ${{b.colSpan === 4 ? 'selected' : ''}}>33%</option>
                <option value="3" ${{b.colSpan === 3 ? 'selected' : ''}}>25%</option>
              </select>
              <button type="button" class="cv-canvas-act-btn" onclick="openCanvasBlockInspector('${{b.id}}')" title="Personalizar bloco">⚙️</button>
              <button type="button" class="cv-canvas-act-btn cv-canvas-act-btn--danger" onclick="deleteCanvasBlock('${{b.id}}')" title="Excluir bloco">🗑️</button>
            </div>
            ${{b.customTitle ? `<h4 style="font-size: 0.9rem; font-weight: 800; text-transform: uppercase; margin: 0 0 0.4rem 0; border-bottom: 1.5px solid currentColor; padding-bottom: 0.2rem;">${{b.customTitle}}</h4>` : ''}}
            ${{renderBlockInner(b)}}
          </div>
        `;
      }});

      return `
        <div class="cv-canvas-workspace">
          <aside class="cv-canvas-palette cv-no-print" aria-label="Paleta de Blocos do YAML">
            <div class="cv-canvas-palette__header">
              <h3 class="cv-canvas-palette__title"><span>📦</span> Campos do YAML</h3>
              <span style="font-size: 0.72rem; color: #10b981; font-weight: 700; background: rgba(16,185,129,0.1); padding: 0.15rem 0.45rem; border-radius: 4px;">
                ${{standaloneCanvasBlocks.length}} blocos
              </span>
            </div>

            <div class="cv-canvas-palette__body">
              <div class="cv-canvas-palette__presets">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.2rem;">
                  <span style="font-size: 0.72rem; font-weight: 700; color: #94a3b8; text-transform: uppercase;">Templates Rápidos</span>
                  <button type="button" onclick="clearCanvasBlocks()" style="background: transparent; border: none; color: #f87171; font-size: 0.7rem; cursor: pointer; font-weight: 600;">🗑️ Limpar</button>
                </div>
                <button type="button" class="cv-canvas-preset-btn" onclick="applyCanvasPreset('executive_balanced')"><span>👔 Executivo Balanceado</span><span style="opacity: 0.6; font-size: 0.7rem;">9 blocos</span></button>
                <button type="button" class="cv-canvas-preset-btn" onclick="applyCanvasPreset('two_column')"><span>📑 Duas Colunas</span><span style="opacity: 0.6; font-size: 0.7rem;">9 blocos</span></button>
                <button type="button" class="cv-canvas-preset-btn" onclick="applyCanvasPreset('tech_hero')"><span>🚀 Hero Tech & Projetos</span><span style="opacity: 0.6; font-size: 0.7rem;">9 blocos</span></button>
              </div>

              <div class="cv-canvas-palette__section">
                <div class="cv-canvas-palette__sec-title">👤 Identidade & Contato</div>
                <button type="button" class="cv-canvas-item-btn" onclick="addCanvasBlock('header')"><span>👤 Nome & Título</span><span class="item-add-plus">+</span></button>
                <button type="button" class="cv-canvas-item-btn" onclick="addCanvasBlock('photo')"><span>📷 Foto / Avatar</span><span class="item-add-plus">+</span></button>
                <button type="button" class="cv-canvas-item-btn" onclick="addCanvasBlock('contacts')"><span>📞 Contatos & Links</span><span class="item-add-plus">+</span></button>
              </div>

              <div class="cv-canvas-palette__section">
                <div class="cv-canvas-palette__sec-title">📝 Trajetória & Conteúdo</div>
                <button type="button" class="cv-canvas-item-btn" onclick="addCanvasBlock('summary')"><span>📄 Sobre Mim / Resumo</span><span class="item-add-plus">+</span></button>
                <button type="button" class="cv-canvas-item-btn" onclick="addCanvasBlock('work')"><span>💼 Experiência Profissional</span><span class="item-add-plus">+</span></button>
                <button type="button" class="cv-canvas-item-btn" onclick="addCanvasBlock('projects')"><span>🚀 Projetos em Destaque</span><span class="item-add-plus">+</span></button>
              </div>

              <div class="cv-canvas-palette__section">
                <div class="cv-canvas-palette__sec-title">⚡ Competências & Níveis</div>
                <button type="button" class="cv-canvas-item-btn" onclick="addCanvasBlock('skills_tags')"><span>⚡ Competências (Tags)</span><span class="item-add-plus">+</span></button>
                <button type="button" class="cv-canvas-item-btn" onclick="addCanvasBlock('skills_bars')"><span>📊 Barras de Nível</span><span class="item-add-plus">+</span></button>
              </div>

              <div class="cv-canvas-palette__section">
                <div class="cv-canvas-palette__sec-title">🎓 Formação & Certificações</div>
                <button type="button" class="cv-canvas-item-btn" onclick="addCanvasBlock('education')"><span>🎓 Formação Acadêmica</span><span class="item-add-plus">+</span></button>
                <button type="button" class="cv-canvas-item-btn" onclick="addCanvasBlock('certificates')"><span>📜 Certificações</span><span class="item-add-plus">+</span></button>
              </div>

              <div class="cv-canvas-palette__section">
                <div class="cv-canvas-palette__sec-title">🌐 Idiomas & Interesses</div>
                <button type="button" class="cv-canvas-item-btn" onclick="addCanvasBlock('languages')"><span>🌐 Idiomas</span><span class="item-add-plus">+</span></button>
                <button type="button" class="cv-canvas-item-btn" onclick="addCanvasBlock('interests')"><span>🎯 Interesses</span><span class="item-add-plus">+</span></button>
              </div>
            </div>
          </aside>

          <main class="cv-canvas-center-stage">
            <div class="cv-canvas-sheet-info-bar cv-no-print">
              <span>📄 <strong>Folha A4 Livre</strong> (210 × 297 mm) | ${{standaloneCanvasBlocks.length}} blocos</span>
              <span style="font-size: 0.74rem; color: #34d399; font-weight: 700;">Pronto para Impressão A4</span>
            </div>
            <div class="cv-canvas-sheet-wrapper">
              <div class="cv-canvas-sheet">
                ${{blocksHtml}}
              </div>
            </div>
          </main>
        </div>
      `;
    }}

    function renderClientLayout(data, layout, viewMode) {{
      const basics = data.basics || {{}};
      const name = basics.name || 'Candidato';
      const label = basics.label || '';
      const email = basics.email || '';
      const phone = basics.phone || '';
      const cleanPhone = phone.replace(/[^\\d+]/g, '');
      const city = (basics.location && basics.location.city) || '';
      const region = (basics.location && basics.location.region) || '';
      const locStr = (city && region) ? (city + ' - ' + region) : (city || region || '');
      const url = basics.url || '';
      const summary = (basics.summary || '').replace(/\\n/g, '<br>');
      const photoSrc = currentPhoto || (basics.image || '');
      const hasPhoto = Boolean(photoSrc && photoSrc.trim() && photoSrc !== 'None');
      const posX = currentPhotoPosX ?? basics.imagePosX ?? 50;
      const posY = currentPhotoPosY ?? basics.imagePosY ?? 50;
      const scale = currentPhotoScale ?? basics.imageScale ?? 1.0;
      const imgStyle = `object-position: ${{posX}}% ${{posY}}%; transform: scale(${{scale}}); transform-origin: ${{posX}}% ${{posY}}%; ${{hasPhoto ? 'display:block;' : 'display:none;'}}`;

      const avatarHtml = `
        <div class="cv-avatar-container ${{hasPhoto ? 'has-photo' : ''}}" onclick="openPhotoModal()" title="${{I18N_T.photo_btn || 'Foto'}}">
          <img class="cv-avatar-img" src="${{hasPhoto ? photoSrc : ''}}" alt="Avatar" style="${{imgStyle}}" />
          <div class="cv-avatar-placeholder" style="${{hasPhoto ? 'display:none;' : 'display:flex;'}}">
            <span class="avatar-icon">👤</span>
            <span class="avatar-hint" style="font-size: 0.65rem; opacity: 0.85;">${{I18N_T.photo_btn || 'Foto'}}</span>
          </div>
        </div>
      `;

      if (viewMode === 'cover_letter') {{
        const cl = data.coverLetter || {{}};
        const recipient = cl.recipient || 'Prezada Equipe de Recrutamento';
        const company = cl.company || 'Empresa Contratante';
        const subject = cl.subject || ('Candidatura à Oportunidade em ' + (label || 'Tecnologia'));
        const dateVal = cl.date || 'São Paulo, SP';
        const bodyText = cl.body || (`Gostaria de apresentar minha candidatura à oportunidade em sua organização. Com sólida trajetória técnica e de liderança em engenharia de software e inteligência artificial, tenho dedicado minha carreira ao desenvolvimento de sistemas escaláveis, seguros e de alta performance.\\n\\nAo longo da minha jornada, liderei a concepção de arquiteturas críticas, automações inteligentes e microsserviços de alto throughput, sempre com rigoroso foco em governança, código limpo e impacto mensurável de negócios.\\n\\nEstou entusiasmado com a possibilidade de agregar essa experiência aos objetivos estratégicos de sua equipe e fico à disposição para uma conversa detalhada.\\n\\nAtenciosamente,\\n${{name}}`);
        const paragraphs = bodyText.split('\\n\\n').map(p => `<p style="margin-bottom: 1.15rem; line-height: 1.65; text-align: justify;">${{p.replace(/\\n/g, '<br>')}}</p>`).join('');

        return `
          <div class="cv-page-a4 cv-cover-letter-page">
            <div class="cv-card cv-cover-letter-card">
              <header class="cv-cover-letter-header" style="border-bottom: 2px solid currentColor; padding-bottom: 1rem; margin-bottom: 1.5rem;">
                <h1 class="cv-name" style="font-size: 1.8rem; font-weight: 800; margin: 0 0 0.25rem 0;">${{name}}</h1>
                ${{label ? `<div class="cv-label" style="font-size: 0.95rem; font-weight: 600; opacity: 0.9;">${{label}}</div>` : ''}}
                <div class="cv-contacts" style="display: flex; flex-wrap: wrap; gap: 0.85rem; margin-top: 0.6rem; font-size: 0.82rem;">
                  ${{email ? `<span>✉ ${{email}}</span>` : ''}}
                  ${{phone ? `<span>📞 ${{phone}}</span>` : ''}}
                  ${{locStr ? `<span>📍 ${{locStr}}</span>` : ''}}
                </div>
              </header>
              <div style="font-size: 0.88rem; color: inherit; line-height: 1.6;">
                <div style="display: flex; justify-content: space-between; margin-bottom: 1.25rem; font-weight: 600; opacity: 0.85;">
                  <div>Para: <strong>${{recipient}}</strong> — ${{company}}</div>
                  <div>${{dateVal}}</div>
                </div>
                <div style="font-size: 1rem; font-weight: 700; margin-bottom: 1.25rem; border-left: 3px solid currentColor; padding-left: 0.6rem;">
                  Assunto: ${{subject}}
                </div>
                <div class="cover-letter-body">
                  ${{paragraphs}}
                </div>
                <div style="margin-top: 2.5rem;">
                  <div>Atenciosamente,</div>
                  <div style="font-weight: 800; font-size: 1.05rem; margin-top: 0.35rem;">${{name}}</div>
                  <div style="font-size: 0.82rem; opacity: 0.85;">${{label}}</div>
                </div>
              </div>
            </div>
          </div>
        `;
      }}

      // Timeline de trabalho
      let workHtml = '';
      (data.work || []).forEach(w => {{
        const pos = w.position || '';
        const comp = w.name || '';
        const wUrl = w.url || '';
        const start = w.startDate || '';
        const end = (w.endDate && !['null', 'none', 'present', 'atual', 'presente'].includes(String(w.endDate).toLowerCase())) ? w.endDate : (I18N_T.present || 'Presente');
        const sum = w.summary || '';
        const hls = (w.highlights || []).map(h => `<li>${{h}}</li>`).join('');
        workHtml += `
          <div class="card avoid-break">
            <div class="item-header">
              <span class="item-title">${{pos}}</span>
              <span class="item-date">${{start}} — ${{end}}</span>
            </div>
            <div class="item-sub">${{wUrl ? `<a href="${{wUrl}}" target="_blank">${{comp}} ↗</a>` : comp}}</div>
            ${{sum ? `<p class="item-desc">${{sum}}</p>` : ''}}
            ${{hls ? `<ul class="bullets">${{hls}}</ul>` : ''}}
          </div>
        `;
      }});

      // Projetos
      let projHtml = '';
      (data.projects || []).forEach(pr => {{
        const prName = pr.name || '';
        const prDesc = pr.description || '';
        const prUrl = pr.url || '';
        const kws = (pr.keywords || []).map(k => `<span class="badge">${{k}}</span>`).join('');
        const hls = (pr.highlights || []).map(h => `<li>${{h}}</li>`).join('');
        projHtml += `
          <div class="project-card cv-math-project-card avoid-break">
            <div class="item-header">
              <span class="item-title">${{prUrl ? `<a href="${{prUrl}}" target="_blank">${{prName}} ↗</a>` : prName}}</span>
            </div>
            <p class="item-desc">${{prDesc}}</p>
            ${{hls ? `<ul class="bullets" style="margin-bottom: 0.4rem;">${{hls}}</ul>` : ''}}
            <div class="tags cv-math-tags">${{kws}}</div>
          </div>
        `;
      }});

      // Skills
      let skillsHtml = '';
      (data.skills || []).forEach(sk => {{
        const skName = sk.name || '';
        const kws = (sk.keywords || []).map(k => `<span class="badge">${{k}}</span>`).join('');
        skillsHtml += `
          <div class="skill-group cv-math-skill-card avoid-break">
            <div class="skill-title cv-math-skill-title">⚡ ${{skName}}</div>
            <div class="tags cv-math-tags">${{kws}}</div>
          </div>
        `;
      }});

      // Skills com Barras de Progresso
      function calcSkillPercent(lvlStr, lvlPct) {{
        if (typeof lvlPct === 'number' && lvlPct >= 0 && lvlPct <= 100) return lvlPct;
        if (!lvlStr) return 75;
        const norm = String(lvlStr).toLowerCase().trim();
        if (norm.includes('expert') || norm.includes('especialista') || norm.includes('master') || norm.includes('lead') || norm.includes('staff')) return 95;
        if (norm.includes('senior') || norm.includes('sênior') || norm.includes('avançad') || norm.includes('advanced')) return 85;
        if (norm.includes('pleno') || norm.includes('intermediár') || norm.includes('intermediate') || norm.includes('proficient')) return 70;
        if (norm.includes('júnior') || norm.includes('junior') || norm.includes('básic') || norm.includes('basic') || norm.includes('iniciante')) return 40;
        return 75;
      }}

      let skillsBarsHtml = '';
      (data.skills || []).forEach(sk => {{
        const skName = sk.name || '';
        const skLevel = sk.level || '';
        const pct = calcSkillPercent(sk.level, sk.levelPercent);
        skillsBarsHtml += `
          <div class="cv-skill-bar-wrapper avoid-break" style="width: 100%; margin-bottom: 0.45rem;">
            <div class="cv-skill-bar-label" style="display: flex; justify-content: space-between; align-items: center; font-size: 0.82rem; font-weight: 700; margin-bottom: 0.2rem;">
              <span>${{skName}}</span>
              <span style="opacity: 0.8; font-size: 0.75rem; font-weight: 600;">${{skLevel || pct + '%'}}</span>
            </div>
            <div class="cv-skill-bar-bg" style="width: 100%; height: 5px; background: rgba(125,125,125,0.2); border-radius: 999px; overflow: hidden;">
              <div class="cv-skill-bar-fill" style="width: ${{pct}}%; height: 100%; background: currentColor; border-radius: 999px;"></div>
            </div>
          </div>
        `;
      }});

      // Education
      let eduHtml = '';
      (data.education || []).forEach(ed => {{
        const inst = ed.institution || '';
        const area = ed.area || '';
        const stType = ed.studyType || '';
        const start = ed.startDate || '';
        const end = (ed.endDate && !['null', 'none', 'present', 'atual', 'presente'].includes(String(ed.endDate).toLowerCase())) ? ed.endDate : (I18N_T.in_progress || 'Em andamento');
        const courses = (ed.courses || []).map(c => `<span class="badge" style="margin-top:0.25rem;">${{c}}</span>`).join('');
        eduHtml += `
          <div class="geo-card cv-math-edu-card avoid-break">
            <div class="card-top"><span class="geo-icon">🎓</span><span class="item-date">${{start}} — ${{end}}</span></div>
            <div class="item-title" style="font-weight: 700; font-size: 0.85rem;">${{area}}</div>
            <div class="item-sub" style="font-size: 0.8rem;">${{inst}} • ${{stType}}</div>
            ${{courses ? `<div class="tags cv-math-tags" style="margin-top:0.3rem;">${{courses}}</div>` : ''}}
          </div>
        `;
      }});

      // Certificados
      let certHtml = '';
      (data.certificates || []).forEach(cert => {{
        const cName = cert.name || '';
        const cIssuer = cert.issuer || '';
        const cDate = cert.date || '';
        const cUrl = cert.url || '';
        certHtml += `
          <div class="geo-card cv-math-cert-card avoid-break">
            <div class="card-top"><span class="geo-icon">🎖️</span><span class="item-date">${{cDate}}</span></div>
            <div class="item-title" style="font-weight: 700; font-size: 0.85rem;">${{cUrl ? `<a href="${{cUrl}}" target="_blank">${{cName}} ↗</a>` : cName}}</div>
            <div class="issuer-pill">${{cIssuer}}</div>
          </div>
        `;
      }});

      // Idiomas
      let langHtml = (data.languages || []).map(l => `
        <div class="lang-card avoid-break" style="display: flex; justify-content: space-between; align-items: center; width: 100%;">
          <span style="font-weight: 600;">${{l.language || ''}}</span>
          <span class="badge">${{l.fluency || ''}}</span>
        </div>
      `).join('');

      // Interesses
      let intHtml = '';
      (data.interests || []).forEach(it => {{
        const itName = it.name || '';
        const kws = (it.keywords || []).map(k => `<span class="badge">${{k}}</span>`).join('');
        intHtml += `
          <div class="interest-card cv-math-interest-card avoid-break">
            <div style="font-weight: 700; font-size: 0.85rem; margin-bottom: 0.3rem;">◈ ${{itName}}</div>
            <div class="tags cv-math-tags">${{kws}}</div>
          </div>
        `;
      }});

      // Hobbies Circulares
      const hobbyIconsMap = {{
        camera: '📷', palette: '🎨', plane: '✈️', book: '📚',
        code: '💻', music: '🎵', coffee: '☕', globe: '🌐',
        chess: '♟️', gym: '🏋️'
      }};
      let hobbiesCirclesHtml = '';
      (data.interests || []).forEach(it => {{
        const itName = it.name || '';
        const itIconKey = String(it.icon || '').toLowerCase();
        const icon = hobbyIconsMap[itIconKey] || '🎯';
        hobbiesCirclesHtml += `
          <div style="display: flex; flex-direction: column; align-items: center; gap: 0.2rem;">
            <div class="cv-hobby-circle" style="width: 36px; height: 36px; border-radius: 50%; border: 1.5px solid currentColor; display: flex; align-items: center; justify-content: center; font-size: 1.1rem; margin: 0 auto 0.2rem auto;">${{icon}}</div>
            <div class="cv-hobby-label" style="font-size: 0.72rem; font-weight: 700; text-align: center; max-width: 75px; word-break: break-word;">${{itName}}</div>
          </div>
        `;
      }});

      // Perfis
      const profLinks = (basics.profiles || []).map(p => {{
        if (p.url) return `<a href="${{p.url}}" target="_blank" class="cv-link">🔗 ${{p.network}}: @${{p.username}}</a>`;
        if (p.username) return `<span>${{p.network}}: ${{p.username}}</span>`;
        return '';
      }}).filter(Boolean).join(' &nbsp;•&nbsp; ');

      // ── 0. Canvas Livre (Block Builder A4) ──
      if (layout === 'canvas_livre') {{
        return renderCanvasLivreLayout(data);
      }}

      // ── 1. Dynamic Math (Modelo A4 09) ──
      if (layout === 'dynamic_math') {{
        return `
          <div class="layout-dynamic_math">
            <header class="cv-math-header">
              <div class="cv-math-header-profile">
                ${{avatarHtml}}
                <div>
                  <h1 class="cv-math-name name">${{name}}</h1>
                  <div class="cv-math-label label">${{label}}</div>
                </div>
              </div>
              <div class="cv-math-contacts">
                ${{email ? `<div>✉ <a href="mailto:${{email}}" class="cv-link">${{email}}</a></div>` : ''}}
                ${{phone ? `<div>📞 <a href="tel:${{cleanPhone}}" class="cv-link">${{phone}}</a></div>` : ''}}
                ${{locStr ? `<div>📍 ${{locStr}}</div>` : ''}}
                ${{url ? `<div>🌐 <a href="${{url}}" target="_blank" class="cv-link">${{url}}</a></div>` : ''}}
                ${{profLinks ? `<div class="cv-math-profiles">${{profLinks}}</div>` : ''}}
              </div>
            </header>
            ${{summary ? `<div class="cv-math-summary summary">${{summary}}</div>` : ''}}
            ${{workHtml ? `<section class="avoid-break"><h2 class="cv-math-section-title section-title">${{I18N_T.work || 'Experiência'}}</h2><div class="cv-math-work-list">${{workHtml}}</div></section>` : ''}}
            ${{projHtml ? `<section class="avoid-break"><h2 class="cv-math-section-title section-title">${{I18N_T.projects || 'Projetos'}}</h2><div class="projects-grid cv-math-grid ${{getGridClass((data.projects||[]).length)}}">${{projHtml}}</div></section>` : ''}}
            ${{skillsHtml ? `<section class="avoid-break"><h2 class="cv-math-section-title section-title">${{I18N_T.skills || 'Competências'}}</h2><div class="skills-grid cv-math-grid ${{getGridClass((data.skills||[]).length)}}">${{skillsHtml}}</div></section>` : ''}}
            ${{eduHtml ? `<section class="avoid-break"><h2 class="cv-math-section-title section-title">${{I18N_T.education || 'Formação'}}</h2><div class="education-grid cv-math-grid ${{getGridClass((data.education||[]).length)}}">${{eduHtml}}</div></section>` : ''}}
            ${{certHtml ? `<section class="avoid-break"><h2 class="cv-math-section-title section-title">${{I18N_T.certificates || 'Certificações'}}</h2><div class="certs-grid cv-math-grid ${{getGridClass((data.certificates||[]).length)}}">${{certHtml}}</div></section>` : ''}}
            ${{langHtml ? `<section class="avoid-break"><h2 class="cv-math-section-title section-title">${{I18N_T.languages || 'Idiomas'}}</h2><div class="languages-grid cv-math-grid ${{getGridClass((data.languages||[]).length)}}">${{langHtml}}</div></section>` : ''}}
            ${{intHtml ? `<section class="avoid-break"><h2 class="cv-math-section-title section-title">${{I18N_T.interests || 'Interesses'}}</h2><div class="interests-grid cv-math-grid ${{getGridClass((data.interests||[]).length)}}">${{intHtml}}</div></section>` : ''}}
          </div>
        `;
      }}

      // ── 2. Editorial Accent / Brand Block (Modelo A4 05) ──
      if (layout === 'editorial_accent') {{
        return `
          <div class="layout-editorial_accent">
            <header class="header" style="display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid currentColor; padding-bottom: 1rem; margin-bottom: 1.25rem;">
              <div>
                <span class="cv-brand-greeting" style="background: currentColor; color: #fff; padding: 0.15rem 0.5rem; font-size: 0.75rem; font-weight: 700; border-radius: 3px; display: inline-block; margin-bottom: 0.25rem;">HELLO, I AM</span>
                <h1 class="name" style="font-size: 1.85rem; font-weight: 800; margin: 0 0 0.2rem 0;">${{name}}</h1>
                <div class="label" style="font-size: 0.95rem; font-weight: 600; opacity: 0.9;">${{label}}</div>
              </div>
              ${{avatarHtml}}
            </header>
            <div class="cv-editorial-grid" style="display: grid; grid-template-columns: 220px 1fr; gap: 1.75rem; align-items: start;">
              <aside class="cv-editorial-left cv-sidebar-stack">
                <div class="sidebar-section">
                  <h4 class="section-title" style="font-size: 0.85rem; margin-top: 0;">CONTATO</h4>
                  <div class="contacts" style="font-size: 0.8rem; line-height: 1.5; text-align: left;">
                    ${{email ? `<div>✉ ${{email}}</div>` : ''}}
                    ${{phone ? `<div>📞 ${{phone}}</div>` : ''}}
                    ${{locStr ? `<div>📍 ${{locStr}}</div>` : ''}}
                    ${{url ? `<div>🌐 <a href="${{url}}" target="_blank" class="cv-link">${{url}}</a></div>` : ''}}
                  </div>
                </div>
                ${{skillsBarsHtml ? `<div class="sidebar-section"><h4 class="section-title" style="font-size: 0.85rem;">EXPERTISE</h4><div class="cv-skills-progress-list">${{skillsBarsHtml}}</div></div>` : ''}}
                ${{langHtml ? `<div class="sidebar-section"><h4 class="section-title" style="font-size: 0.85rem;">${{I18N_T.languages || 'Idiomas'}}</h4><div class="cv-sidebar-stack">${{langHtml}}</div></div>` : ''}}
                ${{certHtml ? `<div class="sidebar-section"><h4 class="section-title" style="font-size: 0.85rem;">${{I18N_T.certificates || 'Certificações'}}</h4><div class="cv-sidebar-stack">${{certHtml}}</div></div>` : ''}}
                ${{intHtml ? `<div class="sidebar-section"><h4 class="section-title" style="font-size: 0.85rem;">${{I18N_T.interests || 'Interesses'}}</h4><div class="cv-sidebar-stack">${{intHtml}}</div></div>` : ''}}
              </aside>
              <main class="cv-editorial-main">
                ${{summary ? `<div class="summary" style="margin-bottom: 1.25rem;">${{summary}}</div>` : ''}}
                ${{workHtml ? `<section class="avoid-break"><h2 class="section-title">${{I18N_T.work || 'Experiência'}}</h2>${{workHtml}}</section>` : ''}}
                ${{projHtml ? `<section class="avoid-break"><h2 class="section-title">${{I18N_T.projects || 'Projetos'}}</h2><div class="cv-sidebar-stack" style="display: flex; flex-direction: column; gap: 0.65rem; width: 100%;">${{projHtml}}</div></section>` : ''}}
                ${{eduHtml ? `<section class="avoid-break"><h2 class="section-title">${{I18N_T.education || 'Formação'}}</h2><div class="cv-sidebar-stack" style="display: flex; flex-direction: column; gap: 0.65rem; width: 100%;">${{eduHtml}}</div></section>` : ''}}
              </main>
            </div>
          </div>
        `;
      }}

      // ── 3. Corporate Timeline / Navy Solid (Modelo A4 06) ──
      if (layout === 'corporate_timeline') {{
        return `
          <div class="layout-corporate_timeline">
            <div class="cv-navy-layout" style="display: grid; grid-template-columns: 240px 1fr; gap: 1.5rem; align-items: start;">
              <aside class="cv-navy-sidebar cv-sidebar-stack" style="background: #0f172a; color: #f8fafc; padding: 1.5rem; border-radius: 8px;">
                ${{avatarHtml}}
                <div style="text-align: center;">
                  <h2 style="font-size: 1.3rem; margin: 0 0 0.25rem 0; font-weight: 800; color: #fff;">${{name}}</h2>
                  <div style="font-size: 0.85rem; color: #f97316; font-weight: 700;">${{label}}</div>
                </div>
                <div class="contacts" style="font-size: 0.8rem; line-height: 1.45; text-align: left; border-top: 1px solid rgba(255,255,255,0.15); padding-top: 0.85rem;">
                  ${{email ? `<div>✉ ${{email}}</div>` : ''}}
                  ${{phone ? `<div>📞 ${{phone}}</div>` : ''}}
                  ${{locStr ? `<div>📍 ${{locStr}}</div>` : ''}}
                </div>
                ${{skillsBarsHtml ? `<div><h4 style="font-size: 0.85rem; color: #f8fafc; border-bottom: 1px solid rgba(255,255,255,0.2); padding-bottom: 0.25rem; margin-bottom: 0.5rem;">EXPERTISE</h4><div class="cv-skills-progress-list">${{skillsBarsHtml}}</div></div>` : ''}}
                ${{langHtml ? `<div><h4 style="font-size: 0.85rem; color: #f8fafc; border-bottom: 1px solid rgba(255,255,255,0.2); padding-bottom: 0.25rem; margin-bottom: 0.5rem;">${{I18N_T.languages || 'Idiomas'}}</h4><div class="cv-sidebar-stack">${{langHtml}}</div></div>` : ''}}
                ${{intHtml ? `<div><h4 style="font-size: 0.85rem; color: #f8fafc; border-bottom: 1px solid rgba(255,255,255,0.2); padding-bottom: 0.25rem; margin-bottom: 0.5rem;">${{I18N_T.interests || 'Interesses'}}</h4><div class="cv-sidebar-stack">${{intHtml}}</div></div>` : ''}}
              </aside>
              <main class="cv-navy-main">
                ${{summary ? `<div class="summary">${{summary}}</div>` : ''}}
                ${{workHtml ? `<section class="avoid-break"><h2 class="section-title">${{I18N_T.work || 'Experiência'}}</h2>${{workHtml}}</section>` : ''}}
                ${{eduHtml ? `<section class="avoid-break"><h2 class="section-title">${{I18N_T.education || 'Formação'}}</h2><div class="cv-sidebar-stack" style="display: flex; flex-direction: column; gap: 0.65rem; width: 100%;">${{eduHtml}}</div></section>` : ''}}
                ${{projHtml ? `<section class="avoid-break"><h2 class="section-title">${{I18N_T.projects || 'Projetos'}}</h2><div class="cv-sidebar-stack" style="display: flex; flex-direction: column; gap: 0.65rem; width: 100%;">${{projHtml}}</div></section>` : ''}}
                ${{certHtml ? `<section class="avoid-break"><h2 class="section-title">${{I18N_T.certificates || 'Certificações'}}</h2><div class="cv-sidebar-stack" style="display: flex; flex-direction: column; gap: 0.65rem; width: 100%;">${{certHtml}}</div></section>` : ''}}
              </main>
            </div>
          </div>
        `;
      }}

      const avatarRectHtml = `
        <div class="cv-avatar-container cv-avatar-rect ${{hasPhoto ? 'has-photo' : ''}}" onclick="openPhotoModal()" title="${{I18N_T.photo_btn || 'Foto'}}">
          <img class="cv-avatar-img" src="${{hasPhoto ? photoSrc : ''}}" alt="Avatar" style="${{imgStyle}}" />
          <div class="cv-avatar-placeholder" style="${{hasPhoto ? 'display:none;' : 'display:flex;'}}">
            <span class="avatar-icon">👤</span>
            <span class="avatar-hint" style="font-size: 0.65rem; opacity: 0.85;">${{I18N_T.photo_btn || 'Foto'}}</span>
          </div>
        </div>
      `;

      // ── 4. Hero Matrix (Modelo A4 08) ──
      if (layout === 'hero_matrix') {{
        return `
          <div class="layout-hero_matrix">
            <div class="cv-top-contact-bar" style="display: flex; justify-content: space-between; font-size: 0.8rem; font-weight: 600; border-bottom: 1px solid rgba(125,125,125,0.2); padding-bottom: 0.4rem; margin-bottom: 1rem;">
              <span>✉ ${{email}}</span>
              <span>📞 ${{phone}}</span>
              <span>📍 ${{locStr}}</span>
            </div>
            <header class="cv-hero-banner" style="display: flex; justify-content: space-between; align-items: center; background: rgba(125,125,125,0.06); padding: 1.25rem 1.5rem; border-radius: 8px; margin-bottom: 1.25rem;">
              <div>
                <h1 class="name" style="font-size: 1.85rem; font-weight: 800; margin: 0 0 0.25rem 0;">${{name}}</h1>
                <div class="label" style="font-size: 0.95rem; font-weight: 600; opacity: 0.9;">${{label}}</div>
              </div>
              ${{avatarRectHtml}}
            </header>
            ${{summary ? `<div class="summary" style="margin-bottom: 1rem;">${{summary}}</div>` : ''}}
            <div style="display: grid; grid-template-columns: 1.2fr 1fr; gap: 1.5rem; margin-bottom: 1.25rem; align-items: start;">
              <div>${{workHtml ? `<section class="avoid-break"><h2 class="section-title">${{I18N_T.work || 'Experiência'}}</h2>${{workHtml}}</section>` : ''}}</div>
              <div>
                ${{eduHtml ? `<section class="avoid-break"><h2 class="section-title">${{I18N_T.education || 'Formação'}}</h2><div class="cv-sidebar-stack" style="display: flex; flex-direction: column; gap: 0.65rem; width: 100%;">${{eduHtml}}</div></section>` : ''}}
                ${{projHtml ? `<section class="avoid-break"><h2 class="section-title">${{I18N_T.projects || 'Projetos'}}</h2><div class="cv-sidebar-stack" style="display: flex; flex-direction: column; gap: 0.65rem; width: 100%;">${{projHtml}}</div></section>` : ''}}
              </div>
            </div>
            ${{skillsBarsHtml ? `<section class="avoid-break" style="border-top: 1px solid rgba(125,125,125,0.2); padding-top: 0.85rem; margin-top: 0.5rem;"><h2 class="section-title">⚡ MATRIZ DE COMPETÊNCIAS</h2><div class="cv-skills-progress-list">${{skillsBarsHtml}}</div></section>` : ''}}
            ${{langHtml ? `<section class="avoid-break"><h2 class="section-title">${{I18N_T.languages || 'Idiomas'}}</h2><div class="languages-grid cv-math-grid ${{getGridClass((data.languages||[]).length)}}">${{langHtml}}</div></section>` : ''}}
            ${{certHtml ? `<section class="avoid-break"><h2 class="section-title">${{I18N_T.certificates || 'Certificações'}}</h2><div class="certs-grid cv-math-grid ${{getGridClass((data.certificates||[]).length)}}">${{certHtml}}</div></section>` : ''}}
            ${{intHtml ? `<section class="avoid-break"><h2 class="section-title">${{I18N_T.interests || 'Interesses'}}</h2><div class="interests-grid cv-math-grid ${{getGridClass((data.interests||[]).length)}}">${{intHtml}}</div></section>` : ''}}
          </div>
        `;
      }}

      // ── 5. Compact Split Duo / Executive Duo (Modelo A4 04) ──
      if (layout === 'compact_split') {{
        return `
          <div class="layout-compact_split">
            <div class="cv-duo-layout" style="display: grid; grid-template-columns: 210px 1fr; gap: 1.5rem; align-items: start;">
              <aside class="cv-duo-left cv-sidebar-stack" style="border-right: 1px solid rgba(125,125,125,0.25); padding-right: 1.25rem;">
                ${{avatarHtml}}
                ${{summary ? `<div class="sidebar-section avoid-break"><h4 class="section-title" style="font-size: 0.85rem; margin-top: 0;">PERFIL</h4><p class="summary" style="font-size: 0.82rem; line-height: 1.5;">${{summary}}</p></div>` : ''}}
                ${{skillsBarsHtml ? `<div class="sidebar-section avoid-break"><h4 class="section-title" style="font-size: 0.85rem;">EXPERTISE</h4><div class="cv-skills-progress-list">${{skillsBarsHtml}}</div></div>` : ''}}
                ${{hobbiesCirclesHtml ? `<div class="sidebar-section avoid-break"><h4 class="section-title" style="font-size: 0.85rem;">HOBBIES</h4><div class="cv-hobbies-grid" style="display: flex; justify-content: space-around; width: 100%;">${{hobbiesCirclesHtml}}</div></div>` : ''}}
                ${{langHtml ? `<div class="sidebar-section avoid-break"><h4 class="section-title" style="font-size: 0.85rem;">${{I18N_T.languages || 'Idiomas'}}</h4><div class="cv-sidebar-stack">${{langHtml}}</div></div>` : ''}}
              </aside>

              <main class="cv-duo-right">
                <header class="cv-duo-header" style="display: flex; flex-direction: column; align-items: flex-start; border-bottom: 2px solid currentColor; padding-bottom: 0.85rem; margin-bottom: 1.25rem; width: 100%;">
                  <h1 class="name" style="font-size: 1.85rem; font-weight: 800; margin: 0 0 0.25rem 0;">${{name}}</h1>
                  <div class="label" style="font-size: 0.95rem; font-weight: 700; opacity: 0.9; margin-bottom: 0.5rem;">${{label}}</div>
                  <div class="contacts" style="display: flex; flex-wrap: wrap; gap: 0.45rem 0.85rem; font-size: 0.82rem; text-align: left; width: 100%; word-break: break-word; overflow-wrap: anywhere;">
                    ${{email ? `<span>✉ <a href="mailto:${{email}}" class="cv-link">${{email}}</a></span>` : ''}}
                    ${{phone ? `<span>📞 <a href="tel:${{cleanPhone}}" class="cv-link">${{phone}}</a></span>` : ''}}
                    ${{locStr ? `<span>📍 ${{locStr}}</span>` : ''}}
                    ${{url ? `<span>🌐 <a href="${{url}}" target="_blank" class="cv-link">${{url}}</a></span>` : ''}}
                    ${{profLinks ? `<span>${{profLinks}}</span>` : ''}}
                  </div>
                </header>

                ${{workHtml ? `<section class="avoid-break"><h2 class="section-title">${{I18N_T.work || 'Experiência'}}</h2>${{workHtml}}</section>` : ''}}
                ${{eduHtml ? `<section class="avoid-break"><h2 class="section-title">${{I18N_T.education || 'Formação'}}</h2><div class="cv-sidebar-stack" style="display: flex; flex-direction: column; gap: 0.65rem; width: 100%;">${{eduHtml}}</div></section>` : ''}}
                ${{projHtml ? `<section class="avoid-break"><h2 class="section-title">${{I18N_T.projects || 'Projetos'}}</h2><div class="cv-sidebar-stack" style="display: flex; flex-direction: column; gap: 0.65rem; width: 100%;">${{projHtml}}</div></section>` : ''}}
                ${{certHtml ? `<section class="avoid-break"><h2 class="section-title">${{I18N_T.certificates || 'Certificações'}}</h2><div class="cv-sidebar-stack" style="display: flex; flex-direction: column; gap: 0.65rem; width: 100%;">${{certHtml}}</div></section>` : ''}}
              </main>
            </div>
          </div>
        `;
      }}

      // ── 6. Sidebar (Modelo A4 03) ──
      if (layout === 'sidebar') {{
        return `
          <div class="layout-sidebar">
            <div style="display: grid; grid-template-columns: 230px 1fr; gap: 1.5rem; align-items: start;">
              <aside class="cv-sidebar-stack" style="border-right: 1px solid rgba(125,125,125,0.2); padding-right: 1.25rem;">
                ${{avatarHtml}}
                <div>
                  <h2 class="name" style="font-size: 1.25rem; font-weight: 800; margin: 0 0 0.2rem 0;">${{name}}</h2>
                  <div class="label" style="font-size: 0.85rem; opacity: 0.85; font-weight: 600;">${{label}}</div>
                </div>
                <div class="contacts" style="font-size: 0.8rem; line-height: 1.45; text-align: left;">
                  ${{email ? `<div>✉ ${{email}}</div>` : ''}}
                  ${{phone ? `<div>📞 ${{phone}}</div>` : ''}}
                  ${{locStr ? `<div>📍 ${{locStr}}</div>` : ''}}
                  ${{url ? `<div>🌐 <a href="${{url}}" target="_blank" class="cv-link">${{url}}</a></div>` : ''}}
                </div>
                ${{skillsHtml ? `<div class="sidebar-section"><h4 class="section-title" style="font-size: 0.82rem; margin-top: 0.5rem;">${{I18N_T.skills || 'Competências'}}</h4><div class="cv-sidebar-stack">${{skillsHtml}}</div></div>` : ''}}
                ${{langHtml ? `<div class="sidebar-section"><h4 class="section-title" style="font-size: 0.82rem; margin-top: 0.5rem;">${{I18N_T.languages || 'Idiomas'}}</h4><div class="cv-sidebar-stack">${{langHtml}}</div></div>` : ''}}
                ${{certHtml ? `<div class="sidebar-section"><h4 class="section-title" style="font-size: 0.82rem; margin-top: 0.5rem;">${{I18N_T.certificates || 'Certificações'}}</h4><div class="cv-sidebar-stack">${{certHtml}}</div></div>` : ''}}
                ${{intHtml ? `<div class="sidebar-section"><h4 class="section-title" style="font-size: 0.82rem; margin-top: 0.5rem;">${{I18N_T.interests || 'Interesses'}}</h4><div class="cv-sidebar-stack">${{intHtml}}</div></div>` : ''}}
              </aside>
              <main>
                ${{summary ? `<div class="summary">${{summary}}</div>` : ''}}
                ${{workHtml ? `<section class="avoid-break"><h2 class="section-title">${{I18N_T.work || 'Experiência'}}</h2>${{workHtml}}</section>` : ''}}
                ${{projHtml ? `<section class="avoid-break"><h2 class="section-title">${{I18N_T.projects || 'Projetos'}}</h2><div class="cv-sidebar-stack" style="display: flex; flex-direction: column; gap: 0.65rem; width: 100%;">${{projHtml}}</div></section>` : ''}}
                ${{eduHtml ? `<section class="avoid-break"><h2 class="section-title">${{I18N_T.education || 'Formação'}}</h2><div class="cv-sidebar-stack" style="display: flex; flex-direction: column; gap: 0.65rem; width: 100%;">${{eduHtml}}</div></section>` : ''}}
              </main>
            </div>
          </div>
        `;
      }}

      // ── 6. Modelo A4 02: Linear ATS (Foto Retangular à Direita) ──
      if (layout === 'linear') {{
        return `
          <div class="layout-linear">
            <header class="header layout-linear-header" style="display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid currentColor; padding-bottom: 0.85rem; margin-bottom: 1.25rem;">
              <div style="flex: 1; padding-right: 1.5rem;">
                <h1 class="name" style="font-size: 1.85rem; font-weight: 800; margin: 0 0 0.25rem 0;">${{name}}</h1>
                <div class="label" style="font-size: 0.95rem; font-weight: 700; opacity: 0.9; margin-bottom: 0.5rem;">${{label}}</div>
                <div class="contacts" style="display: flex; flex-wrap: wrap; gap: 0.85rem; font-size: 0.82rem; text-align: left;">
                  ${{email ? `<span>✉ <a href="mailto:${{email}}" class="cv-link">${{email}}</a></span>` : ''}}
                  ${{phone ? `<span>📞 <a href="tel:${{cleanPhone}}" class="cv-link">${{phone}}</a></span>` : ''}}
                  ${{locStr ? `<span>📍 ${{locStr}}</span>` : ''}}
                  ${{url ? `<span>🌐 <a href="${{url}}" target="_blank" class="cv-link">${{url}}</a></span>` : ''}}
                  ${{profLinks ? `<span>${{profLinks}}</span>` : ''}}
                </div>
              </div>
              ${{avatarRectHtml}}
            </header>
            ${{summary ? `<div class="summary">${{summary}}</div>` : ''}}
            ${{workHtml ? `<section class="avoid-break"><h2 class="section-title">${{I18N_T.work || 'Experiência'}}</h2>${{workHtml}}</section>` : ''}}
            ${{projHtml ? `<section class="avoid-break"><h2 class="section-title">${{I18N_T.projects || 'Projetos'}}</h2><div class="projects-grid cv-math-grid ${{getGridClass((data.projects||[]).length)}}">${{projHtml}}</div></section>` : ''}}
            ${{skillsHtml ? `<section class="avoid-break"><h2 class="section-title">${{I18N_T.skills || 'Competências'}}</h2><div class="skills-grid cv-math-grid ${{getGridClass((data.skills||[]).length)}}">${{skillsHtml}}</div></section>` : ''}}
            ${{eduHtml ? `<section class="avoid-break"><h2 class="section-title">${{I18N_T.education || 'Formação'}}</h2><div class="education-grid cv-math-grid ${{getGridClass((data.education||[]).length)}}">${{eduHtml}}</div></section>` : ''}}
            ${{certHtml ? `<section class="avoid-break"><h2 class="section-title">${{I18N_T.certificates || 'Certificações'}}</h2><div class="certs-grid cv-math-grid ${{getGridClass((data.certificates||[]).length)}}">${{certHtml}}</div></section>` : ''}}
            ${{langHtml ? `<section class="avoid-break"><h2 class="section-title">${{I18N_T.languages || 'Idiomas'}}</h2><div class="languages-grid cv-math-grid ${{getGridClass((data.languages||[]).length)}}">${{langHtml}}</div></section>` : ''}}
            ${{intHtml ? `<section class="avoid-break"><h2 class="section-title">${{I18N_T.interests || 'Interesses'}}</h2><div class="interests-grid cv-math-grid ${{getGridClass((data.interests||[]).length)}}">${{intHtml}}</div></section>` : ''}}
          </div>
        `;
      }}

      // ── 7. Default (Modular 01, Warm Magazine 07) ──
      return `
        <div class="layout-${{layout}}">
          <header class="header">
            <div class="cv-header-profile">
              ${{avatarHtml}}
              <div>
                <h1 class="name">${{name}}</h1>
                <div class="label">${{label}}</div>
              </div>
            </div>
            <div class="contacts">
              ${{email ? `<div>✉ <a href="mailto:${{email}}" class="cv-link">${{email}}</a></div>` : ''}}
              ${{phone ? `<div>📞 <a href="tel:${{cleanPhone}}" class="cv-link">${{phone}}</a></div>` : ''}}
              ${{locStr ? `<div>📍 ${{locStr}}</div>` : ''}}
              ${{url ? `<div>🌐 <a href="${{url}}" target="_blank" class="cv-link">${{url}}</a></div>` : ''}}
              ${{profLinks ? `<div style="margin-top: 0.25rem;">${{profLinks}}</div>` : ''}}
            </div>
          </header>
          ${{summary ? `<div class="summary">${{summary}}</div>` : ''}}
          ${{workHtml ? `<section class="avoid-break"><h2 class="section-title">${{I18N_T.work || 'Experiência'}}</h2>${{workHtml}}</section>` : ''}}
          ${{projHtml ? `<section class="avoid-break"><h2 class="section-title">${{I18N_T.projects || 'Projetos'}}</h2><div class="projects-grid cv-math-grid ${{getGridClass((data.projects||[]).length)}}">${{projHtml}}</div></section>` : ''}}
          ${{skillsHtml ? `<section class="avoid-break"><h2 class="section-title">${{I18N_T.skills || 'Competências'}}</h2><div class="skills-grid cv-math-grid ${{getGridClass((data.skills||[]).length)}}">${{skillsHtml}}</div></section>` : ''}}
          ${{eduHtml ? `<section class="avoid-break"><h2 class="section-title">${{I18N_T.education || 'Formação'}}</h2><div class="education-grid cv-math-grid ${{getGridClass((data.education||[]).length)}}">${{eduHtml}}</div></section>` : ''}}
          ${{certHtml ? `<section class="avoid-break"><h2 class="section-title">${{I18N_T.certificates || 'Certificações'}}</h2><div class="certs-grid cv-math-grid ${{getGridClass((data.certificates||[]).length)}}">${{certHtml}}</div></section>` : ''}}
          ${{langHtml ? `<section class="avoid-break"><h2 class="section-title">${{I18N_T.languages || 'Idiomas'}}</h2><div class="languages-grid cv-math-grid ${{getGridClass((data.languages||[]).length)}}">${{langHtml}}</div></section>` : ''}}
          ${{intHtml ? `<section class="avoid-break"><h2 class="section-title">${{I18N_T.interests || 'Interesses'}}</h2><div class="interests-grid cv-math-grid ${{getGridClass((data.interests||[]).length)}}">${{intHtml}}</div></section>` : ''}}
        </div>
      `;
    }}

    function updateActivePanelContent() {{
      const activePanel = document.getElementById('cv-persona-' + currentPersona);
      if (!activePanel) return;
      const data = getActivePersonaData(currentPersona);
      if (data && Object.keys(data).length > 0) {{
        activePanel.innerHTML = renderClientLayout(data, currentLayout, currentViewMode);
      }}
      applyPhotoToAll(currentPhoto);
      updateDocTitle();
    }}

    function updateDocTitle() {{
      const activePanel = document.querySelector('.cv-persona-panel.active') || document.getElementById('cv-persona-' + currentPersona);
      if (activePanel) {{
        const nameEl = activePanel.querySelector('.name');
        const labelEl = activePanel.querySelector('.label');
        if (nameEl && nameEl.innerText.trim()) {{
          const name = nameEl.innerText.trim();
          const label = labelEl && labelEl.innerText.trim() ? ' - ' + labelEl.innerText.trim() : '';
          document.title = name + label;
        }}
      }}
    }}

    function printCV() {{
      updateDocTitle();
      window.print();
    }}

    function switchPersona(newPersona) {{
      const panels = document.querySelectorAll('.cv-persona-panel');
      panels.forEach(p => {{
        p.style.display = 'none';
        p.classList.remove('active');
      }});

      const target = document.getElementById('cv-persona-' + newPersona);
      if (target) {{
        target.style.display = 'block';
        target.classList.add('active');
      }}

      currentPersona = newPersona;
      localStorage.setItem('cv_active_persona', newPersona);
      updateActivePanelContent();
    }}

    function switchLayout(newLayout) {{
      currentLayout = newLayout;
      localStorage.setItem('cv_standalone_layout', newLayout);
      updateActivePanelContent();
    }}

    function switchViewMode(newMode) {{
      currentViewMode = newMode;
      localStorage.setItem('cv_standalone_viewmode', newMode);
      updateActivePanelContent();
    }}

    function switchTheme(newTheme) {{
      const vp = document.getElementById('cv-viewport');
      if (vp) {{
        vp.className = 'container theme-' + newTheme;
      }}
      currentTheme = newTheme;
      localStorage.setItem('cv_standalone_theme', newTheme);
    }}

    function getActiveYaml() {{
      const el = document.getElementById('raw-yaml-' + currentPersona);
      return el ? el.textContent.trim() : '';
    }}

    function downloadActiveYaml() {{
      const content = getActiveYaml();
      if (!content) return;
      const filename = PERSONA_FILENAMES[currentPersona] || ('curriculo_' + currentPersona + '.yaml');
      const blob = new Blob([content], {{ type: 'text/yaml;charset=utf-8' }});
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
    }}

    async function downloadAllZip() {{
      if (!window.JSZip) {{
        alert('Biblioteca JSZip não encontrada.');
        return;
      }}
      const zip = new JSZip();
      const keys = ['professional', 'architect', 'historian', 'didactic', 'alien'];

      keys.forEach(k => {{
        const el = document.getElementById('raw-yaml-' + k);
        if (el) {{
          const fname = PERSONA_FILENAMES[k] || ('curriculo_' + k + '.yaml');
          zip.file(fname, el.textContent.trim());
        }}
      }});

      const fullHtml = '<!DOCTYPE html>\\n' + document.documentElement.outerHTML;
      zip.file('dashboard_curriculos_completo.html', fullHtml);

      const zipBlob = await zip.generateAsync({{ type: 'blob' }});
      const url = URL.createObjectURL(zipBlob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'pacote_completo_curriculos_5_versoes.zip';
      a.click();
      URL.revokeObjectURL(url);
    }}

    function copyActiveYaml() {{
      const content = getActiveYaml();
      if (!content) return;
      navigator.clipboard.writeText(content).then(() => {{
        const btn = document.getElementById('copy-btn');
        if (btn) {{
          const original = btn.innerText;
          btn.innerText = '✅ ' + (I18N_T.yaml_copied || 'Copiado!');
          setTimeout(() => {{ btn.innerText = original; }}, 2000);
        }}
      }}).catch(() => {{
        const textarea = document.createElement('textarea');
        textarea.value = content;
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
        const btn = document.getElementById('copy-btn');
        if (btn) {{
          const original = btn.innerText;
          btn.innerText = '✅ ' + (I18N_T.yaml_copied || 'Copiado!');
          setTimeout(() => {{ btn.innerText = original; }}, 2000);
        }}
      }});
    }}

    /* ── Photo Modal & Framing Handlers ── */
    function openPhotoModal() {{
      const modal = document.getElementById('photo-modal');
      const urlInput = document.getElementById('modal-url-input');
      modalPhotoInput = currentPhoto;
      modalPosX = currentPhotoPosX;
      modalPosY = currentPhotoPosY;
      modalScale = currentPhotoScale;

      if (urlInput) urlInput.value = currentPhoto.startsWith('data:') ? '' : currentPhoto;
      updateModalFramingUI();
      if (modal) modal.classList.add('active');
    }}

    function closePhotoModal(e) {{
      if (e && e.target && e.target.id !== 'photo-modal' && !e.target.classList.contains('cv-modal-close')) return;
      const modal = document.getElementById('photo-modal');
      if (modal) modal.classList.remove('active');
    }}

    function setModalPreviewShape(shape) {{
      modalPreviewShape = shape;
      const btnCircle = document.getElementById('shape-btn-circle');
      const btnRect = document.getElementById('shape-btn-rect');
      const box = document.getElementById('modal-preview-box');
      if (shape === 'circle') {{
        if (btnCircle) {{ btnCircle.classList.add('active'); btnCircle.style.border = '1.5px solid #10b981'; }}
        if (btnRect) {{ btnRect.classList.remove('active'); btnRect.style.border = 'none'; }}
        if (box) {{
          box.style.width = '120px';
          box.style.height = '120px';
          box.style.borderRadius = '50%';
        }}
      }} else {{
        if (btnCircle) {{ btnCircle.classList.remove('active'); btnCircle.style.border = 'none'; }}
        if (btnRect) {{ btnRect.classList.add('active'); btnRect.style.border = '1.5px solid #10b981'; }}
        if (box) {{
          box.style.width = '100px';
          box.style.height = '135px';
          box.style.borderRadius = '8px';
        }}
      }}
    }}

    function updateModalFramingUI() {{
      const previewImg = document.getElementById('modal-preview-img');
      const previewPh = document.getElementById('modal-preview-placeholder');
      const removeBtn = document.getElementById('modal-remove-btn');
      const controls = document.getElementById('modal-framing-controls');
      const dragHint = document.getElementById('modal-drag-hint-text');

      const scaleLabel = document.getElementById('modal-scale-label');
      const scaleSlider = document.getElementById('modal-scale-slider');
      const posxLabel = document.getElementById('modal-posx-label');
      const posxSlider = document.getElementById('modal-posx-slider');
      const posyLabel = document.getElementById('modal-posy-label');
      const posySlider = document.getElementById('modal-posy-slider');

      if (scaleLabel) scaleLabel.innerText = modalScale.toFixed(2) + 'x';
      if (scaleSlider) scaleSlider.value = modalScale;
      if (posxLabel) posxLabel.innerText = modalPosX + '%';
      if (posxSlider) posxSlider.value = modalPosX;
      if (posyLabel) posyLabel.innerText = modalPosY + '%';
      if (posySlider) posySlider.value = modalPosY;

      if (modalPhotoInput) {{
        if (previewImg) {{
          previewImg.src = modalPhotoInput;
          previewImg.style.display = 'block';
          previewImg.style.objectPosition = modalPosX + '% ' + modalPosY + '%';
          previewImg.style.transform = 'scale(' + modalScale + ')';
          previewImg.style.transformOrigin = modalPosX + '% ' + modalPosY + '%';
        }}
        if (previewPh) previewPh.style.display = 'none';
        if (removeBtn) removeBtn.style.display = 'block';
        if (controls) controls.style.display = 'flex';
        if (dragHint) dragHint.style.display = 'block';
      }} else {{
        if (previewImg) {{ previewImg.src = ''; previewImg.style.display = 'none'; }}
        if (previewPh) previewPh.style.display = 'block';
        if (removeBtn) removeBtn.style.display = 'none';
        if (controls) controls.style.display = 'none';
        if (dragHint) dragHint.style.display = 'none';
      }}
    }}

    function onModalScaleChange(val) {{
      modalScale = parseFloat(val) || 1.0;
      updateModalFramingUI();
    }}

    function onModalPosXChange(val) {{
      modalPosX = parseInt(val) || 50;
      updateModalFramingUI();
    }}

    function onModalPosYChange(val) {{
      modalPosY = parseInt(val) || 50;
      updateModalFramingUI();
    }}

    function resetModalFraming() {{
      modalPosX = 50;
      modalPosY = 50;
      modalScale = 1.0;
      updateModalFramingUI();
    }}

    function handlePhotoFileUpload(e) {{
      const file = e.target.files && e.target.files[0];
      if (!file) return;
      if (!file.type.startsWith('image/')) {{
        alert('Por favor, selecione um arquivo de imagem válido (JPG, PNG, WebP).');
        return;
      }}
      const reader = new FileReader();
      reader.onload = function(evt) {{
        modalPhotoInput = evt.target.result;
        updateModalFramingUI();
      }};
      reader.readAsDataURL(file);
    }}

    function handlePhotoUrlInput(val) {{
      modalPhotoInput = val.trim();
      updateModalFramingUI();
    }}

    function onPhotoPreviewError() {{
      const previewImg = document.getElementById('modal-preview-img');
      const previewPh = document.getElementById('modal-preview-placeholder');
      if (previewImg) previewImg.style.display = 'none';
      if (previewPh) previewPh.style.display = 'block';
    }}

    function removeModalPhoto() {{
      const urlInput = document.getElementById('modal-url-input');
      if (urlInput) urlInput.value = '';
      modalPhotoInput = '';
      updateModalFramingUI();
    }}

    function clearAndSaveNoPhoto() {{
      currentPhoto = '';
      currentPhotoPosX = 50;
      currentPhotoPosY = 50;
      currentPhotoScale = 1.0;
      localStorage.removeItem('cv_user_photo');
      localStorage.removeItem('cv_user_photo_pos_x');
      localStorage.removeItem('cv_user_photo_pos_y');
      localStorage.removeItem('cv_user_photo_scale');
      applyPhotoToAll('', 50, 50, 1.0);
      closePhotoModal();
    }}

    function saveAndApplyPhoto() {{
      currentPhoto = modalPhotoInput;
      currentPhotoPosX = modalPosX;
      currentPhotoPosY = modalPosY;
      currentPhotoScale = modalScale;

      if (currentPhoto) {{
        localStorage.setItem('cv_user_photo', currentPhoto);
        localStorage.setItem('cv_user_photo_pos_x', currentPhotoPosX);
        localStorage.setItem('cv_user_photo_pos_y', currentPhotoPosY);
        localStorage.setItem('cv_user_photo_scale', currentPhotoScale);
      }} else {{
        localStorage.removeItem('cv_user_photo');
        localStorage.removeItem('cv_user_photo_pos_x');
        localStorage.removeItem('cv_user_photo_pos_y');
        localStorage.removeItem('cv_user_photo_scale');
      }}
      applyPhotoToAll(currentPhoto, currentPhotoPosX, currentPhotoPosY, currentPhotoScale);
      closePhotoModal();
    }}

    function applyPhotoToAll(photoSrc, posX = currentPhotoPosX, posY = currentPhotoPosY, scale = currentPhotoScale) {{
      const root = document.getElementById('cv-viewport') || document.documentElement;
      if (root) {{
        root.style.setProperty('--cv-avatar-pos-x', posX + '%');
        root.style.setProperty('--cv-avatar-pos-y', posY + '%');
        root.style.setProperty('--cv-avatar-scale', scale);
      }}
      const containers = document.querySelectorAll('.cv-avatar-container');
      containers.forEach(c => {{
        const img = c.querySelector('.cv-avatar-img');
        const ph = c.querySelector('.cv-avatar-placeholder');
        if (photoSrc) {{
          c.classList.add('has-photo');
          if (img) {{
            img.src = photoSrc;
            img.style.display = 'block';
            img.style.objectPosition = posX + '% ' + posY + '%';
            img.style.transform = 'scale(' + scale + ')';
            img.style.transformOrigin = posX + '% ' + posY + '%';
          }}
          if (ph) ph.style.display = 'none';
        }} else {{
          c.classList.remove('has-photo');
          if (img) {{ img.src = ''; img.style.display = 'none'; }}
          if (ph) ph.style.display = 'flex';
        }}
      }});
    }}

    function initPhotoDragListeners() {{
      const box = document.getElementById('modal-preview-box');
      if (!box) return;

      function startDrag(clientX, clientY) {{
        if (!modalPhotoInput) return;
        isDragging = true;
        dragStartX = clientX;
        dragStartY = clientY;
        dragInitPosX = modalPosX;
        dragInitPosY = modalPosY;
        box.style.cursor = 'grabbing';
      }}

      function moveDrag(clientX, clientY) {{
        if (!isDragging) return;
        const deltaX = clientX - dragStartX;
        const deltaY = clientY - dragStartY;
        modalPosX = Math.min(100, Math.max(0, Math.round(dragInitPosX - deltaX * 0.4)));
        modalPosY = Math.min(100, Math.max(0, Math.round(dragInitPosY - deltaY * 0.4)));
        updateModalFramingUI();
      }}

      function endDrag() {{
        if (isDragging) {{
          isDragging = false;
          box.style.cursor = 'grab';
        }}
      }}

      box.addEventListener('mousedown', function(e) {{
        e.preventDefault();
        startDrag(e.clientX, e.clientY);
      }});
      window.addEventListener('mousemove', function(e) {{
        moveDrag(e.clientX, e.clientY);
      }});
      window.addEventListener('mouseup', endDrag);

      box.addEventListener('touchstart', function(e) {{
        if (e.touches && e.touches[0]) {{
          startDrag(e.touches[0].clientX, e.touches[0].clientY);
        }}
      }}, {{ passive: true }});
      window.addEventListener('touchmove', function(e) {{
        if (e.touches && e.touches[0]) {{
          moveDrag(e.touches[0].clientX, e.touches[0].clientY);
        }}
      }}, {{ passive: true }});
      window.addEventListener('touchend', endDrag);
    }}

    let currentDesign = {{
      fontHeading: '{design_config.get("fontHeading", "Plus Jakarta Sans") if design_config else "Plus Jakarta Sans"}',
      fontBody: '{design_config.get("fontBody", "Inter") if design_config else "Inter"}',
      fontScale: {design_config.get("fontScale", 1.0) if design_config else 1.0},
      colorPrimary: '{design_config.get("colorPrimary", "#0284c7") if design_config else "#0284c7"}',
      colorSecondary: '{design_config.get("colorSecondary", "#0369a1") if design_config else "#0369a1"}',
      colorAccent: '{design_config.get("colorAccent", "#f97316") if design_config else "#f97316"}',
      colorSurface: '{design_config.get("colorSurface", "#f8fafc") if design_config else "#f8fafc"}',
      colorBg: '{design_config.get("colorBg", "#ffffff") if design_config else "#ffffff"}',
      colorText: '{design_config.get("colorText", "#0f172a") if design_config else "#0f172a"}',
      colorSidebar: '{design_config.get("colorSidebar", "#0f172a") if design_config else "#0f172a"}',
      colorWorkspaceBg: '{design_config.get("colorWorkspaceBg", "#0b0f19") if design_config else "#0b0f19"}',
      backgroundPattern: '{resolved_bg}'
    }};

    const TEXTURE_MAP = {{
      'none': 'none',
      'bg-grid-tech': 'https://www.heisslab.com.br/cv-backgrounds/bg-grid-tech.jpg',
      'bg-luxury-minimal': 'https://www.heisslab.com.br/cv-backgrounds/bg-luxury-minimal.jpg',
      'bg-geometric-line': 'https://www.heisslab.com.br/cv-backgrounds/bg-geometric-line.jpg',
      'bg-corporate-waves': 'https://www.heisslab.com.br/cv-backgrounds/bg-corporate-waves.jpg',
      'bg-stationery-clean': 'https://www.heisslab.com.br/cv-backgrounds/bg-stationery-clean.jpg',
      'bg-technical-blueprint': 'https://www.heisslab.com.br/cv-backgrounds/bg-technical-blueprint.jpg',
      '/cv-backgrounds/bg-grid-tech.jpg': 'https://www.heisslab.com.br/cv-backgrounds/bg-grid-tech.jpg',
      '/cv-backgrounds/bg-luxury-minimal.jpg': 'https://www.heisslab.com.br/cv-backgrounds/bg-luxury-minimal.jpg',
      '/cv-backgrounds/bg-geometric-line.jpg': 'https://www.heisslab.com.br/cv-backgrounds/bg-geometric-line.jpg',
      '/cv-backgrounds/bg-corporate-waves.jpg': 'https://www.heisslab.com.br/cv-backgrounds/bg-corporate-waves.jpg',
      '/cv-backgrounds/bg-stationery-clean.jpg': 'https://www.heisslab.com.br/cv-backgrounds/bg-stationery-clean.jpg',
      '/cv-backgrounds/bg-technical-blueprint.jpg': 'https://www.heisslab.com.br/cv-backgrounds/bg-technical-blueprint.jpg'
    }};

    function openDesignModal() {{
      const modal = document.getElementById('design-modal');
      if (modal) modal.classList.add('active');
    }}

    function closeDesignModal(event) {{
      if (event && event.target !== event.currentTarget) return;
      const modal = document.getElementById('design-modal');
      if (modal) modal.classList.remove('active');
    }}

    function applyFontPreset(heading, body) {{
      currentDesign.fontHeading = heading;
      currentDesign.fontBody = body;
      saveAndApplyDesign();
    }}

    function applyFontScale(val) {{
      const num = parseFloat(val) || 1.0;
      currentDesign.fontScale = num;
      const lbl = document.getElementById('font-scale-val');
      if (lbl) lbl.innerText = num.toFixed(2) + 'x';
      saveAndApplyDesign();
    }}

    function applyColorPreset(primary, secondary, accent, surface, bg, text, sidebar = '#0f172a') {{
      currentDesign.colorPrimary = primary;
      currentDesign.colorSecondary = secondary;
      currentDesign.colorAccent = accent;
      currentDesign.colorSurface = surface;
      currentDesign.colorBg = bg;
      currentDesign.colorText = text;
      currentDesign.colorSidebar = sidebar;
      saveAndApplyDesign();
    }}

    function applyBgPattern(url) {{
      const resolved = TEXTURE_MAP[url] || (url && url.startsWith('/') ? 'https://www.heisslab.com.br' + url : url);
      currentDesign.backgroundPattern = (url === 'none' ? 'none' : (resolved || 'none'));
      saveAndApplyDesign();
    }}

    function resetDesign() {{
      currentDesign = {{
        fontHeading: 'Plus Jakarta Sans',
        fontBody: 'Inter',
        fontScale: 1.0,
        colorPrimary: '#0284c7',
        colorSecondary: '#0369a1',
        colorAccent: '#f97316',
        colorSurface: '#f8fafc',
        colorBg: '#ffffff',
        colorText: '#0f172a',
        colorSidebar: '#0f172a',
        colorWorkspaceBg: '#0b0f19',
        backgroundPattern: '{resolved_bg}'
      }};
      localStorage.removeItem('cv_design_config');
      applyDesignToViewport();
      const slider = document.getElementById('font-scale-slider');
      if (slider) slider.value = '1.0';
      const lbl = document.getElementById('font-scale-val');
      if (lbl) lbl.innerText = '1.00x';
    }}

    function saveAndApplyDesign() {{
      localStorage.setItem('cv_design_config', JSON.stringify(currentDesign));
      applyDesignToViewport();
    }}

    function applyDesignToViewport() {{
      const vp = document.getElementById('cv-viewport');
      if (!vp) return;
      vp.style.setProperty('--cv-font-heading', '"' + currentDesign.fontHeading + '", sans-serif');
      vp.style.setProperty('--cv-font-body', '"' + currentDesign.fontBody + '", sans-serif');
      vp.style.setProperty('--cv-font-scale', currentDesign.fontScale);
      vp.style.setProperty('--cv-color-primary', currentDesign.colorPrimary);
      vp.style.setProperty('--cv-color-secondary', currentDesign.colorSecondary);
      vp.style.setProperty('--cv-color-accent', currentDesign.colorAccent);
      vp.style.setProperty('--cv-color-surface', currentDesign.colorSurface);
      vp.style.setProperty('--cv-color-bg', currentDesign.colorBg);
      vp.style.setProperty('--cv-color-text', currentDesign.colorText);
      vp.style.setProperty('--cv-color-sidebar', currentDesign.colorSidebar || '#0f172a');
      vp.style.setProperty('--cv-color-workspace-bg', currentDesign.colorWorkspaceBg || '#0b0f19');
      document.body.style.background = currentDesign.colorWorkspaceBg || '#0b0f19';
      vp.style.setProperty('--cv-bg-image', currentDesign.backgroundPattern && currentDesign.backgroundPattern !== 'none' ? 'url("' + currentDesign.backgroundPattern + '")' : 'none');
    }}

    // Auto-restore saved preferences & setup listeners
    (function() {{
      const savedTheme = localStorage.getItem('cv_standalone_theme') || '{valid_theme}';
      const savedPersona = localStorage.getItem('cv_active_persona') || '{active_persona}';
      const savedLayout = localStorage.getItem('cv_standalone_layout') || '{valid_layout}';
      const savedViewMode = localStorage.getItem('cv_standalone_viewmode') || '{view_mode}';
      const savedPhoto = localStorage.getItem('cv_user_photo');
      const savedPosX = localStorage.getItem('cv_user_photo_pos_x');
      const savedPosY = localStorage.getItem('cv_user_photo_pos_y');
      const savedScale = localStorage.getItem('cv_user_photo_scale');
      const savedDesign = localStorage.getItem('cv_design_config');

      if (savedDesign) {{
        try {{
          currentDesign = Object.assign(currentDesign, JSON.parse(savedDesign));
          const slider = document.getElementById('font-scale-slider');
          if (slider) slider.value = currentDesign.fontScale;
          const lbl = document.getElementById('font-scale-val');
          if (lbl) lbl.innerText = Number(currentDesign.fontScale).toFixed(2) + 'x';
        }} catch(e) {{}}
      }}
      applyDesignToViewport();

      const pSel = document.getElementById('persona-switcher');
      if (pSel && pSel.querySelector('option[value="' + savedPersona + '"]')) {{
        pSel.value = savedPersona;
        currentPersona = savedPersona;
      }}

      const lSel = document.getElementById('layout-switcher');
      if (lSel && lSel.querySelector('option[value="' + savedLayout + '"]')) {{
        lSel.value = savedLayout;
        currentLayout = savedLayout;
      }}

      const vSel = document.getElementById('viewmode-switcher');
      if (vSel && vSel.querySelector('option[value="' + savedViewMode + '"]')) {{
        vSel.value = savedViewMode;
        currentViewMode = savedViewMode;
      }}

      const tSel = document.getElementById('theme-switcher');
      if (tSel) {{
        tSel.value = savedTheme;
        switchTheme(savedTheme);
      }}

      if (savedPhoto) {{
        currentPhoto = savedPhoto;
      }}
      if (savedPosX !== null) {{
        currentPhotoPosX = parseInt(savedPosX) || 50;
      }}
      if (savedPosY !== null) {{
        currentPhotoPosY = parseInt(savedPosY) || 50;
      }}
      if (savedScale !== null) {{
        currentPhotoScale = parseFloat(savedScale) || 1.0;
      }}

      applyPhotoToAll(currentPhoto, currentPhotoPosX, currentPhotoPosY, currentPhotoScale);
      initPhotoDragListeners();
      switchPersona(currentPersona);
    }})();
  </script>
</body>
</html>
"""
    return html_content


def render_cv_to_standalone_html(
    yaml_or_dict: Any,
    theme: str = "executive",
    layout: str = "dynamic_math",
    lang: str = "auto",
    view_mode: str = "cv",
    background_pattern: Optional[str] = None,
    design_config: Optional[dict] = None
) -> str:
    """Compatibilidade para renderização individual delegando para a engine multi-dashboard."""
    return render_multi_cv_dashboard_html(
        {"professional": yaml_or_dict},
        default_persona="professional",
        default_theme=theme,
        default_layout=layout,
        lang=lang,
        view_mode=view_mode,
        background_pattern=background_pattern,
        design_config=design_config
    )
