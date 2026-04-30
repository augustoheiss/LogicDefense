// ============================================================
// Logic Friction — Tower Manager
// Sprint 5: Maps constructionSites (with type) and towers
// (with type + level) to their respective 3D components.
// ============================================================
import { useGameStore } from '../state/useGameStore'
import { ConstructionSite } from './ConstructionSite'
import { Tower } from './Tower'

export function TowerManager() {
  const constructionSites = useGameStore(s => s.constructionSites)
  const towers = useGameStore(s => s.towers)

  return (
    <>
      {constructionSites.map(site => (
        <ConstructionSite
          key={site.id}
          id={site.id}
          position={[site.x, 0, site.z]}
          type={site.type}
        />
      ))}
      {towers.map(tower => (
        <Tower
          key={tower.id}
          id={tower.id}
          position={[tower.x, 0, tower.z]}
          type={tower.type}
          level={tower.level}
        />
      ))}
    </>
  )
}
