import { create } from 'zustand';
import { supabase } from '../lib/supabase';
import type { 
  AvatarCatalogItem, 
  StudentOwnedAvatarItem, 
  StudentAvatarProfile 
} from '../types/avatar';

import { updateGamificationStats } from '../lib/gamificationUtils';

interface AvatarState {
  catalog: AvatarCatalogItem[];
  ownedItems: StudentOwnedAvatarItem[];
  profile: StudentAvatarProfile | null;
  isLoading: boolean;
  
  fetchCatalog: () => Promise<void>;
  fetchOwnedItems: (studentId: string) => Promise<void>;
  fetchProfile: (studentId: string) => Promise<void>;
  
  // Admin Actions
  addCatalogItem: (item: Omit<AvatarCatalogItem, 'id' | 'createdAt' | 'updatedAt'>) => Promise<void>;
  updateCatalogItem: (id: string, updates: Partial<AvatarCatalogItem>) => Promise<void>;
  deleteCatalogItem: (id: string) => Promise<void>;
  
  buyItem: (studentId: string, item: AvatarCatalogItem) => Promise<void>;
  updateProfile: (profile: StudentAvatarProfile) => Promise<void>;
}

export const useAvatarStore = create<AvatarState>((set) => ({

  catalog: [],
  ownedItems: [],
  profile: null,
  isLoading: false,

  fetchCatalog: async () => {
    set({ isLoading: true });
    try {
      const { data: items, error } = await supabase.from('avatar_catalog').select('*').eq('isActive', 1);
      if (error) throw error;
      set({ catalog: items || [] });
    } catch (error) {
      console.error('Error fetching catalog:', error);
    } finally {
      set({ isLoading: false });
    }
  },

  fetchOwnedItems: async (studentId) => {
    try {
      const { data: items, error } = await supabase.from('student_owned_avatars').select('*').eq('studentId', studentId);
      if (error) throw error;
      set({ ownedItems: items || [] });
    } catch (error) {
      console.error('Error fetching owned items:', error);
    }
  },

  fetchProfile: async (studentId) => {
    set({ isLoading: true });
    try {
      let { data: profile, error } = await supabase.from('student_avatar_profiles').select('*').eq('studentId', studentId).maybeSingle();
      
      if (error) throw error;

      if (!profile) {
        profile = {
          studentId,
          selectedAvatarId: null,
          selectedBackgroundId: null,
          selectedBorderId: null,
          equippedStickerIds: [],
          updatedAt: new Date().toISOString(),
        } as any;
        await supabase.from('student_avatar_profiles').insert(profile);
      }
      set({ profile });
    } catch (error) {
      console.error('Error fetching profile:', error);
      // Even on error, set a default so the UI can render
      set({
        profile: {
          studentId,
          selectedAvatarId: null,
          selectedBackgroundId: null,
          selectedBorderId: null,
          equippedStickerIds: [],
          updatedAt: new Date().toISOString(),
        } as any
      });
    } finally {
      set({ isLoading: false });
    }
  },

  buyItem: async (studentId, item) => {
    const { data: stats } = await supabase.from('gamification_stats').select('coins').eq('id', studentId).single();
    if (!stats || stats.coins < item.priceCoins) {
      throw new Error('Moedas insuficientes!');
    }

    // Deduct coins and update streak
    await updateGamificationStats(studentId, { coinsToAdd: -item.priceCoins });

    // Add to owned items
    const newItem: StudentOwnedAvatarItem = {
      id: crypto.randomUUID(),
      studentId,
      catalogItemId: item.id,
      acquiredAt: new Date().toISOString(),
      acquisitionType: 'purchase'
    };

    const { error } = await supabase.from('student_owned_avatars').insert(newItem);
    if (error) throw error;
    
    // Update local state
    set((state) => ({
      ownedItems: [...state.ownedItems, newItem]
    }));
  },

  addCatalogItem: async (item) => {
    const newItem: AvatarCatalogItem = {
      ...item,
      id: crypto.randomUUID(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    await supabase.from('avatar_catalog').insert(newItem);
    set((state) => ({ catalog: [...state.catalog, newItem] }));
  },

  updateCatalogItem: async (id, updates) => {
    const updatedAt = new Date().toISOString();
    await supabase.from('avatar_catalog').update({ ...updates, updatedAt }).eq('id', id);
    set((state) => ({
      catalog: state.catalog.map(item => item.id === id ? { ...item, ...updates, updatedAt } : item)
    }));
  },

  deleteCatalogItem: async (id) => {
    await supabase.from('avatar_catalog').delete().eq('id', id);
    set((state) => ({
      catalog: state.catalog.filter(item => item.id !== id)
    }));
  },

  updateProfile: async (profile) => {
    const cleanProfile = { ...profile } as any;
    if (!cleanProfile.selectedBackgroundId) cleanProfile.selectedBackgroundId = null;
    if (!cleanProfile.selectedBorderId) cleanProfile.selectedBorderId = null;
    if (!cleanProfile.selectedAvatarId) cleanProfile.selectedAvatarId = null;

    await supabase.from('student_avatar_profiles').upsert(cleanProfile, { onConflict: 'studentId' });
    set({ profile });
  }
}));
