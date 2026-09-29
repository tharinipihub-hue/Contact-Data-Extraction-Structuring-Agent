# Contact Agent — Backend

> Express.js backend for the **Contact Data Extraction & Structuring Agent** powered by the SNS Square Agent Workbench.

---

## Prerequisites

| Requirement | Version |
|-------------|---------|
| Node.js     | ≥ 18.x  |
| npm         | ≥ 9.x   |

---

## Quick Start

```bash
# 1. Install dependencies
npm install

# 2. Create your environment file
cp .env.example .env

# 3. Open .env and fill in at minimum:
#    WORKBENCH_WEBHOOK_URL=https://<your-workbench-host>/webhook/contact-extraction
#    BACKEND_CALLBACK_URL=http://<your-public-host>:4000/webhook/workbench-callback

# 4. Start the dev server (auto-restarts on file changes)
npm run dev

# — or start without auto-restart —
npm start
```

The server starts on **http://localhost:4000** by default (change `PORT` in `.env`).

---

## Environment Variables

| Variable                  | Default / Required | Description |
|---------------------------|--------------------|-------------|
| `PORT`                    | `4000`             | Port the HTTP server listens on |
| `WORKBENCH_WEBHOOK_URL`   | **required**       | Full URL of the SNS Square Workbench ingest webhook |
| `WORKBENCH_WEBHOOK_SECRET`| _(optional)_       | Bearer token sent in `Authorization` header to the workbench |
| `BACKEND_CALLBACK_URL`    | **required**       | Public URL the workbench will POST results back to (`/webhook/workbench-callback`) |
| `UPLOAD_DIR`              | `./uploads`        | Directory created at startup (currently unused for storage; reserved) |
| `MAX_FILE_SIZE_MB`        | `20`               | Maximum allowed file size per upload |

---

## API Endpoints

### `POST /upload`
Upload one or more files for contact extraction.

**Content-Type:** `multipart/form-data`  
**Field name(s):** `files` (multiple) _or_ `file` (single)

**Supported MIME types:** `image/jpeg`, `image/png`, `image/gif`, `application/pdf`, `text/csv`

**Response `202`:**
```json
{
  "batch_id": "uuid-v4",
  "total_files": 2,
  "files": [
    { "file_id": "uuid-v4", "file_name": "card.jpg",      "status": "queued" },
    { "file_id": "uuid-v4", "file_name": "contacts.csv",  "status": "queued" }
  ]
}
```

---

### `GET /status/:batch_id`
Poll the processing status of every file in a batch.

**Response `200`:**
```json
{
  "batch_id": "uuid-v4",
  "created_at": "2026-09-25T10:00:00.000Z",
  "total_files": 2,
  "done_count": 1,
  "failed_count": 0,
  "processing_count": 1,
  "queued_count": 0,
  "files": [
    { "file_id": "...", "file_name": "card.jpg",     "file_type": "image/jpeg", "status": "done",       "error": null },
    { "file_id": "...", "file_name": "contacts.csv", "file_type": "text/csv",   "status": "processing", "error": null }
  ]
}
```

---

### `GET /contacts[?batch_id=<uuid>]`
Retrieve extracted contacts. Omit `batch_id` to get all contacts.

**Response `200`:**
```json
{
  "total": 5,
  "batch_id": "uuid-v4",
  "contacts": [ { "name": "Jane Doe", "email": "jane@example.com", "_file_id": "..." } ]
}
```

---

### `POST /retry/:file_id`
Re-trigger processing for a **failed** file.

**Response `200`:**
```json
{ "file_id": "uuid-v4", "status": "queued", "message": "Retry triggered." }
```

**Error `400`** if file is not in `failed` state.

---

### `POST /webhook/workbench-callback`
**(Internal)** — Called by the SNS Square Agent Workbench with extraction results.

**Body:**
```json
{
  "file_id":  "uuid-v4",
  "batch_id": "uuid-v4",
  "status":   "done",
  "contacts": [ { "name": "...", "email": "...", "phone": "..." } ],
  "error":    null
}
```

**Response `200`:** `{ "ok": true }`

---

### `GET /health`
Liveness check.

**Response `200`:** `{ "status": "ok", "timestamp": "..." }`

---

## Project Structure

```
backend/
├── .env.example
├── package.json
├── README.md
└── src/
    ├── index.js                     # App entry point
    ├── store.js                     # In-memory Map-based data store
    ├── routes/
    │   ├── upload.js                # POST /upload
    │   ├── status.js                # GET  /status/:batch_id
    │   ├── contacts.js              # GET  /contacts
    │   ├── webhook.js               # POST /webhook/workbench-callback
    │   └── retry.js                 # POST /retry/:file_id
    └── services/
        └── workbenchService.js      # Core: encode & send file to workbench
```

---

## Data Flow

```
Client
  │
  ▼  POST /upload (multipart files)
┌─────────────────┐
│   upload.js     │  ── creates batch + file IDs in store
│                 │  ── fires processFile() async (fire-and-forget)
└────────┬────────┘
         │ returns 202 immediately
         ▼
┌─────────────────────────┐
│  workbenchService.js    │  ── base64-encodes each file buffer
│                         │  ── POST → WORKBENCH_WEBHOOK_URL
└────────────┬────────────┘
             │  (async, in background)
             ▼
     SNS Square Workbench
             │  POST callback_url
             ▼
┌─────────────────────────┐
│   webhook.js            │  ── updates file status in store
│  /workbench-callback    │  ── stores extracted contacts
└─────────────────────────┘

Client polls:
  GET /status/:batch_id   ── check progress
  GET /contacts?batch_id= ── retrieve results
```

---

## Notes

- **Storage is in-memory**: all data resets when the server restarts. For production, replace `store.js` with a database adapter (PostgreSQL, MongoDB, Redis, etc.).
- **File buffers are not persisted**: the `/retry` endpoint re-sends the stored metadata to the workbench (useful when the failure was a network/config issue). If the workbench needs the actual bytes again, the client must re-upload.
- **CORS** is wide-open in this configuration (`cors()`). Restrict origins for production deployment.
