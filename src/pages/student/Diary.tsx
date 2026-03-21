import React, { useEffect, useState } from 'react';
import { useAuthStore } from '../../store/auth.store';
import { supabase } from '../../lib/supabase';
import {
  BookOpen, Plus, Search,
  Sparkles, Trash2, Lock, Hash, Star as StarIcon,
  X, BrainCircuit, CheckCircle2
} from 'lucide-react';
import { Card } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { cn } from '../../lib/utils';
import { toast } from 'sonner';
import { incrementMissionProgress } from '../../lib/missionUtils';

// Redefining DiaryEntry as we removed it from Dexie types
export interface DiaryEntry {
  id: string;
  studentId: string;
  title: string;
  content: string;
  mood: string;
  tags: string[];
  isAIGenerated: boolean;
  createdAt: string;
  updatedAt: string;
}


export const Diary: React.FC = () => {
  const user = useAuthStore(state => state.user);
  const [entries, setEntries] = useState<DiaryEntry[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [formTitle, setFormTitle] = useState('');
  const [formContent, setFormContent] = useState('');
  const [formMood, setFormMood] = useState('😊');
  const [formTags, setFormTags] = useState('');
  const [saving, setSaving] = useState(false);

  const moods = ['😊', '🤩', '😎', '🤔', '😅', '💪', '🔭', '🎉', '😴', '🌟'];

  useEffect(() => {
    if (!user) return;
    loadEntries();
  }, [user]);

  const loadEntries = async () => {
    if (!user) return;
    const { data: rawObj } = await supabase.from('diary_entries').select('*').eq('studentId', user.id);
    const raw = (rawObj || []) as DiaryEntry[];
    // Sort by newest first
    raw.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    setEntries(raw);
    setLoading(false);
  };

  const handleNewEntry = async () => {
    if (!user || !formTitle.trim() || !formContent.trim()) {
      toast.error('Preencha o título e o conteúdo!');
      return;
    }
    setSaving(true);
    try {
      const entry: DiaryEntry = {
        id: crypto.randomUUID(),
        studentId: user.id,
        title: formTitle.trim(),
        content: formContent.trim(),
        mood: formMood,
        tags: formTags.split(',').map(t => t.trim()).filter(Boolean),
        isAIGenerated: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      const { error } = await supabase.from('diary_entries').insert(entry);
      if (error) throw error;
      setEntries(prev => [entry, ...prev]);
      setShowModal(false);
      setFormTitle('');
      setFormContent('');
      setFormMood('😊');
      setFormTags('');
      toast.success('Anotação salva! 📝');
      
      // Update Mission Progress
      await incrementMissionProgress(user.id, 'diary_entry', 1);
    } catch (error) {

      toast.error('Erro ao salvar anotação.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    await supabase.from('diary_entries').delete().eq('id', id);
    setEntries(prev => prev.filter(e => e.id !== id));
    toast.success('Anotação excluída.');
  };

  const filtered = entries.filter(e =>
    !searchTerm ||
    e.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
    e.content.toLowerCase().includes(searchTerm.toLowerCase()) ||
    e.tags.some((t: string) => t.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const allTags = [...new Set(entries.flatMap(e => e.tags))];

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-12 h-12 border-4 border-primary-100 border-t-primary-500 rounded-full animate-spin" />
      </div>
    );
  }

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
            Meu Diário de <span className="text-primary-600">Estudos</span>
          </h1>
          <p className="text-slate-500 font-medium">Anote suas descobertas, dúvidas e conquistas do dia a dia.</p>
        </div>
        <Button
          variant="primary"
          className="rounded-2xl gap-2 font-black px-8 shadow-xl shadow-primary-500/20 h-14"
          onClick={() => setShowModal(true)}
        >
          <Plus size={20} /> Nova Anotação
        </Button>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">

        {/* Sidebar */}
        <div className="lg:col-span-1 space-y-6">
          <Card className="p-8 space-y-8 bg-slate-900 text-white border-none shadow-2xl relative overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-primary-500/10 rounded-full blur-3xl -mr-10 -mt-10" />
            <div className="space-y-6 relative z-10">
              <div className="flex justify-between items-center">
                <h3 className="text-xs font-black uppercase text-slate-500 tracking-widest">Estatísticas</h3>
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
                <div className="flex justify-between items-center">
                  <span className="text-sm font-bold text-slate-400">Geradas por IA</span>
                  <span className="text-xl font-black">{entries.filter(e => e.isAIGenerated).length}</span>
                </div>
              </div>
            </div>

            <div className="pt-8 border-t border-white/10 space-y-4 relative z-10">
              <div className="p-4 bg-white/5 rounded-2xl border border-white/5 space-y-2">
                <div className="flex items-center gap-2 text-[10px] font-black uppercase text-primary-400">
                  <Lock size={12} /> Espaço Privado
                </div>
                <p className="text-[11px] text-slate-400 leading-relaxed font-medium">
                  Suas notas são visíveis apenas para você e seus orientadores (se permitido).
                </p>
              </div>
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
                placeholder="Pesquisar nas minhas anotações..."
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
                    ? 'Comece anotando o que você aprendeu hoje!'
                    : 'Tente outro termo de busca.'}
                </p>
                {entries.length === 0 && (
                  <Button variant="primary" className="rounded-2xl gap-2 font-black" onClick={() => setShowModal(true)}>
                    <Plus size={18} /> Criar primeira anotação
                  </Button>
                )}
              </div>
            ) : (
              filtered.map(entry => (
                <Card key={entry.id} className="p-0 overflow-hidden border-slate-100 group hover:border-primary-100 hover:shadow-floating transition-all duration-500">
                  {entry.isAIGenerated && (
                    <div className="bg-gradient-to-r from-special-50 to-primary-50 border-b border-special-100/50 px-8 py-3 flex items-center gap-2">
                      <BrainCircuit size={14} className="text-special-500" />
                      <span className="text-[10px] font-black uppercase tracking-widest text-special-600">Gerado pelo Tutor IA</span>
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
                      <div className="flex items-center gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="p-2 text-slate-300 hover:text-red-500"
                          onClick={() => handleDelete(entry.id)}
                        >
                          <Trash2 size={20} />
                        </Button>
                      </div>
                    </div>

                    <p className="text-slate-600 font-medium leading-relaxed text-lg">{entry.content}</p>

                    {entry.tags.length > 0 && (
                      <div className="flex flex-wrap gap-2 pt-2">
                        {entry.tags.map((tag: string) => (
                          <Badge key={tag} variant="primary" className="bg-primary-50/50 border-primary-100/50 flex items-center gap-1.5">
                            <Hash size={10} /> {tag}
                          </Badge>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="px-8 py-5 bg-slate-50/50 border-t border-slate-50 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <button className="flex items-center gap-2 text-slate-400 hover:text-warning-500 transition-colors text-xs font-black uppercase tracking-widest">
                        <StarIcon size={16} /> Favoritar
                      </button>
                    </div>
                  </div>
                </Card>
              ))
            )}
          </div>
        </div>
      </div>

      {/* New Entry Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md">
          <div className="bg-white rounded-[3rem] shadow-2xl w-full max-w-xl animate-in zoom-in-95 duration-300 overflow-hidden">
            <div className="bg-gradient-to-br from-primary-600 to-special-700 p-8 text-white flex items-center justify-between">
              <div>
                <div className="text-[10px] font-black uppercase tracking-widest opacity-70 mb-1">Nova Anotação</div>
                <h2 className="text-2xl font-black">O que você aprendeu?</h2>
              </div>
              <button onClick={() => setShowModal(false)} className="p-3 bg-white/10 hover:bg-white/20 rounded-2xl transition-all">
                <X size={20} />
              </button>
            </div>

            <div className="p-8 space-y-6">
              {/* Mood */}
              <div>
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-3 block">Como você está se sentindo?</label>
                <div className="flex flex-wrap gap-2">
                  {moods.map(m => (
                    <button
                      key={m}
                      onClick={() => setFormMood(m)}
                      className={cn(
                        'text-2xl w-12 h-12 rounded-2xl border-2 transition-all',
                        formMood === m ? 'border-primary-500 bg-primary-50 scale-110' : 'border-slate-100 hover:border-primary-200'
                      )}
                    >
                      {m}
                    </button>
                  ))}
                </div>
              </div>

              {/* Title */}
              <div>
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2 block">Título</label>
                <input
                  type="text"
                  value={formTitle}
                  onChange={e => setFormTitle(e.target.value)}
                  placeholder="Ex: Aprendi sobre frações hoje!"
                  className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl font-bold text-slate-800 focus:outline-none focus:border-primary-400"
                />
              </div>

              {/* Content */}
              <div>
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2 block">Anotação</label>
                <textarea
                  rows={4}
                  value={formContent}
                  onChange={e => setFormContent(e.target.value)}
                  placeholder="Escreva o que você aprendeu, suas dúvidas ou conquistas..."
                  className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl font-medium text-slate-700 focus:outline-none focus:border-primary-400 resize-none"
                />
              </div>

              {/* Tags */}
              <div>
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2 block">Tags (separadas por vírgula)</label>
                <input
                  type="text"
                  value={formTags}
                  onChange={e => setFormTags(e.target.value)}
                  placeholder="Ex: Matemática, Conquista, Dúvida"
                  className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl font-medium text-slate-700 focus:outline-none focus:border-primary-400"
                />
              </div>

              <div className="flex gap-3">
                <Button variant="secondary" className="flex-1 rounded-2xl h-14" onClick={() => setShowModal(false)}>
                  Cancelar
                </Button>
                <Button
                  variant="primary"
                  className="flex-[2] rounded-2xl h-14 gap-2 font-black"
                  onClick={handleNewEntry}
                  disabled={saving || !formTitle.trim() || !formContent.trim()}
                >
                  {saving ? <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <CheckCircle2 size={20} />}
                  Salvar Anotação
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
