'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import { TrendingUp } from 'lucide-react'

const links = [
  { href: '/', label: 'Dashboard' },
  { href: '/buys', label: 'Buys' },
  { href: '/entities', label: 'Entities' },
  { href: '/filings', label: 'Filings' },
  { href: '/subscriptions', label: 'Subscriptions' },
]

export function Nav() {
  const pathname = usePathname()

  return (
    <nav className="bg-gray-900 text-white border-b border-gray-700">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center h-16 gap-8">
          <Link href="/" className="flex items-center gap-2 font-bold text-lg shrink-0">
            <TrendingUp className="h-5 w-5 text-green-400" />
            <span>Trade Tracker</span>
          </Link>
          <div className="flex items-center gap-1">
            {links.map(({ href, label }) => {
              const isActive =
                href === '/' ? pathname === '/' : pathname.startsWith(href)
              return (
                <Link
                  key={href}
                  href={href}
                  className={cn(
                    'px-3 py-2 rounded-md text-sm font-medium transition-colors',
                    isActive
                      ? 'bg-gray-700 text-white'
                      : 'text-gray-300 hover:bg-gray-800 hover:text-white'
                  )}
                >
                  {label}
                </Link>
              )
            })}
          </div>
        </div>
      </div>
    </nav>
  )
}
