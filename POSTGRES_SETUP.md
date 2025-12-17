# PostgreSQL Setup for Local Development

## Step 1: Install PostgreSQL

### Windows
1. Download PostgreSQL from: https://www.postgresql.org/download/windows/
2. Run the installer
3. Remember the password you set for the `postgres` user
4. Default port is `5432`

### Alternative: Use Docker
```bash
docker run --name shopify-app-postgres -e POSTGRES_PASSWORD=yourpassword -e POSTGRES_DB=shopify_app -p 5432:5432 -d postgres:16
```

## Step 2: Create Database

### Using psql (Command Line)
```bash
# Connect to PostgreSQL
psql -U postgres

# Create database
CREATE DATABASE shopify_app;

# Exit
\q
```

### Using pgAdmin (GUI)
1. Open pgAdmin
2. Right-click "Databases" → Create → Database
3. Name: `shopify_app`
4. Click Save

## Step 3: Create .env File

Create a `.env` file in the `store-verification` directory with:

```env
# Database - Update with your PostgreSQL credentials
DATABASE_URL=postgresql://postgres:yourpassword@localhost:5432/shopify_app?schema=public

# Shopify App Configuration
# These will be auto-populated by Shopify CLI, but you can set defaults:
SHOPIFY_API_KEY=
SHOPIFY_API_SECRET=
SHOPIFY_API_SCOPES=read_products,write_products
SHOPIFY_APP_URL=http://localhost:3000
NODE_ENV=development
```

**Important**: Replace `yourpassword` with your actual PostgreSQL password.

## Step 4: Run Migrations

```bash
cd store-verification

# Generate Prisma Client
npx prisma generate

# Run migrations
npx prisma migrate dev
```

## Step 5: Verify Setup

```bash
# Open Prisma Studio to view your database
npx prisma studio
```

This will open a browser at http://localhost:5555 where you can see your database tables.

## Troubleshooting

### Connection Error: "password authentication failed"
- Check your password in DATABASE_URL
- Make sure PostgreSQL is running

### Connection Error: "could not connect to server"
- Make sure PostgreSQL service is running
- Check if port 5432 is correct
- On Windows: Check Services → PostgreSQL

### Migration Error: "relation already exists"
- Database might have existing tables
- Run: `npx prisma migrate reset` (WARNING: deletes all data)
- Or manually drop tables if needed

## Next Steps

After database is set up:
1. Run `npm run dev` to start Shopify CLI
2. Shopify CLI will handle OAuth and environment variables
3. Install app on a dev store
4. Test the app!

