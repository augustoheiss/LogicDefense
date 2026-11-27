import {
  alturaEm,
  inclinacaoEm,
  LADO_RELEVO,
  MEIA_RELEVO,
  RELEVO_REGRAS,
  type CampoRelevo,
} from './campoRelevo'
import { suave } from './ruidoRelevo'

/**
 * Plataformas planas para obras no relevo (F3b / D16, 27/11/2026).
 * Tudo é puro e imutável: `aplicarPlataforma` retorna um novo `CampoRelevo` com `versao + 1`.
 */

export function podeAplainarObra(
  campo: CampoRelevo | undefined,
  x: number,
  z: number,
  raio = 4.2,
  declMax: number = RELEVO_REGRAS.declMaxObra,
): { readonly ok: boolean; readonly decliveMedio: number } {
  if (!campo) return { ok: true, decliveMedio: 0 }
  if (!Number.isFinite(x) || !Number.isFinite(z)) return { ok: false, decliveMedio: Number.POSITIVE_INFINITY }

  let soma = inclinacaoEm(campo, x, z)
  let cont = 1
  if (soma > RELEVO_REGRAS.declMaxAndar) return { ok: false, decliveMedio: soma }

  for (const r of [raio * 0.5, raio]) {
    for (let k = 0; k < 8; k += 1) {
      const ang = (k / 8) * Math.PI * 2
      const d = inclinacaoEm(campo, x + Math.cos(ang) * r, z + Math.sin(ang) * r)
      if (d > RELEVO_REGRAS.declMaxAndar) return { ok: false, decliveMedio: d }
      soma += d
      cont += 1
    }
  }

  const decliveMedio = soma / cont
  return { ok: decliveMedio <= declMax, decliveMedio }
}

export function aplicarPlataforma(
  campo: CampoRelevo,
  x: number,
  z: number,
  raioPlano = 4.2,
  raioRampa = 2.0,
): CampoRelevo {
  const cota = alturaEm(campo, x, z)
  const novas = new Float32Array(campo.alturas)
  const raioTotal = raioPlano + Math.max(0.1, raioRampa)
  const minGx = Math.max(-MEIA_RELEVO, Math.floor(x - raioTotal))
  const maxGx = Math.min(MEIA_RELEVO, Math.ceil(x + raioTotal))
  const minGz = Math.max(-MEIA_RELEVO, Math.floor(z - raioTotal))
  const maxGz = Math.min(MEIA_RELEVO, Math.ceil(z + raioTotal))

  for (let gz = minGz; gz <= maxGz; gz += 1) {
    const row = (gz + MEIA_RELEVO) * LADO_RELEVO
    for (let gx = minGx; gx <= maxGx; gx += 1) {
      const dist = Math.hypot(gx - x, gz - z)
      if (dist >= raioTotal) continue
      const peso = dist <= raioPlano ? 1 : 1 - suave((dist - raioPlano) / (raioTotal - raioPlano))
      const idx = row + (gx + MEIA_RELEVO)
      novas[idx] = novas[idx] * (1 - peso) + cota * peso
    }
  }

  return {
    ...campo,
    alturas: novas,
    versao: campo.versao + 1,
  }
}
