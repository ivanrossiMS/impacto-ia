// Achievement definitions, mission seeds, and auto-mission generation logic
import { db } from './dexie';

// ============================================================
// 100 ACHIEVEMENT DEFINITIONS
// ============================================================
export const ALL_ACHIEVEMENTS = [
  // === PRIMEIROS PASSOS (1-10) ===
  { id: 'ach-001', title: 'Bem-vindo!', description: 'Fez seu primeiro login na plataforma.', icon: '🎉', rewardXp: 20, rewardCoins: 10, category: 'geral', requiredCount: 1, criteria: 'login' },
  { id: 'ach-002', title: 'Completou 1ª Atividade', description: 'Respondeu sua primeira questão corretamente!', icon: '✅', rewardXp: 50, rewardCoins: 20, category: 'atividades', requiredCount: 1, criteria: 'activities_correct' },
  { id: 'ach-003', title: 'Primeiros 100 XP', description: 'Chegou a 100 pontos de experiência.', icon: '⭐', rewardXp: 30, rewardCoins: 15, category: 'xp', requiredCount: 100, criteria: 'xp' },
  { id: 'ach-004', title: 'Primeiras Moedas', description: 'Acumulou suas primeiras 50 moedas.', icon: '🪙', rewardXp: 25, rewardCoins: 0, category: 'moedas', requiredCount: 50, criteria: 'coins' },
  { id: 'ach-005', title: 'Avatar Criado', description: 'Personalizou seu avatar pela primeira vez.', icon: '🎭', rewardXp: 40, rewardCoins: 25, category: 'avatar', requiredCount: 1, criteria: 'avatar_customized' },
  { id: 'ach-006', title: 'Primeiro Streak', description: 'Estudou 2 dias seguidos!', icon: '🔥', rewardXp: 30, rewardCoins: 15, category: 'streak', requiredCount: 2, criteria: 'streak' },
  { id: 'ach-007', title: 'Nota no Diário', description: 'Escreveu sua primeira nota no Meu Diário.', icon: '📓', rewardXp: 35, rewardCoins: 15, category: 'diario', requiredCount: 1, criteria: 'diary_entries' },
  { id: 'ach-008', title: 'Explorador', description: 'Visitou todas as seções da plataforma.', icon: '🗺️', rewardXp: 60, rewardCoins: 30, category: 'geral', requiredCount: 1, criteria: 'explorer' },
  { id: 'ach-009', title: 'Missão Cumprida', description: 'Completou sua primeira missão.', icon: '🎯', rewardXp: 50, rewardCoins: 25, category: 'missoes', requiredCount: 1, criteria: 'missions_completed' },
  { id: 'ach-010', title: 'Estudante de Verdade', description: 'Acessou a plataforma por 3 dias diferentes.', icon: '📚', rewardXp: 45, rewardCoins: 20, category: 'geral', requiredCount: 3, criteria: 'login_days' },

  // === ATIVIDADES (11-25) ===
  { id: 'ach-011', title: '5 Respostas Certas', description: 'Acertou 5 questões no total.', icon: '🎓', rewardXp: 60, rewardCoins: 30, category: 'atividades', requiredCount: 5, criteria: 'activities_correct' },
  { id: 'ach-012', title: '10 Questões Resolvidas', description: 'Respondeu 10 questões.', icon: '📝', rewardXp: 80, rewardCoins: 40, category: 'atividades', requiredCount: 10, criteria: 'activities_correct' },
  { id: 'ach-013', title: '25 Questões Resolvidas', description: 'Respondeu 25 questões com sucesso!', icon: '💪', rewardXp: 120, rewardCoins: 60, category: 'atividades', requiredCount: 25, criteria: 'activities_correct' },
  { id: 'ach-014', title: '50 Questões Resolvidas', description: 'Metade do caminho para 100!', icon: '🌟', rewardXp: 200, rewardCoins: 100, category: 'atividades', requiredCount: 50, criteria: 'activities_correct' },
  { id: 'ach-015', title: 'Centurião', description: 'Respondeu 100 questões ao total!', icon: '🏆', rewardXp: 400, rewardCoins: 200, category: 'atividades', requiredCount: 100, criteria: 'activities_correct' },
  { id: 'ach-016', title: 'Mestre das Atividades', description: 'Completou 200 questões.', icon: '👑', rewardXp: 700, rewardCoins: 350, category: 'atividades', requiredCount: 200, criteria: 'activities_correct' },
  { id: 'ach-017', title: 'Lendário', description: 'Completou 500 questões ao longo da vida!', icon: '🌈', rewardXp: 1500, rewardCoins: 750, category: 'atividades', requiredCount: 500, criteria: 'activities_correct' },
  { id: 'ach-018', title: 'Perfeição Diária', description: 'Acertou todas as questões em um único dia.', icon: '💯', rewardXp: 100, rewardCoins: 50, category: 'atividades', requiredCount: 1, criteria: 'perfect_day' },
  { id: 'ach-019', title: 'Velocidade Relâmpago', description: 'Respondeu 5 questões em menos de 5 minutos.', icon: '⚡', rewardXp: 80, rewardCoins: 40, category: 'atividades', requiredCount: 1, criteria: 'speed_run' },
  { id: 'ach-020', title: 'Mestre Matemático', description: 'Acertou 10 questões de Matemática.', icon: '🔢', rewardXp: 100, rewardCoins: 50, category: 'materias', requiredCount: 10, criteria: 'math_correct' },
  { id: 'ach-021', title: 'Escritor Talentoso', description: 'Acertou 10 questões de Português.', icon: '📖', rewardXp: 100, rewardCoins: 50, category: 'materias', requiredCount: 10, criteria: 'portuguese_correct' },
  { id: 'ach-022', title: 'Cientista Curioso', description: 'Acertou 10 questões de Ciências.', icon: '🔬', rewardXp: 100, rewardCoins: 50, category: 'materias', requiredCount: 10, criteria: 'science_correct' },
  { id: 'ach-023', title: 'Historiador', description: 'Acertou 10 questões de História.', icon: '🏛️', rewardXp: 100, rewardCoins: 50, category: 'materias', requiredCount: 10, criteria: 'history_correct' },
  { id: 'ach-024', title: 'Geógrafo', description: 'Acertou 10 questões de Geografia.', icon: '🌍', rewardXp: 100, rewardCoins: 50, category: 'materias', requiredCount: 10, criteria: 'geography_correct' },
  { id: 'ach-025', title: 'Polímata', description: 'Acertou questões de 5 matérias diferentes.', icon: '🧠', rewardXp: 200, rewardCoins: 100, category: 'materias', requiredCount: 5, criteria: 'subjects_mastered' },

  // === XP & NÍVEL (26-35) ===
  { id: 'ach-026', title: 'Nível 2', description: 'Chegou ao nível 2!', icon: '🔼', rewardXp: 50, rewardCoins: 30, category: 'nivel', requiredCount: 2, criteria: 'level' },
  { id: 'ach-027', title: 'Nível 5', description: 'Chegou ao nível 5!', icon: '⬆️', rewardXp: 100, rewardCoins: 60, category: 'nivel', requiredCount: 5, criteria: 'level' },
  { id: 'ach-028', title: 'Nível 10', description: 'Chegou ao nível 10! Um verdadeiro veterano.', icon: '🌠', rewardXp: 200, rewardCoins: 100, category: 'nivel', requiredCount: 10, criteria: 'level' },
  { id: 'ach-029', title: 'Nível 20', description: 'Chegou ao nível 20! Você é incrível.', icon: '🚀', rewardXp: 400, rewardCoins: 200, category: 'nivel', requiredCount: 20, criteria: 'level' },
  { id: 'ach-030', title: '500 XP', description: 'Acumulou 500 pontos de experiência.', icon: '✨', rewardXp: 60, rewardCoins: 30, category: 'xp', requiredCount: 500, criteria: 'xp' },
  { id: 'ach-031', title: '1.000 XP', description: 'Acumulou 1.000 pontos de experiência!', icon: '⭐', rewardXp: 100, rewardCoins: 50, category: 'xp', requiredCount: 1000, criteria: 'xp' },
  { id: 'ach-032', title: '5.000 XP', description: 'Acumulou 5.000 pontos de experiência!', icon: '🌟', rewardXp: 250, rewardCoins: 125, category: 'xp', requiredCount: 5000, criteria: 'xp' },
  { id: 'ach-033', title: '10.000 XP', description: 'Mestre supremo com 10.000 XP!', icon: '💫', rewardXp: 500, rewardCoins: 250, category: 'xp', requiredCount: 10000, criteria: 'xp' },
  { id: 'ach-034', title: '50.000 XP', description: 'Lenda viva! 50.000 XP acumulados!', icon: '👑', rewardXp: 1500, rewardCoins: 750, category: 'xp', requiredCount: 50000, criteria: 'xp' },
  { id: 'ach-035', title: '100.000 XP', description: 'O maior de todos: 100.000 XP!', icon: '🏆', rewardXp: 3000, rewardCoins: 1500, category: 'xp', requiredCount: 100000, criteria: 'xp' },

  // === STREAK (36-45) ===
  { id: 'ach-036', title: 'Chama Acesa', description: 'Manteve um streak de 3 dias.', icon: '🔥', rewardXp: 60, rewardCoins: 30, category: 'streak', requiredCount: 3, criteria: 'streak' },
  { id: 'ach-037', title: 'Semana Completa', description: 'Estudou 7 dias seguidos!', icon: '📅', rewardXp: 150, rewardCoins: 75, category: 'streak', requiredCount: 7, criteria: 'streak' },
  { id: 'ach-038', title: 'Quinzena de Ouro', description: 'Estudou 15 dias sem parar!', icon: '🥇', rewardXp: 300, rewardCoins: 150, category: 'streak', requiredCount: 15, criteria: 'streak' },
  { id: 'ach-039', title: 'Mês de Dedicação', description: 'Um mês inteiro de estudos consecutivos!', icon: '🗓️', rewardXp: 600, rewardCoins: 300, category: 'streak', requiredCount: 30, criteria: 'streak' },
  { id: 'ach-040', title: '60 Dias Lendário', description: '60 dias consecutivos de estudo!', icon: '🌋', rewardXp: 1200, rewardCoins: 600, category: 'streak', requiredCount: 60, criteria: 'streak' },
  { id: 'ach-041', title: 'Invencível', description: '100 dias de streak! Você é uma lenda!', icon: '⚔️', rewardXp: 2000, rewardCoins: 1000, category: 'streak', requiredCount: 100, criteria: 'streak' },
  { id: 'ach-042', title: 'Madrugador', description: 'Estudou antes das 8h da manhã.', icon: '🌅', rewardXp: 50, rewardCoins: 25, category: 'streak', requiredCount: 1, criteria: 'early_bird' },
  { id: 'ach-043', title: 'Coruja Noturna', description: 'Estudou depois das 22h.', icon: '🦉', rewardXp: 50, rewardCoins: 25, category: 'streak', requiredCount: 1, criteria: 'night_owl' },
  { id: 'ach-044', title: 'Final de Semana', description: 'Estudou em um sábado ou domingo.', icon: '🎮', rewardXp: 60, rewardCoins: 30, category: 'streak', requiredCount: 1, criteria: 'weekend_study' },
  { id: 'ach-045', title: 'Constância Total', description: 'Acessou a plataforma por 10 semanas seguidas.', icon: '📊', rewardXp: 500, rewardCoins: 250, category: 'streak', requiredCount: 10, criteria: 'weekly_streak' },

  // === MISSÕES (46-55) ===
  { id: 'ach-046', title: '5 Missões Completas', description: 'Completou 5 missões ao total.', icon: '🎯', rewardXp: 100, rewardCoins: 50, category: 'missoes', requiredCount: 5, criteria: 'missions_completed' },
  { id: 'ach-047', title: '10 Missões', description: 'Completou 10 missões!', icon: '🏅', rewardXp: 200, rewardCoins: 100, category: 'missoes', requiredCount: 10, criteria: 'missions_completed' },
  { id: 'ach-048', title: '25 Missões', description: 'Um caçador de missões!', icon: '🦸', rewardXp: 400, rewardCoins: 200, category: 'missoes', requiredCount: 25, criteria: 'missions_completed' },
  { id: 'ach-049', title: '50 Missões', description: 'Herói das missões!', icon: '⚡', rewardXp: 700, rewardCoins: 350, category: 'missoes', requiredCount: 50, criteria: 'missions_completed' },
  { id: 'ach-050', title: 'Diário em Dia', description: 'Completou todas as missões diárias em um dia.', icon: '☀️', rewardXp: 120, rewardCoins: 60, category: 'missoes', requiredCount: 1, criteria: 'all_daily' },
  { id: 'ach-051', title: 'Semana Épica', description: 'Completou todas as missões semanais.', icon: '📆', rewardXp: 300, rewardCoins: 150, category: 'missoes', requiredCount: 1, criteria: 'all_weekly' },
  { id: 'ach-052', title: 'Épico Conquistado', description: 'Completou uma missão épica!', icon: '🌌', rewardXp: 500, rewardCoins: 250, category: 'missoes', requiredCount: 1, criteria: 'epic_mission' },
  { id: 'ach-053', title: 'Missão Relâmpago', description: 'Completou uma missão em menos de 1 hora.', icon: '⚡', rewardXp: 80, rewardCoins: 40, category: 'missoes', requiredCount: 1, criteria: 'speed_mission' },
  { id: 'ach-054', title: 'Bônus Streak', description: 'Coletou o bônus de streak pela primeira vez.', icon: '🎁', rewardXp: 60, rewardCoins: 30, category: 'missoes', requiredCount: 1, criteria: 'streak_bonus' },
  { id: 'ach-055', title: 'Mestre das Missões', description: 'Completou 100 missões no total!', icon: '👑', rewardXp: 1500, rewardCoins: 750, category: 'missoes', requiredCount: 100, criteria: 'missions_completed' },

  // === LOJA & AVATAR (56-65) ===
  { id: 'ach-056', title: 'Primeira Compra', description: 'Comprou seu primeiro item na loja!', icon: '🛒', rewardXp: 60, rewardCoins: 0, category: 'loja', requiredCount: 1, criteria: 'items_purchased' },
  { id: 'ach-057', title: 'Colecionador', description: 'Tem 5 itens no seu acervo.', icon: '📦', rewardXp: 100, rewardCoins: 50, category: 'loja', requiredCount: 5, criteria: 'items_owned' },
  { id: 'ach-058', title: 'Colecionador Épico', description: 'Tem 20 itens no seu acervo.', icon: '🗃️', rewardXp: 300, rewardCoins: 150, category: 'loja', requiredCount: 20, criteria: 'items_owned' },
  { id: 'ach-059', title: 'Fashionista', description: 'Equipou um avatar completo (corpo + fundo + borda).', icon: '👗', rewardXp: 100, rewardCoins: 50, category: 'avatar', requiredCount: 1, criteria: 'full_avatar' },
  { id: 'ach-060', title: 'Rei dos Stickers', description: 'Equipou 4 stickers ao mesmo tempo.', icon: '✨', rewardXp: 80, rewardCoins: 40, category: 'avatar', requiredCount: 4, criteria: 'stickers_equipped' },
  { id: 'ach-061', title: 'Gastador Generoso', description: 'Gastou 500 moedas na loja.', icon: '💸', rewardXp: 150, rewardCoins: 0, category: 'loja', requiredCount: 500, criteria: 'coins_spent' },
  { id: 'ach-062', title: 'Milionário', description: 'Acumulou 1000 moedas de uma vez.', icon: '💰', rewardXp: 200, rewardCoins: 0, category: 'moedas', requiredCount: 1000, criteria: 'coins' },
  { id: 'ach-063', title: 'Raridade em Mãos', description: 'Comprou um item raro na loja.', icon: '💎', rewardXp: 200, rewardCoins: 0, category: 'loja', requiredCount: 1, criteria: 'rare_item' },
  { id: 'ach-064', title: 'Lendário Equipado', description: 'Tem um item lendário no avatar.', icon: '🌟', rewardXp: 500, rewardCoins: 0, category: 'avatar', requiredCount: 1, criteria: 'legendary_item' },
  { id: 'ach-065', title: '3.000 Moedas', description: 'Acumulou 3.000 moedas!', icon: '🏦', rewardXp: 400, rewardCoins: 0, category: 'moedas', requiredCount: 3000, criteria: 'coins' },

  // === RANKING & SOCIAL (66-75) ===
  { id: 'ach-066', title: 'Top 10 da Turma', description: 'Entrou no TOP 10 do ranking da turma.', icon: '📊', rewardXp: 150, rewardCoins: 75, category: 'ranking', requiredCount: 10, criteria: 'ranking_position' },
  { id: 'ach-067', title: 'TOP 5', description: 'Está entre os 5 melhores da turma!', icon: '🥈', rewardXp: 250, rewardCoins: 125, category: 'ranking', requiredCount: 5, criteria: 'ranking_position' },
  { id: 'ach-068', title: 'Primeiro Lugar!', description: 'Chegou ao 1º lugar do ranking da turma!', icon: '🥇', rewardXp: 500, rewardCoins: 250, category: 'ranking', requiredCount: 1, criteria: 'ranking_first' },
  { id: 'ach-069', title: 'Membro da Trilha', description: 'Começou uma trilha de aprendizagem.', icon: '🛤️', rewardXp: 60, rewardCoins: 30, category: 'trilhas', requiredCount: 1, criteria: 'paths_started' },
  { id: 'ach-070', title: 'Trilha Concluída', description: 'Completou sua primeira trilha!', icon: '🎉', rewardXp: 250, rewardCoins: 125, category: 'trilhas', requiredCount: 1, criteria: 'paths_completed' },
  { id: 'ach-071', title: '3 Trilhas', description: 'Completou 3 trilhas de aprendizagem!', icon: '🗾', rewardXp: 600, rewardCoins: 300, category: 'trilhas', requiredCount: 3, criteria: 'paths_completed' },
  { id: 'ach-072', title: 'Viajante de Trilhas', description: 'Completou 5 trilhas!', icon: '🌐', rewardXp: 1000, rewardCoins: 500, category: 'trilhas', requiredCount: 5, criteria: 'paths_completed' },
  { id: 'ach-073', title: 'Biblioteca Explorada', description: 'Acessou um item da biblioteca.', icon: '📚', rewardXp: 40, rewardCoins: 20, category: 'biblioteca', requiredCount: 1, criteria: 'library_accessed' },
  { id: 'ach-074', title: 'Leitor Ávido', description: 'Acessou 10 itens da biblioteca.', icon: '📖', rewardXp: 100, rewardCoins: 50, category: 'biblioteca', requiredCount: 10, criteria: 'library_accessed' },
  { id: 'ach-075', title: 'Tutor na Mão', description: 'Fez sua primeira pergunta ao Tutor IA.', icon: '🤖', rewardXp: 50, rewardCoins: 25, category: 'tutor', requiredCount: 1, criteria: 'tutor_questions' },

  // === DIÁRIO (76-80) ===
  { id: 'ach-076', title: 'Diário Regular', description: 'Escreveu 5 notas no Meu Diário.', icon: '📔', rewardXp: 80, rewardCoins: 40, category: 'diario', requiredCount: 5, criteria: 'diary_entries' },
  { id: 'ach-077', title: 'Escritor Prolífico', description: 'Escreveu 20 notas no Meu Diário.', icon: '✍️', rewardXp: 200, rewardCoins: 100, category: 'diario', requiredCount: 20, criteria: 'diary_entries' },
  { id: 'ach-078', title: 'Cronista do Saber', description: 'Escreveu 50 notas no Meu Diário!', icon: '📰', rewardXp: 500, rewardCoins: 250, category: 'diario', requiredCount: 50, criteria: 'diary_entries' },
  { id: 'ach-079', title: 'Com IA no Diário', description: 'Teve uma entrada gerada pelo Tutor IA no Diário.', icon: '🤖', rewardXp: 100, rewardCoins: 50, category: 'diario', requiredCount: 1, criteria: 'diary_ai_entry' },
  { id: 'ach-080', title: 'Organizador', description: 'Usou 5 tags diferentes no Diário.', icon: '🏷️', rewardXp: 60, rewardCoins: 30, category: 'diario', requiredCount: 5, criteria: 'diary_tags' },

  // === ESPECIAIS & SEGREDOS (81-100) ===
  { id: 'ach-081', title: 'Perfeccionista', description: 'Completou um dia com 100% de acertos.', icon: '💯', rewardXp: 200, rewardCoins: 100, category: 'especial', requiredCount: 1, criteria: 'perfect_day' },
  { id: 'ach-082', title: 'Incansável', description: 'Estudou mais de 2 horas em um único dia.', icon: '⏱️', rewardXp: 150, rewardCoins: 75, category: 'especial', requiredCount: 1, criteria: 'long_session' },
  { id: 'ach-083', title: 'Social', description: 'Entrou no TOP 3 do ranking semanal.', icon: '👥', rewardXp: 300, rewardCoins: 150, category: 'ranking', requiredCount: 1, criteria: 'weekly_top3' },
  { id: 'ach-084', title: 'Tudo ao Mesmo Tempo', description: 'Tem missões diária, semanal e épica completas na mesma semana.', icon: '🎪', rewardXp: 400, rewardCoins: 200, category: 'missoes', requiredCount: 1, criteria: 'all_mission_types' },
  { id: 'ach-085', title: 'Ano Novo, Eu Novo', description: 'Acessou a plataforma em 1 de janeiro.', icon: '🎆', rewardXp: 100, rewardCoins: 50, category: 'especial', requiredCount: 1, criteria: 'new_year' },
  { id: 'ach-086', title: 'Aniversário na Plataforma', description: 'Acessou a plataforma no aniversário do Impacto IA.', icon: '🎂', rewardXp: 200, rewardCoins: 100, category: 'especial', requiredCount: 1, criteria: 'platform_birthday' },
  { id: 'ach-087', title: 'Curioso de Plantão', description: 'Fez 50 perguntas ao Tutor IA.', icon: '❓', rewardXp: 300, rewardCoins: 150, category: 'tutor', requiredCount: 50, criteria: 'tutor_questions' },
  { id: 'ach-088', title: 'Guru do Tutor', description: 'Fez 200 perguntas ao Tutor IA.', icon: '🔮', rewardXp: 600, rewardCoins: 300, category: 'tutor', requiredCount: 200, criteria: 'tutor_questions' },
  { id: 'ach-089', title: 'Dedicação Total - 1 Ano', description: 'Está na plataforma há 1 ano.', icon: '🗓️', rewardXp: 1000, rewardCoins: 500, category: 'especial', requiredCount: 365, criteria: 'days_registered' },
  { id: 'ach-090', title: 'Mestra da Matemática', description: 'Acertou 50 questões de Matemática.', icon: '📐', rewardXp: 400, rewardCoins: 200, category: 'materias', requiredCount: 50, criteria: 'math_correct' },
  { id: 'ach-091', title: 'Gramática Perfeita', description: 'Acertou 50 questões de Português.', icon: '📝', rewardXp: 400, rewardCoins: 200, category: 'materias', requiredCount: 50, criteria: 'portuguese_correct' },
  { id: 'ach-092', title: 'Fenômeno das Ciências', description: 'Acertou 50 questões de Ciências.', icon: '🧪', rewardXp: 400, rewardCoins: 200, category: 'materias', requiredCount: 50, criteria: 'science_correct' },
  { id: 'ach-093', title: 'Guardião da História', description: 'Acertou 50 questões de História.', icon: '⚔️', rewardXp: 400, rewardCoins: 200, category: 'materias', requiredCount: 50, criteria: 'history_correct' },
  { id: 'ach-094', title: 'Cartógrafo', description: 'Acertou 50 questões de Geografia.', icon: '🗺️', rewardXp: 400, rewardCoins: 200, category: 'materias', requiredCount: 50, criteria: 'geography_correct' },
  { id: 'ach-095', title: 'Nível 50', description: 'Chegou ao incrível nível 50!', icon: '💥', rewardXp: 1000, rewardCoins: 500, category: 'nivel', requiredCount: 50, criteria: 'level' },
  { id: 'ach-096', title: 'Nível 100', description: 'O MÁXIMO NÍVEL! Lenda absoluta!', icon: '🌌', rewardXp: 5000, rewardCoins: 2500, category: 'nivel', requiredCount: 100, criteria: 'level' },
  { id: 'ach-097', title: 'Fã do Impacto', description: 'Usou a plataforma por 180 dias no total.', icon: '❤️', rewardXp: 800, rewardCoins: 400, category: 'especial', requiredCount: 180, criteria: 'days_registered' },
  { id: 'ach-098', title: 'Item Secreto', description: 'Descobriu o botão secreto escondido na loja!', icon: '🔑', rewardXp: 300, rewardCoins: 150, category: 'especial', requiredCount: 1, criteria: 'secret_button' },
  { id: 'ach-099', title: 'Trilheiro Épico', description: 'Completou 10 trilhas de aprendizagem!', icon: '🧗', rewardXp: 2000, rewardCoins: 1000, category: 'trilhas', requiredCount: 10, criteria: 'paths_completed' },
  { id: 'ach-100', title: 'IMPACTO TOTAL', description: 'Desbloqueou todas as outras 99 conquistas!', icon: '🏆', rewardXp: 9999, rewardCoins: 5000, category: 'supremo', requiredCount: 99, criteria: 'all_achievements' },
];

