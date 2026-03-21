import React, { useState, useEffect } from 'react';
import { 
  Search, 
  X, 
  ArrowRight, 
  Sparkles, 
  History, 
  Star,
  BookOpen,
  Users,
  Target
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';

export const SearchOverlay: React.FC<{ isOpen: boolean; onClose: () => void }> = ({ isOpen, onClose }) => {
  const [query, setQuery] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [onClose]);

  const results = [
    { title: 'Trilha de Matemática', category: 'Conteúdo', icon: BookOpen, path: '/student/paths' },
    { title: 'Minhas Missões', category: 'Gamificação', icon: Target, path: '/student/missions' },
    { title: 'Tutor IA', category: 'Assistente', icon: Sparkles, path: '/student/tutor' },
    { title: 'Configurações', category: 'Ajustes', icon: Users, path: '/student/profile' },
  ].filter(r => r.title.toLowerCase().includes(query.toLowerCase()));

  const handleNavigate = (path: string) => {
    navigate(path);
    onClose();
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[200] flex items-start justify-center p-4 md:p-20">
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-slate-900/60 backdrop-blur-xl"
          />
          
          <motion.div 
            initial={{ opacity: 0, y: -20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -20, scale: 0.95 }}
            className="w-full max-w-3xl bg-white rounded-[3rem] shadow-2xl relative z-10 overflow-hidden mt-10"
          >
            <div className="relative">
                <Search size={24} className="absolute left-10 top-1/2 -translate-y-1/2 text-slate-300" />
                <input 
                    autoFocus
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="O que você quer aprender hoje?"
                    className="w-full bg-white border-b border-slate-100 pl-20 pr-32 py-10 text-2xl font-black text-slate-800 outline-none placeholder:text-slate-200"
                />
                <div className="absolute right-10 top-1/2 -translate-y-1/2 flex items-center gap-4">
                    <div className="hidden sm:flex items-center gap-1.5 px-2 py-1 bg-slate-100 rounded-lg text-[10px] font-black text-slate-400">
                        ESC
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-slate-50 rounded-full transition-colors">
                        <X size={24} className="text-slate-400" />
                    </button>
                </div>
            </div>

            <div className="max-h-[60vh] overflow-y-auto p-10 space-y-10 custom-scrollbar text-slate-800">
                {query === '' ? (
                    <div className="space-y-8">
                        <section>
                            <h3 className="text-[10px] font-black uppercase text-slate-400 tracking-widest ml-1 mb-4 flex items-center gap-2">
                                <History size={14} /> Pesquisas Recentes
                            </h3>
                            <div className="flex flex-wrap gap-2">
                                {['Frações', 'Sistema Solar', 'Avatar', 'Ranking'].map(s => (
                                    <button 
                                        key={s}
                                        onClick={() => setQuery(s)}
                                        className="px-5 py-2.5 bg-slate-50 hover:bg-slate-100 rounded-xl text-sm font-bold text-slate-600 transition-all border border-slate-100"
                                    >
                                        {s}
                                    </button>
                                ))}
                            </div>
                        </section>
                        
                        <section>
                            <h3 className="text-[10px] font-black uppercase text-slate-400 tracking-widest ml-1 mb-4 flex items-center gap-2">
                                <Star size={14} /> Atalhos Populares
                            </h3>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                               <button onClick={() => handleNavigate('/student/paths')} className="flex items-center gap-4 p-5 rounded-[1.5rem] bg-primary-50 hover:bg-primary-100 transition-all group border-none">
                                  <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center text-primary-500 shadow-sm"><BookOpen size={24} /></div>
                                  <div className="text-left">
                                     <div className="text-sm font-black text-primary-700">Explorar Trilhas</div>
                                     <div className="text-[10px] font-bold text-primary-400">Onde a mágica acontece</div>
                                  </div>
                               </button>
                               <button onClick={() => handleNavigate('/student/tutor')} className="flex items-center gap-4 p-5 rounded-[1.5rem] bg-special-50 hover:bg-special-100 transition-all group border-none">
                                  <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center text-special-500 shadow-sm"><Sparkles size={24} /></div>
                                  <div className="text-left">
                                     <div className="text-sm font-black text-special-700">Tutor IA</div>
                                     <div className="text-[10px] font-bold text-special-400">Dúvida rápida?</div>
                                  </div>
                               </button>
                            </div>
                        </section>
                    </div>
                ) : (
                    <div className="space-y-4">
                        <h3 className="text-[10px] font-black uppercase text-slate-400 tracking-widest ml-1">Resultados para "{query}"</h3>
                        {results.length > 0 ? (
                            <div className="space-y-2">
                                {results.map((res, i) => (
                                    <button 
                                        key={i}
                                        onClick={() => handleNavigate(res.path)}
                                        className="w-full flex items-center justify-between p-5 hover:bg-slate-50 rounded-[1.5rem] transition-all group border-none bg-transparent"
                                    >
                                        <div className="flex items-center gap-5">
                                            <div className="w-14 h-14 bg-slate-50 group-hover:bg-white rounded-2xl flex items-center justify-center text-slate-400 group-hover:text-primary-500 transition-all">
                                                <res.icon size={28} />
                                            </div>
                                            <div className="text-left">
                                                <div className="text-lg font-black text-slate-800 group-hover:text-primary-600 transition-colors uppercase tracking-tight">{res.title}</div>
                                                <div className="text-xs font-bold text-slate-400">{res.category}</div>
                                            </div>
                                        </div>
                                        <ArrowRight size={24} className="text-slate-200 group-hover:text-primary-500 group-hover:translate-x-2 transition-all" />
                                    </button>
                                ))}
                            </div>
                        ) : (
                            <div className="p-10 text-center space-y-4">
                               <div className="inline-flex w-16 h-16 bg-slate-50 rounded-2xl items-center justify-center text-slate-300">
                                  <Search size={32} />
                               </div>
                               <p className="text-slate-400 font-bold">Nenhum resultado encontrado para sua busca.</p>
                            </div>
                        )}
                    </div>
                )}
            </div>
            
            <div className="bg-slate-50/50 p-6 px-10 border-t border-slate-50 flex items-center justify-between">
                <div className="flex items-center gap-6 text-slate-800">
                    <div className="flex items-center gap-2 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                        <span className="px-1.5 py-0.5 bg-white border border-slate-200 rounded shadow-sm text-slate-500">↑↓</span> Navegar
                    </div>
                    <div className="flex items-center gap-2 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                        <span className="px-1.5 py-0.5 bg-white border border-slate-200 rounded shadow-sm text-slate-500">↵</span> Selecionar
                    </div>
                </div>
                <div className="flex items-center gap-2 text-[10px] font-black text-primary-500 uppercase tracking-widest">
                     Powered by Impacto IA
                </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
