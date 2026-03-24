import { supabase } from './supabase';
import { createNotification } from './notificationUtils';

// ============================================================
// 100 ACHIEVEMENT DEFINITIONS
// ============================================================
export const ALL_ACHIEVEMENTS = [
  {
    id: '45730991-4169-4db7-80a0-2243339d103f',
    title: "O Despertar",
    description: "Deu o primeiro passo na sua jornada do conhecimento.",
    icon: "🚀",
    rewardXp: 50,
    rewardCoins: 25,
    category: "geral",
    requiredCount: 1,
    criteria: "login"
  },
  {
    id: '10be7817-f9c7-43f5-8987-27e8833ff79d',
    title: "Código Quebrado",
    description: "Resolveu sua primeira atividade com maestria. O cérebro está aquecendo!",
    icon: "🧠",
    rewardXp: 100,
    rewardCoins: 50,
    category: "atividades",
    requiredCount: 1,
    criteria: "activities_correct"
  },
  {
    id: 'fe6dadec-04af-441b-b528-4a6194267c2e',
    title: "Caçador de Recompensas",
    description: "Acumulou suas primeiras 50 moedas. O cofre está abrindo.",
    icon: "🪙",
    rewardXp: 50,
    rewardCoins: 0,
    category: "moedas",
    requiredCount: 50,
    criteria: "coins"
  },
  {
    id: 'ad4b9143-c732-4b87-a751-e946e5e6bc87',
    title: "Identidade Visual",
    description: "Mostrou quem você é personalizando seu avatar pela primeira vez.",
    icon: "🎭",
    rewardXp: 75,
    rewardCoins: 50,
    category: "avatar",
    requiredCount: 1,
    criteria: "avatar_customized"
  },
  {
    id: '0a1774c6-8732-4ce2-bd8c-99ba0f2a85b1',
    title: "A Chama se Acende",
    description: "Manteve o foco por 2 dias consecutivos. Não deixe a chama apagar!",
    icon: "🔥",
    rewardXp: 80,
    rewardCoins: 40,
    category: "streak",
    requiredCount: 2,
    criteria: "streak"
  },
  {
    id: '5cd69b45-04d8-4c68-b6a6-2d5403332020',
    title: "Para a Posteridade",
    description: "Registrou seu primeiro pensamento no Diário de Estudos.",
    icon: "✍️",
    rewardXp: 60,
    rewardCoins: 30,
    category: "diario",
    requiredCount: 1,
    criteria: "diary_entries"
  },
  {
    id: '09e5e324-e32c-427c-94be-79887da9e44d',
    title: "Desbravador Cósmico",
    description: "Navegou por todos os cantos da plataforma. Mapa liberado!",
    icon: "🗺️",
    rewardXp: 100,
    rewardCoins: 50,
    category: "geral",
    requiredCount: 1,
    criteria: "explorer"
  },
  {
    id: '22635acc-8a09-42ed-8388-26a6b2907119',
    title: "Missão Dada...",
    description: "...é missão cumprida! Seu primeiro objetivo foi alcançado.",
    icon: "🎯",
    rewardXp: 100,
    rewardCoins: 50,
    category: "missoes",
    requiredCount: 1,
    criteria: "missions_completed"
  },
  {
    id: 'be8b2d64-4c62-4f2e-b8a3-c2b122730a73',
    title: "Hábito em Construção",
    description: "Acessou o sistema em 3 dias diferentes. A constância é a chave.",
    icon: "📅",
    rewardXp: 90,
    rewardCoins: 45,
    category: "geral",
    requiredCount: 3,
    criteria: "login_days"
  },
  {
    id: '372874cb-1d31-4cac-8016-12a79a321d75',
    title: "Princípio da Grandeza",
    description: "Ultrapassou a barreira dos 100 XP. Que venham as milhares!",
    icon: "✨",
    rewardXp: 50,
    rewardCoins: 25,
    category: "xp",
    requiredCount: 100,
    criteria: "xp"
  },
  {
    id: 'ba65c066-31e1-4ea4-8926-e325dd4131d4',
    title: "Mente Focada",
    description: "Provou seu valor acertando 5 questões no total.",
    icon: "🎯",
    rewardXp: 100,
    rewardCoins: 50,
    category: "atividades",
    requiredCount: 5,
    criteria: "activities_correct"
  },
  {
    id: 'e4af3003-1010-4cea-ba1b-926c78893cc6',
    title: "Analista de Dados",
    description: "Analisou e resolveu 10 questões com sucesso.",
    icon: "📊",
    rewardXp: 150,
    rewardCoins: 75,
    category: "atividades",
    requiredCount: 10,
    criteria: "activities_correct"
  },
  {
    id: 'ac0e4feb-263d-4f80-96fd-085dc70976d9',
    title: "Lógica Afiada",
    description: "Atingiu a marca de 25 questões resolvidas.",
    icon: "🧩",
    rewardXp: 250,
    rewardCoins: 125,
    category: "atividades",
    requiredCount: 25,
    criteria: "activities_correct"
  },
  {
    id: 'ed1d7df9-f5ad-41f0-a2c3-ecb0d4ea8869',
    title: "Meio Caminho Andado",
    description: "Cinquenta acertos! O conhecimento está se solidificando.",
    icon: "🌟",
    rewardXp: 400,
    rewardCoins: 200,
    category: "atividades",
    requiredCount: 50,
    criteria: "activities_correct"
  },
  {
    id: 'dc77571d-b851-4849-b0ae-f6740b52b079',
    title: "Gênio Centenário",
    description: "Uma centena de acertos. Você domina a arte de resolver problemas.",
    icon: "💯",
    rewardXp: 800,
    rewardCoins: 400,
    category: "atividades",
    requiredCount: 100,
    criteria: "activities_correct"
  },
  {
    id: 'c08c19f3-5266-4353-8448-0bf2fec76e7d',
    title: "Mestre da Lógica",
    description: "Alcançou impressionantes 200 resoluções corretas.",
    icon: "🧙‍♂️",
    rewardXp: 1500,
    rewardCoins: 750,
    category: "atividades",
    requiredCount: 200,
    criteria: "activities_correct"
  },
  {
    id: '0934f3da-da22-4911-b6e7-b663e1193617',
    title: "Entidade Cósmica",
    description: "500 acertos! Sua mente transcendeu os limites do comum.",
    icon: "🌌",
    rewardXp: 3000,
    rewardCoins: 1500,
    category: "atividades",
    requiredCount: 500,
    criteria: "activities_correct"
  },
  {
    id: '369fe993-bf55-498f-8d3c-ff452cdc9f1c',
    title: "Sincronia Perfeita",
    description: "Terminou o dia sem errar absolutamente nada.",
    icon: "⚖️",
    rewardXp: 200,
    rewardCoins: 100,
    category: "atividades",
    requiredCount: 1,
    criteria: "perfect_day"
  },
  {
    id: 'a58fae64-169e-4260-9d95-0a24b7940dc1',
    title: "Pensamento Rápido",
    description: "O tempo voa, mas você é mais rápido: 5 questões em 5 minutos.",
    icon: "⚡",
    rewardXp: 150,
    rewardCoins: 75,
    category: "atividades",
    requiredCount: 1,
    criteria: "speed_run"
  },
  {
    id: '5ae887f2-6bad-4542-bce2-e1f24c58c022',
    title: "O Pitágoras Moderno",
    description: "Resolveu os numerais: 10 acertos magistrais em Matemática.",
    icon: "🧮",
    rewardXp: 200,
    rewardCoins: 100,
    category: "materias",
    requiredCount: 10,
    criteria: "math_correct"
  },
  {
    id: 'd6fada22-23c6-4a0f-b115-f7544d63e2fb',
    title: "Domínio das Palavras",
    description: "Conquistou as letras: 10 acertos impecáveis em Português.",
    icon: "📚",
    rewardXp: 200,
    rewardCoins: 100,
    category: "materias",
    requiredCount: 10,
    criteria: "portuguese_correct"
  },
  {
    id: 'b0e17646-50f3-4be5-b15d-e3217d4a58a4',
    title: "A Química Natural",
    description: "Desvendou o universo: 10 acertos incríveis em Ciências.",
    icon: "🔬",
    rewardXp: 200,
    rewardCoins: 100,
    category: "materias",
    requiredCount: 10,
    criteria: "science_correct"
  },
  {
    id: '9b9212de-9ea9-49f4-8cd5-9f7118127fff',
    title: "A Enciclopédia Viva",
    description: "Dominou o passado: 10 acertos fulminantes em História.",
    icon: "⏳",
    rewardXp: 200,
    rewardCoins: 100,
    category: "materias",
    requiredCount: 10,
    criteria: "history_correct"
  },
  {
    id: '82cb708e-1781-49c4-82a0-4befa0fb1880',
    title: "Cidadão do Mundo",
    description: "Explorou o planeta: 10 acertos perfeitos em Geografia.",
    icon: "🌍",
    rewardXp: 200,
    rewardCoins: 100,
    category: "materias",
    requiredCount: 10,
    criteria: "geography_correct"
  },
  {
    id: '7c07259f-fd4a-4e81-ad82-db97c647be72',
    title: "O Polímata Vencedor",
    description: "Mostrou versatilidade acertando pelo menos 5 matérias distintas.",
    icon: "🧠",
    rewardXp: 400,
    rewardCoins: 200,
    category: "materias",
    requiredCount: 5,
    criteria: "subjects_mastered"
  },
  {
    id: 'aeced6b1-4969-400d-bc1d-30a16644c9bd',
    title: "Primeira Evolução",
    description: "Atingiu o Nível 2. O começo de uma grande transformação.",
    icon: "🌱",
    rewardXp: 100,
    rewardCoins: 50,
    category: "nivel",
    requiredCount: 2,
    criteria: "level"
  },
  {
    id: '57a3ca90-80d5-468c-952e-283ab86ac65d',
    title: "Avanço de Tier",
    description: "Nível 5 alcançado! Você deixou de ser iniciante.",
    icon: "🥉",
    rewardXp: 200,
    rewardCoins: 100,
    category: "nivel",
    requiredCount: 5,
    criteria: "level"
  },
  {
    id: '35c212cf-24e1-4c58-8880-c42485303eed',
    title: "Status de Veterano",
    description: "Nível 10! Seu nome já é conhecido nos corredores virtuais.",
    icon: "🥈",
    rewardXp: 400,
    rewardCoins: 200,
    category: "nivel",
    requiredCount: 10,
    criteria: "level"
  },
  {
    id: '81a6eee4-158b-47af-98d8-654cea24f7ab',
    title: "Potencial Desbloqueado",
    description: "Chegou ao Nível 20! O limite é apenas uma ilusão.",
    icon: "🥇",
    rewardXp: 800,
    rewardCoins: 400,
    category: "nivel",
    requiredCount: 20,
    criteria: "level"
  },
  {
    id: '72672a34-f3f6-4fb0-a393-181965c957cc',
    title: "Centelha Mágica",
    description: "Acumulou 500 pontos de experiência no total. Rumo ao topo!",
    icon: "💫",
    rewardXp: 150,
    rewardCoins: 75,
    category: "xp",
    requiredCount: 500,
    criteria: "xp"
  },
  {
    id: '7fd17104-c303-4d46-a839-2c52291a4fb8',
    title: "O Primeiro Milênio",
    description: "Cruzar a marca de 1.000 XP exige disciplina forte!",
    icon: "☄️",
    rewardXp: 300,
    rewardCoins: 150,
    category: "xp",
    requiredCount: 1000,
    criteria: "xp"
  },
  {
    id: '56c21fe8-6dd9-4f23-bd9b-7485e749f460',
    title: "Alta Voltagem",
    description: "Alcançou impressionantes 5.000 XP de jornada.",
    icon: "🔥",
    rewardXp: 600,
    rewardCoins: 300,
    category: "xp",
    requiredCount: 5000,
    criteria: "xp"
  },
  {
    id: '25e79cf4-440f-4370-9473-376d548aa568',
    title: "Titã do Conhecimento",
    description: "10.000 XP! Você já é considerado um mestre veterano aqui.",
    icon: "🔮",
    rewardXp: 1200,
    rewardCoins: 600,
    category: "xp",
    requiredCount: 10000,
    criteria: "xp"
  },
  {
    id: '3afb508b-4ee8-4acb-820c-61cc09915633',
    title: "O Supremo",
    description: "50.000 XP! Uma marca épica para pouquíssimos escolhidos.",
    icon: "👑",
    rewardXp: 3000,
    rewardCoins: 1500,
    category: "xp",
    requiredCount: 50000,
    criteria: "xp"
  },
  {
    id: '1301ad7f-54e5-4358-adaf-6d5802efe0c0',
    title: "Ascensão Divina",
    description: "100.000 XP! Seu poder cognitivo é inigualável.",
    icon: "🌌",
    rewardXp: 6000,
    rewardCoins: 3000,
    category: "xp",
    requiredCount: 100000,
    criteria: "xp"
  },
  {
    id: '93f585ea-1b9b-46bf-8a1a-6e74465b15e0',
    title: "Constância Inicial",
    description: "Manteve os estudos em dia durante 3 dias ininterruptos.",
    icon: "⏱️",
    rewardXp: 120,
    rewardCoins: 60,
    category: "streak",
    requiredCount: 3,
    criteria: "streak"
  },
  {
    id: 'e6850d51-5714-489a-a2d4-6784d7cfc484',
    title: "Controle Semanal",
    description: "Uma semana inteira sem falhas. O streak está radiante!",
    icon: "📆",
    rewardXp: 300,
    rewardCoins: 150,
    category: "streak",
    requiredCount: 7,
    criteria: "streak"
  },
  {
    id: 'ea67ac06-e04e-446e-9209-b307a00ab0d7',
    title: "Ritmo Implacável",
    description: "15 dias seguidos. Metade de um mês com foco de titan.",
    icon: "⚡",
    rewardXp: 600,
    rewardCoins: 300,
    category: "streak",
    requiredCount: 15,
    criteria: "streak"
  },
  {
    id: 'ceee665a-223b-4cb0-9af1-ae396d474f33',
    title: "Hábito Cristalizado",
    description: "30 dias de estudos diários! A neuroplasticidade agradece demais.",
    icon: "💎",
    rewardXp: 1200,
    rewardCoins: 600,
    category: "streak",
    requiredCount: 30,
    criteria: "streak"
  },
  {
    id: 'e406d35d-15ab-4b52-909e-b07a03ebd8d4',
    title: "O Inabalável",
    description: "Dois meses construindo uma barreira impenetrável de conhecimento.",
    icon: "🛡️",
    rewardXp: 2500,
    rewardCoins: 1250,
    category: "streak",
    requiredCount: 60,
    criteria: "streak"
  },
  {
    id: '7290fb5d-ba3d-47f7-9f55-fcb25a814fbd',
    title: "Cem Dias Sem Fim",
    description: "Você completou 100 dias seguidos de estudo. Uma lenda viva.",
    icon: "⚔️",
    rewardXp: 5000,
    rewardCoins: 2500,
    category: "streak",
    requiredCount: 100,
    criteria: "streak"
  },
  {
    id: '389d576c-0182-49e8-bb02-5337e5f58e92',
    title: "Alvorada de Ouro",
    description: "O mundo dormia, mas você estava estudando cedo, antes das 8h.",
    icon: "🌅",
    rewardXp: 150,
    rewardCoins: 75,
    category: "streak",
    requiredCount: 1,
    criteria: "early_bird"
  },
  {
    id: '4d1d8bb6-64ad-4bcd-b4ad-901eadaefacf',
    title: "Voo da Coruja",
    description: "O foco reluziu intenso após o pôr do sol. Estudou após as 22h.",
    icon: "🦉",
    rewardXp: 150,
    rewardCoins: 75,
    category: "streak",
    requiredCount: 1,
    criteria: "night_owl"
  },
  {
    id: '681c2dbd-e5bc-4f71-83a6-6dd2cdbefa32',
    title: "Saber Não Tem Folga",
    description: "O fim de semana não freou você. Estudou sábado ou domingo.",
    icon: "🛋️",
    rewardXp: 150,
    rewardCoins: 75,
    category: "streak",
    requiredCount: 1,
    criteria: "weekend_study"
  },
  {
    id: '3e24e086-f350-48a3-ad1c-ba12af66b5ab',
    title: "Maratona Semanal",
    description: "Acessou o app nas últimas 10 semanas seguidas. Que show!",
    icon: "🏃",
    rewardXp: 1000,
    rewardCoins: 500,
    category: "streak",
    requiredCount: 10,
    criteria: "weekly_streak"
  },
  {
    id: '0aaf1cab-e281-40d4-b9a3-fb154f2fa27b',
    title: "Primeiras Caçadas",
    description: "Finalizou 5 missões de letra. Esse é só o aquecimento.",
    icon: "🏹",
    rewardXp: 200,
    rewardCoins: 100,
    category: "missoes",
    requiredCount: 5,
    criteria: "missions_completed"
  },
  {
    id: '45bd6a77-8b41-4213-b739-2c9959eac315',
    title: "O Caçador Experiente",
    description: "Cravou 10 missões completas com destreza inabalável.",
    icon: "🎯",
    rewardXp: 400,
    rewardCoins: 200,
    category: "missoes",
    requiredCount: 10,
    criteria: "missions_completed"
  },
  {
    id: 'ac836c7e-c841-4a4d-ba03-0842608bed81',
    title: "Xeque-Mate",
    description: "Cumpriu 25 missões. Você sabe escolher suas vitórias direitinho.",
    icon: "♟️",
    rewardXp: 800,
    rewardCoins: 400,
    category: "missoes",
    requiredCount: 25,
    criteria: "missions_completed"
  },
  {
    id: '61d30593-64a9-4f91-a5b4-32e8c8681914',
    title: "Mercenário de Ouro",
    description: "Concluiu incríveis 50 missões, com uma taxa de 100% de precisão.",
    icon: "⚔️",
    rewardXp: 1500,
    rewardCoins: 750,
    category: "missoes",
    requiredCount: 50,
    criteria: "missions_completed"
  },
  {
    id: '0172f0e8-f774-4356-b16a-f8e2e91adc2b',
    title: "A Limpa Diária",
    description: "Limpou todas as missões rotineiras em um único dia. Rápido e letal.",
    icon: "☀️",
    rewardXp: 300,
    rewardCoins: 150,
    category: "missoes",
    requiredCount: 1,
    criteria: "all_daily"
  },
  {
    id: '59bdafe2-811c-466d-b2d9-0fd9cc5b8da1',
    title: "Checkmate Semanal",
    description: "Dominou com frieza todos os objetivos semanais oferecidos.",
    icon: "🏅",
    rewardXp: 600,
    rewardCoins: 300,
    category: "missoes",
    requiredCount: 1,
    criteria: "all_weekly"
  },
  {
    id: '91b10dc5-6149-43f5-b871-27d35b0281ae',
    title: "A Glória Épica",
    description: "Você ousou fazer o improvável: completou sua primeira missão Épica!",
    icon: "🌋",
    rewardXp: 1000,
    rewardCoins: 500,
    category: "missoes",
    requiredCount: 1,
    criteria: "epic_mission"
  },
  {
    id: 'ac763ff4-2c0c-49dc-bdd5-31949e7cbd03',
    title: "Veloz como o Vento",
    description: "Não deu tempo nem de piscar. Completou uma missão em 1 hora ou menos.",
    icon: "🏎️",
    rewardXp: 200,
    rewardCoins: 100,
    category: "missoes",
    requiredCount: 1,
    criteria: "speed_mission"
  },
  {
    id: '0b32f872-a7f0-4d8c-bd1c-9891347ee1b2',
    title: "Visão Empreendedora",
    description: "Não perdeu a chance e fez questão de coletar o bônus Extra da rotina.",
    icon: "🎁",
    rewardXp: 150,
    rewardCoins: 75,
    category: "missoes",
    requiredCount: 1,
    criteria: "streak_bonus"
  },
  {
    id: 'de73c2c5-bccf-4950-a106-fcdec86ad084',
    title: "Lendário de Classe S",
    description: "Um verdadeiro mestre irrefutável com 100 missões fechadas.",
    icon: "🦸",
    rewardXp: 3000,
    rewardCoins: 1500,
    category: "missoes",
    requiredCount: 100,
    criteria: "missions_completed"
  },
  {
    id: '830ccff0-7194-4510-a98d-e4bf925425d0',
    title: "O Primeiro Luxo",
    description: "Gastou moedas com classe pela primeira vez na Loja de Estilos.",
    icon: "🛍️",
    rewardXp: 120,
    rewardCoins: 0,
    category: "loja",
    requiredCount: 1,
    criteria: "items_purchased"
  },
  {
    id: '3a284dc7-e215-4cd1-b0a1-85cb200c2389',
    title: "Guarda-Roupa Premium",
    description: "Juntou 5 itens exclusivos e únicos na sua coleção.",
    icon: "👕",
    rewardXp: 200,
    rewardCoins: 100,
    category: "loja",
    requiredCount: 5,
    criteria: "items_owned"
  },
  {
    id: '7614a7c1-295d-4586-adbc-804c1e191280',
    title: "Museu Pessoal",
    description: "Guarda com muito cuidado 20 relíquias gloriosas em seu acervo.",
    icon: "💎",
    rewardXp: 600,
    rewardCoins: 300,
    category: "loja",
    requiredCount: 20,
    criteria: "items_owned"
  },
  {
    id: 'a0497a37-8af5-49c5-a52b-61c4fc152d2b',
    title: "Obra de Arte",
    description: "Montou o traje inteiro impecavelmente (corpo, fundo e moldura).",
    icon: "🎨",
    rewardXp: 200,
    rewardCoins: 100,
    category: "avatar",
    requiredCount: 1,
    criteria: "full_avatar"
  },
  {
    id: '953a1452-e18c-4019-80f5-673b45dd47c6',
    title: "Grafite Digital",
    description: "Sujou ou embelezou o avatar colando 4 stickers malucos de uma vez.",
    icon: "🤪",
    rewardXp: 150,
    rewardCoins: 75,
    category: "avatar",
    requiredCount: 4,
    criteria: "stickers_equipped"
  },
  {
    id: '03a80c1c-c267-40b1-adf2-c74b390afe5a',
    title: "Dono do Shoppping",
    description: "Distribuiu felicidade gastando 500 preciosas moedas na economia local.",
    icon: "💳",
    rewardXp: 300,
    rewardCoins: 0,
    category: "loja",
    requiredCount: 500,
    criteria: "coins_spent"
  },
  {
    id: '7ef3e4ba-296a-411c-9ce5-0ea266e1f416',
    title: "Riqueza Contida",
    description: "Poupou incrivelmente 1.000 moedas ao mesmo tempo. Forte mental.",
    icon: "🐷",
    rewardXp: 400,
    rewardCoins: 0,
    category: "moedas",
    requiredCount: 1000,
    criteria: "coins"
  },
  {
    id: 'd7bc1185-3493-449b-aa5d-75027822e538',
    title: "Gosto Elevado",
    description: "O simples não basta. Adquiriu algo de extrema raridade na Loja.",
    icon: "🍷",
    rewardXp: 400,
    rewardCoins: 0,
    category: "loja",
    requiredCount: 1,
    criteria: "rare_item"
  },
  {
    id: '7211d954-9f03-44d9-97d9-ed8c7577c5b7',
    title: "Cintilante",
    description: "Vestiu um item absurdamente Lendário para o mundo escolar interagir.",
    icon: "🌟",
    rewardXp: 1000,
    rewardCoins: 0,
    category: "avatar",
    requiredCount: 1,
    criteria: "legendary_item"
  },
  {
    id: '63c08485-fcf0-4eac-a845-6e784ea52045',
    title: "Banker",
    description: "Acumulou nada menos que 3.000 moedas em caixa. Que dinheirama!",
    icon: "🏦",
    rewardXp: 1000,
    rewardCoins: 0,
    category: "moedas",
    requiredCount: 3000,
    criteria: "coins"
  },
  {
    id: '969a2cb8-4bdb-4d89-88e4-cee526a9af85',
    title: "No Topo da Pirâmide",
    description: "Desbancou a concorrência e bateu os pés firme no Top 10 da Tabela.",
    icon: "🏔️",
    rewardXp: 300,
    rewardCoins: 150,
    category: "ranking",
    requiredCount: 10,
    criteria: "ranking_position"
  },
  {
    id: '33f70c54-632a-4cd7-88a0-687b14ce2226',
    title: "A Divindade Ameaçada",
    description: "Entrou com tudo nos TOP 5. Acima de você só os invictos.",
    icon: "🎩",
    rewardXp: 500,
    rewardCoins: 250,
    category: "ranking",
    requiredCount: 5,
    criteria: "ranking_position"
  },
  {
    id: '1c77b7e5-a625-4758-8031-a8b2c3d0f57b',
    title: "Trono Incontestado",
    description: "Sentou majestosamente no 1º LUGAR do Ranking. A lenda vive.",
    icon: "👑",
    rewardXp: 1000,
    rewardCoins: 500,
    category: "ranking",
    requiredCount: 1,
    criteria: "ranking_first"
  },
  {
    id: '32c6ff49-7a6b-4842-b72f-d283472d87d4',
    title: "A Jornada do Herói",
    description: "Fez o check-in glorioso na sua PRIMEIRA Trilha de Inteligência.",
    icon: "🛤️",
    rewardXp: 150,
    rewardCoins: 75,
    category: "trilhas",
    requiredCount: 1,
    criteria: "paths_started"
  },
  {
    id: 'af3d3636-0b88-4aa1-bbba-b2b9c48f2e61',
    title: "Trilha Desbravada",
    description: "O sangue e o suor valeram a pena: concluiu a primeira Trilha Inteira.",
    icon: "🏁",
    rewardXp: 500,
    rewardCoins: 250,
    category: "trilhas",
    requiredCount: 1,
    criteria: "paths_completed"
  },
  {
    id: 'df849397-956a-4466-bd98-917b0be74ffd',
    title: "Sediou o Conhecimento",
    description: "Devastou o conteúdo de 3 trilhas como um tornado intelectual.",
    icon: "🎓",
    rewardXp: 1200,
    rewardCoins: 600,
    category: "trilhas",
    requiredCount: 3,
    criteria: "paths_completed"
  },
  {
    id: '853de86a-f3a8-43f3-a6ec-a7c98f285da7',
    title: "Viajante Sideral",
    description: "Navegou até a borda e esmagou 5 Trilhas no seu radar.",
    icon: "🛸",
    rewardXp: 2000,
    rewardCoins: 1000,
    category: "trilhas",
    requiredCount: 5,
    criteria: "paths_completed"
  },
  {
    id: '8e027ce3-64ac-4cb1-9f7b-f81fbc572bf2',
    title: "Magia dos Livros",
    description: "Teve coragem e abriu as portas empoeiradas da Biblioteca pelo item local.",
    icon: "📚",
    rewardXp: 100,
    rewardCoins: 50,
    category: "biblioteca",
    requiredCount: 1,
    criteria: "library_accessed"
  },
  {
    id: '12a97712-a5ba-4855-ae35-0b02102656f3',
    title: "Doutorando Virtual",
    description: "Caiu de cabeça no acervo absorvendo brilhantemente 10 itens.",
    icon: "🐀",
    rewardXp: 200,
    rewardCoins: 100,
    category: "biblioteca",
    requiredCount: 10,
    criteria: "library_accessed"
  },
  {
    id: '08883eec-b8b3-4aa3-a744-d3ae6d1863a0',
    title: "Pacto da IA",
    description: "Fez sua primeiríssima conversa profunda com o Tutor Robótico IA.",
    icon: "🤖",
    rewardXp: 150,
    rewardCoins: 75,
    category: "tutor",
    requiredCount: 1,
    criteria: "tutor_questions"
  },
  {
    id: '7ffeb3c5-eb7c-4988-8056-07086fdf87d6',
    title: "Diário Pessoal",
    description: "Escreveu do fundo da alma 5 anotações únicas sobre os estudos.",
    icon: "📓",
    rewardXp: 150,
    rewardCoins: 75,
    category: "diario",
    requiredCount: 5,
    criteria: "diary_entries"
  },
  {
    id: '82a20f7e-0a20-43e6-85b2-9522977cc8c2',
    title: "O Poeta Noturno",
    description: "Transcreveu incríveis 20 pensamentos em momentos de extremo foco.",
    icon: "🖋️",
    rewardXp: 400,
    rewardCoins: 200,
    category: "diario",
    requiredCount: 20,
    criteria: "diary_entries"
  },
  {
    id: '58333543-b2d2-461d-9f75-ddf0cfc2b454',
    title: "Livro do Mestre",
    description: "Atingiu a grandiosa marca de 50 registros. Uma história de vida.",
    icon: "📖",
    rewardXp: 1000,
    rewardCoins: 500,
    category: "diario",
    requiredCount: 50,
    criteria: "diary_entries"
  },
  {
    id: '26ceeaf0-017d-4efa-bf6d-bd9f88301eae',
    title: "Intersecção Humano-Máquina",
    description: "Permitiu que o Tutor de IA registrasse o momento mágico por você.",
    icon: "🧠",
    rewardXp: 200,
    rewardCoins: 100,
    category: "diario",
    requiredCount: 1,
    criteria: "diary_ai_entry"
  },
  {
    id: '1d5dbff4-226d-47e3-9db1-d3f35cf0e6d2',
    title: "Cérebro Arquivista",
    description: "Organizou tudo etiquetando e criando tags 5 vezes.",
    icon: "🗂️",
    rewardXp: 150,
    rewardCoins: 75,
    category: "diario",
    requiredCount: 5,
    criteria: "diary_tags"
  },
  {
    id: '5dd68f3d-221b-4f62-b8c1-c5008a4c5884',
    title: "Sniper de Precisão",
    description: "Zerou uma prova acertando os alvos sem um único deslize sequer (100%).",
    icon: "✅",
    rewardXp: 400,
    rewardCoins: 200,
    category: "especial",
    requiredCount: 1,
    criteria: "perfect_day"
  },
  {
    id: '95a149d4-3d88-4b37-87bc-90207299b8de',
    title: "Foco Laser Absoluto",
    description: "Permaneceu ativo lutando pelas questões por DUAS longas horas diretas.",
    icon: "🔋",
    rewardXp: 300,
    rewardCoins: 150,
    category: "especial",
    requiredCount: 1,
    criteria: "long_session"
  },
  {
    id: 'c4404e67-cc48-408b-8ca5-764cf4046e35',
    title: "Efeito Borboleta",
    description: "Dominou de vez o lugar, assumindo as vagas superiores (Top 3) na semana.",
    icon: "🦋",
    rewardXp: 600,
    rewardCoins: 300,
    category: "ranking",
    requiredCount: 1,
    criteria: "weekly_top3"
  },
  {
    id: '6153b79a-50a5-410e-bc50-8584efe78929',
    title: "Feixe de Partículas",
    description: "Rebeldia: estourou todas as esferas e bateu missão Diária, Semanal e Épica juntas.",
    icon: "⚡",
    rewardXp: 800,
    rewardCoins: 400,
    category: "missoes",
    requiredCount: 1,
    criteria: "all_mission_types"
  },
  {
    id: '9efcd475-eaed-44b1-8570-d0b363a01791',
    title: "O Pioneiro",
    description: "Acordou antes de todo mundo e estudou de cabeça fresca em primeiro de janeiro.",
    icon: "🎆",
    rewardXp: 200,
    rewardCoins: 100,
    category: "especial",
    requiredCount: 1,
    criteria: "new_year"
  },
  {
    id: '0152939f-2473-466f-98e5-32c348eab265',
    title: "O Festeiro VIP",
    description: "Compareceu com classe na data festiva que marcou o início da Plataforma.",
    icon: "🎂",
    rewardXp: 500,
    rewardCoins: 250,
    category: "especial",
    requiredCount: 1,
    criteria: "platform_birthday"
  },
  {
    id: '48d69fd9-dd42-412f-af69-6f4341291565',
    title: "Filósofo Inquisidor",
    description: "Debateu a existência com nossa máquina formulando 50 requisições insanas.",
    icon: "🎙️",
    rewardXp: 600,
    rewardCoins: 300,
    category: "tutor",
    requiredCount: 50,
    criteria: "tutor_questions"
  },
  {
    id: '901e2aee-b500-43fc-9136-a2b3cbc43ae4',
    title: "Neuralink Humano",
    description: "Desestabilizou a bateria do Tutor, superando inacreditáveis 200 questões.",
    icon: "💾",
    rewardXp: 1200,
    rewardCoins: 600,
    category: "tutor",
    requiredCount: 200,
    criteria: "tutor_questions"
  },
  {
    id: 'e6a0cd46-ec30-4dad-9833-352267828705',
    title: "Translação Solar Completa",
    description: "Concluiu um ciclo de 1 ano inteiro de plataforma registrada.",
    icon: "🌞",
    rewardXp: 2000,
    rewardCoins: 1000,
    category: "especial",
    requiredCount: 365,
    criteria: "days_registered"
  },
  {
    id: 'c12f20a4-f720-43d1-b0ee-0b28384b1451',
    title: "Oráculo da Equação",
    description: "Esmagou com peso bélico os cadernos resolvendo 50 enigmas de matemática.",
    icon: "📐",
    rewardXp: 800,
    rewardCoins: 400,
    category: "materias",
    requiredCount: 50,
    criteria: "math_correct"
  },
  {
    id: 'f65adc8e-41d9-4d92-8e22-3dc6eea303c4',
    title: "Escriba Ancestral",
    description: "Brindou o vocabulário arrematando majestosas 50 soluções em Línguas.",
    icon: "✒️",
    rewardXp: 800,
    rewardCoins: 400,
    category: "materias",
    requiredCount: 50,
    criteria: "portuguese_correct"
  },
  {
    id: '705cf49d-9123-492a-860c-9406a5bf588d',
    title: "O Físico Quântico",
    description: "Evaporou o que restava do senso comum resolvendo 50 questões biológicas/exatas.",
    icon: "🧪",
    rewardXp: 800,
    rewardCoins: 400,
    category: "materias",
    requiredCount: 50,
    criteria: "science_correct"
  },
  {
    id: '5b3cadd9-923f-419d-8445-615b28d2bca3',
    title: "Imperador Romano",
    description: "Tomou para si as linhas do passado com 50 acertos avassaladores em História.",
    icon: "🏛️",
    rewardXp: 800,
    rewardCoins: 400,
    category: "materias",
    requiredCount: 50,
    criteria: "history_correct"
  },
  {
    id: '8552b760-4058-4e62-8e61-10f65be71596',
    title: "Efeito Bússola",
    description: "Cruzou as fronteiras desbravadoras de 50 acertos formidáveis em Geografia.",
    icon: "📍",
    rewardXp: 800,
    rewardCoins: 400,
    category: "materias",
    requiredCount: 50,
    criteria: "geography_correct"
  },
  {
    id: 'f7537df8-954f-44da-85b3-8681f2d5269c',
    title: "Herdeiro do Status",
    description: "Sua conta alcançou o esplendor inigualável do Nível 50! A lenda foi proclamada.",
    icon: "💥",
    rewardXp: 2000,
    rewardCoins: 1000,
    category: "nivel",
    requiredCount: 50,
    criteria: "level"
  },
  {
    id: '9bfa69e1-529f-4e16-a282-8491f770c88d',
    title: "O Último Chefão",
    description: "Rompeu todos os selos alcançando o teto da estratosfera com as honras de NÍVEL 100.",
    icon: "👑",
    rewardXp: 10000,
    rewardCoins: 5000,
    category: "nivel",
    requiredCount: 100,
    criteria: "level"
  },
  {
    id: '941ebc58-4067-4656-95ec-5c42865c4e1c',
    title: "A Estação",
    description: "Marcou a rocha com dedicação imortal, ficando 180 dias engajado brutalmente ao app.",
    icon: "🌊",
    rewardXp: 1500,
    rewardCoins: 750,
    category: "especial",
    requiredCount: 180,
    criteria: "days_registered"
  },
  {
    id: 'a54cc63e-fd2e-49d8-a840-9d806d8ca27b',
    title: "A Última Fantasia",
    description: "Quebrou a parede entre o mito e a realidade: Encontrou o easter egg secreto da Loja.",
    icon: "🔑",
    rewardXp: 500,
    rewardCoins: 250,
    category: "especial",
    requiredCount: 1,
    criteria: "secret_button"
  },
  {
    id: '662e78c3-b3b3-495c-b401-5189f27c262d',
    title: "O Fim das Trilhas",
    description: "Devorou 10 coleções massivas de Trilhas de aprendizado e não deixou pedras.",
    icon: "🧗",
    rewardXp: 4000,
    rewardCoins: 2000,
    category: "trilhas",
    requiredCount: 10,
    criteria: "paths_completed"
  },
  {
    id: '25dfbdfc-2e41-4a2d-a0bc-9c4be484a458',
    title: "IMPACTO ABSOLUTO",
    description: "O EVENTO CANÔNICO! DESTRAVOU AS 99 FAIXAS! SEU NOME É IMORTAL NA PLATAFORMA.",
    icon: "🏆",
    rewardXp: 25000,
    rewardCoins: 10000,
    category: "supremo",
    requiredCount: 99,
    criteria: "all_achievements"
  },

  // ── Duelos ──────────────────────────────────────────────────────────────
  {
    id: 'a1b2c3d4-e5f6-7890-abcd-ef1234567801',
    title: "Primeiro Sangue",
    description: "Entrou na arena e completou seu primeiro duelo. A batalha começou!",
    icon: "⚔️",
    rewardXp: 100,
    rewardCoins: 50,
    category: "duelos",
    requiredCount: 1,
    criteria: "duel_completed"
  },
  {
    id: 'a1b2c3d4-e5f6-7890-abcd-ef1234567802',
    title: "Gladiador em Ascensão",
    description: "Sobreviveu a 5 duelos na arena do conhecimento. Respeito conquistado!",
    icon: "🛡️",
    rewardXp: 250,
    rewardCoins: 125,
    category: "duelos",
    requiredCount: 5,
    criteria: "duel_completed"
  },
  {
    id: 'a1b2c3d4-e5f6-7890-abcd-ef1234567803',
    title: "Coliseu Pessoal",
    description: "20 duelos disputados. Seu nome já ressoa nos corredores da arena!",
    icon: "🏟️",
    rewardXp: 600,
    rewardCoins: 300,
    category: "duelos",
    requiredCount: 20,
    criteria: "duel_completed"
  },
  {
    id: 'a1b2c3d4-e5f6-7890-abcd-ef1234567804',
    title: "Veterano da Arena",
    description: "50 batalhas de conhecimento disputadas. Um guerreiro forjado no fogo!",
    icon: "🔱",
    rewardXp: 1500,
    rewardCoins: 750,
    category: "duelos",
    requiredCount: 50,
    criteria: "duel_completed"
  },
  {
    id: 'a1b2c3d4-e5f6-7890-abcd-ef1234567805',
    title: "Primeira Vitória",
    description: "Derrotou um adversário e provou seu valor intelectual!",
    icon: "🥊",
    rewardXp: 150,
    rewardCoins: 75,
    category: "duelos",
    requiredCount: 1,
    criteria: "duel_wins"
  },
  {
    id: 'a1b2c3d4-e5f6-7890-abcd-ef1234567806',
    title: "Caçador de Crânios",
    description: "10 vitórias nos duelos. Seu raciocínio é uma arma afiada!",
    icon: "💀",
    rewardXp: 400,
    rewardCoins: 200,
    category: "duelos",
    requiredCount: 10,
    criteria: "duel_wins"
  },
  {
    id: 'a1b2c3d4-e5f6-7890-abcd-ef1234567807',
    title: "Mestre dos Duelos",
    description: "25 vitórias consecutivas. Poucos ousam te desafiar na plataforma!",
    icon: "👑",
    rewardXp: 1000,
    rewardCoins: 500,
    category: "duelos",
    requiredCount: 25,
    criteria: "duel_wins"
  },
  {
    id: 'a1b2c3d4-e5f6-7890-abcd-ef1234567808',
    title: "Imperador da Arena",
    description: "50 vitórias! Seu trono no topo da arena é inabalável. Lenda viva!",
    icon: "🌋",
    rewardXp: 2500,
    rewardCoins: 1250,
    category: "duelos",
    requiredCount: 50,
    criteria: "duel_wins"
  }
];

