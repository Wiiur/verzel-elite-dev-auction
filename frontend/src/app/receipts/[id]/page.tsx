'use client';

import { useEffect, useState, use, Suspense } from 'react';
import { apiFetch, formatCurrency } from '@/services/api';
import { Award, Share2, Check } from 'lucide-react';

interface PublicReceipt {
  receiptId: string;
  lotId: string;
  lotTitle: string;
  winnerAlias: string;
  auctioneerAlias: string;
  finalAmount: number;
  verificationHash: string;
}

function PublicReceiptContent({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const [receipt, setReceipt] = useState<PublicReceipt | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    apiFetch<PublicReceipt>(`/audit/receipts/${id}`)
      .then(setReceipt)
      .catch(console.error);
  }, [id]);

  const copyLink = () => {
    navigator.clipboard.writeText(window.location.href);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  if (!receipt) return <div className="py-12 text-center">Carregando comprovante...</div>;

  return (
    <div className="max-w-lg mx-auto p-8 rounded-3xl border-2 border-amber-500/40 bg-white dark:bg-slate-900 shadow-xl space-y-6 text-center">
      <Award className="w-14 h-14 text-amber-400 mx-auto" />
      <div>
        <span className="text-xs uppercase tracking-widest text-amber-500 font-bold">
          Comprovante Oficial de Arremate
        </span>
        <h1 className="text-2xl font-extrabold mt-1">{receipt.lotTitle}</h1>
      </div>

      <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-left space-y-2 text-xs">
        <div className="flex justify-between">
          <span className="text-slate-400">Vencedor (Protegido):</span>
          <span className="font-bold">{receipt.winnerAlias}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-slate-400">Leiloeiro:</span>
          <span className="font-bold">{receipt.auctioneerAlias}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-slate-400">Valor Liquidado:</span>
          <span className="text-base font-extrabold text-emerald-500">
            {formatCurrency(receipt.finalAmount)}
          </span>
        </div>
        <div className="pt-2 border-t border-slate-200 dark:border-slate-800">
          <span className="text-[10px] text-slate-400 block">Assinatura SHA-256:</span>
          <span className="font-mono text-[10px] break-all text-amber-500">
            {receipt.verificationHash}
          </span>
        </div>
      </div>

      <button
        onClick={copyLink}
        className="w-full py-3 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-xs flex items-center justify-center gap-2"
      >
        {copied ? <Check className="w-4 h-4" /> : <Share2 className="w-4 h-4" />}
        {copied ? 'Link Copiado para a Área de Transferência!' : 'Compartilhar Link do Comprovante'}
      </button>
    </div>
  );
}

export default function PublicReceiptPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  return (
    <Suspense fallback={<div className="py-12 text-center">Carregando comprovante...</div>}>
      <PublicReceiptContent params={params} />
    </Suspense>
  );
}