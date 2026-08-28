import { CVMakerApp } from '../tools/cv-maker'

/**
 * Legacy page wrapper mounted at /laboratorio/cv-maker.
 * Delegates 100% of logic and rendering to the modular CVMakerApp tool.
 */
export function CVMaker() {
  return <CVMakerApp />
}

export default CVMaker
