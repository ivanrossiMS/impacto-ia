import { create } from 'zustand';
import { supabase } from '../lib/supabase';

interface GamStats {
  xp: number;
  coins: number;
  streak: number;
  level: number;
}

interface GamificationStore {
  stats: GamStats | null;
  unreadCount: number;
  unreadSupportCount: number;
  fetchStats: (userId: string) => Promise<void>;
  setStats: (stats: GamStats) => void;
  incrementCoins: (amount: number) => void;
  incrementXP: (amount: number) => void;
  setUnreadCount: (n: number) => void;
  setUnreadSupportCount: (n: number) => void;
}

export const useGamificationStore = create<GamificationStore>((set) => ({
  stats: null,
  unreadCount: 0,
  unreadSupportCount: 0,

  fetchStats: async (userId: string) => {
    const [statsRes, notifRes, supportRes] = await Promise.all([
      supabase.from('gamification_stats').select('xp, coins, streak, level').eq('id', userId).single(),
      supabase.from('notifications').select('id', { count: 'exact', head: true }).eq('userId', userId).eq('read', false),
      supabase.from('support_tickets').select('id', { count: 'exact', head: true }).eq('userId', userId).eq('isReadByParticipant', false),
    ]);

    if (statsRes.data) {
      set({
        stats: {
          xp: statsRes.data.xp ?? 0,
          coins: statsRes.data.coins ?? 0,
          streak: statsRes.data.streak ?? 0,
          level: statsRes.data.level ?? 1,
        }
      });
    }
    set({
      unreadCount: notifRes.count ?? 0,
      unreadSupportCount: supportRes.count ?? 0,
    });
  },

  setStats: (stats) => set({ stats }),
  incrementCoins: (amount) => set(s => s.stats ? { stats: { ...s.stats, coins: s.stats.coins + amount } } : {}),
  incrementXP: (amount) => set(s => s.stats ? { stats: { ...s.stats, xp: s.stats.xp + amount } } : {}),
  setUnreadCount: (n) => set({ unreadCount: n }),
  setUnreadSupportCount: (n) => set({ unreadSupportCount: n }),
}));
