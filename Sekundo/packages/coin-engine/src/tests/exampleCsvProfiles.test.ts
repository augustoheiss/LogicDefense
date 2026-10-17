import {
  EXAMPLE_CSV_PROFILES,
  getExampleProfileById,
  getExampleProfilesForPreset,
  buildAiPromptForProfile,
} from '../data/exampleCsvProfiles';
import { parseCSVText } from '../utils/csvEngine';
import { detectSectorsFromRows } from '../utils/sectorTagDetector';
import { serializeDynamicCSV, serializeGranularCSV } from '../core/dynamicCsvSerializer';
import { computeMetrics } from '../core/metricsEngine';
import { computeInvestorMetrics } from '../core/investorMetricsEngine';
import type { TableRow } from '../core/types';

declare const describe: (name: string, fn: () => void) => void;
declare const it: (name: string, fn: () => void) => void;
declare const expect: (actual: any) => any;
declare const require: (moduleName: string) => any;
declare const __dirname: string;

const fs = require('fs');
const path = require('path');

describe('Example CSV Profiles & Fictitious Templates Suite', () => {
  it('should provide all 8 distinct profiles in EXAMPLE_CSV_PROFILES', () => {
    expect(EXAMPLE_CSV_PROFILES.length).toBe(8);
    const ids = EXAMPLE_CSV_PROFILES.map((p) => p.id);
    expect(ids).toEqual([
      'survival_family',
      'freelancer_autonomo',
      'driver_fleet',
      'investor_fire',
      'smb_business',
      'real_estate_sac',
      'liberal_professional_tax',
      'ai_universal_template',
    ]);
  });

  it('should have matching physical .csv files in src/data/examples/', () => {
    const examplesDir = path.resolve(__dirname, '../data/examples');
    for (const profile of EXAMPLE_CSV_PROFILES) {
      const filePath = path.join(examplesDir, profile.fileName);
      expect(fs.existsSync(filePath)).toBe(true);
      const diskContent = String(fs.readFileSync(filePath, 'utf-8')).trim().replace(/\r\n/g, '\n');
      const catalogContent = profile.fullBackupV3Csv.trim().replace(/\r\n/g, '\n');
      expect(diskContent).toBe(catalogContent);
    }
  });

  it('should parse both fullBackupV3Csv and compactSimpleCsv for all 8 profiles with 0 errors', () => {
    for (const profile of EXAMPLE_CSV_PROFILES) {
      const parsedFull = parseCSVText(profile.fullBackupV3Csv);
      expect(parsedFull.errors.length).toBe(0);
      expect(parsedFull.rows.length).toBeGreaterThan(9);
      expect(parsedFull.isAmbiguous).toBe(false);
      expect(parsedFull.metadata?.name).toBeTruthy();
      expect(parsedFull.metadata?.investorProfile?.profileType).toBe(profile.investorProfileType);

      const parsedSimple = parseCSVText(profile.compactSimpleCsv);
      expect(parsedSimple.errors.length).toBe(0);
      expect(parsedSimple.rows.length).toBe(parsedFull.rows.length);
      expect(parsedSimple.isAmbiguous).toBe(false);
    }
  });

  it('should compute valid financial & investor metrics and detect specialized sectors for each profile', () => {
    // 03 Driver Fleet -> vehicles
    const driver = getExampleProfileById('driver_fleet')!;
    const parsedDriver = parseCSVText(driver.fullBackupV3Csv);
    const driverSectors = detectSectorsFromRows(parsedDriver.rows);
    expect(driverSectors.includes('vehicles')).toBe(true);

    // 04 Investor FIRE -> portfolio & passive income
    const investor = getExampleProfileById('investor_fire')!;
    const parsedInvestor = parseCSVText(investor.fullBackupV3Csv);
    const invMetrics = computeInvestorMetrics(
      parsedInvestor.rows as TableRow[],
      parsedInvestor.metadata!.investorProfile!,
      62000
    );
    expect(invMetrics.totalNetWorth).toBeGreaterThan(50000);
    expect(invMetrics.passiveIncomeMonthlyAvg).toBeGreaterThan(400);

    // 05 SMB -> smb_accounting & legal_taxes + partner flows
    const smb = getExampleProfileById('smb_business')!;
    const parsedSmb = parseCSVText(smb.fullBackupV3Csv);
    const smbSectors = detectSectorsFromRows(parsedSmb.rows);
    expect(smbSectors.includes('smb_accounting')).toBe(true);
    expect(smbSectors.includes('legal_taxes')).toBe(true);
    const smbMetrics = computeMetrics(parsedSmb.rows as TableRow[], parsedSmb.metadata?.tableGoals);
    expect(smbMetrics.grossTotal).toBeGreaterThan(100000);

    // 06 Real Estate -> real_estate
    const realEstate = getExampleProfileById('real_estate_sac')!;
    const parsedRE = parseCSVText(realEstate.fullBackupV3Csv);
    const reSectors = detectSectorsFromRows(parsedRE.rows);
    expect(reSectors.includes('real_estate')).toBe(true);

    // 07 Liberal Professional -> legal_taxes
    const liberal = getExampleProfileById('liberal_professional_tax')!;
    const parsedLib = parseCSVText(liberal.fullBackupV3Csv);
    const libSectors = detectSectorsFromRows(parsedLib.rows);
    expect(libSectors.includes('legal_taxes')).toBe(true);

    // 08 Universal AI Template -> covers all 7 entryTypes
    const universal = getExampleProfileById('ai_universal_template')!;
    const parsedUni = parseCSVText(universal.fullBackupV3Csv);
    const entryTypes = new Set(parsedUni.rows.map((r) => r.entryType));
    expect(entryTypes.has('revenue')).toBe(true);
    expect(entryTypes.has('expense')).toBe(true);
    expect(entryTypes.has('deposit')).toBe(true);
    expect(entryTypes.has('waiver')).toBe(true);
    expect(entryTypes.has('partner_in')).toBe(true);
    expect(entryTypes.has('partner_out')).toBe(true);
    expect(entryTypes.has('unresolved')).toBe(true);
  });

  it('should round-trip through serializeDynamicCSV and serializeGranularCSV without losing rows', () => {
    for (const profile of EXAMPLE_CSV_PROFILES) {
      const parsed = parseCSVText(profile.fullBackupV3Csv);
      const reExportedV3 = serializeDynamicCSV(
        parsed.rows as TableRow[],
        parsed.metadata?.name,
        parsed.metadata?.description,
        parsed.metadata?.tableGoals,
        parsed.metadata?.tableId,
        'am_sheet_example_fictitious',
        0,
        parsed.metadata?.schema,
        parsed.metadata?.investorProfile,
        parsed.metadata?.activeSectors,
        parsed.metadata?.dashboardConfig,
        parsed.metadata?.sectorParams
      );

      const reparsed = parseCSVText(reExportedV3);
      expect(reparsed.errors.length).toBe(0);
      expect(reparsed.rows.length).toBe(parsed.rows.length);

      const compactExport = serializeGranularCSV(parsed.rows as TableRow[], {
        scope: 'all',
        format: 'agent_compact',
      });
      expect(compactExport.length).toBeGreaterThan(20);
    }
  });

  it('should generate complete AI builder prompts and contain ZERO sensitive or real personal data', () => {
    const presets = getExampleProfilesForPreset('investor');
    expect(presets.length).toBeGreaterThan(1);

    for (const profile of EXAMPLE_CSV_PROFILES) {
      const prompt = buildAiPromptForProfile(profile, true);
      expect(prompt.includes('## COIN ASSISTANT BACKUP v3 ##')).toBe(true);
      expect(prompt.includes(profile.fileName)).toBe(true);

      // Privacy & Security check: must never contain real live API keys, real CPFs, or real emails
      expect(profile.fullBackupV3Csv.includes('am_sheet_live_')).toBe(false);
      expect(profile.fullBackupV3Csv.includes('am_pro_')).toBe(false);
      expect(profile.fullBackupV3Csv.includes('am_sheet_example_fictitious')).toBe(true);
      expect(/\b\d{3}\.\d{3}\.\d{3}-\d{2}\b/.test(profile.fullBackupV3Csv)).toBe(false);
      expect(/\b\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}\b/.test(profile.fullBackupV3Csv)).toBe(false);
    }
  });
});
