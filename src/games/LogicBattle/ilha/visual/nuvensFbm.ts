import type { BiomaId } from '../biomaRecursos'

/**
 * Nuvens FBM procedurais por bioma (F4, 27/11/2026). Lógica e GLSL puros, sem importar `three`.
 */

export interface PerfilNuvensBioma {
  readonly corNuvem: string
  readonly corBordaSol: string
  readonly cobertura: number
  readonly opacidade: number
  readonly velocidade: number
}

const PERFIS_NUVENS: Readonly<Record<BiomaId, PerfilNuvensBioma>> = {
  clareira: {
    corNuvem: '#f8fafc',
    corBordaSol: '#fef3c7',
    cobertura: 0.48,
    opacidade: 0.42,
    velocidade: 0.018,
  },
  bosque: {
    corNuvem: '#e2f1ec',
    corBordaSol: '#d9f99d',
    cobertura: 0.54,
    opacidade: 0.44,
    velocidade: 0.014,
  },
  serra_ouro: {
    corNuvem: '#ffedd5',
    corBordaSol: '#fde68a',
    cobertura: 0.42,
    opacidade: 0.36,
    velocidade: 0.02,
  },
  ribeira: {
    corNuvem: '#f0f9ff',
    corBordaSol: '#ffffff',
    cobertura: 0.5,
    opacidade: 0.4,
    velocidade: 0.022,
  },
  tundra_cristal: {
    corNuvem: '#e0f2fe',
    corBordaSol: '#bae6fd',
    cobertura: 0.56,
    opacidade: 0.46,
    velocidade: 0.016,
  },
  basalto_brasa: {
    corNuvem: '#44403c',
    corBordaSol: '#fb923c',
    cobertura: 0.62,
    opacidade: 0.52,
    velocidade: 0.024,
  },
}

export function perfilNuvensBioma(bioma: BiomaId): PerfilNuvensBioma {
  return PERFIS_NUVENS[bioma]
}

export const GLSL_NUVENS_FBM = {
  vertice: /* glsl */ `
    varying vec2 vMundoXZ;
    varying float vDistCentro;
    void main() {
      vec4 wp = modelMatrix * vec4(position, 1.0);
      vMundoXZ = wp.xz;
      vDistCentro = length(uv - 0.5) * 2.0;
      gl_Position = projectionMatrix * viewMatrix * wp;
    }
  `,
  fragmento: /* glsl */ `
    uniform float uTempo;
    uniform vec3 uSolDir;
    uniform vec3 uCorNuvem;
    uniform vec3 uCorBordaSol;
    uniform float uCobertura;
    uniform float uOpacidade;
    uniform float uVelocidade;
    varying vec2 vMundoXZ;
    varying float vDistCentro;

    float hash(vec2 p) {
      return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
    }

    float ruido(vec2 p) {
      vec2 i = floor(p);
      vec2 f = fract(p);
      f = f * f * (3.0 - 2.0 * f);
      return mix(
        mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x),
        mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x),
        f.y
      );
    }

    float fbm(vec2 p) {
      float valor = 0.0;
      float amp = 0.5;
      for (int k = 0; k < 4; k++) {
        valor += amp * ruido(p);
        p = p * 2.03 + vec2(11.3, 7.1);
        amp *= 0.5;
      }
      return valor;
    }

    void main() {
      float fadeBorda = smoothstep(0.95, 0.35, vDistCentro);
      if (fadeBorda <= 0.001) discard;

      vec2 coord = vMundoXZ * 0.022 + vec2(uTempo * uVelocidade, uTempo * uVelocidade * 0.45);
      float n = fbm(coord);
      float deslocSol = fbm(coord + normalize(uSolDir.xz + vec2(0.0001)) * 0.14);
      float densidade = smoothstep(1.0 - uCobertura - 0.12, 1.0 - uCobertura + 0.24, n);
      float bordaIluminada = clamp((n - deslocSol) * 3.2 + 0.45, 0.0, 1.0);
      vec3 cor = mix(uCorNuvem, uCorBordaSol, bordaIluminada * 0.65);
      float alpha = densidade * uOpacidade * fadeBorda;
      if (alpha <= 0.004) discard;
      gl_FragColor = vec4(cor, alpha);
    }
  `,
}
