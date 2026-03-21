import React, { useState, useEffect, useRef } from 'react';
import { 
  BrainCircuit, 
  Sparkles, 
  Send,
  RefreshCw,
  Clock,
  BookOpen,
  MessageCircle,
  Bot,
  Loader2,
  ChevronRight
} from 'lucide-react';
import { Card } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { cn } from '../../lib/utils';
import { toast } from 'sonner';


const GEMINI_API_KEY = import.meta.env.VITE_GEMINI_API_KEY;
const ARTICLE_STORAGE_KEY = 'guardian_ai_article';
const ARTICLE_DATE_KEY = 'guardian_ai_article_date';
const FIVE_DAYS_MS = 5 * 24 * 60 * 60 * 1000;

const FALLBACK_ARTICLES = [
  {
    category: 'Desenvolvimento',
    title: 'O poder da leitura compartilhada em família',
    content: 'Ler juntos vai além de ensinar palavras. A leitura compartilhada fortalece o vínculo emocional entre pais e filhos, enriquece o vocabulário de forma lúdica e desperta a imaginação. Tente reservar pelo menos 15 minutos por noite antes de dormir para uma história. Deixe a criança escolher o livro, faça perguntas sobre os personagens e celebre cada descoberta. Pesquisas mostram que crianças cujos pais leram com elas regularmente têm desempenho escolar significativamente melhor e desenvolvem maior empatia.',
    readTime: '4 min',
    emoji: '📚'
  },
  {
    category: 'Rotina',
    title: 'Como criar uma rotina de estudos que seu filho vai adorar',
    content: 'Uma rotina estável reduz a ansiedade infantil e aumenta a produtividade. O segredo não é rigidez, mas previsibilidade. Defina um horário fixo para estudos logo após um lanche saudável, quando o nível de energia está moderado. Use um temporizador visual (25 min de foco + 5 min de pausa — a técnica Pomodoro adaptada). Envolva seu filho na criação da rotina: quando a criança participa, ela se torna responsável pelo próprio aprendizado. Celebre conquistas com pequenas recompensas não-tela, como uma brincadeira especial.',
    readTime: '5 min',
    emoji: '⏰'
  },
  {
    category: 'Tecnologia',
    title: 'Tecnologia e aprendizagem: aliadas com limites claros',
    content: 'A tecnologia educacional, usada com intenção, acelera o aprendizado. Plataformas gamificadas como o Impacto IA aproveitam a neurociência do prazer para motivar estudos. Porém, o equilíbrio é fundamental. Estabeleça "zonas sem tela" (mesa de jantar, quarto após 21h) e use a tecnologia como complemento, nunca substituto, da interação humana. Converse sobre o que seu filho aprendeu no Tutor IA — isso reforça o conteúdo e mostra que você se importa com a jornada deles.',
    readTime: '4 min',
    emoji: '💻'
  },
];

const callGeminiAPI = async (prompt: string): Promise<string> => {
  if (!GEMINI_API_KEY) {
    throw new Error('API key não configurada');
  }

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.8,
          maxOutputTokens: 600,
        }
      })
    }
  );

  if (!response.ok) throw new Error('Erro na API Gemini');
  const data = await response.json();
  return data.candidates?.[0]?.content?.parts?.[0]?.text || '';
};

const generateWeeklyArticle = async (): Promise<string> => {
  const topics = [
    'como incentivar a curiosidade intelectual em crianças',
    'a importância do sono para o aprendizado infantil',
    'como lidar com a frustração e o erro de forma positiva',
    'jogos e brincadeiras que estimulam o raciocínio lógico',
    'comunicação não-violenta com filhos adolescentes',
    'atividade física e desempenho escolar: a conexão científica',
    'como identificar e apoiar diferentes estilos de aprendizagem',
  ];
  const topic = topics[Math.floor(Math.random() * topics.length)];
  
  const prompt = `Você é um especialista em educação infantil e parentalidade positiva. Escreva um artigo curto e prático (máximo 200 palavras) sobre: "${topic}". 
  
  Escreva de forma calorosa, acessível e encorajadora para pais brasileiros. Use linguagem simples. 
  Não use markdown ou formatação especial - apenas texto corrido em parágrafos curtos.
  Comece diretamente com o conteúdo, sem título.`;
  
  return callGeminiAPI(prompt);
};

const generateCustomContent = async (subject: string): Promise<string> => {
  const prompt = `Você é um especialista em educação infantil e parentalidade. Um pai/mãe perguntou sobre: "${subject}".
  
  Escreva uma resposta prática e acolhedora (máximo 200 palavras) sobre este assunto relacionado à educação ou cuidados com filhos.
  Use linguagem simples e encorajadora para pais brasileiros.
  Não use markdown - apenas texto corrido. Comece diretamente respondendo.`;
  
  return callGeminiAPI(prompt);
};

