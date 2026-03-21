import React from 'react';
import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { Bot, Home, Map, Trophy, UserSquare, Store, Bell, LogOut, Menu, BookOpen, Target, BookText, Library, Medal, Zap, GraduationCap, Sword, LifeBuoy } from 'lucide-react';
import { useAuthStore } from '../store/auth.store';
import { useUIStore } from '../store/ui.store';
import { useLiveQuery } from 'dexie-react-hooks';
import { calculateLevel } from '../lib/gamificationUtils';
import { AITutorWidget } from '../components/AITutorWidget';
import { cn } from '../lib/utils';
import { db } from '../lib/dexie';

export const StudentLayout: React.FC = () => {
  const { user, logout } = useAuthStore();
  const { isSidebarOpen, setSidebarOpen } = useUIStore();
  const navigate = useNavigate();

  // Reactive gamification stats
  const stats = useLiveQuery(
    async () => {
      if (!user) return undefined;
      return await db.gamificationStats.get(user.id);
    },
    [user]
  );

  // Derived level from XP (ensures consistency)
  const currentLevel = stats ? calculateLevel(stats.xp) : 1;

  // Reactive class name
  const className = useLiveQuery(async () => {
    if (!user) return '';
    try {
      const allClasses = await db.classes.toArray();
      const myClass = allClasses.find(c => c.studentIds?.includes(user.id));
      if (myClass) return myClass.name;
      
      if (user.role === 'student' && (user as any).classId) {
        const groupClass = await db.classes.get((user as any).classId);
        return groupClass?.name || '';
      }
    } catch (e) {
      console.error('Error loading class name:', e);
    }
    return '';
  }, [user]);

  const schoolLogo = useLiveQuery(async () => {
    if (!user?.schoolId) return null;
    const school = await db.schools.get(user.schoolId);
    return school?.logo || null;
  }, [user?.schoolId]);

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

  const unreadCount = useLiveQuery(async () => {
    if (!user) return 0;
    try {
      return await db.notifications
        .where('userId').equals(user.id)
        .and(n => !n.read)
        .count();
    } catch (e) {
      return 0;
    }
  }, [user]) || 0;

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const navItems = [
    { to: '/student', icon: Home, label: 'Início', end: true },
    { to: '/student/paths', icon: Map, label: 'Trilhas' },
    { to: '/student/activities', icon: BookOpen, label: 'Atividades' },
    { to: '/student/duels', icon: Sword, label: 'Duelos' },
    { to: '/student/missions', icon: Target, label: 'Missões' },
    { to: '/student/tutor', icon: Bot, label: 'Tutor IA' },
    { to: '/student/diary', icon: BookText, label: 'Meu Diário' },
    { to: '/student/library', icon: Library, label: 'Biblioteca' },
    { to: '/student/ranking', icon: Trophy, label: 'Ranking' },
    { to: '/student/achievements', icon: Medal, label: 'Conquistas' },
    { to: '/student/avatar', icon: UserSquare, label: 'Meu Avatar' },
    { to: '/student/store', icon: Store, label: 'Loja' },
    { to: '/student/profile', icon: UserSquare, label: 'Meu Perfil' },
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
        "fixed inset-y-0 left-0 z-50 w-72 bg-surface border-r border-primary-100 transform transition-transform duration-300 ease-out md:translate-x-0 md:static flex flex-col shadow-floating md:shadow-card",
        isSidebarOpen ? "translate-x-0" : "-translate-x-full"
      )}>
        <div className="p-6 flex items-center justify-between">
          <div className="flex items-center gap-3 text-primary-700">
            <div className="w-10 h-10 bg-primary-100 rounded-xl flex items-center justify-center text-special-500 shadow-inner">
              <Bot size={24} />
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
                  ? "bg-primary-50 text-primary-700 shadow-sm border border-primary-100" 
                  : "text-slate-500 hover:bg-slate-50 hover:text-slate-700 border border-transparent"
              )}
            >
              <item.icon size={22} className={cn("transition-colors")} />
              {item.label}
            </NavLink>
          ))}
        </nav>

        {/* User card at bottom */}
        <div className="p-6 border-t border-slate-100 bg-slate-50/50">
          <div 
             onClick={() => navigate('/student/profile')}
             className="bg-white border border-slate-100 p-4 rounded-2xl mb-4 text-center shadow-sm cursor-pointer hover:border-primary-300 hover:shadow-md transition-all group"
          >
            <div className="w-14 h-14 bg-gradient-to-tr from-primary-400 to-special-400 rounded-full mx-auto mb-3 flex items-center justify-center text-white font-bold text-xl shadow-md border-2 border-white group-hover:scale-105 transition-transform overflow-hidden">
              {user?.avatar ? (
                <img src={user.avatar} alt={user.name} className="w-full h-full object-cover" />
              ) : (
                user?.name?.[0]
              )}
            </div>
            <div className="font-bold text-slate-800 text-sm truncate">{user?.name}</div>
            {(className || (user as any)?.grade) && (
              <div className="flex items-center justify-center gap-1 mt-1">
                <GraduationCap size={12} className="text-primary-500" />
                <span className="text-xs font-bold text-primary-600">{className || (user as any).grade}</span>
              </div>
            )}
            <div className="text-xs font-bold text-special-600 mt-1">Ver Perfil Completo</div>
          </div>
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
        <header className="h-auto min-h-[70px] bg-background/80 backdrop-blur-md px-4 sm:px-8 py-3 flex items-center justify-between sticky top-0 z-30 border-b border-slate-100/80 shadow-sm">
          <button 
            className="md:hidden p-2 rounded-xl bg-white shadow-sm border border-slate-100 text-slate-600"
            onClick={() => setSidebarOpen(true)}
          >
            <Menu size={24} />
          </button>
          
          {/* School Logo + Student name + class */}
          <div className="flex items-center gap-3 ml-1">
            {schoolLogo && (
              <div className="w-12 h-12 bg-white rounded-2xl border border-slate-100 flex items-center justify-center overflow-hidden shadow-sm p-1.5">
                <img src={schoolLogo} alt="School Logo" className="w-full h-full object-contain" />
              </div>
            )}
            <div className="flex flex-col">
              <span className="font-black text-slate-800 text-sm leading-tight">{user?.name}</span>
              {(className || (user as any)?.grade) && (
                <span className="text-[10px] font-bold text-primary-500 uppercase tracking-wider flex items-center gap-1">
                  <GraduationCap size={10} /> {className || (user as any).grade}
                </span>
              )}
            </div>
          </div>

          <div className="flex-1" />
          
          {/* Topbar indicators */}
          <div className="flex items-center gap-2 sm:gap-3">
            {/* XP */}
            <div className="bg-primary-50 border border-primary-200 text-primary-700 font-extrabold px-3 py-2 rounded-full flex items-center gap-1.5 shadow-sm hover:scale-105 transition-transform cursor-default text-sm">
              <Zap size={14} className="text-primary-500 fill-primary-400" />
              <span>{stats?.xp ?? '—'}</span>
              <span className="text-[10px] font-black text-primary-400 uppercase">XP</span>
            </div>

            {/* Streak */}
            <div className="bg-energy-50 border border-energy-200 text-energy-700 font-extrabold px-3 py-2 rounded-full flex items-center gap-1.5 shadow-sm hover:scale-105 transition-transform cursor-default text-sm">
              <span>🔥</span>
              <span>{stats?.streak ?? '—'}</span>
            </div>

            {/* Coins */}
            <div className="bg-warning-50 border border-warning-200 text-warning-700 font-extrabold px-3 py-2 rounded-full flex items-center gap-1.5 shadow-sm hover:scale-105 transition-transform cursor-default text-sm">
              <span>🪙</span>
              <span>{stats?.coins ?? '—'}</span>
            </div>

            {/* Level */}
            <div className="hidden sm:flex bg-special-50 border border-special-200 text-special-700 font-extrabold px-3 py-2 rounded-full items-center gap-1.5 shadow-sm text-sm">
              <span>⭐</span>
              <span>Nv {currentLevel}</span>
            </div>

            {/* Support */}
            <button 
              onClick={() => navigate('/student/support')} 
              className="relative p-2.5 rounded-full bg-white border border-slate-200 hover:bg-slate-50 transition-colors text-slate-400 shadow-sm"
              title="Suporte"
            >
              <LifeBuoy size={20} />
              {unreadSupportCount > 0 && (
                <span className="absolute top-1 right-1 w-3 h-3 bg-red-500 rounded-full border-2 border-white"></span>
              )}
            </button>

            {/* Notifications */}
            <button 
              onClick={() => navigate('/student/notifications')} 
              className="relative p-2.5 rounded-full bg-white border border-slate-200 hover:bg-slate-50 transition-colors text-slate-400 shadow-sm ml-1"
            >
              <Bell size={20} />
              {unreadCount > 0 && (
                <span className="absolute top-1 right-1 w-4 h-4 bg-energy-500 rounded-full border-2 border-white flex items-center justify-center text-[8px] font-black text-white">
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              )}
            </button>
          </div>
        </header>

        {/* Main Viewport */}
        <main className="flex-1 p-4 sm:p-8 max-w-7xl mx-auto w-full pb-24">
          <Outlet />
        </main>
      </div>

      <AITutorWidget />
    </div>
  );
};