// ============================================================
// MISSION TEMPLATES (for auto-generation)
// ============================================================
const DAILY_TEMPLATES = [
  { title: 'Duelo do Dia', description: 'Complete 1 duelo hoje.', targetCount: 1, rewardXp: 60, rewardCoins: 30, criteria: 'duel_completed' },
  { title: 'Estudante Dedicado', description: 'Complete 1 atividade hoje.', targetCount: 1, rewardXp: 50, rewardCoins: 20, criteria: 'activity_completed' },
  { title: 'Mestre das Respostas', description: 'Acerte 3 questões hoje.', targetCount: 3, rewardXp: 80, rewardCoins: 30, criteria: 'question_correct' },
  { title: 'Explorador de Trilhas', description: 'Visite a página de Trilhas.', targetCount: 1, rewardXp: 40, rewardCoins: 15, criteria: 'path_started' },
  { title: 'Nota no Diário', description: 'Escreva uma anotação no Meu Diário.', targetCount: 1, rewardXp: 45, rewardCoins: 20, criteria: 'diary_entry' },
  { title: 'Pergunta ao Tutor', description: 'Faça uma pergunta ao Tutor IA.', targetCount: 1, rewardXp: 40, rewardCoins: 15, criteria: 'tutor_question' },
  { title: '3 por 3', description: 'Acerte 3 questões de matérias diferentes.', targetCount: 3, rewardXp: 90, rewardCoins: 35, criteria: 'question_correct' },
  { title: 'Check-in Diário', description: 'Acesse a plataforma hoje.', targetCount: 1, rewardXp: 20, rewardCoins: 10, criteria: 'login' },
  { title: 'Visita à Loja', description: 'Visite a Loja de Avatar.', targetCount: 1, rewardXp: 30, rewardCoins: 15, criteria: 'store_visit' },
  { title: 'Pesquisador', description: 'Acesse um item da Biblioteca.', targetCount: 1, rewardXp: 35, rewardCoins: 15, criteria: 'library_access' },
  { title: 'Corretor Rápido', description: 'Responda 2 questões em menos de 2 minutos.', targetCount: 2, rewardXp: 70, rewardCoins: 30, criteria: 'question_correct' },
  { title: 'Ranking Check', description: 'Visite a página de Ranking.', targetCount: 1, rewardXp: 25, rewardCoins: 10, criteria: 'ranking_visit' },
  { title: 'Conquistas em Vista', description: 'Visite a página de Conquistas.', targetCount: 1, rewardXp: 25, rewardCoins: 10, criteria: 'ranking_visit' },
  { title: 'Chama do Estudo', description: 'Mantenha seu streak ativo hoje.', targetCount: 1, rewardXp: 40, rewardCoins: 20, criteria: 'streak' },
  { title: 'Mestre do Chat', description: 'Converse mais com o Tutor IA.', targetCount: 2, rewardXp: 50, rewardCoins: 25, criteria: 'tutor_question' },
  { title: 'Amigo da Biblioteca', description: 'Explore novos recursos na biblioteca.', targetCount: 2, rewardXp: 60, rewardCoins: 30, criteria: 'library_access' },
  { title: 'Curiosidade Ativa', description: 'Faça 3 perguntas ao Tutor IA.', targetCount: 3, rewardXp: 70, rewardCoins: 35, criteria: 'tutor_question' },
  { title: 'Foco Total', description: 'Complete 2 atividades hoje.', targetCount: 2, rewardXp: 80, rewardCoins: 40, criteria: 'activity_completed' },
  { title: 'Diário Criativo', description: 'Escreva no seu diário com calma.', targetCount: 1, rewardXp: 40, rewardCoins: 20, criteria: 'diary_entry' },
  { title: 'Socializador', description: 'Veja o perfil de um colega no ranking.', targetCount: 1, rewardXp: 30, rewardCoins: 15, criteria: 'ranking_visit' },
  { title: 'Escritor do Diário', description: 'Escreva seus pensamentos no diário.', targetCount: 1, rewardXp: 50, rewardCoins: 25, criteria: 'diary_entry' },
  { title: 'Revisão Rápida', description: 'Complete uma atividade de revisão.', targetCount: 1, rewardXp: 60, rewardCoins: 30, criteria: 'activity_completed' },
  { title: 'Avatar Estiloso', description: 'Troque um item do seu avatar.', targetCount: 1, rewardXp: 40, rewardCoins: 25, criteria: 'avatar_customized' },
  { title: 'Dúvida do Dia', description: 'Tire uma dúvida com o Tutor IA.', targetCount: 1, rewardXp: 45, rewardCoins: 20, criteria: 'tutor_question' },
  { title: 'Bibliotecário Júnior', description: 'Acesse 2 materiais da biblioteca.', targetCount: 2, rewardXp: 50, rewardCoins: 25, criteria: 'library_access' },
  { title: 'Mestre da Persistência', description: 'Complete 3 atividades hoje.', targetCount: 3, rewardXp: 100, rewardCoins: 50, criteria: 'activity_completed' },
];


