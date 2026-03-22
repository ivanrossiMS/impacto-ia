import React, { useState, useRef, useEffect, useCallback } from 'react';
import { 
  Bot, BookOpen, Repeat, 
  Clock, Flame, BrainCircuit,
  Volume2, Paperclip, ChevronRight, Settings2,
  Trophy, Lightbulb, Users, MessageSquare, Search,
  Bookmark, BookMarked, X
} from 'lucide-react';
import { useAuthStore } from '../../store/auth.store';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '../../lib/supabase';
import { cn } from '../../lib/utils';
import { incrementMissionProgress } from '../../lib/missionUtils';
import { toast } from 'sonner';
import { callTutorChat } from '../../ai/client';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import 'katex/dist/katex.min.css';

interface Message {
  id: string;
  sender: 'ai' | 'user';
  text: string;
  timestamp: string; // ISO string for serialisation
  level?: 'basic' | 'advanced' | 'genius';
}

// ─── LocalStorage helpers ─────────────────────────────────────────────────────

/** Current session chat (cleared when student leaves) */
const SESSION_KEY = (userId: string) => `tutor_session_${userId}`;
/** Persistent question history across all sessions (shown in sidebar) */

function loadSession(userId: string): Message[] {
  try {
    const raw = localStorage.getItem(SESSION_KEY(userId));
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

function saveSession(userId: string, messages: Message[]) {
  try {
    localStorage.setItem(SESSION_KEY(userId), JSON.stringify(messages));
  } catch { /* ignore */ }
}

/** Persistent session-based history (one entry per page visit) */
const SESSIONS_KEY = (userId: string) => `tutor_sessions_${userId}`;

interface QAPair {
  id: string;
  question: string;
  answer: string;
  timestamp: string;
}

interface QASession {
  sessionId: string;
  startedAt: string;
  pairs: QAPair[];
}

function loadSessions(userId: string): QASession[] {
  try {
    const raw = localStorage.getItem(SESSIONS_KEY(userId));
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

/** Upsert the current session (add pair or create session if first pair) */
function upsertSessionPair(userId: string, sessionId: string, pair: QAPair) {
  try {
    const existing = loadSessions(userId);
    const idx = existing.findIndex(s => s.sessionId === sessionId);
    if (idx >= 0) {
      existing[idx].pairs.push(pair);
    } else {
      existing.push({ sessionId, startedAt: pair.timestamp, pairs: [pair] });
    }
    // Keep max 100 sessions
    const trimmed = existing.slice(-100);
    localStorage.setItem(SESSIONS_KEY(userId), JSON.stringify(trimmed));
  } catch { /* ignore */ }
}

function clearSessions(userId: string) {
  localStorage.removeItem(SESSIONS_KEY(userId));
}

// ─── Diary helpers ────────────────────────────────────────────────────────────

async function saveToDiary(
  userId: string,
  question: string,
) {
  // ── Build a brief action summary (not the full answer) ──
  // Strip common interrogative prefixes to extract the core topic
  const topic = question
    .trim()
    .replace(/[?!]+$/, '')
    .replace(/^(o que (é|são|foi|foram)|como (funciona|calcular|fazer|se chama)|explique(-me)?|me explique|qual (é|foi)|quem foi|quando foi|por que|porque|me fale sobre|fale sobre|o que significa|defina)\s+/i, '')
    .slice(0, 80);

  const topicCap = topic.charAt(0).toUpperCase() + topic.slice(1);

  const title   = `📚 Estudo com IA: ${topicCap.slice(0, 55)}${topicCap.length > 55 ? '…' : ''}`;
  const content = `Hoje, estudei sobre **${topicCap}** com o auxílio do Tutor IA.`;

  // Auto-tag: extract key nouns (first 5 unique words > 4 chars from the question)
  const rawTags = question
    .toLowerCase()
    .replace(/[^a-záéíóúâêîôûãõç\s]/g, '')
    .split(/\s+/)
    .filter(w => w.length > 4)
    .slice(0, 5);
  const tags = [...new Set(['tutor-ia', ...rawTags])];

  const entry = {
    id: crypto.randomUUID(),
    studentId: userId,
    title,
    content,
    mood: '🤖',
    tags,
    isAIGenerated: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  const { error } = await supabase.from('diary_entries').insert(entry);
  if (error) {
    console.error('[TutorIA] Diary save failed:', error.message);
  }
}

// ─── Component ────────────────────────────────────────────────────────────────

export const TutorIA: React.FC = () => {
  const { user } = useAuthStore();

  // ── Chat messages: from current session only (starts fresh each visit) ──
  const [messages, setMessages] = useState<Message[]>(() => {
    if (!user?.id) return [];
    const session = loadSession(user.id);
    if (session.length > 0) return session;
    return [{
      id: '1',
      sender: 'ai',
      text: `Olá, **${user?.name || 'Estudante'}**! Sou o **Capy**, seu Tutor IA avançado.\n\nEstou pronto para transformar sua jornada de aprendizado. Como posso iluminar seu caminho hoje? 🚀`,
      timestamp: new Date().toISOString(),
    }];
  });

  // ── Session-based persistent history ──
  // Each page visit gets a unique sessionId; pairs accumulate into that session
  const currentSessionId = useRef<string>(crypto.randomUUID());
  /** Prevents saving more than one diary entry per session */
  const diaryAlreadySaved = useRef<boolean>(false);
  const [sessions, setSessions] = useState<QASession[]>(() =>
    user?.id ? loadSessions(user.id) : []
  );

  // ── Review state (selected session for full Q&A view) ──
  const [reviewSession, setReviewSession] = useState<QASession | null>(null);

  const [inputValue, setInputValue] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [mood, setMood] = useState<'happy' | 'tired' | 'excited' | 'confused'>('happy');
  const [showSidebar, setShowSidebar] = useState(true);
  const [historySearch, setHistorySearch] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);

  const [turma, setTurma] = useState<{ name: string; grade: string } | null>(null);

  // ── Save current session to localStorage whenever messages change ──
  useEffect(() => {
    if (user?.id && messages.length > 0) {
      saveSession(user.id, messages);
    }
  }, [messages, user?.id]);

  useEffect(() => {
    const fetchData = async () => {
      if (!user) return;

      const studentClassId = (user as any).classId;
      if (studentClassId) {
        const { data: classData } = await supabase
          .from('classes')
          .select('name, grade')
          .eq('id', studentClassId)
          .maybeSingle();
        if (classData) setTurma(classData);
      }
    };
    fetchData();
  }, [user]);

  // ── On unmount: just clear the session so next visit starts fresh ──
  // (Q&A pairs are saved immediately on each AI response, not here)
  useEffect(() => {
    return () => {
      if (user?.id) {
        localStorage.removeItem(SESSION_KEY(user.id));
      }
    };
  }, [user?.id]);

  const scrollToBottom = useCallback((instant = false) => {
    if (scrollRef.current) {
      scrollRef.current.scrollTo({
        top: scrollRef.current.scrollHeight,
        behavior: instant ? 'auto' : 'smooth',
      });
    }
  }, []);

  useEffect(() => {
    if (messages.length > 1 || isTyping) scrollToBottom();
  }, [messages.length, isTyping, scrollToBottom]);

  const handleSend = async () => {
    if (!inputValue.trim() || isTyping) return;

    const userText = inputValue.trim();
    const newUserMessage: Message = {
      id: Date.now().toString(),
      sender: 'user',
      text: userText,
      timestamp: new Date().toISOString(),
    };

    setMessages(prev => [...prev, newUserMessage]);
    setInputValue('');
    setIsTyping(true);

    if (user) incrementMissionProgress(user.id, 'tutor_question', 1);

    try {
      const response = await callTutorChat({
        message: userText,
        userName: user?.name || 'Estudante',
        grade: turma?.grade || (user as any)?.grade || undefined,
        userId: user?.id,
      });

      const aiResponse: Message = {
        id: (Date.now() + 1).toString(),
        sender: 'ai',
        text: response,
        timestamp: new Date().toISOString(),
      };
      setMessages(prev => [...prev, aiResponse]);

      // ── Append pair to current session in localStorage & state ──
      if (user?.id) {
        const pair: QAPair = {
          id: crypto.randomUUID(),
          question: userText,
          answer: response,
          timestamp: new Date().toISOString(),
        };
        upsertSessionPair(user.id, currentSessionId.current, pair);
        setSessions(loadSessions(user.id)); // reload to get latest state
      }

      // ── Auto-save to diary (once per session only) ──
      if (user?.id && !diaryAlreadySaved.current) {
        diaryAlreadySaved.current = true;
        saveToDiary(user.id, userText).catch(() => {});
        toast.success('📓 Anotado no seu Diário!', { duration: 2000 });
      }
    } catch (err: any) {
      toast.error(err.message || 'Erro ao conectar com a IA. Tente novamente.');
      setMessages(prev => prev.filter(m => m.id !== newUserMessage.id));
      setInputValue(userText);
    } finally {
      setIsTyping(false);
    }
  };

  const handleClearHistory = () => {
    if (!user?.id) return;
    const welcome: Message = {
      id: '1',
      sender: 'ai',
      text: `Olá, **${user?.name || 'Estudante'}**! Histórico limpo. Como posso ajudar? 😊`,
      timestamp: new Date().toISOString(),
    };
    setMessages([welcome]);
    localStorage.removeItem(SESSION_KEY(user.id));
    clearSessions(user.id);
    setSessions([]);
    setReviewSession(null);

    toast.success('Histórico limpo.');
  };

  const suggestions = [
    { text: 'Explique de outro jeito', icon: Repeat },
    { text: 'Resumo para prova', icon: BookOpen },
    { text: 'Teste meu conhecimento', icon: Trophy },
    { text: 'Dica de estudo rápida', icon: Lightbulb },
  ];

  const moodConfigs = {
    happy:   { emoji: '😊', label: 'Radiante',  color: 'bg-primary-500',  bg: 'bg-primary-50'  },
    tired:   { emoji: '🥱', label: 'Cansado',   color: 'bg-slate-400',    bg: 'bg-slate-100'   },
    excited: { emoji: '🤩', label: 'Animado',   color: 'bg-warning-500',  bg: 'bg-warning-50'  },
    confused:{ emoji: '🤔', label: 'Confuso',   color: 'bg-special-500',  bg: 'bg-special-50'  },
  };

  // ── Sidebar: sessions filtered by search across all their pairs ──
  const filteredSessions = historySearch.trim()
    ? sessions.filter(s =>
        s.pairs.some(p => p.question.toLowerCase().includes(historySearch.toLowerCase()))
      )
    : sessions;

  return (
    <div className="flex h-[calc(100vh-8rem)] gap-6 overflow-hidden animate-in fade-in duration-700">

      {/* --- Sidebar --- */}
      <AnimatePresence>
        {showSidebar && (
          <motion.aside
            initial={{ x: -300, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: -300, opacity: 0 }}
            className="w-80 hidden lg:flex flex-col gap-4"
          >
            {/* Mood Card */}
            <div className="bg-white/80 backdrop-blur-xl rounded-[2.5rem] p-6 border border-white/20 shadow-xl ring-1 ring-slate-100">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 bg-special-500 rounded-xl flex items-center justify-center text-white shadow-lg shadow-special-500/20">
                  <BrainCircuit size={20} />
                </div>
                <div>
                  <h3 className="font-black text-slate-800 uppercase text-[10px]">Humor do Estudante</h3>
                  <p className="text-[9px] font-bold text-slate-400 tracking-widest mt-0.5">INTELIGÊNCIA EMOCIONAL</p>
                </div>
              </div>
              <div className="grid grid-cols-4 gap-2">
                {(Object.keys(moodConfigs) as Array<keyof typeof moodConfigs>).map(m => (
                  <button
                    key={m}
                    onClick={() => setMood(m)}
                    className={cn(
                      'h-12 rounded-2xl flex items-center justify-center text-xl transition-all',
                      mood === m ? moodConfigs[m].color + ' scale-110 shadow-lg' : 'bg-slate-50 hover:bg-slate-100'
                    )}
                  >
                    {moodConfigs[m].emoji}
                  </button>
                ))}
              </div>
            </div>

            {/* Turma Card */}
            <div className="bg-white/80 backdrop-blur-xl rounded-[2.5rem] p-6 border border-white/20 shadow-xl ring-1 ring-slate-100">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 bg-primary-500 rounded-xl flex items-center justify-center text-white shadow-lg shadow-primary-500/20">
                  <Users size={20} />
                </div>
                <div>
                  <h3 className="font-black text-slate-800 uppercase text-[10px]">Minha Turma</h3>
                  <p className="text-[9px] font-bold text-slate-400 tracking-widest mt-0.5">IA ADAPTADA À SUA TURMA</p>
                </div>
              </div>
              {turma ? (
                <div className="bg-primary-50 border border-primary-100 rounded-2xl p-4 text-center">
                  <p className="text-lg font-black text-primary-700 leading-none">{turma.name}</p>
                  <p className="text-[10px] font-bold text-primary-400 uppercase tracking-widest mt-1">{turma.grade}</p>
                  <div className="mt-3 flex items-center justify-center gap-1.5">
                    <div className="w-1.5 h-1.5 rounded-full bg-success-500 animate-pulse" />
                    <span className="text-[9px] font-black text-success-600 uppercase tracking-wider">Explicações adaptadas</span>
                  </div>
                </div>
              ) : (
                <div className="bg-slate-50 rounded-2xl p-4 text-center">
                  <p className="text-[11px] font-bold text-slate-400">Turma não encontrada</p>
                  <p className="text-[9px] text-slate-300 mt-1">A IA usará linguagem padrão</p>
                </div>
              )}
            </div>

            {/* ── History Panel ── */}
            <div className="flex-1 bg-white/80 backdrop-blur-xl rounded-[2.5rem] p-5 border border-white/20 shadow-xl ring-1 ring-slate-100 flex flex-col min-h-0">
              {/* Header */}
              <div className="flex items-center justify-between mb-3 shrink-0">
                <div className="flex items-center gap-2">
                  <MessageSquare size={13} className="text-special-500" />
                  <h3 className="font-black text-slate-800 text-[10px] uppercase tracking-widest">
                    Histórico ({sessions.length})
                  </h3>
                </div>
                <button
                  onClick={handleClearHistory}
                  className="text-[9px] font-black text-slate-300 hover:text-red-400 transition-colors uppercase tracking-widest"
                  title="Limpar histórico"
                >
                  Limpar
                </button>
              </div>

              {/* Search bar */}
              <div className="relative mb-3 shrink-0">
                <Search size={11} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-300" />
                <input
                  type="text"
                  value={historySearch}
                  onChange={e => setHistorySearch(e.target.value)}
                  placeholder="Buscar no histórico..."
                  className="w-full pl-8 pr-8 py-2 bg-slate-50 border border-slate-100 rounded-xl text-[10px] font-bold text-slate-600 placeholder:text-slate-300 focus:outline-none focus:ring-1 focus:ring-special-200"
                />
                {historySearch && (
                  <button
                    onClick={() => setHistorySearch('')}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-300 hover:text-slate-500"
                  >
                    <X size={10} />
                  </button>
                )}
              </div>

              {/* History list — scrollable */}
              <div className="flex-1 overflow-y-auto space-y-1.5 pr-1 custom-scrollbar min-h-0">
                {filteredSessions.length === 0 ? (
                  <div className="text-center py-8">
                    <MessageSquare size={22} className="text-slate-200 mx-auto mb-2" />
                    <p className="text-[10px] font-bold text-slate-300 uppercase tracking-widest">
                      {historySearch ? 'Nenhum resultado' : 'Nenhuma pergunta ainda'}
                    </p>
                    <p className="text-[9px] text-slate-200 mt-1">
                      {historySearch ? 'Tente outras palavras' : 'Suas perguntas aparecerão aqui'}
                    </p>
                  </div>
                ) : (
                  [...filteredSessions].reverse().map(session => (
                    <button
                      key={session.sessionId}
                      onClick={() => setReviewSession(session)}
                      className="w-full text-left group p-2.5 bg-slate-50/70 border border-slate-100 rounded-xl hover:bg-special-50 hover:border-special-100 transition-all"
                    >
                      <div className="flex items-center justify-between gap-1 mb-1">
                        <p className="text-[10px] font-bold text-slate-600 group-hover:text-special-700 line-clamp-2 transition-colors flex-1">
                          {session.pairs[0]?.question ?? 'Sessão sem título'}
                        </p>
                        <span className="shrink-0 text-[8px] font-black bg-special-100 text-special-600 px-1.5 py-0.5 rounded-full">
                          {session.pairs.length}x
                        </span>
                      </div>
                      <div className="flex items-center gap-1 text-slate-300">
                        <Clock size={7} />
                        <span className="text-[8px] font-bold">
                          {new Date(session.startedAt).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}
                          {' '}
                          {new Date(session.startedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                    </button>
                  ))
                )}
              </div>

              {/* Diary shortcut */}
              <div className="shrink-0 mt-3 pt-3 border-t border-slate-100">
                <a
                  href="/student/diary"
                  className="flex items-center gap-2 text-[9px] font-black text-indigo-500 hover:text-indigo-700 uppercase tracking-widest transition-colors"
                >
                  <BookMarked size={11} />
                  Ver todas as anotações no Diário
                </a>
              </div>
            </div>
          </motion.aside>
        )}
      </AnimatePresence>

      {/* --- Main Chat Stage --- */}
      <main className="flex-1 flex flex-col min-w-0 h-full relative">


        <div className="flex-1 bg-white/80 backdrop-blur-xl rounded-[3rem] shadow-2xl border border-white/20 overflow-hidden flex flex-col relative ring-1 ring-slate-100 mb-2">

          {/* Messages */}
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
                  'flex max-w-[85%] lg:max-w-[70%]',
                  msg.sender === 'user' ? 'ml-auto flex-row-reverse' : 'mr-auto'
                )}
              >
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
                      'p-6 md:p-8 rounded-[2.5rem] shadow-xl relative group transition-all',
                      msg.sender === 'user'
                        ? 'bg-gradient-to-br from-indigo-600 to-primary-600 text-white rounded-tr-none shadow-primary-500/20'
                        : 'bg-white border border-slate-100 text-slate-700 rounded-tl-none ring-1 ring-slate-100'
                    )}
                  >
                    {msg.sender === 'ai' && (
                      <div className="flex items-center gap-2 mb-4">
                        <span className="text-[9px] font-black bg-special-50 text-special-600 px-3 py-1 rounded-full border border-special-100 uppercase tracking-widest">IA Sapiência</span>
                        {msg.level === 'genius' && <Flame size={12} className="text-warning-500 fill-warning-500" />}
                      </div>
                    )}

                    {msg.sender === 'ai' ? (
                      <div className="prose prose-sm prose-slate max-w-none leading-relaxed font-medium
                        prose-headings:font-black prose-headings:text-slate-800 prose-headings:mt-4 prose-headings:mb-2
                        prose-strong:text-slate-800 prose-strong:font-black
                        prose-li:marker:text-special-500 prose-li:my-0.5
                        prose-p:my-2 prose-ol:my-2 prose-ul:my-2 prose-hr:border-slate-100
                        [&_.katex-display]:my-4 [&_.katex-display]:overflow-x-auto [&_.katex-display]:py-2
                        [&_.katex-display_.katex]:text-slate-800 [&_.katex]:text-slate-800">
                        <ReactMarkdown
                          remarkPlugins={[remarkGfm, remarkMath]}
                          rehypePlugins={[rehypeKatex]}
                          components={{
                            code({ node, className, children, ...props }: any) {
                              const isBlock = className?.includes('language-') || String(children).includes('\n');
                              if (isBlock) {
                                return (
                                  <pre className="bg-slate-900 border border-slate-700 rounded-2xl p-4 my-3 overflow-x-auto">
                                    <code className="text-emerald-300 font-mono text-sm font-medium whitespace-pre" {...props}>
                                      {children}
                                    </code>
                                  </pre>
                                );
                              }
                              return (
                                <code className="bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded-lg font-mono font-bold text-sm border border-indigo-100" {...props}>
                                  {children}
                                </code>
                              );
                            },
                            pre({ children }: any) {
                              return <>{children}</>;
                            },
                            hr() {
                              return <hr className="border-slate-100 my-3" />;
                            },
                          }}
                        >
                          {msg.text}
                        </ReactMarkdown>
                      </div>
                    ) : (
                      <p className="leading-relaxed font-bold text-sm md:text-base whitespace-pre-wrap">{msg.text}</p>
                    )}

                    {msg.sender === 'ai' && (
                      <div className="flex items-center gap-2 mt-6 pt-6 border-t border-slate-50 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button onClick={() => toast.success('Salvo na Biblioteca!')} className="p-2 hover:bg-slate-50 rounded-xl text-slate-400 transition-all"><Bookmark size={14}/></button>
                        <button className="p-2 hover:bg-slate-50 rounded-xl text-slate-400 transition-all"><Repeat size={14}/></button>
                        <button className="p-2 hover:bg-slate-50 rounded-xl text-slate-400 transition-all"><Volume2 size={14}/></button>
                      </div>
                    )}
                  </div>

                  <div className={cn('flex items-center gap-2 px-4', msg.sender === 'user' ? 'flex-row-reverse' : '')}>
                    <span className="text-[9px] font-black text-slate-300 uppercase tracking-widest italic">
                      {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
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

          {/* Input Hub */}
          <div className="p-6 md:p-8 bg-slate-50/50 border-t border-slate-100/50 relative">
            <div className="absolute top-0 left-0 right-0 h-24 bg-gradient-to-t from-slate-50/80 to-transparent -translate-y-full pointer-events-none"></div>

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
                    disabled={!inputValue.trim() || isTyping}
                    className={cn(
                      'w-14 h-14 flex items-center justify-center rounded-[1.5rem] transition-all transform active:scale-95 shadow-xl',
                      inputValue.trim() && !isTyping
                        ? 'bg-slate-900 text-white shadow-slate-900/20 hover:scale-105'
                        : 'bg-slate-100 text-slate-300 cursor-not-allowed'
                    )}
                  >
                    <ChevronRight size={28} />
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-8 py-2">
          <div className="flex items-center gap-4">
            <button
              onClick={() => setShowSidebar(!showSidebar)}
              className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-slate-600 transition-colors"
            >
              <Settings2 size={12} /> {showSidebar ? 'Recolher Painel' : 'Expandir Painel'}
            </button>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-1.5 h-1.5 rounded-full bg-success-500 animate-pulse"></div>
            <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Motor: Capy AI v5 · Histórico Persistente</span>
          </div>
        </div>
      </main>

      {/* ─── Session Review Modal ─── */}
      <AnimatePresence>
        {reviewSession && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-slate-900/50 backdrop-blur-sm"
            onClick={() => setReviewSession(null)}
          >
            <motion.div
              initial={{ scale: 0.92, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.92, y: 20 }}
              onClick={e => e.stopPropagation()}
              className="bg-white rounded-[2.5rem] shadow-2xl w-full max-w-2xl max-h-[80vh] overflow-hidden flex flex-col"
            >
              {/* Modal header */}
              <div className="bg-gradient-to-r from-special-600 to-indigo-600 px-8 py-5 flex items-center justify-between shrink-0">
                <div>
                  <p className="text-[9px] font-black text-white/60 uppercase tracking-widest mb-0.5">
                    Sessão · {new Date(reviewSession.startedAt).toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' })}
                    {' · '}{reviewSession.pairs.length} pergunta{reviewSession.pairs.length !== 1 ? 's' : ''}
                  </p>
                  <p className="text-white font-black text-sm line-clamp-1">{reviewSession.pairs[0]?.question}</p>
                </div>
                <button onClick={() => setReviewSession(null)} className="p-2.5 bg-white/10 hover:bg-white/20 rounded-2xl transition-all text-white">
                  <X size={18} />
                </button>
              </div>

              {/* Modal body — all Q&A in the session */}
              <div className="overflow-y-auto p-8 space-y-8 custom-scrollbar flex-1">
                {reviewSession.pairs.map((pair, i) => (
                  <div key={pair.id} className="space-y-4">
                    {reviewSession.pairs.length > 1 && (
                      <p className="text-[9px] font-black text-slate-300 uppercase tracking-widest">Pergunta {i + 1}</p>
                    )}
                    {/* Question bubble */}
                    <div className="flex justify-end">
                      <div className="bg-gradient-to-br from-indigo-600 to-primary-600 text-white rounded-[2rem] rounded-tr-none px-6 py-4 max-w-[85%]">
                        <p className="font-bold text-sm leading-relaxed">{pair.question}</p>
                      </div>
                    </div>
                    {/* AI answer */}
                    <div className="flex gap-4">
                      <div className="w-10 h-10 bg-white border border-slate-100 rounded-2xl shrink-0 flex items-center justify-center text-special-500 shadow-sm mt-1">
                        <Bot size={20} />
                      </div>
                      <div className="bg-slate-50 border border-slate-100 rounded-[2rem] rounded-tl-none px-6 py-5 flex-1">
                        <div className="text-[9px] font-black bg-special-50 text-special-600 px-3 py-1 rounded-full border border-special-100 uppercase tracking-widest w-fit mb-3">IA Sapiência</div>
                        <div className="prose prose-sm prose-slate max-w-none text-slate-700
                          prose-headings:font-black prose-headings:text-slate-800
                          prose-strong:text-slate-800 prose-strong:font-black
                          prose-li:marker:text-special-500">
                          <ReactMarkdown remarkPlugins={[remarkGfm]}>{pair.answer}</ReactMarkdown>
                        </div>
                        <button
                          onClick={() => { setInputValue(pair.question); setReviewSession(null); }}
                          className="mt-4 flex items-center gap-1.5 text-[9px] font-black text-slate-400 hover:text-special-600 uppercase tracking-widest transition-colors"
                        >
                          <Repeat size={10} /> Perguntar novamente
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
