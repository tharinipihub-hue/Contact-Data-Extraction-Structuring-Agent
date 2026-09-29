export const API_BASE =
  process.env.REACT_APP_API_BASE_URL ||
  (typeof window !== 'undefined' && window.location.hostname === 'localhost' && window.location.port === '3000'
    ? 'http://localhost:4000'
    : '');
export const POLL_INTERVAL_MS = 3000;
export const GOOGLE_SHEETS_URL =
  'https://docs.google.com/spreadsheets/d/1AZqaSfoyhcjQOLif1xZfeGi9rfMWHwKDRJUaYuArJVE/edit';