const WEEKLY_TEMPLATES = [
  { title: 'Mestre dos Duelos', description: 'Complete 3 duelos esta semana.', targetCount: 3, rewardXp: 300, rewardCoins: 120, criteria: 'duel_completed' },
  { title: 'Maratonista do Saber', description: 'Complete 5 atividades esta semana.', targetCount: 5, rewardXp: 200, rewardCoins: 80, criteria: 'activity_completed' },
  { title: 'Diário da Semana', description: 'Escreva 3 anotações no Meu Diário.', targetCount: 3, rewardXp: 150, rewardCoins: 60, criteria: 'diary_entry' },
  { title: 'Streak Semanal', description: 'Mantenha 5 dias de streak.', targetCount: 5, rewardXp: 300, rewardCoins: 100, criteria: 'streak' },
  { title: 'Trilheiro', description: 'Avance em uma trilha de aprendizagem.', targetCount: 1, rewardXp: 180, rewardCoins: 70, criteria: 'path_started' },
  { title: 'Mestre do Tutor', description: 'Faça 5 perguntas ao Tutor IA.', targetCount: 5, rewardXp: 160, rewardCoins: 65, criteria: 'tutor_question' },
  { title: 'Semana Produtiva', description: 'Acerte 10 questões esta semana.', targetCount: 10, rewardXp: 250, rewardCoins: 100, criteria: 'question_correct' },
  { title: 'Colecionador Semanal', description: 'Compre ou receba 2 itens na loja.', targetCount: 2, rewardXp: 200, rewardCoins: 80, criteria: 'store_visit' },
  { title: 'Semana Completa', description: 'Estude em todos os 7 dias da semana.', targetCount: 7, rewardXp: 350, rewardCoins: 140, criteria: 'login' },
  { title: 'Fera nas Atividades', description: 'Complete 10 atividades nesta semana.', targetCount: 10, rewardXp: 400, rewardCoins: 150, criteria: 'activity_completed' },
  { title: 'Escritor Assíduo', description: 'Escreva 5 vezes no seu diário.', targetCount: 5, rewardXp: 250, rewardCoins: 100, criteria: 'diary_entry' },
  { title: 'Mestre da Conversa', description: 'Faça 15 perguntas ao Tutor IA.', targetCount: 15, rewardXp: 350, rewardCoins: 150, criteria: 'tutor_question' },
  { title: 'Explorador Diversificado', description: 'Inicie 3 trilhas diferentes.', targetCount: 3, rewardXp: 300, rewardCoins: 120, criteria: 'path_started' },
  { title: 'Fã de Ranking', description: 'Acompanhe o ranking 5 vezes.', targetCount: 5, rewardXp: 100, rewardCoins: 50, criteria: 'ranking_visit' },
  { title: 'Caçador de Moedas', description: 'Ganhe 200 moedas em questões.', targetCount: 20, rewardXp: 300, rewardCoins: 100, criteria: 'question_correct' },
  { title: 'Expert em Disciplina', description: 'Acerte 15 questões de uma mesma matéria.', targetCount: 15, rewardXp: 450, rewardCoins: 200, criteria: 'question_correct' },
  { title: 'Semana de Ouro', description: 'Mantenha o streak por 7 dias seguidos.', targetCount: 7, rewardXp: 600, rewardCoins: 250, criteria: 'streak' },
  { title: 'Explorador da Loja', description: 'Visite a loja em 4 dias diferentes.', targetCount: 4, rewardXp: 150, rewardCoins: 75, criteria: 'store_visit' },
  { title: 'Bibliotecário', description: 'Acesse 10 itens diferentes da biblioteca.', targetCount: 10, rewardXp: 300, rewardCoins: 150, criteria: 'library_access' },
  { title: 'Mentor IA', description: 'Faça 25 perguntas ao Tutor IA esta semana.', targetCount: 25, rewardXp: 500, rewardCoins: 200, criteria: 'tutor_question' },
  { title: 'Colecionador de Trilhas', description: 'Complete 3 trilhas para se tornar um mestre.', targetCount: 3, rewardXp: 1000, rewardCoins: 400, criteria: 'path_completed' },
  { title: 'Curioso IA Assíduo', description: 'Faça 50 perguntas ao Tutor IA.', targetCount: 50, rewardXp: 800, rewardCoins: 350, criteria: 'tutor_question' },
  { title: 'Dono da Loja', description: 'Acesse a loja 10 vezes esta semana.', targetCount: 10, rewardXp: 200, rewardCoins: 100, criteria: 'store_visit' },
  { title: 'Escritor de Ouro', description: 'Escreva 7 vezes no diário.', targetCount: 7, rewardXp: 400, rewardCoins: 180, criteria: 'diary_entry' },
  { title: 'Top 3 Semanal', description: 'Visite o ranking 7 vezes esta semana.', targetCount: 7, rewardXp: 150, rewardCoins: 70, criteria: 'ranking_visit' },
];


