import React, { useState } from 'react';
import { Card } from '../../components/ui/Card';
import { Bell, Shield, Globe, Database, Save } from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { toast } from 'sonner';

export const Settings: React.FC = () => {
  const [settings, setSettings] = useState([
    { id: 'portal', icon: Globe, label: 'Portal Público', desc: 'Ativar/Desativar acesso à página inicial e blog.', status: true },
    { id: 'notifications', icon: Bell, label: 'Notificações Globais', desc: 'Alertas críticos enviados para todos os usuários.', status: true },
    { id: 'security', icon: Shield, label: 'Segurança Estrita', desc: 'Forçar renovação de senha a cada 90 dias.', status: false },
    { id: 'backup', icon: Database, label: 'Backup Automático', desc: 'Sincronização diária com o servidor de contingência.', status: true },
  ]);

  const toggleSetting = (id: string) => {
    setSettings(prev => prev.map(s => s.id === id ? { ...s, status: !s.status } : s));
  };

  const handleSave = () => {
    toast.success('Configurações salvas com sucesso!');
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8 pb-10">
      <header className="flex justify-between items-end">
        <div>
          <h1 className="text-3xl font-black text-slate-800 tracking-tight">Configurações do Sistema</h1>
          <p className="text-slate-500 font-medium">Ajustes globais da plataforma Impacto IA.</p>
        </div>
        <Button onClick={handleSave} variant="primary" className="rounded-xl gap-2 font-black px-6 shadow-lg shadow-primary-500/20">
          <Save size={20} /> Salvar Tudo
        </Button>
      </header>

      <div className="space-y-6">
        {settings.map((s, i) => (
          <Card key={i} className="p-6 border-slate-100 flex items-center justify-between hover:border-slate-200 transition-all group">
            <div className="flex items-center gap-5">
              <div className={`w-14 h-14 rounded-2xl flex items-center justify-center transition-colors ${s.status ? 'bg-primary-50 text-primary-500 border border-primary-100' : 'bg-slate-50 text-slate-400 border border-slate-100'}`}>
                <s.icon size={28} />
              </div>
              <div>
                <h3 className="text-lg font-black text-slate-800 leading-tight">{s.label}</h3>
                <p className="text-sm text-slate-500 font-medium mt-0.5">{s.desc}</p>
              </div>
            </div>
            <button 
              onClick={() => toggleSetting(s.id)}
              className={`w-14 h-7 rounded-full transition-all relative ${s.status ? 'bg-primary-500 shadow-lg shadow-primary-500/20' : 'bg-slate-200'}`}
            >
              <div className={`absolute top-1 w-5 h-5 bg-white rounded-full transition-all shadow-sm ${s.status ? 'translate-x-8' : 'translate-x-1'}`}></div>
            </button>
          </Card>
        ))}
      </div>
    </div>
  );
};
