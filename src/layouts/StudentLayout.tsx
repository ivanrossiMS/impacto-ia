import React from 'react';
import { Outlet, NavLink, useNavigate, useLocation } from 'react-router-dom';
import { Bot, Home, Map, Trophy, UserSquare, Store, Bell, LogOut, Menu, BookOpen, Target, BookText, Library, Medal, Zap, GraduationCap, Sword, LifeBuoy } from 'lucide-react';
import { useAuthStore } from '../store/auth.store';
import { useUIStore } from '../store/ui.store';
import { supabase } from '../lib/supabase';
import { calculateLevel, getLevelProgress } from '../lib/gamificationUtils';
import { cn } from '../lib/utils';
import { useAvatarStore } from '../store/avatar.store';
import { AvatarComposer } from '../features/avatar/components/AvatarComposer';
import { useGamificationStore } from '../store/gamification.store';
import { toast } from 'sonner';

// Streak visual helper — returns style classes based on streak count
function getStreakStyle(streak: number) {
  if (streak >= 30) return { emoji: '🔥', glow: 'shadow-[0_0_14px_4px_rgba(251,146,60,0.55)]', label: 'text-orange-600', bg: 'bg-gradient-to-r from-orange-50 to-red-50 border-orange-300', size: 'text-xl' };
  if (streak >= 15) return { emoji: '🔥', glow: 'shadow-[0_0_10px_2px_rgba(251,191,36,0.45)]', label: 'text-yellow-600', bg: 'bg-yellow-50 border-yellow-300', size: 'text-lg' };
  if (streak >= 7)  return { emoji: '🔥', glow: 'shadow-[0_0_8px_2px_rgba(251,146,60,0.35)]', label: 'text-energy-700', bg: 'bg-energy-50 border-energy-300', size: 'text-base' };
  if (streak >= 3)  return { emoji: '🔥', glow: 'shadow-[0_0_4px_1px_rgba(251,146,60,0.2)]',  label: 'text-energy-700', bg: 'bg-energy-50 border-energy-200', size: 'text-sm' };
  return           { emoji: '🔥', glow: '',  label: 'text-energy-700', bg: 'bg-energy-50 border-energy-200', size: 'text-xs' };
}

