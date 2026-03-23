# atrip.me — Frontend

Next.js client for the atrip.me platform. Lives in `/frontend` as a subdirectory of the main repo.

## Stack

[Next.js 16](https://nextjs.org/) · [React 19](https://react.dev/) · [TypeScript](https://www.typescriptlang.org/) · [Tailwind CSS 4](https://tailwindcss.com/) · [HeroUI](https://www.heroui.com/) · [Radix UI](https://www.radix-ui.com/) · [Zustand](https://zustand.docs.pmnd.rs/) · [Mapbox GL](https://www.mapbox.com/) · [Framer Motion](https://motion.dev/) · [Novu](https://novu.co/)

## Setup

```bash
pnpm install
cp .env.example .env.local   # configure your vars
pnpm dev                     # http://localhost:3000
```

## Scripts

```bash
pnpm dev          # dev server
pnpm build        # production build
pnpm start        # serve production build
pnpm lint         # eslint
pnpm tsc --noEmit # type check
```

## Structure

```
src/
├── app/            # App Router pages
├── components/
│   ├── ui/         # Base primitives (shadcn/ui pattern)
│   ├── common/     # Shared components
│   ├── features/   # Feature-specific (auth, chat, trip, ...)
│   ├── layout/     # Page shells
│   └── providers/  # Context providers
├── hooks/          # Custom hooks
├── stores/         # Zustand state
├── services/       # API client (Axios)
└── types/          # TypeScript definitions
```
