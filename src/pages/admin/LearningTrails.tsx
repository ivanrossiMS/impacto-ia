import React, { useState } from 'react';
import { 
  Zap, Plus, Search, BookOpen, Target, 
  ChevronRight, Trash2, Edit3, 
  Sparkles, Layers, GraduationCap, Calendar,
  AlertCircle, Trophy, X, CheckCircle2, History,
  PenTool, BrainCircuit, Info
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { db } from '../../lib/dexie';
import { useLiveQuery } from 'dexie-react-hooks';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { toast } from 'sonner';
import { cn } from '../../lib/utils';
import { createBulkNotifications } from '../../lib/notificationUtils';

// --- Modals ---

const TrailDetailModal: React.FC<{ trail: any; isOpen: boolean; onClose: () => void }> = ({ trail, isOpen, onClose }) => {
  if (!isOpen || !trail) return null;

  const stepIcons: Record<string, any> = {
    intro: <Info className="text-blue-500" />,
    theory: <BrainCircuit className="text-indigo-500" />,
    practice: <PenTool className="text-orange-500" />,
    quiz: <CheckCircle2 className="text-emerald-500" />,
    boss: <Trophy className="text-amber-500" />,
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-end bg-slate-900/40 backdrop-blur-sm">
      <motion.div 
        initial={{ x: '100%' }}
        animate={{ x: 0 }}
        exit={{ x: '100%' }}
        className="w-full max-w-2xl h-full bg-white shadow-2xl overflow-y-auto"
      >
        <div className="p-10 space-y-8">
           <header className="flex items-center justify-between">
              <div className="space-y-1">
                 <Badge variant="energy" className="uppercase tracking-widest text-[9px] italic">{trail.subject}</Badge>
                 <h2 className="text-4xl font-black text-slate-800 tracking-tight">{trail.title}</h2>
              </div>
              <button onClick={onClose} className="p-3 bg-slate-100 rounded-2xl text-slate-400 hover:text-slate-800 transition-colors">
                <X size={24} />
              </button>
           </header>

           <section className="bg-slate-50 border border-slate-100 p-8 rounded-[2.5rem] space-y-4">
              <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-400">Objetivo Pedagógico</h4>
              <p className="text-slate-600 font-medium leading-relaxed">{trail.description}</p>
              <div className="flex gap-4 pt-4">
                 <div className="flex items-center gap-2 bg-white px-4 py-2 rounded-xl border border-slate-100 shadow-sm">
                    <Trophy className="text-amber-500" size={16} />
                    <span className="text-xs font-bold text-slate-700">{trail.rewardXp} XP</span>
                 </div>
                 <div className="flex items-center gap-2 bg-white px-4 py-2 rounded-xl border border-slate-100 shadow-sm">
                    <History className="text-primary-500" size={16} />
                    <span className="text-xs font-bold text-slate-700">{trail.steps.length} Etapas</span>
                 </div>
              </div>
           </section>

           <section className="space-y-6">
              <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-400">Mapa de Aprendizagem</h4>
              <div className="relative space-y-8 pl-10">
                 <div className="absolute left-[20px] top-4 bottom-4 w-1 bg-slate-100 rounded-full" />
                 {trail.steps.map((step: any, idx: number) => (
                   <div key={step.id} className="relative group">
                      <div className="absolute -left-[30px] w-10 h-10 bg-white border-4 border-slate-100 rounded-2xl flex items-center justify-center group-hover:border-primary-500 transition-all">
                         {stepIcons[step.type] || <CheckCircle2 size={20} />}
                      </div>
                      <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm group-hover:shadow-md group-hover:bg-slate-50 transition-all">
                         <div className="flex justify-between items-center mb-1">
                            <span className="text-[9px] font-black uppercase text-slate-400 tracking-tighter">Fase {idx + 1}</span>
                            <Badge variant="outline" className="text-[8px] uppercase">{step.type}</Badge>
                         </div>
                         <h5 className="text-lg font-black text-slate-800 tracking-tight">{step.title}</h5>
                      </div>
                   </div>
                 ))}
              </div>
           </section>
        </div>
      </motion.div>
    </div>
  );
};

const EditTrailModal: React.FC<{ trail: any; isOpen: boolean; onClose: () => void; onSave: (data: any) => void }> = ({ trail, isOpen, onClose, onSave }) => {
  const [formData, setFormData] = React.useState({ ...trail });

  React.useEffect(() => {
    if (trail) setFormData({ ...trail });
  }, [trail]);

  if (!isOpen || !trail) return null;

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md">
       <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="bg-white rounded-[2.5rem] w-full max-w-lg p-10 space-y-6">
          <div className="flex items-center justify-between">
             <h3 className="text-2xl font-black text-slate-800">Editar Trilha</h3>
             <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-xl transition-colors"><X size={20} /></button>
          </div>
          <div className="space-y-4">
             <div className="space-y-1">
                <label className="text-[10px] font-black uppercase text-slate-400 ml-1">Título</label>
                <input 
                  value={formData.title} 
                  onChange={e => setFormData((p: any) => ({ ...p, title: e.target.value }))}
                  className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-5 py-4 font-bold outline-none focus:ring-4 focus:ring-primary-500/10" 
                />
             </div>
             <div className="space-y-1">
                <label className="text-[10px] font-black uppercase text-slate-400 ml-1">Descrição</label>
                <textarea 
                  rows={3}
                  value={formData.description} 
                  onChange={e => setFormData((p: any) => ({ ...p, description: e.target.value }))}
                  className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-5 py-4 font-bold outline-none focus:ring-4 focus:ring-primary-500/10 resize-none" 
                />
             </div>
             <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                   <label className="text-[10px] font-black uppercase text-slate-400 ml-1">Dificuldade</label>
                   <select 
                     value={formData.difficulty} 
                     onChange={e => setFormData((p: any) => ({ ...p, difficulty: e.target.value as any }))}
                     className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-5 py-4 font-bold outline-none"
                   >
                     <option value="easy">Fácil</option>
                     <option value="medium">Médio</option>
                     <option value="hard">Difícil</option>
                   </select>
                </div>
                <div className="space-y-1">
                   <label className="text-[10px] font-black uppercase text-slate-400 ml-1">Série</label>
                   <input 
                     value={formData.grade} 
                     onChange={e => setFormData((p: any) => ({ ...p, grade: e.target.value }))}
                     className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-5 py-4 font-bold outline-none" 
                   />
                </div>
             </div>
          </div>
          <div className="flex gap-3 pt-4 border-t border-slate-50">
             <Button variant="outline" className="flex-1 rounded-2xl" onClick={onClose}>Cancelar</Button>
             <Button variant="primary" className="flex-1 rounded-2xl" onClick={() => { onSave(formData); onClose(); }}>Salvar Alterações</Button>
          </div>
       </motion.div>
    </div>
  );
};