const EPIC_TEMPLATES = [
  { title: 'O Lendário', description: 'Complete 20 atividades este mês.', targetCount: 20, rewardXp: 1000, rewardCoins: 400, criteria: 'activity_completed' },
  { title: 'Trilha do Conhecimento', description: 'Conclua uma trilha completa de aprendizagem.', targetCount: 1, rewardXp: 800, rewardCoins: 350, criteria: 'path_completed' },
  { title: 'Guardião da Loja', description: 'Compre 3 itens diferentes na Loja.', targetCount: 3, rewardXp: 600, rewardCoins: 250, criteria: 'store_visit' },
  { title: 'Escritor do Mês', description: 'Escreva 10 anotações no Meu Diário.', targetCount: 10, rewardXp: 700, rewardCoins: 300, criteria: 'diary_entry' },
  { title: 'Mestre Total', description: 'Acerte 50 questões este mês.', targetCount: 50, rewardXp: 1500, rewardCoins: 600, criteria: 'question_correct' },
  { title: 'Desafio do Streak', description: 'Mantenha um streak de 14 dias.', targetCount: 14, rewardXp: 900, rewardCoins: 400, criteria: 'streak' },
  { title: 'Lenda do Impacto', description: 'Complete 50 atividades este mês.', targetCount: 50, rewardXp: 2500, rewardCoins: 1000, criteria: 'activity_completed' },
  { title: 'Trilheiro Mestre', description: 'Conclua 5 trilhas de aprendizagem.', targetCount: 5, rewardXp: 2000, rewardCoins: 800, criteria: 'path_completed' },
  { title: 'Acumulador de Fortunas', description: 'Ganhe 1000 moedas em questões.', targetCount: 100, rewardXp: 1500, rewardCoins: 700, criteria: 'question_correct' },
  { title: 'Cronista Mensal', description: 'Escreva 30 vezes no seu diário.', targetCount: 30, rewardXp: 1800, rewardCoins: 900, criteria: 'diary_entry' },
  { title: 'Sábio do Saber', description: 'Faça 100 perguntas ao Tutor IA.', targetCount: 100, rewardXp: 2500, rewardCoins: 1200, criteria: 'tutor_question' },
  { title: 'Inquebrável', description: 'Mantenha um streak de 30 dias.', targetCount: 30, rewardXp: 5000, rewardCoins: 2000, criteria: 'streak' },
  { title: 'Mestre da Impacto', description: 'Complete 100 atividades no total.', targetCount: 100, rewardXp: 10000, rewardCoins: 5000, criteria: 'activity_completed' },
  { title: 'Sábio das Trilhas', description: 'Conclua todas as trilhas do seu ano.', targetCount: 5, rewardXp: 4000, rewardCoins: 2000, criteria: 'path_completed' },
  { title: 'Magnata do Avatar', description: 'Possua 50 itens no seu inventário.', targetCount: 50, rewardXp: 3000, rewardCoins: 1500, criteria: 'store_visit' },
  { title: 'Onipresente', description: 'Acesse a plataforma por 28 dias este mês.', targetCount: 28, rewardXp: 2500, rewardCoins: 1000, criteria: 'login' },
  { title: 'Eritudito IA', description: 'Interaja 500 vezes com o Tutor IA.', targetCount: 500, rewardXp: 8000, rewardCoins: 4000, criteria: 'tutor_question' },
  { title: 'Fera da Biblioteca', description: 'Explore 20 recursos da biblioteca este mês.', targetCount: 20, rewardXp: 1500, rewardCoins: 600, criteria: 'library_access' },
  { title: 'Mestre da Personalização', description: 'Personalize seu avatar 5 vezes.', targetCount: 5, rewardXp: 1200, rewardCoins: 500, criteria: 'avatar_customized' },
  { title: 'Desafia-Tudo', description: 'Complete 30 exercícios de matérias variadas.', targetCount: 30, rewardXp: 2000, rewardCoins: 800, criteria: 'question_correct' },
  { title: 'Lenda da Biblioteca', description: 'Acesse 40 recursos este mês.', targetCount: 40, rewardXp: 3000, rewardCoins: 1200, criteria: 'library_access' },
  { title: 'Avatar Mestre', description: 'Personalize seu avatar 10 vezes.', targetCount: 10, rewardXp: 2500, rewardCoins: 1000, criteria: 'avatar_customized' },
];


