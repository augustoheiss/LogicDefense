import React from 'react';
import { useSectorRegistry } from '../hooks/useSectorRegistry';

interface SectorGuardProps {
  sector: string;
  fallback?: React.ReactNode;
  children: React.ReactNode;
}

export { isSectorActive } from '../core/sectorUtils';

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
