# Scripts

This directory contains utility scripts for the Shopify app.

## backfill-products.ts

Backfills all existing products from Shopify into your Postgres database.

### Prerequisites

- Make sure your `.env` file has `DATABASE_URL` configured
- Ensure you have installed the app on at least one shop (so products can be fetched)
- Install dependencies: `npm install`

### Usage

**Backfill products for all installed shops:**
```bash
npm run backfill-products
```

**Backfill products for a specific shop:**
```bash
npm run backfill-products your-shop.myshopify.com
```

Or using tsx directly:
```bash
npx tsx scripts/backfill-products.ts [shopDomain]
```

### What it does

1. Fetches all products from Shopify using the GraphQL Admin API
2. Converts them to the webhook payload format
3. Saves/updates each product in your Postgres database using `upsert`
4. Shows progress as it processes products

### Notes

- The script uses the access tokens stored in your database for each shop
- Products are upserted (created or updated), so running it multiple times is safe
- The script handles pagination automatically (Shopify returns 250 products per page)
- If a shop is uninstalled, it will be skipped
- Errors for individual products won't stop the entire process

### Troubleshooting

**Error: "Shop not found"**
- Make sure the shop domain is correct (include `.myshopify.com`)
- Ensure the shop has installed your app

**Error: "No access token"**
- The shop needs to have installed your app at least once
- Try reinstalling the app on the shop

**Error: "GraphQL errors"**
- Check that your app has `read_products` scope
- Verify the access token is still valid

