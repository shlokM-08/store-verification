# Production-Ready Shopify App Setup Guide

This is a production-ready Shopify app built with TypeScript, React, Remix (React Router), and Prisma. It's designed for multi-tenant SaaS deployment on Vercel.

## Architecture Overview

- **Framework**: React Router (Remix-based)
- **Language**: TypeScript
- **UI**: Shopify Polaris Web Components
- **Backend**: Remix loaders/actions
- **Auth**: Shopify OAuth (online + offline tokens)
- **Database**: PostgreSQL + Prisma
- **Hosting**: Vercel (serverless-compatible)

## Features

✅ **Authentication & Installation**
- Shopify OAuth with official SDK
- Stores shop domain, access token, and installation timestamp
- Handles uninstall webhook
- Prevents duplicate installs

✅ **Database Layer**
- Multi-tenant Shop model
- Flexible Settings model (key/value)
- Prisma migrations included
- Multi-tenant safety ensured

✅ **Embedded App UI**
- Dashboard showing shop info and status
- Settings page with key/value configuration
- Auto-save UX

✅ **Webhooks**
- `app/uninstalled` webhook handler
- HMAC verification
- Idempotency handling

✅ **Vercel Compatibility**
- No filesystem writes
- Serverless-friendly
- Environment variable configuration

## Prerequisites

