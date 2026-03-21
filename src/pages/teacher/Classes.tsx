import React, { useState } from 'react';
import { Users, ChevronRight, Search, BookOpen, TrendingUp } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useAuthStore } from '../../store/auth.store';
import { useSupabaseQuery } from '../../hooks/useSupabase';

export const Classes: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const [searchTerm, setSearchTerm] = useState('');

  // Fetch teacher's assigned classes
  const allUsersHere = useSupabaseQuery<any>('users');
  const teacherUser = (allUsersHere || []).find((u: any) => u.id === user?.id);
  const teacherClassIds: string[] = teacherUser?.classIds || [];

  const allClassesData = useSupabaseQuery<any>('classes');
  const allClasses = (allClassesData || []).filter((c: any) => teacherClassIds.includes(c.id));

  const allUsers = useSupabaseQuery<any>('users');
  const allActivityResults = useSupabaseQuery<any>('student_activity_results');
  const allActivities = useSupabaseQuery<any>('activities');
  const allAvatarProfiles = useSupabaseQuery<any>('student_avatar_profiles');
  const allCatalogItems = useSupabaseQuery<any>('avatar_catalog');

  const filteredClasses = allClasses.filter(cls =>
    cls.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    cls.grade.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getAccentColor = (idx: number) => {
    const colors = [
      'from-primary-500 to-indigo-600',
      'from-success-500 to-emerald-600',
      'from-warning-500 to-orange-600',
      'from-special-500 to-purple-600',
      'from-energy-500 to-rose-600',
    ];
    return colors[idx % colors.length];
  };

  return (
    <div className="space-y-12 animate-in fade-in slide-in-from-bottom-6 duration-700 pb-24">
      <header className="flex flex-col md:flex-row md:items-end justify-between gap-8">
        <div className="space-y-2">
          <div className="flex items-center gap-3 text-primary-500 mb-2">
            <Users size={24} className="stroke-[3]" />
            <span className="text-xs font-black uppercase tracking-[0.3em]">Gestão Educacional</span>
          </div>
          <h1 className="text-5xl font-black text-slate-800 tracking-tight leading-tight">
            Minhas <span className="text-primary-600">Turmas</span>
          </h1>
          <p className="text-slate-500 font-medium text-lg">
            {allClasses.length === 0
              ? 'Aguardando atribuição de turmas...'
              : `Você gerencia ${allClasses.length} turma${allClasses.length !== 1 ? 's' : ''} atualmente.`}
          </p>
        </div>
        <div className="relative group">
          <div className="absolute inset-0 bg-primary-500/10 blur-2xl rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-primary-500 transition-colors" size={20} />
          <input
            type="text"
            placeholder="Buscar por turma ou série..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-14 pr-8 py-4 bg-white border-2 border-slate-100 rounded-3xl w-full md:w-96 focus:border-primary-500/30 outline-none transition-all font-bold text-slate-700 shadow-sm relative z-10"
          />
        </div>
      </header>

      {allClasses.length === 0 ? (
        <div className="text-center py-32 bg-white rounded-[4rem] border-4 border-dashed border-slate-100 shadow-inner">
          <div className="w-24 h-24 bg-slate-50 rounded-[2rem] flex items-center justify-center mx-auto mb-8 shadow-inner text-slate-200">
            <Users size={48} />
          </div>
          <h3 className="text-2xl font-black text-slate-800">Nenhuma turma vinculada</h3>
          <p className="text-slate-500 font-medium mt-3 max-w-md mx-auto leading-relaxed">
            Consulte a coordenação escolar para vincular suas turmas ao seu perfil de professor.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-8">
          {filteredClasses.map((cls, idx) => {
            const classStudents = (allUsers || []).filter((u: any) => u.role === 'student' && u.classId === cls.id);
            const studentCount = classStudents.length;
            const classResults = (allActivityResults || []).filter((r: any) => classStudents.some((s: any) => s.id === r.studentId));
            const activitiesCount = (allActivities || []).filter((a: any) => a.classId === cls.id).length;
            
            const avgPerformance = classResults.length > 0 
              ? Math.round((classResults.reduce((acc: number, r: any) => acc + (r.score / (r.totalQuestions || 1)), 0) / classResults.length) * 100) 
              : 0;

            const accent = getAccentColor(idx);

            return (
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: idx * 0.05 }}
                key={cls.id}
                onClick={() => navigate(`/teacher/classes/${cls.id}`)}
                className="group relative bg-white rounded-[3rem] p-8 border border-slate-100 shadow-xl hover:shadow-2xl hover:shadow-primary-500/10 transition-all duration-500 cursor-pointer overflow-hidden border-b-8 border-b-transparent hover:border-b-primary-500 hover:-translate-y-2"
              >
                {/* Background Glow */}
                <div className={"absolute top-0 right-0 w-48 h-48 -mr-12 -mt-12 rounded-full blur-[80px] opacity-[0.03] group-hover:opacity-10 transition-opacity bg-gradient-to-br " + accent} />

                <div className="relative z-10">
                  <div className="flex justify-between items-start mb-8">
                    <div className={"w-16 h-16 rounded-2xl flex items-center justify-center shadow-lg transform -rotate-6 group-hover:rotate-0 transition-transform duration-500 bg-gradient-to-br text-white " + accent}>
                      <Users size={32} className="stroke-[2.5]" />
                    </div>
                    <div className="flex flex-col items-end gap-3">
                      <div className="px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest bg-slate-100 text-slate-500 group-hover:bg-primary-50 group-hover:text-primary-600 transition-colors">
                        {cls.grade}
                      </div>
                      <div className="flex -space-x-3">
                        {classStudents.slice(0, 4).map((s: any, i: number) => {
                          const profile = (allAvatarProfiles || []).find((p: any) => p.studentId === s.id);
                          const avatarItem = (allCatalogItems || []).find((item: any) => item.id === profile?.selectedAvatarId);
                          const assetUrl = avatarItem?.assetUrl;

                          return (
                            <div key={i} className="w-9 h-9 rounded-full border-2 border-white bg-slate-100 overflow-hidden shadow-sm flex items-center justify-center">
                              {assetUrl ? (
                                <img src={assetUrl} alt={s.name} className="w-full h-full object-cover" />
                              ) : (
                                <div className="text-[10px] font-black text-slate-400">{s.name.charAt(0)}</div>
                              )}
                            </div>
                          );
                        })}
                        {studentCount > 4 && (
                          <div className="w-9 h-9 rounded-full border-2 border-white bg-primary-100 flex items-center justify-center text-[10px] font-black text-primary-600 shadow-sm relative z-10">
                            +{studentCount - 4}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  <h3 className="text-3xl font-black text-slate-800 mb-2 leading-none group-hover:text-primary-600 transition-colors">
                    {cls.name}
                  </h3>
                  <div className="flex items-center gap-3 text-slate-400 font-bold text-xs uppercase tracking-wider mb-8">
                    <BookOpen size={14} />
                    <span>{activitiesCount} Atividades Ativas</span>
                  </div>

                  {/* Performance Section */}
                  <div className="space-y-6 mb-8">
                    <div className="flex justify-between items-end">
                      <div className="space-y-1">
                        <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Desempenho Geral</div>
                        <div className="text-3xl font-black text-slate-800">{avgPerformance}%</div>
                      </div>
                      <div className={
                        "text-xs font-black px-3 py-1 rounded-lg " +
                        (avgPerformance >= 80 ? "bg-success-50 text-success-600" :
                        avgPerformance >= 60 ? "bg-warning-50 text-warning-600" : "bg-red-50 text-red-600")
                      }>
                        {avgPerformance >= 80 ? 'Excelente' : avgPerformance >= 60 ? 'Bom' : 'Atenção'}
                      </div>
                    </div>
                    <div className="h-3 w-full bg-slate-100 rounded-full overflow-hidden p-0.5 shadow-inner border border-slate-50">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${avgPerformance}%` }}
                        transition={{ duration: 1, ease: "easeOut" }}
                        className={"h-full rounded-full bg-gradient-to-r " + accent}
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-slate-50 p-4 rounded-3xl border border-slate-100 flex flex-col items-center">
                      <div className="text-xl font-black text-slate-800">{studentCount}</div>
                      <div className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Alunos</div>
                    </div>
                    <div className="bg-slate-50 p-4 rounded-3xl border border-slate-100 flex flex-col items-center">
                      <div className="text-xl font-black text-slate-800">{classResults.length}</div>
                      <div className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Lições Lidas</div>
                    </div>
                  </div>

                  <div className="mt-8 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                       <TrendingUp size={14} className="text-primary-500" />
                       <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Ver estatísticas</span>
                    </div>
                    <div className={"w-12 h-12 rounded-2xl flex items-center justify-center text-white transition-all duration-500 shadow-lg group-hover:scale-110 " + accent}>
                      <ChevronRight size={24} />
                    </div>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      )}
    </div>
  );
};
