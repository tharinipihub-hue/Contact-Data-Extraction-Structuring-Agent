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

## Lead Scoring & Qualification Engine Specification

The system incorporates an Enterprise Lead Scoring & Qualification Engine modeled after Zoho CRM Enterprise standards. It evaluates every extracted contact using an objective, multi-factor point model with strict guardrails and execution ordering.

### 1. Rule Execution Order

To prevent logical collisions (e.g. an AI company CEO who qualifies for both an Apex Floor of 85 and a Competitor Override of 20), rules are strictly evaluated in the following sequential order:

1. **Step 1: Competitor Override Check**
   - If contact belongs to a direct AI competitor or vendor (excluding educational institutions, universities, and healthcare trusts), the contact is immediately assigned:
     - **Score**: `20` (Cold / Low Priority)
     - **Rationale**: `"Direct AI company / role overlap; competitor clash with our AI offerings. Assigned to Cold priority."`
     - **Action**: Deprioritized to avoid market conflict.
     - *All subsequent scoring steps are bypassed.*
2. **Step 2: Base Points Calculation**
   $$\text{Base Score} = \text{Seniority Points} + \text{Sector Points} + \text{Available Channels Points}$$
3. **Step 3: Non-Decision-Maker Cap**
   - If `Seniority <= 5` (Interns, Students, Clerks, Unspecified Roles):
     $$\text{Score} = \min(\text{Score}, 39) \quad (\text{Guaranteed Cold})$$
4. **Step 4: Apex Executive Floor**
   - If `Seniority == 40` (Board Trustees, Chairmen, CEOs, MDs, Chancellors, Ministers, Cabinet/Chief Secretaries):
     $$\text{Score} = \max(\text{Score}, 85) \quad (\text{Guaranteed Hot})$$
5. **Step 5: Mid-Level Hot Gate**
   - The Hot Tier ($\ge 70$) is strictly reserved for apex decision-makers (`Seniority >= 35`).
   - If `Seniority < 35` (Managers, Department Leads, Professors, Faculty, Staff):
     $$\text{Score} = \min(\text{Score}, 69) \quad (\text{Guaranteed Warm Max})$$
6. **Step 6: Final Tier Assignment**
   - Final score bounded to $[0, 100]$.
   - Tier assigned:
     - **Hot (High Priority)**: $70\text{–}100$
     - **Warm (Medium Priority)**: $40\text{–}69$
     - **Cold (Low Priority)**: $0\text{–}39$

---

### 2. Point Breakdown Tables

#### A. Seniority & Decision-Making Authority (Max 40 Pts)

| Tier Level | Points | Included Titles & Roles |
|:---|:---:|:---|
| **Apex Institutional / Corporate / Govt Leadership** | **40** | Trustee, Chairman, Chairperson, Correspondent, Director, Managing Director, Chancellor, Principal (Institution Head), Dean, President, Founder, Co-Founder, CEO, CTO, CFO, COO, CRO, CIO, Owner, Partner, Minister, Cabinet Secretary, Chief Secretary |
| **Senior Administrative & Govt Leadership** | **35** | Vice President (VP, SVP, EVP, AVP), Assistant/Associate/Deputy Director, Joint Director, Provost, Controller, Registrar, Commissioner, Secretary to Government, Joint Secretary, Head of Department |
| **Managerial Roles** | **25** | Manager, Lead, Supervisor, Coordinator, HOD, Product Owner, Process Owner, Scrum Master |
| **Specialist & Academic Faculty** | **20** | Professor, Associate Professor, Assistant Professor, Faculty, Lecturer, Reader, Principal Engineer/Architect, Domain Specialist, Consultant, Analyst |
| **Professional Staff Role** | **15** | Officer, Executive, Associate, Assistant, Staff, Representative, Personal Secretary, Executive Secretary |
| **Non-Decision Maker / Entry / Unspecified** | **5** | Intern, Internship, Student, Trainee, Apprentice, Peon, Attendant, Clerk, Unspecified Title |

#### B. Sector & Industry Relevance (Max 30 Pts)

| Sector Classification | Points | Matching Criteria |
|:---|:---:|:---|
| **Target Sector** | **30** | Higher Education, Universities, Engineering/Tech Colleges, Schools, Trusts, Software/SaaS/IT, Healthcare/Pharma, Retail/Apparel/Fashion, Banking/Finance, SNS Institutions |
| **Government & Public Administration** | **20** | Ministries, Government Departments, Public Administration, Municipal Corporations, PSUs, State/Central Secretariats |
| **Standard Commercial Organization** | **20** | Standard corporate entities, manufacturing, logistics, services outside priority target sectors |
| **Missing / Unspecified Sector** | **5** | Document contains no company or sector information |

