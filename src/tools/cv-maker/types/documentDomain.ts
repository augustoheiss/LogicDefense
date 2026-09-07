/**
 * documentDomain.ts
 *
 * Contratos e tipagens para a expansão do CV-Maker em PDF-Maker Geral.
 * Suporta múltiplos domínios documentais (currículos, propostas, contratos, faturas, relatórios)
 * com esquemas de seções semânticas e metadados específicos de cada caso de uso.
 */

export type DocumentDomain = 'resume' | 'proposal' | 'contract' | 'invoice' | 'report'

export interface DomainSectionSchema {
  id: string
  label: string
  icon: string
  description: string
  required?: boolean
  defaultZone?: 'left' | 'right' | 'full'
}

export interface DocumentDomainConfig {
  id: DocumentDomain
  name: string
  label: string
  icon: string
  description: string
  defaultFormat: string
  recommendedThemes: string[]
  supportedSections: DomainSectionSchema[]
}

export interface ProposalMetadata {
  clientName: string
  clientCompany?: string
  projectTitle: string
  proposalDate: string
  validUntil: string
  investmentTotal?: string
  currency?: string
}

export interface ContractMetadata {
  contractTitle: string
  contractNumber?: string
  partyA: { name: string; document: string; role: string }
  partyB: { name: string; document: string; role: string }
  jurisdictionCity: string
  signingDate: string
}

export interface InvoiceMetadata {
  invoiceNumber: string
  issueDate: string
  dueDate: string
  emitterInfo: { name: string; taxId: string; address: string }
  clientInfo: { name: string; taxId: string; address: string }
  totalAmount: number
  currency: string
  paymentTerms?: string
  pixKey?: string
}

export interface ReportMetadata {
  reportTitle: string
  reportSubtitle?: string
  author: string
  department?: string
  date: string
  status: 'draft' | 'confidential' | 'final' | 'approved'
  version: string
}
