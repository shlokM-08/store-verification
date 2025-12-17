# Reset PostgreSQL Password on Windows

## Method 1: Using pg_ctl (Recommended)

1. Open Command Prompt as Administrator
2. Navigate to PostgreSQL bin directory (usually):
   ```cmd
   cd "C:\Program Files\PostgreSQL\16\bin"
   ```
   (Replace `16` with your PostgreSQL version)

3. Stop PostgreSQL service:
   ```cmd
   pg_ctl stop -D "C:\Program Files\PostgreSQL\16\data"
   ```

4. Edit `pg_hba.conf` file:
   - Location: `C:\Program Files\PostgreSQL\16\data\pg_hba.conf`
   - Find line: `host all all 127.0.0.1/32 scram-sha-256`
   - Change to: `host all all 127.0.0.1/32 trust`
   - Save the file

5. Start PostgreSQL:
   ```cmd
   pg_ctl start -D "C:\Program Files\PostgreSQL\16\data"
   ```

6. Connect without password:
   ```cmd
   psql -U postgres
   ```

7. Reset password:
   ```sql
   ALTER USER postgres WITH PASSWORD 'your_new_password';
   ```

8. Revert `pg_hba.conf` back to `scram-sha-256`

9. Restart PostgreSQL service

## Method 2: Use pgAdmin (Easier)

1. Open pgAdmin (should be installed with PostgreSQL)
2. When prompted for password, try common defaults or check if you saved it
3. If you can't connect, use Method 1 above

## Method 3: Check if you saved the password

- Check if you wrote it down during installation
- Check password managers
- Try common defaults (postgres, admin, password)


