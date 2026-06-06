import { useState, useRef } from 'react';
import type { CoinTable } from '../types';
import type { ImportedTable } from '../utils/csvIO';
import { downloadCSV, exportTableToCSV, importTableFromCSV, readCSVFile } from '../utils/csvIO';

interface CSVManagerModalProps {
  table: CoinTable;
  onClose: () => void;
  onImportTable: (data: ImportedTable) => void;
}

type TabType = 'import' | 'export';

export function CSVManagerModal({
  table,
  onClose,
  onImportTable,
}: CSVManagerModalProps) {
  const [activeTab, setActiveTab] = useState<TabType>('import');
  const [copied, setCopied] = useState(false);
  const [pastedText, setPastedText] = useState('');
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Generate CSV text for export
  const csvText = exportTableToCSV(table);

  const handleCopy = async () => {
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(csvText);
      } else {
        // Fallback for older browsers or insecure contexts
        const textArea = document.createElement('textarea');
        textArea.value = csvText;
        textArea.style.position = 'fixed';
        textArea.style.opacity = '0';
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        document.execCommand('copy');
        document.body.removeChild(textArea);
      }
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy text: ', err);
    }
  };

  const handleProcessText = () => {
    if (!pastedText.trim()) {
      setStatusMessage({ type: 'error', text: 'Por favor, cole o conteúdo CSV para processar.' });
      return;
    }
    setStatusMessage(null);
    try {
      const parsed = importTableFromCSV(pastedText);
      onImportTable(parsed);
      setStatusMessage({
        type: 'success',
        text: `✅ Tabela "${parsed.name}" importada com sucesso!`,
      });
      setPastedText(''); // Clear on success
    } catch (err) {
      setStatusMessage({
        type: 'error',
        text: err instanceof Error ? err.message : 'Erro ao processar o texto CSV colado.',
      });
    }
  };

  const handleFileSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setStatusMessage(null);
    try {
      const parsed = await readCSVFile(file);
      onImportTable(parsed);
      setStatusMessage({
        type: 'success',
        text: `✅ Tabela "${parsed.name}" importada com sucesso como uma nova tabela com ${parsed.rows.length} registros.`,
      });
    } catch (err) {
      setStatusMessage({
        type: 'error',
        text: err instanceof Error ? err.message : 'Erro ao ler ou processar o arquivo CSV.',
      });
    } finally {
      // Clear input so the user can select the same file again
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="bg-[#1a1a2e] border border-purple-500/25 rounded-xl shadow-2xl w-full max-w-2xl p-6 space-y-5 max-h-[90vh] overflow-y-auto text-white">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-white/10 pb-3">
          <h2 className="text-sm font-bold text-purple-300 flex items-center gap-2">
            ⚙️ Gerenciar Dados (CSV/Texto)
          </h2>
          <button
            onClick={onClose}
            className="text-white/40 hover:text-white transition-colors text-xl font-bold leading-none p-1 cursor-pointer"
            aria-label="Fechar"
          >
            ×
          </button>
        </div>

        {/* Status Message Alert */}
        {statusMessage && (
          <div
            className={`p-3 rounded-lg text-xs border flex items-start gap-2 ${
              statusMessage.type === 'success'
                ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                : 'bg-red-500/10 text-red-400 border-red-500/30'
            }`}
          >
            <span className="text-base leading-none">
              {statusMessage.type === 'success' ? '✅' : '⚠️'}
            </span>
            <span className="flex-1">{statusMessage.text}</span>
            <button
              onClick={() => setStatusMessage(null)}
              className="text-white/20 hover:text-white/50 text-xs font-bold font-mono cursor-pointer"
            >
              ✕
            </button>
          </div>
        )}

        {/* Tabs */}
        <div className="flex gap-1 bg-white/5 rounded-xl p-1 border border-white/10">
          <button
            type="button"
            onClick={() => {
              setActiveTab('import');
              setStatusMessage(null);
            }}
            className={`flex-1 py-2 text-xs font-semibold rounded-lg transition-colors flex items-center justify-center gap-1.5 cursor-pointer ${
              activeTab === 'import'
                ? 'bg-purple-500/25 text-purple-300 shadow border border-purple-500/20'
                : 'text-white/40 hover:text-white hover:bg-white/5 border border-transparent'
            }`}
          >
            📥 Importar
          </button>
          <button
            type="button"
            onClick={() => {
              setActiveTab('export');
              setStatusMessage(null);
            }}
            className={`flex-1 py-2 text-xs font-semibold rounded-lg transition-colors flex items-center justify-center gap-1.5 cursor-pointer ${
              activeTab === 'export'
                ? 'bg-purple-500/25 text-purple-300 shadow border border-purple-500/20'
                : 'text-white/40 hover:text-white hover:bg-white/5 border border-transparent'
            }`}
          >
            📤 Exportar
          </button>
        </div>

        {/* Tab Content */}
        {activeTab === 'import' ? (
          /* IMPORT TAB */
          <div className="space-y-4">
            {/* Option 1: File Upload */}
            <div className="bg-gray-800/30 border border-white/5 rounded-xl p-4 space-y-3">
              <h3 className="text-[11px] font-bold text-white/50 uppercase tracking-wider">
                Opção A: Selecionar Arquivo .csv
              </h3>
              <p className="text-[11px] text-white/40 leading-relaxed">
                Selecione um arquivo de backup exportado pelo Assistente Moeda para importá-lo como uma nova tabela.
              </p>
              <div className="flex items-center gap-3">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv,text/csv"
                  className="hidden"
                  onChange={handleFileSelected}
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="px-3.5 py-2 text-xs font-semibold rounded-lg bg-purple-500/20 text-purple-300 border border-purple-500/30 hover:bg-purple-500/30 transition-colors flex items-center gap-1.5 cursor-pointer"
                >
                  📁 Escolher Arquivo CSV
                </button>
              </div>
            </div>

            {/* Option 2: Clipboard Paste */}
            <div className="bg-gray-800/30 border border-white/5 rounded-xl p-4 space-y-3">
              <h3 className="text-[11px] font-bold text-white/50 uppercase tracking-wider">
                Opção B: Colar Texto CSV do Clipboard
              </h3>
              <p className="text-[11px] text-white/40 leading-relaxed">
                Cole o conteúdo do backup copiado no campo abaixo para importá-lo como uma nova tabela no seu painel.
              </p>
              <textarea
                value={pastedText}
                onChange={(e) => setPastedText(e.target.value)}
                placeholder="Cole o CSV aqui (ex: contendo o cabeçalho '## COIN ASSISTANT BACKUP v2 ##' e os registros)..."
                className="w-full h-36 bg-[#0d1117] text-white font-mono text-[11px] rounded-lg p-3 outline-none focus:ring-1 focus:ring-purple-500 border border-white/10 resize-none placeholder:text-white/25"
              />
              <button
                type="button"
                onClick={handleProcessText}
                className="px-3.5 py-2 text-xs font-semibold rounded-lg bg-[#25D366]/20 text-[#25D366] border border-[#25D366]/30 hover:bg-[#25D366]/30 transition-colors flex items-center gap-1.5 cursor-pointer"
              >
                ⚙️ Processar Texto
              </button>
            </div>
          </div>
        ) : (
          /* EXPORT TAB */
          <div className="space-y-4">
            {/* Option 1: File Download */}
            <div className="bg-gray-800/30 border border-white/5 rounded-xl p-4 space-y-3">
              <h3 className="text-[11px] font-bold text-white/50 uppercase tracking-wider">
                Opção A: Baixar Arquivo .csv
              </h3>
              <p className="text-[11px] text-white/40 leading-relaxed">
                Baixe um arquivo físico contendo todo o backup de dados e metas desta tabela no seu dispositivo.
              </p>
              <button
                type="button"
                onClick={() => downloadCSV(table)}
                className="px-3.5 py-2 text-xs font-semibold rounded-lg bg-sky-500/20 text-sky-300 border border-sky-500/30 hover:bg-sky-500/30 transition-colors flex items-center gap-1.5 cursor-pointer"
              >
                📥 Baixar Arquivo .csv
              </button>
            </div>

            {/* Option 2: Text Box with Clipboard Copy */}
            <div className="bg-gray-800/30 border border-white/5 rounded-xl p-4 space-y-3">
              <div className="flex justify-between items-center">
                <h3 className="text-[11px] font-bold text-white/50 uppercase tracking-wider">
                  Opção B: Copiar Backup em Formato Texto
                </h3>
                <button
                  type="button"
                  onClick={handleCopy}
                  className={`px-3 py-1 text-[11px] font-bold rounded transition-colors flex items-center gap-1 cursor-pointer ${
                    copied
                      ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                      : 'bg-purple-500/20 text-purple-300 border border-purple-500/30 hover:bg-purple-500/30'
                  }`}
                >
                  {copied ? '✅ Copiado!' : '📋 Copiar Texto'}
                </button>
              </div>
              <p className="text-[11px] text-white/40 leading-relaxed">
                Veja o conteúdo CSV diretamente. Útil para copiar e enviar rapidamente pelo WhatsApp ou salvar em notas.
              </p>
              <textarea
                readOnly
                value={csvText}
                onClick={(e) => (e.target as HTMLTextAreaElement).select()}
                className="w-full h-36 bg-[#0d1117] text-white font-mono text-[11px] rounded-lg p-3 outline-none border border-white/10 resize-none cursor-text selection:bg-purple-500/35 selection:text-white"
              />
              <p className="text-[10px] text-white/30 italic">
                Dica: Para salvar manualmente, crie um arquivo .csv vazio, cole este texto e salve com codificação UTF-8.
              </p>
            </div>
          </div>
        )}

        {/* Footer actions */}
        <div className="flex justify-end pt-2 border-t border-white/5">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold rounded-lg bg-white/5 hover:bg-white/10 text-white/70 hover:text-white transition-colors cursor-pointer"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
}
