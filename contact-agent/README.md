# Contact Data Extraction & Structuring Agent

> **React Frontend → Node.js/Express Backend → SNS Square Agent Workbench (Webhook) → Google Sheets**

---

## Project Structure

```
contact-agent/
├── backend/               # Node.js/Express API server (port 4000)
├── frontend/              # React application (port 3000)
├── workbench_workflow.json  # Import this into SNS Square Agent Workbench
├── postman_collection.json  # Postman tests for all endpoints
└── README.md              # This file
```

---

## Quick Start

### Prerequisites
- Node.js 18+
- npm 9+
- SNS Square Agent Workbench access
- Google Sheets API credentials (connected inside Workbench)
- Groq API key (set as credential inside Workbench)
- Mistral API key (for image OCR, set inside Workbench)

---

## Step-by-Step Setup

### 1. Import Workbench Workflow

1. Open SNS Square Agent Workbench
2. Click **Import Workflow**
3. Select `workbench_workflow.json`
4. **Configure credentials inside Workbench**:
   - Set **Groq** credential in all 4 Groq nodes
   - Set **Mistral** credential in the Mistral OCR node
   - Set **Google Sheets** credential in all 4 `Append Row` nodes
   - Replace `YOUR_SPREADSHEET_ID` in each Append Row node with your actual Google Sheets spreadsheet ID
5. **Note the Webhook URL** shown on the Webhook Trigger node (something like `https://your-workbench.com/webhook/contact-extraction`)
6. Activate the workflow

### 2. Configure Backend

```bash
cd backend
npm install
cp .env.example .env
```

Edit `.env`:
```env
PORT=4000
WORKBENCH_WEBHOOK_URL=https://YOUR_WORKBENCH_HOST/webhook/contact-extraction
BACKEND_CALLBACK_URL=http://localhost:4000/webhook/workbench-callback
```

