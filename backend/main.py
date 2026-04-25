"""
LogicDefense CV RAG Engine
FastAPI backend — generates 4 CV archetype YAMLs from raw resume text via Gemini.

Architecture (parallel concurrent generation):
  Each archetype is generated in its own Gemini call running concurrently via
  asyncio.gather().  This reduces the per-call output by 75 %, eliminating the
  token-limit truncation that occurred when all 4 CVs were squeezed into a single
  response.

  Per call:
    1. asyncio.to_thread() runs the synchronous SDK call off the event loop.
    2. response_mime_type="application/json" (schema-less mode) avoids the
       "additionalProperties is not supported" Gemini error.
    3. json.loads(response.text) — safe, pure nested JSON, no embedded YAML strings.
    4. yaml.dump() converts the dict to a YAML string server-side.
    5. All 4 coroutines run in parallel; total wall-clock time ≈ one call.
"""

import asyncio
import io
import json
import logging
import os
from typing import Any

import yaml
from dotenv import load_dotenv
from fastapi import APIRouter, FastAPI, UploadFile, File, Form, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from google import genai
from google.genai import types
from pydantic import BaseModel, Field

# ── Environment ──────────────────────────────────────────────────────────────
load_dotenv()

MODEL         = "gemini-2.5-flash"
MAX_TOKENS    = 8192     # one CV per call; 8 k gives headroom for rich resumes
MAX_RETRIES   = 3        # attempts per archetype before giving up
RETRY_DELAY   = 1.5      # seconds to wait between retries
STAGGER_STEP  = 0.5      # seconds between staggered concurrent call starts

logging.basicConfig(level=logging.INFO, format="%(levelname)s  %(message)s")
log = logging.getLogger(__name__)

# ── Gemini client ────────────────────────────────────────────────────────────
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")

client = None
if GEMINI_API_KEY:
    client = genai.Client(api_key=GEMINI_API_KEY)
else:
    print("⚠️ AVISO: GEMINI_API_KEY não encontrada. Iniciando servidor sem suporte à IA.")