export const StudentLayout: React.FC = () => {
  const { user, logout } = useAuthStore();
  const { isSidebarOpen, setSidebarOpen } = useUIStore();
  const navigate = useNavigate();
  const location = useLocation();

  // ─── Badge counts (persist until user visits that section) ───
  const [pendingDuels,      setPendingDuels]      = React.useState(0);
  const [pendingActivities, setPendingActivities] = React.useState(0);
  const [pendingMissions,   setPendingMissions]   = React.useState(0);
  const [pendingLibrary,    setPendingLibrary]    = React.useState(0);
  // Delta ref — tracks previous counts so toasts fire only when count GROWS
  const prevBadge = React.useRef({ duels: 0, activities: 0, missions: 0, library: 0 });
  // Cooldown so we don’t fire duplicate toasts in rapid succession
  const lastToastAt = React.useRef<Record<string, number>>({ duels: 0, activities: 0, missions: 0, library: 0 });

  // ✅ Zustand store — single source of truth for top bar indicators
  // updateGamificationStats() pushes here instantly from any page
  const { stats, unreadCount, unreadSupportCount, fetchStats } = useGamificationStore();

  const [className, setClassName] = React.useState('');
  const [schoolLogo, setSchoolLogo] = React.useState<string | null>(null);

  const { profile, catalog, fetchProfile, fetchCatalog } = useAvatarStore();

  React.useEffect(() => {
    if (!user?.id) return;
    fetchStats(user.id);

    // Fetch static layout data (class and school logo) once on mount
    const fetchStaticData = async () => {
      if (user.role === 'student') {
        const { data: u } = await supabase.from('users').select('classId').eq('id', user.id).single();
        if (u?.classId) {
          const { data: cls } = await supabase.from('classes').select('name').eq('id', u.classId).single();
          if (cls) setClassName(cls.name);
        }
      }
      if (user.schoolId) {
        const { data: school } = await supabase.from('schools').select('logo').eq('id', user.schoolId).single();
        if (school?.logo) setSchoolLogo(school.logo);
      }
    };
    fetchStaticData();

    // ─── Fetch pending duels (direct from duels table — most reliable) ────────
    let prevDuelCount = 0;
    const fetchPendingDuels = async (showToastIfNew = false) => {
      if (user.role !== 'student') return;
      const { count } = await supabase
        .from('duels')
        .select('id', { count: 'exact', head: true })
        .eq('challengedId', user.id)
        .eq('status', 'pending');
      const newCount = count ?? 0;
      setPendingDuels(newCount);
      const now = Date.now();
      if (showToastIfNew && newCount > prevDuelCount && (now - lastToastAt.current.duels) > 5000) {
        lastToastAt.current.duels = now;
        const delta = newCount - prevDuelCount;
        toast(`⚔️ ${delta === 1 ? 'Novo desafio de duelo!' : `${delta} novos desafios!`}`, {
          description: 'Alguém te desafiou. Responda agora!',
          action: { label: 'Ver Duelos →', onClick: () => navigate('/student/duels') },
          duration: Infinity,
        });
      }
      prevDuelCount = newCount;
    };

    // ─── Fetch notification badges (activities / missions / library) ───────────
    const fetchNotifBadges = async (showToastIfNew = false) => {
      if (user.role !== 'student') return;
      const { data: notifs } = await supabase
        .from('notifications')
        .select('actionUrl, title, message')
        .eq('userId', user.id)
        .eq('read', false);

      let acts = 0, miss = 0, lib = 0;
      for (const n of (notifs || [])) {
        const url = n.actionUrl || '';
        if (url.includes('/activities'))  acts++;
        else if (url.includes('/missions')) miss++;
        else if (url.includes('/library'))  lib++;
      }

      setPendingActivities(acts);
      setPendingMissions(miss);
      setPendingLibrary(lib);

      const now = Date.now();
      if (showToastIfNew) {
        if (acts > prevBadge.current.activities && (now - lastToastAt.current.activities) > 5000) {
          lastToastAt.current.activities = now;
          toast('📝 Nova atividade publicada!', {
            description: 'Seu professor publicou uma nova atividade.',
            action: { label: 'Atividades →', onClick: () => navigate('/student/activities') },
            duration: Infinity,
          });
        }
        if (miss > prevBadge.current.missions && (now - lastToastAt.current.missions) > 5000) {
          lastToastAt.current.missions = now;
          toast('🎯 Missão concluída!', {
            description: 'Você completou uma missão. Colete sua recompensa!',
            action: { label: 'Missões →', onClick: () => navigate('/student/missions') },
            duration: Infinity,
          });
        }
        if (lib > prevBadge.current.library && (now - lastToastAt.current.library) > 5000) {
          lastToastAt.current.library = now;
          toast('📚 Novo material na biblioteca!', {
            description: 'Seu professor enviou um novo material.',
            action: { label: 'Biblioteca →', onClick: () => navigate('/student/library') },
            duration: Infinity,
          });
        }
      }
      prevBadge.current = { ...prevBadge.current, activities: acts, missions: miss, library: lib };
    };

    // ─── Mark a section’s notifications as read in the DB ────────────────────
    // (called when user clicks that nav item)
    // Exposed via window so nav click handlers can call without closure issues
    (window as any).__markSectionRead = async (section: string) => {
      await supabase
        .from('notifications')
        .update({ read: true })
        .eq('userId', user.id)
        .ilike('actionUrl', `%/student/${section}%`);
    };

    // Initial fetches (no toast on first load)
    fetchPendingDuels(false);
    fetchNotifBadges(false);

    // ─── Realtime: unfiltered on both tables ──────────────────────────────────
    const duelChannel = supabase
      .channel(`duel_badge_${user.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'duels' }, () => fetchPendingDuels(true))
      .subscribe();

    const notifChannel = supabase
      .channel(`notif_badge_${user.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'notifications' }, () => fetchNotifBadges(true))
      .subscribe();

    // ─── Polling backup ───────────────────────────────────────────────────────
    const poll = setInterval(() => {
      fetchPendingDuels(true);
      fetchNotifBadges(true);
    }, 30_000);

    return () => {
      supabase.removeChannel(duelChannel);
      supabase.removeChannel(notifChannel);
      clearInterval(poll);
      delete (window as any).__markSectionRead;
    };
  }, [user?.id, fetchStats]);

  React.useEffect(() => {
    if (user && user.role === 'student') {
      fetchProfile(user.id);
      fetchCatalog();
    }
  }, [user, fetchProfile, fetchCatalog]);


  // Derived level and progress from XP
  const currentLevel = stats ? calculateLevel(stats.xp) : 1;
  const levelProgress = stats ? getLevelProgress(stats.xp) : null;
  const streakStyle = getStreakStyle(stats?.streak ?? 0);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const navItems = [
    { to: '/student', icon: Home, label: 'Início', end: true },
    { to: '/student/paths', icon: Map, label: 'Trilhas' },
    { to: '/student/activities', icon: BookOpen, label: 'Atividades', badge: pendingActivities, badgeKey: 'activities' },
    { to: '/student/duels', icon: Sword, label: 'Duelos',    badge: pendingDuels,      badgeKey: 'duels' },
    { to: '/student/missions', icon: Target, label: 'Missões',   badge: pendingMissions,   badgeKey: 'missions' },
    { to: '/student/tutor', icon: Bot, label: 'Tutor IA' },
    { to: '/student/diary', icon: BookText, label: 'Meu Diário' },
    { to: '/student/library', icon: Library, label: 'Biblioteca', badge: pendingLibrary, badgeKey: 'library' },
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
        {navItems.map((item: any) => {
            const badgeCount: number = item.badge ?? 0;
            const showBadge = badgeCount > 0 && !location.pathname.startsWith(item.to);
            return (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                onClick={() => {
                  // Clear local badge + mark notifications as read in DB
                  if (item.badgeKey === 'duels') {
                    setPendingDuels(0);
                    prevBadge.current.duels = 0;
                    (window as any).__markSectionRead?.('duels');
                  }
                  if (item.badgeKey === 'activities') {
                    setPendingActivities(0);
                    prevBadge.current.activities = 0;
                    (window as any).__markSectionRead?.('activities');
                  }
                  if (item.badgeKey === 'missions') {
                    setPendingMissions(0);
                    prevBadge.current.missions = 0;
                    (window as any).__markSectionRead?.('missions');
                  }
                  if (item.badgeKey === 'library') {
                    setPendingLibrary(0);
                    prevBadge.current.library = 0;
                    (window as any).__markSectionRead?.('library');
                  }
                  if (window.innerWidth < 768) setSidebarOpen(false);
                }}
                className={({ isActive }) => cn(
                  "relative flex items-center gap-3 px-4 py-3.5 rounded-2xl font-bold transition-all",
                  isActive
                    ? "bg-primary-50 text-primary-700 shadow-sm border border-primary-100"
                    : "text-slate-500 hover:bg-slate-50 hover:text-slate-700 border border-transparent"
                )}
              >
                <span className="relative">
                  <item.icon size={22} className="transition-colors" />
                  {showBadge && (
                    <span className="absolute -top-1.5 -right-1.5 flex h-4 w-4">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
                      <span className="relative inline-flex rounded-full h-4 w-4 bg-red-500 text-white text-[9px] font-black items-center justify-center">
                        {badgeCount > 9 ? '9+' : badgeCount}
                      </span>
                    </span>
                  )}
                </span>
                {item.label}
              </NavLink>
            );
          })}
        </nav>

        {/* User card at bottom */}
        <div className="p-6 border-t border-slate-100 bg-slate-50/50">
          <div 
             onClick={() => navigate('/student/profile')}
             className="bg-white border border-slate-100 p-4 rounded-2xl mb-4 text-center shadow-sm cursor-pointer hover:border-primary-300 hover:shadow-md transition-all group"
          >
            <div className="w-24 h-24 rounded-[1.75rem] mx-auto mb-3 flex items-center justify-center text-white font-bold text-xl drop-shadow-md group-hover:scale-105 transition-transform">
              {(profile && profile.selectedAvatarId) ? (() => {
                const activeAvatar = catalog.find(i => i.id === profile.selectedAvatarId);
                const activeBackground = catalog.find(i => i.id === profile.selectedBackgroundId);
                const activeBorder = catalog.find(i => i.id === profile.selectedBorderId);
                return (
                  <AvatarComposer
                    avatarUrl={activeAvatar?.assetUrl || activeAvatar?.imageUrl || ''}
                    backgroundUrl={activeBackground?.assetUrl || activeBackground?.imageUrl}
                    borderUrl={activeBorder?.assetUrl || activeBorder?.imageUrl}
                    size="md"
                    animate={false}
                    isFloating={false}
                    className="w-full h-full shadow-none"
                  />
                );
              })() : user?.avatar ? (
                <div className="w-14 h-14 bg-gradient-to-tr from-primary-400 to-special-400 rounded-full border-2 border-white overflow-hidden shadow-md">
                   <img src={user.avatar} alt={user.name} className="w-full h-full object-cover" />
                </div>
              ) : (
                <div className="w-14 h-14 bg-gradient-to-tr from-primary-400 to-special-400 rounded-full border-2 border-white overflow-hidden shadow-md flex items-center justify-center text-white">
                   {user?.name?.[0]}
                </div>
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
          
          {/* School Logo + Student name + class — hidden on mobile */}
          <div className="hidden md:flex items-center gap-3 ml-1">
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
          <div className="flex items-center gap-1.5 sm:gap-3">
            {/* XP */}
            <div className="bg-primary-50 border border-primary-200 text-primary-700 font-extrabold px-2 py-1.5 md:px-3 md:py-2 rounded-full flex items-center gap-1 md:gap-1.5 shadow-sm hover:scale-105 transition-transform cursor-default text-xs md:text-sm">
              <Zap size={12} className="text-primary-500 fill-primary-400 md:hidden" />
              <Zap size={14} className="text-primary-500 fill-primary-400 hidden md:block" />
              <span>{stats?.xp ?? '—'}</span>
              <span className="hidden md:inline text-[10px] font-black text-primary-400 uppercase">XP</span>
            </div>

            {/* Streak — animated based on count */}
            <div className={cn(
              "border font-extrabold px-2 py-1.5 md:px-3 md:py-2 rounded-full flex items-center gap-1 md:gap-1.5 hover:scale-105 transition-all cursor-default",
              streakStyle.bg,
              streakStyle.glow,
              streakStyle.label,
              "text-xs md:text-sm"
            )}>
              <span className={cn("transition-all", streakStyle.size, (stats?.streak ?? 0) >= 30 && "animate-pulse")}>
                {streakStyle.emoji}
              </span>
              <span>{stats?.streak ?? '—'}</span>
              {(stats?.streak ?? 0) >= 3 && <span className="hidden md:inline text-[9px] uppercase tracking-widest opacity-60 font-black">dias</span>}
            </div>

            {/* Coins */}
            <div className="bg-warning-50 border border-warning-200 text-warning-700 font-extrabold px-2 py-1.5 md:px-3 md:py-2 rounded-full flex items-center gap-1 md:gap-1.5 shadow-sm hover:scale-105 transition-transform cursor-default text-xs md:text-sm">
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

        {/* XP Progress Bar — always visible under topbar */}
        {levelProgress && (
          <div className="w-full bg-slate-100 relative overflow-hidden" style={{ height: '4px' }} title={`Nível ${currentLevel} · ${levelProgress.xpInLevel}/${levelProgress.xpNextLevel} XP`}>
            <div
              className="h-full bg-gradient-to-r from-primary-500 via-special-500 to-primary-400 transition-all duration-1000 ease-out relative"
              style={{ width: `${levelProgress.percentage}%` }}
            >
              <div className="absolute right-0 top-0 h-full w-4 bg-white/30 blur-sm" />
            </div>
          </div>
        )}

        {/* Main Viewport */}
        <main className="flex-1 p-4 sm:p-8 max-w-7xl mx-auto w-full pb-24">
          <Outlet />
        </main>
      </div>

    </div>
  );
};
