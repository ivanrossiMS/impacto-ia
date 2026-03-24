import { supabase } from '../lib/supabase';
import type { Duel, DuelQuestion, DuelTheme, DuelDifficulty, DuelStatus, DuelAnswerData } from '../types/duel';
import { createNotification, createBulkNotifications } from '../lib/notificationUtils';
import { updateGamificationStats } from '../lib/gamificationUtils';
import { callGenerateDuel } from '../ai/client';
import { calcDuelRewards } from '../lib/duelRewards';

// ============================================================
// DuelService — all question generation is now powered by
// Google Gemini via the secure backend proxy.
// ============================================================

export class DuelService {
  static async createDuel(
    challengerId: string,
    challengedId: string,
    theme: DuelTheme,
    difficulty: DuelDifficulty,
    questionCount: 5 | 8 | 10,
    grade?: string,
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

    const { error: insertError } = await supabase.from('duels').insert(duel);
    if (insertError) {
      console.error('[DuelService] Failed to create duel:', insertError);
      throw new Error(`Falha ao criar duelo: ${insertError.message}`);
    }

    // Generate questions using real Gemini, with grade context
    await this.generateQuestions(duel, grade);

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

  private static async generateQuestions(duel: Duel, grade?: string) {
    let questions: DuelQuestion[] = [];

    try {
      const data = await callGenerateDuel({
        theme: duel.theme,
        difficulty: duel.difficulty,
        count: duel.questionCount + 1,   // +1 = reserve for Swap power
        grade: grade || '',
      });

      questions = (data.questions || []).map((q: any) => ({
        id: window.crypto.randomUUID(),
        duelId: duel.id,
        questionText: q.questionText,
        options: q.options || [],
        explanation: q.explanation || '',
        challengerAnswerId: undefined,
        challengedAnswerId: undefined,
      }));
    } catch (err) {
      console.error('[DuelService] Gemini question generation failed:', err);
      questions = [{
        id: window.crypto.randomUUID(),
        duelId: duel.id,
        questionText: 'Erro ao gerar questão — o sistema de IA está temporariamente indisponível. Tente iniciar um novo duelo.',
        options: [
          { id: 'a', text: 'Entendido', isCorrect: true },
        ],
        explanation: 'Ocorreu um erro ao conectar com o serviço de IA. Por favor, tente novamente.',
      }];
    }

    if (questions.length > 0) {
      await supabase.from('duel_questions').insert(questions);
    }
  }

  static async submitTurn(
    duelId: string,
    userId: string,
    answerData: DuelAnswerData[],
    pressureUsed: boolean = false,
  ): Promise<Duel> {
    const { data: duel } = await supabase.from('duels').select('*').eq('id', duelId).single();
    if (!duel) throw new Error('Duel not found');

    const { data: questionsArr } = await supabase.from('duel_questions').select('*').eq('duelId', duelId);
    const questions = questionsArr || [];

    // Compute correct-count score (legacy) and detailed point score (new)
    let score = 0;
    let detailedScore = 0;

    for (const ad of answerData) {
      const question = questions.find((q: DuelQuestion) => q.id === ad.questionId);
      if (question) {
        if (ad.isCorrect) score++;
        detailedScore += ad.pointsEarned;

        if (userId === duel.challengerId) {
          await supabase.from('duel_questions').update({ challengerAnswerId: ad.selectedOptionId }).eq('id', question.id);
        } else {
          await supabase.from('duel_questions').update({ challengedAnswerId: ad.selectedOptionId }).eq('id', question.id);
        }
      }
    }

    const updates: Partial<Duel> = {};
    if (userId === duel.challengerId) {
      updates.challengerScore = score;
      updates.challengerDetailedScore = detailedScore;
      updates.challengerAnswerData = answerData;
      updates.challengerPressureUsed = pressureUsed;
      updates.challengerTurnCompleted = true;
      if (duel.status === 'pending') {
        updates.status = 'active';
        await createNotification({
          userId: duel.challengedId,
          role: 'student',
          title: 'É a sua vez no Duelo! ⚔️',
          message: 'Seu oponente já jogou. Entre e responda para ver quem vence!',
          type: 'alert',
          priority: 'high',
          actionUrl: `/student/duels/${duelId}`,
        });
      }
    } else {
      updates.challengedScore = score;
      updates.challengedDetailedScore = detailedScore;
      updates.challengedAnswerData = answerData;
      updates.challengedPressureUsed = pressureUsed;
      updates.challengedTurnCompleted = true;
      // ✅ Bug fix: when challenged plays first on a pending duel,
      //    advance status → 'active' so it leaves "Convites" → "Ativos"
      if (duel.status === 'pending') {
        updates.status = 'active';
        await createNotification({
          userId: duel.challengerId,
          role: 'student',
          title: 'É a sua vez no Duelo! ⚔️',
          message: 'O desafiado já jogou. Entre e responda para decidir o vencedor!',
          type: 'alert',
          priority: 'high',
          actionUrl: `/student/duels/${duelId}`,
        });
      }
    }

    const finalDuel = { ...duel, ...updates };

    if (finalDuel.challengerTurnCompleted && finalDuel.challengedTurnCompleted) {
      finalDuel.status = 'completed';
      finalDuel.completedAt = new Date().toISOString();

      // Prefer detailed (point-based) score; fall back to correct count
      const cScore = finalDuel.challengerDetailedScore ?? finalDuel.challengerScore;
      const dScore = finalDuel.challengedDetailedScore ?? finalDuel.challengedScore;

      if (cScore > dScore) {
        finalDuel.winnerId = finalDuel.challengerId;
      } else if (dScore > cScore) {
        finalDuel.winnerId = finalDuel.challengedId;
      } else {
        finalDuel.winnerId = 'draw';
      }

      const rewards = calcDuelRewards(finalDuel.difficulty, finalDuel.questionCount);
      const awardRewards = async (uid: string, isWinner: boolean, isDraw: boolean, correctCount: number) => {
        const winXP = isWinner ? rewards.winXP : isDraw ? rewards.drawXP : rewards.loseXP;
        const answerXP = correctCount * rewards.xpPerCorrect;
        const winCoins = isWinner ? rewards.winCoins : isDraw ? rewards.drawCoins : rewards.loseCoins;
        const answerCoins = correctCount * rewards.coinsPerCorrect;
        try {
          await updateGamificationStats(uid, { xpToAdd: winXP + answerXP, coinsToAdd: winCoins + answerCoins });
        } catch (error) {
          console.error('Error updating duel rewards:', error);
        }
      };

      await awardRewards(finalDuel.challengerId, finalDuel.winnerId === finalDuel.challengerId, finalDuel.winnerId === 'draw', finalDuel.challengerScore);
      await awardRewards(finalDuel.challengedId, finalDuel.winnerId === finalDuel.challengedId, finalDuel.winnerId === 'draw', finalDuel.challengedScore);

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

    // Only send columns that exist in the current duels table schema.
    // New columns (detailedScore, answerData, pressureUsed) require a SQL migration
    // before they can be persisted. The in-memory finalDuel still has the right data
    // for winner logic and return value — the DB just won't store the new fields yet.
    const DB_COLS: (keyof Duel)[] = [
      'id','challengerId','challengedId','theme','difficulty','questionCount',
      'status','challengerScore','challengedScore','winnerId',
      'challengerTurnCompleted','challengedTurnCompleted','createdAt','completedAt',
    ];
    const dbPayload = Object.fromEntries(
      Object.entries(finalDuel).filter(([k]) => DB_COLS.includes(k as keyof Duel))
    );
    await supabase.from('duels').update(dbPayload).eq('id', duelId);
    return finalDuel;
  }


  /**
   * forfeit — the surrendering player instantly loses.
   * They receive half XP and half coins; the opponent wins normally.
   */
  static async forfeit(duelId: string, forfeitingUserId: string): Promise<void> {
    const { data: duel } = await supabase.from('duels').select('*').eq('id', duelId).single();
    if (!duel) throw new Error('Duel not found');

    const opponentId = forfeitingUserId === duel.challengerId ? duel.challengedId : duel.challengerId;
    const isChallenger = forfeitingUserId === duel.challengerId;

    const updates: Partial<Duel> = {
      status: 'completed',
      completedAt: new Date().toISOString(),
      winnerId: opponentId,
      challengerScore: isChallenger ? 0 : duel.challengerScore,
      challengedScore: isChallenger ? duel.challengedScore : 0,
      challengerTurnCompleted: true,
      challengedTurnCompleted: true,
    };

    await supabase.from('duels').update(updates).eq('id', duelId);

    // Half rewards for the surrendering player (consolation)
    const consolationXP = 5;   // half of the minimum loss XP (10 / 2)
    const consolationCoins = 0;
    await updateGamificationStats(forfeitingUserId, { xpToAdd: consolationXP, coinsToAdd: consolationCoins });

    // Normal win rewards for opponent
    await updateGamificationStats(opponentId, { xpToAdd: 60, coinsToAdd: 12 });

    // Notify both players
    await createBulkNotifications(
      [forfeitingUserId, opponentId],
      'student',
      'Duelo Encerrado ⚔️',
      `Um duelo de ${duel.theme} foi encerrado por desistência.`,
      'info',
      'normal',
      `/student/duels/${duelId}`
    );
  }

  /**
   * declineDuel — the challenged player refuses the invite.
   * No XP or coins awarded. Both players see it in Histórico as "Recusado".
   */
  static async declineDuel(duelId: string, declinedByUserId: string): Promise<void> {
    const { data: duel } = await supabase.from('duels').select('*').eq('id', duelId).single();
    if (!duel) throw new Error('Duel not found');

    await supabase.from('duels').update({
      status: 'declined',
      completedAt: new Date().toISOString(),
    }).eq('id', duelId);

    // Notify the challenger that their invite was declined
    const { data: decliner } = await supabase.from('users').select('name').eq('id', declinedByUserId).single();
    await createNotification({
      userId: duel.challengerId,
      role: 'student',
      title: 'Convite Recusado ❌',
      message: `${decliner?.name || 'Um colega'} recusou seu desafio de duelo de ${duel.theme}.`,
      type: 'info',
      priority: 'normal',
      actionUrl: `/student/duels`,
    });
  }



  // ─── SOLO MODE ───────────────────────────────────────────────

  static async createSoloDuel(
    userId: string,
    theme: DuelTheme,
    difficulty: DuelDifficulty,
    questionCount: 5 | 8 | 10,
    grade?: string,
  ): Promise<Duel> {
    const duel: Duel = {
      id: window.crypto.randomUUID(),
      challengerId: userId,
      challengedId: userId,  // same as challengerId → marks this as a solo duel
      theme,
      difficulty,
      questionCount,
      status: 'active',
      challengerScore: 0,
      challengedScore: 0,
      challengerTurnCompleted: false,
      challengedTurnCompleted: true,
      createdAt: new Date().toISOString(),
    };
    await supabase.from('duels').insert(duel);
    await this.generateQuestions(duel, grade);
    return duel;
  }

  static async submitSoloTurn(
    duelId: string,
    userId: string,
    answers: { questionId: string; selectedOptionId: string }[],
  ): Promise<{ duel: Duel; xpEarned: number; coinsEarned: number; score: number }> {
    const { data: duel } = await supabase.from('duels').select('*').eq('id', duelId).single();
    if (!duel) throw new Error('Solo duel not found');
    const { data: questionsArr } = await supabase.from('duel_questions').select('*').eq('duelId', duelId);
    const questions = questionsArr || [];
    let score = 0;
    for (const answer of answers) {
      const q = questions.find((q: DuelQuestion) => q.id === answer.questionId);
      if (q) {
        const correct = q.options.find((o: any) => o.id === answer.selectedOptionId)?.isCorrect;
        if (correct) score++;
      }
    }
    const rewards = calcDuelRewards(duel.difficulty, duel.questionCount);
    const accuracy = score / Math.max(questions.length, 1);
    const base = accuracy >= 0.8 ? { xp: rewards.winXP, coins: rewards.winCoins }
                : accuracy >= 0.5 ? { xp: rewards.drawXP, coins: rewards.drawCoins }
                :                   { xp: rewards.loseXP, coins: rewards.loseCoins };
    const xpEarned    = base.xp    + score * rewards.xpPerCorrect;
    const coinsEarned = base.coins + score * rewards.coinsPerCorrect;
    await updateGamificationStats(userId, { xpToAdd: xpEarned, coinsToAdd: coinsEarned });
    const updated = {
      ...duel,
      challengerScore: score,
      challengerTurnCompleted: true,
      status: 'completed' as DuelStatus,
      completedAt: new Date().toISOString(),
      winnerId: userId,
    };
    await supabase.from('duels').update(updated).eq('id', duelId);
    return { duel: updated, xpEarned, coinsEarned, score };
  }
}
