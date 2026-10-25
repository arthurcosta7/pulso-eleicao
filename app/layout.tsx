import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Pulso | Apuração e previsão eleitoral',
  description:
    'Dados reais do TSE, situação atual e previsão no mesmo gráfico. Segundo turno presidencial de 2026.',
  icons: {
    icon: '/favicon.svg',
    shortcut: '/favicon.svg',
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
