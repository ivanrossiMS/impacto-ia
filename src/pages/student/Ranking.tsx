import React, { useEffect, useState, useCallback } from 'react';
import { useAuthStore } from '../../store/auth.store';
import { supabase } from '../../lib/supabase';
import { incrementMissionProgress } from '../../lib/missionUtils';
import type { AppUser } from '../../types/user';
import type { GamificationStats } from '../../types/gamification';
import {
  Trophy, Star, Crown, Medal, Flame, Users, School, BookOpen, GraduationCap
} from 'lucide-react';
import { Card } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { cn } from '../../lib/utils';
import { toast } from 'sonner';

// ─── Segment definitions ────────────────────────────────────────────────────
type RankingScope = 'minha_turma' | 'fund1' | 'fund2' | 'ens_medio' | 'minha_escola';

interface ScopeOption {
  id: RankingScope;
  label: string;
  sublabel: string;
  icon: React.ReactNode;
  color: string;
}

const GRADE_RANGES: Record<string, string[]> = {
  fund1: [
    '1º Ano', '2º Ano', '3º Ano', '4º Ano', '5º Ano',
    '1º ano', '2º ano', '3º ano', '4º ano', '5º ano',
    '1o Ano', '2o Ano', '3o Ano', '4o Ano', '5o Ano',
    '1o ano', '2o ano', '3o ano', '4o ano', '5o ano',
    '1 Ano', '2 Ano', '3 Ano', '4 Ano', '5 Ano',
    '1 ano', '2 ano', '3 ano', '4 ano', '5 ano',
    'FUNDAMENTAL 1', 'Fundamental 1', 'EFI', 'EF1'
  ],
  fund2: [
    '6º Ano', '7º Ano', '8º Ano', '9º Ano',
    '6º ano', '7º ano', '8º ano', '9º ano',
    '6o Ano', '7o Ano', '8o Ano', '9o Ano',
    '6o ano', '7o ano', '8o ano', '9o ano',
    '6 Ano', '7 Ano', '8 Ano', '9 Ano',
    '6 ano', '7 ano', '8 ano', '9 ano',
    'FUNDAMENTAL 2', 'Fundamental 2', 'EFII', 'EF2'
  ],
  ens_medio: [
    '1º Médio', '2º Médio', '3º Médio',
    '1º médio', '2º médio', '3º médio',
    '1o Médio', '2o Médio', '3o Médio',
    '1ª Série EM', '2ª Série EM', '3ª Série EM',
    'Ensino Médio', 'Ensino medio', 'ENSINO MÉDIO',
    '1EM', '2EM', '3EM', '1ª EM', '2ª EM', '3ª EM'
  ],
};

interface RankEntry {
  user: AppUser;
  stats: GamificationStats | null;
  rank: number;
  isCurrentUser: boolean;
  className: string;
}