// ============================================================
// MISSION TEMPLATES (for auto-generation)
// ============================================================
const DAILY_TEMPLATES = [
  // Ação e Duelos
  { title: 'Primeiro Sangue', description: 'Complete 1 épico Duelo do Dia.', targetCount: 1, rewardXp: 80, rewardCoins: 40, criteria: 'duel_completed' },
  { title: 'Arena de Titãs', description: 'Desafie seus colegas e complete 3 Duelos.', targetCount: 3, rewardXp: 150, rewardCoins: 80, criteria: 'duel_completed' },

  // Atividades e Resoluções
  { title: 'Despertar Neuronal', description: 'Conclua a sua primeira atividade hoje. O cérebro agradece!', targetCount: 1, rewardXp: 50, rewardCoins: 25, criteria: 'activity_completed' },
  { title: 'Foco de Laser', description: 'Complete 3 atividades hoje e mantenha a concentração.', targetCount: 3, rewardXp: 120, rewardCoins: 60, criteria: 'activity_completed' },
  { title: 'Mira Certeira', description: 'Acerte 5 questões hoje. Sem margem para erros!', targetCount: 5, rewardXp: 100, rewardCoins: 50, criteria: 'question_correct' },
  { title: 'Chuva de Acertos', description: 'Acerte 10 questões hoje. Mostre com quem eles estão lidando!', targetCount: 10, rewardXp: 200, rewardCoins: 100, criteria: 'question_correct' },
  
  // Trilhas
  { title: 'Primeiro Passo', description: 'Inicie ou retome uma trilha de aprendizagem.', targetCount: 1, rewardXp: 60, rewardCoins: 30, criteria: 'path_started' },
  { title: 'Mestre Construtor', description: 'Finalize uma trilha de aprendizagem. Trabalho concluído!', targetCount: 1, rewardXp: 300, rewardCoins: 150, criteria: 'path_completed' },

  // Ferramentas da Plataforma
  { title: 'Registros do Sábio', description: 'Grave seus pensamentos com uma anotação no Meu Diário.', targetCount: 1, rewardXp: 45, rewardCoins: 20, criteria: 'diary_entry' },
  { title: 'Curiosidade Artificial', description: 'Faça uma pergunta intrigante ao Tutor IA.', targetCount: 1, rewardXp: 40, rewardCoins: 20, criteria: 'tutor_question' },
  { title: 'Interrogatório Cibernético', description: 'Troque no mínimo 5 ideias/perguntas com o Tutor IA.', targetCount: 5, rewardXp: 120, rewardCoins: 60, criteria: 'tutor_question' },
  { title: 'Rato de Biblioteca', description: 'Consulte os arquivos lendários da Biblioteca.', targetCount: 1, rewardXp: 35, rewardCoins: 15, criteria: 'library_access' },
  { title: 'Sede de Leitura', description: 'Acesse 3 diferentes conteúdos da Biblioteca.', targetCount: 3, rewardXp: 80, rewardCoins: 40, criteria: 'library_access' },

  // Social e Perfil
  { title: 'O Pioneiro', description: 'Acesse a plataforma hoje e marque sua presença.', targetCount: 1, rewardXp: 30, rewardCoins: 15, criteria: 'login' },
  { title: 'Em Chamas', description: 'Mantenha sua ofensiva (streak) acesa hoje.', targetCount: 1, rewardXp: 50, rewardCoins: 30, criteria: 'streak' },
  { title: 'Vitrine de Luxo', description: 'Dê uma olhada na Loja de Avatar para ver as novidades.', targetCount: 1, rewardXp: 25, rewardCoins: 15, criteria: 'store_visit' },
  { title: 'Investigador de Status', description: 'Marque território visualizando a página de Ranking.', targetCount: 1, rewardXp: 25, rewardCoins: 10, criteria: 'ranking_visit' },
  { title: 'Estilista Diário', description: 'Mude a aparência do seu avatar. Vista-se para o sucesso!', targetCount: 1, rewardXp: 60, rewardCoins: 40, criteria: 'avatar_customized' },
];