// ============================================================
// SEED ACHIEVEMENTS INTO DATABASE
// ============================================================
export async function seedAchievements() {
  const existingCount = await db.achievements.count();
  if (existingCount >= 100) return; // Already seeded
  
  // Clear and re-insert all 100
  await db.achievements.clear();
  await db.achievements.bulkAdd(ALL_ACHIEVEMENTS as any[]);
  console.log('[GameSeeder] Seeded 100 achievements.');
}

// ============================================================
// AUTO-GENERATE MISSIONS (daily/weekly/epic refresh)
// ============================================================
function getDayKey(d: Date) {
  return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
}
function getWeekKey(d: Date) {
  const start = new Date(d);
  start.setDate(d.getDate() - d.getDay());
  return `week-${start.getFullYear()}-${start.getMonth() + 1}-${start.getDate()}`;
}
function getMonthKey(d: Date) {
  return `month-${d.getFullYear()}-${d.getMonth() + 1}`;
}

function pickRandom<T>(arr: T[], n: number): T[] {
  const shuffled = [...arr].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, n);
}

export async function ensureMissionsAreUpToDate() {
  const now = new Date();
  
  const dayKey = getDayKey(now);
  const weekKey = getWeekKey(now);
  const monthKey = getMonthKey(now);

  // Remove expired missions
  const allMissions = await db.missions.toArray();
  const expired = allMissions.filter(m => new Date(m.expiresAt!) < now);
  for (const m of expired) {
    await db.missions.delete(m.id);
  }

  // Check what types still exist
  const remaining = await db.missions.toArray();

  // CLEANUP: Remove duplicates or obsolete missions
  const titlesSeen = new Set<string>();
  const validTitles = new Set([...DAILY_TEMPLATES, ...WEEKLY_TEMPLATES, ...EPIC_TEMPLATES].map(t => t.title));
  
  for (const m of remaining) {
    if (titlesSeen.has(m.title) || !validTitles.has(m.title) || m.criteria === 'activity_feedback') {
      await db.missions.delete(m.id);
      // Also cleanup progress
      await db.studentMissions.where('missionId').equals(m.id).delete();
    } else {
      titlesSeen.add(m.title);
    }
  }

  // Refresh remaining list after cleanup
  const cleanedRemaining = await db.missions.toArray();
  
  // Fix existing missions that might be missing 'criteria'
  for (const m of cleanedRemaining) {
    if (!m.criteria) {
      const template = [...DAILY_TEMPLATES, ...WEEKLY_TEMPLATES, ...EPIC_TEMPLATES].find(t => t.title === m.title);
      if (template) {
        await db.missions.update(m.id, { criteria: (template as any).criteria });
      }
    }
  }

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
    expiry: string,
    keyPrefix: string
  ) => {
    if (currentMissions.length < targetCount) {
      const toAdd = targetCount - currentMissions.length;
      const existingTitles = new Set(currentMissions.map(m => m.title));
      const availableTemplates = templates.filter(t => !existingTitles.has(t.title));
      const picks = pickRandom(availableTemplates.length > 0 ? availableTemplates : templates, toAdd);
      
      for (let i = 0; i < picks.length; i++) {
        const t = picks[i];
        await db.missions.add({
          id: `mission-${keyPrefix}-${Date.now()}-${i}`,
          type,
          title: t.title,
          description: t.description,
          targetCount: t.targetCount,
          rewardXp: t.rewardXp,
          rewardCoins: t.rewardCoins,
          criteria: t.criteria,
          expiresAt: expiry,
          requiredLevel: 1,
        } as any);
      }
      console.log(`[GameSeeder] Added ${picks.length} new ${type} missions.`);
    }
  };

  await topUpMissions(dailyMissions, DAILY_TEMPLATES, 'daily', 6, tomorrow.toISOString(), `daily-${dayKey}`);
  await topUpMissions(weeklyMissions, WEEKLY_TEMPLATES, 'weekly', 6, nextMonday.toISOString(), `weekly-${weekKey}`);
  await topUpMissions(epicMissions, EPIC_TEMPLATES, 'epic', 6, nextMonthFirst.toISOString(), `epic-${monthKey}`);
}

