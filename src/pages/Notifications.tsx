import React, { useState } from 'react';
import { Bell, Check, Flag, MailOpen, Trash2, Sparkles, Zap } from 'lucide-react';
import { useAuthStore } from '../store/auth.store';
import { db } from '../lib/dexie';
import { useLiveQuery } from 'dexie-react-hooks';
import { clsx } from 'clsx';
import { toast } from 'sonner';

export const Notifications: React.FC = () => {
  const { user } = useAuthStore();
  const [filter, setFilter] = useState<'all' | 'unread'>('all');

  // Load real notifications from Dexie
  const notifications = useLiveQuery(async () => {
    if (!user) return [];
    return await db.notifications
      .where('userId').equals(user.id)
      .reverse()
      .sortBy('createdAt');
  }, [user]) || [];

  const filteredList = filter === 'all' ? notifications : notifications.filter(n => !n.read);

  const getIcon = (type: string) => {
    switch(type) {
      case 'reward': return <div className="p-2.5 bg-warning-50 text-warning-500 rounded-2xl shadow-sm"><Flag size={20} className="fill-warning-500" /></div>;
      case 'alert': return <div className="p-2.5 bg-red-50 text-red-500 rounded-2xl shadow-sm"><Bell size={20} /></div>;
      case 'warning': return <div className="p-2.5 bg-orange-50 text-orange-500 rounded-2xl shadow-sm"><Bell size={20} /></div>;
      case 'success': return <div className="p-2.5 bg-success-50 text-success-500 rounded-2xl shadow-sm"><Check size={20} /></div>;
      case 'system': return <div className="p-2.5 bg-special-50 text-special-500 rounded-2xl shadow-sm"><Sparkles size={20} /></div>;
      default: return <div className="p-2.5 bg-primary-50 text-primary-500 rounded-2xl shadow-sm"><Bell size={20} /></div>;
    }
  };

  const handleMarkAsRead = async (id: string) => {
    await db.notifications.update(id, { read: true });
    toast.success('Notificação lida');
  };

  const handleMarkAllAsRead = async () => {
    if (!user) return;
    const unread = notifications.filter(n => !n.read);
    await Promise.all(unread.map(n => db.notifications.update(n.id, { read: true })));
    toast.success('Todas as notificações foram marcadas como lidas');
  };

  const handleDelete = async (id: string) => {
    await db.notifications.delete(id);
    toast.success('Notificação removida');
  };

  const formatTime = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    
    if (diff < 60000) return 'Agora mesmo';
    if (diff < 3600000) return `Há ${Math.floor(diff / 60000)} min`;
    if (diff < 86400000) return `Há ${Math.floor(diff / 3600000)} h`;
    return date.toLocaleDateString('pt-BR');
  };

  return (
    <div className="max-w-4xl mx-auto space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-500 pb-20 mt-6 px-4">
      <header className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-6">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-primary-600 mb-1">
            <Bell size={18} className="stroke-[3]" />
            <span className="text-[10px] font-black uppercase tracking-[0.2em]">Centro de Alertas</span>
          </div>
          <h1 className="text-4xl font-black text-slate-800 tracking-tight leading-none">Notificações</h1>
          <p className="text-slate-500 font-medium text-sm">Fique por dentro de tudo o que acontece na plataforma.</p>
        </div>
        
        <div className="flex items-center gap-3">
          <div className="flex bg-slate-100 p-1.5 rounded-2xl border border-slate-200 shadow-inner">
            <button
              onClick={() => setFilter('all')}
              className={clsx(
                "px-5 py-2.5 rounded-xl font-black text-[10px] uppercase tracking-wider transition-all",
                filter === 'all' ? "bg-white text-slate-800 shadow-md" : "text-slate-500 hover:text-slate-700"
              )}
            >
              Todas
            </button>
            <button
              onClick={() => setFilter('unread')}
              className={clsx(
                "px-5 py-2.5 rounded-xl font-black text-[10px] uppercase tracking-wider transition-all flex items-center gap-2",
                filter === 'unread' ? "bg-white text-slate-800 shadow-md" : "text-slate-500 hover:text-slate-700"
              )}
            >
              Não lidas
              {notifications.filter(n => !n.read).length > 0 && (
                <span className="w-5 h-5 bg-primary-500 text-white text-[9px] items-center justify-center flex rounded-lg shadow-sm">
                  {notifications.filter(n => !n.read).length}
                </span>
              )}
            </button>
          </div>
          <button 
             onClick={handleMarkAllAsRead}
             disabled={notifications.filter(n => !n.read).length === 0}
             className="p-3 text-slate-400 hover:text-primary-600 bg-white border border-slate-200 rounded-2xl shadow-sm hover:border-primary-200 transition-all disabled:opacity-50 disabled:cursor-not-allowed group relative"
          >
             <MailOpen size={20} />
             <span className="absolute -bottom-10 left-1/2 -translate-x-1/2 whitespace-nowrap bg-slate-800 text-white text-[10px] font-black uppercase tracking-widest px-3 py-1.5 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none shadow-xl">
               Ler todas
             </span>
          </button>
        </div>
      </header>

      <div className="bg-white rounded-[2.5rem] border border-slate-100 shadow-card overflow-hidden">
        {filteredList.length === 0 ? (
           <div className="flex flex-col items-center justify-center p-20 text-center">
              <div className="w-24 h-24 bg-slate-50 rounded-full flex items-center justify-center mb-6 border border-slate-50 ring-8 ring-slate-50/50">
                 <Check size={40} className="text-slate-200" />
              </div>
              <h3 className="text-2xl font-black text-slate-700 tracking-tight">Tudo limpo por aqui!</h3>
              <p className="text-slate-400 font-medium text-sm mt-2 max-w-xs">Você não tem novas notificações no momento. Aproveite o tempo para estudar!</p>
           </div>
        ) : (
           <div className="divide-y divide-slate-50">
             {filteredList.map((notification) => (
                <div 
                  key={notification.id} 
                  className={clsx(
                    "p-8 flex items-start gap-6 transition-all hover:bg-slate-50 group",
                    !notification.read ? "bg-primary-50/20" : "bg-white"
                  )}
                >
                  <div className="flex-shrink-0 relative">
                     {getIcon(notification.type)}
                     {!notification.read && (
                        <div className="absolute -top-1 -right-1 w-3.5 h-3.5 bg-primary-500 rounded-full border-2 border-white shadow-sm transition-transform group-hover:scale-110"></div>
                     )}
                  </div>
                  
                  <div className="flex-1 min-w-0">
                     <div className="flex justify-between items-start mb-2 gap-4">
                        <h4 className={clsx(
                          "text-lg truncate flex items-center gap-3",
                          !notification.read ? "font-black text-slate-900" : "font-bold text-slate-700"
                        )}>
                           {notification.title}
                           {notification.priority === 'high' && (
                              <span className="px-2 py-0.5 bg-red-100 text-red-600 text-[9px] uppercase font-black tracking-widest rounded-lg border border-red-200">
                                Importante
                              </span>
                           )}
                        </h4>
                        <span className="text-[10px] font-black text-slate-300 uppercase tracking-widest whitespace-nowrap mt-1.5 group-hover:text-slate-400 transition-colors">
                           {formatTime(notification.createdAt)}
                        </span>
                     </div>
                     <p className="text-slate-500 font-medium leading-relaxed">{notification.message}</p>
                  </div>

                  <div className="opacity-0 group-hover:opacity-100 transition-all flex items-center gap-2 translate-x-2 group-hover:translate-x-0">
                     {!notification.read && (
                       <button 
                         onClick={() => handleMarkAsRead(notification.id)}
                         className="p-2.5 text-primary-600 hover:bg-primary-100/50 rounded-xl transition-colors shadow-sm bg-white border border-primary-50" 
                         title="Marcar como lida"
                       >
                         <Check size={18} />
                       </button>
                     )}
                     <button 
                       onClick={() => handleDelete(notification.id)}
                       className="p-2.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-colors shadow-sm bg-white border border-slate-100" 
                       title="Remover"
                     >
                       <Trash2 size={18} />
                     </button>
                  </div>
                </div>
             ))}
           </div>
        )}
      </div>

      <div className="bg-slate-900 rounded-[2rem] p-8 text-white relative overflow-hidden shadow-2xl">
         <div className="absolute top-0 right-0 w-64 h-64 bg-primary-500/20 rounded-full blur-[80px] -mr-32 -mt-32" />
         <div className="relative z-10 flex flex-col md:flex-row items-center gap-6 justify-between">
            <div className="space-y-2 text-center md:text-left">
               <h3 className="text-xl font-black">Mantenha seu Foco!</h3>
               <p className="text-slate-400 text-sm font-medium">As notificações ajudam você a não perder prazos e ganhar recompensas.</p>
            </div>
            <div className="w-16 h-16 bg-white/10 rounded-2xl flex items-center justify-center text-warning-400 border border-white/20 shadow-xl">
               <Zap size={32} fill="currentColor" />
            </div>
         </div>
      </div>
    </div>
  );
};
