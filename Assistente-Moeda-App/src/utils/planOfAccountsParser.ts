export interface AccountNode {
  id: string;
  parent_id: string;
  level: number;
  type: string;
  nature: 'D' | 'C';
  code: string;
  name: string;
  balance: number; // raw in CSV, consolidated after tree traversal
  originalBalance: number; // store CSV value
  children: AccountNode[];
}

export interface ParsingAnomaly {
  accountId: string;
  accountName: string;
  code: string;
  type: 'negative_balance' | 'orphan' | 'nature_mismatch' | 'invalid_data';
  description: string;
}

export interface PlanOfAccountsResult {
  rootNodes: AccountNode[];
  allNodes: Map<string, AccountNode>;
  anomalies: ParsingAnomaly[];
}

export function parsePlanOfAccounts(csvText: string): PlanOfAccountsResult {
  const anomalies: ParsingAnomaly[] = [];
  const allNodes = new Map<string, AccountNode>();

  // Normalize line endings
  const lines = csvText
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  if (lines.length === 0) {
    return { rootNodes: [], allNodes, anomalies };
  }

  // Parse header
  const headers = lines[0].split(',').map((h) => h.trim().toLowerCase());
  const idIdx = headers.indexOf('id');
  const parentIdIdx = headers.indexOf('parent_id');
  const levelIdx = headers.indexOf('level');
  const typeIdx = headers.indexOf('type');
  const natureIdx = headers.indexOf('nature');
  const codeIdx = headers.indexOf('code');
  const nameIdx = headers.indexOf('name');
  const balanceIdx = headers.indexOf('balance');

  if (idIdx === -1 || codeIdx === -1 || nameIdx === -1) {
    anomalies.push({
      accountId: 'HEADER',
      accountName: 'Cabeçalho CSV',
      code: '0',
      type: 'invalid_data',
      description: 'Cabeçalhos do CSV contábil inválidos. Esperado ao menos: id, code, name',
    });
    return { rootNodes: [], allNodes, anomalies };
  }

  // Read lines into node structs
  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(',').map((c) => c.trim().replace(/^"|"$/g, ''));
    if (cols.length === 0 || (cols.length === 1 && cols[0] === '')) continue;

    const id = cols[idIdx] || '';
    if (!id) {
      anomalies.push({
        accountId: `LINE_${i + 1}`,
        accountName: 'Linha sem ID',
        code: '',
        type: 'invalid_data',
        description: `Linha ${i + 1} não possui ID identificador.`,
      });
      continue;
    }

    const parent_id = parentIdIdx !== -1 ? cols[parentIdIdx] : '';
    const level = levelIdx !== -1 ? parseInt(cols[levelIdx], 10) || 1 : 1;
    const type = typeIdx !== -1 ? cols[typeIdx] : '';
    const natureRaw = natureIdx !== -1 ? cols[natureIdx].toUpperCase() : 'D';
    const nature: 'D' | 'C' = natureRaw === 'C' ? 'C' : 'D';
    const code = cols[codeIdx] || '';
    const name = cols[nameIdx] || '';
    const rawBalance = balanceIdx !== -1 ? parseFloat(cols[balanceIdx]) : 0;
    const balance = isNaN(rawBalance) ? 0 : rawBalance;

    const node: AccountNode = {
      id,
      parent_id,
      level,
      type,
      nature,
      code,
      name,
      balance,
      originalBalance: balance,
      children: [],
    };

    allNodes.set(id, node);
  }

  // Build parent-child relationships
  const rootNodes: AccountNode[] = [];

  allNodes.forEach((node) => {
    if (!node.parent_id) {
      rootNodes.push(node);
    } else {
      const parentNode = allNodes.get(node.parent_id);
      if (parentNode) {
        parentNode.children.push(node);
      } else {
        // Orphan node
        anomalies.push({
          accountId: node.id,
          accountName: node.name,
          code: node.code,
          type: 'orphan',
          description: `Conta órfã: pai ID "${node.parent_id}" não localizado no arquivo.`,
        });
        rootNodes.push(node); // treat as root
      }
    }
  });

  // Post-order rollup recursive helper
  function rollupNode(node: AccountNode): number {
    if (node.children.length === 0) {
      // Leaf account nature validations
      if (node.originalBalance < 0) {
        anomalies.push({
          accountId: node.id,
          accountName: node.name,
          code: node.code,
          type: 'negative_balance',
          description: `Saldo negativo na folha analítica: ${node.originalBalance}. Natureza: ${node.nature}`,
        });
      }
      return node.balance;
    }

    let childrenSum = 0;
    for (const child of node.children) {
      const childVal = rollupNode(child);
      // Accounting nature rollup rule:
      // If child nature matches parent nature, it increases balance.
      // If child nature is opposite, it decreases balance.
      if (child.nature === node.nature) {
        childrenSum += childVal;
      } else {
        childrenSum -= childVal;
      }
    }

    node.balance = childrenSum;

    // Check if consolidated balance is negative (nature inversion)
    if (node.balance < 0) {
      anomalies.push({
        accountId: node.id,
        accountName: node.name,
        code: node.code,
        type: 'nature_mismatch',
        description: `Saldo consolidado invertido (negativo): ${node.balance}. Natureza: ${node.nature}`,
      });
    }

    return node.balance;
  }

  // Run recursive rollup from root nodes
  rootNodes.forEach((root) => {
    rollupNode(root);
  });

  // Sort root nodes and children by code alphabetically
  function sortNodes(node: AccountNode) {
    node.children.sort((a, b) => a.code.localeCompare(b.code));
    node.children.forEach(sortNodes);
  }
  rootNodes.sort((a, b) => a.code.localeCompare(b.code));
  rootNodes.forEach(sortNodes);

  return {
    rootNodes,
    allNodes,
    anomalies,
  };
}
