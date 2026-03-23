import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Help & Support',
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
