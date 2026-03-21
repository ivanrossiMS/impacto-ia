import React from 'react';
import { cn } from '../../lib/utils';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'energy' | 'ai' | 'success' | 'danger';
  size?: 'sm' | 'md' | 'lg' | 'xl';
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'primary', size = 'md', ...props }, ref) => {
    const variants = {
      primary: 'bg-primary-500 text-white hover:bg-primary-600 shadow-sm active:scale-95',
      secondary: 'bg-primary-100 text-primary-700 hover:bg-primary-200 active:scale-95',
      outline: 'bg-transparent border-2 border-primary-500 text-primary-600 hover:bg-primary-50 active:scale-95',
      ghost: 'bg-transparent text-slate-500 hover:bg-slate-100 hover:text-slate-700',
      energy: 'bg-energy-500 text-white hover:bg-energy-600 shadow-sm active:scale-95',
      ai: 'bg-special-500 text-white hover:bg-special-600 shadow-md transform hover:-translate-y-0.5 transition-all',
      success: 'bg-success-500 text-white hover:bg-success-600 shadow-sm active:scale-95',
      danger: 'bg-red-500 text-white hover:bg-red-600 shadow-sm active:scale-95',
    };

    const sizes = {
      sm: 'h-9 px-4 text-xs',
      md: 'h-11 px-6 text-sm',
      lg: 'h-14 px-8 text-base',
      xl: 'h-16 px-10 text-lg',
    };

    return (
      <button
        ref={ref}
        className={cn(
          'inline-flex items-center justify-center rounded-2xl font-bold transition-all disabled:opacity-50 disabled:pointer-events-none cursor-pointer',
          variants[variant],
          sizes[size],
          className
        )}
        {...props}
      />
    );
  }
);

Button.displayName = 'Button';
