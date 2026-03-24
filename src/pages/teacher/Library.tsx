import React, { useState, useRef } from 'react';
import {
  Library as LibraryIcon,
  Search, Filter, FileText, Video, Music,
  BookOpen, Star, Download, Share2, Upload, Trash2,
  X, Eye, Layers, GraduationCap, Clock, Edit2, Save,
  CheckSquare, ExternalLink
} from 'lucide-react';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { cn } from '../../lib/utils';
import { toast } from 'sonner';
import { supabase } from '../../lib/supabase';
import { useSupabaseQuery } from '../../hooks/useSupabase';
import { useAuthStore } from '../../store/auth.store';
import { motion, AnimatePresence } from 'framer-motion';
import type { LibraryItem } from '../../types/learning';
import { createBulkNotifications } from '../../lib/notificationUtils';



const SUBJECTS = ['Matemática', 'Português', 'Ciências', 'História', 'Geografia', 'Inglês', 'Artes', 'Educação Física', 'Filosofia', 'Sociologia'];
const GRADES = ['1º Ano','2º Ano','3º Ano','4º Ano','5º Ano','6º Ano','7º Ano','8º Ano','9º Ano','1º EM','2º EM','3º EM'];
const CURRENT_YEAR = new Date().getFullYear();
const YEARS = [String(CURRENT_YEAR), String(CURRENT_YEAR - 1), String(CURRENT_YEAR - 2)];

const TYPE_CONFIG = {
  video: { color: 'bg-red-500', icon: Video, label: 'Vídeo', emoji: '🎥', desc: 'Conteúdo em vídeo' },
  quiz:  { color: 'bg-indigo-500', icon: BookOpen, label: 'Quiz', emoji: '📝', desc: 'Banco de questões' },
  audio: { color: 'bg-violet-500', icon: Music, label: 'Áudio', emoji: '🎵', desc: 'Material em áudio' },
  text:  { color: 'bg-green-500', icon: FileText, label: 'Texto', emoji: '📄', desc: 'Texto ou apostila' },
};


