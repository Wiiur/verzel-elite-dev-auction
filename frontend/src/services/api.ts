const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';

export function formatCurrency(cents: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format((cents || 0) / 100);
}

export function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  return 'Ocorreu um erro inesperado.';
}

export async function apiFetch<T = unknown>(
  endpoint: string,
  options: RequestInit = {},
): Promise<T> {
  const token =
    typeof window !== 'undefined' ? localStorage.getItem('verzel_token') : null;

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(`${API_URL}${endpoint}`, {
    ...options,
    headers,
    cache: 'no-store',
  });

  const data = (await response.json().catch(() => null)) as {
    message?: string | string[];
  } | null;

  if (!response.ok) {
    const errorMessage = Array.isArray(data?.message)
      ? data.message[0]
      : data?.message || 'Erro ao processar requisição.';
    throw new Error(errorMessage);
  }

  return data as T;
}