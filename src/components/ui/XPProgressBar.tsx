import React from 'react';
import { cn } from '../../lib/utils';
import { motion } from 'framer-motion';

interface XPProgressBarProps {
  currentXP: number;
  targetXP: number;
  level: number;
  className?: string;
}

export const XPProgressBar: React.FC<XPProgressBarProps> = ({ currentXP, targetXP, level, className }) => {
  const percentage = Math.min(Math.round((currentXP / targetXP) * 100), 100);

  return (
    <div className={cn("space-y-2", className)}>
      <div className="flex justify-between items-end">
        <div className="flex flex-col">
          <span className="text-xs font-black text-slate-400 uppercase tracking-widest">Nível</span>
          <span className="text-3xl font-black text-primary-600 leading-none">{level}</span>
        </div>
        <div className="text-right">
          <span className="text-xs font-black text-slate-400 uppercase tracking-widest">Progresso</span>
          <div className="flex items-baseline gap-1">
            <span className="text-lg font-black text-slate-700">{currentXP}</span>
            <span className="text-xs font-bold text-slate-400">/ {targetXP} XP</span>
          </div>
        </div>
      </div>
      
      <div className="h-4 bg-slate-100 rounded-full overflow-hidden border border-slate-200 p-0.5">
        <motion.div 
          initial={{ width: 0 }}
          animate={{ width: `${percentage}%` }}
          transition={{ duration: 1, ease: "easeOut" }}
          className="h-full bg-gradient-to-r from-primary-400 via-primary-500 to-special-400 rounded-full relative"
        >
          <div className="absolute inset-0 bg-[linear-gradient(45deg,rgba(255,255,255,0.2)_25%,transparent_25%,transparent_50%,rgba(255,255,255,0.2)_50%,rgba(255,255,255,0.2)_75%,transparent_75%,transparent)] bg-[length:24px_24px] animate-[pulse_2s_infinite]" />
        </motion.div>
      </div>
    </div>
  );
};
