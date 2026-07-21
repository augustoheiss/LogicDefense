import React from 'react';
import { useSectorRegistry } from '../hooks/useSectorRegistry';

interface SectorGuardProps {
  sector: string;
  fallback?: React.ReactNode;
  children: React.ReactNode;
}

export function SectorGuard({
  sector,
  fallback = null,
  children,
}: SectorGuardProps) {
  const { isSectorActive } = useSectorRegistry();

  if (isSectorActive(sector)) {
    return <>{children}</>;
  }

  return <>{fallback}</>;
}
