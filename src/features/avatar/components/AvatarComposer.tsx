import React, { useRef } from 'react';
import { cn } from '../../../lib/utils';
import { motion, AnimatePresence, useMotionValue, useSpring, useTransform } from 'framer-motion';

interface AvatarComposerProps {
  avatarUrl: string;
  backgroundUrl?: string;
  borderUrl?: string;
  stickerUrls?: string[];
  size?: 'sm' | 'md' | 'lg' | 'xl' | '2xl' | '3xl';
  className?: string;
  animate?: boolean;
  isFloating?: boolean;
}

export const AvatarComposer: React.FC<AvatarComposerProps> = ({
  avatarUrl,
  backgroundUrl,
  borderUrl,
  stickerUrls = [],
  size = 'md',
  className,
  animate = true,
  isFloating = true,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  
  // Parallax / 3D Tilt Hook Setup
  const x = useMotionValue(0);
  const y = useMotionValue(0);

  const mouseXSpring = useSpring(x);
  const mouseYSpring = useSpring(y);

  const rotateX = useTransform(mouseYSpring, [-0.5, 0.5], ["10deg", "-10deg"]);
  const rotateY = useTransform(mouseXSpring, [-0.5, 0.5], ["-10deg", "10deg"]);

  const handleMouseMove = (event: React.MouseEvent<HTMLDivElement>) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const width = rect.width;
    const height = rect.height;
    const mouseX = event.clientX - rect.left;
    const mouseY = event.clientY - rect.top;
    
    const xPct = (mouseX / width) - 0.5;
    const yPct = (mouseY / height) - 0.5;
    
    x.set(xPct);
    y.set(yPct);
  };

  const handleMouseLeave = () => {
    x.set(0);
    y.set(0);
  };

  const sizeClasses = {
    sm: 'w-16 h-16 rounded-[1rem]',
    md: 'w-32 h-32 rounded-[1.5rem]',
    lg: 'w-48 h-48 border-4 border-white/50 rounded-[2rem]',
    xl: 'w-64 h-64 border-[6px] border-white/50 rounded-[2.5rem]',
    '2xl': 'w-80 h-80 border-[8px] border-white/50 rounded-[3.5rem]',
    '3xl': 'w-[28rem] h-[28rem] sm:w-[32rem] sm:h-[32rem] border-[10px] border-white/50 rounded-[4rem]',
  };

  const containerVariants: any = {
    initial: { scale: 0.9, opacity: 0 },
    animate: { 
      scale: isFloating ? [1, 1.03, 1] : 1, 
      opacity: 1,
      y: isFloating ? [0, -12, 0] : 0,
      rotateZ: isFloating ? [-2, 2, -2] : 0,
    },
    hover: {
      scale: 1.08,
      y: -5,
      rotateZ: 0
    }
  };

  const containerTransition: any = {
    y: {
      duration: 3,
      repeat: Infinity,
      ease: "easeInOut"
    },
    rotateZ: {
      duration: 5,
      repeat: Infinity,
      ease: "easeInOut"
    },
    scale: { 
      duration: 4, 
      repeat: Infinity, 
      ease: "easeInOut" 
    },
    opacity: { duration: 0.4 },
    hover: { 
      type: "spring", 
      stiffness: 300, 
      damping: 15 
    }
  };

  return (
    <div 
      className="relative flex items-center justify-center p-0"
      style={{ perspective: "1000px" }}
    >
      {/* 0. Outer Glow Layer */}
      <motion.div
        animate={{ 
          scale: [1, 1.2, 1],
          opacity: [0.15, 0.3, 0.15] 
        }}
        transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
        className="absolute inset-0 bg-primary-400/30 rounded-full blur-[60px] pointer-events-none"
      />

      <motion.div
        ref={containerRef}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
        initial={animate ? "initial" : false}
        animate="animate"
        whileHover="hover"
        variants={containerVariants}
        transition={containerTransition}
        style={{
          rotateX: animate ? rotateX : 0,
          rotateY: animate ? rotateY : 0,
          transformStyle: "preserve-3d",
        }}
        className={cn(
          "relative overflow-hidden shadow-[0_20px_50px_rgba(0,0,0,0.3)] bg-white/10 backdrop-blur-md flex items-center justify-center ring-1 ring-white/20 group/compose",
          sizeClasses[size],
          className
        )}
      >
        {/* 1. Background Layer (Parallax Depth: Deep) */}
        <AnimatePresence mode="wait">
          {backgroundUrl && (
            <motion.img
              key={backgroundUrl}
              style={{ translateZ: "-40px", scale: 1.2 }}
              initial={animate ? { opacity: 0 } : false}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              src={backgroundUrl}
              className="absolute inset-0 w-full h-full object-cover"
              alt="Background"
            />
          )}
        </AnimatePresence>

        {/* 2. Character Shadows/Ambient occlusion */}
        <div className="absolute bottom-4 w-1/2 h-4 bg-black/20 blur-xl rounded-full z-[5] translate-z-[10px]" />

        {/* 3. Avatar Layer (Parallax Depth: Front) */}
        <motion.img
          key={avatarUrl || '/avatars/default-impacto.png'}
          src={avatarUrl || '/avatars/default-impacto.png'}
          style={{ translateZ: "40px" }}
          initial={{ y: 20, opacity: 0, scale: 0.8 }}
          animate={{ y: 0, opacity: 1, scale: 1 }}
          transition={{ type: "spring", stiffness: 200, damping: 20 }}
          className="relative z-10 w-[85%] h-[85%] object-contain pointer-events-none drop-shadow-[0_15px_15px_rgba(0,0,0,0.4)]"
          alt="Avatar"
        />

        {/* 4. Border Layer (Parallax Depth: Extra Front) */}
        <AnimatePresence mode="wait">
          {borderUrl && (
            <motion.img
              key={borderUrl}
              style={{ translateZ: "70px", scale: 1.05 }}
              initial={animate ? { scale: 1.2, opacity: 0 } : false}
              animate={{ scale: 1.05, opacity: 1 }}
              exit={{ scale: 1.2, opacity: 0 }}
              transition={{ duration: 0.4 }}
              src={borderUrl}
              className="absolute inset-0 z-20 w-full h-full object-contain pointer-events-none filter drop-shadow-lg"
              alt="Border"
            />
          )}
        </AnimatePresence>

        {/* 5. Stickers Layer (Parallax Depth: Variable) */}
        <div className="absolute inset-0 z-30 pointer-events-none" style={{ transformStyle: "preserve-3d" }}>
          {stickerUrls.map((url, index) => (
            <motion.img
              key={`${url}-${index}`}
              style={{ 
                translateZ: `${50 + (index * 10)}px`,
                rotateZ: (index % 2 === 0 ? 5 : -5)
              }}
              initial={animate ? { scale: 0, opacity: 0 } : false}
              animate={{ scale: 1, opacity: 1 }}
              src={url}
              className={cn(
                "absolute w-1/4 h-1/4 object-contain shadow-md",
                index === 0 && "top-3 left-3",
                index === 1 && "top-3 right-3",
                index === 2 && "bottom-3 left-3",
                index === 3 && "bottom-3 right-3"
              )}
              alt={`Sticker ${index + 1}`}
            />
          ))}
        </div>

        {/* 6. Gloss Effect Overlay */}
        <div className="absolute inset-0 z-40 bg-gradient-to-tr from-white/10 via-transparent to-white/5 pointer-events-none group-hover/compose:translate-x-full transition-transform duration-1000 ease-in-out" />
      </motion.div>
    </div>
  );
};
