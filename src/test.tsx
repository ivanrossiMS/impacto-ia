import './index.css';


import { createRoot } from 'react-dom/client';
import { seedDatabase } from './lib/seed';

console.log('TEST.TSX EVALUATING');

const setup = async () => {
  console.log('TEST.TSX: Starting seed...');
  try {
    await seedDatabase();
    console.log('TEST.TSX: Seed done');
    const root = document.getElementById('root');
    if (root) {
      createRoot(root).render(<h1 style={{color: 'green', padding: '50px'}}>TESTE COM SEED FUNCIONANDO</h1>);
    }
  } catch (err) {
    console.error('TEST.TSX: Seed error', err);
  }
};

setup();
