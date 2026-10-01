import React from 'react';
import './App.css';
import ZohoCrmDemo from './views/ZohoCrmDemo';
import ErrorBoundary from './components/ErrorBoundary';

/**
 * App – root component.
 * Contact Data Extraction & Structuring Agent (Enterprise CRM)
 */
function App() {
  return (
    <div className="app-shell">
      <ErrorBoundary fallbackTitle="Enterprise CRM Application Error">
        <ZohoCrmDemo />
      </ErrorBoundary>
    </div>
  );
}

export default App;

