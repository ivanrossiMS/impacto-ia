import { lazy, Suspense, useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { Toaster } from 'sonner';

// ── Layouts (NOT lazy — loaded immediately as they're structural shells) ──
import { StudentLayout } from './layouts/StudentLayout';
import { GuardianLayout } from './layouts/GuardianLayout';
import { TeacherLayout } from './layouts/TeacherLayout';
import { AdminLayout } from './layouts/AdminLayout';
import { RequireAuth } from './components/RequireAuth';
import { SearchOverlay } from './components/SearchOverlay';
import { ensureMissionsAreUpToDate, seedAchievements } from './lib/gameSeeder';
import { ACTIVITIES_STORAGE_KEY, getStoredActivities } from './lib/activityStorage';

// ── Always-loaded (public routes & tiny pages) ──
import { Home } from './pages/Home';
import { Login } from './pages/Login';
import { FirstAccess } from './pages/FirstAccess';
import { NotFound } from './pages/NotFound';

// ── LAZY-LOADED: Student pages (code-split per route) ──
const StudentDashboard = lazy(() => import('./pages/student/Dashboard').then(m => ({ default: m.StudentDashboard })));
const LearningPaths = lazy(() => import('./pages/student/LearningPaths').then(m => ({ default: m.LearningPaths })));
const LearningPathViewer = lazy(() => import('./pages/student/LearningPathViewer').then(m => ({ default: m.LearningPathViewer })));
const AvatarStudio = lazy(() => import('./pages/student/AvatarStudio').then(m => ({ default: m.AvatarStudio })));
const AvatarOnboarding = lazy(() => import('./pages/student/AvatarOnboarding').then(m => ({ default: m.AvatarOnboarding })));
const AvatarStore = lazy(() => import('./pages/student/AvatarStore').then(m => ({ default: m.AvatarStore })));
const TutorIA = lazy(() => import('./pages/student/TutorIA').then(m => ({ default: m.TutorIA })));
const Activities = lazy(() => import('./pages/student/Activities').then(m => ({ default: m.Activities })));
const Ranking = lazy(() => import('./pages/student/Ranking').then(m => ({ default: m.Ranking })));
const StudentAchievements = lazy(() => import('./pages/student/Achievements').then(m => ({ default: m.Achievements })));
const StudentProfile = lazy(() => import('./pages/student/Profile').then(m => ({ default: m.Profile })));
const StudentMissions = lazy(() => import('./pages/student/Missions').then(m => ({ default: m.Missions })));
const StudentDiary = lazy(() => import('./pages/student/Diary').then(m => ({ default: m.Diary })));
const StudentLibrary = lazy(() => import('./pages/student/Library').then(m => ({ default: m.Library })));
const StudentDuelList = lazy(() => import('./pages/student/DuelList').then(m => ({ default: m.DuelList })));
const StudentDuelCreate = lazy(() => import('./pages/student/DuelCreate').then(m => ({ default: m.DuelCreate })));
const StudentDuelGame     = lazy(() => import('./pages/student/DuelGame').then(m => ({ default: m.DuelGame })));
const StudentSoloDuelGame = lazy(() => import('./pages/student/SoloDuelGame').then(m => ({ default: m.SoloDuelGame })));
const RealtimeDuelLobby   = lazy(() => import('./pages/student/RealtimeDuelLobby').then(m => ({ default: m.RealtimeDuelLobby })));
const RealtimeDuelGame    = lazy(() => import('./pages/student/RealtimeDuelGame').then(m => ({ default: m.RealtimeDuelGame })));

// ── LAZY-LOADED: Guardian pages ──
const GuardianDashboard = lazy(() => import('./pages/guardian/Dashboard').then(m => ({ default: m.GuardianDashboard })));
const GuardianMessages = lazy(() => import('./pages/guardian/Messages').then(m => ({ default: m.Messages })));
const GuardianDiary = lazy(() => import('./pages/guardian/Diary').then(m => ({ default: m.Diary })));
const ParentTips = lazy(() => import('./pages/guardian/ParentTips').then(m => ({ default: m.ParentTips })));
const GuardianReports = lazy(() => import('./pages/guardian/Reports').then(m => ({ default: m.Reports })));
const GuardianRanking = lazy(() => import('./pages/guardian/Ranking').then(m => ({ default: m.Ranking })));
const GuardianDuels = lazy(() => import('./pages/guardian/Duels').then(m => ({ default: m.Duels })));
const GuardianProfile = lazy(() => import('./pages/guardian/Profile').then(m => ({ default: m.Profile })));

// ── LAZY-LOADED: Teacher pages ──
const TeacherDashboard = lazy(() => import('./pages/teacher/Dashboard').then(m => ({ default: m.TeacherDashboard })));
const TeacherClasses = lazy(() => import('./pages/teacher/Classes').then(m => ({ default: m.Classes })));
const ClassDetail = lazy(() => import('./pages/teacher/ClassDetail').then(m => ({ default: m.ClassDetail })));
const CreateActivity = lazy(() => import('./pages/teacher/CreateActivity').then(m => ({ default: m.CreateActivity })));
const TeacherActivities = lazy(() => import('./pages/teacher/Activities').then(m => ({ default: m.Activities })));
const TeacherReports = lazy(() => import('./pages/teacher/Reports').then(m => ({ default: m.Reports })));
const TeacherLibrary = lazy(() => import('./pages/teacher/Library').then(m => ({ default: m.Library })));
const TeacherProfile = lazy(() => import('./pages/teacher/Profile').then(m => ({ default: m.Profile })));

// ── LAZY-LOADED: Admin pages ──
const AdminDashboard = lazy(() => import('./pages/admin/Dashboard').then(m => ({ default: m.AdminDashboard })));
const AdminUsers = lazy(() => import('./pages/admin/Users').then(m => ({ default: m.Users })));
const AdminGamification = lazy(() => import('./pages/admin/Gamification').then(m => ({ default: m.Gamification })));
const AdminSchools = lazy(() => import('./pages/admin/Schools').then(m => ({ default: m.Schools })));
const AdminProfile = lazy(() => import('./pages/admin/Profile').then(m => ({ default: m.Profile })));
const AdminSettings = lazy(() => import('./pages/admin/Settings').then(m => ({ default: m.Settings })));
const AdminSystem = lazy(() => import('./pages/admin/System').then(m => ({ default: m.System })));
const AdminAvatarManager = lazy(() => import('./pages/admin/AvatarManager').then(m => ({ default: m.AvatarManager })));
const AdminSupport = lazy(() => import('./pages/admin/Support').then(m => ({ default: m.AdminSupport })));
const AdminRanking = lazy(() => import('./pages/admin/Ranking').then(m => ({ default: m.AdminRanking })));
const AdminLearningTrails = lazy(() => import('./pages/admin/LearningTrails').then(m => ({ default: m.AdminLearningTrails })));

// ── LAZY-LOADED: Shared pages ──
const Notifications = lazy(() => import('./pages/Notifications').then(m => ({ default: m.Notifications })));
const SharedSupport = lazy(() => import('./pages/shared/Support').then(m => ({ default: m.Support })));

// ── Loading fallback ──
const PageLoader = () => (
  <div className="flex items-center justify-center h-full min-h-[60vh]">
    <div className="flex flex-col items-center gap-4">
      <div className="w-10 h-10 border-4 border-primary-200 border-t-primary-600 rounded-full animate-spin" />
      <p className="text-sm text-slate-400 font-bold">Carregando...</p>
    </div>
  </div>
);

// ── One-per-session seeder flag ──
const SESSION_SEEDED_KEY = 'impacto_ia_seeded_v2';

function App() {
  const [isSearchOpen, setIsSearchOpen] = useState(false);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        setIsSearchOpen(true);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // ✅ OPTIMIZED: Seeders now run only ONCE per browser session, not on every mount.
  // Using sessionStorage flag to avoid slowing down navigation between pages.
  useEffect(() => {
    const initGameData = async () => {
      if (sessionStorage.getItem(SESSION_SEEDED_KEY)) return; // skip if already seeded this session
      
      try {
        const stored = await getStoredActivities();
        const filtered = Array.isArray(stored) ? stored.filter(a => a.title?.toLowerCase() !== 'teste') : [];
        if (stored.length !== filtered.length) {
          localStorage.setItem(ACTIVITIES_STORAGE_KEY, JSON.stringify(filtered));
        }

        // Run seeders in parallel
        await Promise.all([
          ensureMissionsAreUpToDate(),
          seedAchievements(),
        ]);

        sessionStorage.setItem(SESSION_SEEDED_KEY, '1');
      } catch (err) {
        console.error('Error initializing game data:', err);
      }
    };
    initGameData();
  }, []);

  return (
    <>
      <BrowserRouter>
        {/* ✅ Suspense wraps the entire Routes so each lazy route shows a spinner until loaded */}
        <Suspense fallback={<PageLoader />}>
          <Routes>
            {/* Public Routes */}
            <Route path="/" element={<Home />} />
            <Route path="/login" element={<Login />} />
            <Route path="/primeiro-acesso" element={<FirstAccess />} />

            {/* Student Routes */}
            <Route
              path="/student"
              element={
                <RequireAuth allowedRoles={['student']}>
                  <StudentLayout />
                </RequireAuth>
              }
            >
              <Route index element={<StudentDashboard />} />
              <Route path="paths" element={<LearningPaths />} />
              <Route path="paths/:pathId" element={<LearningPathViewer />} />
              <Route path="avatar" element={<AvatarStudio />} />
              <Route path="onboarding" element={<AvatarOnboarding />} />
              <Route path="store" element={<AvatarStore />} />
              <Route path="missions" element={<StudentMissions />} />
              <Route path="diary" element={<StudentDiary />} />
              <Route path="activities" element={<Activities />} />
              <Route path="library" element={<StudentLibrary />} />
              <Route path="tutor" element={<TutorIA />} />
              <Route path="ranking" element={<Ranking />} />
              <Route path="notifications" element={<Notifications />} />
              <Route path="achievements" element={<StudentAchievements />} />
              <Route path="profile" element={<StudentProfile />} />
              <Route path="support" element={<SharedSupport />} />
              <Route path="duels" element={<StudentDuelList />} />
              <Route path="duels/create" element={<StudentDuelCreate />} />
              <Route path="duels/solo" element={<StudentSoloDuelGame />} />
              <Route path="duels/realtime" element={<RealtimeDuelLobby />} />
              <Route path="duels/realtime/:roomId" element={<RealtimeDuelGame />} />
              <Route path="duels/:duelId" element={<StudentDuelGame />} />
            </Route>

            {/* Guardian Routes */}
            <Route
              path="/guardian"
              element={
                <RequireAuth allowedRoles={['guardian']}>
                  <GuardianLayout />
                </RequireAuth>
              }
            >
              <Route index element={<GuardianDashboard />} />
              <Route path="students" element={<GuardianDashboard />} />
              <Route path="diary" element={<GuardianDiary />} />
              <Route path="tips" element={<ParentTips />} />
              <Route path="reports" element={<GuardianReports />} />
              <Route path="duels" element={<GuardianDuels />} />
              <Route path="ranking" element={<GuardianRanking />} />
              <Route path="notifications" element={<Notifications />} />
              <Route path="messages" element={<GuardianMessages />} />
              <Route path="profile" element={<GuardianProfile />} />
              <Route path="support" element={<SharedSupport />} />
            </Route>

            {/* Teacher Routes */}
            <Route
              path="/teacher"
              element={
                <RequireAuth allowedRoles={['teacher']}>
                  <TeacherLayout />
                </RequireAuth>
              }
            >
              <Route index element={<TeacherDashboard />} />
              <Route path="classes" element={<TeacherClasses />} />
              <Route path="classes/:classId" element={<ClassDetail />} />
              <Route path="activities" element={<TeacherActivities />} />
              <Route path="ai-generator" element={<CreateActivity />} />
              <Route path="create-activity" element={<CreateActivity />} />
              <Route path="notifications" element={<Notifications />} />
              <Route path="library" element={<TeacherLibrary />} />
              <Route path="reports" element={<TeacherReports />} />
              <Route path="profile" element={<TeacherProfile />} />
              <Route path="support" element={<SharedSupport />} />
            </Route>

            {/* Admin Routes */}
            <Route
              path="/admin"
              element={
                <RequireAuth allowedRoles={['admin']}>
                  <AdminLayout />
                </RequireAuth>
              }
            >
              <Route index element={<AdminDashboard />} />
              <Route path="schools" element={<AdminSchools />} />
              <Route path="classes/:classId" element={<ClassDetail />} />
              <Route path="users" element={<AdminUsers />} />
              <Route path="ranking" element={<AdminRanking />} />
              <Route path="trails" element={<AdminLearningTrails />} />
              <Route path="gamification" element={<AdminGamification />} />
              <Route path="catalog" element={<AdminAvatarManager />} />
              <Route path="notifications" element={<Notifications />} />
              <Route path="system" element={<AdminSystem />} />
              <Route path="support" element={<AdminSupport />} />
              <Route path="settings" element={<AdminSettings />} />
              <Route path="profile" element={<AdminProfile />} />
            </Route>

            <Route path="*" element={<NotFound />} />
          </Routes>
        </Suspense>
        <SearchOverlay isOpen={isSearchOpen} onClose={() => setIsSearchOpen(false)} />
      </BrowserRouter>
      <Toaster position="top-right" richColors />
    </>
  );
}

export default App;
