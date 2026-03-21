import React, { useState, useEffect } from 'react';
import { Server, Activity, Shield, AlertCircle, Search, Download, Terminal } from 'lucide-react';
import { Card } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { cn } from '../../lib/utils';

interface LogEntry {
  id: string;
  timestamp: string;
  level: 'info' | 'warning' | 'error' | 'critical';
  service: string;
  message: string;
  userId?: string;
}

export const System: React.FC = () => {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [filter, setFilter] = useState('all');

  useEffect(() => {
    const services = ['AuthService', 'AISocraticEngine', 'DexieSync', 'NotificationService', 'MediaStorage'];
    const messages = [
      'Token de sessão renovado para usuário',
      'Processamento de consulta socrática concluído (24ms)',
      'Sincronização de progresso do aluno bem-sucedida',
      'Notificação push enviada para dispositivo',
      'Novo avatar item carregado no cache global',
      'Tentativa de login bloqueada por IP suspeito',
      'Latência detectada no nó de processamento sul',
    ];

    const initialLogs: LogEntry[] = Array.from({ length: 20 }).map((_, i) => ({
      id: `log-${i}`,
      timestamp: new Date(Date.now() - i * 1000 * 60 * 5).toISOString(),
      level: i % 7 === 0 ? 'warning' : i % 15 === 0 ? 'error' : 'info',
      service: services[Math.floor(Math.random() * services.length)],
      message: messages[Math.floor(Math.random() * messages.length)] + (Math.random() > 0.5 ? ' ID: ' + Math.floor(Math.random() * 1000) : ''),
    }));

    setLogs(initialLogs);

    const interval = setInterval(() => {
      const newLog: LogEntry = {
        id: `log-${Date.now()}`,
        timestamp: new Date().toISOString(),
        level: Math.random() > 0.9 ? 'warning' : Math.random() > 0.98 ? 'error' : 'info',
        service: services[Math.floor(Math.random() * services.length)],
        message: messages[Math.floor(Math.random() * messages.length)],
      };
      setLogs(prev => [newLog, ...prev.slice(0, 49)]);
    }, 3000);

    return () => clearInterval(interval);
  }, []);

  const filteredLogs = logs.filter(log => {
    if (filter === 'all') return true;
    return log.level === filter;
  });

  return (
    <div className="space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <header className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-primary-500">
            <Server size={20} className="stroke-[3]" />
            <span className="text-xs font-black uppercase tracking-[0.2em]">Infraestrutura</span>
          </div>
          <h1 className="text-4xl font-black text-slate-800 tracking-tight leading-none">Status do <span className="text-primary-600">Sistema</span></h1>
          <p className="text-slate-500 font-medium font-outfit">Monitoramento em tempo real dos serviços e logs de segurança.</p>
        </div>
        <div className="flex gap-3">
            <Button variant="outline" className="rounded-2xl gap-2 font-bold px-6">
                <Download size={18} /> Baixar Logs
            </Button>
            <Button variant="primary" className="rounded-2xl gap-2 font-black px-8">
                <Shield size={20} /> Security Scan
            </Button>
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
        <Card className="lg:col-span-1 p-8 space-y-8 bg-slate-900 text-white border-none shadow-2xl">
           <div className="space-y-6">
              <h3 className="text-xs font-black uppercase tracking-widest text-slate-500 flex items-center gap-2">
                <Activity size={14} /> Health Check
              </h3>
              <div className="space-y-4">
                 {[
                   { name: 'API Gateway', status: 'online', latency: '4ms' },
                   { name: 'DB Cluster', status: 'online', latency: '2ms' },
                   { name: 'AI Engine', status: 'online', latency: '24ms' },
                   { name: 'Auth Server', status: 'online', latency: '8ms' },
                 ].map((s, i) => (
                   <div key={i} className="flex items-center justify-between p-4 bg-white/5 rounded-2xl border border-white/5 group hover:bg-white/10 transition-colors">
                      <div className="flex items-center gap-3">
                         <div className="w-2 h-2 rounded-full bg-success-500 shadow-[0_0_8px_rgba(34,197,94,0.5)]"></div>
                         <span className="text-sm font-bold">{s.name}</span>
                      </div>
                      <span className="text-[10px] font-black opacity-50">{s.latency}</span>
                   </div>
                 ))}
              </div>
           </div>

           <div className="pt-8 border-t border-white/10 space-y-6">
              <h3 className="text-xs font-black uppercase tracking-widest text-slate-500 flex items-center gap-2">
                <Terminal size={14} /> Console Control
              </h3>
              <div className="bg-black/50 p-4 rounded-3xl font-mono text-[10px] space-y-2 text-success-500 border border-white/5">
                 <div className="flex items-center gap-2">
                    <span className="text-white opacity-40">$</span> 
                    <span>systemctl status impacto</span>
                 </div>
                 <div className="text-success-400 opacity-80 mt-2">● impacto-core.service - Impacto IA Engine</div>
                 <div className="text-slate-500">Loaded: loaded (/lib/systemd/...)</div>
                 <div className="text-success-500 pt-1">Active: active (running) since Tue...</div>
              </div>
           </div>
        </Card>

        <Card className="lg:col-span-3 p-0 overflow-hidden border-slate-100 flex flex-col h-[700px]">
           <div className="p-8 border-b border-slate-100 bg-slate-50/50 flex flex-col sm:flex-row items-center justify-between gap-6">
              <div className="flex items-center gap-4">
                 <div className="relative">
                    <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input 
                      type="text" 
                      placeholder="Pesquisar nos logs..."
                      className="pl-12 pr-6 py-3 bg-white border border-slate-200 rounded-2xl text-sm font-bold focus:outline-none focus:border-primary-400 w-full sm:w-64 transition-all"
                    />
                 </div>
                 <select 
                   value={filter}
                   onChange={(e) => setFilter(e.target.value)}
                   className="px-6 py-3 bg-white border border-slate-200 rounded-2xl text-sm font-black focus:outline-none focus:border-primary-400 appearance-none cursor-pointer"
                 >
                    <option value="all">TODOS NÍVEIS</option>
                    <option value="info">INFO</option>
                    <option value="warning">WARNING</option>
                    <option value="error">ERROR</option>
                 </select>
              </div>
              <div className="flex items-center gap-3">
                 <Badge variant="primary">50 de 2,4k registros</Badge>
              </div>
           </div>

           <div className="flex-1 overflow-y-auto p-4 space-y-2 font-outfit">
              {filteredLogs.map((log) => (
                <div key={log.id} className="group flex items-start gap-4 p-4 hover:bg-slate-50 rounded-2xl transition-all border border-transparent hover:border-slate-100">
                   <div className={cn(
                     "w-10 h-10 rounded-xl flex items-center justify-center shrink-0 shadow-sm",
                     log.level === 'info' ? "bg-primary-50 text-primary-500" :
                     log.level === 'warning' ? "bg-warning-50 text-warning-600" :
                     "bg-red-50 text-red-600"
                   )}>
                      {log.level === 'info' ? <Activity size={18} /> : 
                       log.level === 'warning' ? <AlertCircle size={18} /> : 
                       <AlertCircle size={18} className="animate-pulse" />}
                   </div>
                   <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-1">
                         <div className="flex items-center gap-2">
                            <span className="text-[10px] font-black uppercase text-slate-400 tracking-widest">{log.service}</span>
                            <span className="w-1 h-1 bg-slate-300 rounded-full"></span>
                            <span className="text-[10px] font-bold text-slate-400">{new Date(log.timestamp).toLocaleTimeString()}</span>
                         </div>
                         {log.level !== 'info' && (
                           <Badge variant={log.level === 'warning' ? 'energy' : 'danger'} className="scale-75 origin-right uppercase">
                              {log.level}
                           </Badge>
                         )}
                      </div>
                      <p className="text-sm font-bold text-slate-700 leading-tight truncate md:whitespace-normal">
                         {log.message}
                      </p>
                   </div>
                </div>
              ))}
           </div>
        </Card>
      </div>
    </div>
  );
};
