import { create } from 'zustand';
import { db } from '../lib/dexie';
import type { 
  AvatarCatalogItem, 
  StudentOwnedAvatarItem, 
  StudentAvatarProfile 
} from '../types/avatar';
import { ensureDefaultItems } from '../lib/seed';
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
      await ensureDefaultItems();
      const items = await db.avatarCatalog.where('isActive').equals(1).toArray();
      set({ catalog: items });
    } catch (error) {
      console.error('Error fetching catalog:', error);
    } finally {
      set({ isLoading: false });
    }
  },

  fetchOwnedItems: async (studentId) => {
    try {
      const items = await db.studentOwnedAvatars.where('studentId').equals(studentId).toArray();
      set({ ownedItems: items });
    } catch (error) {
      console.error('Error fetching owned items:', error);
    }
  },

  fetchProfile: async (studentId) => {
    set({ isLoading: true });
    try {
      let profile = await db.studentAvatarProfiles.get(studentId);
      if (!profile) {
        // Create a default profile with the student capybara
        profile = {
          studentId,
          selectedAvatarId: 'default-student',
          selectedBackgroundId: '',
          selectedBorderId: '',
          equippedStickerIds: [],
          updatedAt: new Date().toISOString(),
        };
        await db.studentAvatarProfiles.put(profile);
      } else if (!profile.selectedAvatarId) {
        // Migration for existing students without avatar
        profile.selectedAvatarId = 'default-student';
        await db.studentAvatarProfiles.update(studentId, { selectedAvatarId: 'default-student' });
      }
      set({ profile });
    } catch (error) {
      console.error('Error fetching profile:', error);
      // Even on error, set a default so the UI can render
      set({
        profile: {
          studentId,
          selectedAvatarId: 'default-student',
          selectedBackgroundId: '',
          selectedBorderId: '',
          equippedStickerIds: [],
          updatedAt: new Date().toISOString(),
        }
      });
    } finally {
      set({ isLoading: false });
    }
  },

  buyItem: async (studentId, item) => {
    const stats = await db.gamificationStats.get(studentId);
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

    await db.studentOwnedAvatars.add(newItem);
    
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
    await db.avatarCatalog.add(newItem);
    set((state) => ({ catalog: [...state.catalog, newItem] }));
  },

  updateCatalogItem: async (id, updates) => {
    const updatedAt = new Date().toISOString();
    await db.avatarCatalog.update(id, { ...updates, updatedAt });
    set((state) => ({
      catalog: state.catalog.map(item => item.id === id ? { ...item, ...updates, updatedAt } : item)
    }));
  },

  deleteCatalogItem: async (id) => {
    await db.avatarCatalog.delete(id);
    set((state) => ({
      catalog: state.catalog.filter(item => item.id !== id)
    }));
  },

  updateProfile: async (profile) => {
    await db.studentAvatarProfiles.put(profile);
    set({ profile });
  }
}));
