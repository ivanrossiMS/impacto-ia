export type AvatarRarity = 'comum' | 'incomum' | 'raro' | 'épico' | 'lendário';

export type AvatarItemType = 'avatar' | 'background' | 'border' | 'sticker' | 'base' | 'hair' | 'clothes' | 'shoes' | 'accessory' | 'base_body' | 'mouth' | 'eyes' | 'headwear' | 'glasses' | 'effect' | 'top' | 'bottom';



export interface AvatarCatalogItem {
  id: string;
  name: string;
  description?: string;
  assetUrl: string;
  previewUrl?: string;
  type: AvatarItemType;
  category?: string;
  rarity: AvatarRarity;
  priceCoins: number;
  isFree?: boolean;
  isFeatured?: boolean;
  isEventLimited?: boolean;
  isRecommended?: boolean;
  isActive: number;
  sortOrder: number;
  tags?: string[];
  schoolId?: string | null; // null = global (all schools); UUID = school-specific
  createdAt: string;
  updatedAt: string;
  imageUrl?: string;
  isPremium?: boolean;
}


export interface StudentOwnedAvatarItem {
  id: string;
  studentId: string;
  catalogItemId: string;
  acquiredAt: string;
  acquisitionType: 'purchase' | 'gift' | 'event' | 'onboarding';
}

export interface StudentAvatarProfile {
  studentId: string;
  selectedAvatarId: string; // Must be an 'avatar' type item from owned items
  selectedBackgroundId?: string; // Must be a 'background' type item
  selectedBorderId?: string; // Must be a 'border' type item
  equippedStickerIds: string[]; // List of sticker IDs
  updatedAt: string;
  equippedItems?: Record<string, string | undefined>; // Legacy compatibility
  skinTone?: string; // Legacy compatibility
  colorOverrides?: Record<string, string>; // Legacy compatibility
}


export interface AvatarCollection {
  id: string;
  name: string;
  description?: string;
  bannerUrl?: string;
  isActive: number;
  isEvent?: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface AdminAvatarCampaign {
  id: string;
  name: string;
  description?: string;
  startDate: string;
  endDate: string;
  rewardType: 'item' | 'moedas' | 'xp';
  relatedItemIds: string[];
  isActive: number;
  createdAt: string;
  updatedAt: string;
}

// Compatibility types for legacy code
export type AvatarProfile = StudentAvatarProfile;
export type AvatarLayer = AvatarCatalogItem;
export type InventoryItem = StudentOwnedAvatarItem;
export type AvatarLayerType = AvatarItemType;

// Extend existing interfaces with compatibility properties if needed
// Or better, use type-only additions if possible, but here we might need to modify the interfaces
// to avoid "Property does not exist" errors in existing code.

