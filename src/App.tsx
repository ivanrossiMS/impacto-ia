import { useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { Toaster } from 'sonner';
import { Notifications } from './pages/Notifications';
import { Home } from './pages/Home';
import { Login } from './pages/Login';
import { FirstAccess } from './pages/FirstAccess';
import { RequireAuth } from './components/RequireAuth';
import { StudentLayout } from './layouts/StudentLayout';
import { StudentDashboard } from './pages/student/Dashboard';
import { LearningPaths } from './pages/student/LearningPaths';
import { AvatarStudio } from './pages/student/AvatarStudio';
import { AvatarOnboarding } from './pages/student/AvatarOnboarding';
import { AvatarStore } from './pages/student/AvatarStore';
import { TutorIA } from './pages/student/TutorIA';
import { Activities } from './pages/student/Activities';
import { Ranking } from './pages/student/Ranking';
import { Achievements as StudentAchievements } from './pages/student/Achievements';
import { GuardianLayout } from './layouts/GuardianLayout';
import { GuardianDashboard } from './pages/guardian/Dashboard';
import { Messages as GuardianMessages } from './pages/guardian/Messages';
import { TeacherLayout } from './layouts/TeacherLayout';
import { TeacherDashboard } from './pages/teacher/Dashboard';
import { Classes as TeacherClasses } from './pages/teacher/Classes';
import { ClassDetail } from './pages/teacher/ClassDetail';
import { CreateActivity } from './pages/teacher/CreateActivity';
import { Activities as TeacherActivities } from './pages/teacher/Activities';
import { Reports as TeacherReports } from './pages/teacher/Reports';
import { Library as TeacherLibrary } from './pages/teacher/Library';
import { Profile as StudentProfile } from './pages/student/Profile';
import { Missions as StudentMissions } from './pages/student/Missions';
import { Diary as StudentDiary } from './pages/student/Diary';
import { Library as StudentLibrary } from './pages/student/Library';
import { Profile as TeacherProfile } from './pages/teacher/Profile';
import { Profile as GuardianProfile } from './pages/guardian/Profile';
import { Diary as GuardianDiary } from './pages/guardian/Diary';
import { ParentTips } from './pages/guardian/ParentTips';
import { Reports as GuardianReports } from './pages/guardian/Reports';
import { Ranking as GuardianRanking } from './pages/guardian/Ranking';
import { Duels as GuardianDuels } from './pages/guardian/Duels';
import { DuelList as StudentDuelList } from './pages/student/DuelList';
import { DuelCreate as StudentDuelCreate } from './pages/student/DuelCreate';
import { DuelGame as StudentDuelGame } from './pages/student/DuelGame';

import { AdminLayout } from './layouts/AdminLayout';
import { AdminDashboard } from './pages/admin/Dashboard';
import { Users as AdminUsers } from './pages/admin/Users';
import { Gamification as AdminGamification } from './pages/admin/Gamification';
import { Schools as AdminSchools } from './pages/admin/Schools';
import { Profile as AdminProfile } from './pages/admin/Profile';
import { Settings as AdminSettings } from './pages/admin/Settings';
import { System as AdminSystem } from './pages/admin/System';
import { AvatarManager as AdminAvatarManager } from './pages/admin/AvatarManager';
import { AdminSupport } from './pages/admin/Support';
import { Support as SharedSupport } from './pages/shared/Support';
import { AdminRanking } from './pages/admin/Ranking';
import { AdminLearningTrails } from './pages/admin/LearningTrails';
import { NotFound } from './pages/NotFound';
import { SearchOverlay } from './components/SearchOverlay';
import { ensureMissionsAreUpToDate } from './lib/gameSeeder';
import { ACTIVITIES_STORAGE_KEY, getStoredActivities } from './lib/activityStorage';


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

  // Initialize game data on app load
  useEffect(() => {
    const initGameData = async () => {
      try {
        // --- INITIAL DATA SYNC ---
        
        const stored = await getStoredActivities();
        const filtered = Array.isArray(stored) ? stored.filter(a => a.title?.toLowerCase() !== 'teste') : [];
        if (stored.length !== filtered.length) {
          localStorage.setItem(ACTIVITIES_STORAGE_KEY, JSON.stringify(filtered));
        }

        await ensureMissionsAreUpToDate(); // Generate/refresh missions
      } catch (err) {
        console.error('Error initializing game data:', err);
      }
    };
    initGameData();
  }, []);


  return (
    <>
      <BrowserRouter>
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
        <SearchOverlay isOpen={isSearchOpen} onClose={() => setIsSearchOpen(false)} />
      </BrowserRouter>
      <Toaster position="top-right" richColors />
    </>
  );
}

export default App;