const WEEKLY_TEMPLATES = [
  // Ação e Duelos
  { title: 'Gladiador Cibernético', description: 'Participe de 7 duelos esta semana.', targetCount: 7, rewardXp: 400, rewardCoins: 200, criteria: 'duel_completed' },
  { title: 'Torneio dos Campeões', description: 'Mostre seu valor provando a força em 15 combates de Duelo.', targetCount: 15, rewardXp: 800, rewardCoins: 400, criteria: 'duel_completed' },

  // Atividades e Resoluções
  { title: 'Maratona Intelectual', description: 'Complete 10 atividades nesta semana.', targetCount: 10, rewardXp: 300, rewardCoins: 150, criteria: 'activity_completed' },
  { title: 'Atleta do Conhecimento', description: 'Um verdadeiro treino mental: 25 atividades completadas.', targetCount: 25, rewardXp: 600, rewardCoins: 300, criteria: 'activity_completed' },
  { title: 'Caçador de Acertos', description: 'Chegue a marca de 30 questões corretas nesta semana.', targetCount: 30, rewardXp: 350, rewardCoins: 180, criteria: 'question_correct' },
  { title: 'O Mestre da Precisão', description: 'Seja letal com o conhecimento: 75 questões corretas.', targetCount: 75, rewardXp: 750, rewardCoins: 380, criteria: 'question_correct' },

  // Trilhas
  { title: 'Engenheiro de Trilhas', description: 'Inicie ou retome 3 trilhas diferentes.', targetCount: 3, rewardXp: 200, rewardCoins: 100, criteria: 'path_started' },
  { title: 'O Desbravador', description: 'Complete totalmente 2 Trilhas de Aprendizagem.', targetCount: 2, rewardXp: 800, rewardCoins: 400, criteria: 'path_completed' },

  // Ferramentas da Plataforma
  { title: 'As Crônicas', description: 'Escreva 5 relatos ou resumos no Meu Diário.', targetCount: 5, rewardXp: 250, rewardCoins: 100, criteria: 'diary_entry' },
  { title: 'Especulador de Tecnologias', description: 'Faça 15 perguntas densas ao Tutor IA durante a semana.', targetCount: 15, rewardXp: 350, rewardCoins: 180, criteria: 'tutor_question' },
  { title: 'Conselheiro de Inteligência', description: 'O Tutor IA é seu melhor amigo: 30 perguntas feitas.', targetCount: 30, rewardXp: 600, rewardCoins: 300, criteria: 'tutor_question' },
  { title: 'Bibliotecário Chefe', description: 'Explore a biblioteca com 10 leituras de recursos.', targetCount: 10, rewardXp: 300, rewardCoins: 150, criteria: 'library_access' },

  // Social e Perfil
  { title: 'O Sobrevivente', description: 'Mantenha sua ofensiva ininterrupta (streak) por 5 dias.', targetCount: 5, rewardXp: 300, rewardCoins: 150, criteria: 'streak' },
  { title: 'Semana Dourada', description: 'O ápice da disciplina: faça login os 7 dias da semana.', targetCount: 7, rewardXp: 500, rewardCoins: 250, criteria: 'login' },
  { title: 'Espectador do Topo', description: 'Analise e observe o Ranking 5 vezes na semana.', targetCount: 5, rewardXp: 100, rewardCoins: 50, criteria: 'ranking_visit' },
  { title: 'Investidor Fashion', description: 'Visite a Loja de Avatares em 4 dias distintos.', targetCount: 4, rewardXp: 120, rewardCoins: 60, criteria: 'store_visit' },
  { title: 'Camaleão Semanal', description: 'Mude de visual e personalize o avatar 3 vezes na semana.', targetCount: 3, rewardXp: 180, rewardCoins: 90, criteria: 'avatar_customized' },
];