#### C. Available Channels & Reachability (Max 30 Pts)

*Zero hallucination standard: Channels are labeled **"Available channels"** based strictly on extracted contact data.*

| Channel Type | Points | Validation & Scoring Criteria |
|:---|:---:|:---|
| **Official / Corporate Email** | **15** | Valid RFC-compliant email on a corporate/custom domain |
| **Personal Freemail** | **8** | Valid email from personal domains (`@gmail`, `@yahoo`, `@outlook`, `@hotmail`, `@icloud`, `@rediffmail`, `@aol`) |
| **Cleaned Phone Number** | **10** | Indian standard 8–11 digit phone number (strips `+91`, country code, trunk prefixes `0`) |
| **LinkedIn URL or Physical Address** | **5** | Valid LinkedIn profile URL or physical postal/office address |

---

### 3. Concrete Benchmark Examples

| Contact Name | Title & Company | Seniority (S) | Sector (I) | Available Channels (C) | Base Calculation | Applied Rules | Final Score | Tier |
|:---|:---|:---:|:---:|:---:|:---:|:---|:---:|:---:|
| **Ashish Dikshit** | Managing Director, Aditya Birla Fashion & Retail | 40 | 30 | Corporate Email (15) + Phone (10) = 25 | $40 + 30 + 25 = 95$ | Base score exceeds floor (95 > 85) | **95** | **Hot** |
| **Engineering Intern** | Intern, SNS College of Technology | 5 | 30 | Corporate Email (15) + Phone (10) + LinkedIn (5) = 30 | $5 + 30 + 30 = 65$ | **Non-DM Cap**: $\min(65, 39) = 39$ | **39** | **Cold** |
| **Marketing Manager** | Manager, Tech Solutions Inc | 25 | 30 | Corporate Email (15) + Phone (10) = 25 | $25 + 30 + 25 = 80$ | **Hot Gate**: Seniority $25 < 35 \rightarrow \min(80, 69) = 69$ | **69** | **Warm** |
| **University Professor** | Professor, Delhi University | 20 | 30 | Corporate Email (15) + Phone (10) + LinkedIn (5) = 30 | $20 + 30 + 30 = 80$ | **Hot Gate**: Seniority $20 < 35 \rightarrow \min(80, 69) = 69$ | **69** | **Warm** |
| **AI Startup CEO** | Chief Executive Officer, NextGen AI Solutions | 40 | 30 | Corporate Email (15) + Phone (10) = 25 | Bypassed | **Competitor Override**: Direct AI market clash | **20** | **Cold** |
| **Apex Leader (No Channels)** | Chairman, Global Retail Corp | 40 | 30 | None (0) | $40 + 30 + 0 = 70$ | **Apex Floor**: $\max(70, 85) = 85$. Action: *"No contact channel available; research contact details prior to outreach."* | **85** | **Hot** |
| **Union Minister** | Minister, Ministry of Education | 40 | 20 | Official Email (15) = 15 | $40 + 20 + 15 = 75$ | **Apex Floor**: $\max(75, 85) = 85$ | **85** | **Hot** |
| **Secretary to Govt** | Secretary to Government, Public Works Dept | 35 | 20 | None (0) | $35 + 20 + 0 = 55$ | Eligible for Hot if reachability $\ge 15$ | **55** | **Warm** |

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

### Digital nurturing campaign persistence

Campaigns, nurturing contacts, and engagement history are stored by the backend under `NURTURE_DATA_DIR`. Local development defaults to `contact-agent/backend/nurture-data`. This directory is ignored by Git and must not be treated as deployment storage.

The repository's `render.yaml` declares a 1 GB persistent disk mounted at `/var/data` and configures `NURTURE_DATA_DIR=/var/data`. Render deployments created from this Blueprint therefore store campaign data on the disk. Existing Render services created outside the Blueprint may need the same disk attached in the Dashboard; copy any existing production data to that disk before first use. The backend refuses to run with the checkout-local data path in production, and verifies that Render's configured path is on `/var/data`.

- **Nurturing data**: Campaigns, nurturing contacts, and engagement history use JSON files under `NURTURE_DATA_DIR`; production requires this to be on durable storage as described above.
- **File storage**: Files are not persisted to disk by default (processed in-memory as base64). For production, add AWS S3 or local disk storage.
- **Concurrency**: Files in a batch are sent to Workbench concurrently. Workbench may have rate limits depending on your plan.
- **Polling**: Frontend polls every 3 seconds. For SSE/WebSocket upgrade, add `socket.io` to the backend and emit events from the callback route.
