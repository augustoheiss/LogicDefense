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
    },
    "en": {
        "print_btn": "🖨️ Print / Save as PDF",
        "download_yaml": "📥 Download YAML",
        "download_zip": "📦 Download 5 CVs (ZIP)",
        "copy_yaml": "📋 Copy YAML",
        "yaml_copied": "Copied!",
        "photo_btn": "📷 Photo / Avatar",
        "photo_modal_title": "📷 Profile Photo / Avatar",
        "photo_modal_desc": "Upload your profile photo or insert a direct image URL (e.g., LinkedIn, GitHub or CDN).",
        "photo_choose_file": "📁 Upload from Device",
        "photo_remove": "🗑️ Remove Photo",
        "photo_url_label": "Or paste a direct image URL:",
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
    },
}

def get_grid_class(count: int) -> str:
    """
    Retorna a classe CSS de grid dinâmico com base na contagem exata de itens:
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
    recipient = html.escape(cover_letter.get("recipient", "Prezada Equipe de Recrutamento"))
    company = html.escape(cover_letter.get("company", "Empresa Contratante"))
    subject = html.escape(cover_letter.get("subject", f"Candidatura à Oportunidade em {label or 'Tecnologia'}"))
    date_val = html.escape(cover_letter.get("date", "São Paulo, SP"))
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


def _render_cv_layout_html(data: dict, layout: str, t: dict, view_mode: str = "cv") -> str:
    """
    Renderiza o HTML do currículo aplicando o Blueprint de Layout correspondente
    (modular, linear, sidebar, compact_split, editorial_accent, corporate_timeline,
    warm_magazine, hero_matrix, dynamic_math).
    """
    if view_mode == "cover_letter":
        return _render_cover_letter_html(data, t)

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

    # Avatar Component
    avatar_html = f"""
      <div class="cv-avatar-container {'has-photo' if has_image else ''}" onclick="openPhotoModal()" title="{t['photo_btn']}">
        <img class="cv-avatar-img" src="{image_val if has_image else ''}" alt="Avatar" style="{'display:block;' if has_image else 'display:none;'}" />
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
        hl_html = "".join(f"<li>{html.escape(h)}</li>" for h in highlights)

        projects_items_html += f"""
        <div class="project-card cv-math-project-card avoid-break">
            <div class="item-header">
                <span class="item-title">{f'<a href="{pr_url}" target="_blank">{name} ↗</a>' if pr_url else name}</span>
            </div>
            <p class="item-desc">{desc}</p>
            {f'<ul class="bullets" style="margin-bottom: 0.4rem;">{hl_html}</ul>' if highlights else ''}
            <div class="tags cv-math-tags">{kws}</div>
        </div>
        """

    # Skills Group
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

    # Languages
    lang_cards_html = "".join(
        f"""
        <div class="lang-card avoid-break">
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

            <div class="cv-editorial-grid">
                <aside class="cv-editorial-left">
                    <div class="sidebar-section">
                        <h4 class="section-title" style="font-size: 0.85rem;">CONTATO</h4>
                        <div class="contacts" style="font-size: 0.8rem; line-height: 1.5;">
                            {f'<div>✉ {html.escape(email_val)}</div>' if email_val else ''}
                            {f'<div>📞 {html.escape(phone_val)}</div>' if phone_val else ''}
                            {f'<div>📍 {html.escape(loc_str)}</div>' if loc_str else ''}
                            {f'<div>🌐 <a href="{html.escape(url_val)}" target="_blank" class="cv-link">{html.escape(url_val)}</a></div>' if url_val else ''}
                        </div>
                    </div>
                    {f'<div class="sidebar-section"><h4 class="section-title" style="font-size: 0.85rem;">{t["skills"]}</h4><div style="display:flex; flex-direction:column; gap:0.4rem;">{skills_items_html}</div></div>' if skills else ''}
                    {f'<div class="sidebar-section"><h4 class="section-title" style="font-size: 0.85rem;">{t["languages"]}</h4><div style="display:flex; flex-direction:column; gap:0.35rem;">{lang_cards_html}</div></div>' if languages else ''}
                    {f'<div class="sidebar-section"><h4 class="section-title" style="font-size: 0.85rem;">{t["certificates"]}</h4><div style="display:flex; flex-direction:column; gap:0.4rem;">{certificates_items_html}</div></div>' if certificates else ''}
                </aside>

                <main class="cv-editorial-main">
                    {f'<div class="summary" style="margin-bottom: 1.25rem;">{html.escape(basics.get("summary", "")).replace(chr(10), "<br>")}</div>' if basics.get("summary") else ''}
                    {f'<section class="avoid-break"><h2 class="section-title">{t["work"]}</h2>{work_items_html}</section>' if work else ''}
                    {f'<section class="avoid-break"><h2 class="section-title">{t["projects"]}</h2><div class="projects-grid {get_grid_class(len(projects))}">{projects_items_html}</div></section>' if projects else ''}
                    {f'<section class="avoid-break"><h2 class="section-title">{t["education"]}</h2><div class="education-grid {get_grid_class(len(education))}">{education_items_html}</div></section>' if education else ''}
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
                <aside class="cv-navy-sidebar" style="background: #0f172a; color: #f8fafc; padding: 1.5rem; border-radius: 8px; display: flex; flex-direction: column; gap: 1.1rem;">
                    {avatar_html}
                    <div style="text-align: center;">
                        <h2 style="font-size: 1.3rem; margin: 0 0 0.25rem 0; font-weight: 800; color: #fff;">{html.escape(basics.get("name", ""))}</h2>
                        <div style="font-size: 0.85rem; color: #f97316; font-weight: 700;">{html.escape(basics.get("label", ""))}</div>
                    </div>
                    <div class="contacts" style="font-size: 0.8rem; line-height: 1.45; border-top: 1px solid rgba(255,255,255,0.15); padding-top: 0.85rem;">
                        {f'<div>✉ {html.escape(email_val)}</div>' if email_val else ''}
                        {f'<div>📞 {html.escape(phone_val)}</div>' if phone_val else ''}
                        {f'<div>📍 {html.escape(loc_str)}</div>' if loc_str else ''}
                    </div>
                    {f'<div><h4 style="font-size: 0.85rem; color: #f8fafc; border-bottom: 1px solid rgba(255,255,255,0.2); padding-bottom: 0.25rem; margin-bottom: 0.5rem;">{t["skills"]}</h4>{skills_items_html}</div>' if skills else ''}
                    {f'<div><h4 style="font-size: 0.85rem; color: #f8fafc; border-bottom: 1px solid rgba(255,255,255,0.2); padding-bottom: 0.25rem; margin-bottom: 0.5rem;">{t["languages"]}</h4>{lang_cards_html}</div>' if languages else ''}
                </aside>

                <main class="cv-navy-main">
                    {f'<div class="summary">{html.escape(basics.get("summary", "")).replace(chr(10), "<br>")}</div>' if basics.get("summary") else ''}
                    {f'<section class="avoid-break"><h2 class="section-title">{t["work"]}</h2>{work_items_html}</section>' if work else ''}
                    {f'<section class="avoid-break"><h2 class="section-title">{t["education"]}</h2><div class="education-grid {get_grid_class(len(education))}">{education_items_html}</div></section>' if education else ''}
                    {f'<section class="avoid-break"><h2 class="section-title">{t["projects"]}</h2><div class="projects-grid {get_grid_class(len(projects))}">{projects_items_html}</div></section>' if projects else ''}
                    {f'<section class="avoid-break"><h2 class="section-title">{t["certificates"]}</h2><div class="certs-grid {get_grid_class(len(certificates))}">{certificates_items_html}</div></section>' if certificates else ''}
                </main>
            </div>
        </div>
        """

    # ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    # 4. MODELO A4 08: Hero Matrix
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
                {avatar_html}
            </header>

            {f'<div class="summary" style="margin-bottom: 1rem;">{html.escape(basics.get("summary", "")).replace(chr(10), "<br>")}</div>' if basics.get("summary") else ''}

            <div style="display: grid; grid-template-columns: 1.2fr 1fr; gap: 1.25rem; margin-bottom: 1rem;">
                <div>
                    {f'<section class="avoid-break"><h2 class="section-title">{t["work"]}</h2>{work_items_html}</section>' if work else ''}
                </div>
                <div>
                    {f'<section class="avoid-break"><h2 class="section-title">{t["education"]}</h2><div class="education-grid {get_grid_class(len(education))}">{education_items_html}</div></section>' if education else ''}
                    {f'<section class="avoid-break"><h2 class="section-title">{t["projects"]}</h2><div class="projects-grid {get_grid_class(len(projects))}">{projects_items_html}</div></section>' if projects else ''}
                </div>
            </div>

            {f'<section class="avoid-break"><h2 class="section-title">{t["skills"]}</h2><div class="skills-grid {get_grid_class(len(skills))}">{skills_items_html}</div></section>' if skills else ''}
            {f'<section class="avoid-break"><h2 class="section-title">{t["languages"]}</h2><div class="languages-grid {get_grid_class(len(languages))}">{lang_cards_html}</div></section>' if languages else ''}
            {f'<section class="avoid-break"><h2 class="section-title">{t["certificates"]}</h2><div class="certs-grid {get_grid_class(len(certificates))}">{certificates_items_html}</div></section>' if certificates else ''}
        </div>
        """

    # ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    # 5. MODELO A4 03: Executive Sidebar & 04: Compact Split Duo
    # ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    elif layout in ["sidebar", "compact_split"]:
        cv_body = f"""
        <div class="layout-{layout}">
            <div style="display: grid; grid-template-columns: 230px 1fr; gap: 1.5rem;">
                <aside style="border-right: 1px solid rgba(125,125,125,0.2); padding-right: 1.25rem; display: flex; flex-direction: column; gap: 1.1rem;">
                    {avatar_html}
                    <div>
                        <h2 class="name" style="font-size: 1.25rem; font-weight: 800; margin: 0 0 0.2rem 0;">{html.escape(basics.get("name", ""))}</h2>
                        <div class="label" style="font-size: 0.85rem; opacity: 0.85; font-weight: 600;">{html.escape(basics.get("label", ""))}</div>
                    </div>
                    <div class="contacts" style="font-size: 0.8rem; line-height: 1.45;">
                        {f'<div>✉ {html.escape(email_val)}</div>' if email_val else ''}
                        {f'<div>📞 {html.escape(phone_val)}</div>' if phone_val else ''}
                        {f'<div>📍 {html.escape(loc_str)}</div>' if loc_str else ''}
                        {f'<div>🌐 <a href="{html.escape(url_val)}" target="_blank" class="cv-link">{html.escape(url_val)}</a></div>' if url_val else ''}
                    </div>
                    {f'<div><h4 class="section-title" style="font-size: 0.82rem;">{t["skills"]}</h4>{skills_items_html}</div>' if skills else ''}
                    {f'<div><h4 class="section-title" style="font-size: 0.82rem;">{t["languages"]}</h4>{lang_cards_html}</div>' if languages else ''}
                    {f'<div><h4 class="section-title" style="font-size: 0.82rem;">{t["certificates"]}</h4>{certificates_items_html}</div>' if certificates else ''}
                </aside>

                <main>
                    {f'<div class="summary">{html.escape(basics.get("summary", "")).replace(chr(10), "<br>")}</div>' if basics.get("summary") else ''}
                    {f'<section class="avoid-break"><h2 class="section-title">{t["work"]}</h2>{work_items_html}</section>' if work else ''}
                    {f'<section class="avoid-break"><h2 class="section-title">{t["projects"]}</h2><div class="projects-grid {get_grid_class(len(projects))}">{projects_items_html}</div></section>' if projects else ''}
                    {f'<section class="avoid-break"><h2 class="section-title">{t["education"]}</h2><div class="education-grid {get_grid_class(len(education))}">{education_items_html}</div></section>' if education else ''}
                </main>
            </div>
        </div>
        """

    # ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    # 6. MODELO A4 01 (Modular), 02 (Linear) e 07 (Warm Magazine)
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

            {f'<section class="avoid-break"><h2 class="section-title">{t["projects"]}</h2><div class="projects-grid {get_grid_class(len(projects))}">{projects_items_html}</div></section>' if projects else ''}

            {f'<section class="avoid-break"><h2 class="section-title">{t["skills"]}</h2><div class="skills-grid {get_grid_class(len(skills))}">{skills_items_html}</div></section>' if skills else ''}

            {f'<section class="avoid-break"><h2 class="section-title">{t["education"]}</h2><div class="education-grid {get_grid_class(len(education))}">{education_items_html}</div></section>' if education else ''}

            {f'<section class="avoid-break"><h2 class="section-title">{t["certificates"]}</h2><div class="certs-grid {get_grid_class(len(certificates))}">{certificates_items_html}</div></section>' if certificates else ''}

            {f'<section class="avoid-break"><h2 class="section-title">{t["publications"]}</h2>{publications_html}</section>' if publications else ''}

            {f'<section class="avoid-break"><h2 class="section-title">{t["languages"]}</h2><div class="languages-grid {get_grid_class(len(languages))}">{lang_cards_html}</div></section>' if languages else ''}

            {f'<section class="avoid-break"><h2 class="section-title">{t["interests"]}</h2><div class="interests-grid {get_grid_class(len(interests))}">{interest_items_html}</div></section>' if interests else ''}
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
    view_mode: str = "cv"
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

    html_content = f"""<!DOCTYPE html>
<html lang="{selected_lang}">
<head>
  <meta charset="UTF-8">
  <title>{html.escape(candidate_name)} — Central de Currículos Multi-Persona</title>
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <script src="https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js"></script>
  <script src="https://cdnjs.cloudflare.com/ajax/libs/js-yaml/4.1.0/js-yaml.min.js"></script>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Courier+Prime:wght@400;700&family=Inter:wght@400;500;600;700;800&family=Merriweather:wght@300;400;700&family=Poppins:wght@400;600;700;800&family=Cinzel:wght@600;800&family=Plus+Jakarta+Sans:wght@400;600;700;800&display=swap');

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
      background: #ffffff;
      padding: 2.5rem 3rem;
      border-radius: 12px;
      box-shadow: 0 12px 40px rgba(0,0,0,0.2);
      transition: all 0.2s ease;
      min-height: 297mm;
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
      font-size: 1.8rem;
      font-weight: 800;
      line-height: 1.15;
      margin-bottom: 0.25rem;
    }}
    .label {{
      font-size: 0.95rem;
      font-weight: 600;
      line-height: 1.35;
    }}
    .contacts {{
      font-size: 0.8rem;
      line-height: 1.5;
      text-align: right;
      flex-shrink: 0;
    }}
    .summary {{
      font-size: 0.88rem;
      line-height: 1.6;
      text-align: justify;
      margin-bottom: 1.25rem;
    }}

    .section-title {{
      font-size: 0.95rem;
      font-weight: 800;
      letter-spacing: 0.04em;
      text-transform: uppercase;
      padding-bottom: 0.35rem;
      margin-top: 1.25rem;
      margin-bottom: 0.85rem;
      display: flex;
      align-items: center;
      gap: 0.4rem;
    }}

    .card {{
      margin-bottom: 0.9rem;
    }}
    .item-header {{
      display: flex;
      justify-content: space-between;
      align-items: baseline;
      font-weight: 700;
      font-size: 0.92rem;
      margin-bottom: 0.15rem;
    }}
    .item-title {{ font-weight: 700; }}
    .item-date {{
      font-size: 0.78rem;
      font-weight: 600;
      opacity: 0.85;
      white-space: nowrap;
    }}
    .item-sub {{
      font-size: 0.82rem;
      font-weight: 600;
      margin-bottom: 0.3rem;
    }}
    .item-desc {{
      font-size: 0.82rem;
      line-height: 1.5;
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

    /* ── Mathematical Dynamic Grid System ── */
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

    /* ── Cards & Tags ── */
    .project-card, .skill-group, .geo-card, .interest-card, .lang-card,
    .cv-math-project-card, .cv-math-skill-card, .cv-math-edu-card, .cv-math-cert-card, .cv-math-interest-card {{
      padding: 0.85rem;
      border-radius: 6px;
      box-sizing: border-box;
      display: flex;
      flex-direction: column;
      gap: 0.35rem;
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

    .layout-editorial_accent .cv-editorial-grid {{
      display: grid;
      grid-template-columns: 220px 1fr;
      gap: 1.75rem;
      align-items: start;
    }}
    .layout-editorial_accent .cv-editorial-left {{
      display: flex;
      flex-direction: column;
      gap: 1.1rem;
      min-width: 0;
    }}
    .layout-editorial_accent .cv-editorial-main {{
      display: flex;
      flex-direction: column;
      gap: 1.25rem;
      min-width: 0;
    }}

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
      .cv-avatar-container {{
        border-width: 2px !important;
        box-shadow: none !important;
      }}
      .cv-avatar-container:not(.has-photo) {{
        display: none !important;
      }}
      .cv-avatar-placeholder {{
        display: none !important;
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

  <!-- Photo Uploader Modal -->
  <div id="photo-modal" class="cv-modal-backdrop" onclick="closePhotoModal(event)">
    <div class="cv-modal-card" onclick="event.stopPropagation()">
      <div class="cv-modal-header">
        <h3>{t['photo_modal_title']}</h3>
        <button class="cv-modal-close" onclick="closePhotoModal()">✕</button>
      </div>
      <div class="cv-modal-body">
        <p style="margin: 0; font-size: 0.85rem; color: #94a3b8;">
          {t['photo_modal_desc']}
        </p>

        <div style="display: flex; align-items: center; justify-content: center; gap: 1.5rem; padding: 1rem; background: #06090f; border-radius: 8px;">
          <div style="width: 82px; height: 82px; border-radius: 50%; overflow: hidden; border: 2.5px solid #10b981; display: flex; align-items: center; justify-content: center; background: #1e293b; flex-shrink: 0;">
            <img id="modal-preview-img" src="" alt="Preview" style="width: 100%; height: 100%; object-fit: cover; display: none;" onerror="onPhotoPreviewError()" />
            <span id="modal-preview-placeholder" style="font-size: 2rem;">👤</span>
          </div>
          <div style="display: flex; flex-direction: column; gap: 0.5rem;">
            <label class="modal-btn modal-btn-sec" style="cursor: pointer; text-align: center; display: inline-block;">
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

  <!-- Raw Embedded YAMLs -->
  {scripts_yaml_html}

  <script>
    let currentPersona = '{active_persona}';
    let currentTheme = '{valid_theme}';
    let currentLayout = '{valid_layout}';
    let currentViewMode = '{view_mode}';
    let currentPhoto = '';

    const PERSONA_FILENAMES = {{
        'professional': 'curriculo_executivo_ibm.yaml',
        'architect': 'curriculo_arquiteto_ia.yaml',
        'historian': 'curriculo_biografo.yaml',
        'didactic': 'curriculo_didatico.yaml',
        'alien': 'curriculo_alien.yaml'
    }};

    const I18N_T = {yaml.safe_dump(t, sort_keys=False)};

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

    function parseActiveYamlData(personaKey) {{
      const el = document.getElementById('raw-yaml-' + personaKey);
      if (!el) return {{}};
      try {{
        if (window.jsyaml && window.jsyaml.load) {{
          return window.jsyaml.load(el.textContent) || {{}};
        }}
      }} catch (e) {{
        console.warn('Erro ao parsear YAML client-side:', e);
      }}
      return {{}};
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

      const avatarHtml = `
        <div class="cv-avatar-container ${{hasPhoto ? 'has-photo' : ''}}" onclick="openPhotoModal()" title="${{I18N_T.photo_btn || 'Foto'}}">
          <img class="cv-avatar-img" src="${{hasPhoto ? photoSrc : ''}}" alt="Avatar" style="${{hasPhoto ? 'display:block;' : 'display:none;'}}" />
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
        <div class="lang-card avoid-break">
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

      // Perfis
      const profLinks = (basics.profiles || []).map(p => {{
        if (p.url) return `<a href="${{p.url}}" target="_blank" class="cv-link">🔗 ${{p.network}}: @${{p.username}}</a>`;
        if (p.username) return `<span>${{p.network}}: ${{p.username}}</span>`;
        return '';
      }}).filter(Boolean).join(' &nbsp;•&nbsp; ');

      // Renderização do modelo A4 selecionado
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
            <div class="cv-editorial-grid">
              <aside class="cv-editorial-left">
                <div class="sidebar-section">
                  <h4 class="section-title" style="font-size: 0.85rem;">CONTATO</h4>
                  <div class="contacts" style="font-size: 0.8rem; line-height: 1.5; text-align: left;">
                    ${{email ? `<div>✉ ${{email}}</div>` : ''}}
                    ${{phone ? `<div>📞 ${{phone}}</div>` : ''}}
                    ${{locStr ? `<div>📍 ${{locStr}}</div>` : ''}}
                    ${{url ? `<div>🌐 <a href="${{url}}" target="_blank" class="cv-link">${{url}}</a></div>` : ''}}
                  </div>
                </div>
                ${{skillsHtml ? `<div class="sidebar-section"><h4 class="section-title" style="font-size: 0.85rem;">${{I18N_T.skills || 'Competências'}}</h4>${{skillsHtml}}</div>` : ''}}
                ${{langHtml ? `<div class="sidebar-section"><h4 class="section-title" style="font-size: 0.85rem;">${{I18N_T.languages || 'Idiomas'}}</h4>${{langHtml}}</div>` : ''}}
                ${{certHtml ? `<div class="sidebar-section"><h4 class="section-title" style="font-size: 0.85rem;">${{I18N_T.certificates || 'Certificações'}}</h4>${{certHtml}}</div>` : ''}}
              </aside>
              <main class="cv-editorial-main">
                ${{summary ? `<div class="summary" style="margin-bottom: 1.25rem;">${{summary}}</div>` : ''}}
                ${{workHtml ? `<section class="avoid-break"><h2 class="section-title">${{I18N_T.work || 'Experiência'}}</h2>${{workHtml}}</section>` : ''}}
                ${{projHtml ? `<section class="avoid-break"><h2 class="section-title">${{I18N_T.projects || 'Projetos'}}</h2><div class="projects-grid ${{getGridClass((data.projects||[]).length)}}">${{projHtml}}</div></section>` : ''}}
                ${{eduHtml ? `<section class="avoid-break"><h2 class="section-title">${{I18N_T.education || 'Formação'}}</h2><div class="education-grid ${{getGridClass((data.education||[]).length)}}">${{eduHtml}}</div></section>` : ''}}
              </main>
            </div>
          </div>
        `;
      }}

      if (layout === 'corporate_timeline') {{
        return `
          <div class="layout-corporate_timeline">
            <div class="cv-navy-layout" style="display: grid; grid-template-columns: 240px 1fr; gap: 1.5rem;">
              <aside class="cv-navy-sidebar" style="background: #0f172a; color: #f8fafc; padding: 1.5rem; border-radius: 8px; display: flex; flex-direction: column; gap: 1.1rem;">
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
                ${{skillsHtml ? `<div><h4 style="font-size: 0.85rem; color: #f8fafc; border-bottom: 1px solid rgba(255,255,255,0.2); padding-bottom: 0.25rem; margin-bottom: 0.5rem;">${{I18N_T.skills || 'Competências'}}</h4>${{skillsHtml}}</div>` : ''}}
                ${{langHtml ? `<div><h4 style="font-size: 0.85rem; color: #f8fafc; border-bottom: 1px solid rgba(255,255,255,0.2); padding-bottom: 0.25rem; margin-bottom: 0.5rem;">${{I18N_T.languages || 'Idiomas'}}</h4>${{langHtml}}</div>` : ''}}
              </aside>
              <main class="cv-navy-main">
                ${{summary ? `<div class="summary">${{summary}}</div>` : ''}}
                ${{workHtml ? `<section class="avoid-break"><h2 class="section-title">${{I18N_T.work || 'Experiência'}}</h2>${{workHtml}}</section>` : ''}}
                ${{eduHtml ? `<section class="avoid-break"><h2 class="section-title">${{I18N_T.education || 'Formação'}}</h2><div class="education-grid ${{getGridClass((data.education||[]).length)}}">${{eduHtml}}</div></section>` : ''}}
                ${{projHtml ? `<section class="avoid-break"><h2 class="section-title">${{I18N_T.projects || 'Projetos'}}</h2><div class="projects-grid ${{getGridClass((data.projects||[]).length)}}">${{projHtml}}</div></section>` : ''}}
                ${{certHtml ? `<section class="avoid-break"><h2 class="section-title">${{I18N_T.certificates || 'Certificações'}}</h2><div class="certs-grid ${{getGridClass((data.certificates||[]).length)}}">${{certHtml}}</div></section>` : ''}}
              </main>
            </div>
          </div>
        `;
      }}

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
              ${{avatarHtml}}
            </header>
            ${{summary ? `<div class="summary" style="margin-bottom: 1rem;">${{summary}}</div>` : ''}}
            <div style="display: grid; grid-template-columns: 1.2fr 1fr; gap: 1.25rem; margin-bottom: 1rem;">
              <div>${{workHtml ? `<section class="avoid-break"><h2 class="section-title">${{I18N_T.work || 'Experiência'}}</h2>${{workHtml}}</section>` : ''}}</div>
              <div>
                ${{eduHtml ? `<section class="avoid-break"><h2 class="section-title">${{I18N_T.education || 'Formação'}}</h2><div class="education-grid ${{getGridClass((data.education||[]).length)}}">${{eduHtml}}</div></section>` : ''}}
                ${{projHtml ? `<section class="avoid-break"><h2 class="section-title">${{I18N_T.projects || 'Projetos'}}</h2><div class="projects-grid ${{getGridClass((data.projects||[]).length)}}">${{projHtml}}</div></section>` : ''}}
              </div>
            </div>
            ${{skillsHtml ? `<section class="avoid-break"><h2 class="section-title">${{I18N_T.skills || 'Competências'}}</h2><div class="skills-grid ${{getGridClass((data.skills||[]).length)}}">${{skillsHtml}}</div></section>` : ''}}
            ${{langHtml ? `<section class="avoid-break"><h2 class="section-title">${{I18N_T.languages || 'Idiomas'}}</h2><div class="languages-grid ${{getGridClass((data.languages||[]).length)}}">${{langHtml}}</div></section>` : ''}}
            ${{certHtml ? `<section class="avoid-break"><h2 class="section-title">${{I18N_T.certificates || 'Certificações'}}</h2><div class="certs-grid ${{getGridClass((data.certificates||[]).length)}}">${{certHtml}}</div></section>` : ''}}
          </div>
        `;
      }}

      if (layout === 'sidebar' || layout === 'compact_split') {{
        return `
          <div class="layout-${{layout}}">
            <div style="display: grid; grid-template-columns: 230px 1fr; gap: 1.5rem;">
              <aside style="border-right: 1px solid rgba(125,125,125,0.2); padding-right: 1.25rem; display: flex; flex-direction: column; gap: 1.1rem;">
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
                ${{skillsHtml ? `<div><h4 class="section-title" style="font-size: 0.82rem;">${{I18N_T.skills || 'Competências'}}</h4>${{skillsHtml}}</div>` : ''}}
                ${{langHtml ? `<div><h4 class="section-title" style="font-size: 0.82rem;">${{I18N_T.languages || 'Idiomas'}}</h4>${{langHtml}}</div>` : ''}}
                ${{certHtml ? `<div><h4 class="section-title" style="font-size: 0.82rem;">${{I18N_T.certificates || 'Certificações'}}</h4>${{certHtml}}</div>` : ''}}
              </aside>
              <main>
                ${{summary ? `<div class="summary">${{summary}}</div>` : ''}}
                ${{workHtml ? `<section class="avoid-break"><h2 class="section-title">${{I18N_T.work || 'Experiência'}}</h2>${{workHtml}}</section>` : ''}}
                ${{projHtml ? `<section class="avoid-break"><h2 class="section-title">${{I18N_T.projects || 'Projetos'}}</h2><div class="projects-grid ${{getGridClass((data.projects||[]).length)}}">${{projHtml}}</div></section>` : ''}}
                ${{eduHtml ? `<section class="avoid-break"><h2 class="section-title">${{I18N_T.education || 'Formação'}}</h2><div class="education-grid ${{getGridClass((data.education||[]).length)}}">${{eduHtml}}</div></section>` : ''}}
              </main>
            </div>
          </div>
        `;
      }}

      // Default (Modular, Linear, Warm Magazine)
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
          ${{projHtml ? `<section class="avoid-break"><h2 class="section-title">${{I18N_T.projects || 'Projetos'}}</h2><div class="projects-grid ${{getGridClass((data.projects||[]).length)}}">${{projHtml}}</div></section>` : ''}}
          ${{skillsHtml ? `<section class="avoid-break"><h2 class="section-title">${{I18N_T.skills || 'Competências'}}</h2><div class="skills-grid ${{getGridClass((data.skills||[]).length)}}">${{skillsHtml}}</div></section>` : ''}}
          ${{eduHtml ? `<section class="avoid-break"><h2 class="section-title">${{I18N_T.education || 'Formação'}}</h2><div class="education-grid ${{getGridClass((data.education||[]).length)}}">${{eduHtml}}</div></section>` : ''}}
          ${{certHtml ? `<section class="avoid-break"><h2 class="section-title">${{I18N_T.certificates || 'Certificações'}}</h2><div class="certs-grid ${{getGridClass((data.certificates||[]).length)}}">${{certHtml}}</div></section>` : ''}}
          ${{langHtml ? `<section class="avoid-break"><h2 class="section-title">${{I18N_T.languages || 'Idiomas'}}</h2><div class="languages-grid ${{getGridClass((data.languages||[]).length)}}">${{langHtml}}</div></section>` : ''}}
          ${{intHtml ? `<section class="avoid-break"><h2 class="section-title">${{I18N_T.interests || 'Interesses'}}</h2><div class="interests-grid ${{getGridClass((data.interests||[]).length)}}">${{intHtml}}</div></section>` : ''}}
        </div>
      `;
    }}

    function updateActivePanelContent() {{
      const activePanel = document.getElementById('cv-persona-' + currentPersona);
      if (!activePanel) return;
      const data = parseActiveYamlData(currentPersona);
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
          btn.innerText = '✅ {t["yaml_copied"]}';
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
          btn.innerText = '✅ {t["yaml_copied"]}';
          setTimeout(() => {{ btn.innerText = original; }}, 2000);
        }}
      }});
    }}

    /* ── Photo Modal & Avatar Handlers ── */
    function openPhotoModal() {{
      const modal = document.getElementById('photo-modal');
      const urlInput = document.getElementById('modal-url-input');
      const previewImg = document.getElementById('modal-preview-img');
      const previewPh = document.getElementById('modal-preview-placeholder');
      const removeBtn = document.getElementById('modal-remove-btn');

      if (urlInput) urlInput.value = currentPhoto.startsWith('data:') ? '' : currentPhoto;
      if (currentPhoto) {{
        if (previewImg) {{ previewImg.src = currentPhoto; previewImg.style.display = 'block'; }}
        if (previewPh) previewPh.style.display = 'none';
        if (removeBtn) removeBtn.style.display = 'block';
      }} else {{
        if (previewImg) {{ previewImg.src = ''; previewImg.style.display = 'none'; }}
        if (previewPh) previewPh.style.display = 'block';
        if (removeBtn) removeBtn.style.display = 'none';
      }}
      if (modal) modal.classList.add('active');
    }}

    function closePhotoModal(e) {{
      if (e && e.target && e.target.id !== 'photo-modal' && !e.target.classList.contains('cv-modal-close')) return;
      const modal = document.getElementById('photo-modal');
      if (modal) modal.classList.remove('active');
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
        const res = evt.target.result;
        updateModalPreview(res);
      }};
      reader.readAsDataURL(file);
    }}

    function handlePhotoUrlInput(val) {{
      updateModalPreview(val.trim());
    }}

    function updateModalPreview(src) {{
      const previewImg = document.getElementById('modal-preview-img');
      const previewPh = document.getElementById('modal-preview-placeholder');
      const removeBtn = document.getElementById('modal-remove-btn');
      if (src) {{
        if (previewImg) {{ previewImg.src = src; previewImg.style.display = 'block'; }}
        if (previewPh) previewPh.style.display = 'none';
        if (removeBtn) removeBtn.style.display = 'block';
      }} else {{
        if (previewImg) {{ previewImg.src = ''; previewImg.style.display = 'none'; }}
        if (previewPh) previewPh.style.display = 'block';
        if (removeBtn) removeBtn.style.display = 'none';
      }}
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
      updateModalPreview('');
    }}

    function clearAndSaveNoPhoto() {{
      currentPhoto = '';
      localStorage.removeItem('cv_user_photo');
      applyPhotoToAll('');
      closePhotoModal();
    }}

    function saveAndApplyPhoto() {{
      const previewImg = document.getElementById('modal-preview-img');
      const photoSrc = (previewImg && previewImg.style.display !== 'none') ? previewImg.src : '';
      currentPhoto = photoSrc;
      if (photoSrc) {{
        localStorage.setItem('cv_user_photo', photoSrc);
      }} else {{
        localStorage.removeItem('cv_user_photo');
      }}
      applyPhotoToAll(photoSrc);
      closePhotoModal();
    }}

    function applyPhotoToAll(photoSrc) {{
      const containers = document.querySelectorAll('.cv-avatar-container');
      containers.forEach(c => {{
        const img = c.querySelector('.cv-avatar-img');
        const ph = c.querySelector('.cv-avatar-placeholder');
        if (photoSrc) {{
          c.classList.add('has-photo');
          if (img) {{ img.src = photoSrc; img.style.display = 'block'; }}
          if (ph) ph.style.display = 'none';
        }} else {{
          c.classList.remove('has-photo');
          if (img) {{ img.src = ''; img.style.display = 'none'; }}
          if (ph) ph.style.display = 'flex';
        }}
      }});
    }}

    // Auto-restore saved preferences
    (function() {{
      const savedTheme = localStorage.getItem('cv_standalone_theme') || '{valid_theme}';
      const savedPersona = localStorage.getItem('cv_active_persona') || '{active_persona}';
      const savedLayout = localStorage.getItem('cv_standalone_layout') || '{valid_layout}';
      const savedViewMode = localStorage.getItem('cv_standalone_viewmode') || '{view_mode}';
      const savedPhoto = localStorage.getItem('cv_user_photo');

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
        applyPhotoToAll(savedPhoto);
      }}

      switchPersona(currentPersona);
    }})();
  </script>
</body>
</html>
"""
    return html_content


def render_cv_to_standalone_html(yaml_or_dict: Any, theme: str = "executive", layout: str = "dynamic_math", lang: str = "auto", view_mode: str = "cv") -> str:
    """Compatibilidade para renderização individual delegando para a engine multi-dashboard."""
    return render_multi_cv_dashboard_html({"professional": yaml_or_dict}, default_persona="professional", default_theme=theme, default_layout=layout, lang=lang, view_mode=view_mode)
