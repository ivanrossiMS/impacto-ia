import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './index.css';
import { seedDatabase } from './lib/seed';
import { ErrorBoundary } from './components/ErrorBoundary';

import { syncEngine } from './lib/syncEngine';

const rootElement = document.getElementById('root');

if (rootElement) {
  const root = createRoot(rootElement);
  
  // Initialize Sync Engine (Supabase -> Dexie)
  syncEngine.initialize()
    .catch((err) => console.error('Error initializing sync engine:', err));

  // Seed the database optionally then render
  seedDatabase()
    .catch((err) => console.error('Error seeding database:', err))
    .finally(() => {
      root.render(
        <StrictMode>
          <ErrorBoundary>
            <App />
          </ErrorBoundary>
        </StrictMode>
      );
    });
}
