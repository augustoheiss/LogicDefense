/**
 * Sekundo — CSV processing tests
 */

import { describe, it, expect } from 'vitest';
import { parseCSV, serializeCSV, validateCSV, buildDiff } from '../index';
import type { FlatRegistry } from '../skeleton/types';

describe('CSV Parser', () => {
  it('parses standard compliant CSV', () => {
    const csv = '_key,_type,label,value,email,_meta_json\n01,header,Reunião Semanal,,,\n01-01,slot,Presidente,Irmão Silva,silva@email.com,"{""sala"": ""Principal""}"\n';
    const parsed = parseCSV(csv);
    expect(parsed).toHaveLength(2);
    expect(parsed[0]).toEqual({
      _key: '01',
      _type: 'header',
      label: 'Reunião Semanal',
      value: '',
      email: '',
      _meta_json: '',
    });
    expect(parsed[1]).toEqual({
      _key: '01-01',
      _type: 'slot',
      label: 'Presidente',
      value: 'Irmão Silva',
      email: 'silva@email.com',
      _meta_json: '{"sala": "Principal"}',
    });
  });

  it('handles quotes and commas in fields', () => {
    const csv = `_key,_type,label,value,email,_meta_json\n01-01,slot,"Coordenador, Reunião","""Silva""",,\n`;
    const parsed = parseCSV(csv);
    expect(parsed).toHaveLength(1);
    expect(parsed[0].label).toBe('Coordenador, Reunião');
    expect(parsed[0].value).toBe('"Silva"');
  });

  it('throws error when _key is missing', () => {
    const csv = `_type,label,value\nslot,Presidente,Irmão Silva\n`;
    expect(() => parseCSV(csv)).toThrow('CSV is missing required header: "_key"');
  });
});

describe('CSV Serializer', () => {
  it('serializes rows back to CSV string', () => {
    const rows = [
      {
        _key: '01',
        _type: 'header',
        label: 'Reunião Semanal',
        value: '',
        email: '',
        _meta_json: '',
      },
      {
        _key: '01-01',
        _type: 'slot',
        label: 'Presidente',
        value: 'Irmão Silva',
        email: 'silva@email.com',
        _meta_json: '{"sala": "Principal"}',
      },
    ];
    const csv = serializeCSV(rows);
    const parsed = parseCSV(csv);
    expect(parsed).toHaveLength(2);
    expect(parsed[0]._key).toBe('01');
    expect(parsed[1].label).toBe('Presidente');
  });

  it('escapes cells with special characters during serialization', () => {
    const rows = [
      {
        _key: '01-01',
        _type: 'slot',
        label: 'Coordenador, Reunião',
        value: '"Silva"',
        email: '',
        _meta_json: '',
      },
    ];
    const csv = serializeCSV(rows);
    expect(csv).toContain('"Coordenador, Reunião"');
    expect(csv).toContain('"""Silva"""');
  });
});

describe('CSV Validator & Diff', () => {
  it('validates rows with correct formatting', () => {
    const rows = [
      { _key: '01', _type: 'header', label: 'Valid Header' },
      { _key: 'invalid-key', _type: 'slot', label: 'Invalid' },
      { _key: '01-01', _type: 'unknown-type', label: 'Invalid' },
      { _key: '01-02', _type: 'slot', label: '' },
    ];
    const result = validateCSV(rows);
    expect(result.valid).toBe(false);
    expect(result.totalRows).toBe(4);
    expect(result.validRows).toBe(1);
    expect(result.errors).toHaveLength(3);
  });

  it('computes differences between current and incoming CSV rows', () => {
    const current: FlatRegistry = [
      { key: '01', type: 'header', label: 'Reunião Semanal', value: '', email: '', meta: {} },
      { key: '01-01', type: 'slot', label: 'Presidente', value: 'Irmão Silva', email: '', meta: {} },
    ];

    const incoming = [
      // Unchanged
      { _key: '01', _type: 'header', label: 'Reunião Semanal', value: '', email: '', _meta_json: '' },
      // Modified value
      { _key: '01-01', _type: 'slot', label: 'Presidente', value: 'Irmão Santos', email: '', _meta_json: '' },
      // Added
      { _key: '01-02', _type: 'slot', label: 'Leitor', value: 'Irmão Costa', email: '', _meta_json: '' },
    ];

    const diff = buildDiff(current, incoming);
    expect(diff.added).toBe(1);
    expect(diff.modified).toBe(1);
    expect(diff.deleted).toBe(0);
    expect(diff.unchanged).toBe(1);

    const modifiedEntry = diff.entries.find(e => e.key === '01-01');
    expect(modifiedEntry?.action).toBe('modify');
    expect(modifiedEntry?.currentValue).toBe('Irmão Silva');
    expect(modifiedEntry?.incomingValue).toBe('Irmão Santos');

    const addedEntry = diff.entries.find(e => e.key === '01-02');
    expect(addedEntry?.action).toBe('add');
    expect(addedEntry?.incomingLabel).toBe('Leitor');
  });
});
