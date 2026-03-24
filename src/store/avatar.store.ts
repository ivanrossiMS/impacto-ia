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
  
  fetchCatalog: (opts?: { schoolId?: string | null; isMaster?: boolean }) => Promise<void>;
  fetchOwnedItems: (studentId: string) => Promise<void>;
  fetchProfile: (studentId: string) => Promise<void>;
  
  // Admin Actions
  addCatalogItem: (item: Omit<AvatarCatalogItem, 'id' | 'createdAt' | 'updatedAt'>) => Promise<void>;
  updateCatalogItem: (id: string, updates: Partial<AvatarCatalogItem>) => Promise<void>;
  deleteCatalogItem: (id: string) => Promise<void>;
  uploadCatalogImage: (file: File) => Promise<string>; // returns public URL
  
  buyItem: (studentId: string, item: AvatarCatalogItem) => Promise<void>;
  updateProfile: (profile: StudentAvatarProfile) => Promise<void>;
}

export const useAvatarStore = create<AvatarState>((set) => ({

  catalog: [],
  ownedItems: [],
  profile: null,
  isLoading: false,

  /**
   * Fetch the avatar catalog.
   * - isMaster=true  → fetch ALL items (admin master, no filter)
   * - schoolId given → fetch items WHERE (schoolId = given OR schoolId IS NULL)
   * - no args        → fetch all active items (backwards compat / student with no schoolId)
   */
  fetchCatalog: async (opts) => {
    set({ isLoading: true });
    try {
      // Use RPC (SECURITY DEFINER) to bypass RLS — app uses custom auth, not Supabase Auth
      const { data: items, error } = await supabase.rpc('get_avatar_catalog');

      if (error) throw error;

      let result = (items as any[]) || [];

      if (opts?.isMaster) {
        // Admin master: return everything (no filter)
      } else if (opts?.schoolId) {
        // Regular admin / student: keep items for their school OR global (null)
        result = result.filter(
          item => item.schoolId === opts.schoolId || item.schoolId == null
        );
      }

      set({ catalog: result });
    } catch (error) {
      console.error('[AvatarStore] Error fetching catalog:', error);
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

    await updateGamificationStats(studentId, { coinsToAdd: -item.priceCoins });

    const newItem: StudentOwnedAvatarItem = {
      id: crypto.randomUUID(),
      studentId,
      catalogItemId: item.id,
      acquiredAt: new Date().toISOString(),
      acquisitionType: 'purchase'
    };

    const { error } = await supabase.from('student_owned_avatars').insert(newItem);
    if (error) throw error;
    
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
    // Use RPC to bypass RLS
    const { error } = await supabase.rpc('insert_avatar_catalog_item', { p: newItem });
    if (error) {
      console.error('[AvatarStore] addCatalogItem error:', error);
      throw new Error(error.message);
    }
    set((state) => ({ catalog: [...state.catalog, newItem] }));
  },

  uploadCatalogImage: async (file: File): Promise<string> => {
    const ext = file.name.split('.').pop() || 'png';
    const safeName = `${crypto.randomUUID()}.${ext}`;
    const path = `catalog/${safeName}`;

    const { error: uploadError } = await supabase.storage
      .from('avatar-assets')
      .upload(path, file, { contentType: file.type, upsert: true });

    if (uploadError) {
      console.warn('[AvatarStore] Storage upload failed, falling back to base64:', uploadError.message);
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = e => resolve(e.target?.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
    }

    const { data } = supabase.storage.from('avatar-assets').getPublicUrl(path);
    return data.publicUrl;
  },

  updateCatalogItem: async (id, updates) => {
    const updatedAt = new Date().toISOString();
    const { error } = await supabase.from('avatar_catalog').update({ ...updates, updatedAt }).eq('id', id);
    if (error) throw new Error(error.message);
    set((state) => ({
      catalog: state.catalog.map(item => item.id === id ? { ...item, ...updates, updatedAt } : item)
    }));
  },

  deleteCatalogItem: async (id) => {
    // Use RPC to bypass RLS
    await supabase.rpc('delete_avatar_catalog_item', { p_id: id });
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
