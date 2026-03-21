import { db } from './src/lib/dexie';

async function seedDuelsForTest() {
  const studentId = 'aluno-1';
  const opponentId = 'aluno-2';
  const duelId = 'test-duel-' + Date.now();

  await db.duels.add({
    id: duelId,
    challengerId: studentId,
    challengedId: opponentId,
    theme: 'Ciências',
    difficulty: 'medium',
    questionCount: 5,
    challengerScore: 4,
    challengedScore: 2,
    status: 'completed',
    winnerId: studentId,
    createdAt: new Date().toISOString()
  });

  await db.duelQuestions.bulkAdd([
    {
      id: duelId + '-q1',
      duelId: duelId,
      questionText: 'Qual é o planeta mais próximo do Sol?',
      options: [
        { id: 'o1', text: 'Marte', isCorrect: false },
        { id: 'o2', text: 'Vênus', isCorrect: false },
        { id: 'o3', text: 'Mercúrio', isCorrect: true },
        { id: 'o4', text: 'Terra', isCorrect: false }
      ],
      explanation: 'Mercúrio é o primeiro planeta do sistema solar.',
      challengerAnswerId: 'o3', // Correct
      challengedAnswerId: 'o2'  // Wrong
    },
    {
      id: duelId + '-q2',
      duelId: duelId,
      questionText: 'O que a planta precisa para fazer fotossíntese?',
      options: [
        { id: 'o1', text: 'Apenas água', isCorrect: false },
        { id: 'o2', text: 'Luz solar, água e gás carbônico', isCorrect: true },
        { id: 'o3', text: 'Apenas terra', isCorrect: false },
        { id: 'o4', text: 'Gás oxigênio', isCorrect: false }
      ],
      explanation: 'A fotossíntese transforma luz em energia.',
      challengerAnswerId: 'o2', // Correct
      challengedAnswerId: 'o2'  // Correct
    }
  ]);

  console.log('Test duel seeded successfully');
}

seedDuelsForTest();