# ── FastAPI app ──────────────────────────────────────────────────────────────
app = FastAPI(
    title="LogicDefense CV Engine",
    description="Generates 4 CV archetype YAMLs using Gemini (parallel calls).",
    version="2.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Health Check (cold-start mitigation) ─────────────────────────────────────

@app.get("/api/health")
async def health_check():
    return {"status": "awake"}

# ── Pydantic models ──────────────────────────────────────────────────────────

class GenerateRequest(BaseModel):
    raw_text: str = Field(
        ...,
        min_length=50,
        description="Raw resume text pasted by the user.",
    )


class GenerateResponse(BaseModel):
    """Returned to the React frontend — each field is a YAML string."""
    professional: str = Field(..., description="Executive-style YAML.")
    historian: str    = Field(..., description="Narrative/historian-style YAML.")
    didactic: str     = Field(..., description="Didactic/learning-speed YAML.")
    alien: str        = Field(..., description="Extraterrestrial observer YAML.")


# ── Shared base instruction ───────────────────────────────────────────────────
# Injected into every archetype call so the model knows the output format and
# schema regardless of which persona it is playing.

BASE_INSTRUCTION = """
You are an expert CV data architect and copywriter.

TASK:
Parse the resume provided by the user and rewrite it as a SINGLE JSON Resume
object styled according to the ARCHETYPE PERSONA defined below.

OUTPUT FORMAT — CRITICAL:
- Output ONE pure JSON object following the JSON Resume schema.
- Do NOT wrap the output in an outer key. The root of your response IS the
  JSON Resume object.
- Do NOT output YAML, markdown, or any prose outside the JSON.
- The server converts your JSON to YAML automatically.

JSON RESUME SCHEMA (include only keys for which you have source data):

basics:
  name, label, email, phone, url, summary
  location: { city, region, postalCode, countryCode }
  profiles: [ { network, username, url } ]

work: [ { name, position, url, startDate, endDate, summary,
           highlights: [str] } ]

education: [ { institution, area, studyType, startDate, endDate,
               score, courses: [str] } ]

projects: [ { name, description, highlights: [str],
              keywords: [str], url } ]

skills:    [ { name, level, keywords: [str] } ]
languages: [ { language, fluency } ]
interests: [ { name, keywords: [str] } ]
certificates: [ { name, date, issuer, url } ]
awards:    [ { title, date, awarder, summary } ]

Every output MUST contain at least basics.name.
Infer reasonable values where the text is vague.
Never invent credentials (degrees, employers) not implied by the source text.
""".strip()

# ── Per-archetype persona instructions ────────────────────────────────────────

PERSONA_INSTRUCTIONS: dict[str, str] = {
    "professional": """
ARCHETYPE PERSONA: PROFESSIONAL (Executive Recruiter)
Tone: Terse, confident, third-person impact statements. Never "I did X".
Rules:
  - Every highlight becomes a quantified result where possible
    (e.g. "Led team" -> "Directed 6-person team, delivering 3 releases on schedule").
  - basics.label: A concise, senior-level job title.
  - basics.summary: 2-3 sentences focused purely on business impact and scope.
  - Use standard JSON Resume section keys (work, education, skills, etc.).
""".strip(),

    "historian": """
ARCHETYPE PERSONA: HISTORIAN (Professional Biographer)
Tone: Warm, reflective, third-person past-tense storytelling.
Rules:
  - work[].summary: A short paragraph per role — the challenge faced, the
    approach taken, and the outcome achieved.
  - basics.summary: A compelling 3-sentence arc: "Began by... Later
    discovered... Now applies...".
  - Emphasise the evolution and growth across roles, not just deliverables.
  - Weave skills and technologies naturally into the narrative.
""".strip(),

    "didactic": """
ARCHETYPE PERSONA: DIDACTIC (Career Coach — Learning Speed Showcase)
Tone: Direct, encouraging, present-tense.
Rules:
  - basics.summary: Frames the candidate as a fast adapter who turns new
    domains into mastered expertise quickly.
  - work[].summary: Focuses on what was LEARNED and APPLIED, not just built.
    Example: "Onboarded into a legacy codebase, mastered it within 6 weeks,
    then led the migration to a modern stack."
  - skills[].level: Explicitly "Expert", "Proficient", or "Learning" for
    every skill entry.
  - education: Highlight intellectual curiosity and self-directed learning.
""".strip(),

    "alien": """
ARCHETYPE PERSONA: ALIEN (Extraterrestrial Field Scientist)
Tone: Clinically detached, slightly bemused, scientific notation style.
      Occasional dry humour is acceptable.
Rules:
  - basics.label: Replace job title with a "Biological Classification"
    (e.g. "Homo sapiens -- Code Articulation Specialist, Tier 3").
  - basics.summary: Written as a field-observation abstract
    ("Unit designation [NAME] has demonstrated recurring pattern of...").
  - work[].summary: "Mission Log" framing -- each role is an assignment the
    specimen accepted to exchange labour for resource tokens.
  - skills[].name: "Installed Cognitive Module" phrasing.
  - education[].studyType: "Knowledge Acquisition Event".
  - Keep it charming enough that an employer would smile, not be confused.
""".strip(),
}


# ── YAML conversion helper ────────────────────────────────────────────────────

def dict_to_yaml(data: dict[str, Any]) -> str:
    """Convert a JSON Resume dict to a clean, block-style YAML string."""
    return yaml.dump(
        data,
        sort_keys=False,
        allow_unicode=True,
        default_flow_style=False,
    )


# ── Helpers ───────────────────────────────────────────────────────────────────

def _finish_reason(response: Any) -> str:
    """Safely extract the finish_reason string from a Gemini response."""
    try:
        return response.candidates[0].finish_reason.name
    except Exception:
        return "UNKNOWN"


# ── Single-archetype generation helper ───────────────────────────────────────

async def generate_single_archetype(
    archetype: str,
    persona: str,
    raw_text: str,
    index: int = 0,
) -> str:
    """
    Generate ONE CV archetype as a YAML string, with retry logic.

    index:  position in the launch order (0–3).  Multiplied by STAGGER_STEP
            to introduce a startup delay that prevents all 4 calls from hitting
            the Gemini API at the exact same millisecond.

    Retry behaviour (MAX_RETRIES attempts):
      - Gemini API error    → log warning, sleep, retry
      - Empty response      → log warning + finish_reason, sleep, retry
      - JSONDecodeError     → log warning + finish_reason, sleep, retry
      - On final attempt    → raise so asyncio.gather propagates the error
    """
    # Stagger concurrent starts: call 0 fires immediately, call 3 waits 1.5 s
    if index > 0:
        await asyncio.sleep(index * STAGGER_STEP)

    system_instruction = f"{BASE_INSTRUCTION}\n\n{persona}"
    user_prompt = (
        f"Rewrite the following resume as a single JSON Resume object "
        f"in the {archetype.upper()} persona style.\n\n"
        "--- RESUME START ---\n"
        f"{raw_text}\n"
        "--- RESUME END ---"
    )

    log.info("Starting archetype '%s' (index=%d)", archetype, index)

    last_exc: Exception = RuntimeError(f"No attempts made for '{archetype}'")

    for attempt in range(MAX_RETRIES):
        # Back-off between retries (not before the first attempt)
        if attempt > 0:
            log.warning(
                "Attempt %d/%d for '%s' — sleeping %.1fs before retry",
                attempt + 1, MAX_RETRIES, archetype, RETRY_DELAY,
            )
            await asyncio.sleep(RETRY_DELAY)

        response: Any = None
        try:
            response = await asyncio.to_thread(
                client.models.generate_content,
                model=MODEL,
                contents=user_prompt,
                config=types.GenerateContentConfig(
                    system_instruction=system_instruction,
                    response_mime_type="application/json",
                    temperature=0.7,
                    max_output_tokens=MAX_TOKENS,
                ),
            )

            raw_json = (response.text or "").strip()
            if not raw_json:
                raise ValueError(
                    f"Empty response (finish_reason={_finish_reason(response)})"
                )

            data: dict[str, Any] = json.loads(raw_json)
            log.info(
                "Archetype '%s' OK — attempt %d/%d, finish_reason=%s, keys=%d",
                archetype, attempt + 1, MAX_RETRIES,
                _finish_reason(response), len(data),
            )
            return dict_to_yaml(data)

        except json.JSONDecodeError as exc:
            reason = _finish_reason(response) if response is not None else "N/A"
            log.warning(
                "Attempt %d/%d — JSONDecodeError for '%s' "
                "(finish_reason=%s): %s  raw=%r",
                attempt + 1, MAX_RETRIES, archetype,
                reason, exc, (response.text or "")[:300] if response else "",
            )
            last_exc = ValueError(
                f"Invalid JSON from Gemini for '{archetype}' "
                f"(finish_reason={reason}): {exc}"
            )

        except ValueError as exc:
            log.warning(
                "Attempt %d/%d — ValueError for '%s': %s",
                attempt + 1, MAX_RETRIES, archetype, exc,
            )
            last_exc = exc

        except Exception as exc:
            log.warning(
                "Attempt %d/%d — API error for '%s': %s",
                attempt + 1, MAX_RETRIES, archetype, exc,
            )
            last_exc = RuntimeError(
                f"Gemini API error for '{archetype}': {exc}"
            )

    # All attempts exhausted — propagate to asyncio.gather → 502
    raise last_exc


# ── Route ────────────────────────────────────────────────────────────────────

@app.post("/api/generate-cvs", response_model=GenerateResponse)
async def generate_cvs(request: GenerateRequest) -> GenerateResponse:
    """
    Fires 4 concurrent Gemini calls — one per archetype — via asyncio.gather().
    Wall-clock time ≈ the slowest single call (~10-15 s), not 4× that.
    """
    log.info(
        "Received generate-cvs request (%d chars) — launching 4 parallel calls",
        len(request.raw_text),
    )

    raw_text = request.raw_text.strip()

    tasks = [
        generate_single_archetype(archetype, persona, raw_text, index=i)
        for i, (archetype, persona) in enumerate(PERSONA_INSTRUCTIONS.items())
    ]

    try:
        professional_yaml, historian_yaml, didactic_yaml, alien_yaml = (
            await asyncio.gather(*tasks)
        )
    except (RuntimeError, ValueError) as exc:
        log.error("Parallel generation failed: %s", exc)
        raise HTTPException(status_code=502, detail=str(exc)) from exc
    except Exception as exc:
        log.exception("Unexpected error during parallel generation: %s", exc)
        raise HTTPException(
            status_code=500, detail=f"Unexpected server error: {exc}"
        ) from exc

    log.info("All 4 archetypes generated successfully.")
    return GenerateResponse(
        professional=professional_yaml,
        historian=historian_yaml,
        didactic=didactic_yaml,
        alien=alien_yaml,
    )


# ── Health check ─────────────────────────────────────────────────────────────

@app.get("/health")
async def health() -> dict:
    return {"status": "ok", "model": MODEL, "mode": "parallel-4x"}


# ── CoinAssistant: Bulk Input API ────────────────────────────────────────────

class BulkInputRequest(BaseModel):
    """Comma-separated expense values + optional date."""
    values: str = Field(
        ...,
        min_length=1,
        description="Comma-separated numeric values, e.g. '45.50, 120, 33.90, 88'",
    )
    date: str = Field(
        default_factory=lambda: __import__("datetime").date.today().isoformat(),
        description="ISO date for all entries (default: today). Format: YYYY-MM-DD",
    )


class BulkTransaction(BaseModel):
    date: str
    value: float
    description: str
    entryType: str


class BulkInputResponse(BaseModel):
    transactions: list[BulkTransaction]
    skipped: int = Field(default=0, description="Count of non-numeric or negative values skipped")


@app.post("/api/coin/bulk-input", response_model=BulkInputResponse)
async def coin_bulk_input(request: BulkInputRequest) -> BulkInputResponse:
    """
    Parse a comma-separated string of expense values and return structured
    transaction objects ready for the frontend to commit.

    Validation rules:
      - Non-numeric tokens are skipped (counted in `skipped`)
      - Negative or zero values are skipped
      - Values are rounded to 2 decimal places
    """
    parts = [s.strip() for s in request.values.split(",") if s.strip()]
    transactions: list[BulkTransaction] = []
    skipped = 0

    for part in parts:
        try:
            value = float(part)
        except ValueError:
            skipped += 1
            continue

        if value <= 0 or not __import__("math").isfinite(value):
            skipped += 1
            continue

        transactions.append(
            BulkTransaction(
                date=request.date,
                value=round(value, 2),
                description="Sem descrição",
                entryType="expense",
            )
        )

    if not transactions:
        raise HTTPException(
            status_code=422,
            detail="Nenhum valor numérico positivo encontrado na string fornecida.",
        )

    log.info(
        "Bulk input: %d transactions parsed, %d skipped",
        len(transactions), skipped,
    )
    return BulkInputResponse(transactions=transactions, skipped=skipped)


# ── Ocorrências: Incident Report Generator ───────────────────────────────────

from ocorrencias import mapper as oc_mapper


@app.post("/api/ocorrencias/gerar")
async def gerar_ocorrencia(request: Request):
    """
    Generates a stamped incident report PDF — ZERO disk writes.

    Flow:
    1. Extracts dynamic form payload containing arbitrary user-mapped fields
    2. Reads the uploaded template PDF into memory
    3. Stamps text onto the correct pages using the dynamic JSON map
    4. Streams the result back as application/pdf
    """
    form_data = await request.form()
    
    template_pdf = form_data.get("template_pdf")
    if template_pdf is None or not hasattr(template_pdf, "read"):
        raise HTTPException(status_code=422, detail="PDF template não enviado ou inválido.")

    # Checkboxes
    checkbox_orientacao = str(form_data.get("checkbox_orientacao", "false")).lower() == "true"
    checkbox_convocar = str(form_data.get("checkbox_convocar", "false")).lower() == "true"
    
    # Template Map
    template_map_json = str(form_data.get("template_map_json", ""))

    log.info("Received ocorrencia request")

    # 1. Read template bytes into memory (NEVER saved to disk)
    template_bytes = await template_pdf.read()
    if not template_bytes:
        raise HTTPException(status_code=422, detail="Arquivo PDF vazio ou inválido.")

    # Basic PDF validation
    if not template_bytes[:5] == b"%PDF-":
        raise HTTPException(status_code=422, detail="O arquivo enviado não é um PDF válido.")

    # 2. Load config and template map
    oc_config = oc_mapper.load_config()
    if template_map_json:
        template_map = json.loads(template_map_json)
    else:
        template_map = oc_mapper.load_template_map()

    # 3. Build the dynamic fields dict — direct passthrough, no AI
    fields = {}
    
    # Inject all string fields from the form payload
    for key, value in form_data.items():
        if isinstance(value, str) and key not in ["template_map_json"]:
            fields[key] = value

    # Normalize checkbox fields to booleans
    fields["checkbox_orientacao_aluno"] = checkbox_orientacao
    fields["checkbox_convocar_responsavel"] = checkbox_convocar

    log.info(f"Form Keys: {list(fields.keys())} | Map Keys: {list(template_map.get('fields', {}).keys())}")

    # 5. Generate stamped PDF in memory
    try:
        pdf_bytes = oc_mapper.generate_pdf_buffer(
            template_bytes=template_bytes,
            fields=fields,
            template_map=template_map,
            config=oc_config,
        )
    except Exception as exc:
        log.exception("PDF generation failed: %s", exc)
        raise HTTPException(
            status_code=500,
            detail=f"Erro ao gerar PDF: {exc}"
        ) from exc

    log.info(
        "Ocorrência generated successfully: %d bytes, aluno='%s'",
        len(pdf_bytes), form_data.get('nome_aluno', 'Não informado'),
    )

    # 6. Stream the PDF back — nothing touches disk
    headers = {"Content-Disposition": 'attachment; filename="ocorrencia_gerada.pdf"'}
    return StreamingResponse(
        io.BytesIO(pdf_bytes),
        media_type="application/pdf",
        headers=headers,
    )


# ── Dev entrypoint ───────────────────────────────────────────────────────────

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
