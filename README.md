# PaluPhone — iPhone Paluwagan Management System & Member Portal

For production startup, responsive behavior, administrator/member instructions,
hosting configuration, and backups, see [DEPLOYMENT.md](DEPLOYMENT.md).

A full-stack, responsive web application designed for iPhone Paluwagan businesses. Handles monthly hulog collection, due dates, grace periods, automated late fines, and turn-based device releases with an interactive 3D UI, Web Audio sound effects, and an interactive mascot.

---

## Features

- **Dynamic iPhone Model Management**: Create groups for any iPhone model (iPhone 11 to 16 Pro Max), storage variants, and colorways with custom 3D shader rendering.
- **Configurable Member Sizing**: Supports 12-member groups, 10-member batches, or custom group counts with automated monthly calculations (`price ÷ members`).
- **End-of-Month Due Dates & 5-Day Grace Period**: Payments are due on the final calendar day of each month, with a configurable 5-day grace extension. Late fines calculate automatically after grace expires.
- **Member Self-Service Portal**: Members log in with their mobile number and PIN to submit receipt proofs, view balances, monthly draw results, release status, and seller payment channels.
- **Monthly iPhone Draw**: Group pages automatically include members who have not won or received a device. Verified monthly collections unlock a server-selected, saved winner; Messenger announcements and release records stay separate from chat.
- **Responsive Dual UI**: Full-featured desktop dashboard and a native-style mobile bottom navigation bar (`Home`, `Groups`, `Hulog FAB`, `Members`, `Ledger`).
- **3D Three.js Visuals & Sound FX**: Interactive procedural 3D iPhone with orbiting status coins, and Web Audio synthesis for button clicks, cash registers, and stamp sound effects.
- **Piso Mascot**: Interactive companion character providing real-time alerts for overdue payments and tips.

---

## Tech Stack

- **Runtime**: Node.js (v22.5+)
- **Database**: Built-in SQLite (`node:sqlite`)
- **Backend**: Express.js
- **Frontend**: Vanilla JS (ES Modules), CSS Design System
- **3D Graphics**: Three.js
- **Audio**: Web Audio API (Synthesized tone generators)

---

## Getting Started

### Prerequisites
- Node.js v22.5 or higher

### Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/DanishDane/paluphone.git
   cd paluphone
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Seed initial database (optional):
   ```bash
   node seed.js
   ```

4. Start the server:
   ```bash
   npm start
   ```

5. Open your browser:
   - **Local**: `http://localhost:3000`
   - **Mobile (Wi-Fi)**: `http://<your-ip-address>:3000`

---

## Default Accounts

| Role | Username / Mobile | Password / PIN | Description |
|---|---|---|---|
| **Seller / Admin** | `admin` | `admin123` | Seeded development account only |
| **Member** | `09171234501` | `1234` | Maria Santos (iPhone 11 Batch 1) |

| **NEW ADD FEATURES **|
|CONTRACT AND SIGNATURE| 
