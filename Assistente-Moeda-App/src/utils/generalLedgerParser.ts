export interface GLEntry {
  transactionId: string;
  timestamp: string;
  debitAccount: string;
  creditAccount: string;
  amountInCents: number;
  description: string;
  reversalRefId?: string;
  isReversed?: boolean;
  reversedBy?: string;
}

export interface AccountAuditTrail {
  accountCode: string;
  currentBalanceCents: number;
  totalDebitsCents: number;
  totalCreditsCents: number;
  history: {
    transactionId: string;
    timestamp: string;
    type: 'debit' | 'credit';
    counterpart: string;
    amountInCents: number;
    description: string;
    reversalRefId?: string;
    isStorno: boolean;
  }[];
}

export interface GLParsingResult {
  success: boolean;
  entries: GLEntry[];
  accountTrails: Map<string, AccountAuditTrail>;
  totalDebitsCents: number;
  totalCreditsCents: number;
  isBalanced: boolean;
  errors: string[];
  reversalCount: number;
}

export function parseGeneralLedger(csvText: string): GLParsingResult {
  const errors: string[] = [];
  const entries: GLEntry[] = [];
  const accountTrails = new Map<string, AccountAuditTrail>();

  // Normalize line endings
  const lines = csvText
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  if (lines.length === 0) {
    return {
      success: false,
      entries: [],
      accountTrails,
      totalDebitsCents: 0,
      totalCreditsCents: 0,
      isBalanced: true,
      errors: ['Arquivo vazio'],
      reversalCount: 0,
    };
  }

  // Parse headers
  const headers = lines[0].split(',').map((h) => h.trim().toLowerCase());
  const txIdIdx = headers.indexOf('transaction_id');
  const tsIdx = headers.indexOf('timestamp');
  const debitAccIdx = headers.indexOf('debit_account');
  const creditAccIdx = headers.indexOf('credit_account');
  const amtIdx = headers.indexOf('amount_in_cents');
  const descIdx = headers.indexOf('description');
  const revIdx = headers.indexOf('reversal_ref_id');

  if (txIdIdx === -1 || debitAccIdx === -1 || creditAccIdx === -1 || amtIdx === -1) {
    return {
      success: false,
      entries: [],
      accountTrails,
      totalDebitsCents: 0,
      totalCreditsCents: 0,
      isBalanced: true,
      errors: ['Cabeçalhos obrigatórios ausentes. Esperado: transaction_id, debit_account, credit_account, amount_in_cents'],
      reversalCount: 0,
    };
  }

  // First pass: Read all records
  const entryMap = new Map<string, GLEntry>();

  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(',').map((c) => c.trim().replace(/^"|"$/g, ''));
    if (cols.length === 0 || (cols.length === 1 && cols[0] === '')) continue;

    const transactionId = cols[txIdIdx] || '';
    if (!transactionId) {
      errors.push(`Linha ${i + 1}: Ausência de transaction_id.`);
      continue;
    }

    const timestamp = tsIdx !== -1 ? cols[tsIdx] : new Date().toISOString();
    const debitAccount = cols[debitAccIdx] || '';
    const creditAccount = cols[creditAccIdx] || '';
    const amountInCents = parseInt(cols[amtIdx], 10) || 0;
    const description = descIdx !== -1 ? cols[descIdx] : '';
    const reversalRefId = revIdx !== -1 && cols[revIdx] ? cols[revIdx] : undefined;

    const entry: GLEntry = {
      transactionId,
      timestamp,
      debitAccount,
      creditAccount,
      amountInCents,
      description,
      reversalRefId,
    };

    entries.push(entry);
    entryMap.set(transactionId, entry);
  }

  // Second pass: Map reversals and stornos
  let reversalCount = 0;
  entries.forEach((entry) => {
    if (entry.reversalRefId) {
      const originalEntry = entryMap.get(entry.reversalRefId);
      if (originalEntry) {
        originalEntry.isReversed = true;
        originalEntry.reversedBy = entry.transactionId;
        reversalCount++;
      } else {
        errors.push(`Aviso: Reversão ref "${entry.reversalRefId}" não encontrada.`);
      }
    }
  });

  // Third pass: Reconstruct account audit trails
  let totalDebitsCents = 0;
  let totalCreditsCents = 0;

  function getOrCreateTrail(code: string): AccountAuditTrail {
    let trail = accountTrails.get(code);
    if (!trail) {
      trail = {
        accountCode: code,
        currentBalanceCents: 0,
        totalDebitsCents: 0,
        totalCreditsCents: 0,
        history: [],
      };
      accountTrails.set(code, trail);
    }
    return trail;
  }

  entries.forEach((entry) => {
    totalDebitsCents += entry.amountInCents;
    totalCreditsCents += entry.amountInCents;

    const debitTrail = getOrCreateTrail(entry.debitAccount);
    const creditTrail = getOrCreateTrail(entry.creditAccount);

    const isStorno = !!entry.reversalRefId;

    // Debit increases assets/expenses, decreases liabilities/equity/revenue
    // For raw ledger representation, we track: Net Balance = Debits - Credits
    debitTrail.totalDebitsCents += entry.amountInCents;
    debitTrail.currentBalanceCents += entry.amountInCents;
    debitTrail.history.push({
      transactionId: entry.transactionId,
      timestamp: entry.timestamp,
      type: 'debit',
      counterpart: entry.creditAccount,
      amountInCents: entry.amountInCents,
      description: entry.description,
      reversalRefId: entry.reversalRefId,
      isStorno,
    });

    creditTrail.totalCreditsCents += entry.amountInCents;
    creditTrail.currentBalanceCents -= entry.amountInCents;
    creditTrail.history.push({
      transactionId: entry.transactionId,
      timestamp: entry.timestamp,
      type: 'credit',
      counterpart: entry.debitAccount,
      amountInCents: entry.amountInCents,
      description: entry.description,
      reversalRefId: entry.reversalRefId,
      isStorno,
    });
  });

  // Sort history by timestamp
  accountTrails.forEach((trail) => {
    trail.history.sort((a, b) => a.timestamp.localeCompare(b.timestamp));
  });

  return {
    success: entries.length > 0,
    entries,
    accountTrails,
    totalDebitsCents,
    totalCreditsCents,
    isBalanced: totalDebitsCents === totalCreditsCents,
    errors,
    reversalCount,
  };
}
