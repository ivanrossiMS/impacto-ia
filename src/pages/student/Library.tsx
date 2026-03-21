import React, { useState } from 'react';
import {
  Library as LibraryIcon,
  Search, Filter, FileText, Video, Music,
  BookOpen, Star, Download, Eye, Clock,
  ExternalLink, Sparkles, TrendingUp
} from 'lucide-react';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { cn } from '../../lib/utils';
import { toast } from 'sonner';
import { db } from '../../lib/dexie';
import { useLiveQuery } from 'dexie-react-hooks';
import { useAuthStore } from '../../store/auth.store';
import { incrementMissionProgress } from '../../lib/missionUtils';
import { updateGamificationStats } from '../../lib/gamificationUtils';
import { motion, AnimatePresence } from 'framer-motion';
import type { LibraryItem } from '../../types/learning';

const TYPE_CONFIG = {
  video: { color: 'bg-red-500', icon: Video, label: 'Vídeo', emoji: '🎥' },
  quiz:  { color: 'bg-indigo-500', icon: BookOpen, label: 'Quiz', emoji: '📝' },
  audio: { color: 'bg-violet-500', icon: Music, label: 'Áudio', emoji: '🎵' },
  text:  { color: 'bg-green-500', icon: FileText, label: 'Texto', emoji: '📄' },
};

// --- Preview Modal ---
const PreviewModal: React.FC<{
  item: LibraryItem;
  onClose: () => void;
  onRead: (item: LibraryItem) => void;
}> = ({ item, onClose, onRead }) => {
  const config = TYPE_CONFIG[item.type];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
      <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
        className="bg-white rounded-[2rem] shadow-2xl w-full max-w-lg overflow-hidden">
        {/* Header */}
        <div className={cn('p-8 text-white relative overflow-hidden', config.color)}>
          <div className="absolute top-0 right-0 w-40 h-40 bg-white/10 rounded-full blur-3xl -mr-10 -mt-10" />
          <div className="relative z-10 flex items-center gap-5">
            <div className="w-16 h-16 bg-white/20 backdrop-blur-md rounded-2xl flex items-center justify-center text-white text-3xl shadow-xl font-bold">
              {config.emoji}
            </div>
            <div>
              <div className="text-[10px] font-black uppercase tracking-widest text-white/60 mb-1">{config.label}</div>
              <h2 className="text-xl font-black leading-tight">{item.title}</h2>
            </div>
          </div>
        </div>

        {/* Body */}
        <div className="p-7 space-y-6">
          <div className="flex flex-wrap gap-2">
            <span className="text-[10px] font-black uppercase text-primary-600 tracking-wider bg-primary-50 px-3 py-1.5 rounded-xl">{item.subject}</span>
            <span className="text-[10px] font-bold bg-slate-100 text-slate-600 px-3 py-1.5 rounded-xl">{item.grade}</span>
            <span className="text-[10px] font-black uppercase text-energy-600 bg-energy-50 px-3 py-1.5 rounded-xl flex items-center gap-1">
               <Sparkles size={10} /> +25 XP ao Estudar
            </span>
          </div>

          <div className="bg-slate-50 rounded-2xl p-5">
            <div className="text-[10px] font-black uppercase text-slate-400 tracking-widest mb-2">Resumo do Material</div>
            <p className="text-sm text-slate-700 font-medium leading-relaxed">
              {item.description || "Este material foi disponibilizado pelo seu professor para auxiliar nos seus estudos de " + item.subject + ". Aproveite para revisar os conceitos e praticar!"}
            </p>
          </div>

          <div className="flex gap-3 pt-2">
            <Button variant="outline" onClick={onClose} className="flex-1 rounded-xl py-3 font-bold border-2">Fechar</Button>
            <Button variant="primary" onClick={() => onRead(item)} className="flex-[2] rounded-xl py-3 gap-2 shadow-lg shadow-primary-500/20 font-black">
              {item.url ? <><ExternalLink size={18} /> Abrir Agora</> : <><Download size={18} /> Baixar Material</>}
            </Button>
          </div>
        </div>
      </motion.div>
    </div>
  );
};

