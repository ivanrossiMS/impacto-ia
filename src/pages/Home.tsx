import { Link, useNavigate } from 'react-router-dom';
import { 
  Bot, Sparkles, Shield, Trophy, Users, 
  Target, ShoppingBag, Sword, LayoutDashboard, 
  BarChart3, Heart, MessageSquare, ChevronRight,
  Star, Zap, Gamepad2, GraduationCap
} from 'lucide-react';
import { motion } from 'framer-motion';
import { cn } from '../lib/utils';

export const Home: React.FC = () => {
  const navigate = useNavigate();
  return (
    <div className="min-h-screen bg-background">
      {/* Navbar Minimal */}
      <nav className="flex items-center justify-between p-6 max-w-7xl mx-auto">
        <div className="flex items-center gap-2 text-primary-700">
          <Sparkles className="text-special-500" />
          <span className="text-2xl font-bold tracking-tight">Impacto IA</span>
        </div>
        <div>
          <Link to="/login" className="bg-primary-600 hover:bg-primary-700 text-white px-6 py-2.5 rounded-full font-medium transition-colors shadow-card inline-block">
            Acessar Plataforma
          </Link>
        </div>
      </nav>

      {/* Hero Section */}
      <main className="max-w-7xl mx-auto px-6 py-20 flex flex-col md:flex-row items-center gap-12">
        <div className="flex-1 space-y-8">
          <div className="inline-block bg-primary-100 text-primary-800 px-4 py-1.5 rounded-full text-sm font-medium mb-4 border border-primary-200 shadow-sm">
            ✨ A educação do futuro, hoje.
          </div>
          <h1 className="text-5xl md:text-7xl font-extrabold text-slate-800 leading-tight">
            Aprenda brincando com <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary-600 to-special-500">Inteligência Artificial</span>
          </h1>
          <p className="text-xl text-slate-600 max-w-2xl leading-relaxed">
            Uma plataforma gamificada com tutor virtual, missões e um sistema de avatar incrível para engajar alunos e conectar escolas e responsáveis.
          </p>
          <div className="flex flex-wrap gap-4 pt-4">
            <Link to="/login" className="bg-primary-600 hover:bg-primary-700 text-white px-8 py-4 rounded-full font-bold text-lg transition-all shadow-card-hover hover:-translate-y-1 inline-flex items-center justify-center">
              Começar Agora
            </Link>
            <button 
              onClick={() => navigate('/login')}
              className="bg-white text-primary-700 border border-primary-200 hover:bg-primary-50 px-8 py-4 rounded-full font-bold text-lg transition-colors shadow-card flex items-center justify-center gap-2"
            >
              <Bot /> Conheça a Capivara IA
            </button>
          </div>
        </div>
        
        <div className="flex-1 relative w-full max-w-lg mx-auto md:max-w-none">
          {/* Decorative Elements */}
          <div className="absolute inset-0 bg-gradient-to-tr from-primary-300 to-special-300 rounded-full blur-[100px] opacity-40"></div>
          
          <div className="relative bg-surface p-8 rounded-[2rem] shadow-floating border-4 border-white transform md:rotate-2 hover:rotate-0 transition-transform duration-500">
            <div className="aspect-square bg-gradient-to-b from-primary-50 to-primary-100 rounded-3xl flex items-center justify-center mb-6 overflow-hidden relative shadow-inner border border-primary-200">
              <motion.img 
                src="/assets/caca.png" 
                alt="Mascote Cacá"
                className="w-full h-full object-contain drop-shadow-xl"
                whileHover={{ 
                  scale: 1.1, 
                  rotate: 5,
                  transition: { type: "spring", stiffness: 300, damping: 10 } 
                }}
              />
              <div className="absolute bottom-6 left-0 right-0 text-center">
                <span className="bg-white/90 backdrop-blur px-6 py-3 rounded-full text-sm font-bold text-slate-700 shadow-lg inline-flex items-center gap-2">
                  <Sparkles size={16} className="text-warning-500" />
                  Olá! Eu sou a Cacá, vamos aprender juntos!!
                </span>
              </div>
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-energy-50 p-5 rounded-2xl text-center border border-energy-100 shadow-sm transition-transform hover:-translate-y-1">
                <div className="w-12 h-12 bg-white rounded-full flex items-center justify-center mx-auto mb-3 shadow-sm">
                  <Trophy className="text-energy-500" size={24} />
                </div>
                <div className="font-bold text-slate-800">Missões Diárias</div>
                <div className="text-xs text-slate-500 mt-1">Ganhe moedas e XP</div>
              </div>
              <div className="bg-success-50 p-5 rounded-2xl text-center border border-success-100 shadow-sm transition-transform hover:-translate-y-1">
                <div className="w-12 h-12 bg-white rounded-full flex items-center justify-center mx-auto mb-3 shadow-sm">
                  <Shield className="text-success-500" size={24} />
                </div>
                <div className="font-bold text-slate-800">Seguro e Local</div>
                <div className="text-xs text-slate-500 mt-1">Ambiente protegido</div>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Features Pillars */}
      <section className="bg-slate-50 py-24 px-6 border-y border-slate-100">
        <div className="max-w-7xl mx-auto text-center mb-16">
          <h2 className="text-3xl md:text-4xl font-black text-slate-800 mb-4">Um Ecossistema Completo</h2>
          <p className="text-slate-600 max-w-2xl mx-auto font-medium">
            Conectamos todos os pilares da educação em uma experiência única, gamificada e impulsionada por IA.
          </p>
        </div>
        
        <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-8">
          {[
            {
              title: "Para Alunos",
              desc: "Aprenda brincando com missões, duelos e um sistema de avatar incrível que recompensa o esforço.",
              icon: <Gamepad2 className="text-primary-500" size={32} />,
              color: "bg-primary-50",
              border: "border-primary-100"
            },
            {
              title: "Para Professores",
              desc: "Acompanhamento em tempo real, geração de trilhas por IA e painéis de desempenho detalhados.",
              icon: <GraduationCap className="text-special-500" size={32} />,
              color: "bg-special-50",
              border: "border-special-100"
            },
            {
              title: "Para Responsáveis",
              desc: "Acompanhe de perto o progresso dos seus filhos com relatórios claros e dicas exclusivas.",
              icon: <Heart className="text-error-500" size={32} />,
              color: "bg-error-50",
              border: "border-error-100"
            }
          ].map((item, idx) => (
            <motion.div 
              key={idx}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: idx * 0.1 }}
              className={cn("p-8 rounded-[2rem] border-2 shadow-sm hover:shadow-xl transition-all group", item.color, item.border)}
            >
              <div className="w-16 h-16 bg-white rounded-2xl flex items-center justify-center mb-6 shadow-sm group-hover:scale-110 transition-transform">
                {item.icon}
              </div>
              <h3 className="text-xl font-black text-slate-800 mb-3">{item.title}</h3>
              <p className="text-slate-600 text-sm leading-relaxed mb-6">{item.desc}</p>
              <Link to="/login" className="text-sm font-black flex items-center gap-1 group-hover:gap-2 transition-all opacity-0 group-hover:opacity-100">
                Saiba mais <ChevronRight size={14} />
              </Link>
            </motion.div>
          ))}
        </div>
      </section>

      {/* Student Journey */}
      <section className="py-24 px-6 overflow-hidden">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center gap-16">
          <div className="flex-1 order-2 md:order-1 relative">
            <div className="absolute inset-0 bg-primary-200 blur-[80px] opacity-30 rounded-full"></div>
            <div className="relative grid grid-cols-2 gap-4">
              <div className="space-y-4">
                <div className="bg-white p-6 rounded-3xl shadow-float-sm border border-slate-100 transform -rotate-2">
                  <ShoppingBag className="text-orange-500 mb-3" />
                  <div className="font-black text-slate-800">Loja de Avatares</div>
                  <div className="text-xs text-slate-500">Troque moedas por acessórios</div>
                </div>
                <div className="bg-white p-6 rounded-3xl shadow-float-sm border border-slate-100 transform rotate-2 translate-x-4">
                  <Sword className="text-red-500 mb-3" />
                  <div className="font-black text-slate-800">Duelos épicos</div>
                  <div className="text-xs text-slate-500">Desafie seus colegas</div>
                </div>
              </div>
              <div className="space-y-4 pt-8">
                <div className="bg-white p-6 rounded-3xl shadow-float-sm border border-slate-100 transform rotate-3">
                  <Target className="text-blue-500 mb-3" />
                  <div className="font-black text-slate-800">Missões Diárias</div>
                  <div className="text-xs text-slate-500">Objetivos que dão XP</div>
                </div>
                <div className="bg-white p-6 rounded-3xl shadow-float-sm border border-slate-100 transform -rotate-1 translate-x-2">
                  <Zap className="text-yellow-500 mb-3" />
                  <div className="font-black text-slate-800">Energia de Craque</div>
                  <div className="text-xs text-slate-500">Potencialize seu aprendizado</div>
                </div>
              </div>
            </div>
          </div>
          <div className="flex-1 order-1 md:order-2 space-y-6 text-center md:text-left">
            <div className="inline-block bg-primary-100 text-primary-800 px-4 py-1.5 rounded-full text-xs font-black uppercase tracking-widest">
              Experiência Gamificada
            </div>
            <h2 className="text-4xl md:text-5xl font-black text-slate-800 leading-tight">
              Transforme o estudo em uma <span className="text-primary-600 italic">jornada incrível</span>
            </h2>
            <p className="text-lg text-slate-600 leading-relaxed">
              O Impacto IA utiliza mecânicas de jogos para manter os alunos motivados. Conquiste insígnias, suba de nível no ranking da turma e personalize seu avatar com itens épicos.
            </p>
            <ul className="space-y-4">
              {[
                "Avatar 100% personalizável",
                "Ranking em tempo real por sala e geral",
                "Desafios de duelo sincronizados com o conteúdo escolar",
                "Recompensas diárias por engajamento"
              ].map((text, i) => (
                <li key={i} className="flex items-center gap-3 font-bold text-slate-700 text-sm justify-center md:justify-start">
                  <div className="w-5 h-5 bg-success-100 rounded-full flex items-center justify-center text-success-600">
                    <Star size={10} fill="currentColor" />
                  </div>
                  {text}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* Teacher/Admin Section */}
      <section className="bg-slate-900 py-32 px-6 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-1/2 h-full bg-primary-600/10 blur-[120px] rounded-full translate-x-1/2"></div>
        <div className="max-w-7xl mx-auto relative z-10">
          <div className="grid grid-cols-1 md:grid-cols-2 items-center gap-16">
            <div className="space-y-8">
              <div className="inline-block bg-primary-500/20 text-primary-300 px-4 py-1.5 rounded-full text-xs font-black uppercase tracking-widest">
                Gestão Inteligente
              </div>
              <h2 className="text-4xl md:text-5xl font-black text-white leading-tight">
                Dados reais para uma <span className="text-primary-400">pedagogia eficiente</span>
              </h2>
              <p className="text-slate-400 text-lg leading-relaxed">
                Nossa IA ajuda professores a criar trilhas personalizadas e identificar lacunas de aprendizado em segundos, permitindo uma intervenção precisa e humanizada.
              </p>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                <div className="bg-slate-800/50 backdrop-blur p-6 rounded-3xl border border-slate-700">
                  <BarChart3 className="text-primary-400 mb-3" size={32} />
                  <h4 className="font-black text-white mb-2">Monitoramento Ativo</h4>
                  <p className="text-slate-400 text-xs">Veja quem está online e quanto tempo gastam em cada atividade.</p>
                </div>
                <div className="bg-slate-800/50 backdrop-blur p-6 rounded-3xl border border-slate-700">
                  <Bot className="text-special-400 mb-3" size={32} />
                  <h4 className="font-black text-white mb-2">Trilhas por IA</h4>
                  <p className="text-slate-400 text-xs">Gere roteiros de estudo adaptativos com um único clique.</p>
                </div>
              </div>
            </div>
            
            <div className="bg-slate-800 p-4 rounded-[2.5rem] shadow-2xl border-x-4 border-slate-700/50">
              <div className="bg-slate-900 rounded-[2rem] p-6 space-y-4">
                <div className="flex items-center justify-between border-b border-slate-800 pb-4">
                  <div className="flex items-center gap-3">
                    <LayoutDashboard className="text-primary-400" size={20} />
                    <span className="text-sm font-black text-white">Dashboard do Professor</span>
                  </div>
                  <div className="flex gap-1.5">
                    <div className="w-2 h-2 rounded-full bg-slate-700"></div>
                    <div className="w-2 h-2 rounded-full bg-slate-700"></div>
                    <div className="w-2 h-2 rounded-full bg-slate-700"></div>
                  </div>
                </div>
                <div className="space-y-3">
                  {[
                    { label: "Engajamento da Turma", val: "94%", color: "bg-primary-500" },
                    { label: "Conteúdos Concluídos", val: "88%", color: "bg-success-500" },
                    { label: "Precisão em Duelos", val: "72%", color: "bg-warning-500" }
                  ].map((stat, i) => (
                    <div key={i} className="bg-slate-800/50 p-4 rounded-2xl">
                      <div className="flex justify-between text-[10px] font-black uppercase text-slate-500 mb-2">
                        <span>{stat.label}</span>
                        <span>{stat.val}</span>
                      </div>
                      <div className="h-1.5 w-full bg-slate-900 rounded-full overflow-hidden">
                        <motion.div 
                          initial={{ width: 0 }}
                          whileInView={{ width: stat.val }}
                          className={cn("h-full rounded-full", stat.color)}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Parents Section */}
      <section className="py-24 px-6 relative overflow-hidden">
        <div className="max-w-7xl mx-auto text-center mb-16 space-y-4">
          <div className="inline-block bg-error-50 text-error-600 px-4 py-1.5 rounded-full text-xs font-black uppercase tracking-widest">
            Conexão que Fortalece
          </div>
          <h2 className="text-4xl md:text-5xl font-black text-slate-800">Pais e Educadores de mãos dadas</h2>
          <p className="text-slate-600 max-w-2xl mx-auto font-medium">
            Entregamos transparência e as ferramentas necessárias para que os responsáveis participem da jornada educacional de forma leve e eficaz.
          </p>
        </div>

        <div className="max-w-4xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-white p-8 rounded-[2.5rem] border-2 border-slate-50 shadow-sm flex gap-6 items-start">
            <div className="p-4 bg-orange-50 rounded-2xl">
              <MessageSquare className="text-orange-500" />
            </div>
            <div>
              <h4 className="font-black text-slate-800 mb-1">Dicas para Pais</h4>
              <p className="text-sm text-slate-600 leading-relaxed">Conselhos pedagógicos semanais baseados no desempenho do aluno.</p>
            </div>
          </div>
          <div className="bg-white p-8 rounded-[2.5rem] border-2 border-slate-50 shadow-sm flex gap-6 items-start">
            <div className="p-4 bg-blue-50 rounded-2xl">
              <Users className="text-blue-500" />
            </div>
            <div>
              <h4 className="font-black text-slate-800 mb-1">Múltiplos Perfis</h4>
              <p className="text-sm text-slate-600 leading-relaxed">Gerencie o progresso de todos os seus filhos em uma única tela.</p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="px-6 py-24">
        <div className="max-w-5xl mx-auto bg-gradient-to-br from-primary-600 to-primary-700 rounded-[3rem] p-12 text-center text-white relative overflow-hidden shadow-2xl">
          <div className="absolute top-0 left-0 w-full h-full opacity-10">
            <div className="absolute top-10 left-10 w-40 h-40 bg-white rounded-full blur-[60px]"></div>
            <div className="absolute bottom-10 right-10 w-60 h-60 bg-white rounded-full blur-[80px]"></div>
          </div>
          
          <div className="relative z-10 space-y-8">
            <h2 className="text-4xl md:text-6xl font-black leading-tight max-w-3xl mx-auto">
              Pronto para transformar a educação na sua escola?
            </h2>
            <p className="text-primary-100 text-lg max-w-xl mx-auto font-medium">
              Junte-se à centenas de alunos, professores e responsáveis que já estão usando o Impacto IA hoje.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 items-center justify-center pt-4">
              <Link to="/login" className="bg-white text-primary-700 hover:bg-primary-50 px-10 py-5 rounded-full font-black text-xl transition-all shadow-xl hover:-translate-y-1 w-full sm:w-auto">
                Acessar Plataforma
              </Link>
              <button 
                onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
                className="bg-primary-500/50 hover:bg-primary-500/70 border-2 border-white/20 px-10 py-5 rounded-full font-black text-xl transition-all w-full sm:w-auto"
              >
                Voltar ao Topo
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 px-6 border-t border-slate-100">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center gap-8">
          <div className="flex items-center gap-2 text-primary-700">
            <Sparkles className="text-special-500" />
            <span className="text-xl font-black tracking-tight uppercase">Impacto IA</span>
          </div>
          
          <div className="flex flex-wrap justify-center gap-8 text-sm font-black text-slate-400 uppercase tracking-widest">
            <button onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })} className="hover:text-primary-600 transition-colors">Início</button>
            <Link to="/login" className="hover:text-primary-600 transition-colors">Sobre</Link>
            <Link to="/login" className="hover:text-primary-600 transition-colors">Termos</Link>
            <Link to="/login" className="hover:text-primary-600 transition-colors">Suporte</Link>
          </div>
          
          <div className="text-xs font-bold text-slate-400">
            © 2026 Impacto IA. Feito com ✨ e Inteligência Artificial.
          </div>
        </div>
      </footer>
    </div>
  );
};