const EPIC_TEMPLATES = [
  // Ação e Duelos
  { title: 'Lenda do Coliseu', description: 'Prove ser indestrutível completando 40 duelos no mês.', targetCount: 40, rewardXp: 1500, rewardCoins: 800, criteria: 'duel_completed' },
  { title: 'A Fúria dos Deuses', description: 'Consolide seu império com incriveis 100 duelos finalizados!', targetCount: 100, rewardXp: 4000, rewardCoins: 2000, criteria: 'duel_completed' },

  // Atividades e Resoluções
  { title: 'O Sábio Produtivo', description: 'Finalize impressionantes 50 atividades este mês.', targetCount: 50, rewardXp: 2000, rewardCoins: 1000, criteria: 'activity_completed' },
  { title: 'Mente Imparável', description: 'A jornada do infinito: 120 atividades concluídas.', targetCount: 120, rewardXp: 5000, rewardCoins: 2500, criteria: 'activity_completed' },
  { title: 'Acumulador de Fortunas', description: 'Acertos em massa: Chegue à marca de 250 questões corretas.', targetCount: 250, rewardXp: 2500, rewardCoins: 1200, criteria: 'question_correct' },
  { title: 'Entidade Triunfal', description: 'Mestre da precisão mensal: 600 questões corretas no mês!', targetCount: 600, rewardXp: 7000, rewardCoins: 3500, criteria: 'question_correct' },

  // Trilhas
  { title: 'Filósofo dos Caminhos', description: 'Adquira conhecimento completo em 5 Trilhas.', targetCount: 5, rewardXp: 3000, rewardCoins: 1500, criteria: 'path_completed' },
  { title: 'A Bússola Dourada', description: 'O desbravador mestre de 10 Trilhas de Aprendizagem mensais.', targetCount: 10, rewardXp: 8000, rewardCoins: 4000, criteria: 'path_completed' },

  // Ferramentas da Plataforma
  { title: 'O Cronista Histórico', description: 'Trabalho de historiador: 20 registros épicos no Diário.', targetCount: 20, rewardXp: 1000, rewardCoins: 500, criteria: 'diary_entry' },
  { title: 'Conversa Infinita', description: 'Faça 100 interações avançadas e perguntas ao Tutor IA.', targetCount: 100, rewardXp: 1500, rewardCoins: 800, criteria: 'tutor_question' },
  { title: 'Simbiose Cibernética', description: 'Você e a inteligência artificial são um só: 300 interações com o Tutor IA.', targetCount: 300, rewardXp: 4000, rewardCoins: 2000, criteria: 'tutor_question' },
  { title: 'A Grande Biblioteca de Alexandria', description: 'Mergulho profundo: acesse 50 recursos literários.', targetCount: 50, rewardXp: 2000, rewardCoins: 1000, criteria: 'library_access' },

  // Social e Perfil
  { title: 'Determinação Intocável', description: 'Não escorregue, mantenha sua ofensiva por 15 dias corridos.', targetCount: 15, rewardXp: 1500, rewardCoins: 800, criteria: 'streak' },
  { title: 'O Mito Onipresente', description: 'Esteve presente e manteve a chama (streak) viva por 30 dias inteiros!', targetCount: 30, rewardXp: 5000, rewardCoins: 3000, criteria: 'streak' },
  { title: 'Magnata Fashionista', description: 'Vire cliente premium acessando a Loja de Avatares 20 vezes.', targetCount: 20, rewardXp: 800, rewardCoins: 400, criteria: 'store_visit' },
  { title: 'Metamorfose Divina', description: 'Altere seu avatar minuciosamente 15 vezes no mês.', targetCount: 15, rewardXp: 1200, rewardCoins: 600, criteria: 'avatar_customized' },
  { title: 'Olho de Rapina', description: 'Observe o ranking subindo de perto 20 vezes este mês.', targetCount: 20, rewardXp: 500, rewardCoins: 250, criteria: 'ranking_visit' },
];


