import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../store/auth.store';
import { db } from '../../lib/dexie';
import { useLiveQuery } from 'dexie-react-hooks';
import { 
  Trophy, 
  Sword, 
  Clock, 
  History,
  Plus,
  Zap,
  ChevronRight,
  User,
  Medal,
  Play
} from 'lucide-react';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { cn } from '../../lib/utils';
import type { Duel } from '../../types/duel';

export const DuelList: React.FC = () => {
  const navigate = useNavigate();
  const user = useAuthStore(state => state.user);
  const [activeTab, setActiveTab] = useState<'active' | 'pending' | 'history'>('active');

  const duels = useLiveQuery(async () => {
    if (!user) return [];
    return db.duels
      .where('challengerId').equals(user.id)
      .or('challengedId').equals(user.id)
      .reverse()
      .sortBy('createdAt');
  }, [user?.id]) || [];

  const users = useLiveQuery(() => db.users.toArray()) || [];

  const activeDuels = duels.filter(d => 
    d.status === 'active' || 
    (d.status === 'pending' && d.challengerId === user?.id)
  );
  
  const pendingInvitations = duels.filter(d => 
    d.status === 'pending' && d.challengedId === user?.id
  );
  
  const history = duels.filter(d => d.status === 'completed' || d.status === 'expired');

  const getOpponent = (duel: Duel) => {
    const opponentId = duel.challengerId === user?.id ? duel.challengedId : duel.challengerId;
    return users.find(u => u.id === opponentId);
  };

  const getStatusBadge = (duel: Duel) => {
    if (duel.status === 'pending') {
      return <Badge variant="warning" className="animate-pulse">Aguardando Aceite</Badge>;
    }
    if (duel.status === 'active') {
      const myTurn = (duel.challengerId === user?.id && !duel.challengerTurnCompleted) ||
                     (duel.challengedId === user?.id && !duel.challengedTurnCompleted);
      return myTurn ? <Badge variant="primary">Sua Vez!</Badge> : <Badge variant="outline">Turno do Oponente</Badge>;
    }
    if (duel.status === 'completed') {
      const iWon = duel.winnerId === user?.id;
      const draw = duel.winnerId === 'draw';
      return draw ? <Badge variant="primary">Empate</Badge> : 
             iWon ? <Badge variant="success">Vitória</Badge> : 
                    <Badge variant="energy">Derrota</Badge>;
    }
    return <Badge variant="outline">Expirado</Badge>;
  };

  const DuelCard = ({ duel }: { duel: Duel }) => {
    const opponent = getOpponent(duel);
    const myScore = duel.challengerId === user?.id ? duel.challengerScore : duel.challengedScore;
    const oppScore = duel.challengerId === user?.id ? duel.challengedScore : duel.challengerScore;
    const canPlay = duel.status === 'active' && (
      (duel.challengerId === user?.id && !duel.challengerTurnCompleted) ||
      (duel.challengedId === user?.id && !duel.challengedTurnCompleted)
    );

    return (
      <Card className="p-6 hover:shadow-floating transition-all border-slate-100 group">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-slate-100 rounded-full flex items-center justify-center text-slate-400 overflow-hidden">
                {opponent?.avatar ? <img src={opponent.avatar} className="w-full h-full object-cover" /> : <User size={24} />}
              </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-black text-slate-800">{opponent?.name || 'Oponente'}</h3>
                {getStatusBadge(duel)}
              </div>
              <p className="text-xs text-slate-400 font-bold uppercase tracking-wider">{duel.theme} · {duel.difficulty}</p>
            </div>
          </div>
          <div className="text-right">
            <div className="text-2xl font-black text-slate-800">{myScore} - {oppScore}</div>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Placar</p>
          </div>
        </div>

        <div className="flex items-center justify-between pt-4 border-t border-slate-50">
          <div className="flex items-center gap-4 text-xs font-bold text-slate-400">
            <div className="flex items-center gap-1">
              <Plus size={14} />
              {duel.questionCount} Questões
            </div>
          </div>
          {canPlay ? (
            <Button size="sm" className="rounded-xl gap-2 font-black shadow-lg shadow-primary-500/20" onClick={() => navigate(`/student/duels/${duel.id}`)}>
              <Play size={16} fill="currentColor" /> Jogar Agora
            </Button>
          ) : duel.status === 'pending' && duel.challengedId === user?.id ? (
            <Button size="sm" variant="ai" className="rounded-xl gap-2 font-black" onClick={() => navigate(`/student/duels/${duel.id}`)}>
              Aceitar Desafio <ChevronRight size={16} />
            </Button>
          ) : (
            <Button variant="ghost" size="sm" className="rounded-xl gap-2 font-bold text-slate-400" onClick={() => navigate(`/student/duels/${duel.id}`)}>
              Ver Detalhes
            </Button>
          )}
        </div>
      </Card>
    );
  };

  // Calculate Stats
  const totalWins = history.filter(d => d.winnerId === user?.id).length;
  const totalXp = history.reduce((acc, d) => {
    if (d.status !== 'completed') return acc;
    const isWinner = d.winnerId === user?.id;
    const isDraw = d.winnerId === 'draw';
    const myScore = d.challengerId === user?.id ? (d.challengerScore || 0) : (d.challengedScore || 0);
    const winXp = isWinner ? 50 : isDraw ? 20 : 10;
    return acc + winXp + (myScore * 15);
  }, 0);

  // Real ranking: based on XP among students in the same class
  const classRanking = useLiveQuery(async () => {
    if (!user) return 1;
    
    // 1. Get student's class
    const allClasses = await db.classes.toArray();
    const myClasses = allClasses.filter(c => c.studentIds?.includes(user.id));
    
    let studentIds: string[] = [];
    for (const cls of myClasses) {
      studentIds.push(...(cls.studentIds || []));
    }
    const studentIdSet = new Set([...studentIds, user.id]);
    const finalStudentIds = Array.from(studentIdSet);

    // 2. Load stats for these students
    const statsAll = await db.gamificationStats.where('id').anyOf(finalStudentIds).toArray();
    
    // 3. Sort by XP and find current user's rank
    statsAll.sort((a, b) => b.xp - a.xp);
    const myRank = statsAll.findIndex(s => s.id === user.id) + 1;
    
    return myRank > 0 ? myRank : 1;
  }, [user?.id]) || 1;

  const ranking = classRanking;

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500 pb-10">
      <header className="flex flex-col md:flex-row md:items-end gap-6 justify-between">
        <div>
          <div className="flex items-center gap-2 text-special-500 mb-2">
            <Sword size={20} className="stroke-[3]" />
            <span className="text-[10px] font-black uppercase tracking-[0.2em]">Competição Saudável</span>
          </div>
          <h1 className="text-4xl font-black text-slate-800 leading-none">
            Duelos de <span className="text-special-600">Perguntas</span>
          </h1>
          <p className="text-slate-500 font-medium mt-2">
            Desafie seus colegas e prove quem sabe mais!
          </p>
        </div>
        
        <div className="flex items-center gap-3">
          <Button 
            variant="ghost"
            size="sm"
            className="rounded-full bg-slate-100 text-slate-500 hover:bg-slate-200"
            onClick={() => window.location.reload()}
          >
            <Zap size={18} />
          </Button>
          <Button 
            variant="ai" 
            className="rounded-2xl gap-2 h-14 px-8 font-black shadow-xl shadow-special-500/20"
            onClick={() => navigate('/student/duels/create')}
          >
            <Plus size={20} /> Novo Desafio
          </Button>
        </div>
      </header>

      {/* Stats Summary */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="p-6 bg-gradient-to-br from-primary-500 to-primary-600 text-white border-none shadow-lg shadow-primary-200">
          <Trophy size={24} className="mb-2 opacity-80" />
          <div className="text-3xl font-black">{totalWins}</div>
          <div className="text-xs font-bold uppercase tracking-wider opacity-80">Vitórias Totais</div>
        </Card>
        <Card className="p-6 bg-white border-slate-100">
          <Zap size={24} className="mb-2 text-warning-500" />
          <div className="text-3xl font-black text-slate-800">{totalXp}</div>
          <div className="text-xs font-bold uppercase tracking-wider text-slate-400">XP de Duelo</div>
        </Card>
        <Card className="p-6 bg-white border-slate-100">
          <Medal size={24} className="mb-2 text-special-500" />
          <div className="text-3xl font-black text-slate-800">#{ranking}</div>
          <div className="text-xs font-bold uppercase tracking-wider text-slate-400">Ranking da Turma</div>
        </Card>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 p-1.5 bg-slate-100 rounded-[2rem] w-fit mx-auto md:mx-0">
        {[
          { id: 'active', label: `Ativos (${activeDuels.length})`, icon: Sword },
          { id: 'pending', label: `Convites (${pendingInvitations.length})`, icon: Clock },
          { id: 'history', label: `Histórico`, icon: History },
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={cn(
              'flex items-center gap-2 px-6 py-3 rounded-[1.5rem] text-sm font-black transition-all',
              activeTab === tab.id ? 'bg-white text-special-600 shadow-md' : 'text-slate-500 hover:text-slate-700'
            )}
          >
            <tab.icon size={16} />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {activeTab === 'active' && (
          activeDuels.length === 0 ? (
            <div className="col-span-full py-16 text-center bg-white rounded-[2.5rem] border-2 border-dashed border-slate-100 shadow-sm">
              <div className="w-20 h-20 bg-slate-50 rounded-3xl flex items-center justify-center text-slate-300 mx-auto mb-6">
                <Sword size={40} />
              </div>
              <h3 className="text-xl font-black text-slate-800 mb-2">Nenhum duelo ativo</h3>
              <p className="text-slate-400 font-bold mb-8 max-w-xs mx-auto">Que tal desafiar um colega de turma agora mesmo?</p>
              <Button 
                variant="ai" 
                className="rounded-2xl h-14 px-8 font-black gap-2 shadow-xl shadow-special-500/20"
                onClick={() => navigate('/student/duels/create')}
              >
                <Plus size={20} /> Novo Desafio
              </Button>
            </div>
          ) : (
            activeDuels.map(d => <DuelCard key={d.id} duel={d} />)
          )
        )}
        
        {activeTab === 'pending' && (
          pendingInvitations.length === 0 ? (
            <div className="col-span-full py-16 text-center bg-white rounded-[2.5rem] border-2 border-dashed border-slate-100 shadow-sm">
              <div className="w-20 h-20 bg-slate-50 rounded-3xl flex items-center justify-center text-slate-300 mx-auto mb-6">
                <Clock size={40} />
              </div>
              <h3 className="text-xl font-black text-slate-800 mb-2">Nenhum convite pendente</h3>
              <p className="text-slate-400 font-bold mb-8 max-w-xs mx-auto">Seus amigos estão quietos... Por que você não começa?</p>
              <Button 
                variant="primary" 
                className="rounded-2xl h-14 px-8 font-black gap-2 shadow-xl shadow-primary-500/20"
                onClick={() => navigate('/student/duels/create')}
              >
                <Plus size={20} /> Criar Desafio
              </Button>
            </div>
          ) : (
            pendingInvitations.map(d => <DuelCard key={d.id} duel={d} />)
          )
        )}

        {activeTab === 'history' && (
          history.length === 0 ? (
            <div className="col-span-full py-16 text-center bg-white rounded-[2.5rem] border-2 border-dashed border-slate-100 shadow-sm">
              <div className="w-20 h-20 bg-slate-50 rounded-3xl flex items-center justify-center text-slate-300 mx-auto mb-6">
                <History size={40} />
              </div>
              <h3 className="text-xl font-black text-slate-800 mb-2">Sem histórico</h3>
              <p className="text-slate-400 font-bold mb-8 max-w-xs mx-auto">Complete seu primeiro duelo para ver suas conquistas aqui!</p>
              <Button 
                variant="outline" 
                className="rounded-2xl h-14 px-8 font-black border-2"
                onClick={() => navigate('/student/duels/create')}
              >
                Iniciar Primeiro Duelo
              </Button>
            </div>
          ) : (
            history.map(d => <DuelCard key={d.id} duel={d} />)
          )
        )}
      </div>
    </div>
  );
};
