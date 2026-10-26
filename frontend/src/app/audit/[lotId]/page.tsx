'use client';

import { useEffect, useState, use, Suspense } from 'react';
import { apiFetch, formatCurrency } from '@/services/api';
import { ShieldCheck, ShieldAlert, Link2 } from 'lucide-react';

interface AuditTrailItem {
  sequenceNumber: number;
  bidderAlias: string;
  amount: number;
  previousHash: string;
  storedHash: string;
  recalculatedHash: string;
  isValid: boolean;
}

interface AuditResponse {
  lot: {
    id: string;
    title: string;
  };
  verification: {
    isIntact: boolean;
    totalBids: number;
    issues: string[];
    auditTrail: AuditTrailItem[];
  };
}

function PublicAuditContent({
  params,
}: {
  params: Promise<{ lotId: string }>;
}) {
  const { lotId } = use(params);
  const [data, setData] = useState<AuditResponse | null>(null);

  useEffect(() => {
    apiFetch<AuditResponse>(`/audit/lots/${lotId}`)
      .then(setData)
      .catch(console.error);
  }, [lotId]);

  if (!data) return <div className="py-12 text-center">Executando verificação criptográfica...</div>;

  const { lot, verification } = data;

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div
        className={`p-6 rounded-2xl border flex items-center gap-4 ${
          verification.isIntact
            ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-500'
            : 'border-rose-500/50 bg-rose-500/15 text-rose-500'
        }`}
      >
        {verification.isIntact ? (
          <ShieldCheck className="w-12 h-12 shrink-0" />
        ) : (
          <ShieldAlert className="w-12 h-12 shrink-0" />
        )}
        <div>
          <h1 className="text-xl font-extrabold">
            {verification.isIntact
              ? 'Histórico 100% Íntegro (Verificado via HMAC-SHA256 Hash Chain)'
              : 'ALERTA CRÍTICO: Adulteração Detectada no Banco de Dados!'}
          </h1>
          <p className="text-xs opacity-90 mt-1">
            Lote auditado: <strong>{lot.title}</strong> ({verification.totalBids} lances verificados)
          </p>
        </div>
      </div>

      {verification.issues.length > 0 && (
        <div className="p-4 rounded-xl bg-rose-950 border border-rose-500 text-rose-200 text-xs space-y-1">
          <p className="font-bold">Inconsistências matemáticas encontradas:</p>
          {verification.issues.map((issue, i) => (
            <p key={i}>• {issue}</p>
          ))}
        </div>
      )}

      <div className="space-y-3">
        {verification.auditTrail.map((item) => (
          <div
            key={item.sequenceNumber}
            className={`p-4 rounded-xl border font-mono text-xs space-y-2 ${
              item.isValid
                ? 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900'
                : 'border-rose-500 bg-rose-950/40'
            }`}
          >
            <div className="flex justify-between font-sans">
              <span className="font-bold text-amber-500">
                Bloco #{item.sequenceNumber} — {item.bidderAlias}
              </span>
              <span className="font-extrabold text-emerald-500">
                {formatCurrency(item.amount)}
              </span>
            </div>
            <div className="text-[11px] text-slate-400 break-all">
              <p className="flex items-center gap-1">
                <Link2 className="w-3 h-3" /> Elo Anterior (previousHash): {item.previousHash}
              </p>
              <p className="text-emerald-500">Hash Armazenado : {item.storedHash}</p>
              <p className={item.isValid ? 'text-slate-400' : 'text-rose-500 font-bold'}>
                Hash Recalculado: {item.recalculatedHash}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function PublicAuditPage({
  params,
}: {
  params: Promise<{ lotId: string }>;
}) {
  return (
    <Suspense fallback={<div className="py-12 text-center">Carregando auditoria...</div>}>
      <PublicAuditContent params={params} />
    </Suspense>
  );
}