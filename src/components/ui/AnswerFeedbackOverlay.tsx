import React, { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowRight, FlagTriangleRight } from 'lucide-react';

export type FeedbackType = 'correct' | 'wrong' | 'timeout';

interface AnswerFeedbackOverlayProps {
  feedback: FeedbackType | null;
  correctAnswerText?: string;
  explanation?: string;
  points?: number;
  duration?: number;
  manualAdvance?: boolean;
  nextLabel?: string;
  onDismiss: () => void;
}

// ── Floating particle ────────────────────────────────────────────────────────
const FloatParticle: React.FC<{
  x: number; y: number; size: number; color: string;
  delay: number; duration: number; rotation: number;
}> = ({ x, y, size, color, delay, duration, rotation }) => (
  <motion.div
    className="absolute rounded-full pointer-events-none"
    style={{ width: size, height: size, background: color, left: `${x}%`, top: `${y}%` }}
    initial={{ opacity: 0, scale: 0, rotate: 0 }}
    animate={{
      opacity: [0, 0.9, 0.7, 0],
      scale: [0, 1, 0.8, 0],
      rotate: [0, rotation],
      y: [0, -60 - Math.random() * 60],
    }}
    transition={{ delay, duration, ease: 'easeOut' }}
  />
);

// ── Star burst ───────────────────────────────────────────────────────────────
const StarBurst: React.FC<{ count: number; colors: string[] }> = ({ count, colors }) => {
  const particles = Array.from({ length: count }, (_, i) => ({
    angle: (i / count) * 360,
    dist: 80 + Math.random() * 80,
    size: 4 + Math.random() * 8,
    color: colors[i % colors.length],
    delay: i * 0.02,
    duration: 0.6 + Math.random() * 0.4,
    rotation: Math.random() * 720 - 360,
  }));
  return (
    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
      {particles.map((p, i) => {
        const rad = (p.angle * Math.PI) / 180;
        const tx = Math.cos(rad) * p.dist;
        const ty = Math.sin(rad) * p.dist;
        return (
          <motion.div
            key={i}
            className="absolute rounded-sm"
            style={{ width: p.size, height: p.size * 0.4, background: p.color }}
            initial={{ x: 0, y: 0, scale: 1, opacity: 1, rotate: 0 }}
            animate={{ x: tx, y: ty, scale: 0, opacity: 0, rotate: p.rotation }}
            transition={{ duration: p.duration, delay: p.delay, ease: 'easeOut' }}
          />
        );
      })}
    </div>
  );
};

// ── Shockwave ring ───────────────────────────────────────────────────────────
const ShockRing: React.FC<{ color: string; delay?: number; size?: number }> = ({
  color, delay = 0, size = 200
}) => (
  <motion.div
    className="absolute rounded-full pointer-events-none"
    style={{
      width: size, height: size,
      border: `3px solid ${color}`,
      left: '50%', top: '50%',
      marginLeft: -size / 2, marginTop: -size / 2,
    }}
    initial={{ scale: 0.2, opacity: 1 }}
    animate={{ scale: 3.5, opacity: 0 }}
    transition={{ duration: 0.9, delay, ease: 'easeOut' }}
  />
);

// ── Dramatic number count-up ─────────────────────────────────────────────────
const CountUp: React.FC<{ to: number }> = ({ to }) => {
  const [val, setVal] = useState(0);
  useEffect(() => {
    let frame = 0;
    const total = 24;
    const ease = (t: number) => 1 - Math.pow(1 - t, 3);
    const timer = setInterval(() => {
      frame++;
      setVal(Math.round(to * ease(frame / total)));
      if (frame >= total) clearInterval(timer);
    }, 30);
    return () => clearInterval(timer);
  }, [to]);
  return <>{val}</>;
};

