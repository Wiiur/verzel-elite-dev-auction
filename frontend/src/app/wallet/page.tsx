'use client';

import { useState } from 'react';
import { apiFetch, formatCurrency, getErrorMessage } from '@/services/api';
import { useAuth } from '@/contexts/auth-context';
import { Wallet, Lock, CheckCircle, Plus } from 'lucide-react';

export default function WalletPage() {
  const { user, refreshProfile } = useAuth();
  const [amountReais, setAmountReais] = useState('1000');
  const [loading, setLoading] = useState(false);
  const [feedback, setFeedback] = useState('');

  const handleDeposit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setFeedback('');
    try {
      const cents = Math.round(Number(amountReais) * 100);
      await apiFetch('/wallet/deposit', {
        method: 'POST',
        body: JSON.stringify({ amountInCents: cents }),
      });
      await refreshProfile();
      setFeedback('Depósito simulado creditado instantaneamente!');
    } catch (err: unknown) {
      setFeedback(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  if (!user) return <div className="py-12 text-center">Faça login para acessar sua carteira.</div>;

  return (
    <div className="max-w-3xl mx-auto space-y-8">
      <h1 className="text-2xl font-extrabold">Minha Carteira Digital</h1>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="p-5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
          <span className="text-xs text-slate-400 flex items-center gap-1.5">
            <Wallet className="w-4 h-4 text-sky-400" /> Saldo Total
          </span>
          <p className="text-2xl font-extrabold mt-2">{formatCurrency(user.totalBalance)}</p>
        </div>

        <div className="p-5 rounded-2xl border border-amber-500/30 bg-amber-500/5">
          <span className="text-xs text-amber-400 flex items-center gap-1.5">
            <Lock className="w-4 h-4" /> Saldo Comprometido (Líder)
          </span>
          <p className="text-2xl font-extrabold text-amber-400 mt-2">
            {formatCurrency(user.committedBalance)}
          </p>
        </div>

        <div className="p-5 rounded-2xl border border-emerald-500/30 bg-emerald-500/10">
          <span className="text-xs text-emerald-400 flex items-center gap-1.5">
            <CheckCircle className="w-4 h-4" /> Saldo Disponível para Lances
          </span>
          <p className="text-2xl font-extrabold text-emerald-400 mt-2">
            {formatCurrency(user.availableBalance)}
          </p>
        </div>
      </div>

      <form
        onSubmit={handleDeposit}
        className="p-6 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 space-y-4"
      >
        <h2 className="font-bold text-base">Adicionar Saldo Simulado</h2>
        {feedback && <p className="text-xs font-bold text-emerald-400">{feedback}</p>}
        <div className="flex gap-3">
          <input
            type="number"
            min="10"
            value={amountReais}
            onChange={(e) => setAmountReais(e.target.value)}
            className="flex-1 px-4 py-2.5 rounded-xl border border-slate-700 bg-transparent font-bold"
          />
          <button
            type="submit"
            disabled={loading}
            className="px-6 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-bold text-sm flex items-center gap-1.5"
          >
            <Plus className="w-4 h-4" /> Depositar R$
          </button>
        </div>
      </form>
    </div>
  );
}