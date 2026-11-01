import { describe, it, expect, vi } from 'vitest';
import * as zlib from 'zlib';
import {
  CANVASS_LOGISTIC_CODES,
  FORBIDDEN_PROFILING_CODES,
  normalizeCanvassOperationalCode,
  sanitizeCanvassNotesForLgpd,
  canvassingEngine,
  ROUTING_POLICY_CONFIG,
  anonymizeCoordForOsrm,
  calculateMultiStopMapRoute,
  sanitizeTerritoryNodeForPrivacy,
  buildTerritoryModelCsvText,
  formatShareAddressLocationText,
  formatShareTerritoryOrQuadraLocationsText,
  extractQuadrasFromRegistry,
  parseXlsxBytesToGrid,
  buildXlsxBytesFromGrid,
  parseKmlToCleanTerritoryNodes,
  exportCleanTerritoryNodesToKml,
  parseGeoJsonToCleanTerritoryNodes,
  exportCleanTerritoryNodesToGeoJson,
  importTerritoryMultiFormat,
  exportTerritoryMultiFormat,
  importTerritoryUniversalFile,
  exportTerritoryUniversalFile,
  roundOriginForPrivacy,
  buildCleanRoomTerritoryImportSample,
  geoJsonToSkeletonNodes,
  skeletonNodesToGeoJson,
  ensureLatLngRing,
  computeTerritoryRecencyList,
  extractTerritorySummaries,
} from '../index';
import {
  roundOriginForPrivacy as urlRoundOriginForPrivacy,
  buildGoogleMapsDirectionsUrl as urlBuildDirections,
} from '../geo/googleMapsUrl';

