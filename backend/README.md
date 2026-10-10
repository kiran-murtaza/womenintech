# Women in Tech — NestJS Utility Bill Processing Backend

A NestJS backend module that uses the `@google/genai` SDK to extract structured data and answer competition questions from utility bill documents (PDF/images).

---

## 📁 Project Structure

```
backend/
├── src/
│   ├── bills/
│   │   ├── interfaces/
│   │   │   └── bill.interfaces.ts     # All TypeScript interfaces
│   │   ├── file-handler.service.ts    # PDF/image reading & base64 conversion
│   │   ├── gemini-extractor.service.ts # Level 1 extraction + Level 2 Q&A
│   │   ├── csv-exporter.service.ts    # CSV writing with auto-create output dir
│   │   ├── bills.service.ts           # Orchestration pipeline
│   │   ├── bills.controller.ts        # REST API endpoints
│   │   └── bills.module.ts            # NestJS module
│   ├── app.module.ts
│   └── main.ts
├── output/                            # Auto-created; CSV results written here
│   ├── level1.csv
│   └── level2.csv
├── .env                               # Your local env vars
├── .env.example                       # Template for team members
└── package.json
```

---

## ⚙️ Setup

### 1. Install dependencies

```bash
cd backend
npm install
```

### 2. Configure environment variables

```bash
cp .env.example .env
```

Edit `.env` and set your **Google AI Studio API key**:

```env
GEMINI_API_KEY=your-google-ai-studio-api-key
GEMINI_MODEL=gemini-3.1-flash-lite
PORT=4000
```

### 3. Start the server

```bash
# Development (hot reload)
npm run start:dev

# Production
npm run build && npm run start:prod
```

Server runs at: `http://localhost:4000/api`
CSV reports are saved in the repository-root `output/` directory.

---

## 🔌 API Endpoints

### `POST /api/bills/process-file`

Process a single bill file from disk path.

```json
{ "filePath": "/path/to/bill.pdf" }
```

### `POST /api/bills/process-directory`

Batch process all bills in a folder.

```json
{ "dirPath": "/path/to/bills/folder" }
```

### `POST /api/bills/upload`

Upload a bill file directly (multipart form).

- Field name: `bill`
- Supported: `.pdf`, `.jpg`, `.jpeg`, `.png`, `.webp`

### `GET /api/bills/monthly-report`

Returns the generated `level1.csv` and `level2.csv` report files for download.
Scan at least one bill before requesting the report.

### `POST /api/bills/chat`

Multipart form fields: `bill` (a supported bill file) and `question` (a question about that bill).
Streams a bill-grounded answer as server-sent events.

### `POST /api/ask`

Alias for `/api/bills/chat`, used by the consumer chat interface. Accepts the same multipart fields and streams the same server-sent events.

---

## 📊 Output CSV Files

| File                | Contents                                                                 |
| ------------------- | ------------------------------------------------------------------------ |
| `output/level1.csv` | Bill ID, account number, billing period, amounts, tariff, meter readings |
| `output/level2.csv` | 12 standard Q&A answers per bill with confidence ratings                 |

---

## 🔑 Level 1 Extracted Fields

| Field              | Description                                   |
| ------------------ | --------------------------------------------- |
| `bill_id`          | Unique bill/invoice identifier                |
| `account_number`   | Customer account number                       |
| `billing_period`   | Start and end dates (YYYY-MM-DD)              |
| `total_amount_due` | Total payable amount                          |
| `tax_amount`       | Tax/VAT component                             |
| `tariff_code`      | Rate/plan code                                |
| `meter_readings`   | Array of meter IDs, readings, and consumption |

---

## ❓ Level 2 Standard Questions

1. Account holder / customer name
2. Service/property address
3. Billing date / invoice date
4. Payment due date
5. Total amount due
6. Energy consumption (kWh/kVAh)
7. Tariff category
8. Fixed/demand charges
9. Tax/VAT amount
10. Previous balance carried forward
11. Meter number / meter ID
12. Sanctioned load / contract demand
