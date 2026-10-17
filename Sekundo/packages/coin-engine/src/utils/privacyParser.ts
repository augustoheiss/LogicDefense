export interface OffshoreAccount {
  idConta: string;
  nomeInstituicao: string;
  saldoCents: number;
  jurisdicaoPais: string;
  declaracaoFbar: boolean;
  declaracaoFatca: boolean;
  possuiCripto: boolean;
  possuiTrust: boolean;
}

export interface PrivacyParserResult {
  accounts: OffshoreAccount[];
  errors: string[];
}

export function parsePrivacyCSV(csvText: string): PrivacyParserResult {
  const errors: string[] = [];
  const accounts: OffshoreAccount[] = [];

  const lines = csvText
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  if (lines.length === 0) {
    return { accounts, errors: ['Arquivo vazio'] };
  }

  const headers = lines[0].split(',').map((h) => h.trim().toLowerCase());
  const idIdx = headers.indexOf('id_conta');
  const nameIdx = headers.indexOf('nome_instituicao');
  const balIdx = headers.indexOf('saldo_cents');
  const jurIdx = headers.indexOf('jurisdicao_pais');
  const fbarIdx = headers.indexOf('declaracao_fbar');
  const fatcaIdx = headers.indexOf('declaracao_fatca');
  const cryptoIdx = headers.indexOf('possui_cripto');
  const trustIdx = headers.indexOf('possui_trust');

  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(',').map((c) => c.trim().replace(/^"|"$/g, ''));
    if (cols.length === 0 || (cols.length === 1 && cols[0] === '')) continue;

    const idConta = idIdx !== -1 ? cols[idIdx] : '';
    const nomeInstituicao = nameIdx !== -1 ? cols[nameIdx] : '';
    const saldoCents = balIdx !== -1 ? parseInt(cols[balIdx], 10) || 0 : 0;
    const jurisdicaoPais = jurIdx !== -1 ? cols[jurIdx] : '';
    
    const fbarRaw = fbarIdx !== -1 ? cols[fbarIdx].toLowerCase() : 'false';
    const declaracaoFbar = fbarRaw === 'true' || fbarRaw === 'sim' || fbarRaw === '1';

    const fatcaRaw = fatcaIdx !== -1 ? cols[fatcaIdx].toLowerCase() : 'false';
    const declaracaoFatca = fatcaRaw === 'true' || fatcaRaw === 'sim' || fatcaRaw === '1';

    const cryptoRaw = cryptoIdx !== -1 ? cols[cryptoIdx].toLowerCase() : 'false';
    const possuiCripto = cryptoRaw === 'true' || cryptoRaw === 'sim' || cryptoRaw === '1';

    const trustRaw = trustIdx !== -1 ? cols[trustIdx].toLowerCase() : 'false';
    const possuiTrust = trustRaw === 'true' || trustRaw === 'sim' || trustRaw === '1';

    accounts.push({
      idConta,
      nomeInstituicao,
      saldoCents,
      jurisdicaoPais,
      declaracaoFbar,
      declaracaoFatca,
      possuiCripto,
      possuiTrust,
    });
  }

  return {
    accounts,
    errors,
  };
}
