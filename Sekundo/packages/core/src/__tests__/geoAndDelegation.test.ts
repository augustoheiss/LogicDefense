import { describe, it, expect } from 'vitest';
import {
  geoJsonToSkeletonNodes,
  skeletonNodesToGeoJson,
  calculatePolygonCentroid,
  type GeoJSONFeatureCollection,
} from '../geo/geoJsonAdapter';
import {
  isPathInScope,
  canAttenuateScope,
  encodeToken,
  decodeAndVerifyToken,
  type SSDTokenPayload,
} from '../delegation/tokenManager';

describe('Spatial & Delegation Capabilities Suite', () => {
  describe('GeoJSON Adapter', () => {
    it('should calculate polygon centroid correctly', () => {
      const ring: [number, number][] = [
        [-46.63, -23.55],
        [-46.61, -23.55],
        [-46.61, -23.53],
        [-46.63, -23.53],
      ];
      const [lat, lng] = calculatePolygonCentroid(ring);
      expect(lat).toBeCloseTo(-23.54);
      expect(lng).toBeCloseTo(-46.62);
    });

    it('should convert GeoJSON to skeleton nodes and back', () => {
      const featureCol: GeoJSONFeatureCollection = {
        type: 'FeatureCollection',
        features: [
          {
            type: 'Feature',
            geometry: {
              type: 'Point',
              coordinates: [-46.6333, -23.5505],
            },
            properties: {
              name: 'Ponto Central',
              notes: 'Local de Saída',
            },
          },
        ],
      };

      const nodes = geoJsonToSkeletonNodes(featureCol, '01');
      expect(nodes).toHaveLength(1);
      expect(nodes[0].key).toBe('01-01');
      expect(nodes[0].label).toBe('Ponto Central');

      const exported = skeletonNodesToGeoJson(nodes);
      expect(exported.features).toHaveLength(1);
      expect(exported.features[0].geometry.type).toBe('Point');
      expect(exported.features[0].geometry.coordinates).toEqual([-46.6333, -23.5505]);
    });
  });

  describe('Subtree Delegation Tokens (SSDT)', () => {
    it('should accurately verify path prefix scope', () => {
      // Scope covers exact and descendants
      expect(isPathInScope('01-03', '01-03')).toBe(true);
      expect(isPathInScope('01-03-01', '01-03')).toBe(true);
      expect(isPathInScope('01.03.02.05', '01-03')).toBe(true);

      // Outside scope
      expect(isPathInScope('01-02-01', '01-03')).toBe(false);
      expect(isPathInScope('01', '01-03')).toBe(false);
    });

    it('should enforce monotonic capability attenuation', () => {
      // Child scope can only be narrower or equal
      expect(canAttenuateScope('01-03', '01-03-01')).toBe(true);
      expect(canAttenuateScope('01', '01-03')).toBe(true);
      // Cannot grant outside parent scope!
      expect(canAttenuateScope('01-03', '01-02')).toBe(false);
    });

    it('should encode and decode token payload via Base64URL', () => {
      const payload: SSDTokenPayload = {
        issuerId: 'host_pk_123',
        subjectId: 'vol_pedro',
        scopePrefix: '01-03',
        permissions: {
          canMarkWork: true,
          canEditNotes: true,
          canAddNodes: false,
          canDeleteNodes: false,
        },
        issuedAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + 86400000).toISOString(), // +24h
        nonce: 'nonce_987',
      };

      const encoded = encodeToken(payload);
      expect(typeof encoded).toBe('string');
      expect(encoded.length).toBeGreaterThan(20);

      const verified = decodeAndVerifyToken(encoded);
      expect(verified.valid).toBe(true);
      expect(verified.payload?.subjectId).toBe('vol_pedro');
      expect(verified.payload?.scopePrefix).toBe('01-03');
    });

    it('should reject expired tokens', () => {
      const expiredPayload: SSDTokenPayload = {
        issuerId: 'host_pk_123',
        subjectId: 'vol_pedro',
        scopePrefix: '01-03',
        permissions: {
          canMarkWork: true,
          canEditNotes: false,
          canAddNodes: false,
          canDeleteNodes: false,
        },
        issuedAt: '2020-01-01T00:00:00Z',
        expiresAt: '2020-01-02T00:00:00Z', // In the past!
        nonce: 'nonce_expired',
      };

      const encoded = encodeToken(expiredPayload);
      const verified = decodeAndVerifyToken(encoded);
      expect(verified.valid).toBe(false);
      expect(verified.error).toContain('Token expired');
    });
  });
});
