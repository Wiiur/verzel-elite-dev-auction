'use client';

import Link from 'next/link';
import { useAuth } from '@/contexts/auth-context';
import { formatCurrency } from '@/services/api';
import { Gavel, Wallet, ShieldCheck, Sun, Moon, LogOut, User, Trophy } from 'lucide-react';

export function Navbar() {
  const { user, darkMode, toggleDarkMode, logout } = useAuth();

  return (
    <header className="sticky top-0 z-50 border-b border-slate-200 dark:border-slate-800 bg-white/90 dark:bg-slate-950/90 backdrop-blur">
      <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between gap-4">
        <div className="flex items-center gap-6">
          <Link href="/" className="flex items-center gap-2 font-bold text-lg text-amber-600 dark:text-amber-400">
            <Gavel className="w-6 h-6" />
            <span>Verzel Fine Art Auctions</span>
          </Link>

          <nav className="hidden md:flex items-center gap-5 text-sm font-medium text-slate-600 dark:text-slate-300">
            <Link href="/" className="hover:text-amber-500 transition-colors">
              Vitrine de Lotes
            </Link>

            {user?.role === 'AUCTIONEER' && (
              <Link href="/auctioneer" className="hover:text-amber-500 transition-colors font-semibold text-amber-600 dark:text-amber-400">
                Painel do Leiloeiro
              </Link>
            )}

            {user?.role === 'BIDDER' && (
              <>
                <Link href="/wallet" className="hover:text-amber-500 transition-colors flex items-center gap-1">
                  <Wallet className="w-4 h-4" /> Carteira & Depósito
                </Link>
                <Link href="/my-auctions" className="hover:text-amber-500 transition-colors flex items-center gap-1">
                  <Trophy className="w-4 h-4" /> Meus Arremates
                </Link>
              </>
            )}
          </nav>
        </div>

        <div className="flex items-center gap-3">
          {user?.role === 'BIDDER' && (
            <Link
              href="/wallet"
              className="hidden sm:flex flex-col items-end px-3 py-1 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-xs"
            >
              <span className="text-slate-500 dark:text-slate-400">Saldo Disponível</span>
              <span className="font-bold text-emerald-600 dark:text-emerald-400">
                {formatCurrency(user.availableBalance)}
              </span>
            </Link>
          )}

          <button
            onClick={toggleDarkMode}
            className="p-2 rounded-lg border border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-900 text-slate-700 dark:text-slate-300"
            title="Alternar tema Claro/Escuro"
          >
            {darkMode ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4" />}
          </button>

          {user ? (
            <div className="flex items-center gap-3">
              <div className="text-right hidden sm:block">
                <p className="text-xs font-semibold text-slate-800 dark:text-slate-200">{user.name}</p>
                <p className="text-[11px] text-amber-600 dark:text-amber-400 font-mono">
                  {user.publicAlias} ({user.role === 'AUCTIONEER' ? 'Leiloeiro' : 'Licitante'})
                </p>
              </div>
              <button
                onClick={logout}
                className="p-2 rounded-lg bg-rose-500/10 text-rose-500 hover:bg-rose-500/20 transition"
                title="Sair"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <Link
              href="/login"
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-amber-500 hover:bg-amber-600 text-slate-950 font-semibold text-sm transition"
            >
              <User className="w-4 h-4" /> Entrar / Contas de Teste
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}