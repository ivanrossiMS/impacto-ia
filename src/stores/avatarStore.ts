import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { AvatarProfile, AvatarLayer, InventoryItem } from '../types/avatar';


interface AvatarState {
  profile: AvatarProfile | null;
  layers: AvatarLayer[];
  inventory: InventoryItem[];
  coins: number;
  
  // Actions
  setProfile: (profile: AvatarProfile) => void;
  updateEquippedItem: (type: string, layerId: string | undefined) => void;
  addInventoryItem: (item: InventoryItem) => void;
  setLayers: (layers: AvatarLayer[]) => void;
  purchaseItem: (layerId: string, cost: number) => boolean;
}

export const useAvatarStore = create<AvatarState>()(
  persist(
    (set, get) => ({
      profile: null,
      layers: [],
      inventory: [],
      coins: 350,

      setProfile: (profile) => set({ profile }),
      
      updateEquippedItem: (type, layerId) => set((state) => {
        if (!state.profile) return state;
        const newProfile = { ...state.profile };
        if (type === 'avatar') newProfile.selectedAvatarId = layerId || '';
        if (type === 'background') newProfile.selectedBackgroundId = layerId || '';
        if (type === 'border') newProfile.selectedBorderId = layerId || '';
        return { profile: newProfile };
      }),


      addInventoryItem: (item) => set((state) => ({
        inventory: [...state.inventory, item]
      })),

      setLayers: (layers) => set({ layers }),

      purchaseItem: (_, cost) => {
        const { coins } = get();
        if (coins >= cost) {
          set({ coins: coins - cost });

          // Logic to add to inventory would happen in the component or here
          return true;
        }
        return false;
      }
    }),
    {
      name: 'avatar-storage',
    }
  )
);
