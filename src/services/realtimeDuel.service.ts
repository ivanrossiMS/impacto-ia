import { supabase } from '../lib/supabase';
import { callGenerateDuel } from '../ai/client';
import { updateGamificationStats } from '../lib/gamificationUtils';
import { calcDuelRewards } from '../lib/duelRewards';
import { createNotification } from '../lib/notificationUtils';
import {
  getQuestionsForDuel,
  saveQuestionsToBank,
  recordQuestionsSeen,
  gradeToYear,
  getStudentAccuracy,      // adaptive difficulty
} from './questionBank.service';
import type { RealtimeRoom, RealtimeRoomPlayer, RealtimeRoomQuestion, RoomMode } from '../types/realtimeDuel';
import type { DuelTheme, DuelDifficulty, DuelAnswerData } from '../types/duel';

// ─── helpers ────────────────────────────────────────────────
function genCode(length = 4): string {
  return Array.from({ length }, () => Math.floor(Math.random() * 10)).join('');
}

function maxPlayers(mode: RoomMode) { return mode === '2v2' ? 4 : 2; }
function minPlayers(_mode: RoomMode) { return 2; } // at least 2 to start a match

// ─── RealtimeDuelService ─────────────────────────────────────
export class RealtimeDuelService {

  // Create a new room and add host as first player
  static async createRoom(
    hostId: string,
    theme: DuelTheme,
    difficulty: DuelDifficulty,
    mode: RoomMode,
    isPrivate: boolean,
    grade?: string,
    autoBalance?: boolean,
  ): Promise<RealtimeRoom> {
    // Generate unique code
    let code = genCode();
    let attempts = 0;
    while (attempts < 10) {
      const { data: existing } = await supabase
        .from('realtime_rooms')
        .select('id')
        .eq('code', code)
        .maybeSingle();
      if (!existing) break;
      code = genCode();
      attempts++;
    }

    const room: Omit<RealtimeRoom, 'id' | 'createdAt'> = {
      code, hostId, theme, difficulty, mode, isPrivate,
      autoBalance: autoBalance ?? false,
      status: 'waiting', currentQuestion: 0, totalQuestions: 8,
    };

    const { data: inserted, error } = await supabase
      .from('realtime_rooms')
      .insert(room)
      .select()
      .single();
    if (error || !inserted) throw new Error(`Falha ao criar sala: ${error?.message}`);

    // Add host as player
    await supabase.from('realtime_room_players').insert({
      roomId: inserted.id,
      userId: hostId,
    });

    // Generate questions (8 + 1 reserve) in background
    this.generateQuestions(inserted.id, theme, difficulty, 9, grade).catch(console.error);

    return inserted as RealtimeRoom;
  }

  // Join an existing room by code (used for public direct join OR code-based private access)
  static async joinRoomByCode(code: string, userId: string): Promise<RealtimeRoom> {
    const cleanCode = code.trim();

    const { data: room, error } = await supabase
      .from('realtime_rooms')
      .select('*')
      .eq('code', cleanCode)
      .maybeSingle();

    if (error || !room) throw new Error('Sala não encontrada. Verifique o código.');
    if (room.status !== 'waiting') throw new Error('Esta sala já iniciou ou foi encerrada.');

    const { data: players } = await supabase
      .from('realtime_room_players')
      .select('id')
      .eq('roomId', room.id);

    const max = maxPlayers(room.mode as RoomMode);
    if ((players?.length ?? 0) >= max) throw new Error('Sala está cheia!');

    // Check if player is already in the room (idempotent)
    const alreadyIn = (players || []).some((p: any) => p.userId === userId);
    if (!alreadyIn) {
      await supabase.from('realtime_room_players').insert({ roomId: room.id, userId });
    }

    return room as RealtimeRoom;
  }

