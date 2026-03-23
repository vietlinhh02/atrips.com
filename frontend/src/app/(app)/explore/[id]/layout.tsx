import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Destination Details | ATrips',
  description:
    'Explore destination details, weather, and budget information',
};

export default function DestinationDetailLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
