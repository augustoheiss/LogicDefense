export interface DetectedSectors {
  activated: string[]; // List of sector IDs detected
}

const SECTOR_TAG_MAP: Record<string, string[]> = {
  vehicles: ['cpk', 'fuel', 'weibull', 'ubi', 'tco_vehicle'],
  real_estate: ['tabela_price', 'sistema_sac', 'cap_rate', 'rental_income'],
  smb_accounting: ['ncg', 'fap_rat', 'lucro_real', 'cfar'],
  legal_taxes: ['fator_r', 'taxa_legal', 'irpf_2026', 'simples_nacional'],
};

/**
 * Scans a list of rows' tags, category, and metadataJson fields for sector markers.
 * Returns an array of detected sector keys.
 */
export function detectSectorsFromRows(
  rows: Array<{
    tags?: string;
    category?: string;
    metadataJson?: string;
    description?: string;
  }>
): string[] {
  const detected = new Set<string>();

  for (const row of rows) {
    const fieldsToScan = [
      row.tags || '',
      row.category || '',
      row.metadataJson || '',
      row.description || '',
    ].map((val) => val.toLowerCase());

    for (const [sector, markers] of Object.entries(SECTOR_TAG_MAP)) {
      for (const marker of markers) {
        const markerLower = marker.toLowerCase();
        const found = fieldsToScan.some((field) => field.includes(markerLower));
        if (found) {
          detected.add(sector);
          break; // Stop scanning markers for this sector on this row
        }
      }
    }
  }

  return Array.from(detected);
}
