# GO-Cart ERP + CRM – Task 01: Backend Setup & Database Foundation

Backend service built with Node.js, Express.js, MySQL, and Prisma ORM using JavaScript ES Modules (`"type": "module"`).

## Tech Stack

- Node.js (v18+)
- Express.js
- MySQL
- Prisma ORM
- JavaScript ES Modules

## Project Structure

```text
.
├── .env.example
├── package.json
├── prisma.config.js
├── postman/
│   └── go-cart-erp-crm-task-01.postman_collection.json
├── prisma/
│   ├── schema.prisma
│   └── migrations/
│       ├── migration_lock.toml
│       └── 20261119000000_init_businesses_branches/
│           └── migration.sql
└── src/
    ├── app.js
    ├── server.js
    ├── config/
    │   ├── db.js
    │   └── env.js
    ├── routes/
    │   └── index.js
    ├── controllers/
    │   ├── branch.controller.js
    │   └── business.controller.js
    ├── services/
    │   ├── branch.service.js
    │   └── business.service.js
    ├── models/
    │   ├── branch.model.js
    │   └── business.model.js
    ├── schemas/
    │   ├── branch.schema.js
    │   ├── business.schema.js
    │   └── common.schema.js
    ├── middlewares/
    │   ├── error.middleware.js
    │   ├── notFound.middleware.js
    │   └── validate.middleware.js
    └── utils/
        ├── ApiError.js
        ├── ApiResponse.js
        └── asyncHandler.js
```

Request flow: `routes/index.js` → Zod schema → controller → service → model (Prisma).
Field names stay snake_case in the Prisma schema, services, and API (`business_id`, `business_name`, `GSTIN`).

## Prerequisites

- Node.js 18 or higher
- npm
- MySQL Server running locally or remotely

## Setup Instructions

### 1. Install Dependencies

```bash
npm install
```

### 2. Configure Environment Variables

Create a `.env` file from `.env.example`:

```bash
cp .env.example .env
```

Update `.env` with your MySQL credentials and server port:

```env
PORT=3000
NODE_ENV=development
DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=
DB_NAME=gocart_erp
```

- `DB_PASSWORD` can be left empty if your local MySQL user has no password.
- Special characters in `DB_USER`, `DB_PASSWORD`, and `DB_NAME` are automatically URL-encoded when Prisma constructs its internal connection URL via `prisma.config.js`.
- At runtime, Prisma Client connects to MySQL using `@prisma/adapter-mariadb` configured directly from these variables.

### 3. Create MySQL Database

Log in to MySQL and create the database:

```sql
CREATE DATABASE gocart_erp;
```

### 4. Generate Prisma Client and Run Migrations

```bash
npm run prisma:generate
npm run prisma:deploy
```

For local development migrations when modifying the schema:

```bash
npm run prisma:migrate
```

### 5. Start the Server

```bash
npm start
```

For development with file watching:

```bash
npm run dev
```

The server starts on `http://localhost:3000` (or the `PORT` defined in `.env`).

## Database Tables

### `businesses`

| Column | Type | Constraints |
| --- | --- | --- |
| `id` | `CHAR(36)` | Primary Key, UUID (auto-generated) |
| `business_name` | `VARCHAR(255)` | Required |
| `legal_name` | `VARCHAR(255)` | Optional |
| `phone` | `VARCHAR(20)` | Optional |
| `email` | `VARCHAR(255)` | Optional |
| `GSTIN` | `VARCHAR(15)` | Optional |
| `is_active` | `BOOLEAN` | Default `true` |
| `created_at` | `DATETIME(3)` | Default current timestamp |
| `updated_at` | `DATETIME(3)` | Auto-updated |

### `branches`

| Column | Type | Constraints |
| --- | --- | --- |
| `id` | `CHAR(36)` | Primary Key, UUID (auto-generated) |
| `business_id` | `CHAR(36)` | Foreign Key -> `businesses.id` |
| `branch_code` | `VARCHAR(50)` | Required, unique per business |
| `branch_name` | `VARCHAR(255)` | Required |
| `address` | `TEXT` | Optional |
| `phone` | `VARCHAR(20)` | Optional |
| `GSTIN` | `VARCHAR(15)` | Optional |
| `is_active` | `BOOLEAN` | Default `true` |
| `created_at` | `DATETIME(3)` | Default current timestamp |
| `updated_at` | `DATETIME(3)` | Auto-updated |

One business can have multiple branches (one-to-many relationship via `branches.business_id`).

## REST API Endpoints

### Business APIs

- `POST /api/businesses` — Create a business
- `GET /api/businesses` — Get all businesses (with branches)
- `GET /api/businesses/:id` — Get a business by UUID (with branches)

Sample `POST /api/businesses` body:

```json
{
  "business_name": "GO-Cart Retail",
  "legal_name": "GO-Cart Retail Private Limited",
  "phone": "+91-9876543210",
  "email": "contact@gocartretail.in",
  "GSTIN": "27AABCG1234F1Z5",
  "is_active": true
}
```

### Branch APIs

- `POST /api/branches` — Create a branch under an existing business
- `GET /api/branches` — Get all branches (with parent business)
- `GET /api/branches/:id` — Get a branch by UUID (with parent business)

Sample `POST /api/branches` body:

```json
{
  "business_id": "REPLACE_WITH_BUSINESS_UUID",
  "branch_code": "MUM-HQ-01",
  "branch_name": "Mumbai Head Office",
  "address": "Plot 14, Andheri East, Mumbai, Maharashtra 400069",
  "phone": "+91-2240012345",
  "GSTIN": "27AABCG1234F1Z5",
  "is_active": true
}
```

## Postman API Testing

1. Open Postman and click **Import**.
2. Select `postman/go-cart-erp-crm-task-01.postman_collection.json`.
3. Verify the collection variable `base_url` is set to `http://localhost:3000`.
4. Run requests in order:
   - **Businesses → Create Business** (automatically saves `business_id` to collection variables)
   - **Businesses → Get All Businesses**
   - **Businesses → Get Business By ID**
   - **Branches → Create Branch** (uses `{{business_id}}` and saves `branch_id`)
   - **Branches → Get All Branches**
   - **Branches → Get Branch By ID**
   - **Validation Tests** (verifies `400` and `404` error handling)
