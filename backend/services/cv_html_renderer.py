"""
CV HTML Renderer Service — LogicDefense & CV Maker 2.0
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Converte YAML / JSON Resume em um documento HTML 100% autônomo e standalone,
com estilos embutidos, paginação A4 (Hack da Tabela Fantasma) e suporte aos 5 temas.
"""

import html
import yaml
from typing import Dict, Any, Optional

THEME_COLORS = {
    "executive": {
        "primary": "#1e3a8a",
        "title": "#0f172a",
        "sub": "#334155",
        "accent": "#0284c7",
        "border": "#e2e8f0",
        "bg_badge": "#f1f5f9",
        "font": "'Merriweather', Georgia, serif",
    },
    "creative": {
        "primary": "#2563eb",
        "title": "#1e1b4b",
        "sub": "#475569",
        "accent": "#f97316",
        "border": "#e0e7ff",
        "bg_badge": "#eff6ff",
        "font": "'Poppins', sans-serif",
    },
    "minimalist": {
        "primary": "#0f172a",
        "title": "#020617",
        "sub": "#475569",
        "accent": "#64748b",
        "border": "#f1f5f9",
        "bg_badge": "#f8fafc",
        "font": "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
    },
    "white": {
        "primary": "#111827",
        "title": "#000000",
        "sub": "#374151",
        "accent": "#4b5563",
        "border": "#d1d5db",
        "bg_badge": "#ffffff",
        "font": "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
    },
    "terminal": {
        "primary": "#10b981",
        "title": "#34d399",
        "sub": "#a7f3d0",
        "accent": "#059669",
        "border": "#064e3b",
        "bg_badge": "#064e3b",
        "font": "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
    },
}