describe('Sekundo Audit — LGPD / CJEU C-25/17 Privacy, Offline Routing & Multi-Format IO (.xlsx, .csv, .kml, .geojson)', () => {
  describe('Alert 1: LGPD Art. 5º II & Art. 11 / CJEU C-25/17 Anti-Profiling Guard', () => {
    it('normalizes behavioral/ethnic profiling codes (HOS, REF, LAN, DNC) into neutral logistic coverage codes', () => {
      expect(CANVASS_LOGISTIC_CODES).toEqual(['VIS', 'PEN', 'COM', 'INA', 'VAC']);
      expect(FORBIDDEN_PROFILING_CODES).toEqual(['HOS', 'REF', 'LAN', 'DNC']);

      expect(normalizeCanvassOperationalCode('HOS')).toBe('VIS');
      expect(normalizeCanvassOperationalCode('REF')).toBe('VIS');
      expect(normalizeCanvassOperationalCode('LAN')).toBe('VIS');
      expect(normalizeCanvassOperationalCode('DNC')).toBe('VIS');
      expect(normalizeCanvassOperationalCode('CNT')).toBe('VIS');
      expect(normalizeCanvassOperationalCode('NH')).toBe('PEN');
      expect(normalizeCanvassOperationalCode('COM')).toBe('COM');
      expect(normalizeCanvassOperationalCode('INA')).toBe('INA');
      expect(normalizeCanvassOperationalCode('VAC')).toBe('VAC');
    });

    it('blocks behavioral profiling codes when strictLgpd validation is active', () => {
      const resHostile = canvassingEngine.validateNode({
        key: '01-01-01',
        type: 'slot',
        label: 'Unidade 1',
        value: '',
        email: '',
        children: [],
        meta: { contactCode: 'HOS', strictLgpd: true } as any,
      });
      expect(resHostile.valid).toBe(false);
      expect(resHostile.errors[0]).toContain('LGPD / C-25/17');

      const resLogistic = canvassingEngine.validateNode({
        key: '01-01-01',
        type: 'slot',
        label: 'Unidade 1',
        value: '',
        email: '',
        children: [],
        meta: { contactCode: 'VIS', strictLgpd: true } as any,
      });
      expect(resLogistic.valid).toBe(true);
    });

    it('scrubs behavioral and ethnic profiling from notes, WhatsApp shares, and privacy-safe CSV exports', () => {
      expect(
        sanitizeCanvassNotesForLgpd('Morador hostil e bravo [NÃO VISITAR] idioma espanhol - Portão azul')
      ).toBe('Morador e - Portão azul');

      const rawNode = {
        key: '01-01-01-01',
        type: 'territory' as const,
        label: 'Rua das Acácias, 100 [NÃO VISITAR]',
        value: 'Voluntário Alpha',
        email: 'alpha@example.org',
        meta: {
          territory_number: 'T01.01.01',
          locality: 'Setor Demo',
          line: 'Rua das Acácias, 100 [NÃO VISITAR]',
          city: 'Município Exemplo',
          state: 'SP',
          dnc: true,
          isForeign: true,
          language: 'Espanhol',
          workerName: 'Voluntário Alpha',
          notes: 'Recusou visita, morador hostil',
          worked: 1,
        },
      };

      const sanitized = sanitizeTerritoryNodeForPrivacy(rawNode);
      expect(sanitized.label).toBe('Rua das Acácias, 100');
      expect(sanitized.value).toBe('');
      expect(sanitized.meta?.dnc).toBeUndefined();
      expect(sanitized.meta?.language).toBeUndefined();
      expect(sanitized.meta?.workerName).toBeUndefined();
      expect(sanitized.meta?.notes).toBeUndefined();

      const csvSafe = buildTerritoryModelCsvText([rawNode], { privacySafeMode: true });
      expect(csvSafe).not.toContain('NÃO VISITAR');
      expect(csvSafe).not.toContain('Voluntário Alpha');
      expect(csvSafe).not.toContain('Espanhol');
      expect(csvSafe).not.toContain('hostil');

      const waSingle = formatShareAddressLocationText(rawNode, 'Município Exemplo', {
        includeNotes: true,
      });
      expect(waSingle.text).not.toContain('NÃO VISITAR');
      expect(waSingle.text).not.toContain('hostil');

      const waQuadra = formatShareTerritoryOrQuadraLocationsText({
        territoryNumber: 'T01.01.01',
        items: [rawNode],
        includeNotes: true,
      });
      expect(waQuadra.text).not.toContain('NÃO VISITAR');
      expect(waQuadra.text).not.toContain('hostil');
    });
  });

  describe('Alert 2: Offline-First Haversine Routing & OSRM GPS Anonymization', () => {
    it('defaults to offline_first routing mode and never leaks coordinates when privacyMode is offline_first', async () => {
      expect(ROUTING_POLICY_CONFIG.defaultPrivacyMode).toBe('offline_first');

      const fetchSpy = vi.fn();
      const route = await calculateMultiStopMapRoute(
        [-23.55052, -46.633308],
        [[-23.5515, -46.6342]],
        {
          privacyMode: 'offline_first',
          fetchImpl: fetchSpy as any,
        }
      );

      expect(route.source).toBe('offline_haversine');
      expect(fetchSpy).not.toHaveBeenCalled();
    });

    it('truncates exact operator GPS origin to ~110m grid when osrm_opt_in + anonymizeOrigin is enabled', async () => {
      const rounded = anonymizeCoordForOsrm([-23.550529, -46.633891], 3);
      expect(rounded).toEqual([-23.551, -46.634]);

      let requestedUrl = '';
      const mockFetch = vi.fn(async (url: string) => {
        requestedUrl = url;
        return {
          ok: true,
          json: async () => ({
            routes: [
              {
                distance: 210,
                duration: 160,
                geometry: {
                  coordinates: [
                    [-46.634, -23.551],
                    [-46.635, -23.552],
                  ],
                },
                legs: [],
              },
            ],
          }),
        };
      });

      const res = await calculateMultiStopMapRoute(
        [-23.550529, -46.633891],
        [[-23.552, -46.635]],
        {
          privacyMode: 'osrm_opt_in',
          anonymizeOrigin: true,
          fetchImpl: mockFetch as any,
        }
      );

      expect(res.source).toBe('osrm');
      expect(requestedUrl).toContain('-46.634,-23.551');
      expect(requestedUrl).not.toContain('-46.633891');
    });
  });

  describe('Alert 3: KML Polygon-Only Territories (Zero Individual Houses Required) & Multi-Format IO', () => {
    it('imports KML with Folder=Bairro -> Placemark=Território polygons WITHOUT individual houses and renders QuadraSummary', () => {
      const sampleKmlPayload = buildCleanRoomTerritoryImportSample('kml_folders');
      expect(sampleKmlPayload.text).toContain('<Folder>');
      expect(sampleKmlPayload.text).toContain('<Polygon>');

      const parsed = parseKmlToCleanTerritoryNodes(sampleKmlPayload.text!);
      expect(parsed.polygonsCount).toBe(2);
      expect(parsed.addressesCount).toBe(0);
      expect(parsed.territoriesCount).toBe(2);

      // Verify extractQuadrasFromRegistry preserves polygon-only quadras even with 0 leaf houses!
      const quadras = extractQuadrasFromRegistry(parsed.nodes);
      expect(quadras).toHaveLength(2);
      expect(quadras[0].totalUnits).toBe(0);
      expect(quadras[0].boundaryPolygon.length).toBeGreaterThanOrEqual(4);
      expect(quadras[0].boundarySource).toBe('imported');
      expect(quadras[0].isCompleted).toBe(false);
      expect(quadras[0].statusColor).toBe('#EF4444');

      expect(quadras[1].totalUnits).toBe(0);
      expect(quadras[1].isCompleted).toBe(true);
      expect(quadras[1].coveragePercent).toBe(100);
      expect(quadras[1].statusColor).toBe('#10B981');

      // Re-export back to KML and verify Folder + Polygon structure is preserved
      const exportedKml = exportCleanTerritoryNodesToKml(parsed.nodes);
      expect(exportedKml).toContain('<Folder>');
      expect(exportedKml).toContain('Setor Demo Central');
      expect(exportedKml).toContain('<Polygon>');
    });

    it('round-trips 18-column .xlsx binary (both stored and DEFLATE-compressed ZIP entries)', () => {
      const sampleXlsx = buildCleanRoomTerritoryImportSample('xlsx_18col');
      expect(sampleXlsx.bytes).toBeInstanceOf(Uint8Array);

      const grid = parseXlsxBytesToGrid(sampleXlsx.bytes!);
      expect(grid.length).toBe(4); // 1 header + 3 synthetic rows
      expect(grid[0][0]).toBe('territory_number');
      expect(grid[1][0]).toBe('T01.01.01');

      const imported = importTerritoryMultiFormat({
        bytes: sampleXlsx.bytes,
        fileName: 'enderecos-modelo.xlsx',
      });
      expect(imported.format).toBe('xlsx');
      expect(imported.schemaType).toBe('external_18col');
      expect(imported.territoriesCount).toBe(2);
      expect(imported.addressesCount).toBe(3);

      // Re-export to .xlsx with privacySafeMode = true
      const reExported = exportTerritoryMultiFormat(imported.nodes, {
        format: 'xlsx',
        privacySafeMode: true,
      });
      const reGrid = parseXlsxBytesToGrid(reExported.bytes!);
      expect(reGrid.length).toBe(4);
    });

    it('decompresses DEFLATE-compressed .xlsx ZIP entries using synchronous RFC 1951 inflateRawSync', () => {
      // Build a minimal ZIP with method=8 (DEFLATE) for xl/worksheets/sheet1.xml
      const sheetXml = `<?xml version="1.0" encoding="UTF-8"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <sheetData>
    <row r="1"><c r="A1" t="inlineStr"><is><t>territory_number</t></is></c><c r="B1" t="inlineStr"><is><t>territory_locality</t></is></c><c r="C1" t="inlineStr"><is><t>line</t></is></c></row>
    <row r="2"><c r="A2" t="inlineStr"><is><t>T01.01.01</t></is></c><c r="B2" t="inlineStr"><is><t>Setor Inflate</t></is></c><c r="C2" t="inlineStr"><is><t>Rua Comprimida, 50</t></is></c></row>
  </sheetData>
</worksheet>`;
      const rawBytes = new TextEncoder().encode(sheetXml);
      const deflated = new Uint8Array(zlib.deflateRawSync(rawBytes));
      const nameBytes = new TextEncoder().encode('xl/worksheets/sheet1.xml');

      const header = new Uint8Array(30 + nameBytes.length + deflated.length);
      const view = new DataView(header.buffer);
      view.setUint32(0, 0x04034b50, true);
      view.setUint16(4, 20, true);
      view.setUint16(8, 8, true); // method 8 = DEFLATE
      view.setUint32(18, deflated.length, true);
      view.setUint32(22, rawBytes.length, true);
      view.setUint16(26, nameBytes.length, true);
      header.set(nameBytes, 30);
      header.set(deflated, 30 + nameBytes.length);

      const grid = parseXlsxBytesToGrid(header);
      expect(grid).toHaveLength(2);
      expect(grid[1]).toEqual(['T01.01.01', 'Setor Inflate', 'Rua Comprimida, 50']);
    });

    it('round-trips GeoJSON and JSON territory exports with proper [lng, lat] <-> [lat, lng] conversion', () => {
      const kmlSample = buildCleanRoomTerritoryImportSample('kml_folders');
      const kmlImported = parseKmlToCleanTerritoryNodes(kmlSample.text!);

      const geoJsonStr = exportCleanTerritoryNodesToGeoJson(kmlImported.nodes);
      const geoImported = parseGeoJsonToCleanTerritoryNodes(geoJsonStr);
      expect(geoImported.polygonsCount).toBe(2);

      const quadras = extractQuadrasFromRegistry(geoImported.nodes);
      expect(quadras).toHaveLength(2);
      // Verify latitude is around -23.55 and longitude is around -46.63 (not swapped!)
      expect(quadras[0].centerLat).toBeLessThan(-20);
      expect(quadras[0].centerLng).toBeLessThan(-40);
    });

    it('normalizes [lng, lat] <-> [lat, lng] in geoJsonAdapter (RT-02) and supports KML polygon-only territories in Recency & WhatsApp share', () => {
      const geoFeatureCol = {
        type: 'FeatureCollection' as const,
        features: [
          {
            type: 'Feature' as const,
            properties: { name: 'Quadra GeoJSON 01', worked: 1 },
            geometry: {
              type: 'Polygon' as const,
              coordinates: [
                [
                  [-46.6342, -23.5501],
                  [-46.6325, -23.5501],
                  [-46.6325, -23.5514],
                  [-46.6342, -23.5514],
                  [-46.6342, -23.5501],
                ],
              ],
            },
          },
        ],
      };

      const skelNodes = geoJsonToSkeletonNodes(geoFeatureCol, '01');
      expect(skelNodes).toHaveLength(1);
      const boundary = skelNodes[0].meta?.boundaryPolygon as [number, number][];
      expect(boundary).toHaveLength(4);
      // Internal boundaryPolygon must be [lat, lng] (latitude ~ -23.55, longitude ~ -46.63)
      expect(boundary[0][0]).toBeCloseTo(-23.5501, 4);
      expect(boundary[0][1]).toBeCloseTo(-46.6342, 4);

      const reExportedGeo = skeletonNodesToGeoJson(skelNodes);
      const outRing = reExportedGeo.features[0].geometry.coordinates[0];
      // Exported GeoJSON RFC 7946 ring must be closed (5 points) and in [lng, lat] order
      expect(outRing).toHaveLength(5);
      expect(outRing[0][0]).toBeCloseTo(-46.6342, 4);
      expect(outRing[0][1]).toBeCloseTo(-23.5501, 4);
      expect(ensureLatLngRing(outRing, 'auto')[0]).toEqual([-23.5501, -46.6342]);

      // Verify KML polygon-only territories work in computeTerritoryRecencyList, extractTerritorySummaries & WhatsApp share
      const kmlSample = buildCleanRoomTerritoryImportSample('kml_folders');
      const kmlParsed = importTerritoryUniversalFile({
        text: kmlSample.text,
        fileName: 'bairros.kml',
      });
      const recency = computeTerritoryRecencyList(kmlParsed.nodes);
      const t2 = recency.find((r) => r.territoryNumber === 'T01.02.01');
      expect(t2?.isCompleted).toBe(true);
      expect(t2?.percent).toBe(100);

      const summaries = extractTerritorySummaries(kmlParsed.nodes);
      expect(summaries).toHaveLength(2);
      expect(summaries[0].totalAddresses).toBe(0);

      const waPolyShare = formatShareTerritoryOrQuadraLocationsText({
        territoryNumber: 'T01.01.01',
        items: kmlParsed.nodes.filter((n) => n.meta?.territory_number === 'T01.01.01'),
      });
      expect(waPolyShare.mapsUrl).toContain('-23.55075');
      expect(roundOriginForPrivacy([-23.550529, -46.633891], 3)).toEqual([-23.551, -46.634]);
      expect(urlRoundOriginForPrivacy([-23.550529, -46.633891], 3)).toEqual([-23.551, -46.634]);
      expect(urlBuildDirections({ lat: -23.55075, lng: -46.63335 })).toContain('google.com/maps/dir');
      const kmlCsv19 = exportTerritoryUniversalFile(kmlParsed.nodes, {
        format: 'csv',
        spreadsheetSchema: 'sekundo_19col',
      });
      expect(kmlCsv19.privacySanitized).toBe(true);
      expect(kmlCsv19.text).toContain('T01.01.01');
      expect(kmlCsv19.text).toContain('quadra_poligonal');
      const kmlCsv18 = exportTerritoryUniversalFile(kmlParsed.nodes, {
        format: 'csv',
        spreadsheetSchema: 'external_18col',
      });
      expect(kmlCsv18.text).toContain('polygon_quadra');
    });
  });
});
