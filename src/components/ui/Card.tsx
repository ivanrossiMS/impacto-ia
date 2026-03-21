import React from 'react';
import { cn } from '../../lib/utils';

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'default' | 'glass' | 'premium';
}

export const Card = React.forwardRef<HTMLDivElement, CardProps>(
  ({ className, variant = 'default', ...props }, ref) => {
    const variants = {
      default: 'bg-surface border border-slate-200 shadow-card',
      glass: 'bg-white/70 backdrop-blur-md border border-white/40 shadow-card',
      premium: 'bg-surface border-2 border-primary-100 shadow-floating hover:shadow-card-hover transition-all duration-300',
    };

    return (
      <div
        ref={ref}
        className={cn('rounded-3xl p-6', variants[variant], className)}
        {...props}
      />
    );
  }
);

Card.displayName = 'Card';
