import React from 'react';
import { useSectorRegistry } from '../hooks/useSectorRegistry';

interface SectorGuardProps {
  sector: string;
  fallback?: React.ReactNode;
  children: React.ReactNode;
}

export function isSectorActive(sectorId: string, activeSectors: string[]): boolean {
  if (!activeSectors || activeSectors.length === 0) return false;
  return activeSectors.includes(sectorId);
}

export function SectorGuard({
  sector,
  fallback = null,
  children,
}: SectorGuardProps) {
  const { isSectorActive: checkActive } = useSectorRegistry();

  if (checkActive(sector)) {
    return <>{children}</>;
  }

  return <>{fallback}</>;
}
