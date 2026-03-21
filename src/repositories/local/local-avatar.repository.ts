import type { IAvatarRepository } from '../contracts/avatar.repository';

import type { AvatarLayer, AvatarProfile, InventoryItem } from '../../types/avatar';
import { db } from '../../lib/dexie';

export class LocalAvatarRepository implements IAvatarRepository {
  async getProfile(studentId: string): Promise<AvatarProfile | null> {
    const profile = await db.studentAvatarProfiles.get(studentId);
    return profile || null;
  }

  async saveProfile(profile: AvatarProfile): Promise<void> {
    await db.studentAvatarProfiles.put(profile);
  }

  async getInventory(studentId: string): Promise<InventoryItem[]> {
    return await db.studentOwnedAvatars.where('studentId').equals(studentId).toArray();
  }

  async getAllLayers(): Promise<AvatarLayer[]> {
    return await db.avatarCatalog.toArray();
  }

  async addLayerToInventory(item: InventoryItem): Promise<void> {
    await db.studentOwnedAvatars.put(item);
  }
}