// ============================================================
// UNLOCK ACHIEVEMENTS FOR STUDENT
// ============================================================
export async function checkAndUnlockAchievements(studentId: string) {
  if (!studentId) return;

  const stats = await db.gamificationStats.get(studentId);
  if (!stats) return;

  const allAchs = await db.achievements.toArray();
  const unlocked = await db.studentAchievements.where('studentId').equals(studentId).toArray();
  const unlockedIds = new Set(unlocked.map(u => u.achievementId));

  const toUnlock: { achievementId: string; unlockedAt: string }[] = [];

  for (const ach of allAchs) {
    if (unlockedIds.has(ach.id)) continue;
    const a = ach as any;
    if (!a.criteria || !a.requiredCount) continue;

    let achieved = false;

    switch (a.criteria) {
      case 'xp': achieved = stats.xp >= a.requiredCount; break;
      case 'coins': achieved = stats.coins >= a.requiredCount; break;
      case 'level': achieved = stats.level >= a.requiredCount; break;
      case 'streak': achieved = stats.streak >= a.requiredCount; break;
      case 'login': achieved = true; break; // First login = always true
      default: achieved = false;
    }

    if (achieved) {
      toUnlock.push({ achievementId: ach.id, unlockedAt: new Date().toISOString() });
    }
  }

  if (toUnlock.length > 0) {
    for (const item of toUnlock) {
      await db.studentAchievements.add({
        id: crypto.randomUUID(),
        studentId,
        achievementId: item.achievementId,
        progress: 1,
        unlockedAt: item.unlockedAt,
      } as any);
    }
    console.log(`[GameSeeder] Unlocked ${toUnlock.length} achievements for ${studentId}`);

    // Award XP for newly unlocked achievements
    let bonusXp = 0;
    let bonusCoins = 0;
    for (const item of toUnlock) {
      const def = allAchs.find(a => a.id === item.achievementId) as any;
      if (def) {
        bonusXp += def.rewardXp || 0;
        bonusCoins += def.rewardCoins || 0;
      }
    }
    if (bonusXp > 0 || bonusCoins > 0) {
      await db.gamificationStats.update(studentId, {
        xp: stats.xp + bonusXp,
        coins: stats.coins + bonusCoins,
      });
    }
  }
}
export async function ensureTestStudents(_userId?: string) {
  // Disabled as per user request to clear all demo data
  console.log('Automated test student generation is disabled.');
}