1. **Node.js** >= 20.19 or >= 22.12
2. **Shopify Partner Account** - [Create one](https://partners.shopify.com/signup)
3. **Shopify CLI** - Install globally:
   ```bash
   npm install -g @shopify/cli@latest
   ```
4. **PostgreSQL Database** - For production (local dev can use SQLite temporarily)

## Local Development Setup

### 1. Install Dependencies

```bash
cd store-verification
npm install
```

### 2. Database Setup

#### Option A: PostgreSQL (Recommended for Production)

1. Set up a PostgreSQL database (local or cloud):
   - Local: Install PostgreSQL and create a database
   - Cloud: Use services like [Supabase](https://supabase.com), [Neon](https://neon.tech), or [Railway](https://railway.app)

2. Create a `.env` file in the root directory:

```env
# Shopify App Configuration
SHOPIFY_API_KEY=your_api_key_here
SHOPIFY_API_SECRET=your_api_secret_here
SHOPIFY_API_SCOPES=read_products,write_products
SHOPIFY_APP_URL=https://your-app-url.vercel.app

# Database
DATABASE_URL=postgresql://user:password@localhost:5432/shopify_app?schema=public

# Node Environment
NODE_ENV=development
```

#### Option B: SQLite (Local Dev Only)

For quick local testing, you can temporarily use SQLite:

1. Update `prisma/schema.prisma`:
   ```prisma
   datasource db {
     provider = "sqlite"
     url      = "file:./dev.sqlite"
   }
   ```

2. Run migrations:
   ```bash
   npx prisma migrate dev
   ```

**Note**: SQLite is NOT recommended for production. Use PostgreSQL for Vercel deployment.

### 3. Run Database Migrations

```bash
# Generate Prisma Client
npx prisma generate

# Run migrations
npx prisma migrate dev
```

### 4. Start Development Server

```bash
# This will start the Shopify CLI dev server
npm run dev
```

The CLI will:
- Prompt you to select or create a Shopify app
- Set up environment variables automatically
- Create a tunnel for local development
- Open your app in the browser

Press `P` to open the preview URL and install the app on a development store.

## Project Structure

```
store-verification/
├── app/
│   ├── lib/
│   │   ├── shop.server.ts          # Shop database operations
│   │   └── settings.server.ts      # Settings operations
│   ├── routes/
│   │   ├── app.tsx                  # App layout with navigation
│   │   ├── app._index.tsx          # Dashboard route
│   │   ├── app.settings.tsx        # Settings page
│   │   ├── auth.$.tsx              # Auth callback handler
│   │   └── webhooks.app.uninstalled.tsx  # Uninstall webhook
│   ├── db.server.ts                # Prisma client singleton
│   └── shopify.server.ts           # Shopify app configuration
├── prisma/
│   ├── schema.prisma               # Database schema
│   └── migrations/                 # Database migrations
└── package.json
```

## Key Files Explained

### `app/shopify.server.ts`
- Configures Shopify app with OAuth
- Handles installation via `afterAuth` hook
- Registers webhooks (via `shopify.app.toml`)

### `app/lib/shop.server.ts`
- Multi-tenant shop operations
- `upsertShop()` - Creates/updates shop on install
- `getShop()` - Retrieves shop data
- `markShopUninstalled()` - Handles uninstall

### `app/lib/settings.server.ts`
- Per-shop key/value settings
- All operations scoped by `shopId` for tenant isolation

### `app/routes/app._index.tsx`
- Dashboard showing shop domain, install date, and status
- Loads data from database via loader

### `app/routes/app.settings.tsx`
- Settings management UI
- Auto-save with debounce
- Add/delete settings

### `app/routes/webhooks.app.uninstalled.tsx`
- Handles app uninstall webhook
- Marks shop as uninstalled
- Cleans up settings
- Idempotent (safe for retries)

## Database Schema

### Shop Model
```prisma
model Shop {
  id            String    @id @default(cuid())
  shopDomain    String   @unique
  accessToken   String
  installedAt   DateTime @default(now())
  uninstalledAt DateTime?
  settings      Setting[]
}
```

### Setting Model
```prisma
model Setting {
  id     String @id @default(cuid())
  shopId String
  key    String
  value  String
  shop   Shop   @relation(fields: [shopId], references: [id], onDelete: Cascade)

  @@unique([shopId, key])
}
```

## Vercel Deployment

### 1. Prepare for Deployment

1. **Set up PostgreSQL database**:
   - Use [Vercel Postgres](https://vercel.com/docs/storage/vercel-postgres)
   - Or external providers: Supabase, Neon, Railway, etc.

2. **Update `shopify.app.toml`**:
   ```toml
   application_url = "https://your-app.vercel.app"
   ```

### 2. Deploy to Vercel

1. **Install Vercel CLI** (optional):
   ```bash
   npm i -g vercel
   ```

2. **Deploy**:
   ```bash
   vercel
   ```

   Or connect your GitHub repo to Vercel for automatic deployments.

### 3. Configure Environment Variables

In Vercel dashboard, set these environment variables:

```
SHOPIFY_API_KEY=your_api_key
SHOPIFY_API_SECRET=your_api_secret
SHOPIFY_API_SCOPES=read_products,write_products
SHOPIFY_APP_URL=https://your-app.vercel.app
DATABASE_URL=postgresql://user:password@host:5432/db
NODE_ENV=production
```

### 4. Build Settings

Vercel will auto-detect the build settings, but ensure:

- **Build Command**: `npm run build`
- **Output Directory**: `.react-router` (or as configured)
- **Install Command**: `npm install`

### 5. Database Migrations

Run migrations on first deployment:

```bash
# Option 1: Via Vercel CLI
vercel env pull .env.local
npx prisma migrate deploy

# Option 2: Via Vercel Postgres (if using)
# Migrations run automatically on deploy if configured
```

Or add to `package.json`:
```json
{
  "scripts": {
    "postinstall": "prisma generate",
    "vercel-build": "prisma migrate deploy && npm run build"
  }
}
```

## Environment Variables Reference

| Variable | Description | Required |
|----------|-------------|----------|
| `SHOPIFY_API_KEY` | Your Shopify app API key | Yes |
| `SHOPIFY_API_SECRET` | Your Shopify app API secret | Yes |
| `SHOPIFY_API_SCOPES` | Comma-separated scopes (e.g., `read_products,write_products`) | Yes |
| `SHOPIFY_APP_URL` | Your app's public URL | Yes |
| `DATABASE_URL` | PostgreSQL connection string | Yes |
| `NODE_ENV` | `production` or `development` | Yes |

## Testing

### Test Installation Flow

1. Start dev server: `npm run dev`
2. Install app on a development store
3. Check database - shop should be created
4. Visit `/app` - should show shop info

### Test Settings

1. Navigate to `/app/settings`
2. Add a setting (e.g., `api_key` = `test123`)
3. Verify it saves (check database)
4. Edit the value - should auto-save
5. Delete setting - should be removed

### Test Uninstall Webhook

1. Uninstall app from Shopify admin
2. Check database - `uninstalledAt` should be set
3. Settings should be deleted

## Troubleshooting

### Database Connection Issues

**Error**: `Environment variable not found: DATABASE_URL`

**Solution**: Ensure `.env` file exists with `DATABASE_URL` set.

### Migration Issues

**Error**: `Migration failed`

**Solution**: 
1. Check database connection
2. Ensure database exists
3. Run `npx prisma migrate reset` (WARNING: deletes all data)

### Vercel Deployment Issues

**Error**: `Prisma Client not generated`

**Solution**: Add to `package.json`:
```json
{
  "scripts": {
    "postinstall": "prisma generate"
  }
}
```

### Webhook HMAC Validation

**Error**: Webhook HMAC validation fails

**Solution**: Ensure `SHOPIFY_API_SECRET` is set correctly in Vercel environment variables.

## Code Quality

- ✅ Full TypeScript typing (no `any`)
- ✅ Multi-tenant safety (all queries scoped by shop)
- ✅ Idempotent webhooks
- ✅ Error handling
- ✅ Production-ready patterns

## Next Steps

This is a foundational app ready for feature additions:

1. Add more webhooks (products, orders, etc.)
2. Add GraphQL queries/mutations
3. Add admin API integrations
4. Add billing/subscription handling
5. Add analytics/logging
6. Add rate limiting
7. Add caching layer

## Resources

- [Shopify App Development](https://shopify.dev/docs/apps)
- [React Router Docs](https://reactrouter.com/)
- [Prisma Docs](https://www.prisma.io/docs)
- [Vercel Deployment](https://vercel.com/docs)
- [Shopify App Bridge](https://shopify.dev/docs/api/app-bridge-library)

