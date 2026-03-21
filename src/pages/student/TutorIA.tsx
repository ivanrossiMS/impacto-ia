import React, { useState, useRef, useEffect } from 'react';
import { 
  Bot, BookOpen, Repeat, 
  Clock, Flame, BrainCircuit,
  Volume2, Paperclip, ChevronRight, Settings2,
  Trophy, Lightbulb, Bookmark
} from 'lucide-react';
import { useAuthStore } from '../../store/auth.store';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '../../lib/supabase';
import { cn } from '../../lib/utils';
import { incrementMissionProgress } from '../../lib/missionUtils';
import { toast } from 'sonner';

interface Message {
  id: string;
  sender: 'ai' | 'user';
  text: string;
  timestamp: Date;
  level?: 'basic' | 'advanced' | 'genius';
}

export const TutorIA: React.FC = () => {
  const { user } = useAuthStore();
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      sender: 'ai',
      text: `Olá, ${user?.name || 'Estudante'}! Sou seu Tutor IA avançado. \n\nEstou pronto para transformar sua jornada de aprendizado hoje. Como posso iluminar seu caminho?`,
      timestamp: new Date()
    }
  ]);
  const [inputValue, setInputValue] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [mood, setMood] = useState<'happy' | 'tired' | 'excited' | 'confused'>('happy');
  const [level, setLevel] = useState<'basic' | 'advanced' | 'genius'>('advanced');
  const [showSidebar, setShowSidebar] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);

  const [activePath, setActivePath] = useState<any>(null);

  useEffect(() => {
    const fetchActivePath = async () => {
      if (!user) return;
      const { data: progress } = await supabase.from('student_progress').select('*').eq('studentId', user.id).eq('status', 'in_progress').single();
      if (progress) {
        const { data: path } = await supabase.from('learning_paths').select('*').eq('id', progress.pathId).single();
        if (path) {
          setActivePath(path);
        }
      }
    };
    fetchActivePath();
  }, [user]);

  const savedNotes = [
    { id: '1', title: 'Leis de Newton', tag: 'Física', date: 'Hoje' },
    { id: '2', title: 'Equações de 2º Grau', tag: 'Matemática', date: 'Ontem' },
  ];

  const scrollToBottom = (instant = false) => {
    if (scrollRef.current) {
      scrollRef.current.scrollTo({
        top: scrollRef.current.scrollHeight,
        behavior: instant ? 'auto' : 'smooth'
      });
    }
  };

  useEffect(() => {
    // Only scroll if there are messages and we're not on initial mount
    if (messages.length > 1 || isTyping) {
      scrollToBottom();
    }
  }, [messages.length, isTyping]);

  const handleSend = () => {
    if (!inputValue.trim()) return;

    const newUserMessage: Message = {
      id: Date.now().toString(),
      sender: 'user',
      text: inputValue.trim(),
      timestamp: new Date()
    };

    setMessages(prev => [...prev, newUserMessage]);
    setInputValue('');
    setIsTyping(true);

    if (user) {
      incrementMissionProgress(user.id, 'tutor_question', 1);
    }

    // Simulated Intelligence Logic
    setTimeout(() => {
      let response = "";
      if (level === 'basic') response = "Claro! Vou explicar de uma forma bem simples, como se fosse um jogo. ";
      else if (level === 'genius') response = "Excelente questionamento! Analisando profundamente sob uma ótica avançada... ";
      
      response += "Estou processando sua dúvida sobre '" + newUserMessage.text + "'. ";
      
      if (activePath) {
        response += `\n\nPercebi que você está na trilha de ${activePath.subject}. Isso tem tudo a ver com o que estamos estudando!`;
      }

      const aiResponse: Message = {
        id: (Date.now() + 1).toString(),
        sender: 'ai',
        text: response,
        timestamp: new Date(),
        level
      };
      setMessages(prev => [...prev, aiResponse]);
      setIsTyping(false);
    }, 1500);
  };

  const suggestions = [
    { text: 'Explique de outro jeito', icon: Repeat },
    { text: 'Resumo para prova', icon: BookOpen },
    { text: 'Teste meu conhecimento', icon: Trophy },
    { text: 'Dica de estudo rápida', icon: Lightbulb }
  ];

  const moodConfigs = {
    happy: { emoji: '😊', label: 'Radiante', color: 'bg-primary-500', bg: 'bg-primary-50' },
    tired: { emoji: '🥱', label: 'Cansado', color: 'bg-slate-400', bg: 'bg-slate-100' },
    excited: { emoji: '🤩', label: 'Animado', color: 'bg-warning-500', bg: 'bg-warning-50' },
    confused: { emoji: '🤔', label: 'Confuso', color: 'bg-special-500', bg: 'bg-special-50' }
  };

  return (
    <div className="flex h-[calc(100vh-8rem)] gap-6 overflow-hidden animate-in fade-in duration-700">
      
      {/* --- Sidebar Command Center --- */}
      <AnimatePresence>
        {showSidebar && (
          <motion.aside
            initial={{ x: -300, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: -300, opacity: 0 }}
            className="w-80 hidden lg:flex flex-col gap-6"
          >
            {/* Mood Card */}
            <div className="bg-white/80 backdrop-blur-xl rounded-[2.5rem] p-6 border border-white/20 shadow-xl ring-1 ring-slate-100">
               <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 bg-special-500 rounded-xl flex items-center justify-center text-white shadow-lg shadow-special-500/20">
                     <BrainCircuit size={20} />
                  </div>
                  <div>
                    <h3 className="font-black text-slate-800 tracking-tight leading-none uppercase text-[10px]">Humor do Estudante</h3>
                    <p className="text-[9px] font-bold text-slate-400 tracking-widest mt-0.5">INTELIGÊNCIA EMOCIONAL</p>
                  </div>
               </div>
               
               <div className="grid grid-cols-4 gap-2">
                  {(Object.keys(moodConfigs) as Array<keyof typeof moodConfigs>).map(m => (
                    <button
                      key={m}
                      onClick={() => setMood(m)}
                      className={cn(
                        "h-12 rounded-2xl flex items-center justify-center text-xl transition-all",
                        mood === m ? moodConfigs[m].color + " scale-110 shadow-lg" : "bg-slate-50 hover:bg-slate-100"
                      )}
                    >
                      {moodConfigs[m].emoji}
                    </button>
                  ))}
               </div>
            </div>

            {/* Level Selector */}
            <div className="bg-white/80 backdrop-blur-xl rounded-[2.5rem] p-6 border border-white/20 shadow-xl ring-1 ring-slate-100">
                <div className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-4 ml-1">Nível de Explicação</div>
                <div className="bg-slate-50 p-1.5 rounded-2xl flex">
                   {(['basic', 'advanced', 'genius'] as const).map(l => (
                     <button
                       key={l}
                       onClick={() => setLevel(l)}
                       className={cn(
                         "flex-1 py-2.5 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all",
                         level === l ? "bg-white text-primary-600 shadow-sm" : "text-slate-400 hover:text-slate-600"
                       )}
                     >
                       {l === 'basic' ? 'Fácil' : l === 'advanced' ? 'Médio' : 'Gênio'}
                     </button>
                   ))}
                </div>
            </div>

            {/* Saved Notes List */}
            <div className="flex-1 bg-white/80 backdrop-blur-xl rounded-[2.5rem] p-6 border border-white/20 shadow-xl ring-1 ring-slate-100 flex flex-col overflow-hidden">
               <div className="flex items-center justify-between mb-6">
                  <h3 className="font-black text-slate-800 text-xs uppercase tracking-widest">Biblioteca IA</h3>
                  <Bookmark size={14} className="text-slate-300" />
               </div>
               <div className="space-y-3 overflow-y-auto pr-1 flex-1 custom-scrollbar">
                  {savedNotes.map(note => (
                    <div key={note.id} className="group p-4 bg-slate-50/50 border border-slate-100 rounded-2xl hover:bg-white hover:shadow-md transition-all cursor-pointer">
                       <span className="text-[8px] font-black text-primary-500 uppercase tracking-widest mb-1 block">{note.tag}</span>
                       <h4 className="text-[11px] font-black text-slate-700 group-hover:text-primary-600 transition-colors uppercase truncate">{note.title}</h4>
                       <div className="flex items-center gap-1 mt-2 text-slate-400">
                          <Clock size={8} /> <span className="text-[8px] font-bold">{note.date}</span>
                       </div>
                    </div>
                  ))}
               </div>
               <button className="mt-4 w-full py-4 bg-slate-50 text-[10px] font-black uppercase text-slate-400 rounded-2xl tracking-widest hover:bg-slate-100 hover:text-slate-600 transition-all border border-slate-100">Ver tudo</button>
            </div>
          </motion.aside>
        )}
      </AnimatePresence>

      {/* --- Main Chat Stage --- */}
      <main className="flex-1 flex flex-col min-w-0 h-full relative">
         {/* Floating Context Bar */}
         {activePath && (
           <motion.div 
             initial={{ y: -20, opacity: 0 }}
             animate={{ y: 0, opacity: 1 }}
             className="absolute top-4 left-1/2 -translate-x-1/2 z-20 w-fit"
           >
              <div className="bg-indigo-900/80 backdrop-blur-md px-6 py-2.5 rounded-full border border-indigo-400/30 shadow-2xl flex items-center gap-3">
                 <div className="w-2 h-2 rounded-full bg-special-400 animate-ping"></div>
                 <span className="text-[10px] font-black text-white uppercase tracking-[0.1em]">Sincronizado com: <span className="text-special-400">{activePath.title}</span></span>
              </div>
           </motion.div>
         )}

         <div className="flex-1 bg-white/80 backdrop-blur-xl rounded-[3rem] shadow-2xl border border-white/20 overflow-hidden flex flex-col relative ring-1 ring-slate-100 mb-2">
            
            {/* Messages View */}
            <div 
              ref={scrollRef}
              className="flex-1 overflow-y-auto p-8 md:p-12 space-y-10 scroll-smooth relative z-10 custom-scrollbar-big"
            >
              {messages.map((msg) => (
                <motion.div
                  initial={{ opacity: 0, y: 20, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  key={msg.id}
                  className={cn(
                    "flex max-w-[85%] lg:max-w-[70%]",
                    msg.sender === 'user' ? "ml-auto flex-row-reverse" : "mr-auto"
                  )}
                >
                  {/* Bot Head Visualization */}
                  {msg.sender === 'ai' && (
                    <div className="mr-6 shrink-0 relative hidden md:block">
                       <div className="absolute -inset-2 bg-gradient-to-tr from-special-500 to-indigo-500 rounded-full blur-lg opacity-20"></div>
                       <div className="relative w-12 h-12 bg-white rounded-2xl flex items-center justify-center text-special-500 shadow-xl border border-slate-100">
                          <Bot size={24} />
                       </div>
                    </div>
                  )}

                  <div className="space-y-2">
                    <div
                      className={cn(
                        "p-6 md:p-8 rounded-[2.5rem] shadow-xl relative group transition-all",
                        msg.sender === 'user' 
                          ? "bg-gradient-to-br from-indigo-600 to-primary-600 text-white rounded-tr-none shadow-primary-500/20" 
                          : "bg-white border border-slate-100 text-slate-700 rounded-tl-none ring-1 ring-slate-100"
                      )}
                    >
                      {msg.sender === 'ai' && (
                        <div className="flex items-center gap-2 mb-4">
                           <span className="text-[9px] font-black bg-special-50 text-special-600 px-3 py-1 rounded-full border border-special-100 uppercase tracking-widest">IA Sapiência</span>
                           {msg.level === 'genius' && <Flame size={12} className="text-warning-500 fill-warning-500" />}
                        </div>
                      )}
                      
                      <p className="leading-relaxed font-bold text-sm md:text-base whitespace-pre-wrap leading-relaxed">
                        {msg.text}
                      </p>

                      {/* Message Actions */}
                      {msg.sender === 'ai' && (
                        <div className="flex items-center gap-2 mt-6 pt-6 border-t border-slate-50 opacity-0 group-hover:opacity-100 transition-opacity">
                           <button onClick={() => toast.success('Salvo na Biblioteca!')} className="p-2 hover:bg-slate-50 rounded-xl text-slate-400 transition-all"><Bookmark size={14}/></button>
                           <button className="p-2 hover:bg-slate-50 rounded-xl text-slate-400 transition-all"><Repeat size={14}/></button>
                           <button className="p-2 hover:bg-slate-50 rounded-xl text-slate-400 transition-all"><Volume2 size={14}/></button>
                        </div>
                      )}
                    </div>
                    
                    <div className={cn(
                      "flex items-center gap-2 px-4",
                      msg.sender === 'user' ? "flex-row-reverse" : ""
                    )}>
                      <span className="text-[9px] font-black text-slate-300 uppercase tracking-widest italic">
                        {msg.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                  </div>
                </motion.div>
              ))}

              {isTyping && (
                <div className="flex max-w-[80%] mr-auto">
                  <div className="w-12 h-12 rounded-2xl bg-special-50 text-special-400 flex items-center justify-center mr-6 shrink-0 shadow-inner">
                    <Bot size={24} className="animate-pulse" />
                  </div>
                  <div className="bg-white border border-slate-100 rounded-[2rem] rounded-tl-none p-6 flex items-center gap-2 shadow-sm">
                    <div className="w-2 h-2 rounded-full bg-special-500 animate-bounce" style={{ animationDelay: '0ms' }}></div>
                    <div className="w-2 h-2 rounded-full bg-special-500 animate-bounce" style={{ animationDelay: '200ms' }}></div>
                    <div className="w-2 h-2 rounded-full bg-special-500 animate-bounce" style={{ animationDelay: '400ms' }}></div>
                  </div>
                </div>
              )}
            </div>

            {/* Smart Input Hub */}
            <div className="p-6 md:p-8 bg-slate-50/50 border-t border-slate-100/50 relative">
               <div className="absolute top-0 left-0 right-0 h-24 bg-gradient-to-t from-slate-50/80 to-transparent -translate-y-full pointer-events-none"></div>
               
               {/* Quick Pedagogical Actions */}
               <div className="flex flex-wrap gap-2 mb-6 ml-1 relative z-10">
                  {suggestions.map((s, i) => (
                    <button
                      key={i}
                      onClick={() => setInputValue(s.text)}
                      className="group flex items-center gap-2 px-4 py-2.5 bg-white text-slate-600 hover:text-primary-600 text-[10px] font-black uppercase tracking-widest rounded-2xl transition-all border border-slate-200 shadow-sm hover:shadow-md hover:border-primary-200"
                    >
                      <s.icon size={12} className="text-slate-400 group-hover:text-primary-500 transition-colors" />
                      {s.text}
                    </button>
                  ))}
               </div>

               <div className="relative group z-10">
                  <div className="absolute -inset-1 bg-gradient-to-r from-primary-500 to-indigo-600 rounded-[2.5rem] blur opacity-15 group-focus-within:opacity-30 transition-opacity"></div>
                  <div className="relative flex items-end gap-3 rounded-[2.2rem] bg-white border border-slate-200 p-3 shadow-2xl shadow-indigo-500/5 ring-4 ring-transparent focus-within:ring-primary-500/5 transition-all">
                    <button className="p-3.5 mb-1.5 ml-1.5 text-slate-300 hover:text-primary-500 transition-colors hidden md:block"><Paperclip size={20} /></button>
                    <textarea
                      value={inputValue}
                      onChange={(e) => setInputValue(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && (e.preventDefault(), handleSend())}
                      placeholder="Converse com sua inteligência educacional..."
                      className="flex-1 bg-transparent border-none focus:ring-0 resize-none max-h-40 min-h-[56px] py-4 px-3 font-bold text-slate-800 placeholder:text-slate-300 scrollbar-hide"
                      rows={1}
                    />
                    <div className="flex items-center gap-2 mb-1.5 mr-1.5">
                       <button className="p-3.5 text-slate-300 hover:text-special-500 transition-colors hidden md:block"><Volume2 size={20} /></button>
                       <button
                         onClick={handleSend}
                         disabled={!inputValue.trim()}
                         className={cn(
                           "w-14 h-14 flex items-center justify-center rounded-[1.5rem] transition-all transform active:scale-95 shadow-xl",
                           inputValue.trim() 
                             ? "bg-slate-900 text-white shadow-slate-900/20 hover:scale-105" 
                             : "bg-slate-100 text-slate-300 cursor-not-allowed"
                         )}
                       >
                         <ChevronRight size={28} />
                       </button>
                    </div>
                  </div>
               </div>
            </div>
         </div>

         {/* Utility Footer */}
         <div className="flex items-center justify-between px-8 py-2">
            <div className="flex items-center gap-4">
               <button onClick={() => setShowSidebar(!showSidebar)} className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-slate-600 transition-colors">
                  <Settings2 size={12} /> {showSidebar ? 'Recolher Painel' : 'Expandir Painel'}
               </button>
            </div>
            <div className="flex items-center gap-1.5">
               <div className="w-1.5 h-1.5 rounded-full bg-success-500 animate-pulse"></div>
               <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Motor: Impacto AI v4.3 (SafeScroll)</span>
            </div>
         </div>
      </main>

    </div>
  );
};
