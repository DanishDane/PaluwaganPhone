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
4. Members transfer funds to the seller, then select **Submit payment** in their
   portal. They enter the month, hulog/fine amounts, date, method and reference,
   and attach the original PNG, JPEG or WebP receipt (up to 5 MB). Submissions
   remain pending and do not change balances until approved.
5. Sellers open **Ledger → Submitted receipts → Review**. Open the full-size
   image, match the reference, amount, recipient and date against the actual
   transaction in the receiving account, tick the verification confirmation,
   and select **Approve & record**. Approval creates exactly one ledger payment.
   To reject a submission, enter a reason; the member sees it in their portal.
   Members can refresh status and submit a corrected receipt after rejection.
   Receipt images cannot prove authenticity. The system blocks exact reused
   images and transaction references, but cannot detect every edited screenshot.
   One transfer belongs to one submission/month; ask the seller to handle a
   transfer spanning multiple months without reusing its receipt/reference.
6. Sellers can still **Record payment** directly. Cash attachments are optional;
   non-cash payments require a reference and receipt. Use **View receipt** in the
   ledger, member details, or member portal to open stored proof. Legacy payments
   remain valid and show **No attachment** when none was originally provided.
7. Check the ledger, export CSV records and record releases when devices are handed
   over. Voiding payments, deleting groups and undoing releases change financial
   records; review the confirmation before proceeding.
8. The mascot remains below the page content; click it for contextual guidance.
   Settings controls its visibility and sound. Wide ledgers scroll inside their
   cards on mobile; navigation remains at the top.

## Monthly draw and device releases

Open **iPhone Groups → group → Monthly draw**. The wheel fills automatically with
members who have never won and have no recorded release. It does not spin on page
load. Choose the group month and select **Spin & save winner**. You can draw before
everyone pays, including in a group with open slots. Only registered members with
fully verified hulog and required fines for that month enter the wheel. Partial,
unpaid and pending receipt submissions do not qualify. Previous winners from other
months and released members stay excluded. All members must keep paying.
The seller can select a past group month for a delayed draw; future months stay
locked. One current result is saved per month; spin attempts are retained in history.
The wheel runs for about 10 seconds with a gradual slowdown. Reduced-motion
preferences still show the result immediately.

The server saves the eligible names, collection snapshot, seller and timestamp
before the animation starts. Refreshing, retrying, or using another browser shows
that same winner, including when the connection fails after saving. To deliberately
replace an unreleased winner, choose **Spin again**, enter a reason and confirm.
The current winner re-enters the eligible pool if still paid, so the same person
can win again. The server rechecks eligibility each time, retains every attempt,
and rejects stale or duplicate requests. The latest result controls release and
member status; superseded results are marked in the attempt history. Spinning
again is blocked once the current winner has a recorded device release.
Changing the group's slots, start month, monthly amount, device
model, storage or price, or deleting members/groups, is blocked after a draw to
protect its history.

Existing releases automatically exclude those members. Before the first system
draw, use **Record existing Messenger winner** for any prior winners still waiting
for handover. Select the appropriate month and member, provide the Messenger result
details, and confirm it is an existing result. This is explicitly marked as a
Messenger entry, not a random wheel draw. It does not require the current ledger
to be complete, because it records a result already decided outside the system.
Review historical records before drawing; the app cannot infer unrecorded winners.

Use **Copy announcement** or **Download winner card** and share it manually in the
existing Messenger group. No chat, Messenger login or automatic sending is added.
The cards contain the group, winner and device, without private receipts or balances.

After actual handover, select **Mark released** and save the release date, optional
IMEI/serial and note. Only a recorded winner may be released. Members see either
**Awaiting monthly draw**, **Selected for release**, or **Device received** in their
portal. **Member slot #** is an identifier, not a promised release turn. Existing
fixed turn numbers no longer determine release dates.

To correct an incorrect handover entry, open the member details and choose
**Correct release**, giving a required reason. The correction is retained in the
group history and backup; the member remains a winner awaiting release and cannot
win again. Legacy release corrections preserve the previous winner automatically.

## Backups and release verification

Download the JSON export regularly from Settings and protect it as personal and
financial data. That export does not contain authentication credentials and is not
a full disaster recovery backup. It includes receipt images as base64 plus submission
review records. Receipts are private database blobs and can be opened only by sellers
or the member who owns that payment. Protect these exports accordingly. Configure
the reverse proxy to permit request bodies of at least 8 MB for receipt submissions.
The database upgrades automatically on startup; back it up before deploying updates.
Schedule filesystem backups of `DATA_DIR` while
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