// ============================================================
// SEED ACHIEVEMENTS INTO DATABASE
// ============================================================
export async function seedAchievements() {
  const total = ALL_ACHIEVEMENTS.length;
  const { data: existing } = await supabase.from('achievements').select('id');
  if (existing && existing.length === total) {
    // DB already has the exact same count as our definitions — skip re-seed
    return;
  }
  if (existing && existing.length > 0) {
    console.log(`[GameSeeder] Found ${existing.length} achievements in DB but definitions have ${total}. Wiping for clean re-seed...`);
    await supabase.from('achievements').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  }

  const toUpsert = ALL_ACHIEVEMENTS.map(ach => ({
    id: ach.id,
    title: ach.title,
    description: ach.description,
    icon: ach.icon,
    condition: ach.criteria,
    rewardXp: ach.rewardXp,
    rewardCoins: ach.rewardCoins
  }));

  const { error } = await supabase.from('achievements').upsert(toUpsert);
  if (error) {
    console.error('[GameSeeder] Fail to seed achievements', error);
  } else {
    console.log('[GameSeeder] Seeded 100 achievements.');
  }
}

// ============================================================
// AUTO-GENERATE MISSIONS (daily/weekly/epic refresh)
// ============================================================

function pickRandom<T>(arr: T[], n: number): T[] {
  const shuffled = [...arr].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, n);
}