// ── Main component ───────────────────────────────────────────────────────────
const CONFIGS = {
  correct: {
    backdrop: 'radial-gradient(ellipse at 50% 40%, rgba(16,185,129,0.35) 0%, rgba(0,0,0,0.92) 70%)',
    accentColor: '#10b981',
    accentLight: '#34d399',
    glowColor: 'rgba(16,185,129,0.6)',
    particles: ['#facc15', '#34d399', '#60a5fa', '#f472b6', '#a78bfa', '#fb923c', '#fff'],
    topBadge: { text: '✓ CORRETO', bg: 'rgba(16,185,129,0.2)', border: 'rgba(16,185,129,0.5)', color: '#34d399' },
    headline: 'Acertou!',
    headlineSub: 'Excelente resposta 🎯',
    headlineStyle: { color: '#ffffff', textShadow: '0 0 40px rgba(52,211,153,0.8), 0 4px 20px rgba(0,0,0,0.5)' },
    btnBg: 'linear-gradient(135deg, #10b981, #059669)',
    btnGlow: 'rgba(16,185,129,0.5)',
    icon: '✓',
    iconBg: 'radial-gradient(circle, rgba(16,185,129,0.4) 0%, transparent 70%)',
    ringColors: ['#34d399', '#6ee7b7'],
  },
  wrong: {
    backdrop: 'radial-gradient(ellipse at 50% 40%, rgba(239,68,68,0.35) 0%, rgba(0,0,0,0.92) 70%)',
    accentColor: '#ef4444',
    accentLight: '#f87171',
    glowColor: 'rgba(239,68,68,0.6)',
    particles: ['#f87171', '#fca5a5', '#fed7aa', '#fdba74', '#fff'],
    topBadge: { text: '✗ ERROU', bg: 'rgba(239,68,68,0.2)', border: 'rgba(239,68,68,0.5)', color: '#f87171' },
    headline: 'Errou!',
    headlineSub: 'Não foi dessa vez 💪',
    headlineStyle: { color: '#ffffff', textShadow: '0 0 40px rgba(248,113,113,0.8), 0 4px 20px rgba(0,0,0,0.5)' },
    btnBg: 'linear-gradient(135deg, #ef4444, #b91c1c)',
    btnGlow: 'rgba(239,68,68,0.5)',
    icon: '✗',
    iconBg: 'radial-gradient(circle, rgba(239,68,68,0.4) 0%, transparent 70%)',
    ringColors: ['#f87171', '#fca5a5'],
  },
  timeout: {
    backdrop: 'radial-gradient(ellipse at 50% 40%, rgba(234,179,8,0.35) 0%, rgba(0,0,0,0.92) 70%)',
    accentColor: '#eab308',
    accentLight: '#facc15',
    glowColor: 'rgba(234,179,8,0.6)',
    particles: ['#facc15', '#fbbf24', '#fb923c', '#fde68a', '#fff'],
    topBadge: { text: '⏱ TEMPO', bg: 'rgba(234,179,8,0.2)', border: 'rgba(234,179,8,0.5)', color: '#facc15' },
    headline: 'Tempo!',
    headlineSub: 'O tempo acabou ⏰',
    headlineStyle: { color: '#ffffff', textShadow: '0 0 40px rgba(250,204,21,0.8), 0 4px 20px rgba(0,0,0,0.5)' },
    btnBg: 'linear-gradient(135deg, #eab308, #a16207)',
    btnGlow: 'rgba(234,179,8,0.5)',
    icon: '⏱',
    iconBg: 'radial-gradient(circle, rgba(234,179,8,0.4) 0%, transparent 70%)',
    ringColors: ['#facc15', '#fde68a'],
  },
} as const;

// ── Random float particles ────────────────────────────────────────────────────
const FLOAT_PARTICLES = Array.from({ length: 22 }, (_) => ({
  x: 5 + Math.random() * 90,
  y: 10 + Math.random() * 80,
  size: 4 + Math.random() * 10,
  delay: Math.random() * 0.5,
  duration: 1.2 + Math.random() * 1.0,
  rotation: Math.random() * 720 - 360,
}));