// ─── Library Item Preview Modal ───────────────────────────────────────────────
const PreviewModal: React.FC<{
  item: LibraryItem;
  onClose: () => void;
  onEdit?: () => void;
}> = ({ item, onClose, onEdit }) => {
  const config = TYPE_CONFIG[item.type];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
      <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
        className="bg-white rounded-[2rem] shadow-2xl w-full max-w-lg overflow-hidden">
        {/* Header */}
        <div className={cn('p-8 text-white relative overflow-hidden', config.color)}>
          <div className="absolute top-0 right-0 w-40 h-40 bg-white/10 rounded-full blur-3xl -mr-10 -mt-10" />
          <button onClick={onClose} className="absolute top-4 right-4 p-2 text-white/70 hover:text-white hover:bg-white/20 rounded-xl transition-all">
            <X size={18} />
          </button>
          <div className="relative z-10 flex items-center gap-5">
            <div className="w-16 h-16 bg-white/20 backdrop-blur-md rounded-2xl flex items-center justify-center text-white text-3xl shadow-xl">
              {config.emoji}
            </div>
            <div>
              <div className="text-[10px] font-black uppercase tracking-widest text-white/60 mb-1">{config.label}</div>
              <h2 className="text-xl font-black leading-tight">{item.title}</h2>
            </div>
          </div>
        </div>

        {/* Body */}
        <div className="p-7 space-y-5">
          {/* Tags */}
          <div className="flex flex-wrap gap-2">
            <span className="text-[10px] font-black uppercase text-primary-600 tracking-wider bg-primary-50 px-3 py-1.5 rounded-xl">{item.subject}</span>
            <span className="text-[10px] font-bold bg-slate-100 text-slate-600 px-3 py-1.5 rounded-xl">{item.grade}</span>
            {item.year && <span className="text-[10px] font-bold bg-indigo-50 text-indigo-600 px-3 py-1.5 rounded-xl">{item.year}</span>}
            {item.isOwn && <span className="text-[9px] font-black bg-green-50 text-green-600 px-3 py-1.5 rounded-xl uppercase tracking-wider">Meu material</span>}
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-slate-50 p-4 rounded-2xl text-center">
              <div className="flex items-center justify-center gap-2 text-lg font-black text-slate-800">
                <Download size={16} className="text-slate-400" /> {item.downloads}
              </div>
              <div className="text-[10px] font-black uppercase text-slate-400 tracking-widest mt-1">Downloads</div>
            </div>
            <div className="bg-slate-50 p-4 rounded-2xl text-center">
              <div className="flex items-center justify-center gap-2 text-lg font-black text-yellow-500">
                <Star size={16} fill="currentColor" /> {item.rating > 0 ? item.rating : '—'}
              </div>
              <div className="text-[10px] font-black uppercase text-slate-400 tracking-widest mt-1">Avaliação</div>
            </div>
          </div>

          {/* Description */}
          {item.description && (
            <div className="bg-slate-50 rounded-2xl p-5">
              <div className="text-[10px] font-black uppercase text-slate-400 tracking-widest mb-2">Descrição</div>
              <p className="text-sm text-slate-700 font-medium leading-relaxed">{item.description}</p>
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-3 pt-2">
            <Button variant="outline" onClick={onClose} className="flex-1 rounded-xl py-3">Fechar</Button>
            {item.url ? (
              <Button variant="primary" onClick={() => window.open(item.url, '_blank')} className="flex-1 rounded-xl py-3 gap-2">
                <ExternalLink size={15} /> Abrir Link
              </Button>
            ) : onEdit ? (
              <Button variant="primary" onClick={onEdit} className="flex-1 rounded-xl py-3 gap-2">
                <Edit2 size={15} /> Editar
              </Button>
            ) : (
              <Button variant="secondary" onClick={() => { toast.success(`"${item.title}" adicionado ao plano de aula!`); onClose(); }} className="flex-1 rounded-xl py-3 gap-2">
                <CheckSquare size={15} /> Usar nas Aulas
              </Button>
            )}
          </div>
        </div>
      </motion.div>
    </div>
  );
};

// ─── Library Item Edit Modal ──────────────────────────────────────────────────
const EditModal: React.FC<{
  item: LibraryItem;
  teacherClasses: any[];
  onClose: () => void;
  onSaved: (updated: LibraryItem) => void;
}> = ({ item, teacherClasses, onClose, onSaved }) => {
  const [title, setTitle] = useState(item.title);
  const [subject, setSubject] = useState(item.subject);
  const [grade, setGrade] = useState(item.grade);
  const [year, setYear] = useState(item.year || String(CURRENT_YEAR));
  const [type, setType] = useState(item.type);
  const [description, setDescription] = useState(item.description || '');
  const [url, setUrl] = useState(item.url || '');
  const [classId, setClassId] = useState(item.classId || '');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title || !subject || !grade) { toast.error('Preencha os campos obrigatórios.'); return; }
    const updated: LibraryItem = { ...item, title, subject, grade, year, type, description, url, classId: classId || undefined };
    onSaved(updated);
    toast.success(`"${title}" atualizado!`);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
      <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
        className="bg-white rounded-[2rem] shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b border-slate-100 flex justify-between items-center sticky top-0 bg-white rounded-t-[2rem] z-10">
          <h2 className="text-xl font-black text-slate-800">Editar Material</h2>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-xl transition-colors"><X size={20} /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-xs font-black uppercase text-slate-400 tracking-widest mb-2">Título *</label>
            <input value={title} onChange={e => setTitle(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-bold outline-none focus:ring-2 focus:ring-indigo-200" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-black uppercase text-slate-400 tracking-widest mb-2">Tipo</label>
              <select value={type} onChange={e => setType(e.target.value as any)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-sm font-bold outline-none appearance-none">
                <option value="text">📄 Texto</option>
                <option value="video">🎥 Vídeo</option>
                <option value="quiz">📝 Quiz</option>
                <option value="audio">🎵 Áudio</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-black uppercase text-slate-400 tracking-widest mb-2">Disciplina *</label>
              <select value={subject} onChange={e => setSubject(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-sm font-bold outline-none appearance-none">
                <option value="">—</option>
                {SUBJECTS.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-black uppercase text-slate-400 tracking-widest mb-2">Série *</label>
              <select value={grade} onChange={e => setGrade(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-sm font-bold outline-none appearance-none">
                <option value="">—</option>
                {GRADES.map(g => <option key={g} value={g}>{g}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-black uppercase text-slate-400 tracking-widest mb-2">Ano Letivo</label>
              <select value={year} onChange={e => setYear(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-sm font-bold outline-none appearance-none">
                {YEARS.map(y => <option key={y} value={y}>{y}</option>)}
              </select>
            </div>
          </div>

          {teacherClasses.length > 0 && (
            <div>
              <label className="block text-xs font-black uppercase text-slate-400 tracking-widest mb-2 flex items-center gap-1"><GraduationCap size={11}/> Turma</label>
              <select value={classId} onChange={e => setClassId(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-sm font-bold outline-none appearance-none">
                <option value="">— Todas as turmas —</option>
                {teacherClasses.map(c => <option key={c.id} value={c.id}>{c.name} ({c.grade})</option>)}
              </select>
            </div>
          )}

          <div>
            <label className="block text-xs font-black uppercase text-slate-400 tracking-widest mb-2">Link (opcional)</label>
            <input type="url" value={url} onChange={e => setUrl(e.target.value)}
              placeholder="https://..."
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-bold outline-none focus:ring-2 focus:ring-indigo-200" />
          </div>

          <div>
            <label className="block text-xs font-black uppercase text-slate-400 tracking-widest mb-2">Descrição</label>
            <textarea value={description} onChange={e => setDescription(e.target.value)} rows={3}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-bold outline-none resize-none focus:ring-2 focus:ring-indigo-200"
              placeholder="Sobre o que é este material..." />
          </div>

          <div className="flex gap-3 pt-2">
            <Button type="button" variant="outline" onClick={onClose} className="flex-1 rounded-xl py-3">Cancelar</Button>
            <Button type="submit" variant="primary" className="flex-1 rounded-xl py-3 gap-2 shadow shadow-indigo-200">
              <Save size={14} /> Salvar Alterações
            </Button>
          </div>
        </form>
      </motion.div>
    </div>
  );
};

// ─── Upload Modal ─────────────────────────────────────────────────────────────
const UploadModal: React.FC<{
  onClose: () => void;
  onUpload: (item: LibraryItem) => void;
  teacherClasses: any[];
}> = ({ onClose, onUpload, teacherClasses }) => {
  const [title, setTitle] = useState('');
  const [subject, setSubject] = useState('');
  const [grade, setGrade] = useState('');
  const [year, setYear] = useState(String(CURRENT_YEAR));
  const [classId, setClassId] = useState('');
  const [type, setType] = useState<LibraryItem['type']>('text');
  const [description, setDescription] = useState('');
  const [url, setUrl] = useState('');
  const [dragOver, setDragOver] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title || !subject || !grade) { toast.error('Preencha os campos obrigatórios.'); return; }
    const newItem: LibraryItem = {
      id: crypto.randomUUID(), title, subject, grade, year, classId: classId || undefined,
      type, description, url, downloads: 0, rating: 0, isOwn: true,
      addedAt: new Date().toISOString(),
    };
    onUpload(newItem);
    toast.success(`"${title}" adicionado à biblioteca!`);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white rounded-[2rem] shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto animate-in zoom-in-95 duration-200">
        <div className="p-6 border-b border-slate-100 flex justify-between items-center sticky top-0 bg-white rounded-t-[2rem] z-10">
          <h2 className="text-xl font-black text-slate-800">Upload de Material</h2>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-xl transition-colors"><X size={20} /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          <div
            onDragOver={e => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={e => { e.preventDefault(); setDragOver(false); const f = e.dataTransfer.files[0]; if (f) setFileName(f.name); }}
            onClick={() => fileRef.current?.click()}
            className={cn('border-2 border-dashed rounded-2xl p-8 text-center cursor-pointer transition-all',
              dragOver ? 'border-indigo-400 bg-indigo-50' : 'border-slate-200 hover:border-slate-300 bg-slate-50/50'
            )}>
            <input ref={fileRef} type="file" className="hidden" onChange={e => setFileName(e.target.files?.[0]?.name || '')} />
            <Upload size={32} className={cn('mx-auto mb-2', dragOver ? 'text-indigo-500' : 'text-slate-300')} />
            {fileName ? <p className="font-bold text-sm text-slate-700">{fileName}</p> : (
              <><p className="font-bold text-slate-500 text-sm">Arraste um arquivo ou clique para selecionar</p>
              <p className="text-xs text-slate-400 mt-1">PDF, DOCX, MP4, MP3, PNG, JPG</p></>
            )}
          </div>

          <div className="text-center text-slate-300 text-xs font-bold uppercase tracking-widest">— ou adicione um link —</div>
          <input type="url" value={url} onChange={e => setUrl(e.target.value)}
            placeholder="https://youtube.com/..."
            className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-bold outline-none focus:ring-2 focus:ring-indigo-200" />

          <div>
            <label className="block text-xs font-black uppercase text-slate-400 tracking-widest mb-2">Título <span className="text-red-400">*</span></label>
            <input value={title} onChange={e => setTitle(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-bold outline-none focus:ring-2 focus:ring-indigo-200"
              placeholder="Nome do material" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-black uppercase text-slate-400 tracking-widest mb-2">Tipo</label>
              <select value={type} onChange={e => setType(e.target.value as any)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-sm font-bold outline-none appearance-none">
                <option value="text">📄 Texto</option>
                <option value="video">🎥 Vídeo</option>
                <option value="quiz">📝 Quiz</option>
                <option value="audio">🎵 Áudio</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-black uppercase text-slate-400 tracking-widest mb-2">Disciplina <span className="text-red-400">*</span></label>
              <select value={subject} onChange={e => setSubject(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-sm font-bold outline-none appearance-none">
                <option value="">—</option>
                {SUBJECTS.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-black uppercase text-slate-400 tracking-widest mb-2">Série <span className="text-red-400">*</span></label>
              <select value={grade} onChange={e => setGrade(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-sm font-bold outline-none appearance-none">
                <option value="">—</option>
                {GRADES.map(g => <option key={g} value={g}>{g}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-black uppercase text-slate-400 tracking-widest mb-2">Ano Letivo</label>
              <select value={year} onChange={e => setYear(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-sm font-bold outline-none appearance-none">
                {YEARS.map(y => <option key={y} value={y}>{y}</option>)}
              </select>
            </div>
          </div>

          {teacherClasses.length > 0 && (
            <div>
              <label className="block text-xs font-black uppercase text-slate-400 tracking-widest mb-2 flex items-center gap-1"><GraduationCap size={11}/> Turma (opcional)</label>
              <select value={classId} onChange={e => setClassId(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-sm font-bold outline-none appearance-none">
                <option value="">— Todas as turmas —</option>
                {teacherClasses.map(c => <option key={c.id} value={c.id}>{c.name} ({c.grade})</option>)}
              </select>
            </div>
          )}

          <div>
            <label className="block text-xs font-black uppercase text-slate-400 tracking-widest mb-2">Descrição (opcional)</label>
            <textarea value={description} onChange={e => setDescription(e.target.value)} rows={2}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-bold outline-none resize-none focus:ring-2 focus:ring-indigo-200"
              placeholder="O que este material aborda..." />
          </div>

          <div className="flex gap-3 pt-2">
            <Button type="button" variant="outline" onClick={onClose} className="flex-1 rounded-xl py-3">Cancelar</Button>
            <Button type="submit" variant="primary" className="flex-1 rounded-xl py-3 shadow shadow-indigo-200">Adicionar à Biblioteca</Button>
          </div>
        </form>
      </div>
    </div>
  );
};

export const Library: React.FC = () => {
  const { user } = useAuthStore();
  const [searchTerm, setSearchTerm] = useState('');
  const [filterSubject, setFilterSubject] = useState('Todas');
  const [filterGrade, setFilterGrade] = useState('Todas');
  const [filterYear, setFilterYear] = useState('Todos');
  const [filterClass, setFilterClass] = useState('Todas');
  const [filterType, setFilterType] = useState('Todos');
  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const [previewItem, setPreviewItem] = useState<LibraryItem | null>(null);
  const [editItem, setEditItem] = useState<LibraryItem | null>(null);
  const allLibraryItemsData = useSupabaseQuery<any>('library_items');
  const myItems = (allLibraryItemsData || []).filter((item: any) => item.teacherId === user?.id);


  const teacherUsersData = useSupabaseQuery<any>('users');
  const teacherUser = teacherUsersData?.find((u: any) => u.id === user?.id);
  const teacherClassIds: string[] = teacherUser?.classIds || [];
  
  const allClassesData = useSupabaseQuery<any>('classes');
  const teacherClasses = (allClassesData || []).filter((c: any) => teacherClassIds.includes(c.id));

  const allItems = myItems; // We merge base items during seeding now for simplicity, or we can keep BASE_ITEMS in memory 
  // Let's actually merge them in memory for display but only save custom ones to DB? 
  // Better to have everything in DB so students can see. 
  // I will just use myItems and suggest the user clicks a "Seed" button if empty.

  const TYPES = ['Todos', 'Texto', 'Vídeo', 'Quiz', 'Áudio'];
  const GRADES_FILTER = ['Todas', ...GRADES];
  const YEARS_FILTER = ['Todos', ...YEARS];
  const typeMap: Record<string, string> = { text: 'Texto', video: 'Vídeo', quiz: 'Quiz', audio: 'Áudio' };

  const filtered = allItems.filter(item => {
    const matchSub = filterSubject === 'Todas' || item.subject === filterSubject;
    const matchGrade = filterGrade === 'Todas' || item.grade === filterGrade;
    const matchYear = filterYear === 'Todos' || item.year === filterYear;
    const matchClass = filterClass === 'Todas' || item.classId === filterClass;
    const matchType = filterType === 'Todos' || typeMap[item.type] === filterType;
    const matchSearch = item.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.subject.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (item.description || '').toLowerCase().includes(searchTerm.toLowerCase());
    return matchSub && matchGrade && matchYear && matchClass && matchType && matchSearch;
  });

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from('library_items').delete().eq('id', id);
    if (error) { toast.error('Erro ao remover material.'); return; }
    toast.success('Material removido da biblioteca.');
  };

  const handleUpload = async (item: LibraryItem) => {
    const newItem = {
      ...item,
      teacherId: user?.id || '',
      isOwn: true // Ensure everything the teacher adds/seeds is marked as their own for this session
    };
    
    const { error: insertError } = await supabase.from('library_items').insert(newItem);
    if (insertError) { toast.error('Erro ao adicionar material.'); return; }

    // Send notifications to students
    const studentIds: string[] = [];
    
    // Fetch fresh class data to ensure we have all student IDs
    const { data: freshClasses, error } = await supabase.from('classes').select('*');
    if (!error && freshClasses) {
      if (item.classId) {
        const cls = freshClasses.find(c => c.id === item.classId);
        if (cls?.studentIds) studentIds.push(...cls.studentIds);
      } else if (item.grade) {
        // Notify all students in this grade across all teacher's classes
        const tClasses = freshClasses.filter((c: any) => teacherClasses.some((tc: any) => tc.id === c.id));
        for (const c of tClasses) {
          if (c.grade === item.grade && c.studentIds) {
            studentIds.push(...c.studentIds);
          }
        }
      }
    }

    if (studentIds.length > 0) {
      const uniqueStudentIds = Array.from(new Set(studentIds));

      // Notify Students (and Guardians automatically)
      await createBulkNotifications(
        uniqueStudentIds,
        'student',
        'Novo Material na Biblioteca! 📚',
        `O professor ${user?.name} enviou um novo material: "${item.title}".`,
        'info',
        'normal',
        '/student/library'
      );
    }
    toast.success('Material adicionado e alunos notificados!');
  };

  const handleSaveEdit = async (updated: LibraryItem) => {
    const { error } = await supabase.from('library_items').update(updated).eq('id', updated.id);
    if (error) { toast.error('Erro ao editar material.'); return; }
  };

  const handleShare = (item: LibraryItem) => {
    const shareUrl = item.url || `${window.location.origin}/library/${item.id}`;
    navigator.clipboard.writeText(shareUrl).then(() => toast.success('Link copiado!'));
  };

  const hasActiveFilters = filterSubject !== 'Todas' || filterGrade !== 'Todas' || filterYear !== 'Todos' || filterClass !== 'Todas' || filterType !== 'Todos';

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <header className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-primary-500">
            <LibraryIcon size={20} className="stroke-[3]" />
            <span className="text-xs font-black uppercase tracking-[0.2em]">Recursos Educacionais</span>
          </div>
          <h1 className="text-4xl font-black text-slate-800 tracking-tight leading-none">Biblioteca de <span className="text-primary-600">Conteúdo</span></h1>
          <p className="text-slate-500 font-medium">{allItems.length} recursos disponíveis · clique para visualizar ou editar</p>
        </div>
        <div className="flex gap-3 mt-4 md:mt-0">
          <Button onClick={() => setIsUploadOpen(true)} variant="primary" className="rounded-2xl gap-2 font-black px-8 shadow-xl shadow-primary-500/20">
            <Upload size={18} /> Upload Material
          </Button>
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
        {/* Filters Sidebar */}
        <div className="lg:col-span-1">
          <Card className="p-6 space-y-6 bg-slate-900 text-white border-none shadow-2xl sticky top-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs font-black uppercase tracking-widest text-slate-500">
                <Filter size={14} /> Filtros
              </div>
              {hasActiveFilters && (
                <button onClick={() => { setFilterSubject('Todas'); setFilterGrade('Todas'); setFilterYear('Todos'); setFilterClass('Todas'); setFilterType('Todos'); }}
                  className="text-[10px] font-bold text-slate-500 hover:text-white transition-colors">
                  Limpar
                </button>
              )}
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase text-slate-500">Disciplina</label>
              <select value={filterSubject} onChange={e => setFilterSubject(e.target.value)}
                className="w-full bg-slate-700 border border-slate-600 rounded-xl px-4 py-2.5 text-sm font-bold text-white outline-none focus:border-primary-400 appearance-none">
                <option value="Todas" className="bg-slate-700 text-white">Todas</option>
                {SUBJECTS.map(s => <option key={s} value={s} className="bg-slate-700 text-white">{s}</option>)}
              </select>
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase text-slate-500">Série</label>
              <select value={filterGrade} onChange={e => setFilterGrade(e.target.value)}
                className="w-full bg-slate-700 border border-slate-600 rounded-xl px-4 py-2.5 text-sm font-bold text-white outline-none focus:border-primary-400 appearance-none">
                {GRADES_FILTER.map(g => <option key={g} value={g} className="bg-slate-700 text-white">{g}</option>)}
              </select>
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase text-slate-500">Ano Letivo</label>
              <div className="space-y-1.5">
                {YEARS_FILTER.map(y => (
                  <button key={y} onClick={() => setFilterYear(y)}
                    className={cn('w-full text-left p-2.5 rounded-xl text-[11px] font-bold transition-all flex items-center gap-2',
                      filterYear === y ? 'bg-primary-500 text-white' : 'hover:bg-white/10 text-slate-400')}>
                    <Clock size={12} /> {y}
                  </button>
                ))}
              </div>
            </div>

            {teacherClasses.length > 0 && (
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase text-slate-500 flex items-center gap-1"><GraduationCap size={11}/> Turma</label>
                <div className="space-y-1.5">
                  <button onClick={() => setFilterClass('Todas')}
                    className={cn('w-full text-left p-2.5 rounded-xl text-[11px] font-bold transition-all',
                      filterClass === 'Todas' ? 'bg-primary-500 text-white' : 'hover:bg-white/10 text-slate-400')}>
                    Todas as Turmas
                  </button>
                  {teacherClasses.map(c => (
                    <button key={c.id} onClick={() => setFilterClass(c.id)}
                      className={cn('w-full text-left p-2.5 rounded-xl text-[11px] font-bold transition-all',
                        filterClass === c.id ? 'bg-primary-500 text-white' : 'hover:bg-white/10 text-slate-400')}>
                      {c.name} · {c.grade}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase text-slate-500">Tipo de Material</label>
              <div className="space-y-1.5">
                {TYPES.map(t => (
                  <button key={t} onClick={() => setFilterType(t)}
                    className={cn('w-full text-left p-2.5 rounded-xl text-[11px] font-bold transition-all',
                      filterType === t ? 'bg-primary-500 text-white' : 'hover:bg-white/10 text-slate-400')}>
                    {t === 'Texto' ? '📄' : t === 'Vídeo' ? '🎥' : t === 'Quiz' ? '📝' : t === 'Áudio' ? '🎵' : '🔍'} {t}
                  </button>
                ))}
              </div>
            </div>
          </Card>
        </div>

        {/* Content Grid */}
        <div className="lg:col-span-3 space-y-6">
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <input type="text" placeholder="Pesquisar por tema, disciplina ou descrição..."
              value={searchTerm} onChange={e => setSearchTerm(e.target.value)}
              className="w-full pl-12 pr-6 py-4 bg-white border border-slate-200 rounded-[1.5rem] text-sm font-bold focus:outline-none focus:border-primary-400 shadow-sm transition-all" />
          </div>

          <div className="flex items-center justify-between">
            <div className="text-sm font-bold text-slate-400">{filtered.length} resultado{filtered.length !== 1 ? 's' : ''}</div>
            {hasActiveFilters && (
              <div className="flex gap-2 flex-wrap">
                {filterSubject !== 'Todas' && <span className="text-[10px] bg-indigo-50 text-indigo-600 font-black px-2 py-1 rounded-lg">{filterSubject}</span>}
                {filterGrade !== 'Todas' && <span className="text-[10px] bg-indigo-50 text-indigo-600 font-black px-2 py-1 rounded-lg">{filterGrade}</span>}
                {filterYear !== 'Todos' && <span className="text-[10px] bg-indigo-50 text-indigo-600 font-black px-2 py-1 rounded-lg">{filterYear}</span>}
                {filterType !== 'Todos' && <span className="text-[10px] bg-indigo-50 text-indigo-600 font-black px-2 py-1 rounded-lg">{filterType}</span>}
              </div>
            )}
          </div>

          {filtered.length === 0 ? (
            <div className="text-center py-16 border-2 border-dashed border-slate-100 rounded-[2rem]">
              <Layers size={40} className="mx-auto mb-3 text-slate-200" />
              <p className="font-bold text-slate-400">Nenhum material encontrado.</p>
              <p className="text-sm text-slate-300 mt-1">Tente ajustar os filtros ou faça upload de um material.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {filtered.map(item => {
                const config = TYPE_CONFIG[item.type as keyof typeof TYPE_CONFIG];
                const Icon = config.icon;
                return (
                  <Card key={item.id} className="p-0 overflow-hidden border-slate-100 group hover:border-primary-100 hover:shadow-xl transition-all duration-300 cursor-pointer">
                    <div className="p-6 border-b border-slate-50 flex items-start justify-between gap-3"
                      onClick={() => setPreviewItem(item)}>
                      <div className="flex items-start gap-4">
                        <div className={cn('w-12 h-12 rounded-2xl flex items-center justify-center text-white shadow-lg flex-shrink-0 group-hover:scale-110 transition-transform', config.color)}>
                          <Icon size={22} />
                        </div>
                        <div className="min-w-0">
                          <h3 className="text-base font-black text-slate-800 leading-tight group-hover:text-primary-600 transition-colors truncate">{item.title}</h3>
                          <div className="flex items-center gap-2 mt-1 flex-wrap">
                            <span className="text-[10px] font-black uppercase text-primary-600 tracking-wider">{item.subject}</span>
                            <span className="text-[10px] bg-slate-100 text-slate-500 font-bold px-1.5 py-0.5 rounded-md">{item.grade}</span>
                            {item.year && <span className="text-[10px] bg-indigo-50 text-indigo-500 font-bold px-1.5 py-0.5 rounded-md">{item.year}</span>}
                            {item.isOwn && <span className="text-[9px] bg-green-50 text-green-600 font-black px-1.5 py-0.5 rounded-md uppercase tracking-wider">Meu</span>}
                          </div>
                          {item.description && <p className="text-xs text-slate-400 mt-1.5 line-clamp-2">{item.description}</p>}
                        </div>
                      </div>
                    </div>
                    <div className="p-4 flex items-center justify-between bg-slate-50/50">
                      <div className="flex items-center gap-5">
                        <div className="flex items-center gap-1.5 text-slate-400">
                          <Download size={14} /><span className="text-xs font-black">{item.downloads}</span>
                        </div>
                        {item.rating > 0 && (
                          <div className="flex items-center gap-1.5 text-yellow-500">
                            <Star size={14} fill="currentColor" /><span className="text-xs font-black">{item.rating}</span>
                          </div>
                        )}
                      </div>
                      <div className="flex gap-2" onClick={e => e.stopPropagation()}>
                        <button onClick={() => handleShare(item)} className="p-2 rounded-xl text-slate-400 hover:text-indigo-500 hover:bg-indigo-50 transition-colors" title="Compartilhar link">
                          <Share2 size={16} />
                        </button>
                          <>
                            <button onClick={() => setEditItem(item)} className="p-2 rounded-xl text-slate-400 hover:text-blue-500 hover:bg-blue-50 transition-colors" title="Editar">
                              <Edit2 size={16} />
                            </button>
                            <button onClick={() => { if(confirm('Excluir este item?')) handleDelete(item.id); }} className="p-2 rounded-xl text-slate-300 hover:text-red-400 hover:bg-red-50 transition-colors" title="Remover">
                              <Trash2 size={16} />
                            </button>
                          </>
                        <Button size="sm" variant="secondary" onClick={() => setPreviewItem(item)} className="px-4 rounded-xl text-xs font-black gap-1">
                          <Eye size={13} /> Ver
                        </Button>
                      </div>
                    </div>
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Modals */}
      <AnimatePresence>
        {isUploadOpen && (
          <UploadModal onClose={() => setIsUploadOpen(false)} onUpload={handleUpload} teacherClasses={teacherClasses} />
        )}
        {previewItem && (
          <PreviewModal
            item={previewItem}
            onClose={() => setPreviewItem(null)}
            onEdit={() => { setEditItem(previewItem); setPreviewItem(null); }}
          />
        )}
        {editItem && (
          <EditModal
            item={editItem}
            teacherClasses={teacherClasses}
            onClose={() => setEditItem(null)}
            onSaved={handleSaveEdit}
          />
        )}
      </AnimatePresence>
    </div>
  );
};
