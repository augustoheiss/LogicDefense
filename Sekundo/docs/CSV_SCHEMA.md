# Sekundo — CSV Schema Specification

## Overview

The CSV file is the universal import/export format for Sekundo skeletons.
Any spreadsheet editor (Excel, Google Sheets, LibreOffice Calc) can create and modify these files.

## Column Definitions

| Column | Header | Required | Type | Description |
|---|---|---|---|---|
| 1 | `_key` | ✅ | `string` | Path key (e.g., `01-01-01`). **Must be the first column.** |
| 2 | `_type` | ✅ | `enum` | One of: `slot`, `territory`, `header`, `note` |
| 3 | `label` | ✅ | `string` | Human-readable name for the slot |
| 4 | `value` | ❌ | `string` | Assigned person, data, or status |
| 5 | `email` | ❌ | `string` | Email for notification dispatch |
| 6 | `_meta_json` | ❌ | `JSON string` | Arbitrary metadata as valid JSON |

## Rules

1. **Always parse by header name**, never by column position (except `_key` must be first).
2. All columns beyond `_key`, `_type`, and `label` are optional.
3. The admin may add custom columns — the system ignores unknown headers during import
   but preserves them during export.
4. Empty `value` fields represent unassigned slots.
5. The `_meta_json` column must contain valid JSON or be empty.

## Path Key Rules

- Segments separated by `-` (hyphen).
- Each segment is parsed as an **integer** (digit-width agnostic: `01` = `1` = `001`).
- Depth is determined by number of segments.
- Sorting is by integer array comparison, not string comparison.

## Example: Weekly Meeting Schedule

```csv
_key,_type,label,value,email,_meta_json
01,header,Reunião do Meio de Semana,,,
01-01,slot,Presidente,Irmão Silva,silva@email.com,"{""sala"": ""Principal""}"
01-01-01,slot,Leitor,Irmão Santos,santos@email.com,
01-02,slot,Som e Vídeo,Irmão Costa,costa@email.com,"{""equipamento"": ""Mesa_01""}"
02,header,Reunião do Fim de Semana,,,
02-01,slot,Presidente,Irmão Oliveira,oliveira@email.com,
02-02,slot,Indicador,Irmão Souza,souza@email.com,
```

## Example: Territory Distribution

```csv
_key,_type,label,value,email,_meta_json
03,header,Territórios,,,
03-01,territory,Quadra Norte,Irmão Lima,lima@email.com,"{""ruas"": [""Rua X"", ""Rua Y""], ""status"": ""designado""}"
03-02,territory,Quadra Sul,Irmão Pereira,pereira@email.com,"{""ruas"": [""Rua A""], ""status"": ""em_andamento""}"
```

## Example: Annual Event with Three-Digit Keys

```csv
_key,_type,label,value,email,_meta_json
001,header,Convenção 2026,,,
001-001,header,Dia 1 - Abertura,,,"{""date"": ""2026-08-15""}"
001-001-001,slot,Orador Principal,Dr. Mendes,mendes@email.com,
001-001-002,slot,Recepcionista,Sra. Alves,alves@email.com,
001-002,header,Dia 2 - Workshops,,,"{""date"": ""2026-08-16""}"
001-002-001,slot,Facilitador A,Prof. Dias,dias@email.com,
```

## Conflict Resolution on Re-Import

- **Last import wins** after the admin reviews a visual diff.
- The diff compares current localStorage state vs incoming CSV rows by `_key`.
- New keys: highlighted in green.
- Changed values: highlighted in yellow (old → new).
- Deleted keys (present in localStorage but absent in CSV): highlighted in red.
