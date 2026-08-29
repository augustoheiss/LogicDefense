"""
CV HTML Renderer Service — LogicDefense & CV Maker 2.0
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Converte YAML / JSON Resume em um documento HTML 100% autônomo e standalone,
com estilos embutidos de todos os 5 Temas, troca dinâmica em tempo real (sem servidor),
botões de download/cópia de YAML e paginação A4 de alta precisão.
"""

import html
import yaml
from typing import Dict, Any, Optional

I18N = {
    "pt": {
        "print_btn": "🖨️ Imprimir / Salvar PDF",
        "download_yaml": "📥 Baixar YAML",
        "copy_yaml": "📋 Copiar YAML",
        "yaml_copied": "Copiado!",
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
        "theme_label": "Modelo:",
        "opt_executive": "👔 Executivo",
        "opt_creative": "🎨 Criativo",
        "opt_minimalist": "🔹 Minimalista",
        "opt_white": "📄 White",
        "opt_terminal": ">_ Terminal",
    },
    "en": {
        "print_btn": "🖨️ Print / Save as PDF",
        "download_yaml": "📥 Download YAML",
        "copy_yaml": "📋 Copy YAML",
        "yaml_copied": "Copied!",
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
        "theme_label": "Theme:",
        "opt_executive": "👔 Executive",
        "opt_creative": "🎨 Creative",
        "opt_minimalist": "🔹 Minimalist",
        "opt_white": "📄 White",
        "opt_terminal": ">_ Terminal",
    },
}

