import { supabase } from '../lib/supabase';
import type { Duel, DuelQuestion, DuelTheme, DuelDifficulty } from '../types/duel';
import { createNotification, createBulkNotifications } from '../lib/notificationUtils';
import { updateGamificationStats } from '../lib/gamificationUtils';

export class DuelService {
  static async createDuel(
    challengerId: string,
    challengedId: string,
    theme: DuelTheme,
    difficulty: DuelDifficulty,
    questionCount: 5 | 8 | 10
  ): Promise<Duel> {
    const duel: Duel = {
      id: window.crypto.randomUUID(),
      challengerId,
      challengedId,
      theme,
      difficulty,
      questionCount,
      status: 'pending',
      challengerScore: 0,
      challengedScore: 0,
      challengerTurnCompleted: false,
      challengedTurnCompleted: false,
      createdAt: new Date().toISOString(),
    };

    await supabase.from('duels').insert(duel);
    await this.generateQuestions(duel);

    // Notify the challenged student
    const { data: challenger } = await supabase.from('users').select('*').eq('id', challengerId).single();
    await createNotification({
      userId: challengedId,
      role: 'student',
      title: 'Novo Desafio de Duelo! ⚔️',
      message: `${challenger?.name || 'Um colega'} te desafiou para um duelo de ${theme}!`,
      type: 'alert',
      priority: 'high',
      actionUrl: `/student/duels/${duel.id}`
    });

    return duel;
  }

  private static async generateQuestions(duel: Duel) {
    // Simulated AI Question Generation
    // In a real app, this would call an LLM API
    const questions: DuelQuestion[] = [];
    
    const themeQuestions: Record<DuelTheme, string[]> = {
      historia: ['Quem descobriu o Brasil?', 'Independência ou Morte! Quem disse isso?', 'Em que ano começou a República no Brasil?'],
      geografia: ['Qual a capital do Brasil?', 'Qual o maior oceano do mundo?', 'Em qual continente fica o Egito?'],
      arte: ['Quem pintou a Mona Lisa?', 'Qual artista é famoso por suas esculturas de mármore?', 'O que é o surrealismo?'],
      esportes: ['Quantas Copas do Mundo o Brasil tem?', 'Quem é o "Rei do Futebol"?', 'Em quais esportes se usa uma raquete?'],
      ciencias: ['Qual o planeta mais próximo do Sol?', 'O que é a fotossíntese?', 'Quantos ossos tem o corpo humano adulto?'],
      entretenimento: ['Quem é o criador do Mickey Mouse?', 'Qual o filme mais premiado da história?', 'Como se chama o vilão do Batman que ri?'],
      aleatorio: ['Qual a cor do cavalo branco de Napoleão?', 'Quanto é 7 vezes 8?', 'Qual a capital da França?'],
    };

    const selectedThemeQuestions = themeQuestions[duel.theme] || themeQuestions.aleatorio;

    for (let i = 0; i < duel.questionCount; i++) {
      const questionIndex = i % selectedThemeQuestions.length;
      questions.push({
        id: window.crypto.randomUUID(),
        duelId: duel.id,
        questionText: `${selectedThemeQuestions[questionIndex]} (Questão ${i + 1})`,
        options: [
          { id: '1', text: 'Opção correta e detalhada', isCorrect: true },
          { id: '2', text: 'Opção incorreta comum', isCorrect: false },
          { id: '3', text: 'Opção incorreta absurda', isCorrect: false },
          { id: '4', text: 'Opção incorreta lógica', isCorrect: false },
        ],
        explanation: 'Esta é uma explicação detalhada gerada pela IA para ajudar no seu aprendizado.',
      });
    }

    await supabase.from('duel_questions').insert(questions);
  }

  static async submitTurn(
    duelId: string,
    userId: string,
    answers: { questionId: string; selectedOptionId: string }[]
  ): Promise<Duel> {
    const { data: duel } = await supabase.from('duels').select('*').eq('id', duelId).single();
    if (!duel) throw new Error('Duel not found');

    const { data: questionsArr } = await supabase.from('duel_questions').select('*').eq('duelId', duelId);
    const questions = questionsArr || [];
    let score = 0;

    for (const answer of answers) {
      const question = questions.find((q: DuelQuestion) => q.id === answer.questionId);
      if (question) {
        const isCorrect = question.options.find((o: any) => o.id === answer.selectedOptionId)?.isCorrect;
        if (isCorrect) score++;

        // Update question record with user's answer
        if (userId === duel.challengerId) {
          await supabase.from('duel_questions').update({ challengerAnswerId: answer.selectedOptionId }).eq('id', question.id);
        } else {
          await supabase.from('duel_questions').update({ challengedAnswerId: answer.selectedOptionId }).eq('id', question.id);
        }
      }
    }

    const updates: Partial<Duel> = {};
    if (userId === duel.challengerId) {
      updates.challengerScore = score;
      updates.challengerTurnCompleted = true;
      if (duel.status === 'pending') updates.status = 'active';
    } else {
      updates.challengedScore = score;
      updates.challengedTurnCompleted = true;
    }

    // Check if duel is finished
    const finalDuel = { ...duel, ...updates };
    if (finalDuel.challengerTurnCompleted && finalDuel.challengedTurnCompleted) {
      finalDuel.status = 'completed';
      finalDuel.completedAt = new Date().toISOString();
      
      if (finalDuel.challengerScore > finalDuel.challengedScore) {
        finalDuel.winnerId = finalDuel.challengerId;
      } else if (finalDuel.challengedScore > finalDuel.challengerScore) {
        finalDuel.winnerId = finalDuel.challengedId;
      } else {
        finalDuel.winnerId = 'draw';
      }
      
      // Award XP/Coins here
      const awardRewards = async (userId: string, isWinner: boolean, isDraw: boolean, correctCount: number) => {
        const winXP = isWinner ? 50 : isDraw ? 20 : 10;
        const answerXP = correctCount * 15;
        const totalXP = winXP + answerXP;
        
        const winCoins = isWinner ? 10 : 0;
        const answerCoins = Math.floor(correctCount / 2);
        const totalCoins = winCoins + answerCoins;

        try {
          const result = await updateGamificationStats(userId, {
            xpToAdd: totalXP,
            coinsToAdd: totalCoins
          });

          // Notify Level Up
          if (result && result.newLevel > result.oldLevel) {
            await createNotification({
              userId,
              role: 'student',
              title: 'Subiu de Nível! 🚀',
              message: `Parabéns! Você alcançou o Nível ${result.newLevel}!`,
              type: 'reward',
              priority: 'high'
            });
          }
        } catch (error) {
          console.error('Error updating duel rewards:', error);
        }
      };

      await awardRewards(finalDuel.challengerId, finalDuel.winnerId === finalDuel.challengerId, finalDuel.winnerId === 'draw', finalDuel.challengerScore);
      await awardRewards(finalDuel.challengedId, finalDuel.winnerId === finalDuel.challengedId, finalDuel.winnerId === 'draw', finalDuel.challengedScore);

      // Notify completion to Students (will automatically mirror to Guardians)
      await createBulkNotifications(
        [finalDuel.challengerId, finalDuel.challengedId],
        'student',
        'Duelo Finalizado! ⚔️',
        `O duelo de ${finalDuel.theme} foi concluído! Veja os resultados.`,
        'info',
        'normal',
        `/student/duels/${finalDuel.id}`
      );
    }

    await supabase.from('duels').update(finalDuel).eq('id', duelId);
    return finalDuel;
  }
}