> **Important**: `BACKEND_CALLBACK_URL` must be reachable FROM the Workbench server. If running locally, use [ngrok](https://ngrok.com) to expose port 4000: `ngrok http 4000` then set `BACKEND_CALLBACK_URL=https://xxxx.ngrok.io/webhook/workbench-callback`

Start backend:
```bash
npm run dev
```

### 3. Start Frontend

```bash
cd frontend
npm install
npm start
```

Frontend opens at `http://localhost:3000`

---

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/upload` | Upload files (multipart/form-data, field: `files`) |
| GET | `/status/:batch_id` | Get batch + per-file processing status |
| POST | `/retry/:file_id` | Retry a failed file |
| GET | `/contacts` | Get all contacts (optional `?batch_id=`) |
| POST | `/webhook/workbench-callback` | Internal — called by Workbench |

### Supported File Types
- **Images**: `image/jpeg`, `image/png`, `image/gif` → Mistral OCR → Groq extraction
- **PDF**: `application/pdf` → Extract From PDF → Groq extraction
- **CSV**: `text/csv` → Extract From CSV → Groq normalization
- **Text/Other**: fallback → Groq extraction directly

### File Status Values
| Status | Meaning |
|--------|---------|
| `queued` | Waiting to be sent to Workbench |
| `processing` | Sent to Workbench, awaiting callback |
| `done` | Processed, contacts saved |
| `failed` | Error occurred (see `error` field) |

---

## Google Sheets Setup

Create a sheet with these column headers in row 1 of a tab named **Contacts**:

```
Full Name | First Name | Last Name | Designation | Company | Email | Phone | Address | City | State | Country | Sector/Industry | LinkedIn URL | Website | Source | Validation Status | Duplicate Status | Extracted At
```

---

## Workbench Workflow

### Nodes Used (all confirmed from documentation)

| Stage | Node | toolId |
|-------|------|--------|
| Entry | Webhook Trigger | `webhook` |
| Field preservation | Set Fields | `core.set` |
| Routing | Switch | `core_switch` |
| PDF text | Extract From PDF | `extract-from-file.extract-from-pdf` |
| Image OCR | Mistral OCR | `mistral` |
| CSV parsing | Extract From CSV | `extract-from-file.extract-from-csv` |
| AI Extraction | Groq | `groq` |
| Looping | Loop Items | `core_loop` |
| Storage | Append Row | `google.sheets.append_row` |
| Response | Webhook Response | `respondToWebhook` |

### Data Flow

```
Webhook Trigger (POST)
  ↓
Set Fields (preserve file_id, batch_id)
  ↓
Switch (route by file_type)
  ├─ PDF → Extract From PDF → Groq → Loop → Sheets → Webhook Response
  ├─ CSV → Extract From CSV → Groq → Loop → Sheets → Webhook Response
  ├─ Image → Mistral OCR → Groq → Loop → Sheets → Webhook Response
  └─ Text → Groq → Loop → Sheets → Webhook Response
```

---

## Contact Schema

Each extracted contact has these fields:

| Field | Type | Source |
|-------|------|--------|
| `full_name` | string/null | Extracted by LLM |
| `first_name` | string/null | Extracted by LLM |
| `last_name` | string/null | Extracted by LLM |
| `designation` | string/null | Extracted by LLM |
| `company` | string/null | Extracted by LLM |
| `email` | string/null | Extracted + normalized |
| `phone` | string/null | Extracted + normalized |
| `address` | string/null | Extracted by LLM |
| `city` | string/null | Extracted by LLM |
| `state` | string/null | Extracted by LLM |
| `country` | string/null | Extracted by LLM |
| `sector_industry` | string/null | Derived from context or null if unknown |
| `linkedin_url` | string/null | Extracted by LLM |
| `website` | string/null | Extracted by LLM |
| `source` | string | File name |
| `validation_status` | `valid`/`invalid` | Email format check |
| `duplicate_status` | `unique`/`unknown` | Within-batch deduplication |

> ⚠️ **Sector/Industry**: This field is derived by the LLM from company name and job title context. If the source document does not mention the industry, the LLM will attempt to infer it but may set it to `null`. It will **never be fabricated** with high confidence.

---

## Testing with Postman

1. Import `postman_collection.json` into Postman
2. Set collection variable `base_url` to `http://localhost:4000`
3. Run requests in order:
   - **Request 1**: Upload a file → auto-saves `batch_id` and `file_id`
   - **Request 2**: Poll status until `done`
   - **Request 6**: Simulate Workbench callback if testing without live Workbench

---

## Configuration Needed in Workbench (Your Responsibility)

The following **cannot be done from the backend** and must be configured directly inside SNS Square Agent Workbench after importing the workflow:

| Item | Location in Workbench | What to Do |
|------|----------------------|------------|
| Groq API key | All 4 Groq nodes | Set credential |
| Mistral API key | Mistral OCR node | Set credential |
| Google Sheets auth | All 4 Append Row nodes | Connect Google account |
| Spreadsheet ID | All 4 Append Row nodes | Replace `YOUR_SPREADSHEET_ID` |
| Sheet tab name | All 4 Append Row nodes | Ensure "Contacts" tab exists |
| Webhook URL | Webhook Trigger node | Copy URL and set as `WORKBENCH_WEBHOOK_URL` in `.env` |

---

## UNKNOWN / NEEDS CONFIRMATION

| Item | Status | What You Need to Do |
|------|--------|---------------------|
| Exact Workbench Webhook URL format | ❓ UNKNOWN | After import, check Webhook Trigger node for the actual URL |
| Webhook authentication | ❓ UNKNOWN | Workflow uses `none` by default. Add `headerAuth` in Workbench if needed, then update backend to send the header |
| Groq model availability | ❓ NEEDS CONFIRMATION | Confirm `llama-3.3-70b-versatile` is available in your Workbench Groq plan |
| Mistral OCR input format | ❓ NEEDS CONFIRMATION | Workflow passes base64 image content. Confirm Mistral node input field name in your Workbench version |
| `respondToWebhook` callback behavior | ❓ UNKNOWN | Confirm that Workbench sends the Webhook Response body to the caller (the backend's `/webhook/workbench-callback`) when `responseMode: respondWithNode` |

---

## Development Notes

- **In-memory store**: The backend uses in-memory Maps. All data is lost on restart. For production, replace with MongoDB, PostgreSQL, or Redis.
- **File storage**: Files are not persisted to disk by default (processed in-memory as base64). For production, add AWS S3 or local disk storage.
- **Concurrency**: Files in a batch are sent to Workbench concurrently. Workbench may have rate limits depending on your plan.
- **Polling**: Frontend polls every 3 seconds. For SSE/WebSocket upgrade, add `socket.io` to the backend and emit events from the callback route.
