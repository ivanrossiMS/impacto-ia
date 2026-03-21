console.log('ENTRY.TSX: Step 2 starting...');
import { StrictMode } from 'react';

import { createRoot } from 'react-dom/client';
import './index.css';
import { seedDatabase } from './lib/seed';

const container = document.getElementById('root');
if (container) {
  const root = createRoot(container);
  
  console.log('MAIN.TSX: Starting database seed...');
  seedDatabase().then(() => {
    console.log('MAIN.TSX: Database seed successful!');
    root.render(
      <StrictMode>
        <div className="p-10 bg-slate-100 min-h-screen">
          <h1 className="text-2xl font-bold text-success-600">PASSO 2: BANCO DE DADOS CARREGADO</h1>
          <p className="text-slate-500">O seed do banco de dados funcionou corretamente.</p>
        </div>
      </StrictMode>
    );
  }).catch((error) => {
    console.error('MAIN.TSX: Database seed failed!', error);
    root.render(
      <div className="p-10 bg-red-50 min-h-screen">
        <h1 className="text-2xl font-bold text-red-600">PASSO 2: ERRO NO BANCO DE DADOS</h1>
        <pre className="mt-4 p-4 bg-white rounded border text-xs overflow-auto">{error.stack || error.message}</pre>
      </div>
    );
  });
}
