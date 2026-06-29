# Workspace Rules for Nuove (AI Reel Coach)

This workspace contains the AI Reel Coach application. The active code bases are:
- **Backend**: Root directory `/src`, `/prisma`, `package.json`
- **Frontend**: Subdirectory `/ai-reel-coach-frontend`
- **Note**: The `/ai-reel-coach` subdirectory is legacy/duplicate code. Do not modify or run it.

## Environment & Run Command Constraints (Critical for this Machine)

1. **Powershell Execution Policy**: Running `.ps1` scripts (like `npm`) is disabled on this host.
   - **Always use `npm.cmd`** instead of `npm`. For example, run `npm.cmd install` and `npm.cmd run dev`.

2. **SSL Certificate Validation Issues**: The network or system environment throws certificate verification errors (e.g., `UNABLE_TO_VERIFY_LEAF_SIGNATURE`) when downloading dependencies or Prisma binaries.
   - To bypass this, prefix execution commands with `$env:NODE_TLS_REJECT_UNAUTHORIZED="0";`.
   - Example: `$env:NODE_TLS_REJECT_UNAUTHORIZED="0"; npm.cmd run db:generate`.

3. **Database Configuration**:
   - The database provider is configured as `postgresql` in `prisma/schema.prisma`.
   - The local database URL is configured in the root `.env` file. Ensure that the database is running and accessible before attempting migrations or start commands.
