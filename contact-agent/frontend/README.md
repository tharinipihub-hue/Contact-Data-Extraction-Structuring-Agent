# Contact Extraction Agent — Frontend

A React (Create React App) frontend for the **Contact Data Extraction & Structuring Agent**.

## Prerequisites

- Node.js ≥ 16
- The backend API server must be running on **port 4000** before starting the frontend.

## Getting Started

```bash
# 1. Install dependencies
npm install

# 2. Start the development server (opens at http://localhost:3000)
npm start

# 3. (Optional) Create a production build
npm run build
```

> **Note:** The backend must be running at `http://localhost:4000` before the frontend will work correctly. All API requests are proxied through that address.

---

## Project Structure

```
frontend/
├── public/
│   └── index.html            # CRA HTML shell
├── src/
│   ├── index.js              # ReactDOM entry point
│   ├── App.js                # Root component (nav + view switching)
│   ├── App.css               # Global styles (no external CSS framework)
│   ├── config.js             # API_BASE & POLL_INTERVAL_MS constants
│   ├── api.js                # Axios API call wrappers
│   ├── components/
│   │   ├── UploadZone.js     # react-dropzone file picker
│   │   ├── BatchStatus.js    # Polling batch progress tracker
│   │   └── ContactsTable.js  # Sortable/searchable contacts table
│   └── views/
│       ├── UploadView.js     # Upload state machine (idle→uploading→tracking)
│       └── ContactsView.js   # All-contacts view with Export CSV
└── README.md
```

## Key Features

| Feature | Details |
|---|---|
| File upload | Drag-and-drop or click; PDF, CSV, JPEG, PNG, GIF; max 20 MB per file |
| Batch tracking | Auto-polls `/status/:batch_id` every 3 s; stops when all files finish |
| Retry | Retry individual failed files via `/retry/:file_id` |
| Contacts table | Search by name / company / email; color-coded validation & duplicate chips |
| CSV export | Exports currently visible (filtered) rows with one click |

## Configuration

Edit [`src/config.js`](src/config.js) to change the backend URL or polling frequency:

```js
export const API_BASE = 'http://localhost:4000';
export const POLL_INTERVAL_MS = 3000;
```

## Available Scripts

| Script | Description |
|---|---|
| `npm start` | Run the dev server with hot reload at http://localhost:3000 |
| `npm run build` | Create an optimised production build in `build/` |
| `npm test` | Run the test suite with Jest / React Testing Library |