  // Join room by id (for host after creation or guest joining)
  // Retries up to 3 times to handle Supabase read-replica lag after INSERT
  static async joinRoomById(roomId: string, _userId: string): Promise<RealtimeRoom> {
    const MAX_RETRIES = 3;
    const RETRY_DELAY_MS = 800;
    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
      const { data: room, error } = await supabase
        .from('realtime_rooms')
        .select('*')
        .eq('id', roomId)
        .maybeSingle();
      if (error) throw new Error(`Erro ao buscar sala: ${error.message}`);
      if (room) return room as RealtimeRoom;
      if (attempt < MAX_RETRIES) {
        await new Promise(res => setTimeout(res, RETRY_DELAY_MS));
      }
    }
    throw new Error('Sala não encontrada ou encerrada. Volte ao lobby.');
  }

  // Get available rooms that are still open (public and private)
  // Also cleans up stale rooms older than 30 minutes
  static async getPublicRooms(): Promise<RealtimeRoom[]> {
    const thirtyMinutesAgo = new Date(Date.now() - 30 * 60 * 1000).toISOString();

    // Async cleanup: delete stale waiting rooms without blocking the UI
    void (async () => {
      try {
        await supabase
          .from('realtime_rooms')
          .delete()
          .eq('status', 'waiting')
          .lt('createdAt', thirtyMinutesAgo);
      } catch { /* non-fatal */ }
    })();

    const { data } = await supabase
      .from('realtime_rooms')
      .select('*')
      .eq('status', 'waiting')
      .gte('createdAt', thirtyMinutesAgo)
      .order('createdAt', { ascending: false })
      .limit(20);
    return (data || []) as RealtimeRoom[];
  }

  // Leave a room cleanly:
  // - Host (waiting): deletes the room and all related rows (CASCADE)
  // - Guest (waiting): removes only the player row
  // - Anyone (playing/finished): does nothing (forfeit flow handles it)
  static async leaveRoom(roomId: string, userId: string): Promise<void> {
    const { data: room } = await supabase
      .from('realtime_rooms')
      .select('hostId, status')
      .eq('id', roomId)
      .maybeSingle();
    if (!room) return;

    if (room.status !== 'waiting') return; // game in progress — use forfeit instead

    if (room.hostId === userId) {
      // Host leaves → delete entire room (CASCADE deletes players + questions)
      await supabase.from('realtime_rooms').delete().eq('id', roomId);
    } else {
      // Guest leaves → only remove their player row
      await supabase
        .from('realtime_room_players')
        .delete()
        .eq('roomId', roomId)
        .eq('userId', userId);
    }
  }

  // Get players in a room with user info
  static async getPlayersWithInfo(roomId: string): Promise<RealtimeRoomPlayer[]> {
    const { data: players } = await supabase
      .from('realtime_room_players')
      .select('*')
      .eq('roomId', roomId)
      .order('joinedAt');

    if (!players || players.length === 0) return [];

    const userIds = players.map((p: any) => p.userId);
    const [{ data: users }, { data: stats }] = await Promise.all([
      supabase.from('users').select('id,name,avatar,classId').in('id', userIds),
      supabase.from('gamification_stats').select('id,level').in('id', userIds),
    ]);

    // Collect class IDs
    const classIds = Array.from(new Set((users || []).map((u: any) => u.classId).filter(Boolean)));
    let classNameMap: Record<string, string> = {};
    if (classIds.length > 0) {
      const { data: classes } = await supabase.from('classes').select('id,name').in('id', classIds);
      (classes || []).forEach((c: any) => { classNameMap[c.id] = c.name; });
    }

    // Avatar compose map
    const { data: avatarProfiles } = await supabase
      .from('student_avatar_profiles')
      .select('studentId,selectedAvatarId,selectedBackgroundId,selectedBorderId,equippedStickerIds')
      .in('studentId', userIds);

    const avatarItemIds = Array.from(new Set(
      (avatarProfiles || []).flatMap((p: any) =>
        [
          p.selectedAvatarId, p.selectedBackgroundId, p.selectedBorderId,
          ...(Array.isArray(p.equippedStickerIds) ? p.equippedStickerIds : []),
        ].filter(Boolean)
      )
    ));
    let avatarItemMap: Record<string, any> = {};
    if (avatarItemIds.length > 0) {
      const { data: items } = await supabase
        .from('avatar_catalog')
        .select('id,assetUrl,imageUrl')
        .in('id', avatarItemIds);
      (items || []).forEach((i: any) => { avatarItemMap[i.id] = i; });
    }

    return players.map((p: any) => {
      const user = (users || []).find((u: any) => u.id === p.userId);
      const stat = (stats || []).find((s: any) => s.id === p.userId);
      const avatarProf = (avatarProfiles || []).find((ap: any) => ap.studentId === p.userId);
      let avatarCompose = null;
      if (avatarProf?.selectedAvatarId && avatarItemMap[avatarProf.selectedAvatarId]) {
        const av = avatarItemMap[avatarProf.selectedAvatarId];
        const bg = avatarProf.selectedBackgroundId ? avatarItemMap[avatarProf.selectedBackgroundId] : null;
        const bd = avatarProf.selectedBorderId ? avatarItemMap[avatarProf.selectedBorderId] : null;
        const stickerUrls = Array.isArray(avatarProf.equippedStickerIds)
          ? avatarProf.equippedStickerIds
              .map((id: string) => avatarItemMap[id])
              .filter(Boolean)
              .map((item: any) => item.assetUrl || item.imageUrl || '')
              .filter(Boolean)
          : [];
        avatarCompose = {
          avatarUrl: av.assetUrl || av.imageUrl || '',
          backgroundUrl: bg?.assetUrl || bg?.imageUrl,
          borderUrl: bd?.assetUrl || bd?.imageUrl,
          stickerUrls,
        };
      }
      return {
        ...p,
        name: user?.name || '...',
        avatar: user?.avatar,
        level: stat?.level || 1,
        grade: '',
        className: user?.classId ? (classNameMap[user.classId] || '') : '',
        avatarCompose,
      } as RealtimeRoomPlayer;
    });
  }

  // Mark player as ready; if all ready → set status='starting'
  static async setReady(roomId: string, userId: string, room: RealtimeRoom): Promise<void> {
    await supabase
      .from('realtime_room_players')
      .update({ isReady: true })
      .eq('roomId', roomId)
      .eq('userId', userId);

    const { data: players } = await supabase
      .from('realtime_room_players')
      .select('isReady')
      .eq('roomId', roomId);

    const min = minPlayers(room.mode as RoomMode);
    const allReady = (players?.length ?? 0) >= min && (players || []).every((p: any) => p.isReady);
    if (allReady) {
      // If autoBalance is enabled, resolve the lowest grade among all players
      let resolvedGrade: string | undefined;
      if (room.autoBalance) {
        const { data: roomPlayers } = await supabase
          .from('realtime_room_players')
          .select('userId')
          .eq('roomId', roomId);
        const playerUserIds = (roomPlayers || []).map((p: any) => p.userId);
        if (playerUserIds.length > 0) {
          const { data: classData } = await supabase
            .from('users')
            .select('id, classId')
            .in('id', playerUserIds);
          const classIds = (classData || []).map((u: any) => u.classId).filter(Boolean);
          if (classIds.length > 0) {
            const { data: classes } = await supabase
              .from('classes')
              .select('id, grade')
              .in('id', classIds);
            const grades = (classes || []).map((c: any) => c.grade).filter(Boolean);
            // Sort grades numerically ("5", "6", "7"...) and pick lowest
            if (grades.length > 0) {
              grades.sort((a: string, b: string) => {
                const numA = parseInt(a.replace(/\D/g, '')) || 99;
                const numB = parseInt(b.replace(/\D/g, '')) || 99;
                return numA - numB;
              });
              resolvedGrade = grades[0];
            }
          }
        }
      }

      await supabase
        .from('realtime_rooms')
        .update({ status: 'starting', ...(resolvedGrade ? { autoBalanceGrade: resolvedGrade } : {}) })
        .eq('id', roomId);
      // After 3.5s cinematic, set to playing
      setTimeout(async () => {
        await supabase
          .from('realtime_rooms')
          .update({ status: 'playing', currentQuestion: 0 })
          .eq('id', roomId);
      }, 3500);
    }
  }

  // Submit answer for current question
  static async submitAnswer(
    roomId: string,
    userId: string,
    newAnswerEntry: DuelAnswerData,
    _questionScore: number,
    _questionPoints: number,
    _room: RealtimeRoom,
  ): Promise<void> {
    // Get current player data to append answerData
    const { data: playerRow } = await supabase
      .from('realtime_room_players')
      .select('answerData,score,detailedScore')
      .eq('roomId', roomId)
      .eq('userId', userId)
      .single();

    const existing: DuelAnswerData[] = (playerRow?.answerData as DuelAnswerData[]) || [];
    const newAnswerData = [...existing, newAnswerEntry];
    const newScore = (playerRow?.score || 0) + (newAnswerEntry.isCorrect ? 1 : 0);
    const newDetailed = (playerRow?.detailedScore || 0) + newAnswerEntry.pointsEarned;

    await supabase
      .from('realtime_room_players')
      .update({
        hasAnsweredCurrent: true,
        answerData: newAnswerData,
        score: newScore,
        detailedScore: newDetailed,
      })
      .eq('roomId', roomId)
      .eq('userId', userId);

    // Check if all players answered — host will advance question
    // (host client listens to realtime_room_players changes and triggers advance)
  }

  // Host advances to next question (called only by host after all answered)
  static async advanceQuestion(roomId: string, nextIdx: number, totalQuestions: number): Promise<void> {
    if (nextIdx >= totalQuestions) {
      await supabase.from('realtime_rooms').update({ status: 'finished', currentQuestion: nextIdx }).eq('id', roomId);
      await this.finalizeRewards(roomId);
    } else {
      const { data: players } = await supabase.from('realtime_room_players').select('id').eq('roomId', roomId);
      if (players && players.length > 0) {
        await supabase.from('realtime_room_players').update({ hasAnsweredCurrent: false }).in('id', players.map((p: any) => p.id));
      }
      await supabase.from('realtime_rooms').update({ currentQuestion: nextIdx }).eq('id', roomId);
    }
  }

  // Force advance when a player abandoned — marks absent players with timeout (0pts) and forfeits
  static async forceAdvanceAbandoned(roomId: string, nextIdx: number, totalQuestions: number): Promise<void> {
    const { data: players } = await supabase
      .from('realtime_room_players')
      .select('id,hasAnsweredCurrent,answerData')
      .eq('roomId', roomId);

    if (players) {
      const absent = players.filter((p: any) => !p.hasAnsweredCurrent);
      for (const p of absent) {
        const existing = (p.answerData as any[]) || [];
        await supabase.from('realtime_room_players')
          .update({
            hasAnsweredCurrent: true,
            hasForfeit: true,  // permanently locked out of this room
            answerData: [...existing, { isCorrect: false, pointsEarned: 0, timeout: true, forfeit: true }],
          })
          .eq('id', p.id);
      }
    }

    // Now advance
    await this.advanceQuestion(roomId, nextIdx, totalQuestions);
  }

  // Get questions for a room
  static async getQuestions(roomId: string): Promise<RealtimeRoomQuestion[]> {
    const { data } = await supabase
      .from('realtime_room_questions')
      .select('*')
      .eq('roomId', roomId)
      .order('sortOrder');
    return (data || []) as RealtimeRoomQuestion[];
  }

  // Award XP/coins to all players and save duel to history
  private static async finalizeRewards(roomId: string): Promise<void> {
    const { data: room } = await supabase
      .from('realtime_rooms')
      .select('*')
      .eq('id', roomId)
      .single();
    if (!room) return;

    const { data: players } = await supabase
      .from('realtime_room_players')
      .select('*')
      .eq('roomId', roomId)
      .order('detailedScore', { ascending: false });

    if (!players || players.length === 0) return;

    const rewards = calcDuelRewards(room.difficulty, room.totalQuestions);
    const maxScore = players[0]?.detailedScore || 0;
    const winnerCount = players.filter((p: any) => p.detailedScore === maxScore).length;
    const isDraw = winnerCount > 1;
    const winnerId = isDraw ? 'draw' : players[0]?.userId;

    // Map users for result notification
    const userIds = players.map((p: any) => p.userId);
    const { data: usersData } = await supabase.from('users').select('id,name').in('id', userIds);
    void usersData; // reserved for future per-name messaging

    // Save one duel row per pair of players (1v1 or first pair in 2v2)
    // This appears in the Histórico of Duelos tab automatically
    try {
      const p0 = players[0];
      const p1 = players[1] || players[0]; // fallback solo
      const duelsEntry = {
        id: crypto.randomUUID(),
        challengerId: p0.userId,
        challengedId: p1.userId,
        theme: room.theme,
        difficulty: room.difficulty,
        questionCount: room.totalQuestions,
        status: 'completed',
        challengerScore: p0.score || 0,
        challengedScore: p1.score || 0,
        winnerId: winnerId === 'draw' ? 'draw' : winnerId,
        challengerTurnCompleted: true,
        challengedTurnCompleted: true,
        createdAt: room.createdAt,
        completedAt: new Date().toISOString(),
      };
      await supabase.from('duels').insert(duelsEntry);
    } catch (err) {
      console.warn('[RealtimeDuelService] Non-fatal: could not save duel history row:', err);
    }

    for (const player of players) {
      const isWinner = !isDraw && player.userId === winnerId;
      const playerIsDraw = isDraw && players.some((p:any) => p.userId === player.userId && p.detailedScore === maxScore);
      const hasForfeit = !!player.hasForfeit;

      const answerArr: any[] = Array.isArray(player.answerData) ? player.answerData : [];
      const correctCount = answerArr.filter((a:any) => a.isCorrect).length;
      const totalAnswered = answerArr.length;

      // Forfeited player gets minimal consolation (no win bonus)
      const xp = hasForfeit
        ? 5
        : (isWinner ? rewards.winXP : playerIsDraw ? rewards.drawXP : rewards.loseXP)
          + correctCount * rewards.xpPerCorrect;
      const coins = hasForfeit
        ? 0
        : (isWinner ? rewards.winCoins : playerIsDraw ? rewards.drawCoins : rewards.loseCoins)
          + correctCount * rewards.coinsPerCorrect;

      try {
        await updateGamificationStats(player.userId, { xpToAdd: xp, coinsToAdd: coins });
      } catch (err) {
        console.error('[RealtimeDuelService] finalizeRewards xp error:', err);
      }

      // Notify result
      const resultLabel = hasForfeit ? 'Derrota (abandono)' : isWinner ? 'Vitória' : playerIsDraw ? 'Empate' : 'Derrota';
      const emoji = hasForfeit ? '🏃' : isWinner ? '🏆' : playerIsDraw ? '🤝' : '⚔️';
      const accuracy = totalAnswered > 0 ? Math.round((correctCount / totalAnswered) * 100) : 0;
      try {
        await createNotification({
          userId: player.userId,
          role: 'student',
          title: `${emoji} Duelo em Tempo Real — ${resultLabel}`,
          message: `Encerrou com ${correctCount}/${totalAnswered} acertos (${accuracy}% precisão). +${xp} XP, +${coins} moedas.`,
          type: 'reward',
          priority: isWinner ? 'high' : 'normal',
          actionUrl: '/student/duels',
        });
      } catch (err) {
        console.warn('[RealtimeDuelService] notification error:', err);
      }
    }

    // Clean up finished room after 45s so lobby is always clean
    setTimeout(async () => {
      await supabase.from('realtime_rooms').delete().eq('id', roomId);
    }, 45_000);
  }

  // Generate and store questions for a room.
  // DB-FIRST: fetches from question_bank first; calls AI only for missing count.
  private static async generateQuestions(
    roomId: string,
    theme: DuelTheme,
    difficulty: DuelDifficulty,
    count: number,
    grade?: string,
    autoBalanceGrade?: string,
  ): Promise<void> {
    try {
      // Idempotent: remove any previously generated questions for this room first
      await supabase.from('realtime_room_questions').delete().eq('roomId', roomId);

      // Verify room still exists before proceeding
      const { data: roomCheck } = await supabase
        .from('realtime_rooms').select('id, hostId').eq('id', roomId).maybeSingle();
      if (!roomCheck) return; // Room deleted — abort silently

      // ── Phase 1: Fetch from question bank ────────────────────
      const effectiveGrade = autoBalanceGrade || grade || '';
      const gradeYear = gradeToYear(effectiveGrade);
      const hostId = roomCheck.hostId as string;

      const bankQuestions = await getQuestionsForDuel(theme, gradeYear, difficulty, hostId, count);
      const bankCount = bankQuestions.length;

      console.log(`[QuestionBank] Found ${bankCount}/${count} questions in bank for ${theme}/${difficulty}`);

      // ── Phase 2: Call AI only for missing questions ───────────
      let aiQuestions: any[] = [];
      if (bankCount < count) {
        const needed = count - bankCount;

        // Fetch student accuracy for adaptive difficulty (silently adjusts level)
        const studentAccuracy = await getStudentAccuracy(hostId, 20).catch(() => 0.5);

        const data = await callGenerateDuel({
          theme,
          difficulty,
          count: needed,
          grade: effectiveGrade,
          studentAccuracy,
        });
        aiQuestions = data.questions || [];

        // Save new questions to bank for future reuse
        if (aiQuestions.length > 0) {
          await saveQuestionsToBank(aiQuestions, theme, gradeYear, difficulty);
        }
      }

      // ── Phase 3: Merge bank + AI questions and insert into room ─
      type QRow = { roomId: string; questionText: string; options: any[]; explanation: string; sortOrder: number; bankQuestionId?: string };
      const allQuestions: QRow[] = [
        ...bankQuestions.map((q, i): QRow => ({
          roomId,
          questionText: q.question_text,
          options: q.options,
          explanation: q.explanation || '',
          sortOrder: i,
          bankQuestionId: q.id,
        })),
        ...aiQuestions.map((q: any, i: number): QRow => ({
          roomId,
          questionText: q.questionText,
          options: q.options || [],
          explanation: q.explanation || '',
          sortOrder: bankCount + i,
        })),
      ].slice(0, count);

      if (allQuestions.length > 0) {
        // Final room existence check before insert (guards FK violation)
        const { data: stillExists } = await supabase
          .from('realtime_rooms').select('id').eq('id', roomId).maybeSingle();
        if (!stillExists) return;

        await supabase.from('realtime_room_questions').insert(
          allQuestions.map(({ bankQuestionId: _bqId, ...rest }) => rest)
        );

        // Record bank questions as "seen" so they won't repeat for this host
        const bankIds = allQuestions
          .filter(q => (q as any).bankQuestionId)
          .map(q => (q as any).bankQuestionId);
        if (bankIds.length > 0) {
          await recordQuestionsSeen(hostId, bankIds, theme, roomId);
        }
      }
    } catch (err) {
      console.error('[RealtimeDuelService] generateQuestions error:', err);
      // Insert fallback question (only if none exist yet to avoid 409)
      const { data: existing } = await supabase
        .from('realtime_room_questions').select('id').eq('roomId', roomId).limit(1);
      if (!existing?.length) {
        const { data: stillExists } = await supabase
          .from('realtime_rooms').select('id').eq('id', roomId).maybeSingle();
        if (stillExists) {
          await supabase.from('realtime_room_questions').insert([{
            roomId,
            questionText: 'Erro ao gerar questões. O serviço de IA está temporariamente indisponível.',
            options: [{ id: 'a', text: 'Entendido', isCorrect: true }],
            explanation: '',
            sortOrder: 0,
          }]);
        }
      }
    }
  }

  // Forfeit: player ignores rejoin → mark as forfeited, finalize immediately if game in progress
  static async forfeitPlayer(roomId: string, userId: string): Promise<void> {
    const { data: playerRow } = await supabase
      .from('realtime_room_players')
      .select('answerData')
      .eq('roomId', roomId)
      .eq('userId', userId)
      .maybeSingle();

    if (!playerRow) return;

    const existing: any[] = Array.isArray(playerRow.answerData) ? playerRow.answerData : [];
    await supabase.from('realtime_room_players').update({
      hasAnsweredCurrent: true,
      hasForfeit: true,
      answerData: [...existing, { isCorrect: false, pointsEarned: 0, timeout: true, forfeit: true }],
    }).eq('roomId', roomId).eq('userId', userId);
  }

  // Check if a user already has a player row in an in-progress room (where they haven't forfeited)
  static async getRejoinableRoom(userId: string): Promise<RealtimeRoom | null> {
    const { data: playerRows } = await supabase
      .from('realtime_room_players')
      .select('roomId,hasForfeit')
      .eq('userId', userId)
      .order('joinedAt', { ascending: false })
      .limit(5);
    if (!playerRows?.length) return null;
    // Exclude rooms where this user already forfeited
    const eligibleRoomIds = playerRows
      .filter((r: any) => !r.hasForfeit)
      .map((r: any) => r.roomId);
    if (!eligibleRoomIds.length) return null;
    for (const rid of eligibleRoomIds) {
      const { data: room } = await supabase
        .from('realtime_rooms')
        .select('*')
        .eq('id', rid)
        .in('status', ['waiting', 'starting', 'playing'])
        .maybeSingle();
      if (room) return room as RealtimeRoom;
    }
    return null;
  }
}
