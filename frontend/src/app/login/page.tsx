'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { apiFetch, getErrorMessage } from '@/services/api';
import { useAuth } from '@/contexts/auth-context';
import { Sparkles } from 'lucide-react';

export default function LoginPage() {
  const router = useRouter();
  const { loginWithToken } = useAuth();
  const [mode, setMode] = useState<'LOGIN' | 'REGISTER'>('LOGIN');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<'BIDDER' | 'AUCTIONEER'>('BIDDER');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const endpoint = mode === 'LOGIN' ? '/auth/login' : '/auth/register';
      const body =
        mode === 'LOGIN' ? { email, password } : { name, email, password, role };
      const res = await apiFetch<{ accessToken: string }>(endpoint, {
        method: 'POST',
        body: JSON.stringify(body),
      });
      await loginWithToken(res.accessToken);
      router.push('/');
    } catch (err: unknown) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  const quickLogin = async (presetEmail: string) => {
    setError('');
    setLoading(true);
    try {
      const res = await apiFetch<{ accessToken: string }>('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email: presetEmail, password: '123456' }),
      });
      await loginWithToken(res.accessToken);
      router.push('/');
    } catch (err: unknown) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-md mx-auto mt-6 space-y-6">
      <div className="p-5 rounded-2xl border border-amber-500/40 bg-amber-500/10 space-y-3">
        <div className="flex items-center gap-2 text-amber-500 font-bold text-sm">
          <Sparkles className="w-4 h-4" />
          <span>Acesso Rápido para Avaliação (Seed Users)</span>
        </div>
        <p className="text-xs text-slate-600 dark:text-slate-300">
          Clique abaixo para entrar instantaneamente com os usuários semeados no banco:
        </p>
        <div className="grid grid-cols-1 gap-2 pt-1">
          <button
            onClick={() => quickLogin('leiloeiro@verzel.com.br')}
            className="w-full py-2 px-3 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-xs flex items-center justify-between transition"
          >
            <span>🔨 Entrar como Leiloeiro Oficial</span>
            <span className="font-mono opacity-80">leiloeiro@verzel.com.br</span>
          </button>
          <button
            onClick={() => quickLogin('cliente1@verzel.com.br')}
            className="w-full py-2 px-3 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-bold text-xs flex items-center justify-between transition"
          >
            <span>🙋‍♀️ Cliente 1 (Ana — Saldo R$ 5.000)</span>
            <span className="font-mono opacity-80">cliente1@verzel.com.br</span>
          </button>
          <button
            onClick={() => quickLogin('cliente2@verzel.com.br')}
            className="w-full py-2 px-3 rounded-xl bg-sky-500 hover:bg-sky-600 text-slate-950 font-bold text-xs flex items-center justify-between transition"
          >
            <span>🙋‍♂️ Cliente 2 (Bruno — Líder do Lote)</span>
            <span className="font-mono opacity-80">cliente2@verzel.com.br</span>
          </button>
        </div>
      </div>

      <div className="p-6 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm space-y-5">
        <div className="flex gap-2 p-1 rounded-xl bg-slate-100 dark:bg-slate-950">
          <button
            type="button"
            onClick={() => setMode('LOGIN')}
            className={`flex-1 py-2 rounded-lg text-xs font-bold transition ${
              mode === 'LOGIN' ? 'bg-amber-500 text-slate-950' : 'text-slate-500'
            }`}
          >
            Fazer Login
          </button>
          <button
            type="button"
            onClick={() => setMode('REGISTER')}
            className={`flex-1 py-2 rounded-lg text-xs font-bold transition ${
              mode === 'REGISTER' ? 'bg-amber-500 text-slate-950' : 'text-slate-500'
            }`}
          >
            Criar Nova Conta
          </button>
        </div>

        {error && (
          <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-500 text-xs font-semibold">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {mode === 'REGISTER' && (
            <>
              <div>
                <label className="block text-xs font-semibold mb-1">Nome Completo</label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-300 dark:border-slate-800 bg-transparent text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold mb-1">Papel na Plataforma</label>
                <select
                  value={role}
                  onChange={(e) => setRole(e.target.value as 'BIDDER' | 'AUCTIONEER')}
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-300 dark:border-slate-800 bg-white dark:bg-slate-900 text-sm"
                >
                  <option value="BIDDER">Licitante (Cliente — Dá lances e compra)</option>
                  <option value="AUCTIONEER">Leiloeiro (Vendedor — Cria e gerencia lotes)</option>
                </select>
              </div>
            </>
          )}

          <div>
            <label className="block text-xs font-semibold mb-1">E-mail</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-3.5 py-2 rounded-xl border border-slate-300 dark:border-slate-800 bg-transparent text-sm"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold mb-1">Senha</label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-3.5 py-2 rounded-xl border border-slate-300 dark:border-slate-800 bg-transparent text-sm"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-sm transition"
          >
            {loading ? 'Processando...' : mode === 'LOGIN' ? 'Entrar' : 'Cadastrar Conta'}
          </button>
        </form>
      </div>
    </div>
  );
}