declare function describe(name: string, fn: () => void): void;
declare function it(name: string, fn: () => void): void;
declare function expect(actual: any): {
  toBe(expected: any): void;
};

import { isSectorActive } from '../components/SectorGuard';

describe('Verificação de Visibilidade Estrita de Layouts', () => {
  it('Não deve renderizar widgets PFM na visão base da planilha sem ativação', () => {
    const activeSectors: string[] = [];

    // Verifica se os setores especializados estão inativos no modo clean slate
    expect(isSectorActive('personal_finance', activeSectors)).toBe(false);
    expect(isSectorActive('real_estate', activeSectors)).toBe(false);
    expect(isSectorActive('vehicles', activeSectors)).toBe(false);
  });

  it('Deve liberar colunas estendidas cumulativamente apenas ao marcar a checkbox', () => {
    let activeSectors = ['core_cashflow'];
    expect(isSectorActive('core_cashflow', activeSectors)).toBe(true);
    expect(isSectorActive('real_estate', activeSectors)).toBe(false);

    activeSectors.push('real_estate');
    expect(isSectorActive('real_estate', activeSectors)).toBe(true);
  });
});
