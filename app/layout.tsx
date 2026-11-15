import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'জমির হিসাব - মুসলিম আইনে হিস্যা ও নামজারি',
  description: 'খতিয়ান, ওয়ারিশ ও দলিল দেখে মুসলিম ফারায়েজ অনুযায়ী নির্ভুল হিস্যা (১০০০ ভাগে) ও নামজারির টেবিল',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="bn">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link href="https://fonts.googleapis.com/css2?family=Noto+Sans+Bengali:wght@400;500;600;700&display=swap" rel="stylesheet" />
      </head>
      <body className="min-h-screen antialiased">{children}</body>
    </html>
  )
}
