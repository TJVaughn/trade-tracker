import type { Metadata } from 'next'
import './globals.css'
import { Nav } from '@/components/nav'

export const metadata: Metadata = {
  title: 'Trade Tracker',
  description: 'SEC insider trade monitoring',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" className="dark">
      <body className="bg-background text-foreground min-h-screen">
        <Nav />
        <main>{children}</main>
      </body>
    </html>
  )
}
