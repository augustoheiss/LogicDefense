import React, { useState, useEffect } from 'react';

interface LicenseKeyModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const LICENSE_STORAGE_KEY = 'coin_license_key';

export function LicenseKeyModal({ isOpen, onClose }: LicenseKeyModalProps) {
  const [licenseKey, setLicenseKey] = useState<string>('');
  const [statusMsg, setStatusMsg] = useState<{ text: string; isError: boolean } | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [tokenInfo, setTokenInfo] = useState<{ balance: number; cap: number; expiresAt: string | null } | null>(null);
  
  // Recovery form state
  const [recoveryEmail, setRecoveryEmail] = useState<string>('');
  const [recoveryMsg, setRecoveryMsg] = useState<string | null>(null);
  const [isRecovering, setIsRecovering] = useState<boolean>(false);

  useEffect(() => {
    if (isOpen) {
      const savedKey = localStorage.getItem(LICENSE_STORAGE_KEY) || '';
      setLicenseKey(savedKey);
      if (savedKey) {
        validateKey(savedKey);
      }
    }
  }, [isOpen]);

  const validateKey = async (keyToTest: string) => {
    setIsLoading(true);
    setStatusMsg(null);
    try {
      const API_BASE = import.meta.env.VITE_API_URL || '';
      const res = await fetch(`${API_BASE}/api/license/validate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ license_key: keyToTest.trim() }),
      });
      const data = await res.json();
      if (data.valid) {
        localStorage.setItem(LICENSE_STORAGE_KEY, keyToTest.trim());
        setTokenInfo({
          balance: data.token_balance,
          cap: data.token_cap,
          expiresAt: data.expires_at,
        });
        setStatusMsg({ text: `✓ Chave Ativa (${data.tier.toUpperCase()}) — ${data.token_balance.toLocaleString()} tokens restantes`, isError: false });
      } else {
        setStatusMsg({ text: data.message || 'Chave de Licença inválida.', isError: true });
        setTokenInfo(null);
      }
    } catch {
      setStatusMsg({ text: 'Erro ao conectar ao servidor de validação.', isError: true });
    } finally {
      setIsLoading(false);
    }
  };

  const handleSaveKey = (e: React.FormEvent) => {
    e.preventDefault();
    if (licenseKey.trim()) {
      validateKey(licenseKey.trim());
    }
  };

  const handleRecover = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!recoveryEmail || !recoveryEmail.includes('@')) return;

    setIsRecovering(true);
    setRecoveryMsg(null);
    try {
      const API_BASE = import.meta.env.VITE_API_URL || '';
      const res = await fetch(`${API_BASE}/api/license/recover`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: recoveryEmail.trim() }),
      });
      const data = await res.json();
      setRecoveryMsg(data.message || 'Solicitação enviada. Verifique seu e-mail.');
    } catch {
      setRecoveryMsg('Erro ao solicitar recuperação de chave.');
    } finally {
      setIsRecovering(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-4 backdrop-blur-sm">
      <div className="w-full max-w-lg rounded-2xl border border-indigo-500/20 bg-slate-900 p-6 shadow-2xl space-y-6 text-white">
        <div className="flex items-center justify-between border-b border-white/10 pb-4">
          <h3 className="text-lg font-bold flex items-center gap-2">
            <span>🔑</span> Chave de Licença PRO & IA
          </h3>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white transition-colors"
          >
            ✕
          </button>
        </div>

        {/* Form Validation */}
        <form onSubmit={handleSaveKey} className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-300">
              Sua Chave de Licença PRO
            </label>
            <input
              type="text"
              value={licenseKey}
              onChange={(e) => setLicenseKey(e.target.value)}
              placeholder="Cole sua chave (ex: am_pro_...)"
              className="w-full rounded-xl border border-white/10 bg-slate-950 px-4 py-2.5 text-sm text-emerald-400 font-mono focus:border-indigo-500 focus:outline-none"
            />
          </div>

          {statusMsg && (
            <div className={`p-3 rounded-lg text-xs font-medium ${statusMsg.isError ? 'bg-red-500/10 text-red-400 border border-red-500/20' : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'}`}>
              {statusMsg.text}
            </div>
          )}

          {tokenInfo && (
            <div className="p-3.5 rounded-xl bg-slate-950/60 border border-white/5 space-y-2">
              <div className="flex justify-between text-xs">
                <span className="text-slate-400">Saldo de Tokens:</span>
                <span className="font-bold font-mono text-emerald-400">
                  {tokenInfo.balance.toLocaleString()} / {tokenInfo.cap.toLocaleString()}
                </span>
              </div>
              <div className="w-full bg-slate-800 rounded-full h-2 overflow-hidden">
                <div
                  className="bg-emerald-500 h-full rounded-full transition-all"
                  style={{ width: `${Math.min(100, Math.max(0, (tokenInfo.balance / (tokenInfo.cap || 1)) * 100))}%` }}
                />
              </div>
            </div>
          )}

          <button
            type="submit"
            disabled={isLoading}
            className="w-full py-3 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-sm rounded-xl transition-all disabled:opacity-50"
          >
            {isLoading ? 'Validando...' : 'Salvar & Validar Chave'}
          </button>
        </form>

        {/* Portal de Recuperação */}
        <div className="pt-4 border-t border-white/10 space-y-3">
          <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider">
            📬 Portal de Recuperação de Chave
          </h4>
          <p className="text-xs text-slate-400">
            Perdeu ou esqueceu sua chave? Digite o e-mail cadastrado na compra pelo Stripe para reenviá-la.
          </p>

          <form onSubmit={handleRecover} className="space-y-3">
            <div className="flex gap-2">
              <input
                type="email"
                value={recoveryEmail}
                onChange={(e) => setRecoveryEmail(e.target.value)}
                placeholder="seu.email@exemplo.com"
                className="flex-1 rounded-xl border border-white/10 bg-slate-950 px-3.5 py-2 text-xs text-white focus:border-indigo-500 focus:outline-none"
              />
              <button
                type="submit"
                disabled={isRecovering}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs rounded-xl transition-all disabled:opacity-50"
              >
                {isRecovering ? 'Enviando...' : 'Recuperar'}
              </button>
            </div>
            {recoveryMsg && (
              <p className="text-xs text-indigo-300 bg-indigo-500/10 p-2.5 rounded-lg border border-indigo-500/20">
                {recoveryMsg}
              </p>
            )}
          </form>
        </div>
      </div>
    </div>
  );
}
