import type { Metadata } from 'next';
import './globals.css';
import { AuthProvider } from '@/contexts/auth-context';
import { Navbar } from '@/components/Navbar';

export const metadata: Metadata = {
  title: 'Verzel Fine Art Auctions — Casa de Leilões Online',
  description: 'Casa de Leilões em tempo real com auditoria criptográfica HMAC-SHA256',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="pt-BR" className="dark">
      <body className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 antialiased">
        <AuthProvider>
          <Navbar />
          <main className="max-w-7xl mx-auto px-4 py-8">{children}</main>
        </AuthProvider>
      </body>
    </html>
  );
}