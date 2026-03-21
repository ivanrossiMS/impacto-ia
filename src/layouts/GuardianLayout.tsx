import React from 'react';
import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { Home, BarChart3, Bell, LogOut, Menu, Calendar, BrainCircuit, Heart, User, Trophy, Sword, LifeBuoy } from 'lucide-react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../lib/dexie';

import { useAuthStore } from '../store/auth.store';
import { useUIStore } from '../store/ui.store';
import { cn } from '../lib/utils';

export const GuardianLayout: React.FC = () => {
  const { user, logout } = useAuthStore();
  const { isSidebarOpen, setSidebarOpen } = useUIStore();
  const navigate = useNavigate();

  const unreadSupportCount = useLiveQuery(async () => {
    if (!user) return 0;
    try {
      return await db.supportTickets
        .where('userId').equals(user.id)
        .and(t => !t.isReadByParticipant)
        .count();
    } catch (e) {
      return 0;
    }
  }, [user]) || 0;

  const schoolLogo = useLiveQuery(async () => {
    if (!user?.schoolId) return null;
    const school = await db.schools.get(user.schoolId);
    return school?.logo || null;
  }, [user?.schoolId]);

  const unreadCount = useLiveQuery(async () => {
    if (!user) return 0;
    return await db.notifications
      .where('userId').equals(user.id)
      .and(n => !n.read)
      .count();
  }, [user]) || 0;

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const navItems = [
    { to: '/guardian', icon: Home, label: 'Dashboard', end: true },
    { to: '/guardian/diary', icon: Calendar, label: 'Diário do Aluno' },
    { to: '/guardian/tips', icon: BrainCircuit, label: 'Dicas Parentais' },
    { to: '/guardian/reports', icon: BarChart3, label: 'Desempenho' },
    { to: '/guardian/duels', icon: Sword, label: 'Duelos' },
    { to: '/guardian/ranking', icon: Trophy, label: 'Ranking da Turma' },
    { to: '/guardian/profile', icon: User, label: 'Meu Perfil' },

  ];

  return (
    <div className="min-h-screen bg-background flex">
      {/* Sidebar Overlay (Mobile) */}
      {isSidebarOpen && (
        <div 
          className="fixed inset-0 bg-slate-900/20 backdrop-blur-sm z-40 md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside className={cn(
        "fixed inset-y-0 left-0 z-50 w-72 bg-surface border-r border-slate-100 transform transition-transform duration-300 ease-out md:translate-x-0 md:static flex flex-col shadow-floating md:shadow-card",
        isSidebarOpen ? "translate-x-0" : "-translate-x-full"
      )}>
        <div className="p-6 flex items-center justify-between">
          <div className="flex items-center gap-3 text-slate-900">
            <div className="w-10 h-10 bg-primary-100 rounded-xl flex items-center justify-center text-primary-600 shadow-inner">
              <Heart size={24} />
            </div>
            <span className="text-2xl font-extrabold tracking-tight">Impacto IA</span>
          </div>
          <button className="md:hidden text-slate-400 hover:text-slate-600" onClick={() => setSidebarOpen(false)}>
            <Menu size={24} />
          </button>
        </div>

        <nav className="flex-1 px-4 space-y-2 mt-4 overflow-y-auto">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              onClick={() => { if(window.innerWidth < 768) setSidebarOpen(false) }}
              className={({ isActive }) => cn(
                "flex items-center gap-3 px-4 py-3.5 rounded-2xl font-bold transition-all",
                isActive 
                  ? "bg-slate-900 text-white shadow-lg" 
                  : "text-slate-500 hover:bg-slate-50 hover:text-slate-700 border border-transparent"
              )}
            >
              <item.icon size={22} className={cn("transition-colors")} />
              {item.label}
            </NavLink>
          ))}
        </nav>

        <div className="p-6 border-t border-slate-100">
          <button 
            onClick={handleLogout}
            className="flex items-center justify-center gap-2 text-slate-500 hover:text-red-500 hover:bg-red-50 transition-colors px-4 py-3 rounded-xl w-full font-bold text-sm"
          >
            <LogOut size={18} /> Sair da conta
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Topbar */}
        <header className="h-20 bg-background/80 backdrop-blur-md px-4 sm:px-8 flex items-center justify-between sticky top-0 z-30">
          <button 
            className="md:hidden p-2 rounded-xl bg-white shadow-sm border border-slate-100 text-slate-600"
            onClick={() => setSidebarOpen(true)}
          >
            <Menu size={24} />
          </button>
          
          <div className="flex flex-1 items-center gap-3">
            {schoolLogo && (
              <div className="w-12 h-12 bg-white rounded-2xl border border-slate-100 flex items-center justify-center overflow-hidden shadow-sm p-1.5">
                <img src={schoolLogo} alt="School Logo" className="w-full h-full object-contain" />
              </div>
            )}
          </div>
          
          <div className="flex items-center gap-4">
            <button 
              onClick={() => navigate('/guardian/support')}
              className="relative p-2.5 rounded-full bg-slate-50 border border-slate-200 hover:bg-slate-100 transition-colors text-slate-400 shadow-sm"
              title="Suporte"
            >
              <LifeBuoy size={20} />
              {unreadSupportCount > 0 && (
                <span className="absolute top-1 right-1 w-3 h-3 bg-red-500 rounded-full border-2 border-white"></span>
              )}
            </button>
            <button 
              onClick={() => navigate('/guardian/notifications')}
              className="relative p-2.5 rounded-full bg-slate-50 border border-slate-200 hover:bg-slate-100 transition-colors text-slate-400 shadow-sm"
            >
              <Bell size={20} />
              {unreadCount > 0 && (
                <span className="absolute top-1.5 right-1.5 w-3 h-3 bg-red-500 rounded-full border-2 border-white shadow-sm"></span>
              )}
            </button>
            <div className="flex items-center gap-3 pl-4 border-l border-slate-100">
              <div className="text-right hidden sm:block">
                <div className="text-sm font-black text-slate-800 leading-none">{user?.name}</div>
                <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Responsável</div>
              </div>
              <div className="w-10 h-10 bg-slate-100 rounded-full flex items-center justify-center font-bold text-slate-600 border-2 border-white shadow-sm overflow-hidden flex-shrink-0">
                {user?.avatar ? (
                  <img src={user.avatar} alt={user.name} className="w-full h-full object-cover" />
                ) : (
                  user?.name?.[0]
                )}
              </div>
            </div>
          </div>
        </header>

        {/* Main Viewport */}
        <main className="flex-1 p-4 sm:p-8 max-w-7xl mx-auto w-full pb-20">
          <Outlet />
        </main>
      </div>
    </div>
  );
};