export const Ranking: React.FC = () => {
  const { user: currentUser } = useAuthStore();
  const [rankData, setRankData] = useState<RankEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [scope, setScope] = useState<RankingScope>('minha_turma');
  const [myClassId, setMyClassId] = useState<string | null | undefined>(undefined);
  const [mySchoolId, setMySchoolId] = useState<string | null | undefined>(undefined);
  const [selectedYear, setSelectedYear] = useState<string>(new Date().getFullYear().toString());
  const [selectedMonth, setSelectedMonth] = useState<string>('');
  const [availableYears, setAvailableYears] = useState<string[]>([new Date().getFullYear().toString()]);

  const MONTHS = [
    { value: '', label: 'Todos os meses' },
    { value: '01', label: 'Janeiro' }, { value: '02', label: 'Fevereiro' },
    { value: '03', label: 'Março' },   { value: '04', label: 'Abril' },
    { value: '05', label: 'Maio' },    { value: '06', label: 'Junho' },
    { value: '07', label: 'Julho' },   { value: '08', label: 'Agosto' },
    { value: '09', label: 'Setembro' },{ value: '10', label: 'Outubro' },
    { value: '11', label: 'Novembro' },{ value: '12', label: 'Dezembro' },
  ];

  const scopeOptions: ScopeOption[] = [
    { id: 'minha_turma', label: 'Minha Turma', sublabel: 'Colegas da classe', icon: <Users size={16} />, color: 'from-primary-500 to-indigo-600' },
    { id: 'fund1', label: 'Fund. 1', sublabel: '1º ao 5º ano', icon: <BookOpen size={16} />, color: 'from-orange-400 to-amber-500' },
    { id: 'fund2', label: 'Fund. 2', sublabel: '6º ao 9º ano', icon: <GraduationCap size={16} />, color: 'from-teal-500 to-emerald-600' },
    { id: 'ens_medio', label: 'Ens. Médio', sublabel: '1ª a 3ª série', icon: <GraduationCap size={16} />, color: 'from-special-500 to-purple-600' },
    { id: 'minha_escola', label: 'Minha Escola', sublabel: 'Toda a escola', icon: <School size={16} />, color: 'from-slate-700 to-slate-900' },
  ];

  useEffect(() => {
    if (!currentUser) return;
    incrementMissionProgress(currentUser.id, 'ranking_visit', 1);
    // Load student's classId, schoolId, grade
    supabase.from('users').select('classId, schoolId, grade').eq('id', currentUser.id).single()
      .then(({ data }) => {
        if (data) {
          setMyClassId(data.classId || null);
          setMySchoolId(data.schoolId || null);
          
          // Fetch available years for this school
          if (data.schoolId) {
            supabase.from('classes').select('year').eq('schoolId', data.schoolId)
              .then(({ data: yearsData }) => {
                if (yearsData) {
                  const uniqueYears = Array.from(new Set(yearsData.map(y => y.year))).sort((a, b) => b.localeCompare(a));
                  if (uniqueYears.length > 0) setAvailableYears(uniqueYears);
                }
              });
          }
        }
      });
  }, [currentUser]);

  const loadRanking = useCallback(async () => {
    if (!currentUser) return;
    setLoading(true);

    let students: AppUser[] = [];

    // Helper to check if a grade string belongs to a segment
    const isGradeInSegment = (grade: string | null | undefined, targetSegment: string) => {
      if (!grade) return false;
      const normalized = grade.toLowerCase().trim();
      
      // Robust matching for Médio (often abbreviated as EM)
      if (targetSegment === 'ens_medio') {
         if (normalized.includes('médio') || 
             normalized.includes('medio') || 
             normalized.includes('em') || 
             normalized.includes('série em') ||
             /^\d+\s?em$/.test(normalized) ||
             /^\d+ª série/.test(normalized)) return true;
      }

      const ranges = GRADE_RANGES[targetSegment] || [];
      return ranges.some(r => {
        const nr = r.toLowerCase().trim();
        return normalized === nr || normalized.includes(nr);
      });
    };

    try {
      if (scope === 'minha_turma') {
        if (myClassId) {
          const { data } = await supabase.from('users').select('*').eq('classId', myClassId).eq('role', 'student');
          students = data as AppUser[] || [];
        } else {
          const { data } = await supabase.from('users').select('*').eq('role', 'student').limit(50);
          students = data as AppUser[] || [];
        }
      } else if (scope === 'minha_escola') {
        if (mySchoolId) {
          const { data } = await supabase.from('users').select('*').eq('schoolId', mySchoolId).eq('role', 'student');
          students = data as AppUser[] || [];
        } else {
          const { data } = await supabase.from('users').select('*').eq('role', 'student').limit(100);
          students = data as AppUser[] || [];
        }
      } else {
        // SEGMENT FILTER (Fund 1, Fund 2, Ens Medio)
        // Fetch ALL school students and classes to map them correctly
        // This is the most "functional" and "real" way to ensure we don't miss anyone
        const [{ data: allSchoolStudents }, { data: allSchoolClasses }] = await Promise.all([
          mySchoolId 
            ? supabase.from('users').select('*').eq('schoolId', mySchoolId).eq('role', 'student')
            : supabase.from('users').select('*').eq('role', 'student').limit(200),
          mySchoolId
            ? supabase.from('classes').select('id, grade, year').eq('schoolId', mySchoolId).eq('year', selectedYear)
            : supabase.from('classes').select('id, grade, year').eq('year', selectedYear).limit(50)
        ]);

        const classGradeMap: Record<string, string> = {};
        const classesInYear = new Set<string>();
        (allSchoolClasses || []).forEach(c => { 
          if (c.grade) classGradeMap[c.id] = c.grade; 
          classesInYear.add(c.id);
        });

        students = (allSchoolStudents || []).filter(s => {
          // Rule: Student must be in a class belonging to the selected year
          if (!s.classId || !classesInYear.has(s.classId)) return false;

          // Check user's own grade field
          if (isGradeInSegment(s.grade, scope)) return true;
          // Fallback: check their class's grade
          if (isGradeInSegment(classGradeMap[s.classId], scope)) return true;
          return false;
        }) as AppUser[];
      }

      // Load stats for the filtered students
      const targetIds = students.map(s => s.id);
      if (targetIds.length > 0) {
        const { data: statsAll } = await supabase.from('gamification_stats').select('*').in('id', targetIds);
        const statsMap: Record<string, GamificationStats> = {};
        for (const s of (statsAll || [])) statsMap[s.id] = s as GamificationStats;

        // Batch-fetch class names
        const classIds = [...new Set(students.map(s => (s as any).classId).filter(Boolean))];
        const classNameMap: Record<string, string> = {};
        if (classIds.length > 0) {
          const { data: classData } = await supabase.from('classes').select('id, name').in('id', classIds);
          (classData || []).forEach((c: any) => { classNameMap[c.id] = c.name; });
        }

        const entries: RankEntry[] = students.map(s => ({
          user: s,
          stats: statsMap[s.id] || null,
          rank: 0,
          isCurrentUser: s.id === currentUser.id,
          className: classNameMap[(s as any).classId || ''] || '',
        }));

        // Sort by XP
        entries.sort((a, b) => (b.stats?.xp || 0) - (a.stats?.xp || 0));
        entries.forEach((e, i) => { e.rank = i + 1; });

        setRankData(entries);
      } else {
        setRankData([]);
      }
    } catch (err) {
      console.error('Error loading ranking:', err);
      toast.error('Erro ao carregar ranking real.');
    } finally {
      setLoading(false);
    }
  }, [currentUser, scope, myClassId, mySchoolId, selectedYear, selectedMonth]);

  useEffect(() => {
    if (currentUser && myClassId !== undefined && mySchoolId !== undefined) loadRanking();
  }, [loadRanking, currentUser, myClassId, mySchoolId, selectedYear, selectedMonth]);

  const top3 = rankData.slice(0, 3);
  const top10 = rankData.slice(3, 10);
  const myEntry = rankData.find(e => e.isCurrentUser);
  const currentScope = scopeOptions.find(s => s.id === scope)!;

  const avatarColors = [
    'bg-primary-500', 'bg-energy-500', 'bg-special-500',
    'bg-success-500', 'bg-warning-500', 'bg-indigo-500',
    'bg-pink-500', 'bg-teal-500',
  ];

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500 pb-20">
      <header className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-warning-500">
            <Trophy size={20} className="stroke-[3]" />
            <span className="text-xs font-black uppercase tracking-[0.2em]">Competição Saudável</span>
          </div>
          <h1 className="text-4xl font-black text-slate-800 tracking-tight leading-none">Hall da <span className="text-primary-600">Fama</span></h1>
          <p className="text-slate-500 font-medium">Top alunos por engajamento e XP · <span className="font-black text-slate-700">{currentScope.label}</span></p>
        </div>

        {myEntry && (
          <div className="flex items-center gap-3 bg-primary-50 border border-primary-100 px-6 py-4 rounded-2xl shadow-sm">
            <div className="text-2xl font-black text-primary-700">#{myEntry.rank}</div>
            <div className="w-px h-8 bg-primary-200" />
            <div className="text-right">
              <div className="text-[10px] font-black uppercase text-primary-400 tracking-widest">Sua Posição</div>
              <div className="font-black text-slate-800">{myEntry.stats?.xp || 0} XP</div>
            </div>
          </div>
        )}
      </header>

      {/* ─── Scope Selector ───────────────────────────────────────────────── */}
      <div className="bg-white rounded-[2.5rem] p-6 border border-slate-100 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
          <div className="flex items-center gap-2">
            <Trophy size={14} className="text-warning-500" />
            <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Filtrar Ranking Por</span>
          </div>
          
          <div className="flex items-center gap-2 self-end sm:self-auto flex-wrap">
            <span className="text-[10px] font-black uppercase text-slate-400">Ano:</span>
            <select
              value={selectedYear}
              onChange={(e) => setSelectedYear(e.target.value)}
              className="bg-slate-100 border-none rounded-xl px-3 py-1.5 text-[11px] font-black text-slate-600 focus:ring-2 focus:ring-primary-500/20 outline-none cursor-pointer hover:bg-slate-200 transition-colors"
            >
              {availableYears.map(year => (
                <option key={year} value={year}>{year}</option>
              ))}
            </select>
            <span className="text-[10px] font-black uppercase text-slate-400">Mês:</span>
            <select
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="bg-slate-100 border-none rounded-xl px-3 py-1.5 text-[11px] font-black text-slate-600 focus:ring-2 focus:ring-primary-500/20 outline-none cursor-pointer hover:bg-slate-200 transition-colors"
            >
              {MONTHS.map(m => (
                <option key={m.value} value={m.value}>{m.label}</option>
              ))}
            </select>
          </div>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          {scopeOptions.map(opt => (
            <button
              key={opt.id}
              onClick={() => setScope(opt.id)}
              className={cn(
                'flex flex-col items-center gap-2 p-4 rounded-2xl border-2 transition-all text-center',
                scope === opt.id
                  ? `bg-gradient-to-br ${opt.color} text-white border-transparent shadow-lg`
                  : 'border-slate-100 bg-slate-50 text-slate-500 hover:border-primary-200 hover:bg-primary-50 hover:text-primary-700'
              )}
            >
              <div className={cn('p-2 rounded-xl', scope === opt.id ? 'bg-white/20' : 'bg-white border border-slate-100 shadow-sm')}>
                {opt.icon}
              </div>
              <div>
                <div className="text-[11px] font-black leading-tight">{opt.label}</div>
                <div className={cn('text-[9px] font-bold leading-tight', scope === opt.id ? 'text-white/70' : 'text-slate-400')}>{opt.sublabel}</div>
              </div>
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="w-12 h-12 border-4 border-primary-100 border-t-primary-500 rounded-full animate-spin" />
        </div>
      ) : rankData.length === 0 ? (
        <div className="text-center py-20 bg-white rounded-[2.5rem] border-2 border-dashed border-slate-100">
          <div className="text-6xl mb-4">🏆</div>
          <h3 className="text-xl font-black text-slate-600 mb-2">Ranking ainda vazio</h3>
          <p className="text-slate-400 text-sm">Nenhum aluno encontrado neste segmento.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
          <div className="lg:col-span-8 space-y-8">

            {/* Podium */}
            {top3.length > 0 && (
              <div className="grid grid-cols-3 gap-4 items-end pt-12">
                {/* 2nd */}
                {top3[1] ? (
                  <div className="flex flex-col items-center gap-4">
                    <div className="relative">
                      <div className={cn('w-16 h-16 rounded-[1.5rem] text-white flex items-center justify-center font-black text-2xl rotate-[-10deg] shadow-lg border-4 border-white', avatarColors[1 % avatarColors.length])}>
                        {top3[1].user.name[0]}
                      </div>
                      <div className="absolute -top-3 -right-3 w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 shadow-sm border border-slate-200">
                        <Medal size={16} />
                      </div>
                    </div>
                    <div className="text-center">
                      <div className="text-sm font-black text-slate-700 truncate max-w-[90px]">{top3[1].user.name.split(' ').slice(0,2).join(' ')}</div>
                      {top3[1].className && <div className="text-[9px] font-bold text-primary-500 uppercase tracking-wider">{top3[1].className}</div>}
                      <div className="text-[10px] font-bold text-slate-400">{top3[1].stats?.xp || 0} XP</div>
                    </div>
                    <div className="w-full h-24 bg-slate-50 rounded-t-[2.5rem] border-x-2 border-t-2 border-slate-100 flex items-end justify-center pb-4">
                      <span className="text-4xl font-black text-slate-200">2</span>
                    </div>
                  </div>
                ) : <div />}

                {/* 1st */}
                {top3[0] && (
                  <div className="flex flex-col items-center gap-4">
                    <div className="relative">
                      <Crown size={40} className="text-warning-500 absolute -top-10 left-1/2 -translate-x-1/2 animate-bounce fill-warning-400/20" />
                      <div className={cn('w-24 h-24 rounded-[2rem] text-white flex items-center justify-center font-black text-4xl shadow-2xl border-4 border-white relative z-10 hover:scale-105 transition-transform', avatarColors[0])}>
                        {top3[0].user.name[0]}
                      </div>
                      <div className="absolute -bottom-3 -right-3 w-10 h-10 rounded-full bg-white flex items-center justify-center text-warning-500 shadow-xl border-2 border-warning-100 z-20">
                        <span className="font-black">1</span>
                      </div>
                    </div>
                    <div className="text-center">
                      <div className="text-lg font-black text-slate-800 truncate max-w-[100px]">{top3[0].user.name.split(' ').slice(0,2).join(' ')}</div>
                      {top3[0].className && <div className="text-[9px] font-bold text-primary-500 uppercase tracking-wider mb-0.5">{top3[0].className}</div>}
                      <div className="text-xs font-bold text-warning-500 flex items-center gap-1 justify-center">
                        <Star size={12} fill="currentColor" /> {top3[0].stats?.xp || 0} XP
                      </div>
                      {top3[0].isCurrentUser && <Badge variant="primary" className="mt-1 text-[9px]">Você!</Badge>}
                    </div>
                    <div className="w-full h-36 bg-warning-50 rounded-t-[3rem] border-x-2 border-t-2 border-warning-100 flex items-end justify-center pb-6">
                      <Trophy size={48} className="text-warning-200" />
                    </div>
                  </div>
                )}

                {/* 3rd */}
                {top3[2] ? (
                  <div className="flex flex-col items-center gap-4">
                    <div className="relative">
                      <div className={cn('w-16 h-16 rounded-[1.5rem] text-white flex items-center justify-center font-black text-2xl rotate-[10deg] shadow-lg border-4 border-white', avatarColors[2 % avatarColors.length])}>
                        {top3[2].user.name[0]}
                      </div>
                      <div className="absolute -top-3 -left-3 w-8 h-8 rounded-full bg-orange-50 flex items-center justify-center text-orange-500 shadow-sm border border-orange-100">
                        <Medal size={16} />
                      </div>
                    </div>
                    <div className="text-center">
                      <div className="text-sm font-black text-slate-700 truncate max-w-[90px]">{top3[2].user.name.split(' ').slice(0,2).join(' ')}</div>
                      {top3[2].className && <div className="text-[9px] font-bold text-primary-500 uppercase tracking-wider">{top3[2].className}</div>}
                      <div className="text-[10px] font-bold text-slate-400">{top3[2].stats?.xp || 0} XP</div>
                    </div>
                    <div className="w-full h-20 bg-orange-50/50 rounded-t-[2.5rem] border-x-2 border-t-2 border-orange-50 flex items-end justify-center pb-4">
                      <span className="text-4xl font-black text-orange-100">3</span>
                    </div>
                  </div>
                ) : <div />}
              </div>
            )}

            {/* Top 10 List */}
            {top10.length > 0 && (
              <Card className="p-4 border-slate-100 rounded-[2.5rem] shadow-xl space-y-2">
                <div className="px-4 py-2 text-[10px] font-black uppercase text-slate-400 tracking-widest border-b border-slate-50 mb-2">
                  Elite — Top 10
                </div>
                {top10.map((item) => (
                  <div
                    key={item.user.id}
                    className={cn(
                      'flex items-center justify-between p-4 rounded-2xl transition-all group',
                      item.isCurrentUser ? 'bg-primary-50 border border-primary-100 shadow-sm' : 'hover:bg-slate-50 border border-transparent'
                    )}
                  >
                    <div className="flex items-center gap-6">
                      <div className="w-6 text-center font-black text-slate-400 group-hover:text-primary-500 transition-colors">#{item.rank}</div>
                      <div className={cn('w-12 h-12 rounded-2xl flex items-center justify-center text-white font-black text-lg shadow-sm', avatarColors[(item.rank - 1) % avatarColors.length])}>
                        {item.user.name[0]}
                      </div>
                      <div>
                        <h4 className={cn('text-base font-black tracking-tight', item.isCurrentUser ? 'text-primary-700' : 'text-slate-800')}>
                          {item.user.name}
                          {item.isCurrentUser && <span className="text-[10px] font-black uppercase text-primary-400 ml-2 tracking-widest">(Você)</span>}
                        </h4>
                        <div className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest flex items-center gap-2 flex-wrap">
                          <span>Nível {item.stats?.level || 1}</span>
                          <span className="w-1 h-1 bg-slate-200 rounded-full" />
                          <span className="text-orange-500 flex items-center gap-0.5"><Flame size={10} /> {item.stats?.streak || 0} dias</span>
                          {item.className && (
                            <>
                              <span className="w-1 h-1 bg-slate-200 rounded-full" />
                              <span className="text-primary-500 font-black">{item.className}</span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="text-sm font-black text-slate-800 flex items-center gap-1.5 px-4 py-2 bg-white rounded-xl shadow-sm border border-slate-100">
                        <Star size={14} className="text-warning-500 fill-warning-500" /> {item.stats?.xp || 0} XP
                      </div>
                    </div>
                  </div>
                ))}
              </Card>
            )}

            {/* If user is not in top 10 */}
            {myEntry && myEntry.rank > 10 && (
              <div className="mt-8 space-y-4">
                <div className="text-[10px] font-black uppercase text-slate-400 tracking-widest ml-2">Sua Colocação</div>
                <Card className="p-4 border-primary-200 bg-primary-50/50 rounded-[2rem] shadow-lg ring-1 ring-primary-100">
                  <div className="flex items-center justify-between p-2">
                    <div className="flex items-center gap-6">
                      <div className="w-6 text-center font-black text-primary-600">#{myEntry.rank}</div>
                      <div className={cn('w-12 h-12 rounded-2xl flex items-center justify-center text-white font-black text-lg shadow-sm', avatarColors[(myEntry.rank - 1) % avatarColors.length])}>
                        {myEntry.user.name[0]}
                      </div>
                      <div>
                        <h4 className="text-base font-black tracking-tight text-primary-700">
                          {myEntry.user.name}<span className="text-[10px] font-black uppercase text-primary-400 ml-2 tracking-widest">(Você)</span>
                        </h4>
                        <div className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest flex items-center gap-2">
                          <span>Nível {myEntry.stats?.level || 1}</span>
                          <span className="w-1 h-1 bg-slate-200 rounded-full" />
                          <span className="text-orange-500 flex items-center gap-0.5"><Flame size={10} /> {myEntry.stats?.streak || 0} dias</span>
                        </div>
                      </div>
                    </div>
                    <div className="text-sm font-black text-slate-800 flex items-center gap-1.5 px-4 py-2 bg-white rounded-xl shadow-sm border border-slate-100">
                      <Star size={14} className="text-warning-500 fill-warning-500" /> {myEntry.stats?.xp || 0} XP
                    </div>
                  </div>
                </Card>
              </div>
            )}
          </div>

          {/* Side info */}
          <div className="lg:col-span-4 space-y-8">
            <Card className="p-8 bg-slate-900 border-none rounded-[3rem] shadow-2xl relative overflow-hidden text-white">
              <div className="absolute top-0 right-0 w-32 h-32 bg-primary-500/10 rounded-full blur-3xl -mr-10 -mt-10" />
              <div className="relative z-10 space-y-6">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-white/10 rounded-2xl flex items-center justify-center text-warning-400">
                    <Trophy size={24} />
                  </div>
                  <div>
                    <h3 className="text-lg font-black">Sua Posição</h3>
                    <div className="text-[10px] font-black text-slate-500 tracking-widest uppercase">{currentScope.label}</div>
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="p-4 bg-white/5 rounded-2xl border border-white/10">
                    <div className="text-4xl font-black text-primary-400">#{myEntry?.rank || '-'}</div>
                    <div className="text-slate-400 text-sm font-bold mt-1">de {rankData.length} alunos</div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="p-3 bg-white/5 rounded-2xl text-center">
                      <div className="text-xl font-black text-white">{myEntry?.stats?.xp || 0}</div>
                      <div className="text-[9px] font-black text-slate-500 uppercase">XP</div>
                    </div>
                    <div className="p-3 bg-white/5 rounded-2xl text-center">
                      <div className="text-xl font-black text-white">{myEntry?.stats?.streak || 0}</div>
                      <div className="text-[9px] font-black text-slate-500 uppercase">🔥 Streak</div>
                    </div>
                  </div>
                </div>

                <div className="text-xs font-bold text-slate-500 text-center">
                  Continue completando atividades para subir no ranking!
                </div>
              </div>
            </Card>
          </div>
        </div>
      )}
    </div>
  );
};
