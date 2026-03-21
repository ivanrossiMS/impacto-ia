import React from 'react';
import { cn } from '../lib/utils';

import { type LucideIcon, MoreVertical } from 'lucide-react';

interface DataCardField {
  label: string;
  value: React.ReactNode;
  className?: string;
  isTitle?: boolean;
}

interface DataCardProps {
  title?: string;
  subtitle?: string;
  icon?: LucideIcon;
  iconColor?: string;
  fields: DataCardField[];
  status?: {
    label: string;
    type: 'success' | 'warning' | 'primary' | 'error' | 'neutral';
  };
  actions?: React.ReactNode;
  onClick?: () => void;
  className?: string;
}

export const DataCard: React.FC<DataCardProps> = ({
  title,
  subtitle,
  icon: Icon,
  iconColor = 'bg-slate-100 text-slate-400',
  fields,
  status,
  actions,
  onClick,
  className,
}) => {
  return (
    <div 
      onClick={onClick}
      className={cn(
        "group bg-white p-5 rounded-2xl border border-slate-100 shadow-sm hover:shadow-card hover:-translate-y-0.5 transition-all flex flex-col md:flex-row md:items-center gap-4",
        onClick && "cursor-pointer",
        className
      )}
    >
      {/* Icon & Primary Info */}
      <div className="flex items-center gap-4 flex-1">
        {Icon && (
          <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center shrink-0 shadow-inner", iconColor)}>
            <Icon size={20} />
          </div>
        )}
        <div className="min-w-0">
          {title && <h4 className="text-sm font-bold text-slate-800 truncate">{title}</h4>}
          {subtitle && <p className="text-[10px] text-slate-400 font-medium truncate">{subtitle}</p>}
        </div>
      </div>

      {/* Dynamic Fields */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:flex md:items-center gap-6 md:gap-12 flex-[2]">
        {fields.map((field, i) => (
          <div key={i} className={cn("space-y-1", field.className)}>
            <div className="text-[9px] font-black uppercase text-slate-400 tracking-widest">{field.label}</div>
            <div className={cn("text-xs font-bold text-slate-600", field.isTitle && "text-sm text-slate-800")}>
              {field.value}
            </div>
          </div>
        ))}
      </div>

      {/* Status & Actions */}
      <div className="flex items-center justify-between md:justify-end gap-4 border-t md:border-0 pt-3 md:pt-0 mt-2 md:mt-0">
        {status && (
          <span className={cn(
            "text-[9px] font-black uppercase px-2 py-1 rounded-md border",
            status.type === 'success' && "bg-success-50 text-success-600 border-success-100",
            status.type === 'warning' && "bg-warning-50 text-warning-600 border-warning-100",
            status.type === 'primary' && "bg-primary-50 text-primary-600 border-primary-100",
            status.type === 'error' && "bg-red-50 text-red-600 border-red-100",
            status.type === 'neutral' && "bg-slate-50 text-slate-600 border-slate-100"
          )}>
            {status.label}
          </span>
        )}
        
        <div className="flex items-center gap-2">
          {actions}
          <button className="p-1.5 text-slate-300 hover:text-slate-500 hover:bg-slate-50 rounded-lg transition-all">
            <MoreVertical size={16} />
          </button>
        </div>
      </div>
    </div>
  );
};
