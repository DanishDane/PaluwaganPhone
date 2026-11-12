# PaluPhone deployment and operator guide

## Run the application

Use Node.js 22.13 or newer and a persistent local disk. This Express application
requires a Node host; a static file host cannot run the API or SQLite database.

```sh
npm ci --omit=dev
npm run check
npm test
npm start
```

On Windows PowerShell, use `npm.cmd` if local policy blocks `npm.ps1`.
Open `http://localhost:3000`. A fresh database opens administrator setup after the
intro. Set your real business name and unique administrator credentials. After
setup, signed-out visitors go directly from the intro to login. Existing valid
sessions resume their dashboard. The intro plays once per browser tab session;
Settings → Startup intro → Replay plays it again. Reduced motion skips the animation.

Do not run `seed.js` against a production database: it creates sample business
records and known credentials. Existing databases are retained, so review and
remove any sample records before launch. Fresh installations contain no sample
accounts, groups, members, or payment destination numbers.

## Hosting configuration

Set environment variables through your hosting platform or service manager:

| Variable | Default | Purpose |
| --- | --- | --- |
| `NODE_ENV` | unset | Set to `production` on the host. |
| `PORT` | `3000` | Application listener port. |
| `HOST` | `0.0.0.0` | Use `127.0.0.1` behind a proxy on the same host. |
| `DATA_DIR` | `./data` | Absolute path to a writable persistent directory. |
| `SESSION_HOURS` | `12` | Maximum sign-in session duration. |

Run a single application instance with automatic restart under your platform's
service manager. Termination signals close the HTTP server and database. Mount
`DATA_DIR` outside ephemeral deployment files. Do not put SQLite on shared network
storage or run multiple replicas against it. Use a dedicated database architecture
before scaling beyond one instance.

Terminate HTTPS at your hosting platform or reverse proxy and forward all paths,
including `/api`, `/fonts`, and `/vendor`, to Node. Redirect public HTTP traffic to
HTTPS. Preserve security headers and disable proxy caching for `/api/*`. Keep the
Node listener private when a public reverse proxy is used. Configure uptime checks
against `GET /healthz`; HTTP 200 with `{"status":"ok"}` means SQLite is reachable.
The process manager must capture logs and restart the service on failure.

## Administrator and member workflow

1. Sign in as Seller / Admin. In Settings, save the actual GCash, Maya and bank
   details and remittance instructions before inviting members.
2. Set the default grace period and fines. Create an iPhone group, review its
   monthly amount, start month and number of slots, then add members.
3. Share each member's mobile number and PIN privately through the credentials
   dialog. Members select Member Portal at login to view their schedule and balances.
4. Verify incoming transfers yourself, then Record payment for the correct member,
   month and date. Sending a transfer does not automatically mark a payment as paid.
5. Check the ledger, export CSV records and record releases when devices are handed
   over. Voiding payments, deleting groups and undoing releases change financial
   records; review the confirmation before proceeding.
6. The mascot remains below the page content; click it for contextual guidance.
   Settings controls its visibility and sound. Wide ledgers scroll inside their
   cards on mobile; navigation remains at the top.

## Backups and release verification

Download the JSON export regularly from Settings and protect it as personal and
financial data. That export does not contain authentication credentials and is not
a full disaster recovery backup. Schedule filesystem backups of `DATA_DIR` while
the application is stopped (including any `.db-wal` and `.db-shm` files), or use a
SQLite-aware live backup tool. Encrypt backups, restrict access and test restoring
to an isolated staging instance. To restore a filesystem backup, stop the service,
replace its data directory with the complete backup, then start and verify it.

Before launch, verify the production URL on actual phones and desktop browsers:
intro → login, administrator sign-in, member sign-in, group creation, payment
entry, exports and logout. Run `npm run check` and `npm test` on each release.
`scripts/browser-check.cjs` optionally checks responsive layouts with Puppeteer;
install/provide it separately and set `PUPPETEER_MODULE` and `CHROME_PATH` when
needed. Its isolated data is temporary and screenshots are written to `.artifacts`.

These changes improve deployment readiness, but do not constitute an enterprise
security certification. Public financial-data deployments still need an independent
security review and operational decisions about MFA, audit retention, password/PIN
recovery, monitoring, backup retention, and availability requirements.
