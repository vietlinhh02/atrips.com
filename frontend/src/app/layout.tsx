import type { Metadata, Viewport } from "next";
import { Inter_Tight, Luxurious_Script } from "next/font/google";
import localFont from "next/font/local";
import "./globals.css";
import 'mapbox-gl/dist/mapbox-gl.css';
import Providers from "@/src/components/providers/Providers";
import OnboardingCheck from "@/src/components/features/auth/OnboardingCheck";

const interTight = Inter_Tight({
  subsets: ["latin"],
  variable: "--font-sans",
});

const luxuriousScript = Luxurious_Script({
  subsets: ["latin"],
  weight: "400",
  variable: "--font-script",
});

const logoFont = localFont({
  src: [
    {
      path: "../../public/font/logo-font.ttf",
      weight: "400",
      style: "normal",
    },
  ],
  variable: "--font-logo",
});

export const metadata: Metadata = {
  title: {
    default: 'Atrips - AI-Powered Trip Planning',
    template: '%s | Atrips',
  },
  description:
    'Plan your perfect trip with AI. Get personalized itineraries, ' +
    'real-time recommendations, and smart budget planning for ' +
    'destinations worldwide.',
  keywords: [
    'trip planner',
    'AI travel',
    'itinerary',
    'travel planning',
    'budget travel',
    'Vietnam travel',
  ],
  authors: [{ name: 'Atrips Team' }],
  creator: 'Atrips',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'Atrips',
  },
  openGraph: {
    type: 'website',
    locale: 'en_US',
    siteName: 'Atrips',
    title: 'Atrips - AI-Powered Trip Planning',
    description:
      'Plan your perfect trip with AI. Personalized itineraries, ' +
      'real-time recommendations, and smart budget planning.',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Atrips - AI-Powered Trip Planning',
    description: 'Plan your perfect trip with AI.',
  },
  robots: {
    index: true,
    follow: true,
  },
};

export const viewport: Viewport = {
  themeColor: '#073E71',
  viewportFit: 'cover',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://api.mapbox.com" />
        <link rel="dns-prefetch" href="https://api.mapbox.com" />
        <link rel="preconnect" href="https://events.mapbox.com" />
        <link rel="dns-prefetch" href="https://events.mapbox.com" />
        <link
          rel="preconnect"
          href="https://images.unsplash.com"
          crossOrigin="anonymous"
        />
        <link rel="dns-prefetch" href="https://images.unsplash.com" />
      </head>
      <body className={`${interTight.variable} ${luxuriousScript.variable} ${logoFont.variable} font-sans antialiased transition-colors duration-200`}>
        <Providers>
          <OnboardingCheck>
            {children}
          </OnboardingCheck>
        </Providers>
      </body>
    </html>
  );
}
