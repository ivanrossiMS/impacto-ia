const fs = require('fs');
const filepath = 'c:/Users/ivanr/OneDrive/Área de Trabalho/IMPACTO-IA/src/lib/gameSeeder.ts';
let content = fs.readFileSync(filepath, 'utf-8');

const achievements = [
  { id: 'ach-001', title: 'O Despertar', description: 'Deu o primeiro passo na sua jornada do conhecimento.', icon: '🚀', rewardXp: 50, rewardCoins: 25, category: 'geral', requiredCount: 1, criteria: 'login' },
  { id: 'ach-002', title: 'Código Quebrado', description: 'Resolveu sua primeira atividade com maestria. O cérebro está aquecendo!', icon: '🧠', rewardXp: 100, rewardCoins: 50, category: 'atividades', requiredCount: 1, criteria: 'activities_correct' },
  { id: 'ach-003', title: 'Caçador de Recompensas', description: 'Acumulou suas primeiras 50 moedas. O cofre está abrindo.', icon: '🪙', rewardXp: 50, rewardCoins: 0, category: 'moedas', requiredCount: 50, criteria: 'coins' },
  { id: 'ach-004', title: 'Identidade Visual', description: 'Mostrou quem você é personalizando seu avatar pela primeira vez.', icon: '🎭', rewardXp: 75, rewardCoins: 50, category: 'avatar', requiredCount: 1, criteria: 'avatar_customized' },
  { id: 'ach-005', title: 'A Chama se Acende', description: 'Manteve o foco por 2 dias consecutivos. Não deixe a chama apagar!', icon: '🔥', rewardXp: 80, rewardCoins: 40, category: 'streak', requiredCount: 2, criteria: 'streak' },
  { id: 'ach-006', title: 'Para a Posteridade', description: 'Registrou seu primeiro pensamento no Diário de Estudos.', icon: '✍️', rewardXp: 60, rewardCoins: 30, category: 'diario', requiredCount: 1, criteria: 'diary_entries' },
  { id: 'ach-007', title: 'Desbravador Cósmico', description: 'Navegou por todos os cantos da plataforma. Mapa liberado!', icon: '🗺️', rewardXp: 100, rewardCoins: 50, category: 'geral', requiredCount: 1, criteria: 'explorer' },
  { id: 'ach-008', title: 'Missão Dada...', description: '...é missão cumprida! Seu primeiro objetivo foi alcançado.', icon: '🎯', rewardXp: 100, rewardCoins: 50, category: 'missoes', requiredCount: 1, criteria: 'missions_completed' },
  { id: 'ach-009', title: 'Hábito em Construção', description: 'Acessou o sistema em 3 dias diferentes. A constância é a chave.', icon: '📅', rewardXp: 90, rewardCoins: 45, category: 'geral', requiredCount: 3, criteria: 'login_days' },
  { id: 'ach-010', title: 'Princípio da Grandeza', description: 'Ultrapassou a barreira dos 100 XP. Que venham as milhares!', icon: '✨', rewardXp: 50, rewardCoins: 25, category: 'xp', requiredCount: 100, criteria: 'xp' },

  { id: 'ach-011', title: 'Mente Focada', description: 'Provou seu valor acertando 5 questões no total.', icon: '🎯', rewardXp: 100, rewardCoins: 50, category: 'atividades', requiredCount: 5, criteria: 'activities_correct' },
  { id: 'ach-012', title: 'Analista de Dados', description: 'Analisou e resolveu 10 questões com sucesso.', icon: '📊', rewardXp: 150, rewardCoins: 75, category: 'atividades', requiredCount: 10, criteria: 'activities_correct' },
  { id: 'ach-013', title: 'Lógica Afiada', description: 'Atingiu a marca de 25 questões resolvidas.', icon: '🧩', rewardXp: 250, rewardCoins: 125, category: 'atividades', requiredCount: 25, criteria: 'activities_correct' },
  { id: 'ach-014', title: 'Meio Caminho Andado', description: 'Cinquenta acertos! O conhecimento está se solidificando.', icon: '🌟', rewardXp: 400, rewardCoins: 200, category: 'atividades', requiredCount: 50, criteria: 'activities_correct' },
  { id: 'ach-015', title: 'Gênio Centenário', description: 'Uma centena de acertos. Você domina a arte de resolver problemas.', icon: '💯', rewardXp: 800, rewardCoins: 400, category: 'atividades', requiredCount: 100, criteria: 'activities_correct' },
  { id: 'ach-016', title: 'Mestre da Lógica', description: 'Alcançou impressionantes 200 resoluções corretas.', icon: '🧙‍♂️', rewardXp: 1500, rewardCoins: 750, category: 'atividades', requiredCount: 200, criteria: 'activities_correct' },
  { id: 'ach-017', title: 'Entidade Cósmica', description: '500 acertos! Sua mente transcendeu os limites do comum.', icon: '🌌', rewardXp: 3000, rewardCoins: 1500, category: 'atividades', requiredCount: 500, criteria: 'activities_correct' },
  { id: 'ach-018', title: 'Sincronia Perfeita', description: 'Terminou o dia sem errar absolutamente nada.', icon: '⚖️', rewardXp: 200, rewardCoins: 100, category: 'atividades', requiredCount: 1, criteria: 'perfect_day' },
  { id: 'ach-019', title: 'Pensamento Rápido', description: 'O tempo voa, mas você é mais rápido: 5 questões em 5 minutos.', icon: '⚡', rewardXp: 150, rewardCoins: 75, category: 'atividades', requiredCount: 1, criteria: 'speed_run' },
  { id: 'ach-020', title: 'O Pitágoras Moderno', description: 'Resolveu os numerais: 10 acertos magistrais em Matemática.', icon: '🧮', rewardXp: 200, rewardCoins: 100, category: 'materias', requiredCount: 10, criteria: 'math_correct' },
  { id: 'ach-021', title: 'Domínio das Palavras', description: 'Conquistou as letras: 10 acertos impecáveis em Português.', icon: '📚', rewardXp: 200, rewardCoins: 100, category: 'materias', requiredCount: 10, criteria: 'portuguese_correct' },
  { id: 'ach-022', title: 'A Química Natural', description: 'Desvendou o universo: 10 acertos incríveis em Ciências.', icon: '🔬', rewardXp: 200, rewardCoins: 100, category: 'materias', requiredCount: 10, criteria: 'science_correct' },
  { id: 'ach-023', title: 'A Enciclopédia Viva', description: 'Dominou o passado: 10 acertos fulminantes em História.', icon: '⏳', rewardXp: 200, rewardCoins: 100, category: 'materias', requiredCount: 10, criteria: 'history_correct' },
  { id: 'ach-024', title: 'Cidadão do Mundo', description: 'Explorou o planeta: 10 acertos perfeitos em Geografia.', icon: '🌍', rewardXp: 200, rewardCoins: 100, category: 'materias', requiredCount: 10, criteria: 'geography_correct' },
  { id: 'ach-025', title: 'O Polímata Vencedor', description: 'Mostrou versatilidade acertando pelo menos 5 matérias distintas.', icon: '🧠', rewardXp: 400, rewardCoins: 200, category: 'materias', requiredCount: 5, criteria: 'subjects_mastered' },

  { id: 'ach-026', title: 'Primeira Evolução', description: 'Atingiu o Nível 2. O começo de uma grande transformação.', icon: '🌱', rewardXp: 100, rewardCoins: 50, category: 'nivel', requiredCount: 2, criteria: 'level' },
  { id: 'ach-027', title: 'Avanço de Tier', description: 'Nível 5 alcançado! Você deixou de ser iniciante.', icon: '🥉', rewardXp: 200, rewardCoins: 100, category: 'nivel', requiredCount: 5, criteria: 'level' },
  { id: 'ach-028', title: 'Status de Veterano', description: 'Nível 10! Seu nome já é conhecido nos corredores virtuais.', icon: '🥈', rewardXp: 400, rewardCoins: 200, category: 'nivel', requiredCount: 10, criteria: 'level' },
  { id: 'ach-029', title: 'Potencial Desbloqueado', description: 'Chegou ao Nível 20! O limite é apenas uma ilusão.', icon: '🥇', rewardXp: 800, rewardCoins: 400, category: 'nivel', requiredCount: 20, criteria: 'level' },
  { id: 'ach-030', title: 'Centelha Mágica', description: 'Acumulou 500 pontos de experiência no total. Rumo ao topo!', icon: '💫', rewardXp: 150, rewardCoins: 75, category: 'xp', requiredCount: 500, criteria: 'xp' },
  { id: 'ach-031', title: 'O Primeiro Milênio', description: 'Cruzar a marca de 1.000 XP exige disciplina forte!', icon: '☄️', rewardXp: 300, rewardCoins: 150, category: 'xp', requiredCount: 1000, criteria: 'xp' },
  { id: 'ach-032', title: 'Alta Voltagem', description: 'Alcançou impressionantes 5.000 XP de jornada.', icon: '🔥', rewardXp: 600, rewardCoins: 300, category: 'xp', requiredCount: 5000, criteria: 'xp' },
  { id: 'ach-033', title: 'Titã do Conhecimento', description: '10.000 XP! Você já é considerado um mestre veterano aqui.', icon: '🔮', rewardXp: 1200, rewardCoins: 600, category: 'xp', requiredCount: 10000, criteria: 'xp' },
  { id: 'ach-034', title: 'O Supremo', description: '50.000 XP! Uma marca épica para pouquíssimos escolhidos.', icon: '👑', rewardXp: 3000, rewardCoins: 1500, category: 'xp', requiredCount: 50000, criteria: 'xp' },
  { id: 'ach-035', title: 'Ascensão Divina', description: '100.000 XP! Seu poder cognitivo é inigualável.', icon: '🌌', rewardXp: 6000, rewardCoins: 3000, category: 'xp', requiredCount: 100000, criteria: 'xp' },

  { id: 'ach-036', title: 'Constância Inicial', description: 'Manteve os estudos em dia durante 3 dias ininterruptos.', icon: '⏱️', rewardXp: 120, rewardCoins: 60, category: 'streak', requiredCount: 3, criteria: 'streak' },
  { id: 'ach-037', title: 'Controle Semanal', description: 'Uma semana inteira sem falhas. O streak está radiante!', icon: '📆', rewardXp: 300, rewardCoins: 150, category: 'streak', requiredCount: 7, criteria: 'streak' },
  { id: 'ach-038', title: 'Ritmo Implacável', description: '15 dias seguidos. Metade de um mês com foco de titan.', icon: '⚡', rewardXp: 600, rewardCoins: 300, category: 'streak', requiredCount: 15, criteria: 'streak' },
  { id: 'ach-039', title: 'Hábito Cristalizado', description: '30 dias de estudos diários! A neuroplasticidade agradece demais.', icon: '💎', rewardXp: 1200, rewardCoins: 600, category: 'streak', requiredCount: 30, criteria: 'streak' },
  { id: 'ach-040', title: 'O Inabalável', description: 'Dois meses construindo uma barreira impenetrável de conhecimento.', icon: '🛡️', rewardXp: 2500, rewardCoins: 1250, category: 'streak', requiredCount: 60, criteria: 'streak' },
  { id: 'ach-041', title: 'Cem Dias Sem Fim', description: 'Você completou 100 dias seguidos de estudo. Uma lenda viva.', icon: '⚔️', rewardXp: 5000, rewardCoins: 2500, category: 'streak', requiredCount: 100, criteria: 'streak' },
  { id: 'ach-042', title: 'Alvorada de Ouro', description: 'O mundo dormia, mas você estava estudando cedo, antes das 8h.', icon: '🌅', rewardXp: 150, rewardCoins: 75, category: 'streak', requiredCount: 1, criteria: 'early_bird' },
  { id: 'ach-043', title: 'Voo da Coruja', description: 'O foco reluziu intenso após o pôr do sol. Estudou após as 22h.', icon: '🦉', rewardXp: 150, rewardCoins: 75, category: 'streak', requiredCount: 1, criteria: 'night_owl' },
  { id: 'ach-044', title: 'Saber Não Tem Folga', description: 'O fim de semana não freou você. Estudou sábado ou domingo.', icon: '🛋️', rewardXp: 150, rewardCoins: 75, category: 'streak', requiredCount: 1, criteria: 'weekend_study' },
  { id: 'ach-045', title: 'Maratona Semanal', description: 'Acessou o app nas últimas 10 semanas seguidas. Que show!', icon: '🏃', rewardXp: 1000, rewardCoins: 500, category: 'streak', requiredCount: 10, criteria: 'weekly_streak' },

  { id: 'ach-046', title: 'Primeiras Caçadas', description: 'Finalizou 5 missões de letra. Esse é só o aquecimento.', icon: '🏹', rewardXp: 200, rewardCoins: 100, category: 'missoes', requiredCount: 5, criteria: 'missions_completed' },
  { id: 'ach-047', title: 'O Caçador Experiente', description: 'Cravou 10 missões completas com destreza inabalável.', icon: '🎯', rewardXp: 400, rewardCoins: 200, category: 'missoes', requiredCount: 10, criteria: 'missions_completed' },
  { id: 'ach-048', title: 'Xeque-Mate', description: 'Cumpriu 25 missões. Você sabe escolher suas vitórias direitinho.', icon: '♟️', rewardXp: 800, rewardCoins: 400, category: 'missoes', requiredCount: 25, criteria: 'missions_completed' },
  { id: 'ach-049', title: 'Mercenário de Ouro', description: 'Concluiu incríveis 50 missões, com uma taxa de 100% de precisão.', icon: '⚔️', rewardXp: 1500, rewardCoins: 750, category: 'missoes', requiredCount: 50, criteria: 'missions_completed' },
  { id: 'ach-050', title: 'A Limpa Diária', description: 'Limpou todas as missões rotineiras em um único dia. Rápido e letal.', icon: '☀️', rewardXp: 300, rewardCoins: 150, category: 'missoes', requiredCount: 1, criteria: 'all_daily' },
  { id: 'ach-051', title: 'Checkmate Semanal', description: 'Dominou com frieza todos os objetivos semanais oferecidos.', icon: '🏅', rewardXp: 600, rewardCoins: 300, category: 'missoes', requiredCount: 1, criteria: 'all_weekly' },
  { id: 'ach-052', title: 'A Glória Épica', description: 'Você ousou fazer o improvável: completou sua primeira missão Épica!', icon: '🌋', rewardXp: 1000, rewardCoins: 500, category: 'missoes', requiredCount: 1, criteria: 'epic_mission' },
  { id: 'ach-053', title: 'Veloz como o Vento', description: 'Não deu tempo nem de piscar. Completou uma missão em 1 hora ou menos.', icon: '🏎️', rewardXp: 200, rewardCoins: 100, category: 'missoes', requiredCount: 1, criteria: 'speed_mission' },
  { id: 'ach-054', title: 'Visão Empreendedora', description: 'Não perdeu a chance e fez questão de coletar o bônus Extra da rotina.', icon: '🎁', rewardXp: 150, rewardCoins: 75, category: 'missoes', requiredCount: 1, criteria: 'streak_bonus' },
  { id: 'ach-055', title: 'Lendário de Classe S', description: 'Um verdadeiro mestre irrefutável com 100 missões fechadas.', icon: '🦸', rewardXp: 3000, rewardCoins: 1500, category: 'missoes', requiredCount: 100, criteria: 'missions_completed' },

  { id: 'ach-056', title: 'O Primeiro Luxo', description: 'Gastou moedas com classe pela primeira vez na Loja de Estilos.', icon: '🛍️', rewardXp: 120, rewardCoins: 0, category: 'loja', requiredCount: 1, criteria: 'items_purchased' },
  { id: 'ach-057', title: 'Guarda-Roupa Premium', description: 'Juntou 5 itens exclusivos e únicos na sua coleção.', icon: '👕', rewardXp: 200, rewardCoins: 100, category: 'loja', requiredCount: 5, criteria: 'items_owned' },
  { id: 'ach-058', title: 'Museu Pessoal', description: 'Guarda com muito cuidado 20 relíquias gloriosas em seu acervo.', icon: '💎', rewardXp: 600, rewardCoins: 300, category: 'loja', requiredCount: 20, criteria: 'items_owned' },
  { id: 'ach-059', title: 'Obra de Arte', description: 'Montou o traje inteiro impecavelmente (corpo, fundo e moldura).', icon: '🎨', rewardXp: 200, rewardCoins: 100, category: 'avatar', requiredCount: 1, criteria: 'full_avatar' },
  { id: 'ach-060', title: 'Grafite Digital', description: 'Sujou ou embelezou o avatar colando 4 stickers malucos de uma vez.', icon: '🤪', rewardXp: 150, rewardCoins: 75, category: 'avatar', requiredCount: 4, criteria: 'stickers_equipped' },
  { id: 'ach-061', title: 'Dono do Shoppping', description: 'Distribuiu felicidade gastando 500 preciosas moedas na economia local.', icon: '💳', rewardXp: 300, rewardCoins: 0, category: 'loja', requiredCount: 500, criteria: 'coins_spent' },
  { id: 'ach-062', title: 'Riqueza Contida', description: 'Poupou incrivelmente 1.000 moedas ao mesmo tempo. Forte mental.', icon: '🐷', rewardXp: 400, rewardCoins: 0, category: 'moedas', requiredCount: 1000, criteria: 'coins' },
  { id: 'ach-063', title: 'Gosto Elevado', description: 'O simples não basta. Adquiriu algo de extrema raridade na Loja.', icon: '🍷', rewardXp: 400, rewardCoins: 0, category: 'loja', requiredCount: 1, criteria: 'rare_item' },
  { id: 'ach-064', title: 'Cintilante', description: 'Vestiu um item absurdamente Lendário para o mundo escolar interagir.', icon: '🌟', rewardXp: 1000, rewardCoins: 0, category: 'avatar', requiredCount: 1, criteria: 'legendary_item' },
  { id: 'ach-065', title: 'Banker', description: 'Acumulou nada menos que 3.000 moedas em caixa. Que dinheirama!', icon: '🏦', rewardXp: 1000, rewardCoins: 0, category: 'moedas', requiredCount: 3000, criteria: 'coins' },

  { id: 'ach-066', title: 'No Topo da Pirâmide', description: 'Desbancou a concorrência e bateu os pés firme no Top 10 da Tabela.', icon: '🏔️', rewardXp: 300, rewardCoins: 150, category: 'ranking', requiredCount: 10, criteria: 'ranking_position' },
  { id: 'ach-067', title: 'A Divindade Ameaçada', description: 'Entrou com tudo nos TOP 5. Acima de você só os invictos.', icon: '🎩', rewardXp: 500, rewardCoins: 250, category: 'ranking', requiredCount: 5, criteria: 'ranking_position' },
  { id: 'ach-068', title: 'Trono Incontestado', description: 'Sentou majestosamente no 1º LUGAR do Ranking. A lenda vive.', icon: '👑', rewardXp: 1000, rewardCoins: 500, category: 'ranking', requiredCount: 1, criteria: 'ranking_first' },
  { id: 'ach-069', title: 'A Jornada do Herói', description: 'Fez o check-in glorioso na sua PRIMEIRA Trilha de Inteligência.', icon: '🛤️', rewardXp: 150, rewardCoins: 75, category: 'trilhas', requiredCount: 1, criteria: 'paths_started' },
  { id: 'ach-070', title: 'Trilha Desbravada', description: 'O sangue e o suor valeram a pena: concluiu a primeira Trilha Inteira.', icon: '🏁', rewardXp: 500, rewardCoins: 250, category: 'trilhas', requiredCount: 1, criteria: 'paths_completed' },
  { id: 'ach-071', title: 'Sediou o Conhecimento', description: 'Devastou o conteúdo de 3 trilhas como um tornado intelectual.', icon: '🎓', rewardXp: 1200, rewardCoins: 600, category: 'trilhas', requiredCount: 3, criteria: 'paths_completed' },
  { id: 'ach-072', title: 'Viajante Sideral', description: 'Navegou até a borda e esmagou 5 Trilhas no seu radar.', icon: '🛸', rewardXp: 2000, rewardCoins: 1000, category: 'trilhas', requiredCount: 5, criteria: 'paths_completed' },
  { id: 'ach-073', title: 'Magia dos Livros', description: 'Teve coragem e abriu as portas empoeiradas da Biblioteca pelo item local.', icon: '📚', rewardXp: 100, rewardCoins: 50, category: 'biblioteca', requiredCount: 1, criteria: 'library_accessed' },
  { id: 'ach-074', title: 'Doutorando Virtual', description: 'Caiu de cabeça no acervo absorvendo brilhantemente 10 itens.', icon: '🐀', rewardXp: 200, rewardCoins: 100, category: 'biblioteca', requiredCount: 10, criteria: 'library_accessed' },
  { id: 'ach-075', title: 'Pacto da IA', description: 'Fez sua primeiríssima conversa profunda com o Tutor Robótico IA.', icon: '🤖', rewardXp: 150, rewardCoins: 75, category: 'tutor', requiredCount: 1, criteria: 'tutor_questions' },

  { id: 'ach-076', title: 'Diário Pessoal', description: 'Escreveu do fundo da alma 5 anotações únicas sobre os estudos.', icon: '📓', rewardXp: 150, rewardCoins: 75, category: 'diario', requiredCount: 5, criteria: 'diary_entries' },
  { id: 'ach-077', title: 'O Poeta Noturno', description: 'Transcreveu incríveis 20 pensamentos em momentos de extremo foco.', icon: '🖋️', rewardXp: 400, rewardCoins: 200, category: 'diario', requiredCount: 20, criteria: 'diary_entries' },
  { id: 'ach-078', title: 'Livro do Mestre', description: 'Atingiu a grandiosa marca de 50 registros. Uma história de vida.', icon: '📖', rewardXp: 1000, rewardCoins: 500, category: 'diario', requiredCount: 50, criteria: 'diary_entries' },
  { id: 'ach-079', title: 'Intersecção Humano-Máquina', description: 'Permitiu que o Tutor de IA registrasse o momento mágico por você.', icon: '🧠', rewardXp: 200, rewardCoins: 100, category: 'diario', requiredCount: 1, criteria: 'diary_ai_entry' },
  { id: 'ach-080', title: 'Cérebro Arquivista', description: 'Organizou tudo etiquetando e criando tags 5 vezes.', icon: '🗂️', rewardXp: 150, rewardCoins: 75, category: 'diario', requiredCount: 5, criteria: 'diary_tags' },

  { id: 'ach-081', title: 'Sniper de Precisão', description: 'Zerou uma prova acertando os alvos sem um único deslize sequer (100%).', icon: '✅', rewardXp: 400, rewardCoins: 200, category: 'especial', requiredCount: 1, criteria: 'perfect_day' },
  { id: 'ach-082', title: 'Foco Laser Absoluto', description: 'Permaneceu ativo lutando pelas questões por DUAS longas horas diretas.', icon: '🔋', rewardXp: 300, rewardCoins: 150, category: 'especial', requiredCount: 1, criteria: 'long_session' },
  { id: 'ach-083', title: 'Efeito Borboleta', description: 'Dominou de vez o lugar, assumindo as vagas superiores (Top 3) na semana.', icon: '🦋', rewardXp: 600, rewardCoins: 300, category: 'ranking', requiredCount: 1, criteria: 'weekly_top3' },
  { id: 'ach-084', title: 'Feixe de Partículas', description: 'Rebeldia: estourou todas as esferas e bateu missão Diária, Semanal e Épica juntas.', icon: '⚡', rewardXp: 800, rewardCoins: 400, category: 'missoes', requiredCount: 1, criteria: 'all_mission_types' },
  { id: 'ach-085', title: 'O Pioneiro', description: 'Acordou antes de todo mundo e estudou de cabeça fresca em primeiro de janeiro.', icon: '🎆', rewardXp: 200, rewardCoins: 100, category: 'especial', requiredCount: 1, criteria: 'new_year' },
  { id: 'ach-086', title: 'O Festeiro VIP', description: 'Compareceu com classe na data festiva que marcou o início da Plataforma.', icon: '🎂', rewardXp: 500, rewardCoins: 250, category: 'especial', requiredCount: 1, criteria: 'platform_birthday' },
  { id: 'ach-087', title: 'Filósofo Inquisidor', description: 'Debateu a existência com nossa máquina formulando 50 requisições insanas.', icon: '🎙️', rewardXp: 600, rewardCoins: 300, category: 'tutor', requiredCount: 50, criteria: 'tutor_questions' },
  { id: 'ach-088', title: 'Neuralink Humano', description: 'Desestabilizou a bateria do Tutor, superando inacreditáveis 200 questões.', icon: '💾', rewardXp: 1200, rewardCoins: 600, category: 'tutor', requiredCount: 200, criteria: 'tutor_questions' },
  { id: 'ach-089', title: 'Translação Solar Completa', description: 'Concluiu um ciclo de 1 ano inteiro de plataforma registrada.', icon: '🌞', rewardXp: 2000, rewardCoins: 1000, category: 'especial', requiredCount: 365, criteria: 'days_registered' },
  { id: 'ach-090', title: 'Oráculo da Equação', description: 'Esmagou com peso bélico os cadernos resolvendo 50 enigmas de matemática.', icon: '📐', rewardXp: 800, rewardCoins: 400, category: 'materias', requiredCount: 50, criteria: 'math_correct' },
  { id: 'ach-091', title: 'Escriba Ancestral', description: 'Brindou o vocabulário arrematando majestosas 50 soluções em Línguas.', icon: '✒️', rewardXp: 800, rewardCoins: 400, category: 'materias', requiredCount: 50, criteria: 'portuguese_correct' },
  { id: 'ach-092', title: 'O Físico Quântico', description: 'Evaporou o que restava do senso comum resolvendo 50 questões biológicas/exatas.', icon: '🧪', rewardXp: 800, rewardCoins: 400, category: 'materias', requiredCount: 50, criteria: 'science_correct' },
  { id: 'ach-093', title: 'Imperador Romano', description: 'Tomou para si as linhas do passado com 50 acertos avassaladores em História.', icon: '🏛️', rewardXp: 800, rewardCoins: 400, category: 'materias', requiredCount: 50, criteria: 'history_correct' },
  { id: 'ach-094', title: 'Efeito Bússola', description: 'Cruzou as fronteiras desbravadoras de 50 acertos formidáveis em Geografia.', icon: '📍', rewardXp: 800, rewardCoins: 400, category: 'materias', requiredCount: 50, criteria: 'geography_correct' },
  { id: 'ach-095', title: 'Herdeiro do Status', description: 'Sua conta alcançou o esplendor inigualável do Nível 50! A lenda foi proclamada.', icon: '💥', rewardXp: 2000, rewardCoins: 1000, category: 'nivel', requiredCount: 50, criteria: 'level' },
  { id: 'ach-096', title: 'O Último Chefão', description: 'Rompeu todos os selos alcançando o teto da estratosfera com as honras de NÍVEL 100.', icon: '👑', rewardXp: 10000, rewardCoins: 5000, category: 'nivel', requiredCount: 100, criteria: 'level' },
  { id: 'ach-097', title: 'A Estação', description: 'Marcou a rocha com dedicação imortal, ficando 180 dias engajado brutalmente ao app.', icon: '🌊', rewardXp: 1500, rewardCoins: 750, category: 'especial', requiredCount: 180, criteria: 'days_registered' },
  { id: 'ach-098', title: 'A Última Fantasia', description: 'Quebrou a parede entre o mito e a realidade: Encontrou o easter egg secreto da Loja.', icon: '🔑', rewardXp: 500, rewardCoins: 250, category: 'especial', requiredCount: 1, criteria: 'secret_button' },
  { id: 'ach-099', title: 'O Fim das Trilhas', description: 'Devorou 10 coleções massivas de Trilhas de aprendizado e não deixou pedras.', icon: '🧗', rewardXp: 4000, rewardCoins: 2000, category: 'trilhas', requiredCount: 10, criteria: 'paths_completed' },
  { id: 'ach-100', title: 'IMPACTO ABSOLUTO', description: 'O EVENTO CANÔNICO! DESTRAVOU AS 99 FAIXAS! SEU NOME É IMORTAL NA PLATAFORMA.', icon: '🏆', rewardXp: 25000, rewardCoins: 10000, category: 'supremo', requiredCount: 99, criteria: 'all_achievements' }
];

const startStr = 'export const ALL_ACHIEVEMENTS = [';
const startIndex = content.indexOf(startStr);
if (startIndex !== -1) {
  const endIndex = content.indexOf('];', startIndex);
  if (endIndex !== -1) {
    const jsonStr = JSON.stringify(achievements, null, 2);
    // Remove the quotes around keys for typical TS style if wanted, but valid TS accepts strings.
    // Replace double quotes with single quotes for simple string properties only.
    let prettyStr = jsonStr.replace(/"([^(")"]+)":/g, "$1:"); // remove quotes around keys
    content = content.substring(0, startIndex) + "export const ALL_ACHIEVEMENTS = " + prettyStr + content.substring(endIndex + 1);
    fs.writeFileSync(filepath, content);
    console.log('Script finalizado com sucesso.');
  } else {
    console.log('Fim de array nao achado');
  }
} else {
  console.log('Inicio de array nao achado');
}
