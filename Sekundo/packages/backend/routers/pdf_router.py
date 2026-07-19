"""
Sekundo — PDF Processing Router

Stateless PDF operations:
  1. Extract form fields (AcroForms) from uploaded PDFs
  2. Auto-detect text anchor positions for flat PDFs
  3. Fill PDF with skeleton data (key-value injection)

🚨 ISOLATION: This router has ZERO connection to the Assistente-Moeda
   backend or the ocorrencias PDF writer on Render. It is a completely
   independent reimplementation using the same PyMuPDF foundation.
"""

import io
import json
from typing import Optional

from fastapi import APIRouter, File, Form, UploadFile, HTTPException
from fastapi.responses import StreamingResponse

import fitz  # PyMuPDF

router = APIRouter()


# ---------------------------------------------------------------------------
# 1. Extract Form Fields (AcroForms)
# ---------------------------------------------------------------------------

@router.post("/extract-fields")
async def extract_fields(file: UploadFile = File(...)):
    """
    Upload a PDF and extract all interactive form field metadata.

    Returns a list of detected fields with their internal IDs,
    names, types, page numbers, and bounding box coordinates.
    """
    if not file.filename or not file.filename.lower().endswith(".pdf"):
        raise HTTPException(status_code=400, detail="File must be a PDF.")

    content = await file.read()

    try:
        doc = fitz.open(stream=content, filetype="pdf")
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Cannot open PDF: {e}")

    fields = []

    for page_num in range(len(doc)):
        page = doc[page_num]

        # Extract interactive form widgets
        for widget in page.widgets():
            field_rect = widget.rect
            fields.append({
                "fieldId": widget.field_name or f"unnamed_{page_num}_{len(fields)}",
                "fieldName": widget.field_label or widget.field_name or "",
                "fieldType": _widget_type_to_string(widget.field_type),
                "page": page_num + 1,  # 1-indexed
                "x": round(field_rect.x0, 2),
                "y": round(field_rect.y0, 2),
                "width": round(field_rect.width, 2),
                "height": round(field_rect.height, 2),
            })

    doc.close()

    return {
        "filename": file.filename,
        "totalPages": len(doc),
        "fields": fields,
        "hasFormFields": len(fields) > 0,
    }


# ---------------------------------------------------------------------------
# 2. Auto-Detect Text Anchors (Flat PDFs)
# ---------------------------------------------------------------------------

@router.post("/detect-anchors")
async def detect_anchors(
    file: UploadFile = File(...),
    search_terms: str = Form(default=""),
):
    """
    Upload a flat PDF (no form fields) and search for text anchors.

    Provide a comma-separated list of search terms. The engine will
    find their bounding boxes and suggest coordinate positions for
    value placement (offset to the right of each anchor).

    If no search terms are provided, returns ALL text blocks with
    their coordinates for manual mapping.
    """
    if not file.filename or not file.filename.lower().endswith(".pdf"):
        raise HTTPException(status_code=400, detail="File must be a PDF.")

    content = await file.read()

    try:
        doc = fitz.open(stream=content, filetype="pdf")
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Cannot open PDF: {e}")

    terms = [t.strip() for t in search_terms.split(",") if t.strip()] if search_terms else []
    anchors = []
    offset_right = 8  # Points to the right of anchor for value insertion

    for page_num in range(len(doc)):
        page = doc[page_num]

        if terms:
            # Search for specific anchor strings
            for term in terms:
                instances = page.search_for(term)
                for rect in instances:
                    anchors.append({
                        "anchor": term,
                        "page": page_num + 1,
                        "anchorX": round(rect.x0, 2),
                        "anchorY": round(rect.y0, 2),
                        "suggestedX": round(rect.x1 + offset_right, 2),
                        "suggestedY": round(rect.y0, 2),
                        "width": round(rect.width, 2),
                        "height": round(rect.height, 2),
                    })
        else:
            # Return all text blocks
            blocks = page.get_text("dict")["blocks"]
            for block in blocks:
                if block.get("type") == 0:  # Text block
                    for line in block.get("lines", []):
                        for span in line.get("spans", []):
                            text = span.get("text", "").strip()
                            if text:
                                bbox = span.get("bbox", [0, 0, 0, 0])
                                anchors.append({
                                    "anchor": text,
                                    "page": page_num + 1,
                                    "anchorX": round(bbox[0], 2),
                                    "anchorY": round(bbox[1], 2),
                                    "suggestedX": round(bbox[2] + offset_right, 2),
                                    "suggestedY": round(bbox[1], 2),
                                    "fontSize": round(span.get("size", 10), 1),
                                })

    doc.close()

    return {
        "filename": file.filename,
        "searchTerms": terms,
        "anchors": anchors,
        "totalAnchors": len(anchors),
    }


# ---------------------------------------------------------------------------
# 3. Fill PDF with Skeleton Data
# ---------------------------------------------------------------------------

@router.post("/fill")
async def fill_pdf(
    file: UploadFile = File(...),
    coordinate_map: str = Form(...),
    skeleton_data: str = Form(...),
):
    """
    Fill a PDF with skeleton data using a coordinate map.

    Parameters:
      - file: The template PDF to fill.
      - coordinate_map: JSON string of path-key → {x, y, page, printMode, label}
      - skeleton_data: JSON string of path-key → value assignments

    Returns the filled PDF as a downloadable file.
    """
    if not file.filename or not file.filename.lower().endswith(".pdf"):
        raise HTTPException(status_code=400, detail="File must be a PDF.")

    content = await file.read()

    try:
        coord_map = json.loads(coordinate_map)
    except json.JSONDecodeError:
        raise HTTPException(status_code=400, detail="Invalid coordinate_map JSON.")

    try:
        data = json.loads(skeleton_data)
    except json.JSONDecodeError:
        raise HTTPException(status_code=400, detail="Invalid skeleton_data JSON.")

    try:
        doc = fitz.open(stream=content, filetype="pdf")
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Cannot open PDF: {e}")

    for path_key, mapping in coord_map.items():
        value = data.get(path_key, "")
        if not value:
            continue

        page_num = mapping.get("page", 1) - 1  # Convert to 0-indexed
        if page_num < 0 or page_num >= len(doc):
            continue

        page = doc[page_num]
        x = mapping.get("x", 0)
        y = mapping.get("y", 0)
        font_size = mapping.get("fontSize", 10)
        print_mode = mapping.get("printMode", "valueOnly")
        label = mapping.get("label", "")

        # Build the text based on print mode
        if print_mode == "keyAndValue" and label:
            text = f"{label}: {value}"
        else:
            text = value

        # Insert text at coordinates
        page.insert_text(
            point=fitz.Point(x, y),
            text=text,
            fontsize=font_size,
            fontname="helv",
            color=(0, 0, 0),
        )

    # Write to buffer
    output_buffer = io.BytesIO()
    doc.save(output_buffer)
    doc.close()
    output_buffer.seek(0)

    return StreamingResponse(
        output_buffer,
        media_type="application/pdf",
        headers={
            "Content-Disposition": f'attachment; filename="sekundo_filled.pdf"'
        },
    )


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _widget_type_to_string(field_type: int) -> str:
    """Convert PyMuPDF widget field_type int to readable string."""
    type_map = {
        0: "unknown",
        1: "button",
        2: "text",
        3: "choice",
        4: "signature",
        5: "checkbox",
        6: "radio",
        7: "listbox",
        8: "combobox",
    }
    return type_map.get(field_type, "unknown")
