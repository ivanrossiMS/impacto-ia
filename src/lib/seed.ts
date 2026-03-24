import { db } from './dexie';
import { seedAchievements } from './gameSeeder';

export async function seedDatabase(force?: boolean) {
  const userCount = await db.users.count();
  const schoolCount = await db.schools.count();
  // Ensure Master Admin exists even if we don't clear/seed everything
  const now = new Date().toISOString();
  await db.users.put({
    id: 'admin-master',
    role: 'admin',
    name: 'Ivan Rossi',
    email: 'ivanrossi@outlook.com',
    passwordHash: 'ivanrossi',
    isMaster: true,
    isRegistered: true,
    createdAt: now,
    updatedAt: now,
    status: 'active'
  } as any);

  // If we have any data and it's not a forced seed, skip remaining seed (including mock schools)
  if (!force && (userCount > 0 || schoolCount > 0)) {
    console.log('Database already has data. Skipping primary seed.');
    return;
  }

  if (force) {
    console.log('FORCED SEED: CLEANING DATABASE...');
    const tables = [
      db.users, db.schools, db.classes, db.activities, db.learningPaths,
      db.studentActivityResults, db.studentProgress, db.studentMissions,
      db.studentAchievements, db.gamificationStats, db.studentAvatarProfiles,
      db.studentOwnedAvatars, db.supportTickets, db.ticketMessages,
      db.libraryItems, db.diaryEntries, db.notifications, db.duels, db.duelQuestions
    ];

    for (const table of tables) {
      await table.clear();
    }
  }

  // 2. Initial Gamification Stats (Empty for now as no students)
  const studentIds: string[] = [];
  for (const sid of studentIds) {
    await db.gamificationStats.put({
      id: sid,
      level: 1,
      xp: 0,
      coins: 500, // Starting coins
      streak: 0,
      lastStudyDate: now
    });
  }

  // 3. Avatar Catalog Seeds
  await db.avatarCatalog.bulkPut([
    // AVATARS
    {
      id: 'default-student',
      name: 'Capivara Estudante',
      description: 'O avatar padrão do IMPACTO-IA. Todo aluno começa aqui!',
      assetUrl: '/avatars/default-impacto.png',
      type: 'avatar',
      rarity: 'comum',
      priceCoins: 0,
      isFree: true,
      isActive: 1,
      sortOrder: 0,
      createdAt: now,
      updatedAt: now
    },

    // BACKGROUNDS
    {
      id: 'bg-simple-blue',
      name: 'Azul Premium',
      description: 'Um fundo azul gradiente limpo e profissional.',
      assetUrl: '/avatars/bg/blue_gradient.svg',
      type: 'background',
      rarity: 'comum',
      priceCoins: 0,
      isFree: true,
      isActive: 1,
      sortOrder: 1,
      createdAt: now,
      updatedAt: now
    },
    {
      id: 'bg-classroom',
      name: 'Sala de Aula',
      description: 'O ambiente clássico dos estudantes dedicados.',
      assetUrl: '/avatars/bg/blue_gradient.svg',
      type: 'background',
      rarity: 'comum',
      priceCoins: 150,          // ~1.5 dias ativo
      isActive: 1,
      sortOrder: 2,
      createdAt: now,
      updatedAt: now
    },
    {
      id: 'bg-galaxy',
      name: 'Galáxia do Saber',
      description: 'Para mentes que pensam grande e exploram o infinito.',
      assetUrl: '/avatars/bg/blue_gradient.svg',
      type: 'background',
      rarity: 'incomum',
      priceCoins: 400,          // ~4 dias ativo
      isActive: 1,
      sortOrder: 3,
      createdAt: now,
      updatedAt: now
    },
    {
      id: 'bg-neon-city',
      name: 'Cidade Neon',
      description: 'Luzes futuristas para os alunos mais modernos.',
      assetUrl: '/avatars/bg/blue_gradient.svg',
      type: 'background',
      rarity: 'raro',
      priceCoins: 900,          // ~1.5 semanas ativo
      isActive: 1,
      sortOrder: 4,
      createdAt: now,
      updatedAt: now
    },

    // BORDERS
    {
      id: 'border-simple',
      name: 'Moldura Simples',
      description: 'Uma borda discreta para todo estudante.',
      assetUrl: '/avatars/borders/simple.svg',
      type: 'border',
      rarity: 'comum',
      priceCoins: 0,
      isFree: true,
      isActive: 1,
      sortOrder: 1,
      createdAt: now,
      updatedAt: now
    },
    {
      id: 'border-silver',
      name: 'Moldura de Prata',
      description: 'Elegante e refinada. Para alunos com estilo.',
      assetUrl: '/avatars/borders/simple.svg',
      type: 'border',
      rarity: 'incomum',
      priceCoins: 350,          // ~3.5 dias ativo
      isActive: 1,
      sortOrder: 2,
      createdAt: now,
      updatedAt: now
    },
    {
      id: 'border-gold',
      name: 'Moldura de Ouro',
      description: 'Só os melhores alunos ostentam essa. Brilhante e rara.',
      assetUrl: '/avatars/borders/simple.svg',
      type: 'border',
      rarity: 'épico',
      priceCoins: 2500,         // ~24 dias ativo — só quem é dedicado
      isActive: 1,
      sortOrder: 3,
      createdAt: now,
      updatedAt: now
    },
    {
      id: 'border-diamond',
      name: 'Moldura Diamante',
      description: 'A mais rara de todas. Exibe com orgulho, você merece.',
      assetUrl: '/avatars/borders/simple.svg',
      type: 'border',
      rarity: 'lendário',
      priceCoins: 8000,         // ~76 dias ativo — trofeu de longo prazo
      isActive: 1,
      sortOrder: 4,
      createdAt: now,
      updatedAt: now
    },

    // STICKERS
    {
      id: 'st-star',
      name: 'Estrela Brilhante',
      description: 'Um clássico! Para os alunos que brilham na sala.',
      assetUrl: '/avatars/stickers/star.svg',
      type: 'sticker',
      rarity: 'comum',
      priceCoins: 75,           // <1 dia ativo
      isActive: 1,
      sortOrder: 1,
      createdAt: now,
      updatedAt: now
    },
    {
      id: 'st-rocket',
      name: 'Foguete do Conhecimento',
      description: 'Aprendizado na velocidade da luz!',
      assetUrl: '/avatars/stickers/star.svg',
      type: 'sticker',
      rarity: 'incomum',
      priceCoins: 280,          // ~3 dias ativo
      isActive: 1,
      sortOrder: 2,
      createdAt: now,
      updatedAt: now
    },
    {
      id: 'st-medal',
      name: 'Medalha do Saber',
      description: 'Conquista que só os estudiosos mais dedicados carregam.',
      assetUrl: '/avatars/stickers/star.svg',
      type: 'sticker',
      rarity: 'raro',
      priceCoins: 750,          // ~1 semana ativo
      isActive: 1,
      sortOrder: 3,
      createdAt: now,
      updatedAt: now
    },
    {
      id: 'st-crown',
      name: 'Coroa do Campeão',
      description: 'Para os líderes do ranking. Reza a lenda que traz boa sorte nas provas.',
      assetUrl: '/avatars/stickers/star.svg',
      type: 'sticker',
      rarity: 'épico',
      priceCoins: 3200,         // ~1 mês ativo
      isActive: 1,
      sortOrder: 4,
      createdAt: now,
      updatedAt: now
    },
  ]);

  // 4. Initial Owned Items (Optional basics)
  await db.studentOwnedAvatars.bulkPut([
    { id: crypto.randomUUID(), studentId: 'aluno-1', catalogItemId: 'bg-simple-blue', acquiredAt: now, acquisitionType: 'onboarding' },
    { id: crypto.randomUUID(), studentId: 'aluno-1', catalogItemId: 'border-simple', acquiredAt: now, acquisitionType: 'onboarding' }
  ]);

  // 5. Initial Avatar Profile
  await db.studentAvatarProfiles.put({
    studentId: 'aluno-1',
    selectedAvatarId: 'default-student',
    selectedBackgroundId: 'bg-simple-blue',
    selectedBorderId: 'border-simple',
    equippedStickerIds: [],
    updatedAt: now
  });

  // 6. Learning Paths Seeds
  await db.learningPaths.bulkPut([
    {
      id: 'path-math-4-1',
      title: 'Aventura dos Números Grandes',
      subject: 'Matemática',
      grade: '4º Ano',
      difficulty: 'easy',
      description: 'Aprenda a lidar com números de até 5 ordens!',
      order: 1,
      rewardCoins: 100,
      rewardXp: 200,
      steps: [
        { id: 'step-1', title: 'Explicação: Centena de Milhar', type: 'intro' },
        { id: 'step-2', title: 'Praticando na Capivara-Base', type: 'practice' },
        { id: 'step-3', title: 'Desafio do Número Gigante', type: 'quiz' }
      ]
    }
  ]);
  
  // 7. Initial Schools
  await db.schools.bulkPut([
    { id: 'school-alpha', name: 'Colégio Alpha', status: 'active', usersCount: 1240, globalScore: 9.4 },
    { id: 'school-beta', name: 'Escola Beta Tech', status: 'active', usersCount: 860, globalScore: 8.8 },
    { id: 'school-gamma', name: 'Instituto Gamma', status: 'inactive', usersCount: 920, globalScore: 7.2 },
    { id: 'school-saber', name: 'Saber School', status: 'active', usersCount: 400, globalScore: 9.1 },
  ]);

  // 8. Initial Classes (Turmas)
  await db.classes.bulkAdd([
    {
      id: 'class-1',
      name: '4º Ano A',
      grade: '4º Ano',
      teacherId: 'teacher-1',
      studentIds: ['aluno-1', 'aluno-2', 'aluno-3', 'aluno-4'],
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 'class-2',
      name: '5º Ano B',
      grade: '5º Ano',
      teacherId: 'teacher-1',
      studentIds: [],
      createdAt: now,
      updatedAt: now,
    },
  ] as any[]);

  // 9. Missions - Daily, Weekly, Epic
  const tomorrow = new Date(); tomorrow.setDate(tomorrow.getDate() + 1);
  const nextWeek = new Date(); nextWeek.setDate(nextWeek.getDate() + 7);
  const nextMonth = new Date(); nextMonth.setDate(nextMonth.getDate() + 30);

  await db.missions.bulkAdd([
    // === DAILY ===
    {
      id: 'mission-daily-1',
      type: 'daily',
      title: 'Estudante Dedicado',
      description: 'Complete 1 atividade hoje para garantir seus pontos diários.',
      targetCount: 1,
      rewardXp: 50,
      rewardCoins: 20,
      expiresAt: tomorrow.toISOString(),
      requiredLevel: 1,
    },
    {
      id: 'mission-daily-2',
      type: 'daily',
      title: 'Mestre das Respostas',
      description: 'Responda 3 questões corretamente hoje.',
      targetCount: 3,
      rewardXp: 80,
      rewardCoins: 30,
      expiresAt: tomorrow.toISOString(),
      requiredLevel: 1,
    },
    {
      id: 'mission-daily-3',
      type: 'daily',
      title: 'Explorador de Trilhas',
      description: 'Visite a página de trilhas e leia sobre uma delas.',
      targetCount: 1,
      rewardXp: 40,
      rewardCoins: 15,
      expiresAt: tomorrow.toISOString(),
      requiredLevel: 1,
    },
    // === WEEKLY ===
    {
      id: 'mission-weekly-1',
      type: 'weekly',
      title: 'Maratonista do Saber',
      description: 'Complete 5 atividades esta semana e suba de nível!',
      targetCount: 5,
      rewardXp: 200,
      rewardCoins: 80,
      expiresAt: nextWeek.toISOString(),
      requiredLevel: 1,
    },
    {
      id: 'mission-weekly-2',
      type: 'weekly',
      title: 'Diário Ativo',
      description: 'Escreva 3 anotações no seu diário de estudos esta semana.',
      targetCount: 3,
      rewardXp: 150,
      rewardCoins: 60,
      expiresAt: nextWeek.toISOString(),
      requiredLevel: 1,
    },
    {
      id: 'mission-weekly-3',
      type: 'weekly',
      title: 'Colecionador de Streak',
      description: 'Mantenha um streak de 5 dias consecutivos de estudo.',
      targetCount: 5,
      rewardXp: 300,
      rewardCoins: 100,
      expiresAt: nextWeek.toISOString(),
      requiredLevel: 2,
    },
    // === EPIC ===
    {
      id: 'mission-epic-1',
      type: 'epic',
      title: 'O Lendário',
      description: 'Complete 20 atividades e prove que você é um verdadeiro mestre!',
      targetCount: 20,
      rewardXp: 1000,
      rewardCoins: 400,
      expiresAt: nextMonth.toISOString(),
      requiredLevel: 3,
    },
    {
      id: 'mission-epic-2',
      type: 'epic',
      title: 'Trilha do Conhecimento',
      description: 'Conclua uma trilha completa de aprendizagem.',
      targetCount: 1,
      rewardXp: 800,
      rewardCoins: 350,
      expiresAt: nextMonth.toISOString(),
      requiredLevel: 2,
    },
    {
      id: 'mission-epic-3',
      type: 'epic',
      title: 'Guardião da Loja',
      description: 'Compre 3 itens diferentes na Loja de Avatar.',
      targetCount: 3,
      rewardXp: 600,
      rewardCoins: 250,
      expiresAt: nextMonth.toISOString(),
      requiredLevel: 1,
    },
  ] as any[]);

  await seedAchievements();
  console.log('Database seeded successfully with premium content.');
}

export async function ensureDefaultItems() {
  const now = new Date().toISOString();
  try {
    const defaultAvatar = await db.avatarCatalog.get('default-student');
    if (!defaultAvatar) {
      await db.avatarCatalog.add({
        id: 'default-student',
        name: 'Capivara Estudante',
        assetUrl: '/avatars/default-impacto.png',
        type: 'avatar',
        rarity: 'comum',
        priceCoins: 0,
        isFree: true,
        isActive: 1,
        sortOrder: 0,
        createdAt: now,
        updatedAt: now
      });
      console.log('Default student avatar registered in catalog.');
    }
  } catch (error) {
    console.error('Error ensuring default items:', error);
  }
}