// Module-level lock: prevents parallel/double calls (React StrictMode + multiple callers)
let _missionsUpdatePromise: Promise<void> | null = null;

export async function ensureMissionsAreUpToDate() {
  if (_missionsUpdatePromise) return _missionsUpdatePromise;
  _missionsUpdatePromise = _runMissionsUpdate().finally(() => { _missionsUpdatePromise = null; });
  return _missionsUpdatePromise;
}

async function _runMissionsUpdate() {
  const now = new Date();

  // Fetch all missions
  const { data: allMissionsObj } = await supabase.from('missions').select('*');
  const allMissions = allMissionsObj || [];

  const expired = allMissions.filter(m => m.expiresAt && new Date(m.expiresAt) < now);
  if (expired.length > 0) {
    await supabase.from('missions').delete().in('id', expired.map(m => m.id));
  }

  // Check what types still exist
  const { data: remainingObj } = await supabase.from('missions').select('*');
  const remaining = remainingObj || [];

  // CLEANUP: Remove duplicates or obsolete missions
  const titlesSeen = new Set<string>();
  const validTitles = new Set([...DAILY_TEMPLATES, ...WEEKLY_TEMPLATES, ...EPIC_TEMPLATES].map(t => t.title));
  
  const toDelete = [];
  const toKeep = [];

  for (const m of remaining) {
    if (titlesSeen.has(m.title) || !validTitles.has(m.title) || m.criteria === 'activity_feedback') {
      toDelete.push(m.id);
    } else {
      titlesSeen.add(m.title);
      toKeep.push(m);
    }
  }

  if (toDelete.length > 0) {
    await supabase.from('missions').delete().in('id', toDelete);
    await supabase.from('student_missions').delete().in('missionId', toDelete);
  }

  // Fix existing missions that might be missing 'criteria'
  for (const m of toKeep) {
    if (!m.criteria) {
      const template = [...DAILY_TEMPLATES, ...WEEKLY_TEMPLATES, ...EPIC_TEMPLATES].find(t => t.title === m.title);
      if (template) {
        await supabase.from('missions').update({ criteria: (template as any).criteria }).eq('id', m.id);
        m.criteria = (template as any).criteria;
      }
    }
  }

  const cleanedRemaining = toKeep;

  const dailyMissions = cleanedRemaining.filter(m => m.type === 'daily');
  const weeklyMissions = cleanedRemaining.filter(m => m.type === 'weekly');
  const epicMissions = cleanedRemaining.filter(m => m.type === 'epic');

  const tomorrow = new Date(now);
  tomorrow.setDate(now.getDate() + 1);
  tomorrow.setHours(4, 0, 0, 0); // reset at 4am

  const nextMonday = new Date(now);
  nextMonday.setDate(now.getDate() + (8 - now.getDay()) % 7 || 7);
  nextMonday.setHours(4, 0, 0, 0);

  const nextMonthFirst = new Date(now.getFullYear(), now.getMonth() + 1, 1, 4, 0, 0, 0);

  // Helper to add missing missions
  const topUpMissions = async (
    currentMissions: any[], 
    templates: any[], 
    type: 'daily' | 'weekly' | 'epic', 
    targetCount: number,
    expiry: string
  ) => {
    if (currentMissions.length < targetCount) {
      const toAdd = targetCount - currentMissions.length;
      const existingTitles = new Set(currentMissions.map(m => m.title));
      const availableTemplates = templates.filter(t => !existingTitles.has(t.title));
      const picks = pickRandom(availableTemplates.length > 0 ? availableTemplates : templates, toAdd);
      
      const inserts = [];
      for (let i = 0; i < picks.length; i++) {
        const t = picks[i];
        inserts.push({
          type,
          title: t.title,
          description: t.description,
          targetCount: t.targetCount,
          rewardXp: t.rewardXp,
          rewardCoins: t.rewardCoins,
          criteria: t.criteria,
          expiresAt: expiry,
          requiredLevel: 1,
        });
      }
      if (inserts.length > 0) {
        await supabase.from('missions').insert(inserts);
        console.log(`[GameSeeder] Added ${inserts.length} new ${type} missions.`);
      }
    }
  };

  await topUpMissions(dailyMissions, DAILY_TEMPLATES, 'daily', 6, tomorrow.toISOString());
  await topUpMissions(weeklyMissions, WEEKLY_TEMPLATES, 'weekly', 6, nextMonday.toISOString());
  await topUpMissions(epicMissions, EPIC_TEMPLATES, 'epic', 6, nextMonthFirst.toISOString());
}

