import React from 'react';
import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { LayoutDashboard, School, Users, Settings, Database, Server, LogOut, Menu, Bell, MessageSquare, Trophy, Zap } from 'lucide-react';
import { useAuthStore } from '../store/auth.store';
import { useUIStore } from '../store/ui.store';
import { cn } from '../lib/utils';
import { db } from '../lib/dexie';
import { useLiveQuery } from 'dexie-react-hooks';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

export const AdminLayout: React.FC = () => {
  const { user, logout } = useAuthStore();
  const { isSidebarOpen, setSidebarOpen } = useUIStore();
  const navigate = useNavigate();

  const schoolsCount = useLiveQuery(() => db.schools.count()) || 0;
  const usersCount = useLiveQuery(() => db.users.count()) || 0;

  const isAdminMaster = user?.isMaster || user?.email === 'ivanrossi@outlook.com';
  const schoolId = user?.schoolId;

  const unreadSupportCount = useLiveQuery(async () => {
    if (!user) return 0;
    try {
      if (isAdminMaster) {
        return await db.supportTickets.where('isReadByAdmin').equals(0).count();
      }
      if (schoolId) {
        return await db.supportTickets
          .where('schoolId').equals(schoolId)
          .and(t => !t.isReadByAdmin)
          .count();
      }
    } catch (e) {
      console.error('Error fetching unread support count:', e);
    }
    return 0;
  }, [user, isAdminMaster, schoolId]) || 0;

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Bom dia';
    if (hour < 18) return 'Boa tarde';
    return 'Boa noite';
  };

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const school = useLiveQuery(
    async () => (schoolId ? await db.schools.get(schoolId) : undefined),
    [schoolId]
  );

  const navItems = [
    { to: '/admin', icon: LayoutDashboard, label: 'Geral', end: true },
    { to: '/admin/schools', icon: School, label: 'Escolas' },
    { to: '/admin/users', icon: Users, label: 'Usuários' },
    { to: '/admin/ranking', icon: Trophy, label: 'Ranking' },
    { to: '/admin/trails', icon: Zap, label: 'Trilhas IA' },
    { to: '/admin/catalog', icon: Database, label: 'Loja Avatar', masterOnly: true },
    { to: '/admin/system', icon: Server, label: 'Sistema', masterOnly: true },
    { to: '/admin/support', icon: MessageSquare, label: 'Suporte' },
    { to: '/admin/settings', icon: Settings, label: 'Configurações', masterOnly: true },
  ].filter(item => !item.masterOnly || isAdminMaster);

  return (
    <div className="min-h-screen bg-[#f1f5f9] flex">
      {/* Sidebar Overlay (Mobile) */}
      {isSidebarOpen && (
        <div 
          className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-40 md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside className={cn(
        "fixed inset-y-0 left-0 z-50 w-64 bg-slate-900 text-slate-300 transform transition-transform duration-300 ease-in-out md:translate-x-0 md:static flex flex-col",
        isSidebarOpen ? "translate-x-0" : "-translate-x-full"
      )}>
        <div className="p-6 flex items-center gap-3 text-white border-b border-white/5">
           <div className="w-8 h-8 bg-primary-500 rounded-lg flex items-center justify-center font-black">
             I
           </div>
           <span className="text-lg font-black tracking-tight">Painel Admin</span>
        </div>

        <nav className="flex-1 px-4 space-y-1 mt-6">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              onClick={() => { if(window.innerWidth < 768) setSidebarOpen(false) }}
              className={({ isActive }) => cn(
                "flex items-center gap-3 px-4 py-3 rounded-xl font-bold transition-all text-sm group",
                isActive 
                  ? "bg-white/10 text-white" 
                  : "text-slate-400 hover:bg-white/5 hover:text-white"
              )}
            >
              {({ isActive }) => (
                <>
                  <item.icon size={18} className={cn("transition-colors", isActive ? "text-primary-400" : "text-slate-500 group-hover:text-slate-300")} />
                  {item.label}
                  {item.label === 'Suporte' && unreadSupportCount > 0 && (
                    <span className="ml-auto w-2 h-2 bg-red-500 rounded-full shadow-[0_0_8px_rgba(239,68,68,0.5)]"></span>
                  )}
                </>
              )}
            </NavLink>
          ))}
        </nav>

        <div className="p-4 border-t border-white/5">
           <div 
             className="p-4 bg-white/5 rounded-2xl flex items-center gap-3 mb-4 cursor-pointer hover:bg-white/10 transition-colors"
             onClick={() => navigate('/admin/profile')}
           >
               <div className="w-8 h-8 bg-slate-700 rounded-full flex items-center justify-center font-bold text-slate-300 text-xs shadow-inner overflow-hidden">
                  {user?.avatar ? (
                    <img src={user.avatar} alt={user.name} className="w-full h-full object-cover" />
                  ) : (
                    user?.name?.[0]
                  )}
               </div>
                <div className="flex-1 min-w-0">
                   <div className="text-xs font-bold text-white truncate">{user?.name}</div>
                   <div className="text-[9px] font-black text-slate-500 uppercase tracking-widest truncate">
                     {isAdminMaster ? 'Admin Master' : (school?.name || 'Admin Escolar')}
                   </div>
                </div>
           </div>
           <button 
             onClick={handleLogout}
             className="flex items-center justify-center gap-2 text-slate-500 hover:text-white transition-all px-4 py-3 rounded-xl w-full font-bold text-xs"
           >
             <LogOut size={16} /> Logout
           </button>
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0">
        <header className="h-16 bg-white border-b border-slate-200 px-6 flex items-center justify-between sticky top-0 z-30 shadow-sm">
          <button 
            className="md:hidden p-2 rounded-lg bg-slate-100 text-slate-600"
            onClick={() => setSidebarOpen(true)}
          >
            <Menu size={20} />
          </button>
          
          <div className="flex-1 ml-6 hidden lg:flex items-center gap-8">
             <div className="flex flex-col">
                <span className="text-sm font-black text-slate-800 tracking-tight leading-none bg-gradient-to-r from-primary-600 to-indigo-600 bg-clip-text text-transparent italic">
                  {getGreeting()}, {user?.name.split(' ')[0]}!
                </span>
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">
                  {format(new Date(), "EEEE, d 'de' MMMM", { locale: ptBR })}
                </span>
             </div>
             
             <div className="h-10 w-px bg-slate-100 mx-2" />
             
             {isAdminMaster && (
               <div className="flex items-center gap-6">
                  <div className="flex flex-col">
                     <div className="flex items-center gap-2">
                        <div className="w-1.5 h-1.5 rounded-full bg-primary-500 shadow-[0_0_8px_rgba(99,102,241,0.5)]"></div>
                        <span className="text-sm font-black text-slate-700 leading-none">{schoolsCount}</span>
                     </div>
                     <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest mt-1">Escolas</span>
                  </div>
                  
                  <div className="flex flex-col">
                     <div className="flex items-center gap-2">
                        <div className="w-1.5 h-1.5 rounded-full bg-indigo-500 shadow-[0_0_8px_rgba(79,70,229,0.5)]"></div>
                        <span className="text-sm font-black text-slate-700 leading-none">{usersCount}</span>
                     </div>
                     <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest mt-1">Usuários</span>
                  </div>
               </div>
             )}
          </div>
          
          <div className="flex items-center gap-3">
             <div className="flex items-center gap-1.5 px-3 py-1.5 bg-success-50 text-success-700 rounded-full text-[10px] font-black uppercase border border-success-100">
                <div className="w-1.5 h-1.5 bg-success-500 rounded-full animate-pulse"></div>
                Sistema Online
             </div>
              <button 
                onClick={() => navigate('/admin/notifications')} 
                className="relative p-2 rounded-lg text-slate-400 hover:bg-slate-100 transition-colors"
              >
                 <Bell size={20} />
                 {(useLiveQuery(async () => {
                   if (!user) return 0;
                   return await db.notifications
                     .where('userId').equals(user.id)
                     .and(n => !n.read)
                     .count();
                 }, [user]) || 0) > 0 && (
                   <span className="absolute top-1.5 right-1.5 w-2.5 h-2.5 bg-red-500 rounded-full border-2 border-white shadow-sm"></span>
                 )}
              </button>
          </div>
        </header>

        <main className="flex-1 p-6 lg:p-10 max-w-[1920px] mx-auto w-full">
          <Outlet />
        </main>
      </div>
    </div>
  );
};
