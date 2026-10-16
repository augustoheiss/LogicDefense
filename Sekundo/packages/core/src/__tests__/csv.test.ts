/**
 * Sekundo — CSV processing tests
 */

import { describe, it, expect } from 'vitest';
import { parseCSV, serializeCSV, validateCSV, buildDiff } from '../index';
import type { FlatRegistry } from '../skeleton/types';

describe('CSV Parser', () => {
  it('parses standard compliant CSV', () => {
    const csv = '_key,_type,label,value,email,_meta_json\n01,header,Programação Semanal,,,\n01-01,slot,Coordenação,Alex Nogueira,alex@exemplo.org,"{""sala"": ""Principal""}"\n';
    const parsed = parseCSV(csv);
    expect(parsed).toHaveLength(2);
    expect(parsed[0]).toEqual({
      _key: '01',
      _type: 'header',
      label: 'Programação Semanal',
      value: '',
      email: '',
      _meta_json: '',
    });
    expect(parsed[1]).toEqual({
      _key: '01-01',
      _type: 'slot',
      label: 'Coordenação',
      value: 'Alex Nogueira',
      email: 'alex@exemplo.org',
      _meta_json: '{"sala": "Principal"}',
    });
  });

  it('handles quotes and commas in fields', () => {
    const csv = `_key,_type,label,value,email,_meta_json\n01-01,slot,"Coordenador, Sessão","""Nogueira""",,\n`;
    const parsed = parseCSV(csv);
    expect(parsed).toHaveLength(1);
    expect(parsed[0].label).toBe('Coordenador, Sessão');
    expect(parsed[0].value).toBe('"Nogueira"');
  });

  it('throws error when _key is missing', () => {
    const csv = `_type,label,value\nslot,Coordenação,Alex Nogueira\n`;
    expect(() => parseCSV(csv)).toThrow('CSV is missing required header: "_key"');
  });
});

describe('CSV Serializer', () => {
  it('serializes rows back to CSV string', () => {
    const rows = [
      {
        _key: '01',
        _type: 'header',
        label: 'Programação Semanal',
        value: '',
        email: '',
        _meta_json: '',
      },
      {
        _key: '01-01',
        _type: 'slot',
        label: 'Coordenação',
        value: 'Alex Nogueira',
        email: 'alex@exemplo.org',
        _meta_json: '{"sala": "Principal"}',
      },
    ];
    const csv = serializeCSV(rows);
    const parsed = parseCSV(csv);
    expect(parsed).toHaveLength(2);
    expect(parsed[0]._key).toBe('01');
    expect(parsed[1].label).toBe('Coordenação');
  });

  it('escapes cells with special characters during serialization', () => {
    const rows = [
      {
        _key: '01-01',
        _type: 'slot',
        label: 'Coordenador, Sessão',
        value: '"Nogueira"',
        email: '',
        _meta_json: '',
      },
    ];
    const csv = serializeCSV(rows);
    expect(csv).toContain('"Coordenador, Sessão"');
    expect(csv).toContain('"""Nogueira"""');
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
      { key: '01', type: 'header', label: 'Programação Semanal', value: '', email: '', meta: {} },
      { key: '01-01', type: 'slot', label: 'Coordenação', value: 'Alex Nogueira', email: '', meta: {} },
    ];

    const incoming = [
      // Unchanged
      { _key: '01', _type: 'header', label: 'Programação Semanal', value: '', email: '', _meta_json: '' },
      // Modified value
      { _key: '01-01', _type: 'slot', label: 'Coordenação', value: 'Bianca Moreira', email: '', _meta_json: '' },
      // Added
      { _key: '01-02', _type: 'slot', label: 'Relatoria', value: 'Caio Cavalcanti', email: '', _meta_json: '' },
    ];

    const diff = buildDiff(current, incoming);
    expect(diff.added).toBe(1);
    expect(diff.modified).toBe(1);
    expect(diff.deleted).toBe(0);
    expect(diff.unchanged).toBe(1);

    const modifiedEntry = diff.entries.find(e => e.key === '01-01');
    expect(modifiedEntry?.action).toBe('modify');
    expect(modifiedEntry?.currentValue).toBe('Alex Nogueira');
    expect(modifiedEntry?.incomingValue).toBe('Bianca Moreira');

    const addedEntry = diff.entries.find(e => e.key === '01-02');
    expect(addedEntry?.action).toBe('add');
    expect(addedEntry?.incomingLabel).toBe('Relatoria');
  });
});