// ============================================================
// UNLOCK ACHIEVEMENTS FOR STUDENT
// ============================================================
export async function checkAndUnlockAchievements(studentId: string) {
  if (!studentId) return;

  const { data: statsObj } = await supabase
    .from('gamification_stats')
    .select('*')
    .eq('id', studentId)
    .single();
  if (!statsObj) return;
  const stats = statsObj;

  const { data: allAchsObj } = await supabase.from('achievements').select('*');
  const allAchs = allAchsObj || [];

  const { data: unlockedObj } = await supabase
    .from('student_achievements')
    .select('achievementId')
    .eq('studentId', studentId);
  const unlocked = unlockedObj || [];
  const unlockedIds = new Set(unlocked.map(u => u.achievementId));
  const alreadyUnlockedCount = unlocked.length;

  // ── Batch fetch all extra counts in parallel ────────────────────────────────
  const [
    actRes, misRes, invRes, pathStartRes, pathCompRes,
    diaryRes, diaryAiRes, duelCompRes, duelWinRes, userRes,
  ] = await Promise.all([
    supabase.from('student_activity_results')
      .select('id', { count: 'exact', head: true })
      .eq('studentId', studentId).eq('status', 'passed'),
    supabase.from('student_missions')
      .select('id', { count: 'exact', head: true })
      .eq('studentId', studentId).not('claimedAt', 'is', null),
    supabase.from('student_owned_avatars')
      .select('id', { count: 'exact', head: true })
      .eq('studentId', studentId),
    supabase.from('student_progress')
      .select('id', { count: 'exact', head: true })
      .eq('studentId', studentId),
    supabase.from('student_progress')
      .select('id', { count: 'exact', head: true })
      .eq('studentId', studentId).eq('status', 'completed'),
    supabase.from('diary_entries')
      .select('id', { count: 'exact', head: true })
      .eq('studentId', studentId),
    supabase.from('diary_entries')
      .select('id', { count: 'exact', head: true })
      .eq('studentId', studentId).eq('isAIGenerated', true),
    supabase.from('duels')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'completed')
      .or(`challengerId.eq.${studentId},challengedId.eq.${studentId}`),
    supabase.from('duels')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'completed')
      .eq('winnerId', studentId),
    supabase.from('users')
      .select('createdAt')
      .eq('id', studentId)
      .single(),
  ]);

  const counts = {
    activitiesCorrect: actRes.count ?? 0,
    missionsCompleted: misRes.count ?? 0,
    itemsOwned: invRes.count ?? 0,
    pathsStarted: pathStartRes.count ?? 0,
    pathsCompleted: pathCompRes.count ?? 0,
    diaryEntries: diaryRes.count ?? 0,
    diaryAiEntries: diaryAiRes.count ?? 0,
    duelCompleted: duelCompRes.count ?? 0,
    duelWins: duelWinRes.count ?? 0,
    daysRegistered: userRes.data?.createdAt
      ? Math.floor((Date.now() - new Date(userRes.data.createdAt).getTime()) / 86400000)
      : 0,
  };

  const getCurrentCount = (criteria: string): number => {
    switch (criteria) {
      case 'xp':                return stats.xp;
      case 'coins':             return stats.coins;
      case 'level':             return stats.level;
      case 'streak':            return stats.streak;
      case 'login':             return 1;
      case 'login_days':        return counts.daysRegistered;
      case 'days_registered':   return counts.daysRegistered;
      case 'activities_correct': return counts.activitiesCorrect;
      case 'math_correct':      return counts.activitiesCorrect;
      case 'portuguese_correct':return counts.activitiesCorrect;
      case 'science_correct':   return counts.activitiesCorrect;
      case 'history_correct':   return counts.activitiesCorrect;
      case 'geography_correct': return counts.activitiesCorrect;
      case 'subjects_mastered': return Math.min(5, Math.floor(counts.activitiesCorrect / 10));
      case 'missions_completed':return counts.missionsCompleted;
      case 'all_daily':         return counts.missionsCompleted > 0 ? 1 : 0;
      case 'all_weekly':        return counts.missionsCompleted > 0 ? 1 : 0;
      case 'epic_mission':      return counts.missionsCompleted > 0 ? 1 : 0;
      case 'items_owned':       return counts.itemsOwned;
      case 'items_purchased':   return counts.itemsOwned > 0 ? 1 : 0;
      case 'avatar_customized': return counts.itemsOwned > 0 ? 1 : 0;
      case 'full_avatar':       return counts.itemsOwned >= 3 ? 1 : 0;
      case 'stickers_equipped': return Math.min(counts.itemsOwned, 4);
      case 'paths_started':     return counts.pathsStarted;
      case 'paths_completed':   return counts.pathsCompleted;
      case 'diary_entries':     return counts.diaryEntries;
      case 'diary_ai_entry':    return counts.diaryAiEntries > 0 ? 1 : 0;
      case 'diary_tags':        return counts.diaryEntries;
      case 'duel_completed':    return counts.duelCompleted;
      case 'duel_wins':         return counts.duelWins;
      case 'all_achievements':  return alreadyUnlockedCount;
      case 'coins_spent':       return Math.max(0, (stats.xp * 2) - stats.coins);
      // Event-driven: unlocked at activity time, not computable here
      default:                  return 0;
    }
  };

  const toUnlock: { achievementId: string; unlockedAt: string }[] = [];

  for (const ach of allAchs) {
    if (unlockedIds.has(ach.id)) continue;
    const template = ALL_ACHIEVEMENTS.find(a => a.id === ach.id || a.title === ach.title);
    if (!template) continue;
    const current = getCurrentCount(template.criteria);
    if (current >= template.requiredCount) {
      toUnlock.push({ achievementId: ach.id, unlockedAt: new Date().toISOString() });
    }
  }

  if (toUnlock.length === 0) return;

  const inserts = toUnlock.map(item => ({
    studentId,
    achievementId: item.achievementId,
    unlockedAt: item.unlockedAt,
  }));
  await supabase.from('student_achievements').insert(inserts);
  console.log(`[GameSeeder] Unlocked ${toUnlock.length} achievements for ${studentId}`);

  // Notify student for each unlocked achievement
  for (const item of toUnlock) {
    const def = allAchs.find((a: any) => a.id === item.achievementId) as any;
    if (def) {
      // Fire-and-forget — don't await so unlock loop doesn't slow down
      createNotification({
        userId: studentId,
        role: 'student',
        title: `Conquista Desbloqueada! ${def.icon || '🏆'}`,
        message: `Você conquistou "${def.title}" e ganhou ${def.rewardXp || 0} XP!`,
        type: 'reward',
        priority: 'high',
        actionUrl: '/student/achievements',
        skipMirroring: false,
      }).catch(() => {});
    }
  }

  let bonusXp = 0;
  let bonusCoins = 0;
  for (const item of toUnlock) {
    const def = allAchs.find((a: any) => a.id === item.achievementId) as any;
    if (def) {
      bonusXp += def.rewardXp || 0;
      bonusCoins += def.rewardCoins || 0;
    }
  }
  if (bonusXp > 0 || bonusCoins > 0) {
    await supabase.from('gamification_stats').update({
      xp: stats.xp + bonusXp,
      coins: stats.coins + bonusCoins,
    }).eq('id', studentId);
  }
}
export async function ensureTestStudents(_userId?: string) {
  // Disabled as per user request to clear all demo data
  console.log('Automated test student generation is disabled.');
}
