import React from 'react';
import { cn } from '../../lib/utils';

interface BadgeProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'primary' | 'energy' | 'success' | 'warning' | 'ai' | 'danger' | 'outline';
}

export const Badge: React.FC<BadgeProps> = ({ className, variant = 'primary', ...props }) => {
  const variants = {
    primary: 'bg-primary-50 text-primary-600 border-primary-200',
    energy: 'bg-energy-50 text-energy-600 border-energy-200',
    success: 'bg-success-50 text-success-600 border-success-200',
    warning: 'bg-warning-50 text-warning-600 border-warning-200',
    danger: 'bg-red-50 text-red-600 border-red-200',
    outline: 'bg-transparent text-slate-500 border-slate-200',
    ai: 'bg-special-50 text-special-600 border-special-200 shadow-sm',
  };

  return (
    <div
      className={cn(
        'inline-flex items-center px-3 py-1 rounded-full text-xs font-black border uppercase tracking-wider',
        variants[variant],
        className
      )}
      {...props}
    />
  );
};
