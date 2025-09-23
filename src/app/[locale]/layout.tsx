// src/app/[locale]/layout.tsx
import { NextIntlClientProvider } from 'next-intl';
import { notFound } from 'next/navigation';
import React from 'react';

export async function generateStaticParams() {
  return [{ locale: 'en' }, { locale: 'vi' }];
}

type Props = {
  children: React.ReactNode;
  params: { locale: string };
};

export default async function LocaleLayout({ children, params: { locale } }: Props) {
  let messages;
  try {
    messages = (await import(`../../../messages/${locale}.json`)).default;
  } catch (err) {
    notFound();
  }

  return (
    <html lang={locale}>
      <body>
        <NextIntlClientProvider locale={locale} messages={messages}>
          {children}
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
