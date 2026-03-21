import type { AvatarLayer, AvatarProfile, InventoryItem } from '../../types/avatar';

export interface IAvatarRepository {
  getProfile(studentId: string): Promise<AvatarProfile | null>;
  saveProfile(profile: AvatarProfile): Promise<void>;
  getInventory(studentId: string): Promise<InventoryItem[]>;
  getAllLayers(): Promise<AvatarLayer[]>;
  addLayerToInventory(item: InventoryItem): Promise<void>;
}