def render_cv_to_standalone_html(yaml_or_dict: Any, theme: str = "executive") -> str:
    """
    Gera um HTML standalone de alta fidelidade visual para visualização e impressão A4.
    """
    if isinstance(yaml_or_dict, str):
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

    theme_cfg = THEME_COLORS.get(theme, THEME_COLORS["executive"])

    # Profiles list
    profiles_html = ""
    for p in basics.get("profiles", []):
        network = html.escape(p.get("network", ""))
        url = html.escape(p.get("url", ""))
        user = html.escape(p.get("username", ""))
        profiles_html += f'<a href="{url}" target="_blank" class="meta-link">🔗 {network}: {user}</a> '

    # Work Timeline
    work_html = ""
    for w in work:
        pos = html.escape(w.get("position", ""))
        company = html.escape(w.get("name", ""))
        start = html.escape(str(w.get("startDate", "")))
        end = html.escape(str(w.get("endDate", "Presente") or "Presente"))
        summary = html.escape(w.get("summary", ""))
        highlights = w.get("highlights", [])
        
        bullets_html = ""
        if highlights:
            bullets_html = "<ul class='bullets'>" + "".join(f"<li>{html.escape(h)}</li>" for h in highlights) + "</ul>"

        work_html += f"""
        <div class="card avoid-break">
            <div class="item-header">
                <span class="item-title">{pos}</span>
                <span class="item-date">{start} — {end}</span>
            </div>
            <div class="item-sub">{company}</div>
            {f'<p class="item-desc">{summary}</p>' if summary else ''}
            {bullets_html}
        </div>
        """

    # Projects
    projects_html = ""
    for pr in projects:
        name = html.escape(pr.get("name", ""))
        desc = html.escape(pr.get("description", ""))
        url = html.escape(pr.get("url", ""))
        highlights = pr.get("highlights", [])
        keywords = pr.get("keywords", [])

        bullets = "".join(f"<li>{html.escape(h)}</li>" for h in highlights) if highlights else ""
        tags = "".join(f"<span class='badge'>{html.escape(k)}</span>" for k in keywords) if keywords else ""

        projects_html += f"""
        <div class="project-card avoid-break">
            <div class="item-header">
                <span class="item-title">{f'<a href="{url}" target="_blank">{name} ↗</a>' if url else name}</span>
            </div>
            {f'<p class="item-desc">{desc}</p>' if desc else ''}
            {f'<ul class="bullets">{bullets}</ul>' if bullets else ''}
            {f'<div class="tags">{tags}</div>' if tags else ''}
        </div>
        """

    # Skills Grid
    skills_html = ""
    for sk in skills:
        name = html.escape(sk.get("name", ""))
        level = html.escape(sk.get("level", ""))
        kws = sk.get("keywords", [])
        tags = "".join(f"<span class='badge'>{html.escape(k)}</span>" for k in kws)

        skills_html += f"""
        <div class="skill-group avoid-break">
            <div class="skill-title">{name} {f'<small>({level})</small>' if level else ''}</div>
            <div class="tags">{tags}</div>
        </div>
        """

    # Education
    education_html = ""
    for edu in education:
        inst = html.escape(edu.get("institution", ""))
        area = html.escape(edu.get("area", ""))
        study = html.escape(edu.get("studyType", ""))
        start = html.escape(str(edu.get("startDate", "")))
        end = html.escape(str(edu.get("endDate", "") or "Em andamento"))

        education_html += f"""
        <div class="card avoid-break">
            <div class="item-header">
                <span class="item-title">{area} ({study})</span>
                <span class="item-date">{f'{start} — {end}' if start else end}</span>
            </div>
            <div class="item-sub">{inst}</div>
        </div>
        """

    # Languages
    lang_html = "".join(
        f"<span class='badge'>🌐 {html.escape(l.get('language', ''))}: {html.escape(l.get('fluency', ''))}</span>"
        for l in languages
    )

    # Interests
    interest_html = ""
    for it in interests:
        kws = "".join(f"<span class='badge'>{html.escape(k)}</span>" for k in it.get("keywords", []))
        interest_html += f"<div class='avoid-break'><strong>{html.escape(it.get('name', ''))}:</strong> {kws}</div>"

    html_content = f"""<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <title>{html.escape(basics.get("name", "Currículo"))} — CV Maker 2.0</title>
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Merriweather:wght@300;400;700&family=Poppins:wght@400;600;700&display=swap');

    :root {{
      --primary: {theme_cfg["primary"]};
      --title: {theme_cfg["title"]};
      --sub: {theme_cfg["sub"]};
      --accent: {theme_cfg["accent"]};
      --border: {theme_cfg["border"]};
      --bg-badge: {theme_cfg["bg_badge"]};
      --font: {theme_cfg["font"]};
    }}

    * {{ box-sizing: border-box; margin: 0; padding: 0; }}
    body {{
      font-family: var(--font);
      color: #1e293b;
      background: #f8fafc;
      line-height: 1.5;
      font-size: 10pt;
      padding: 2rem 1rem;
    }}

    .toolbar {{
      position: fixed;
      top: 1rem;
      right: 1rem;
      display: flex;
      gap: 0.5rem;
      z-index: 999;
      background: rgba(15, 23, 42, 0.85);
      padding: 0.5rem 0.75rem;
      border-radius: 9999px;
      backdrop-filter: blur(8px);
      box-shadow: 0 4px 20px rgba(0,0,0,0.25);
    }}

    .toolbar button {{
      background: #0284c7;
      color: #fff;
      border: none;
      padding: 0.4rem 0.9rem;
      border-radius: 9999px;
      font-size: 0.8rem;
      font-weight: 600;
      cursor: pointer;
      display: flex;
      align-items: center;
      gap: 0.3rem;
    }}

    .container {{
      max-width: 860px;
      margin: 0 auto;
      background: #ffffff;
      padding: 2.5rem 3rem;
      border-radius: 12px;
      box-shadow: 0 10px 30px rgba(0,0,0,0.06);
    }}

    .header {{
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      gap: 1.5rem;
      border-bottom: 2px solid var(--border);
      padding-bottom: 1.25rem;
      margin-bottom: 1.25rem;
    }}

    .name {{
      font-size: 1.75rem;
      font-weight: 700;
      color: var(--primary);
      margin-bottom: 0.25rem;
    }}

    .label {{
      font-size: 0.95rem;
      font-weight: 600;
      color: var(--sub);
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
      color: #334155;
      line-height: 1.55;
      margin-bottom: 1.25rem;
      text-align: justify;
    }}

    .section-title {{
      font-size: 1.05rem;
      font-weight: 700;
      color: var(--primary);
      text-transform: uppercase;
      letter-spacing: 0.05em;
      border-bottom: 1.5px solid var(--border);
      padding-bottom: 0.3rem;
      margin: 1.25rem 0 0.75rem 0;
      break-after: avoid;
    }}

    .card {{ margin-bottom: 0.75rem; }}
    .item-header {{
      display: flex;
      justify-content: space-between;
      font-weight: 700;
      color: var(--title);
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
      color: var(--accent);
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
      background: #f8fafc;
      border: 1px solid var(--border);
      padding: 0.75rem;
      border-radius: 6px;
    }}

    .skills-grid {{
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 0.75rem;
    }}

    .skill-group {{
      background: #f8fafc;
      border: 1px solid var(--border);
      padding: 0.6rem;
      border-radius: 6px;
    }}

    .skill-title {{
      font-size: 0.82rem;
      font-weight: 700;
      color: var(--title);
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
      background: var(--bg-badge);
      border: 1px solid var(--border);
      border-radius: 4px;
      color: var(--sub);
    }}

    .avoid-break {{
      break-inside: avoid !important;
      page-break-inside: avoid !important;
    }}

    a {{ color: inherit; text-decoration: none; }}

    /* ── @media print ── */
    @media print {{
      body {{
        background: #ffffff !important;
        padding: 0 !important;
        font-size: 9.2pt !important;
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
        margin: 8mm 12mm 8mm 12mm !important;
      }}
    }}
  </style>
</head>
<body>

  <div class="toolbar">
    <button onclick="window.print()">🖨️ Imprimir / Salvar PDF</button>
  </div>

  <div class="container">
    <header class="header">
      <div>
        <h1 class="name">{html.escape(basics.get("name", ""))}</h1>
        <div class="label">{html.escape(basics.get("label", ""))}</div>
      </div>
      <div class="contacts">
        {f'<div>✉ {html.escape(basics.get("email", ""))}</div>' if basics.get("email") else ''}
        {f'<div>📞 {html.escape(basics.get("phone", ""))}</div>' if basics.get("phone") else ''}
        {f'<div>📍 {html.escape(basics.get("location", {}).get("city", ""))} - {html.escape(basics.get("location", {}).get("region", ""))}</div>' if basics.get("location") else ''}
        {f'<div>🌐 <a href="{html.escape(basics.get("url", ""))}">{html.escape(basics.get("url", ""))}</a></div>' if basics.get("url") else ''}
      </div>
    </header>

    {f'<div class="summary">{html.escape(basics.get("summary", "")).replace(chr(10), "<br>")}</div>' if basics.get("summary") else ''}

    {f'<section><h2 class="section-title">💼 Experiência Profissional</h2>{work_html}</section>' if work else ''}

    {f'<section><h2 class="section-title">🚀 Projetos em Destaque</h2><div class="projects-grid">{projects_html}</div></section>' if projects else ''}

    {f'<section class="avoid-break"><h2 class="section-title">⚡ Competências & Habilidades Técnicas</h2><div class="skills-grid">{skills_html}</div></section>' if skills else ''}

    {f'<section><h2 class="section-title">🎓 Formação Acadêmica</h2>{education_html}</section>' if education else ''}

    {f'<section class="avoid-break"><h2 class="section-title">🌐 Idiomas</h2><div class="tags">{lang_html}</div></section>' if languages else ''}

    {f'<section class="avoid-break"><h2 class="section-title">🎯 Interesses & Pesquisa</h2>{interest_html}</section>' if interests else ''}
  </div>

</body>
</html>
"""
    return html_content