interface AIArticle {
  content: string;
  generatedAt: string;
}

export const ParentTips: React.FC = () => {
  const [activeCategory, setActiveCategory] = useState<string>('Todos');
  const [aiArticle, setAiArticle] = useState<AIArticle | null>(null);
  const [isLoadingArticle, setIsLoadingArticle] = useState(false);
  const [customSubject, setCustomSubject] = useState('');
  const [customContent, setCustomContent] = useState('');
  const [isLoadingCustom, setIsLoadingCustom] = useState(false);
  const [selectedArticle, setSelectedArticle] = useState<typeof FALLBACK_ARTICLES[0] | null>(null);
  const customRef = useRef<HTMLDivElement>(null);

  // Load or generate AI article
  useEffect(() => {
    const loadAIArticle = async () => {
      const storedArticle = localStorage.getItem(ARTICLE_STORAGE_KEY);
      const storedDate = localStorage.getItem(ARTICLE_DATE_KEY);
      
      const now = Date.now();
      const lastDate = storedDate ? parseInt(storedDate) : 0;
      const shouldRefresh = (now - lastDate) > FIVE_DAYS_MS;

      if (storedArticle && !shouldRefresh) {
        setAiArticle({ content: storedArticle, generatedAt: storedDate || now.toString() });
        return;
      }

      // Generate new article
      setIsLoadingArticle(true);
      try {
        const content = await generateWeeklyArticle();
        localStorage.setItem(ARTICLE_STORAGE_KEY, content);
        localStorage.setItem(ARTICLE_DATE_KEY, now.toString());
        setAiArticle({ content, generatedAt: now.toString() });
      } catch {
        // Use fallback content
        const fallback = FALLBACK_ARTICLES[Math.floor(Math.random() * FALLBACK_ARTICLES.length)];
        localStorage.setItem(ARTICLE_STORAGE_KEY, fallback.content);
        localStorage.setItem(ARTICLE_DATE_KEY, now.toString());
        setAiArticle({ content: fallback.content, generatedAt: now.toString() });
      } finally {
        setIsLoadingArticle(false);
      }
    };

    loadAIArticle();
  }, []);

  const handleRefreshArticle = async () => {
    setIsLoadingArticle(true);
    try {
      const content = await generateWeeklyArticle();
      const now = Date.now();
      localStorage.setItem(ARTICLE_STORAGE_KEY, content);
      localStorage.setItem(ARTICLE_DATE_KEY, now.toString());
      setAiArticle({ content, generatedAt: now.toString() });
      toast.success('Novo artigo gerado pela IA!');
    } catch {
      toast.error('Não foi possível gerar o artigo. Verifique a conexão.');
    } finally {
      setIsLoadingArticle(false);
    }
  };

  const handleCustomQuery = async () => {
    if (!customSubject.trim()) return;
    setIsLoadingCustom(true);
    setCustomContent('');
    customRef.current?.scrollIntoView({ behavior: 'smooth' });
    try {
      const content = await generateCustomContent(customSubject);
      setCustomContent(content);
    } catch {
      setCustomContent('Desculpe, não foi possível gerar o conteúdo no momento. Tente novamente em instantes.');
      toast.error('Erro ao chamar a IA. Verifique sua conexão.');
    } finally {
      setIsLoadingCustom(false);
    }
  };

  const categories = ['Todos', 'Desenvolvimento', 'Rotina', 'Tecnologia'];
  const filteredArticles = activeCategory === 'Todos' 
    ? FALLBACK_ARTICLES 
    : FALLBACK_ARTICLES.filter(a => a.category === activeCategory);

  const daysUntilRefresh = aiArticle 
    ? Math.max(0, Math.ceil((FIVE_DAYS_MS - (Date.now() - parseInt(aiArticle.generatedAt))) / (24 * 60 * 60 * 1000)))
    : 0;

  return (
    <div className="space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-500 pb-20">
      {/* Header */}
      <header className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-special-500">
            <BrainCircuit size={20} className="stroke-[3]" />
            <span className="text-xs font-black uppercase tracking-[0.2em]">Guia para a Família</span>
          </div>
          <h1 className="text-4xl font-black text-slate-800 tracking-tight leading-none">Dicas e <span className="text-special-600">Estratégias</span></h1>
          <p className="text-slate-500 font-medium">Artigos gerados pela IA e curados por especialistas para ajudar no desenvolvimento do seu filho.</p>
        </div>
      </header>

      {/* AI Featured Article */}
      <Card className="p-0 overflow-hidden border-2 border-special-100 rounded-[2.5rem] shadow-xl">
        <div className="bg-gradient-to-br from-special-600 to-primary-700 p-8 text-white relative overflow-hidden">
          <div className="absolute top-0 right-0 w-60 h-60 bg-white/5 rounded-full blur-3xl -mr-10 -mt-10" />
          <div className="relative z-10 flex items-center gap-4 mb-6">
            <div className="w-14 h-14 bg-white/20 backdrop-blur-md rounded-2xl flex items-center justify-center border border-white/30">
              <Sparkles size={28} className="text-white" />
            </div>
            <div>
              <div className="text-[10px] font-black uppercase tracking-widest text-white/60">Artigo da Semana — Gerado por IA</div>
              <div className="text-xl font-black text-white">Leitura Recomendada</div>
            </div>
            <div className="ml-auto flex items-center gap-2">
              {daysUntilRefresh > 0 && (
                <div className="text-[10px] font-bold text-white/50 flex items-center gap-1">
                  <Clock size={12} /> Renova em {daysUntilRefresh}d
                </div>
              )}
              <button
                onClick={handleRefreshArticle}
                disabled={isLoadingArticle}
                className="p-2 bg-white/10 rounded-xl hover:bg-white/20 transition-colors border border-white/20 text-white"
              >
                <RefreshCw size={16} className={isLoadingArticle ? 'animate-spin' : ''} />
              </button>
            </div>
          </div>
          
          <div className="relative z-10">
            {isLoadingArticle ? (
              <div className="flex items-center gap-3 text-white/70">
                <Loader2 size={20} className="animate-spin" />
                <span className="font-medium">A IA está gerando um artigo personalizado para você...</span>
              </div>
            ) : (
              <p className="text-white/90 text-base font-medium leading-relaxed">
                {aiArticle?.content || ''}
              </p>
            )}
          </div>
        </div>
        
        <div className="p-6 bg-white flex items-center justify-between">
          <div className="flex items-center gap-2 text-[10px] font-black uppercase text-slate-400 tracking-widest">
            <Bot size={14} className="text-special-400" /> Gerado por Gemini AI
          </div>
          <Badge variant="ai">Exclusivo para Famílias Impacto IA</Badge>
        </div>
      </Card>

      {/* AI Custom Query Section */}
      <div ref={customRef} className="bg-gradient-to-br from-slate-900 to-slate-800 rounded-[2.5rem] p-8 space-y-6">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 bg-white/10 rounded-2xl flex items-center justify-center border border-white/20">
            <MessageCircle size={28} className="text-primary-400" />
          </div>
          <div>
            <h2 className="text-xl font-black text-white">Pergunte à IA Parental</h2>
            <p className="text-slate-400 text-sm font-medium">Digite qualquer assunto sobre educação ou cuidados com filhos</p>
          </div>
        </div>

        <div className="flex gap-3">
          <input
            type="text"
            value={customSubject}
            onChange={e => setCustomSubject(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleCustomQuery()}
            placeholder="Ex: como ajudar meu filho com dificuldades em matemática..."
            className="flex-1 bg-white/10 border border-white/20 rounded-2xl px-6 py-4 text-white placeholder:text-slate-500 font-medium focus:outline-none focus:border-primary-400 focus:bg-white/15 transition-all"
          />
          <button
            onClick={handleCustomQuery}
            disabled={isLoadingCustom || !customSubject.trim()}
            className="px-6 py-4 bg-primary-500 hover:bg-primary-600 disabled:bg-slate-700 disabled:cursor-not-allowed text-white rounded-2xl font-black transition-all flex items-center gap-2 shadow-lg shadow-primary-500/20"
          >
            {isLoadingCustom ? <Loader2 size={20} className="animate-spin" /> : <Send size={20} />}
            Gerar
          </button>
        </div>

        {/* Suggestions */}
        <div className="flex flex-wrap gap-2">
          {['Como reduzir o estresse do meu filho', 'Técnicas de concentração', 'Alimentação e aprendizado', 'Bullying na escola'].map(s => (
            <button key={s} onClick={() => setCustomSubject(s)}
              className="text-[11px] font-bold px-4 py-2 bg-white/5 text-slate-400 hover:bg-white/10 hover:text-white rounded-full border border-white/10 transition-all">
              {s}
            </button>
          ))}
        </div>

        {(isLoadingCustom || customContent) && (
          <div className="bg-white/10 backdrop-blur-sm border border-white/20 rounded-2xl p-6">
            <div className="flex items-center gap-2 mb-3 text-[10px] font-black uppercase text-primary-400 tracking-widest">
              <Bot size={14} /> Resposta da IA sobre: "{customSubject}"
            </div>
            {isLoadingCustom ? (
              <div className="flex items-center gap-3 text-white/60">
                <Loader2 size={16} className="animate-spin" />
                <span className="font-medium text-sm">Gerando conteúdo personalizado...</span>
              </div>
            ) : (
              <p className="text-white/90 font-medium leading-relaxed text-sm whitespace-pre-wrap">{customContent}</p>
            )}
          </div>
        )}
      </div>

      {/* Curated Articles */}
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <h2 className="text-2xl font-black text-slate-800 flex items-center gap-3">
            <BookOpen className="text-primary-500" size={28} /> Artigos Curados
          </h2>
          <div className="flex gap-2 overflow-x-auto pb-1">
            {categories.map(cat => (
              <button
                key={cat}
                onClick={() => setActiveCategory(cat)}
                className={cn(
                  "px-5 py-2 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all whitespace-nowrap",
                  activeCategory === cat ? "bg-slate-900 text-white shadow-lg" : "bg-white border border-slate-100 text-slate-500 hover:border-primary-200"
                )}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {filteredArticles.map((article, i) => (
            <Card
              key={i}
              onClick={() => setSelectedArticle(selectedArticle?.title === article.title ? null : article)}
              className="p-0 overflow-hidden border-2 border-slate-50 hover:border-primary-100 hover:shadow-xl cursor-pointer transition-all duration-500 group rounded-[2rem]"
            >
              <div className="p-8 bg-slate-50 flex items-center justify-center text-5xl h-36 group-hover:bg-primary-50 transition-colors">
                {article.emoji}
              </div>
              <div className="p-6 space-y-3">
                <div className="flex items-center justify-between">
                  <Badge variant="primary">{article.category}</Badge>
                  <div className="text-[10px] font-black text-slate-400 uppercase flex items-center gap-1">
                    <Clock size={10} /> {article.readTime}
                  </div>
                </div>
                <h3 className="font-black text-slate-800 leading-tight group-hover:text-primary-600 transition-colors">{article.title}</h3>
                
                {selectedArticle?.title === article.title ? (
                  <p className="text-sm text-slate-600 font-medium leading-relaxed">{article.content}</p>
                ) : (
                  <p className="text-sm text-slate-400 line-clamp-2 font-medium">{article.content}</p>
                )}

                <div className="pt-2 flex items-center gap-1 text-primary-600 font-black text-xs">
                  {selectedArticle?.title === article.title ? 'Fechar' : 'Ler artigo'} <ChevronRight size={14} className="group-hover:translate-x-1 transition-transform" />
                </div>
              </div>
            </Card>
          ))}
        </div>
      </div>

      {/* Tips Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {[
          { icon: '🧠', title: 'Estimule a Metacognição', tip: 'Pergunte ao seu filho "Como você aprendeu isso?" em vez de "Qual foi a nota?". Estimular a reflexão sobre o próprio aprendizado aumenta a autonomia.', color: 'from-purple-500 to-indigo-600' },
          { icon: '💬', title: 'A Conversa do Jantar', tip: 'Pesquisas mostram que famílias que conversam sobre o dia de estudo durante refeições têm filhos com vocabulário 50% maior. Faça perguntas abertas!', color: 'from-emerald-500 to-teal-600' },
          { icon: '🎮', title: 'Gamificação em Casa', tip: 'Crie desafios familiares pequenos: "Quem lembra de 3 coisas que aprendeu hoje?". A competição saudável ativa o sistema de recompensa do cérebro.', color: 'from-orange-500 to-amber-600' },
          { icon: '🌙', title: 'Sono e Desempenho', tip: 'Crianças de 6-12 anos precisam de 9-11h de sono. Durante o sono, o cérebro consolida tudo que foi aprendido no dia. Desligue as telas 1h antes de dormir.', color: 'from-blue-500 to-cyan-600' },
        ].map((item, i) => (
          <div key={i} className={`bg-gradient-to-br ${item.color} rounded-[2rem] p-7 text-white flex items-start gap-5 shadow-lg`}>
            <div className="w-14 h-14 bg-white/20 rounded-2xl flex items-center justify-center text-3xl flex-shrink-0 border border-white/30">
              {item.icon}
            </div>
            <div>
              <h3 className="font-black text-lg mb-2">{item.title}</h3>
              <p className="text-white/85 text-sm font-medium leading-relaxed">{item.tip}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
