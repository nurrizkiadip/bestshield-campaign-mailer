# Feature Implementation Plan: Automated Testing Setup

**Target Implementer:** Junior Programmer / Low-Tier AI Model
**Objective:** Introduce robust automated testing (Unit and Integration) to the Next.js Campaign Mailer project.

## 1. Pre-requisite: Refactoring to Layered Architecture
Before writing tests, the codebase must be refactored from a monolithic API route structure into a Layered Architecture. This makes the code modular, reusable, and significantly easier to unit test.

### A. Database Layer (`/db`)
Create a new directory at the root: `/db`. This layer handles all raw data access.
- **`db/sqlite.ts`**: Create a connection manager for `node:sqlite`. Move the database instantiation logic here. Expose methods like `queryCustomers(limit, offset)`, `queryCustomersByIds(ids)`, and `getCustomerCount()`.

### B. Service Layer (`/services`)
Create a new directory at the root: `/services`. This layer handles business logic.
- **`services/campaignService.ts`**: Move the BullMQ logic (`campaignQueue.addBulk`, `clean`, `drain`) here. Expose methods like `triggerCampaign(customerIds, sendToAll)` and `getCampaignStatus()`.
- **`services/customerService.ts`**: Handle the logic for calculating total batches or retrieving customer subsets by calling the DB layer.

### C. Controller Layer (`/app/api`)
The existing Next.js Route Handlers (`app/api/.../route.ts`) will act strictly as Controllers.
- They should only parse the incoming HTTP `NextRequest` (extract JSON body or query params).
- Pass the parsed data to the appropriate Service function.
- Return the `NextResponse` based on the Service's result or thrown errors. Do **not** instantiate the DB or BullMQ directly in the route handler.

---

## 2. Tooling & Framework Selection
For modern Next.js projects, **Vitest** is heavily recommended over Jest due to its native ES Modules support, out-of-the-box TypeScript compatibility, and faster execution speeds.
- **Test Runner:** `vitest`
- **DOM Environment:** `jsdom`
- **UI Testing:** `@testing-library/react` and `@testing-library/user-event`
- **Assertions:** `@testing-library/jest-dom`

---

## 3. Setup & Configuration Steps

### 1. Install Dependencies
Run the following installation command to add test tooling to `devDependencies`:
```bash
npm install -D vitest @vitejs/plugin-react jsdom @testing-library/react @testing-library/jest-dom @testing-library/user-event
```

### 2. Configure Vitest
Create a `vitest.config.ts` file in the root of the project:
- Import `defineConfig` from `vitest/config`.
- Import `react` from `@vitejs/plugin-react`.
- Configure the environment to `jsdom`.
- Set up alias resolution (so that `@/lib/*` imports work in tests just like Next.js).
- Point to a global setup file: `setupFiles: ['./vitest.setup.ts']`.

### 3. Setup File
Create `vitest.setup.ts` in the root:
- Simply add: `import '@testing-library/jest-dom';` to inject DOM assertion matchers (like `toBeInTheDocument`).

### 4. Update `package.json`
Add the following scripts:
- `"test": "vitest run"`
- `"test:watch": "vitest"`
- `"test:coverage": "vitest run --coverage"`

---

## 4. Test Implementation Guide

### Scenario 1: Page Integration Test
**Target:** Frontend Dashboard (`app/page.tsx`)
**File to create:** `__tests__/page.test.tsx`
- **Mocking Strategy:** 
  - Mock the global `fetch` API using `vi.spyOn(global, 'fetch')` to return fake customer data (e.g., 2 pages of mock users) and fake BullMQ status.
- **Test Cases:**
  1. *Rendering:* Ensure the table renders the mocked customers correctly.
  2. *Selection Logic:* Test that clicking the "Select All" table header checkbox updates the trigger button text to "Send Email to ALL Customers".
  3. *Action:* Test that clicking the trigger button successfully makes a POST request to `/api/campaign/trigger` with the expected JSON payload (`sendToAll`, `customerIds`).

### Scenario 2: API Endpoint - Campaign Trigger
**Target:** `app/api/campaign/trigger/route.ts`
**File to create:** `__tests__/api/trigger.test.ts`
- **Mocking Strategy:**
  - Mock `BullMQ`'s `Queue` class (`addBulk`, `drain`, `clean`) using `vi.mock('@/lib/campaign')` so we don't need a real Redis connection.
  - Mock the `node:sqlite` database connection to prevent locking real files.
- **Test Cases:**
  1. *Selective Triggering:* Send a mock NextRequest to `/api/campaign/trigger` with `{ sendToAll: false, customerIds: [1, 2] }` and assert that `campaignQueue.addBulk` is called exactly once with those 2 IDs.
  2. *Global Triggering:* Send a mock NextRequest with `{ sendToAll: true }` and assert that the endpoint chunks the total SQLite records correctly.

### Scenario 3: API Endpoint - Campaign Status
**Target:** `app/api/campaign/status/route.ts`
**File to create:** `__tests__/api/status.test.ts`
- **Mocking Strategy:**
  - Mock `BullMQ`'s `Queue.getJobCounts()` method.
- **Test Cases:**
  1. *Status Calculation:* Send a GET request to `/api/campaign/status`. Mock `campaignQueue.getJobCounts()` to return `{ waiting: 5, active: 2, completed: 10, failed: 1 }`. Assert that the endpoint correctly maps these into the `CampaignStatus` JSON format and mathematically calculates the progress `percentage`.

### Scenario 4: API Endpoint - Get Customers
**Target:** `app/api/customers/route.ts`
**File to create:** `__tests__/api/customers.test.ts`
- **Mocking Strategy:**
  - Mock the SQLite `prepare().all()` and `prepare().get()` methods.
- **Test Cases:**
  1. *Pagination:* Send a GET request to `/api/customers?page=1&limit=15`. Mock the SQLite query to return a fake array of 15 customers and a total count of 30. Assert the endpoint returns the correct `data` array and the `meta` pagination object matches page 1, limit 15, and totalPages 2.

### Scenario 5: Script - Background Worker
**Target:** `scripts/worker.mjs`
**File to create:** `__tests__/worker.test.mjs`
- **Refactoring Requirement:** To test the worker effectively, the inline processor function inside `new Worker(...)` should be extracted into a standalone exported function (e.g., `export async function processJob(job, db, transporter)`).
- **Mocking Strategy:**
  - Mock `nodemailer.createTransport` to spy on `transporter.sendMail` and prevent real emails from flying out.
  - Mock the SQLite DB.
- **Test Cases:**
  1. *Success Rate:* Pass a mock job with 5 valid customers. Assert that `sendMail` is called 5 times and the function returns `{ success: 5, failed: 0, batchIndex: 1 }`.
  2. *Error Handling:* Mock `sendMail` to force a rejection for one of the emails. Assert that the function correctly catches the error and returns `{ success: 4, failed: 1, batchIndex: 1 }`.
