import React, { useEffect, useRef, useCallback } from 'react';

interface Achievement {
  id: string;
  title: string;
  description?: string;
  icon?: string;
  xpReward?: number;
  coinsReward?: number;
}

interface Props {
  achievement: Achievement;
  onClose: () => void;
}

// Pure CSS/Canvas confetti — no external deps
function launchConfetti(canvas: HTMLCanvasElement) {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;

  const colors = ['#6366f1', '#f59e0b', '#10b981', '#f43f5e', '#8b5cf6', '#fbbf24', '#34d399'];
  const particles: { x: number; y: number; vx: number; vy: number; r: number; color: string; rot: number; rotSpeed: number; alpha: number }[] = [];

  for (let i = 0; i < 180; i++) {
    particles.push({
      x: canvas.width / 2,
      y: canvas.height / 2,
      vx: (Math.random() - 0.5) * 18,
      vy: (Math.random() - 0.5) * 18 - 8,
      r: Math.random() * 7 + 3,
      color: colors[Math.floor(Math.random() * colors.length)],
      rot: Math.random() * 360,
      rotSpeed: (Math.random() - 0.5) * 10,
      alpha: 1,
    });
  }

  let frame: number;
  const draw = () => {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    let any = false;
    particles.forEach(p => {
      p.vy += 0.3; // gravity
      p.x += p.vx;
      p.y += p.vy;
      p.rot += p.rotSpeed;
      p.alpha -= 0.008;
      if (p.alpha <= 0) return;
      any = true;
      ctx.save();
      ctx.globalAlpha = p.alpha;
      ctx.translate(p.x, p.y);
      ctx.rotate((p.rot * Math.PI) / 180);
      ctx.fillStyle = p.color;
      ctx.fillRect(-p.r / 2, -p.r / 2, p.r, p.r * 2);
      ctx.restore();
    });
    if (any) frame = requestAnimationFrame(draw);
  };
  draw();
  return () => cancelAnimationFrame(frame);
}

export const AchievementUnlockModal: React.FC<Props> = ({ achievement, onClose }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const cleanupRef = useRef<(() => void) | undefined>(undefined);

  useEffect(() => {
    if (canvasRef.current) {
      cleanupRef.current = launchConfetti(canvasRef.current) ?? undefined;
    }
    const timer = setTimeout(onClose, 6000);
    return () => {
      clearTimeout(timer);
      cleanupRef.current?.();
    };
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(10px)' }}
      onClick={onClose}
    >
      {/* Canvas confetti layer */}
      <canvas
        ref={canvasRef}
        className="fixed inset-0 pointer-events-none"
        style={{ zIndex: 10000 }}
      />

      {/* Modal card */}
      <div
        className="relative bg-white rounded-[2.5rem] shadow-2xl max-w-sm w-full text-center overflow-hidden animate-in zoom-in-95 duration-500"
        style={{ zIndex: 10001 }}
        onClick={e => e.stopPropagation()}
      >
        {/* Gold gradient shimmer */}
        <div className="absolute inset-0 bg-gradient-to-br from-amber-400/10 via-yellow-300/5 to-orange-400/10" />

        <div className="relative z-10 p-10 space-y-6">
          {/* Badge */}
          <div className="relative flex items-center justify-center">
            <div className="absolute w-32 h-32 bg-yellow-300/50 rounded-full blur-3xl animate-pulse" />
            <div className="relative w-28 h-28 bg-gradient-to-br from-amber-400 to-orange-400 rounded-full flex items-center justify-center shadow-2xl border-4 border-white"
              style={{ animation: 'badge-bounce 0.6s ease-out' }}>
              <span className="text-5xl" role="img">{achievement.icon || '🏅'}</span>
            </div>
          </div>

          {/* Text */}
          <div className="space-y-2">
            <div className="text-[11px] font-black uppercase tracking-[0.25em] text-amber-500">
              🏆 Conquista Desbloqueada!
            </div>
            <h2 className="text-2xl font-black text-slate-800 leading-tight">{achievement.title}</h2>
            {achievement.description && (
              <p className="text-sm font-medium text-slate-500 leading-relaxed">{achievement.description}</p>
            )}
          </div>

          {/* Rewards */}
          {(achievement.xpReward || achievement.coinsReward) && (
            <div className="flex items-center justify-center gap-3">
              {achievement.xpReward && (
                <div className="flex items-center gap-2 bg-primary-50 border border-primary-100 px-4 py-2 rounded-xl">
                  <span className="text-lg">⚡</span>
                  <span className="font-black text-primary-700 text-sm">+{achievement.xpReward} XP</span>
                </div>
              )}
              {achievement.coinsReward && (
                <div className="flex items-center gap-2 bg-yellow-50 border border-yellow-100 px-4 py-2 rounded-xl">
                  <span className="text-lg">🪙</span>
                  <span className="font-black text-yellow-700 text-sm">+{achievement.coinsReward}</span>
                </div>
              )}
            </div>
          )}

          {/* CTA */}
          <div className="space-y-2">
            <button
              onClick={onClose}
              className="w-full py-3.5 bg-gradient-to-r from-amber-500 to-orange-500 text-white font-black rounded-2xl shadow-xl hover:opacity-90 transition-all active:scale-95 text-lg"
            >
              Incrível! 🎉
            </button>
            <p className="text-xs text-slate-400 font-medium">Fecha em 6 segundos</p>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes badge-bounce {
          0% { transform: scale(0.5) rotate(-10deg); opacity: 0; }
          60% { transform: scale(1.15) rotate(5deg); }
          80% { transform: scale(0.95) rotate(-2deg); }
          100% { transform: scale(1) rotate(0deg); opacity: 1; }
        }
      `}</style>
    </div>
  );
};

// ─── Hook ───────────────────────────────────────────────────────────────────
export function useAchievementUnlock(userId: string | undefined) {
  const [queue, setQueue] = React.useState<Achievement[]>([]);
  const seenKey = `impacto_seen_ach_${userId}`;

  const checkForNew = useCallback(async () => {
    if (!userId) return;
    try {
      const { supabase } = await import('../../lib/supabase');
      const { data: rows } = await supabase
        .from('student_achievements')
        .select('id, unlockedAt, achievement:achievementId(id, title, description, icon, rewardXp, rewardCoins)')
        .eq('studentId', userId)
        .order('unlockedAt', { ascending: false })
        .limit(10);

      if (!rows?.length) return;

      const seen: string[] = JSON.parse(localStorage.getItem(seenKey) ?? '[]');
      const fresh = rows.filter(r => !seen.includes(r.id));
      if (!fresh.length) return;

      const mapped: Achievement[] = fresh.map(r => {
        const ach = r.achievement as any;
        return {
          id: r.id,
          title: ach?.title || 'Nova Conquista',
          description: ach?.description,
          icon: ach?.icon,
          xpReward: ach?.rewardXp,     // DB column: rewardXp
          coinsReward: ach?.rewardCoins, // DB column: rewardCoins
        };
      });


      setQueue(prev => [...prev, ...mapped]);
      localStorage.setItem(seenKey, JSON.stringify([...seen, ...fresh.map(r => r.id)]));
    } catch { /* silent */ }
  }, [userId, seenKey]);

  const clearFirst = useCallback(() => setQueue(prev => prev.slice(1)), []);

  return { firstInQueue: queue[0] ?? null, clearFirst, checkForNew };
}
