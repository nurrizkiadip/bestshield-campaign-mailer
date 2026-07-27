# BestShield Campaign Mailer

A high-performance, asynchronous email campaign delivery system capable of processing and dispatching targeted or bulk campaign emails to millions of customers. Built with **Next.js 16 (App Router)**, **BullMQ**, **Redis**, **SQLite**, and **Nodemailer**.

---

## 📌 Project Overview

**BestShield Campaign Mailer** provides a dashboard and robust background worker processing pipeline for email marketing campaigns. It allows administrators to:
- Browse and paginate through 1,000,000+ customer records cleanly.
- Select individual target customers or launch a campaign to **all** registered customers.
- Offload heavy email delivery tasks asynchronously to a resilient **BullMQ** queue backed by **Redis**.
- Track real-time campaign execution progress (waiting, active, completed, and failed jobs).
- Inspect simulated outbound emails using **MailDev** in local development environments.

---

## 🏗️ Architecture & Project Structure

The project follows a **Layered Architecture** separating raw data access, business domain services, HTTP controllers, and background job processing:

```
bestshield-campaign-mailer/
├── app/                        # Next.js App Router (Controllers & UI)
│   ├── api/                    # Controller Layer (HTTP Route Handlers)
│   │   ├── campaign/
│   │   │   ├── status/         # GET /api/campaign/status (Queue status)
│   │   │   └── trigger/        # POST /api/campaign/trigger (Enqueue jobs)
│   │   └── customers/          # GET /api/customers (Paginated list)
│   ├── globals.css             # Tailwind CSS & UI styling
│   ├── layout.tsx              # Root Layout
│   └── page.tsx                # Dashboard UI (Customer Table & Campaign Trigger)
├── db/                         # Database Access Layer
│   └── sqlite.ts               # Node SQLite connection & raw SQL queries
├── services/                   # Business Domain Service Layer
│   ├── campaignService.ts      # BullMQ queue management & campaign batching logic
│   └── customerService.ts      # Customer pagination calculations
├── lib/                        # Infrastructure Singletons
│   └── campaign.ts             # Shared Redis connection & BullMQ Queue instance
├── scripts/                    # Scripts & Background Workers
│   ├── generate-data.mjs       # Database seeder (Generates 1,000,000 mock records)
│   └── worker.mjs              # BullMQ queue worker process (Nodemailer dispatcher)
├── public/                     # Static assets (contains customer.sqlite database file)
├── __tests__/                  # Automated Test Suite (Vitest + React Testing Library)
│   ├── api/                    # API Route handler unit/integration tests
│   ├── page.test.tsx           # Dashboard integration UI tests
│   └── worker.test.mjs         # Queue worker job processor unit tests
├── docker-compose.yml          # Local infra services (Redis & MailDev)
├── vitest.config.ts            # Vitest test runner configuration
└── package.json
```

---

## 🛠️ Tech Stack & Libraries

### Core Framework & Runtimes
- **Framework**: [Next.js 16.2](https://nextjs.org/) (App Router, Server Components & Route Handlers)
- **UI Library**: [React 19](https://react.dev/)
- **Language**: [TypeScript](https://www.typescriptlang.org/)
- **Styling**: [Tailwind CSS v4](https://tailwindcss.com/)

### Database & Queue Management
- **Database**: Node Native SQLite (`node:sqlite` via `DatabaseSync`)
- **Queue System**: [BullMQ](https://docs.bullmq.io/)
- **Cache / In-Memory Data Store**: [Redis](https://redis.io/) (`ioredis`)

### Emailing & Development Services
- **SMTP Transporter**: [Nodemailer](https://nodemailer.com/)
- **Email Sandbox (Local)**: [MailDev](https://github.com/maildev/maildev) (Dockerized SMTP & Web Webmail UI)

### Automated Testing
- **Test Runner**: [Vitest](https://vitest.dev/)
- **DOM Testing**: `@testing-library/react`, `@testing-library/user-event`, `@testing-library/jest-dom`
- **Environment**: `jsdom`

---

## 📊 Database Schema & Data Structure

The application uses an SQLite database (`public/customers.sqlite`).

### `customers` Table

| Column Name | Data Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| `id` | `INTEGER` | `PRIMARY KEY` | Unique customer identifier |
| `name` | `TEXT` | `NOT NULL` | Customer full name |
| `email` | `TEXT` | `NOT NULL` | Customer email address |

---

## ⚙️ Environment Variables

Copy the example environment file to configure your local setup:

```bash
cp .env.example .env
```

Default `.env` configuration:

```env
# Redis Configuration (Used by BullMQ for background job queues)
REDIS_HOST=127.0.0.1
REDIS_PORT=6379

# SMTP Configuration (Used by Nodemailer for sending emails)
# If running MailDev locally, it defaults to port 1025
SMTP_HOST=127.0.0.1
SMTP_PORT=1025
```

---

## 🚀 How to Setup the Project

### 1. Prerequisites
- **Node.js**: `v22.x` or later (required for native `node:sqlite` support)
- **Docker & Docker Compose**: For running local Redis and MailDev instances
- **npm** / **pnpm** / **yarn**

### 2. Install Dependencies
```bash
npm install
```

### 3. Start Infrastructure Services (Redis & MailDev)
Launch Redis (port 6379) and MailDev (SMTP port 1025, Web UI port 1080):
```bash
docker compose up -d
```

### 4. Generate Mock Data (Seeding)
Seed the SQLite database with 1,000,000 customer records:
```bash
node scripts/generate-data.mjs
```
*Note: This creates `public/customers.sqlite` using SQLite WAL mode for fast writes.*

---

## 🏃 How to Run the Application

To run the complete system, you need to run **three** components:

### Step 1: Ensure Redis & MailDev are Running
```bash
docker compose up -d
```
- **MailDev Web UI**: Accessible at [http://localhost:1080](http://localhost:1080) to preview outgoing emails.

### Step 2: Start the Background Queue Worker
In a dedicated terminal window:
```bash
node scripts/worker.mjs
```
*This process listens to the BullMQ `campaignQueue` and processes email sending concurrently (5 batches / 1000 emails per batch).*

### Step 3: Start Next.js Development Server
In another terminal window:
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) in your browser to access the Campaign Mailer Dashboard.

---

## 🧪 How to Run Automated Tests

The application features a comprehensive test suite powered by **Vitest** covering page interactions, API controllers, service methods, and background worker processing.

### Run All Tests Once
```bash
npm run test
```

### Run Tests in Watch Mode
```bash
npm run test:watch
```

---

## 📡 API Endpoints Summary

| Method | Endpoint | Description | Query / Body Params |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/customers` | Fetch paginated customer records | `?page=1&limit=20` |
| `POST` | `/api/campaign/trigger` | Queue email dispatch jobs | Body: `{ sendToAll: boolean, customerIds?: number[] }` |
| `GET` | `/api/campaign/status` | Get campaign progress & job metrics | None |
