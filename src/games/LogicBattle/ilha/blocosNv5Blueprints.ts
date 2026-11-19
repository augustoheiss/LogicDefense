import { dentroVoxelLocal, indiceVoxelLocal, VOXEL_NV5 } from './biomaRecursos'
import type { PecaId } from './partidaPolicies'

export function meiaLarguraNv5(): number {
  return (VOXEL_NV5.nx * VOXEL_NV5.passo) / 2
}

export function criarBlocosObraNv5(tipo: PecaId): Uint8Array {
  const { nx, ny, nz } = VOXEL_NV5
  const cells = new Uint8Array(nx * ny * nz)
  const set = (bx: number, by: number, bz: number, val: number) => {
    if (dentroVoxelLocal(bx, by, bz)) cells[indiceVoxelLocal(bx, by, bz)] = val
  }

  if (tipo === 'nucleo') {
    for (let by = 0; by < ny; by += 1) {
      for (let bz = 0; bz < nz; bz += 1) {
        for (let bx = 0; bx < nx; bx += 1) {
          const borda = bx === 0 || bx === nx - 1 || bz === 0 || bz === nz - 1
          if (by <= 2 && borda) {
            const portaSul = bz === nz - 1 && bx >= 2 && bx <= 4 && by <= 1
            const portaNorte = bz === 0 && bx === 3 && by <= 1
            const janela = by === 1 && bz === 3 && (bx === 0 || bx === nx - 1)
            if (!portaSul && !portaNorte && !janela) set(bx, by, bz, 1)
          }
          if (by === 3) {
            const vaoEscada = bx >= 1 && bx <= 2 && bz >= 1 && bz <= 3
            if (!vaoEscada) set(bx, by, bz, 2)
          }
          if (by === 4 && borda && (bx + bz) % 2 === 0) {
            set(bx, by, bz, 1)
          }
        }
      }
    }
    set(1, 0, 4, 2)
    set(2, 0, 4, 2)
    set(1, 1, 3, 2)
    set(2, 1, 3, 2)
    set(1, 2, 2, 2)
    set(2, 2, 2, 2)
    return cells
  }

  if (tipo === 'torre') {
    // Torre de Vigia Nv5 entrável e escalável: corpo 5x5 central com frestas de tiro e coroa larga 7x7 no topo (by=4)
    for (let by = 0; by < ny; by += 1) {
      for (let bz = 0; bz < nz; bz += 1) {
        for (let bx = 0; bx < nx; bx += 1) {
          const bordaTorre =
            bx >= 1 && bx <= 5 && bz >= 1 && bz <= 5 && (bx === 1 || bx === 5 || bz === 1 || bz === 5)
          if (by <= 2 && bordaTorre) {
            const portaSul = bz === 5 && bx === 3 && by <= 1
            const fresta =
              by === 1 &&
              ((bz === 1 && bx === 3) || ((bx === 1 || bx === 5) && bz === 3))
            if (!portaSul && !fresta) set(bx, by, bz, 1)
          }
          // Plataforma superior de observação (by=3) com vão de escada em (2,3,2..3)
          if (by === 3 && bx >= 1 && bx <= 5 && bz >= 1 && bz <= 5) {
            const vao = bx === 2 && (bz === 2 || bz === 3)
            if (!vao) set(bx, by, bz, 2)
          }
          // Coroa alargada de ameias de vigia no topo (by=4)
          const bordaCoroa = bx === 0 || bx === nx - 1 || bz === 0 || bz === nz - 1
          if (by === 4 && bordaCoroa && (bx + bz) % 2 === 0) {
            set(bx, by, bz, 1)
          }
          if (by === 3 && bordaCoroa && (bx === 0 || bx === nx - 1) && (bz === 0 || bz === nz - 1)) {
            set(bx, by, bz, 1)
          }
        }
      }
    }
    // Escada interna subindo até o mirante superior
    set(2, 0, 4, 2)
    set(2, 1, 3, 2)
    set(2, 2, 2, 2)
    return cells
  }

  if (tipo === 'portao') {
    // Portão Triunfal Nv5: corredor central (bx=2..4, bz=0..6, by=0..2) 100% ABERTO para tropas, herói e +10!
    for (let by = 0; by < ny; by += 1) {
      for (let bz = 0; bz < nz; bz += 1) {
        for (let bx = 0; bx < nx; bx += 1) {
          const bastiaoOeste = bx <= 1 && bz >= 1 && bz <= 5
          const bastiaoLeste = bx >= 5 && bz >= 1 && bz <= 5
          if (by <= 2 && (bastiaoOeste || bastiaoLeste)) {
            const paredeExterna = bx === 0 || bx === 6 || bz === 1 || bz === 5
            const portaGuarda = by <= 1 && bz === 3 && (bx === 1 || bx === 5)
            const corredorInterno = by <= 1 && (bx === 1 || bx === 5) && bz >= 2 && bz <= 4
            if ((paredeExterna || !corredorInterno) && !portaGuarda) {
              set(bx, by, bz, 1)
            }
          }
          // Ponte aérea sobre o arco (by=3, bz=2..4) com acesso lateral
          if (by === 3 && bz >= 2 && bz <= 4) {
            const vaoEscada = bx === 1 && bz === 2
            if (!vaoEscada) set(bx, by, bz, 2)
          }
          // Ameias da ponte do portão (by=4)
          if (by === 4 && (bz === 2 || bz === 4) && bx % 2 === 0) {
            set(bx, by, bz, 1)
          }
        }
      }
    }
    // Escada no bastião oeste para subir à ponte do portão
    set(1, 0, 4, 2)
    set(1, 1, 3, 2)
    set(1, 2, 2, 2)
    return cells
  }

  if (tipo === 'quartel') {
    // Quartel-Fortaleza Nv5: pátio militar com entradas largas Leste/Oeste e galeria superior
    for (let by = 0; by < ny; by += 1) {
      for (let bz = 0; bz < nz; bz += 1) {
        for (let bx = 0; bx < nx; bx += 1) {
          const borda = bx === 0 || bx === nx - 1 || bz === 0 || bz === nz - 1
          if (by <= 2 && borda) {
            const portaLesteOeste = (bx === 0 || bx === nx - 1) && bz >= 2 && bz <= 4 && by <= 1
            const portaSul = bz === nz - 1 && bx === 3 && by <= 1
            if (!portaLesteOeste && !portaSul) set(bx, by, bz, bx === 0 || bx === nx - 1 ? 1 : 2)
          }
          // Passarela perimetral no 2º piso (pátio central aberto para luz)
          const anelSuperior = bx <= 1 || bx >= nx - 2 || bz <= 1 || bz >= nz - 2
          if (by === 3 && anelSuperior) {
            const vao = bx === 1 && bz >= 2 && bz <= 4
            if (!vao) set(bx, by, bz, 2)
          }
          // 4 torres de estandarte nos cantos
          if (by === 4 && (bx === 0 || bx === nx - 1) && (bz === 0 || bz === nz - 1)) {
            set(bx, by, bz, 1)
          }
        }
      }
    }
    set(1, 0, 4, 2)
    set(1, 1, 3, 2)
    set(1, 2, 2, 2)
    return cells
  }

  if (tipo === 'britador') {
    // Fundição / Britador Nv5: galpão de pedra com pórtico de carga, bigorna central e chaminé NE
    for (let by = 0; by < ny; by += 1) {
      for (let bz = 0; bz < nz; bz += 1) {
        for (let bx = 0; bx < nx; bx += 1) {
          const borda = bx === 0 || bx === nx - 1 || bz === 0 || bz === nz - 1
          if (by <= 2 && borda) {
            const baiaSul = bz === nz - 1 && bx >= 2 && bx <= 4 && by <= 1
            const arcoLateral = by <= 1 && bz === 3 && (bx === 0 || bx === nx - 1)
            if (!baiaSul && !arcoLateral) set(bx, by, bz, 1)
          }
          if (by === 3) {
            const claraboia = bx >= 2 && bx <= 4 && bz >= 2 && bz <= 4
            const vao = bx === 1 && bz >= 1 && bz <= 3
            if (!claraboia && !vao) set(bx, by, bz, 1)
          }
          // Chaminé industrial no canto nordeste
          if (by === 4 && bx >= 5 && bz <= 1) {
            set(bx, by, bz, 1)
          }
        }
      }
    }
    // Bigorna/plinto central (contornável pelo herói)
    set(3, 0, 3, 1)
    set(1, 0, 4, 2)
    set(1, 1, 3, 2)
    set(1, 2, 2, 2)
    return cells
  }

  if (tipo === 'serraria') {
    // Serraria-Pavilhão Nv5: galpão de madeira aberto Norte-Sul com telhado de cumeeira e mezanino
    for (let by = 0; by < ny; by += 1) {
      for (let bz = 0; bz < nz; bz += 1) {
        for (let bx = 0; bx < nx; bx += 1) {
          const paredeLat = bx === 0 || bx === nx - 1
          const pilarFrenteFundo = (bz === 0 || bz === nz - 1) && (bx === 0 || bx === 1 || bx === 5 || bx === 6)
          if (by <= 2 && (paredeLat || pilarFrenteFundo)) {
            const janelaLat = by === 1 && (bz === 2 || bz === 4) && paredeLat
            if (!janelaLat) set(bx, by, bz, 2)
          }
          // Telhado escalonado de madeira
          if (by === 3 && bx >= 1 && bx <= 5) {
            const vao = bx === 1 && bz >= 1 && bz <= 3
            if (!vao) set(bx, by, bz, 2)
          }
          if (by === 4 && bx === 3) {
            set(bx, by, bz, 2)
          }
        }
      }
    }
    set(1, 0, 4, 2)
    set(1, 1, 3, 2)
    set(1, 2, 2, 2)
    return cells
  }

  // tipo === 'mina': Pavilhão de Mineração Nv5 com 4 pórticos abertos e torre de guincho dourada no topo
  for (let by = 0; by < ny; by += 1) {
    for (let bz = 0; bz < nz; bz += 1) {
      for (let bx = 0; bx < nx; bx += 1) {
        const borda = bx === 0 || bx === nx - 1 || bz === 0 || bz === nz - 1
        if (by <= 2 && borda) {
          const portico =
            by <= 1 &&
            (((bz === 0 || bz === nz - 1) && bx >= 2 && bx <= 4) ||
              ((bx === 0 || bx === nx - 1) && bz >= 2 && bz <= 4))
          if (!portico) set(bx, by, bz, 1)
        }
        if (by === 3 && (borda || bx === 3 || bz === 3)) {
          const vao = bx === 1 && bz >= 1 && bz <= 3
          if (!vao) set(bx, by, bz, bx === 3 || bz === 3 ? 2 : 1)
        }
        // Castelo de guincho no centro e cantos no by=4
        if (
          by === 4 &&
          ((bx >= 2 && bx <= 4 && bz >= 2 && bz <= 4 && (bx === 3 || bz === 3)) ||
            ((bx === 0 || bx === nx - 1) && (bz === 0 || bz === nz - 1)))
        ) {
          set(bx, by, bz, 1)
        }
      }
    }
  }
  set(1, 0, 4, 2)
  set(1, 1, 3, 2)
  set(1, 2, 2, 2)
  return cells
}
