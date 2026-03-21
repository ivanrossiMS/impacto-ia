import React from 'react';
import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { GraduationCap, Home, Users, BookOpen, Wand2, BarChart3, Bell, LogOut, Menu, Library, LifeBuoy } from 'lucide-react';
import { useAuthStore } from '../store/auth.store';
import { useUIStore } from '../store/ui.store';
import { cn } from '../lib/utils';
import { db } from '../lib/dexie';
import { useLiveQuery } from 'dexie-react-hooks';

export const TeacherLayout: React.FC = () => {
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
    { to: '/teacher', icon: Home, label: 'Dashboard', end: true },
    { to: '/teacher/classes', icon: Users, label: 'Minhas Turmas' },
    { to: '/teacher/activities', icon: BookOpen, label: 'Atividades' },
    { to: '/teacher/library', icon: Library, label: 'Biblioteca' },
    { to: '/teacher/ai-generator', icon: Wand2, label: 'Criar com IA' },
    { to: '/teacher/reports', icon: BarChart3, label: 'Relatórios' },
    { to: '/teacher/profile', icon: GraduationCap, label: 'Meu Perfil' },
  ];

  return (
    <div className="min-h-screen bg-[#f8fafc] flex">
      {/* Sidebar Overlay (Mobile) */}
      {isSidebarOpen && (
        <div 
          className="fixed inset-0 bg-slate-900/10 backdrop-blur-sm z-40 md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside className={cn(
        "fixed inset-y-0 left-0 z-50 w-72 bg-white border-r border-slate-200 transform transition-transform duration-300 ease-out md:translate-x-0 md:static flex flex-col",
        isSidebarOpen ? "translate-x-0" : "-translate-x-full"
      )}>
        <div className="p-8 flex items-center gap-3 text-primary-700">
           <div className="w-10 h-10 bg-primary-600 text-white rounded-xl flex items-center justify-center shadow-md">
             <GraduationCap size={24} />
           </div>
           <span className="text-xl font-black tracking-tight">Impacto IA</span>
        </div>

        <nav className="flex-1 px-6 space-y-2 mt-4">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              onClick={() => { if(window.innerWidth < 768) setSidebarOpen(false) }}
              className={({ isActive }) => cn(
                "flex items-center gap-3 px-4 py-3.5 rounded-2xl font-bold transition-all text-sm",
                isActive 
                  ? "bg-primary-50 text-primary-700 border border-primary-100" 
                  : "text-slate-500 hover:bg-slate-50 hover:text-slate-700"
              )}
            >
              <item.icon size={20} />
              {item.label}
            </NavLink>
          ))}
        </nav>

        <div className="p-6 border-t border-slate-100 bg-slate-50/30">
           <div 
             onClick={() => navigate('/teacher/profile')}
             className="flex items-center gap-3 mb-6 p-2 bg-white border border-slate-100 rounded-2xl cursor-pointer hover:border-primary-300 hover:shadow-sm transition-all group"
           >
              <div className="w-10 h-10 bg-primary-100 rounded-xl flex items-center justify-center font-bold text-primary-700 shadow-inner group-hover:scale-105 transition-transform overflow-hidden flex-shrink-0">
                 {user?.avatar ? (
                   <img src={user.avatar} alt={user.name} className="w-full h-full object-cover" />
                 ) : (
                   user?.name?.[0]
                 )}
              </div>
              <div className="flex-1 min-w-0">
                 <div className="text-sm font-bold text-slate-800 truncate">{user?.name}</div>
                 <div className="text-[10px] font-black text-primary-600 uppercase tracking-widest">Ver Perfil</div>
              </div>
           </div>
           <button 
             onClick={handleLogout}
             className="flex items-center justify-center gap-2 text-slate-400 hover:text-red-500 hover:bg-red-50 transition-all px-4 py-3 rounded-2xl w-full font-bold text-xs"
           >
             <LogOut size={16} /> Encerrar Sessão
           </button>
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0">
        <header className="h-20 bg-white/80 backdrop-blur-md px-8 flex items-center justify-between sticky top-0 z-30 border-b border-slate-200/60">
          <div className="flex items-center gap-4">
            <button 
              className="md:hidden p-2 rounded-xl bg-slate-50 text-slate-600"
              onClick={() => setSidebarOpen(true)}
            >
              <Menu size={24} />
            </button>
            <div className="hidden md:flex items-center gap-4 text-slate-400 text-sm font-medium">
               {schoolLogo && (
                 <div className="w-12 h-12 bg-white rounded-2xl border border-slate-100 flex items-center justify-center overflow-hidden shadow-sm p-1.5">
                   <img src={schoolLogo} alt="School Logo" className="w-full h-full object-contain" />
                 </div>
               )}
               <div className="flex items-center gap-2">
                 <span className="hover:text-slate-600 cursor-pointer transition-colors">Educação</span>
                 <span>/</span>
                 <span className="text-slate-800 font-bold capitalize">{user?.role}</span>
               </div>
            </div>
          </div>
          
          <div className="flex items-center gap-4">
             <div className="bg-slate-100/50 border border-slate-200 px-4 py-2 rounded-xl text-xs font-bold text-slate-500 hidden sm:block">
                Ano Letivo 2026 • 1º Semestre
             </div>
             <button 
               onClick={() => navigate('/teacher/support')} 
               className="relative p-2.5 rounded-full bg-slate-100 border border-slate-200 text-slate-400 hover:bg-slate-200 transition-colors"
               title="Suporte"
             >
                <LifeBuoy size={20} />
                {unreadSupportCount > 0 && (
                  <span className="absolute top-1 right-1 w-2.5 h-2.5 bg-red-500 rounded-full border-2 border-white shadow-sm"></span>
                )}
             </button>
             <button 
               onClick={() => navigate('/teacher/notifications')} 
               className="relative p-2.5 rounded-full bg-slate-100 border border-slate-200 text-slate-400 hover:bg-slate-200 transition-colors"
             >
                <Bell size={20} />
                {unreadCount > 0 && (
                  <span className="absolute top-1.5 right-1.5 w-2.5 h-2.5 bg-special-500 rounded-full border-2 border-white shadow-sm"></span>
                )}
             </button>
          </div>
        </header>

        <main className="flex-1 p-8 max-w-[1600px] mx-auto w-full">
          <Outlet />
        </main>
      </div>
    </div>
  );
};
