import React from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../lib/dexie';
import type { AvatarCatalogItem } from '../../types/avatar';
import { cn } from '../../lib/utils';

interface StudentAvatarMiniProps {
  /** The student's user ID — used to look up their profile in Dexie */
  studentId: string;
  /** Fallback letter shown when no avatar image is available */
  fallbackInitial?: string;
  /** Tailwind bg class for the fallback circle */
  fallbackColor?: string;
  /**
   * Fallback avatar URL (e.g. user.avatar) shown when no profile is in Dexie.
   * Useful for teachers, guardians, and admins who have uploaded a photo
   * but don't use the student avatar profile system.
   */
  fallbackAvatarUrl?: string | null;
  /** px size of the entire widget. Default 44. */
  size?: number;
  /** Extra CSS classes for the outer wrapper */
  className?: string;
  /** Border-radius style — 'full' = circle, 'lg' = rounded square */
  shape?: 'full' | 'lg' | 'xl' | '2xl';
}

/**
 * Lightweight avatar widget that shows background + avatar + moldura (border) + adesivos (stickers).
 * Reads directly from Dexie (synced by syncEngine) so it stays reactive without
 * needing any prop drilling from parent data fetches.
 * Layers (bottom → top):
 *   1. Background (object-cover, fills container)
 *   2. Avatar character (object-contain, centered on top of background)
 *   3. Border/Moldura (absolute overlay, object-contain)
 *   4. Stickers (absolute corners, z-20)
 */
export const StudentAvatarMini: React.FC<StudentAvatarMiniProps> = ({
  studentId,
  fallbackInitial = '?',
  fallbackColor = 'bg-slate-300',
  fallbackAvatarUrl,
  size = 44,
  className,
  shape = 'full',
}) => {
  // ── Dexie live queries ─────────────────────────────────────────────────────
  const profile = useLiveQuery(
    () => db.studentAvatarProfiles.get(studentId),
    [studentId]
  );

  const avatarItem = useLiveQuery(
    () => profile?.selectedAvatarId ? db.avatarCatalog.get(profile.selectedAvatarId) : undefined,
    [profile?.selectedAvatarId]
  );

  const backgroundItem = useLiveQuery(
    () => {
      const bgId = profile?.selectedBackgroundId ?? (profile?.equippedItems as any)?.background ?? null;
      return bgId ? db.avatarCatalog.get(bgId) : undefined;
    },
    [profile?.selectedBackgroundId, (profile?.equippedItems as any)?.background]
  );

  const borderItem = useLiveQuery(
    () => {
      const borderId = profile?.selectedBorderId ?? (profile?.equippedItems as any)?.border ?? null;
      return borderId ? db.avatarCatalog.get(borderId) : undefined;
    },
    [profile?.selectedBorderId, (profile?.equippedItems as any)?.border]
  );

  const stickerItems = useLiveQuery(
    async () => {
      const ids: string[] = profile?.equippedStickerIds ?? [];
      if (ids.length === 0) return [] as AvatarCatalogItem[];
      return db.avatarCatalog.where('id').anyOf(ids).toArray();
    },
    [JSON.stringify(profile?.equippedStickerIds)]
  );

  // ── Resolved URLs ──────────────────────────────────────────────────────────
  const avatarUrl     = (avatarItem     as any)?.assetUrl ?? fallbackAvatarUrl ?? null;
  const backgroundUrl = (backgroundItem as any)?.assetUrl ?? null;
  const borderUrl     = (borderItem     as any)?.assetUrl ?? null;
  const stickers      = ((stickerItems ?? []) as any[]).map(s => s?.assetUrl).filter(Boolean) as string[];

  // ── Radii ─────────────────────────────────────────────────────────────────
  const shapeClass = {
    full: 'rounded-full',
    lg:   'rounded-lg',
    xl:   'rounded-xl',
    '2xl':'rounded-2xl',
  }[shape] ?? 'rounded-full';

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div
      className={cn('relative shrink-0 overflow-visible', className)}
      style={{ width: size, height: size }}
    >
      {/* Layer 1 — Background (fills frame) */}
      <div className={cn('absolute inset-0 overflow-hidden', shapeClass)}
        style={{ background: '#0f172a' }}>
        {backgroundUrl
          ? <img src={backgroundUrl} alt="" className="w-full h-full object-cover" />
          : !avatarUrl && (
            <div className={cn(
              'w-full h-full flex items-center justify-center font-black text-white uppercase',
              fallbackColor
            )}>
              {fallbackInitial}
            </div>
          )
        }
      </div>

      {/* Layer 2 — Avatar character (centered, object-contain so bg shows) */}
      {avatarUrl && (
        <div className="absolute inset-0 flex items-center justify-center">
          <img
            src={avatarUrl}
            alt=""
            style={{ width: '92%', height: '92%', objectFit: 'contain', imageRendering: 'auto' }}
          />
        </div>
      )}

      {/* Fallback initials when no avatar and no background */}
      {!avatarUrl && !backgroundUrl && (
        <div className={cn('absolute inset-0 flex items-center justify-center overflow-hidden', shapeClass, fallbackColor)}>
          <span className="font-black text-white uppercase" style={{ fontSize: size * 0.35 }}>
            {fallbackInitial}
          </span>
        </div>
      )}

      {/* Layer 3 — Moldura / Border overlay */}
      {borderUrl && (
        <img
          src={borderUrl}
          alt=""
          className="absolute inset-0 w-full h-full object-contain z-10 pointer-events-none"
        />
      )}

      {/* Layer 4 — Adesivos / Stickers (up to 4, at corners) */}
      {stickers[0] && (
        <img src={stickers[0]} alt="" className="absolute z-20 pointer-events-none object-contain drop-shadow-md"
          style={{ width: '40%', height: '40%', top: '-12%', left: '-12%' }} />
      )}
      {stickers[1] && (
        <img src={stickers[1]} alt="" className="absolute z-20 pointer-events-none object-contain drop-shadow-md"
          style={{ width: '40%', height: '40%', top: '-12%', right: '-12%' }} />
      )}
      {stickers[2] && (
        <img src={stickers[2]} alt="" className="absolute z-20 pointer-events-none object-contain drop-shadow-md"
          style={{ width: '40%', height: '40%', bottom: '-12%', left: '-12%' }} />
      )}
      {stickers[3] && (
        <img src={stickers[3]} alt="" className="absolute z-20 pointer-events-none object-contain drop-shadow-md"
          style={{ width: '40%', height: '40%', bottom: '-12%', right: '-12%' }} />
      )}
    </div>
  );
};
