# CI/CD Design: Vercel + GitHub Actions

## Overview

CI/CD pipeline for the atrips.com Next.js 16 frontend. Vercel handles deployments (preview + production). GitHub Actions runs quality checks (lint, typecheck) as a merge gate.

## Architecture

```
PR opened/updated → GitHub Actions (lint + typecheck) → Vercel Preview Deploy
PR merged to main → GitHub Actions (lint + typecheck) → Vercel Production Deploy
```

## Vercel Configuration

- **Framework**: Next.js (auto-detected)
- **Build command**: `pnpm build`
- **Install command**: `pnpm install`
- **Node.js version**: 22
- **Production branch**: `main`
- **Preview deployments**: enabled for all PRs
- **Environment variables**: `NEXT_PUBLIC_API_BASE_URL` set via Vercel dashboard. All other `NEXT_PUBLIC_*` vars use defaults from code.

## GitHub Actions CI Workflow

Single workflow file: `.github/workflows/ci.yml`

**Triggers**: PR to `main`, push to `main`

**Steps**:
1. Checkout code
2. Setup Node 22 + pnpm with dependency cache
3. `pnpm install --frozen-lockfile`
4. `pnpm lint`
5. `pnpm tsc --noEmit`

**Failure at any step blocks merge.**

## Branch Protection Rules

Configure on GitHub for `main`:
- Require pull request before merging
- Require CI status checks to pass
- No direct pushes to `main`

## Developer Flow

1. Create feature branch, push, open PR
2. GitHub Actions runs lint + typecheck
3. Vercel auto-deploys preview (URL on PR)
4. CI passes + code review approved → merge
5. Vercel auto-deploys to production

## Environment Variables

| Variable | Where to set | Notes |
|----------|-------------|-------|
| `NEXT_PUBLIC_API_BASE_URL` | Vercel dashboard | Production API URL |
| `NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME` | Code default | Override on Vercel if needed |
| `NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET` | Code default | Override on Vercel if needed |
| `NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN` | Vercel dashboard | Sensitive, do not commit |
| `NEXT_PUBLIC_NOVU_APP_ID` | Vercel dashboard | Sensitive, do not commit |

## Out of Scope

- Testing (no test framework installed yet)
- Docker/containerization
- Multiple staging environments
- Custom domain configuration (done via Vercel dashboard)