const LinkClassModal: React.FC<{ trail: any; isOpen: boolean; onClose: () => void; onLink: (classId: string, year: string) => void }> = ({ trail, isOpen, onClose, onLink }) => {
  const [selectedSchool, setSelectedSchool] = useState('');
  const [selectedClass, setSelectedClass] = useState('');
  const [year, setYear] = useState(new Date().getFullYear().toString());

  const schools = useLiveQuery(() => db.schools.toArray()) || [];
  const classes = useLiveQuery(async () => {
    if (!selectedSchool) return [];
    return db.classes.where('schoolId').equals(selectedSchool).toArray();
  }, [selectedSchool]) || [];

  if (!isOpen || !trail) return null;

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md">
       <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="bg-white rounded-[2.5rem] w-full max-w-md p-10 space-y-6">
          <div className="flex items-center justify-between">
             <div className="space-y-1">
                <h3 className="text-2xl font-black text-slate-800">Vincular Turma</h3>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{trail.title}</p>
             </div>
             <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-xl transition-colors"><X size={20} /></button>
          </div>
          
          <div className="space-y-5">
             <div className="space-y-1">
                <label className="text-[10px] font-black uppercase text-slate-400 ml-1">Escola</label>
                <select 
                  value={selectedSchool} onChange={e => setSelectedSchool(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-5 py-4 font-bold outline-none"
                >
                   <option value="">Selecione a Escola</option>
                   {schools.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
             </div>

             <div className="space-y-1">
                <label className="text-[10px] font-black uppercase text-slate-400 ml-1">Turma Destino</label>
                <select 
                  disabled={!selectedSchool}
                  value={selectedClass} onChange={e => setSelectedClass(e.target.value)}
                  className="w-full disabled:opacity-50 bg-slate-50 border border-slate-100 rounded-2xl px-5 py-4 font-bold outline-none"
                >
                   <option value="">Selecione a Turma</option>
                   {classes.map(c => <option key={c.id} value={c.id}>{c.name} ({c.grade})</option>)}
                </select>
             </div>

             <div className="space-y-1">
                <label className="text-[10px] font-black uppercase text-slate-400 ml-1">Ano Letivo</label>
                <select 
                  value={year} onChange={e => setYear(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-5 py-4 font-bold outline-none"
                >
                   {[2024, 2025, 2026, 2027].map(y => <option key={y} value={y.toString()}>{y}</option>)}
                </select>
             </div>
          </div>

          <div className="flex gap-3 pt-4 border-t border-slate-50">
             <Button variant="outline" className="flex-1 rounded-2xl" onClick={onClose}>Cancelar</Button>
             <Button 
               variant="primary" 
               className="flex-1 rounded-2xl" 
               disabled={!selectedClass}
               onClick={() => { onLink(selectedClass, year); onClose(); }}
             >
                Confirmar Vínculo
             </Button>
          </div>
       </motion.div>
    </div>
  );
};


const AIGeneratorModal: React.FC<{ isOpen: boolean; onClose: () => void; onGenerate: (data: any) => void }> = ({ isOpen, onClose, onGenerate }) => {
  const [isGenerating, setIsGenerating] = useState(false);
  const [formData, setFormData] = useState({
    subject: '',
    topic: '',
    grade: '',
    difficulty: 'medium'
  });

  const handleGenerate = async () => {
    setIsGenerating(true);
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    const mockGeneratedTrail = {
      id: crypto.randomUUID(),
      title: `${formData.topic} - Jornada de Descoberta`,
      subject: formData.subject,
      grade: formData.grade,
      difficulty: formData.difficulty,
      description: `Uma trilha completa sobre ${formData.topic} gerada por nossa IA pedagógica.`,
      rewardXp: 500,
      rewardCoins: 200,
      isAIGenerated: true,
      steps: [
        { id: '1', title: `Introdução ao ${formData.topic}`, type: 'intro' },
        { id: '2', title: `Conceitos Fundamentais`, type: 'theory' },
        { id: '3', title: `Prática de Fixação`, type: 'practice' },
        { id: '4', title: `Desafio Final`, type: 'quiz' },
        { id: '5', title: `O Grande Mestre`, type: 'boss' },
      ],
      createdAt: new Date().toISOString()
    };
    
    onGenerate(mockGeneratedTrail);
    setIsGenerating(false);
    onClose();
    toast.success('Trilha gerada com sucesso pela IA!');
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md">
      <motion.div initial={{ opacity: 0, scale: 0.95, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} className="bg-white rounded-[2.5rem] shadow-2xl w-full max-w-xl overflow-hidden">
        <div className="bg-gradient-to-br from-primary-600 to-indigo-700 p-8 text-white relative">
          <Sparkles className="mb-4 text-primary-200" size={32} />
          <h2 className="text-2xl font-black tracking-tight">IA Magic Generator</h2>
          <p className="text-primary-100/80 text-sm font-medium">Crie trilhas completas em segundos.</p>
        </div>
        <div className="p-8 space-y-6">
          {isGenerating ? (
            <div className="py-12 flex flex-col items-center text-center space-y-6">
              <div className="relative">
                <div className="w-20 h-20 border-4 border-primary-100 rounded-full"></div>
                <div className="absolute inset-0 w-20 h-20 border-4 border-primary-500 border-t-transparent rounded-full animate-spin"></div>
                <Zap className="absolute inset-0 m-auto text-primary-500 animate-pulse" size={32} />
              </div>
              <h4 className="text-lg font-black text-slate-800 italic uppercase">Gerando conteúdo inteligente...</h4>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2 col-span-2">
                  <label className="text-[10px] font-black uppercase text-slate-400 ml-1">Assunto / Tema Central</label>
                  <input placeholder="Ex: Sistema Solar..." className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-5 py-4 font-bold outline-none" value={formData.topic} onChange={e => setFormData(prev => ({ ...prev, topic: e.target.value }))} />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase text-slate-400 ml-1">Disciplina</label>
                  <select className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-5 py-4 font-bold outline-none" value={formData.subject} onChange={e => setFormData(prev => ({ ...prev, subject: e.target.value }))}>
                    <option value="">Selecione...</option>
                    <option value="Português">Português</option><option value="Matemática">Matemática</option><option value="História">História</option><option value="Geografia">Geografia</option><option value="Ciências">Ciências</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase text-slate-400 ml-1">Série</label>
                  <select className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-5 py-4 font-bold outline-none" value={formData.grade} onChange={e => setFormData(prev => ({ ...prev, grade: e.target.value }))}>
                    <option value="">Selecione...</option>
                    {['1º Ano', '2º Ano', '3º Ano', '4º Ano', '5º Ano', '6º Ano', '7º Ano', '8º Ano', '9º Ano', 'EM'].map(g => <option key={g} value={g}>{g}</option>)}
                  </select>
                </div>
              </div>
              <div className="flex gap-3 pt-4">
                <Button variant="outline" className="flex-1 rounded-2xl" onClick={onClose}>Cancelar</Button>
                <Button disabled={!formData.topic || !formData.subject || !formData.grade} variant="primary" className="flex-1 rounded-2xl" onClick={handleGenerate}>Gerar com IA</Button>
              </div>
            </>
          )}
        </div>
      </motion.div>
    </div>
  );
};

// --- Main Page ---

export const AdminLearningTrails: React.FC = () => {
  const [showAIModal, setShowAIModal] = useState(false);
  const [search, setSearch] = useState('');
  
  // Modal States
  const [activeTrailDetail, setActiveTrailDetail] = useState<any>(null);
  const [trailToEdit, setTrailToEdit] = useState<any>(null);
  const [trailToLink, setTrailToLink] = useState<any>(null);

  const trails = useLiveQuery(() => db.learningPaths.toArray()) || [];
  const classes = useLiveQuery(() => db.classes.toArray()) || [];

  const filteredTrails = trails.filter(t => 
    t.title.toLowerCase().includes(search.toLowerCase()) ||
    t.subject.toLowerCase().includes(search.toLowerCase())
  );

  const handleDelete = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (window.confirm('Excluir esta trilha permanentemente?')) {
      await db.learningPaths.delete(id);
      toast.success('Trilha removida');
    }
  };

  const handleUpdateTrail = async (data: any) => {
    if (!data.id) return;
    await db.learningPaths.update(data.id, data);
    toast.success('Trilha atualizada com sucesso!');
  };

  const handleLinkTrail = async (classId: string, year: string) => {
    if (!trailToLink) return;
    await db.learningPaths.update(trailToLink.id, { classId, schoolYear: year });
    const cls = await db.classes.get(classId);
    if (cls && cls.studentIds && cls.studentIds.length > 0) {
      // Notify students (and Guardians automatically via mirroring)
      await createBulkNotifications(
        cls.studentIds,
        'student',
        'Nova Trilha de Aprendizagem! 🚀',
        `Uma nova trilha foi liberada para sua turma: "${trailToLink.title}".`,
        'success',
        'high',
        '/student/learning'
      );
    }
  };

  return (
    <div className="space-y-10 pb-20">
      <section className="flex flex-col md:flex-row md:items-end justify-between gap-8">
        <div className="space-y-2">
           <Badge variant="primary" className="px-3 py-1 text-[9px] uppercase tracking-widest font-black italic">Pedagogia Gamificada</Badge>
           <h1 className="text-5xl font-black text-slate-900 tracking-tight leading-none group">
             Trilhas de <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary-600 to-indigo-600">Aprendizagem</span>
           </h1>
           <p className="text-slate-400 font-bold max-w-xl text-lg tracking-tight leading-relaxed">Gerencie roteiros dinâmicos e utilize <span className="text-primary-500">IA</span> educativa.</p>
        </div>
        <div className="flex items-center gap-4">
           <Button variant="outline" className="rounded-2xl border-2 border-slate-200" onClick={() => setShowAIModal(true)}><Zap className="mr-2 text-amber-500" size={18} />Gerar com IA</Button>
           <Button variant="primary" className="rounded-2xl px-8" onClick={() => toast.info('Criação manual em desenvolvimento. Use Gerar com IA!')}><Plus size={20} className="mr-2" /> Nova Trilha</Button>
        </div>
      </section>

      <section className="grid grid-cols-1 md:grid-cols-4 gap-6">
        {[
          { label: 'Total de Trilhas', val: trails.length, icon: Layers, color: 'text-blue-600', bg: 'bg-blue-50' },
          { label: 'Classes Atendidas', val: Array.from(new Set(trails.map(t => t.classId).filter(Boolean))).length, icon: Target, color: 'text-indigo-600', bg: 'bg-indigo-50' },
          { label: 'IA Generated', val: trails.filter(t => t.isAIGenerated).length, icon: Sparkles, color: 'text-amber-600', bg: 'bg-amber-50' },
          { label: 'Engajamento', val: '84%', icon: Trophy, color: 'text-emerald-600', bg: 'bg-emerald-50' },
        ].map((s, i) => (
          <div key={i} className="bg-white p-6 rounded-[2.5rem] border border-slate-100 shadow-sm flex items-center gap-4">
            <div className={cn("w-14 h-14 rounded-2xl flex items-center justify-center", s.bg, s.color)}><s.icon size={24} /></div>
            <div>
              <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest leading-none mb-1.5">{s.label}</p>
              <h4 className="text-2xl font-black text-slate-800 tracking-tight">{s.val}</h4>
            </div>
          </div>
        ))}
      </section>

      <section className="flex flex-col md:flex-row gap-6">
        <div className="relative flex-1">
          <Search className="absolute left-6 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar por título ou disciplina..." className="w-full bg-white border border-slate-100 rounded-[2rem] py-5 pl-16 pr-6 text-sm font-bold shadow-sm outline-none" />
        </div>
      </section>

      <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
        <AnimatePresence>
          {filteredTrails.map((trail) => (
            <motion.div
              layout initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }} key={trail.id}
              onClick={() => setActiveTrailDetail(trail)}
              className="bg-white rounded-[2.5rem] border border-transparent hover:border-primary-200 shadow-xl hover:shadow-primary-500/10 transition-all p-8 flex flex-col group cursor-pointer relative overflow-hidden"
            >
              {trail.isAIGenerated && <div className="absolute top-0 right-0 p-3 bg-amber-500/10 text-amber-600 rounded-bl-3xl"><Sparkles size={14} className="animate-pulse" /></div>}
              
              <div className="flex items-start justify-between mb-6">
                <div className="w-16 h-16 bg-slate-50 rounded-3xl flex items-center justify-center text-primary-500 border border-slate-100 group-hover:bg-primary-50 group-hover:scale-110 transition-all"><BookOpen size={32} /></div>
                <div className="flex gap-2 relative z-10">
                   <button 
                     onClick={(e) => { e.stopPropagation(); setTrailToEdit(trail); }}
                     className="p-3 bg-slate-50 text-slate-400 hover:text-primary-600 hover:bg-primary-50 rounded-2xl transition-all"
                   >
                     <Edit3 size={18} />
                   </button>
                   <button onClick={(e) => handleDelete(e, trail.id)} className="p-3 bg-slate-50 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-2xl transition-all"><Trash2 size={18} /></button>
                </div>
              </div>

              <div className="space-y-4 flex-1">
                 <div>
                    <h3 className="text-xl font-black text-slate-800 tracking-tight line-clamp-2">{trail.title}</h3>
                    <div className="flex flex-wrap gap-2 mt-2">
                       <Badge variant="energy" className="text-[9px] uppercase italic">{trail.subject}</Badge>
                       <Badge variant="outline" className="text-[9px] uppercase border-slate-200 font-black">{trail.grade}</Badge>
                    </div>
                 </div>
                 <p className="text-slate-500 text-sm font-medium line-clamp-3 leading-relaxed">{trail.description}</p>
                 <div className="pt-4 border-t border-slate-50 space-y-3">
                    <div className="flex items-center justify-between text-[10px] font-black uppercase tracking-widest text-slate-400">
                       <span className="flex items-center gap-1.5"><Calendar size={14} /> {trail.schoolYear || 'Qualquer Ano'}</span>
                       <span className="flex items-center gap-1.5 text-primary-500"><History size={14} /> {trail.steps.length} Etapas</span>
                    </div>
                    {trail.classId ? (
                      <div className="flex items-center gap-2 p-3 bg-blue-50/50 rounded-2xl border border-blue-100/50">
                         <GraduationCap size={16} className="text-blue-500" />
                         <span className="text-[10px] font-black text-blue-700 uppercase tracking-tight truncate">
                           {classes.find(c => c.id === trail.classId)?.name || 'Classe Vinculada'}
                         </span>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2 p-3 bg-slate-50 rounded-2xl border border-dashed border-slate-200">
                         <AlertCircle size={16} className="text-slate-400" />
                         <span className="text-[10px] font-black text-slate-400 uppercase tracking-tight">Sem vínculo de turma</span>
                      </div>
                    )}
                 </div>
              </div>

              <Button 
                variant="outline" 
                className="mt-8 rounded-2xl w-full border-2 group/btn hover:bg-primary-600 hover:text-white hover:border-primary-600 transition-all overflow-hidden"
                onClick={(e) => { e.stopPropagation(); setTrailToLink(trail); }}
              >
                <Target size={18} className="mr-2 group-hover/btn:scale-125 transition-transform" />
                Vincular Alunos
                <ChevronRight size={16} className="ml-auto opacity-0 group-hover/btn:opacity-100 transition-all" />
              </Button>
            </motion.div>
          ))}
        </AnimatePresence>
      </section>

      {/* Modals */}
      <TrailDetailModal trail={activeTrailDetail} isOpen={!!activeTrailDetail} onClose={() => setActiveTrailDetail(null)} />
      <EditTrailModal trail={trailToEdit} isOpen={!!trailToEdit} onClose={() => setTrailToEdit(null)} onSave={handleUpdateTrail} />
      <LinkClassModal trail={trailToLink} isOpen={!!trailToLink} onClose={() => setTrailToLink(null)} onLink={handleLinkTrail} />
      <AIGeneratorModal isOpen={showAIModal} onClose={() => setShowAIModal(false)} onGenerate={(t) => db.learningPaths.add(t)} />
    </div>
  );
};
