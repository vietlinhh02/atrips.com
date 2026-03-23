'use client';

import Link from 'next/link';
import { GlobeHemisphereEast } from '@phosphor-icons/react';

const footerLinks = [
  {
    title: 'Explore',
    links: [
      { label: 'Blog', href: '/stories' },
      { label: 'Explore Destinations', href: '/explore' },
      { label: 'Community', href: '/community' },
    ],
  },
  {
    title: 'Support',
    links: [
      { label: 'Help Center', href: '/help' },
    ],
  },
  {
    title: 'Legal',
    links: [
      { label: 'Privacy Policy', href: '/privacy' },
      { label: 'Terms of Service', href: '/terms' },
    ],
  },
];

export default function Footer() {
  return (
    <footer className="relative z-10 bg-white dark:bg-[var(--neutral-10)] border-t border-[var(--neutral-30)] pt-16 pb-8">
      <div className="max-w-[1320px] mx-auto px-4 md:px-6">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-12 mb-12">
          {/* Brand Column */}
          <div className="md:col-span-4 flex flex-col gap-4">
            <Link href="/" className="flex items-center gap-2">
              <span className="font-logo text-[24px] text-[var(--neutral-100)]">atrips.me</span>
            </Link>
            <p className="text-[14px] text-[var(--neutral-60)] leading-relaxed max-w-xs">
              <span className="font-logo">Atrips</span> is your intelligent travel companion. We help you plan, book, and enjoy your trips
              with the power of AI and community.
            </p>
          </div>

          {/* Links Columns */}
          <div className="md:col-span-8 grid grid-cols-2 sm:grid-cols-3 gap-8">
            {footerLinks.map((column, idx) => (
              <div key={idx}>
                <h4 className="font-medium text-[var(--neutral-100)] mb-4">{column.title}</h4>
                <ul className="flex flex-col gap-2">
                  {column.links.map((link) => (
                    <li key={link.href}>
                      <Link
                        href={link.href}
                        className="text-[14px] text-[var(--neutral-60)] hover:text-[var(--primary-main)] transition-colors"
                      >
                        {link.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>

        <div className="border-t border-[var(--neutral-30)] pt-8 flex flex-col md:flex-row items-center justify-between gap-4">
          <p className="text-[14px] text-[var(--neutral-50)]">
            &copy; 2026 <span className="font-logo">Atrips.me</span>. All rights reserved.
          </p>
          <div className="flex items-center gap-6">
            <button className="text-[14px] text-[var(--neutral-50)] hover:text-[var(--neutral-80)] flex items-center gap-1">
              <GlobeHemisphereEast size={16} />
              English (US)
            </button>
          </div>
        </div>
      </div>
    </footer>
  );
}