export const Library: React.FC = () => {
  const { user } = useAuthStore();
  const [searchTerm, setSearchTerm] = useState('');
  const [filterSubject, setFilterSubject] = useState('Todas');
  const [filterType, setFilterType] = useState('Todos');
  const [previewItem, setPreviewItem] = useState<LibraryItem | null>(null);

  // Get student's class
  const studentData = useLiveQuery(() => 
    user ? db.users.get(user.id) : Promise.resolve(undefined)
  ) as any;
  const classId = studentData?.classId;
  const grade = studentData?.grade;

  // Get library items for this class OR generic items for this grade
  const items = useLiveQuery(async () => {
    const all = await db.libraryItems.toArray();
    return all.filter(item => 
      (item.classId === classId) || (item.grade === grade && !item.classId)
    );
  }, [classId, grade]) || [];

  const SUBJECTS = ['Todas', ...new Set(items.map(i => i.subject))];
  const TYPES = ['Todos', 'Texto', 'Vídeo', 'Quiz', 'Áudio'];
  const typeMap: Record<string, string> = { text: 'Texto', video: 'Vídeo', quiz: 'Quiz', audio: 'Áudio' };

  const filtered = items.filter(item => {
    const matchSub = filterSubject === 'Todas' || item.subject === filterSubject;
    const matchType = filterType === 'Todos' || typeMap[item.type] === filterType;
    const matchSearch = item.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                       item.subject.toLowerCase().includes(searchTerm.toLowerCase());
    return matchSub && matchType && matchSearch;
  });

  const handleRead = async (item: LibraryItem) => {
    if (!user) return;

    // Increment XP in gamificationStats
    try {
      await updateGamificationStats(user.id, { xpToAdd: 25 });
      
      toast.success('Você ganhou +25 XP por estudar este material!', {
        icon: <Sparkles className="text-energy-500" />
      });

      // Update Mission Progress
      await incrementMissionProgress(user.id, 'library_access', 1);
    } catch (e) {
      console.error('Error updating library stats:', e);
    }
    
    // Increment downloads count in DB for this item
    await db.libraryItems.update(item.id, { downloads: (item.downloads || 0) + 1 });
    
    if (item.url) window.open(item.url, '_blank');
    setPreviewItem(null);
  };

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <header className="flex flex-col md:flex-row md:items-end justify-between gap-6 bg-white p-8 rounded-[2.5rem] shadow-sm border border-slate-100">
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-primary-500">
            <div className="p-2 bg-primary-50 rounded-xl">
              <LibraryIcon size={20} className="stroke-[3]" />
            </div>
            <span className="text-xs font-black uppercase tracking-[0.2em]">Sua Biblioteca</span>
          </div>
          <h1 className="text-4xl font-black text-slate-800 tracking-tight leading-none">Materiais de <span className="text-primary-600">Estudo</span></h1>
          <p className="text-slate-500 font-medium">Explore os recursos que seu professor separou para você turbinar seu aprendizado.</p>
        </div>
        <div className="flex items-center gap-4 bg-slate-50 px-6 py-4 rounded-3xl border border-slate-100">
           <div className="p-3 bg-white rounded-2xl shadow-sm text-energy-500">
              <TrendingUp size={24} />
           </div>
           <div>
              <div className="text-[10px] font-black uppercase text-slate-400 tracking-widest leading-none mb-1 text-left">Seu Nível de Foco</div>
              <div className="text-lg font-black text-slate-800 leading-none">Excelente</div>
           </div>
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
        {/* Filters Sidebar */}
        <aside className="lg:col-span-1 space-y-6">
          <Card className="p-6 space-y-6 border-none shadow-xl bg-slate-900 text-white rounded-[2rem]">
            <div className="flex items-center gap-2 text-xs font-black uppercase tracking-widest text-slate-500">
              <Filter size={14} /> Filtros Rápidos
            </div>

            <div className="space-y-3">
              <label className="text-[10px] font-black uppercase text-slate-500 tracking-widest">Disciplina</label>
              <div className="grid gap-1.5">
                {SUBJECTS.map(s => (
                  <button key={s} onClick={() => setFilterSubject(s)}
                    className={cn('w-full text-left px-4 py-3 rounded-xl text-xs font-bold transition-all border border-transparent',
                      filterSubject === s ? 'bg-primary-500 text-white shadow-lg shadow-primary-500/30' : 'hover:bg-white/5 text-slate-400')}>
                    {s}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-3 pt-2">
              <label className="text-[10px] font-black uppercase text-slate-500 tracking-widest">Tipo de Material</label>
              <div className="grid gap-1.5">
                {TYPES.map(t => (
                  <button key={t} onClick={() => setFilterType(t)}
                    className={cn('w-full text-left px-4 py-3 rounded-xl text-xs font-bold transition-all border border-transparent',
                      filterType === t ? 'bg-indigo-500 text-white shadow-lg shadow-indigo-500/30' : 'hover:bg-white/5 text-slate-400')}>
                    {t === 'Texto' ? '📄' : t === 'Vídeo' ? '🎥' : t === 'Quiz' ? '📝' : t === 'Áudio' ? '🎵' : '🔍'} {t}
                  </button>
                ))}
              </div>
            </div>
          </Card>
          
          <div className="bg-gradient-to-br from-primary-500 to-indigo-600 rounded-[2rem] p-6 text-white text-center shadow-xl">
             <div className="w-16 h-16 bg-white/20 rounded-full flex items-center justify-center mx-auto mb-4 border border-white/30 backdrop-blur-md">
                <Sparkles size={32} />
             </div>
             <h3 className="font-black text-lg leading-tight mb-2">Desafio de Leitura</h3>
             <p className="text-xs font-medium text-white/80 mb-4 tracking-wide">Leia 3 materiais esta semana para ganhar um emblema raro!</p>
             <div className="w-full bg-black/20 h-2 rounded-full overflow-hidden mb-1">
                <div className="bg-white h-full" style={{ width: '66%' }}></div>
             </div>
             <div className="text-[10px] font-black uppercase tracking-widest">2/3 concluídos</div>
          </div>
        </aside>

        {/* Content Area */}
        <div className="lg:col-span-3 space-y-6">
          <div className="relative group">
            <Search className="absolute left-6 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-primary-500 transition-colors" size={20} />
            <input type="text" placeholder="O que você quer aprender hoje?"
              value={searchTerm} onChange={e => setSearchTerm(e.target.value)}
              className="w-full pl-14 pr-8 py-5 bg-white border-2 border-slate-100 rounded-[2rem] text-sm font-bold focus:outline-none focus:border-primary-400 focus:ring-4 focus:ring-primary-500/5 shadow-sm transition-all text-slate-700" />
          </div>

          {filtered.length === 0 ? (
            <div className="text-center py-24 bg-white border-2 border-dashed border-slate-100 rounded-[3rem]">
              <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-6 text-slate-200">
                <BookOpen size={40} />
              </div>
              <h3 className="text-xl font-black text-slate-400">Silêncio na biblioteca...</h3>
              <p className="text-sm text-slate-300 mt-2 max-w-xs mx-auto">Nenhum material encontrado com esses filtros. Tente buscar por outro assunto!</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {filtered.map(item => {
                const config = TYPE_CONFIG[item.type];
                const Icon = config.icon;
                return (
                  <Card key={item.id} className="p-0 overflow-hidden border-2 border-slate-50 group hover:border-primary-100 hover:shadow-2xl hover:shadow-primary-500/10 transition-all duration-500 cursor-pointer rounded-[2rem]"
                    onClick={() => setPreviewItem(item)}>
                    <div className="p-7">
                      <div className="flex items-start gap-5">
                        <div className={cn('w-14 h-14 rounded-2xl flex items-center justify-center text-white shadow-lg flex-shrink-0 group-hover:scale-110 group-hover:rotate-3 transition-all duration-300', config.color)}>
                          <Icon size={26} />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 mb-2">
                             <span className="text-[10px] font-black uppercase text-primary-600 tracking-wider bg-primary-50 px-2 py-1 rounded-lg italic">{item.subject}</span>
                             <span className="text-[9px] font-black text-slate-300 uppercase tracking-widest flex items-center gap-1">
                                <Clock size={10} /> {new Date(item.addedAt || '').toLocaleDateString('pt-BR')}
                             </span>
                          </div>
                          <h3 className="text-lg font-black text-slate-800 leading-tight group-hover:text-primary-600 transition-colors">{item.title}</h3>
                          {item.description && <p className="text-xs text-slate-400 mt-2 line-clamp-2 leading-relaxed font-medium">{item.description}</p>}
                        </div>
                      </div>
                    </div>
                    <div className="px-7 py-5 flex items-center justify-between bg-slate-50/50 border-t border-slate-50 group-hover:bg-primary-50/30 transition-colors">
                      <div className="flex items-center gap-4">
                        <div className="flex items-center gap-1.5 text-slate-400 text-xs font-bold">
                          <Eye size={14} className="text-slate-300" /> {item.downloads} visualizações
                        </div>
                        {item.rating > 0 && (
                          <div className="flex items-center gap-1 text-yellow-500 text-xs font-black">
                            <Star size={14} fill="currentColor" /> {item.rating}
                          </div>
                        )}
                      </div>
                      <div className="flex items-center gap-2 text-primary-600 font-black text-xs group-hover:translate-x-1 transition-transform">
                          Ver Material <Sparkles size={12} className="text-energy-500" />
                      </div>
                    </div>
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      </div>

      <AnimatePresence>
        {previewItem && (
          <PreviewModal
            item={previewItem}
            onClose={() => setPreviewItem(null)}
            onRead={handleRead}
          />
        )}
      </AnimatePresence>
    </div>
  );
};
