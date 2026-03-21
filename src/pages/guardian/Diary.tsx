import React, { useEffect, useState } from 'react';
import { useAuthStore } from '../../store/auth.store';
import { db, type DiaryEntry } from '../../lib/dexie';
import { useLiveQuery } from 'dexie-react-hooks';
import type { Student } from '../../types/user';
import {
  BookOpen, Search,
  Sparkles, Hash,
  X, BrainCircuit, Users, ChevronDown
} from 'lucide-react';
import { Card } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';


export const Diary: React.FC = () => {
  const { user: guardian } = useAuthStore();
  const [selectedStudentId, setSelectedStudentId] = useState<string>('');
  const [entries, setEntries] = useState<DiaryEntry[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);

  const studentsList = useLiveQuery(async () => {
    if (!guardian || guardian.role !== 'guardian') return [] as Student[];
    
    const liveG = await db.users.get(guardian.id);
    const sidList = (liveG && liveG.role === 'guardian') ? (liveG.studentIds || []) : [];

    // 2. Fetch by studentIds array OR search where guardianIds contains guardian.id
    const linkedByGuardian = await db.users.where('id').anyOf(sidList).toArray();
    const linkedByStudent = await db.users.where('guardianIds').equals(guardian.id).toArray();
    
    const all = [...linkedByGuardian, ...linkedByStudent];
    const uniqueIds = new Set();
    return all.filter(s => {
      if (s.role !== 'student' || uniqueIds.has(s.id)) return false;
      uniqueIds.add(s.id);
      return true;
    }) as Student[];
  }, [guardian?.id]) || [];

  useEffect(() => {
    if (studentsList.length > 0 && !selectedStudentId) {
      setSelectedStudentId(studentsList[0].id);
    }
  }, [studentsList, selectedStudentId]);

  useEffect(() => {
    if (selectedStudentId) {
      loadEntries(selectedStudentId);
    }
  }, [selectedStudentId]);

  const loadEntries = async (studentId: string) => {
    setLoading(true);
    const raw = await db.diaryEntries.where('studentId').equals(studentId).toArray();
    // Sort by newest first
    raw.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    setEntries(raw);
    setLoading(false);
  };

  const filtered = entries.filter(e =>
    !searchTerm ||
    e.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
    e.content.toLowerCase().includes(searchTerm.toLowerCase()) ||
    e.tags.some(t => t.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const allTags = [...new Set(entries.flatMap(e => e.tags))];

  if (loading && studentsList.length > 0 && entries.length === 0) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-12 h-12 border-4 border-primary-100 border-t-primary-500 rounded-full animate-spin" />
      </div>
    );
  }

  if (studentsList.length === 0 && !loading) {
    return (
      <div className="text-center py-20 animate-in fade-in duration-700">
        <Users className="mx-auto text-slate-200 mb-6" size={64} />
        <h2 className="text-2xl font-black text-slate-400">Nenhum aluno vinculado</h2>
        <p className="text-slate-300 mt-2 font-medium">Você precisa ter filhos vinculados para ver o diário de estudos.</p>
      </div>
    );
  }

  const selectedStudent = studentsList.find(s => s.id === selectedStudentId);

  return (
    <div className="space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-500">

      {/* Header */}
      <header className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-primary-500">
            <BookOpen size={20} className="stroke-[3]" />
            <span className="text-xs font-black uppercase tracking-[0.2em]">Registro de Aprendizado</span>
          </div>
          <h1 className="text-4xl font-black text-slate-800 tracking-tight leading-none">
            Diário de <span className="text-primary-600">Estudos</span>
          </h1>
          <p className="text-slate-500 font-medium">Acompanhe as descobertas e conquistas de seus filhos no dia a dia.</p>
        </div>

        {/* Student Selector */}
        {studentsList.length > 1 && (
          <div className="relative group">
            <select
              value={selectedStudentId}
              onChange={e => setSelectedStudentId(e.target.value)}
              className="appearance-none bg-white border-2 border-slate-100 rounded-2xl px-6 py-4 pr-12 font-black text-slate-800 focus:outline-none focus:border-primary-400 shadow-sm cursor-pointer transition-all h-14"
            >
              {studentsList.map(s => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
            <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none group-hover:text-primary-500 transition-colors" size={20} />
          </div>
        )}
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">

        {/* Sidebar */}
        <div className="lg:col-span-1 space-y-6">
          <Card className="p-8 space-y-8 bg-slate-900 text-white border-none shadow-2xl relative overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-primary-500/10 rounded-full blur-3xl -mr-10 -mt-10" />
            <div className="space-y-6 relative z-10">
              <div className="flex justify-between items-center">
                <h3 className="text-xs font-black uppercase text-slate-500 tracking-widest">Resumo de {selectedStudent?.name.split(' ')[0]}</h3>
                <Sparkles size={16} className="text-warning-400" />
              </div>
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <span className="text-sm font-bold text-slate-400">Total de Notas</span>
                  <span className="text-xl font-black">{entries.length}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm font-bold text-slate-400">Tags Ativas</span>
                  <span className="text-xl font-black">{allTags.length}</span>
                </div>
              </div>
            </div>
            <div className="pt-8 border-t border-white/10 space-y-4 relative z-10">
               <p className="text-[11px] text-slate-400 leading-relaxed font-medium">
                  Este espaço é exclusivo para leitura do acompanhamento pedagógico.
               </p>
            </div>
          </Card>

          {allTags.length > 0 && (
            <div className="space-y-4">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Tags Recentes</label>
              <div className="flex flex-wrap gap-2">
                {allTags.slice(0, 8).map(t => (
                  <button
                    key={t}
                    onClick={() => setSearchTerm(t)}
                    className="px-4 py-2 bg-white border border-slate-100 rounded-xl text-[10px] font-black uppercase text-slate-500 hover:border-primary-200 hover:text-primary-600 cursor-pointer transition-colors"
                  >
                    #{t}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Entries Feed */}
        <div className="lg:col-span-3 space-y-8">
          <div className="flex items-center gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-6 top-1/2 -translate-y-1/2 text-slate-300" size={18} />
              <input
                type="text"
                placeholder="Pesquisar nas anotações..."
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                className="w-full pl-14 pr-6 py-4 bg-white border border-slate-200 rounded-[2rem] text-sm font-bold focus:outline-none focus:border-primary-400 shadow-sm transition-all"
              />
              {searchTerm && (
                <button onClick={() => setSearchTerm('')} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-300 hover:text-slate-600">
                  <X size={18} />
                </button>
              )}
            </div>
          </div>

          <div className="space-y-6">
            {filtered.length === 0 ? (
              <div className="text-center py-20 bg-white rounded-[2.5rem] border-2 border-dashed border-slate-100">
                <div className="text-6xl mb-4">📝</div>
                <h3 className="text-xl font-black text-slate-600 mb-2">
                  {entries.length === 0 ? 'Nenhuma anotação ainda' : 'Nenhum resultado encontrado'}
                </h3>
                <p className="text-slate-400 text-sm mb-6">
                  {entries.length === 0
                    ? 'O aluno ainda não fez registros no diário.'
                    : 'Tente outro termo de busca.'}
                </p>
              </div>
            ) : (
              filtered.map(entry => (
                <Card key={entry.id} className="p-0 overflow-hidden border-slate-100 group hover:border-primary-100 hover:shadow-floating transition-all duration-500">
                  {entry.isAIGenerated && (
                    <div className="bg-gradient-to-r from-special-50 to-primary-50 border-b border-special-100/50 px-8 py-3 flex items-center gap-2">
                      <BrainCircuit size={14} className="text-special-500" />
                      <span className="text-[10px] font-black uppercase tracking-widest text-special-600">Reflexão sugerida pelo Tutor IA</span>
                    </div>
                  )}
                  <div className="p-8 space-y-6">
                    <div className="flex justify-between items-start">
                      <div className="flex gap-4">
                        <div className="w-14 h-14 bg-slate-50 border border-slate-100 rounded-2xl flex items-center justify-center text-2xl shadow-inner group-hover:scale-105 transition-transform">
                          {entry.mood}
                        </div>
                        <div>
                          <div className="flex items-center gap-3 mb-1">
                            <span className="text-[10px] font-black uppercase text-slate-400 tracking-widest">
                              {new Date(entry.createdAt).toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' })}
                            </span>
                            <span className="w-1 h-1 bg-slate-200 rounded-full" />
                            <span className="text-[10px] font-bold text-slate-400">
                               {new Date(entry.createdAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                            </span>
                          </div>
                          <h3 className="text-2xl font-black text-slate-800 leading-tight group-hover:text-primary-600 transition-colors uppercase tracking-tight">
                            {entry.title}
                          </h3>
                        </div>
                      </div>
                    </div>

                    <p className="text-slate-600 font-medium leading-relaxed text-lg">{entry.content}</p>

                    {entry.tags.length > 0 && (
                      <div className="flex flex-wrap gap-2 pt-2">
                        {entry.tags.map(tag => (
                          <Badge key={tag} variant="primary" className="bg-primary-50/50 border-primary-100/50 flex items-center gap-1.5">
                            <Hash size={10} /> {tag}
                          </Badge>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="px-8 py-5 bg-slate-50/50 border-t border-slate-50 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                       <span className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Acompanhamento Parental</span>
                    </div>
                  </div>
                </Card>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
