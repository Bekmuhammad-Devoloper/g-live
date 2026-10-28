# Germaniya Live

Learning-center management platform: CRM, LMS, payments, attendance, telephony and a student mobile app in a single Next.js codebase.

## Stack

- Next.js 15 (App Router, Server Actions), React 19, TypeScript
- Prisma with SQLite
- Tailwind CSS
- Asterisk + JsSIP for the browser softphone
- Capacitor for the Android app

## Modules

| Area | Path |
| --- | --- |
| Leads, sales funnel, application forms | `src/app/(app)/crm`, `src/app/apply` |
| Students, groups, schedule, attendance | `src/app/(app)/students`, `src/app/(app)/groups`, `src/app/(app)/schedule` |
| Finance: payments, debts, expenses, payroll | `src/app/(app)/finance`, `src/lib/debt.ts`, `src/lib/salaryCalc.ts` |
| Courses and lesson content | `src/app/(app)/courses`, `src/lib/levelLessons.ts` |
| Reports and control | `src/app/(app)/reports`, `src/app/(app)/control` |
| Student portal | `src/app/student` |
| Telephony | `src/app/api/telephony`, `scripts/ami-worker.mjs`, `deploy/asterisk` |
| Multi-center runtime and dev panel | `src/lib/instance.ts`, `src/app/dev`, `deploy/centers` |
| AI assistant | `src/lib/ai`, `src/app/(app)/ai` |

## Layout

```
src/
  app/          routes (App Router)
    (app)/      staff workspace
    student/    student portal
    api/        route handlers
  lib/          domain logic, data access helpers
  data/         static datasets
prisma/         schema and seeds
scripts/        maintenance and tooling scripts
deploy/         server provisioning (app server, telephony, centers)
android/        Capacitor Android project
```

## Getting started

```bash
npm install
cp .env.example .env
npm run db:push
npm run db:seed
npm run dev:notunnel
```

The app runs at http://localhost:3000.

## Scripts

| Command | Purpose |
| --- | --- |
| `npm run dev` | Development server with the telephony tunnel |
| `npm run dev:notunnel` | Development server only |
| `npm run build` | Boundary checks, Prisma client generation and production build |
| `npm run db:push` | Apply the Prisma schema to the database |
| `npm run db:seed` | Seed demo data |
| `npm run sync-cdr` | Import call history from Asterisk CDR |
| `npm run app:sync` | Sync the web build into the Android project |

## Deployment

Pushing to `main` triggers `.github/workflows/deploy.yml`, which runs `deploy/gcp/update-b.sh` on the production server: pull, dependency install when the lockfile changes, `prisma db push`, an isolated build and a service restart. The main database and every center database are backed up nightly by `deploy/centers/gl-center.sh backup-all`.