def render_cv_to_standalone_html(yaml_or_dict: Any, theme: str = "executive", lang: str = "auto") -> str:
    """
    Gera um HTML standalone de alta fidelidade visual com TODOS os 5 temas embutidos.
    O usuário pode alternar entre os temas diretamente no navegador sem precisar de internet ou servidor!
    """
    raw_str = ""
    if isinstance(yaml_or_dict, str):
        raw_str = yaml_or_dict
        try:
            data = yaml.safe_load(yaml_or_dict) or {}
        except Exception:
            data = {}
    else:
        data = yaml_or_dict or {}

    basics = data.get("basics", {})
    work = data.get("work", [])
    education = data.get("education", [])
    projects = data.get("projects", [])
    skills = data.get("skills", [])
    languages = data.get("languages", [])
    interests = data.get("interests", [])
    certificates = data.get("certificates", [])

    # Auto-detect language
    if lang == "auto":
        txt_to_check = (raw_str or "") + " " + str(basics.get("label", "")) + " " + str(basics.get("summary", ""))
        if any(w in txt_to_check.lower() for w in ["developer", "software engineer", "intern", "experience", "education"]):
            if "desenvolvedor" in txt_to_check.lower() or "experiência" in txt_to_check.lower():
                selected_lang = "pt"
            else:
                selected_lang = "en"
        else:
            selected_lang = "pt"
    else:
        selected_lang = lang if lang in I18N else "pt"

    t = I18N[selected_lang]

    import re
    email_val = basics.get("email", "")
    phone_val = basics.get("phone", "")
    clean_phone = re.sub(r"[^\d+]", "", str(phone_val))
    city = basics.get("location", {}).get("city", "")
    region = basics.get("location", {}).get("region", "")
    loc_str = f"{city} - {region}" if city and region else (city or region or "")
    url_val = basics.get("url", "")

    # Profiles list
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

    # Work Timeline
    work_html = ""
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

        work_html += f"""
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
    projects_html = ""
    for pr in projects:
        name = html.escape(pr.get("name", ""))
        desc = html.escape(pr.get("description", ""))
        pr_url = html.escape(pr.get("url", ""))
        kws = "".join(f"<span class='badge'>{html.escape(k)}</span>" for k in pr.get("keywords", []))
        highlights = pr.get("highlights", [])
        hl_html = "".join(f"<li>{html.escape(h)}</li>" for h in highlights)

        projects_html += f"""
        <div class="project-card avoid-break">
            <div class="item-header">
                <span class="item-title">{f'<a href="{pr_url}" target="_blank">{name} ↗</a>' if pr_url else name}</span>
            </div>
            <p class="item-desc">{desc}</p>
            {f'<ul class="bullets" style="margin-bottom: 0.4rem;">{hl_html}</ul>' if highlights else ''}
            <div class="tags">{kws}</div>
        </div>
        """

    # Skills Group
    skills_html = ""
    for sk in skills:
        cat_name = html.escape(sk.get("name", ""))
        kws = "".join(f"<span class='badge'>{html.escape(k)}</span>" for k in sk.get("keywords", []))
        skills_html += f"""
        <div class="skill-group avoid-break">
            <div class="skill-title">⚡ {cat_name}</div>
            <div class="tags">{kws}</div>
        </div>
        """

    # Education
    education_html = ""
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

        education_html += f"""
        <div class="geo-card avoid-break">
            <div class="card-top"><span class="geo-icon">🎓</span><span class="item-date">{ed_date}</span></div>
            <div class="item-title" style="font-weight: 700; font-size: 0.85rem;">{area}</div>
            <div class="item-sub" style="font-size: 0.8rem;">{inst} • {study_type}</div>
            {f'<div class="tags" style="margin-top:0.3rem;">{c_html}</div>' if courses else ''}
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
    certificates_html = ""
    for cert in certificates:
        name = html.escape(cert.get("name", ""))
        issuer = html.escape(cert.get("issuer", ""))
        date = html.escape(str(cert.get("date", "")))
        url = html.escape(cert.get("url", ""))

        certificates_html += f"""
        <div class="geo-card avoid-break">
            <div class="card-top"><span class="geo-icon">🎖️</span><span class="item-date">{date}</span></div>
            <div class="item-title" style="font-weight: 700; font-size: 0.85rem;">{f'<a href="{url}" target="_blank">{name} ↗</a>' if url else name}</div>
            <div class="issuer-pill">{issuer}</div>
        </div>
        """

    # Publications
    publications = data.get("publications", [])
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
    interest_html = ""
    for it in interests:
        kws = "".join(f"<span class='badge'>{html.escape(k)}</span>" for k in it.get("keywords", []))
        interest_html += f"""
        <div class="interest-card avoid-break">
            <div style="font-weight: 700; font-size: 0.85rem; margin-bottom: 0.3rem;">◈ {html.escape(it.get('name', ''))}</div>
            <div class="tags">{kws}</div>
        </div>
        """

    valid_theme = theme if theme in ["executive", "creative", "minimalist", "white", "terminal"] else "executive"

    html_content = f"""<!DOCTYPE html>
<html lang="{selected_lang}">
<head>
  <meta charset="UTF-8">
  <title>{html.escape(basics.get("name", "Currículo"))} — CV Maker 2.0</title>
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Courier+Prime:wght@400;700&family=Inter:wght@400;500;600;700;800&family=Merriweather:wght@300;400;700&family=Poppins:wght@400;600;700;800&display=swap');

    * {{ box-sizing: border-box; margin: 0; padding: 0; }}

    body {{
      background: #0f172a;
      color: #1e293b;
      line-height: 1.55;
      font-size: 10pt;
      padding: 2.5rem 1rem;
      transition: background 0.2s ease;
    }}

    /* ── Floating Toolbar ── */
    .toolbar {{
      position: fixed;
      top: 1rem;
      right: 1rem;
      display: flex;
      gap: 0.45rem;
      z-index: 999;
      background: rgba(15, 23, 42, 0.92);
      padding: 0.45rem 0.75rem;
      border-radius: 9999px;
      backdrop-filter: blur(12px);
      box-shadow: 0 6px 24px rgba(0,0,0,0.35);
      border: 1px solid rgba(255,255,255,0.1);
      align-items: center;
    }}

    .toolbar select {{
      background: #1e293b;
      color: #f8fafc;
      border: 1px solid #475569;
      padding: 0.35rem 0.65rem;
      border-radius: 9999px;
      font-size: 0.8rem;
      font-weight: 600;
      cursor: pointer;
      outline: none;
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
      transition: all 0.2s ease;
    }}
    .toolbar button:hover {{ background: #0369a1; transform: translateY(-1px); }}

    .toolbar button.btn-sec {{
      background: #334155;
    }}
    .toolbar button.btn-sec:hover {{
      background: #475569;
    }}

    /* ── Base Container ── */
    .container {{
      max-width: 860px;
      margin: 0 auto;
      background: #ffffff;
      padding: 2.5rem 3rem;
      border-radius: 12px;
      box-shadow: 0 12px 40px rgba(0,0,0,0.15);
      transition: all 0.2s ease;
    }}

    .header {{
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      gap: 1.5rem;
      padding-bottom: 1.25rem;
      margin-bottom: 1.25rem;
    }}

    .name {{
      font-size: 1.85rem;
      font-weight: 800;
      margin-bottom: 0.25rem;
      line-height: 1.2;
    }}

    .label {{
      font-size: 0.95rem;
      font-weight: 600;
    }}

    .contacts {{
      font-size: 0.78rem;
      color: #64748b;
      text-align: right;
      display: flex;
      flex-direction: column;
      gap: 0.2rem;
    }}

    .summary {{
      font-size: 0.88rem;
      line-height: 1.58;
      margin-bottom: 1.25rem;
      text-align: justify;
    }}

    .section-title {{
      font-size: 1.05rem;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      padding-bottom: 0.3rem;
      margin: 1.25rem 0 0.75rem 0;
      break-after: avoid;
    }}

    .card {{ margin-bottom: 0.75rem; }}
    .item-header {{
      display: flex;
      justify-content: space-between;
      font-weight: 700;
      font-size: 0.92rem;
    }}

    .item-date {{
      font-size: 0.78rem;
      color: #64748b;
      font-weight: 600;
    }}

    .item-sub {{
      font-size: 0.82rem;
      font-weight: 600;
      margin-bottom: 0.2rem;
    }}

    .item-desc {{
      font-size: 0.84rem;
      color: #475569;
      margin-top: 0.2rem;
    }}

    .bullets {{
      margin: 0.3rem 0 0 1.2rem;
      font-size: 0.82rem;
      color: #334155;
    }}

    .bullets li {{ margin-bottom: 0.2rem; }}

    .projects-grid {{
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 0.75rem;
    }}

    .project-card {{
      padding: 0.75rem;
      border-radius: 6px;
    }}

    .skills-grid,
    .education-grid,
    .certs-grid,
    .interests-grid,
    .languages-grid {{
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 0.65rem;
    }}

    .skill-group,
    .geo-card,
    .interest-card {{
      padding: 0.6rem;
      border-radius: 6px;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
    }}

    .card-top {{
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 0.25rem;
    }}

    .geo-icon {{
      font-size: 0.85rem;
    }}

    .lang-card {{
      padding: 0.5rem 0.65rem;
      border-radius: 6px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      font-size: 0.82rem;
    }}

    .issuer-pill {{
      display: inline-block;
      font-size: 0.7rem;
      font-weight: 600;
      padding: 0.1rem 0.4rem;
      border-radius: 4px;
      margin-top: 0.25rem;
      width: fit-content;
    }}

    .skill-title {{
      font-size: 0.82rem;
      font-weight: 700;
      margin-bottom: 0.4rem;
    }}

    .tags {{
      display: flex;
      flex-wrap: wrap;
      gap: 0.3rem;
    }}

    .badge {{
      display: inline-block;
      font-size: 0.7rem;
      font-weight: 600;
      padding: 0.15rem 0.45rem;
      border-radius: 4px;
    }}

    .avoid-break {{
      break-inside: avoid !important;
      page-break-inside: avoid !important;
    }}

    a, .cv-link {{
      text-decoration: none;
      font-weight: 500;
    }}
    a:hover, .cv-link:hover {{
      text-decoration: underline;
    }}

    /* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
       ■  1. TEMA EXECUTIVO (theme-executive)
       ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
    .theme-executive {{
      font-family: 'Merriweather', Georgia, serif;
      color: #1a1a1a;
      background: #ffffff;
    }}
    .theme-executive .header {{ border-bottom: 2px solid #111827; }}
    .theme-executive .name {{ color: #050505; }}
    .theme-executive .label {{ color: #374151; }}
    .theme-executive .section-title {{ color: #111827; border-bottom: 1.5px solid #374151; }}
    .theme-executive .item-title {{ color: #111827; }}
    .theme-executive .item-sub {{ color: #1f2937; }}
    .theme-executive a, .theme-executive .cv-link {{ color: #1f2937; text-decoration: underline; }}
    .theme-executive .project-card,
    .theme-executive .skill-group,
    .theme-executive .geo-card,
    .theme-executive .interest-card,
    .theme-executive .lang-card {{
      background: #ffffff;
      border: 1px solid #d1d5db;
      border-left: 3px solid #111827;
      border-radius: 0;
    }}
    .theme-executive .badge,
    .theme-executive .issuer-pill {{
      background: transparent;
      color: #374151;
      border: 1px solid #9ca3af;
      border-radius: 0;
      font-family: 'Courier Prime', monospace;
    }}

    /* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
       ■  2. TEMA CRIATIVO (theme-creative)
       ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
    .theme-creative {{
      font-family: 'Poppins', 'Segoe UI', sans-serif;
      color: #1e293b;
      background: #ffffff;
    }}
    .theme-creative .header {{ border-bottom: 3px solid #2563eb; }}
    .theme-creative .name {{ color: #1e3a8a; font-weight: 800; }}
    .theme-creative .label {{ color: #f97316; font-weight: 600; }}
    .theme-creative .section-title {{ color: #1e3a8a; border-bottom: 2px solid #bfdbfe; }}
    .theme-creative .item-title {{ color: #1e1b4b; }}
    .theme-creative .item-sub {{ color: #2563eb; }}
    .theme-creative a, .theme-creative .cv-link {{ color: #2563eb; }}
    .theme-creative .project-card {{
      background: #eff6ff;
      border: 1px solid #bfdbfe;
      border-radius: 8px;
    }}
    .theme-creative .skill-group,
    .theme-creative .geo-card,
    .theme-creative .lang-card {{
      background: #eff6ff;
      border: 1px solid #bfdbfe;
      border-left: 3px solid #2563eb;
      border-radius: 8px;
    }}
    .theme-creative .interest-card {{
      background: #faf5ff;
      border: 1px solid #e9d5ff;
      border-left: 3px solid #9333ea;
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

    /* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
       ■  3. TEMA MINIMALISTA (theme-minimalist)
       ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
    .theme-minimalist {{
      font-family: 'Inter', system-ui, sans-serif;
      color: #0f172a;
      background: #ffffff;
    }}
    .theme-minimalist .header {{ border-bottom: 1px solid #e2e8f0; }}
    .theme-minimalist .name {{ color: #0f172a; font-weight: 800; letter-spacing: -0.04em; }}
    .theme-minimalist .label {{ color: #64748b; font-weight: 500; }}
    .theme-minimalist .section-title {{ color: #475569; border-bottom: 1px solid #e2e8f0; letter-spacing: 0.1em; }}
    .theme-minimalist .item-title {{ color: #0f172a; }}
    .theme-minimalist .item-sub {{ color: #334155; }}
    .theme-minimalist a, .theme-minimalist .cv-link {{ color: #475569; }}
    .theme-minimalist .project-card,
    .theme-minimalist .skill-group,
    .theme-minimalist .geo-card,
    .theme-minimalist .interest-card,
    .theme-minimalist .lang-card {{
      background: #ffffff;
      border: 1px solid #e2e8f0;
      border-left: 2px solid #64748b;
      border-radius: 4px;
    }}
    .theme-minimalist .badge,
    .theme-minimalist .issuer-pill {{
      background: transparent;
      color: #475569;
      border: 1px solid #cbd5e1;
      border-radius: 3px;
    }}

    /* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
       ■  4. TEMA WHITE (theme-white)
       ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
    .theme-white {{
      font-family: 'Inter', system-ui, sans-serif;
      color: #334155;
      background: #ffffff;
    }}
    .theme-white .header {{ border-bottom: 2.5px solid #059669; }}
    .theme-white .name {{ color: #0f172a; font-weight: 800; }}
    .theme-white .label {{ color: #059669; font-weight: 600; }}
    .theme-white .section-title {{ color: #059669; border-bottom: 1.5px solid #cbd5e1; }}
    .theme-white .item-title {{ color: #0f172a; }}
    .theme-white .item-sub {{ color: #059669; }}
    .theme-white a, .theme-white .cv-link {{ color: #059669; }}
    .theme-white .project-card,
    .theme-white .skill-group,
    .theme-white .geo-card,
    .theme-white .interest-card,
    .theme-white .lang-card {{
      background: #ffffff;
      border: 1px solid #cbd5e1;
      border-left: 3px solid #059669;
      border-radius: 6px;
    }}
    .theme-white .badge {{
      background: #f1f5f9;
      color: #334155;
      border: 1px solid #cbd5e1;
      border-radius: 4px;
    }}
    .theme-white .issuer-pill {{
      background: #ecfdf5;
      color: #047857;
      border: 1px solid #a7f3d0;
      border-radius: 4px;
    }}

    /* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
       ■  5. TEMA TERMINAL (theme-terminal)
       ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
    .theme-terminal {{
      font-family: 'Courier Prime', 'Fira Code', monospace, 'Inter', sans-serif;
      color: #0f172a;
      background: #ffffff;
    }}
    .theme-terminal .header {{ border-bottom: 2.5px solid #10b981; }}
    .theme-terminal .name {{ color: #000000; font-weight: 800; font-family: 'Courier Prime', monospace; }}
    .theme-terminal .label {{ color: #059669; font-family: 'Courier Prime', monospace; font-weight: 700; }}
    .theme-terminal .section-title {{ color: #059669; border-bottom: 1.5px solid #10b981; font-family: 'Courier Prime', monospace; }}
    .theme-terminal .item-title {{ color: #000000; font-family: 'Courier Prime', monospace; }}
    .theme-terminal .item-sub {{ color: #059669; font-family: 'Courier Prime', monospace; }}
    .theme-terminal a, .theme-terminal .cv-link {{ color: #059669; }}
    .theme-terminal .project-card,
    .theme-terminal .skill-group,
    .theme-terminal .geo-card,
    .theme-terminal .interest-card,
    .theme-terminal .lang-card {{
      background: #f8fafc;
      border: 1px solid #cbd5e1;
      border-left: 3px solid #10b981;
      border-radius: 4px;
    }}
    .theme-terminal .badge,
    .theme-terminal .issuer-pill {{
      background: #f1f5f9;
      color: #0f172a;
      border: 1px solid #94a3b8;
      border-radius: 3px;
      font-family: 'Courier Prime', monospace;
    }}

    /* ── @media print ── */
    @media print {{
      *, *::before, *::after {{
        -webkit-print-color-adjust: exact !important;
        print-color-adjust: exact !important;
        box-shadow: none !important;
        text-shadow: none !important;
      }}
      body {{
        background: #ffffff !important;
        padding: 0 !important;
        margin: 0 !important;
        font-size: 9.6pt !important;
      }}
      .toolbar {{ display: none !important; }}
      .container {{
        box-shadow: none !important;
        border-radius: 0 !important;
        padding: 0 !important;
        max-width: 100% !important;
      }}
      @page {{
        size: A4 portrait;
        margin: 6mm 8mm 6mm 8mm !important;
      }}
    }}
  </style>
</head>
<body>

  <div class="toolbar">
    <select id="theme-switcher" onchange="switchTheme(this.value)" title="{t['theme_label']}">
      <option value="executive">{t["opt_executive"]}</option>
      <option value="creative">{t["opt_creative"]}</option>
      <option value="minimalist">{t["opt_minimalist"]}</option>
      <option value="white">{t["opt_white"]}</option>
      <option value="terminal">{t["opt_terminal"]}</option>
    </select>
    <button onclick="window.print()">{t["print_btn"]}</button>
    <button onclick="downloadYaml()" class="btn-sec">{t["download_yaml"]}</button>
    <button id="copy-btn" onclick="copyYaml()" class="btn-sec">{t["copy_yaml"]}</button>
  </div>

  <div id="cv-container" class="container theme-{valid_theme}">
    <header class="header">
      <div>
        <h1 class="name">{html.escape(basics.get("name", ""))}</h1>
        <div class="label">{html.escape(basics.get("label", ""))}</div>
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

    {f'<section><h2 class="section-title">{t["work"]}</h2>{work_html}</section>' if work else ''}

    {f'<section><h2 class="section-title">{t["projects"]}</h2><div class="projects-grid">{projects_html}</div></section>' if projects else ''}

    {f'<section class="avoid-break"><h2 class="section-title">{t["skills"]}</h2><div class="skills-grid">{skills_html}</div></section>' if skills else ''}

    {f'<section class="avoid-break"><h2 class="section-title">{t["education"]}</h2><div class="education-grid">{education_html}</div></section>' if education else ''}

    {f'<section class="avoid-break"><h2 class="section-title">{t["certificates"]}</h2><div class="certs-grid">{certificates_html}</div></section>' if certificates else ''}

    {f'<section class="avoid-break"><h2 class="section-title">{t["publications"]}</h2>{publications_html}</section>' if publications else ''}

    {f'<section class="avoid-break"><h2 class="section-title">{t["languages"]}</h2><div class="languages-grid">{lang_cards_html}</div></section>' if languages else ''}

    {f'<section class="avoid-break"><h2 class="section-title">{t["interests"]}</h2><div class="interests-grid">{interest_html}</div></section>' if interests else ''}
  </div>

  <script id="raw-yaml-data" type="text/yaml">
{html.escape(raw_str)}
  </script>

  <script>
    function switchTheme(newTheme) {{
      const container = document.getElementById('cv-container');
      if (container) {{
        container.className = 'container theme-' + newTheme;
      }}
      localStorage.setItem('cv_standalone_theme', newTheme);
    }}

    // Auto-carregar o tema selecionado
    (function() {{
      const initialTheme = '{valid_theme}';
      const sel = document.getElementById('theme-switcher');
      if (sel) {{
        sel.value = initialTheme;
      }}
      switchTheme(initialTheme);
    }})();

    function downloadYaml() {{
      const el = document.getElementById('raw-yaml-data');
      if (!el) return;
      const content = el.textContent.trim();
      const blob = new Blob([content], {{ type: 'text/yaml;charset=utf-8' }});
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'curriculo.yaml';
      a.click();
      URL.revokeObjectURL(url);
    }}

    function copyYaml() {{
      const el = document.getElementById('raw-yaml-data');
      if (!el) return;
      const content = el.textContent.trim();
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
  </script>
</body>
</html>
"""
    return html_content