export const AnswerFeedbackOverlay: React.FC<AnswerFeedbackOverlayProps> = ({
  feedback,
  correctAnswerText,
  explanation,
  points,
  duration = 2200,
  manualAdvance = false,
  nextLabel = 'Próxima Pergunta',
  onDismiss,
}) => {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isLastQ = nextLabel.toLowerCase().includes('resultado');

  useEffect(() => {
    if (!feedback || manualAdvance) return;
    timerRef.current = setTimeout(onDismiss, duration);
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, [feedback, duration, onDismiss, manualAdvance]);

  const cfg = feedback ? CONFIGS[feedback] : CONFIGS.correct;
  const isCorrect = feedback === 'correct';
  const isWrong   = feedback === 'wrong';
  const isTimeout = feedback === 'timeout';
  const showCorrectAnswer = (isWrong || isTimeout) && correctAnswerText;

  return (
    <AnimatePresence>
      {feedback && (
        <motion.div
          className="fixed inset-0 z-[999] flex items-center justify-center overflow-hidden"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
        >
          {/* ── Cinematic backdrop ── */}
          <motion.div
            className="absolute inset-0"
            style={{ background: cfg.backdrop }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25 }}
            onClick={manualAdvance ? undefined : onDismiss}
          />

          {/* ── Background pulse rings ── */}
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <ShockRing color={cfg.accentColor} delay={0}    size={100} />
            <ShockRing color={cfg.accentColor} delay={0.15} size={100} />
            <ShockRing color={cfg.accentColor} delay={0.32} size={100} />
          </div>

          {/* ── Floating particles ── */}
          <AnimatePresence>
            {FLOAT_PARTICLES.map((p, i) => (
              <FloatParticle
                key={i}
                {...p}
                color={cfg.particles[i % cfg.particles.length]}
              />
            ))}
          </AnimatePresence>

          {/* ── Starburst (correct only) ── */}
          {isCorrect && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <StarBurst count={28} colors={[...cfg.particles]} />
            </div>
          )}

          {/* ── Main card ── */}
          <motion.div
            className="relative z-10 w-full max-w-sm mx-4 pointer-events-auto"
            initial={{ scale: 0.5, y: 60, opacity: 0, rotateX: -25 }}
            animate={{ scale: 1, y: 0, opacity: 1, rotateX: 0 }}
            exit={{ scale: 0.7, y: -50, opacity: 0, rotateX: 15 }}
            transition={{ type: 'spring', stiffness: 480, damping: 28, mass: 0.7 }}
            style={{ perspective: 1000 }}
          >
            {/* Glow under card */}
            <div
              className="absolute -inset-8 rounded-[3rem] blur-3xl opacity-50 pointer-events-none"
              style={{ background: cfg.glowColor }}
            />

            <div
              className="relative rounded-[2rem] overflow-hidden border border-white/10"
              style={{
                background: 'linear-gradient(160deg, rgba(255,255,255,0.07) 0%, rgba(0,0,0,0.6) 100%)',
                backdropFilter: 'blur(30px)',
                boxShadow: `0 0 0 1px rgba(255,255,255,0.08), 0 30px 60px rgba(0,0,0,0.7), inset 0 1px 0 rgba(255,255,255,0.1)`,
              }}
            >
              {/* ── Top accent bar ── */}
              <motion.div
                className="h-1.5 w-full"
                style={{ background: `linear-gradient(90deg, transparent, ${cfg.accentLight}, ${cfg.accentColor}, transparent)` }}
                initial={{ scaleX: 0 }}
                animate={{ scaleX: 1 }}
                transition={{ delay: 0.3, duration: 0.5 }}
              />

              <div className="px-7 pt-6 pb-7 flex flex-col items-center text-center gap-5">
                {/* ── Top badge ── */}
                <motion.div
                  className="px-5 py-1.5 rounded-full text-[10px] font-black uppercase tracking-[0.25em]"
                  style={{
                    background: cfg.topBadge.bg,
                    border: `1.5px solid ${cfg.topBadge.border}`,
                    color: cfg.topBadge.color,
                  }}
                  initial={{ opacity: 0, y: -10, scale: 0.8 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  transition={{ delay: 0.25 }}
                >
                  {cfg.topBadge.text}
                </motion.div>

                {/* ── Icon orb ── */}
                <div className="relative">
                  {/* Big ambient glow */}
                  <div
                    className="absolute inset-0 rounded-full blur-2xl scale-150 opacity-60 pointer-events-none"
                    style={{ background: cfg.accentColor }}
                  />
                  <motion.div
                    className="relative w-20 h-20 rounded-full flex items-center justify-center"
                    style={{
                      background: cfg.iconBg,
                      border: `2px solid ${cfg.accentColor}66`,
                      boxShadow: `0 0 0 8px ${cfg.accentColor}18, 0 0 30px ${cfg.accentColor}55`,
                    }}
                    initial={{ scale: 0, rotate: isCorrect ? 0 : -30 }}
                    animate={isCorrect
                      ? { scale: [0, 1.4, 0.88, 1.12, 1.0], rotate: [0, 10, -5, 3, 0] }
                      : { scale: [0, 1.3, 0.85, 1.05, 1.0], rotate: [-30, 15, -8, 3, 0] }
                    }
                    transition={{ type: 'spring', stiffness: 500, damping: 18, delay: 0.1 }}
                  >
                    <motion.span
                      className="text-3xl font-black select-none"
                      style={{ color: cfg.accentLight }}
                      animate={isCorrect
                        ? { textShadow: [`0 0 10px ${cfg.accentColor}`, `0 0 30px ${cfg.accentColor}`, `0 0 10px ${cfg.accentColor}`] }
                        : {}}
                      transition={{ duration: 1.2, repeat: Infinity }}
                    >
                      {cfg.icon}
                    </motion.span>
                  </motion.div>
                </div>

                {/* ── Headline ── */}
                <motion.div
                  initial={{ opacity: 0, y: 16, scale: 0.85 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  transition={{ delay: 0.22, type: 'spring', stiffness: 400, damping: 20 }}
                >
                  <div
                    className="text-5xl font-black leading-none tracking-tight mb-1"
                    style={cfg.headlineStyle}
                  >
                    {cfg.headline}
                  </div>
                  <div className="text-sm font-medium text-white/50 mt-1">
                    {cfg.headlineSub}
                  </div>
                </motion.div>

                {/* ── Points (correct) ── */}
                {isCorrect && points !== undefined && points > 0 && (
                  <motion.div
                    className="flex items-baseline gap-1"
                    initial={{ opacity: 0, scale: 0.5 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: 0.4, type: 'spring', stiffness: 500, damping: 18 }}
                  >
                    <span
                      className="text-4xl font-black tabular-nums"
                      style={{ color: cfg.accentLight, textShadow: `0 0 20px ${cfg.accentColor}` }}
                    >
                      +<CountUp to={points} />
                    </span>
                    <span className="text-base font-black text-white/50">pts</span>
                  </motion.div>
                )}

                {/* ── Correct answer reveal (wrong / timeout) ── */}
                {showCorrectAnswer && (
                  <motion.div
                    className="w-full"
                    initial={{ opacity: 0, y: 12, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    transition={{ delay: 0.35, type: 'spring', stiffness: 350 }}
                  >
                    <div
                      className="text-[9px] font-black uppercase tracking-[0.22em] mb-2"
                      style={{ color: `${cfg.accentLight}99` }}
                    >
                      Resposta Correta
                    </div>
                    <div
                      className="rounded-xl px-4 py-3 text-sm font-bold text-white text-left leading-snug flex items-start gap-2"
                      style={{
                        background: `${cfg.accentColor}18`,
                        border: `1.5px solid ${cfg.accentColor}44`,
                      }}
                    >
                      <span style={{ color: cfg.accentLight }}>✓</span>
                      <span className="text-white/90">{correctAnswerText}</span>
                    </div>
                  </motion.div>
                )}

                {/* ── Explanation ── */}
                {explanation && (
                  <motion.p
                    className="text-xs text-white/40 font-medium leading-relaxed max-w-xs"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.5 }}
                  >
                    {explanation}
                  </motion.p>
                )}

                {/* ── Manual advance button ── */}
                {manualAdvance ? (
                  <motion.button
                    initial={{ opacity: 0, y: 10, scale: 0.9 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    transition={{ delay: 0.5, type: 'spring', stiffness: 400 }}
                    whileHover={{ scale: 1.03, y: -2 }}
                    whileTap={{ scale: 0.96 }}
                    onClick={onDismiss}
                    className="w-full flex items-center justify-center gap-2.5 py-4 rounded-2xl font-black text-white text-sm mt-1 relative overflow-hidden"
                    style={{
                      background: cfg.btnBg,
                      boxShadow: `0 8px 28px ${cfg.btnGlow}, inset 0 1px 0 rgba(255,255,255,0.2)`,
                    }}
                  >
                    {/* Shimmer sweep */}
                    <motion.div
                      className="absolute inset-0 pointer-events-none"
                      style={{ background: 'linear-gradient(105deg, transparent 40%, rgba(255,255,255,0.18) 50%, transparent 60%)' }}
                      initial={{ x: '-100%' }}
                      animate={{ x: '200%' }}
                      transition={{ delay: 0.7, duration: 0.7, ease: 'easeInOut' }}
                    />
                    {isLastQ ? <FlagTriangleRight size={16} /> : <ArrowRight size={16} />}
                    {nextLabel}
                  </motion.button>
                ) : (
                  <>
                    <motion.div className="w-full h-0.5 bg-white/10 rounded-full overflow-hidden">
                      <motion.div
                        className="h-full rounded-full"
                        style={{ background: cfg.accentColor }}
                        initial={{ width: '100%' }}
                        animate={{ width: '0%' }}
                        transition={{ duration: duration / 1000, ease: 'linear' }}
                      />
                    </motion.div>
                    <motion.p
                      className="text-[10px] text-white/25 font-medium -mt-2"
                      animate={{ opacity: [0.25, 0.55, 0.25] }}
                      transition={{ duration: 1.6, repeat: Infinity }}
                    >
                      Toque para continuar
                    </motion.p>
                  </>
                )}
              </div>

              {/* ── Bottom accent bar ── */}
              <motion.div
                className="h-0.5 w-full"
                style={{ background: `linear-gradient(90deg, transparent, ${cfg.accentColor}55, transparent)` }}
              />
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
