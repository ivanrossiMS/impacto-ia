import React, { useState } from 'react';
import { Store, Trophy, Target, Settings, Plus, Sparkles, X, Trash2 } from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { Card } from '../../components/ui/Card';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { toast } from 'sonner';

const itemSchema = z.object({
  name: z.string().min(3, 'Nome deve ter pelo menos 3 caracteres'),
  price: z.number().min(1, 'Preço deve ser maior que 0'),
  type: z.string(),
  reqLevel: z.number().min(1, 'Nível deve ser pelo menos 1'),
});

type ItemFormData = z.infer<typeof itemSchema>;

export const Gamification: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'store' | 'missions' | 'settings'>('store');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [items, setItems] = useState([
    { id: '1', name: 'Boné Descolado', price: 150, type: 'Acessório', reqLevel: 2 },
    { id: '2', name: 'Jaqueta Espacial', price: 300, type: 'Roupa', reqLevel: 5 },
    { id: '3', name: 'Cabelo Roxo', price: 100, type: 'Cabelo', reqLevel: 1 },
    { id: '4', name: 'Fundo Biblioteca', price: 500, type: 'Fundo', reqLevel: 10 },
  ]);

  const { register, handleSubmit, reset, formState: { errors } } = useForm<ItemFormData>({
    resolver: zodResolver(itemSchema),
    defaultValues: { type: 'Acessório', reqLevel: 1 }
  });

  const onSubmit = (data: ItemFormData) => {
    const newItem = { id: Math.random().toString(36).substr(2, 9), ...data };
    setItems([...items, newItem]);
    toast.success('Item adicionado à loja!');
    setIsModalOpen(false);
    reset();
  };

  const removeItem = (id: string) => {
    if (window.confirm('Excluir este item da loja?')) {
      setItems(items.filter(i => i.id !== id));
      toast.success('Item removido.');
    }
  };

  return (
    <div className="space-y-6 animate-fade-in pb-10 max-w-6xl mx-auto">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-extrabold text-slate-800 tracking-tight">Gamificação & Loja</h1>
          <p className="text-slate-500 mt-1 font-medium text-sm">Gerencie itens da loja, missões e recompensas do sistema.</p>
        </div>
        <button 
           onClick={() => setIsModalOpen(true)}
           className="bg-warning-500 hover:bg-warning-600 text-white px-5 py-2.5 rounded-xl font-bold flex items-center gap-2 shadow-sm transition-colors"
        >
          <Plus size={18} />
          <span>Novo Item</span>
        </button>
      </div>

      <div className="flex gap-2 p-1 bg-slate-200/50 rounded-2xl w-fit">
         {['store', 'missions', 'settings'].map((tab) => (
           <button
             key={tab}
             onClick={() => setActiveTab(tab as any)}
             className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-sm transition-all ${activeTab === tab ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
           >
             {tab === 'store' ? <Store size={18} /> : tab === 'missions' ? <Target size={18} /> : <Settings size={18} />}
             {tab === 'store' ? 'Loja' : tab === 'missions' ? 'Missões' : 'XP'}
           </button>
         ))}
      </div>

      {activeTab === 'store' && (
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-6 mt-8">
           {items.map((item) => (
             <div key={item.id} className="bg-white border border-slate-200 rounded-3xl p-5 shadow-sm hover:shadow-hover transition-all group flex flex-col">
                <div className="w-full h-32 bg-slate-50 rounded-2xl mb-4 border border-slate-100 flex items-center justify-center relative overflow-hidden group-hover:bg-primary-50 transition-colors">
                   <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(0,0,0,0.02)_1px,transparent_1px)] bg-[length:10px_10px]"></div>
                   <Store size={40} className="text-slate-300 group-hover:text-primary-300 transform group-hover:scale-110 transition-all duration-300" />
                </div>
                <div className="flex justify-between items-start mb-2">
                   <Badge variant="energy" className="text-[9px] uppercase font-black tracking-wider border-0 bg-slate-100 text-slate-500">{item.type}</Badge>
                   <span className="text-xs font-bold text-slate-400">Nív.{item.reqLevel}</span>
                </div>
                <h3 className="font-extrabold text-slate-800 mb-4">{item.name}</h3>
                
                <div className="mt-auto pt-4 border-t border-slate-100 flex items-center justify-between">
                   <span className="flex items-center gap-1.5 font-black text-warning-500 bg-warning-50 px-3 py-1.5 rounded-xl">
                      <Sparkles size={16} className="fill-warning-500" />
                      {item.price}
                   </span>
                   <button onClick={() => removeItem(item.id)} className="text-slate-400 hover:text-red-500 transition-colors p-2">
                      <Trash2 size={16} />
                   </button>
                </div>
             </div>
           ))}
        </div>
      )}

      {activeTab === 'missions' && (
         <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-8 flex flex-col items-center justify-center min-h-[400px]">
           <Trophy size={64} className="text-slate-200 mb-6" />
           <h2 className="text-2xl font-extrabold text-slate-700 mb-2">Missões em Breve</h2>
           <p className="text-slate-500 font-medium text-center max-w-md">Em breve você poderá gerenciar as missões dinâmicas que engajam os alunos.</p>
         </div>
      )}

      {activeTab === 'settings' && (
         <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-8">
            <h3 className="font-extrabold text-xl text-slate-800 mb-6">Taxas de Recompensa Padrão</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-3xl">
               <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-black uppercase text-slate-400 tracking-widest mb-2">XP Base por Atividade</label>
                    <input type="number" defaultValue={50} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 font-bold text-slate-800 outline-none" />
                  </div>
                  <div>
                    <label className="block text-xs font-black uppercase text-slate-400 tracking-widest mb-2">Impacto Moedas por Acerto</label>
                    <input type="number" defaultValue={20} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 font-bold text-warning-600 outline-none" />
                  </div>
               </div>
               <div className="flex flex-col justify-end">
                  <Button className="w-full rounded-xl py-4 bg-slate-900 text-white font-bold" onClick={() => toast.success('XP salvo!')}>Salvar Taxas</Button>
               </div>
            </div>
         </div>
      )}

      {/* Add Item Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-in fade-in duration-300">
           <div className="bg-white rounded-[2rem] shadow-floating w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-300">
             <div className="p-8 border-b border-slate-100 flex justify-between items-center">
                <h2 className="text-2xl font-black text-slate-800 lg:p-0">Novo Item na Loja</h2>
                <button onClick={() => setIsModalOpen(false)} className="p-2 hover:bg-slate-100 rounded-xl transition-colors">
                   <X size={20} />
                </button>
             </div>
             
             <form onSubmit={handleSubmit(onSubmit)} className="p-8 space-y-6">
                <div>
                   <label className="block text-xs font-black uppercase text-slate-400 tracking-widest mb-2">Nome do Item</label>
                   <input 
                     {...register('name')}
                     className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 font-bold text-slate-800 outline-none focus:ring-2 focus:ring-primary-500/20 transition-all"
                     placeholder="Ex: Espada de Cristal"
                   />
                   {errors.name && <p className="text-xs text-red-500 mt-1 font-bold">{errors.name.message}</p>}
                </div>

                <div className="grid grid-cols-2 gap-4">
                   <div>
                      <label className="block text-xs font-black uppercase text-slate-400 tracking-widest mb-2">Preço (Moedas)</label>
                      <input 
                        type="number"
                        {...register('price', { valueAsNumber: true })}
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 font-bold text-slate-800 outline-none focus:ring-2 focus:ring-primary-500/20 transition-all"
                      />
                      {errors.price && <p className="text-xs text-red-500 mt-1 font-bold">{errors.price.message}</p>}
                   </div>
                   <div>
                      <label className="block text-xs font-black uppercase text-slate-400 tracking-widest mb-2">Nível Mínimo</label>
                      <input 
                        type="number"
                        {...register('reqLevel', { valueAsNumber: true })}
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 font-bold text-slate-800 outline-none focus:ring-2 focus:ring-primary-500/20 transition-all"
                      />
                      {errors.reqLevel && <p className="text-xs text-red-500 mt-1 font-bold">{errors.reqLevel.message}</p>}
                   </div>
                </div>

                <div>
                   <label className="block text-xs font-black uppercase text-slate-400 tracking-widest mb-2">Tipo de Item</label>
                   <select 
                     {...register('type')}
                     className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 font-bold text-slate-800 outline-none focus:ring-2 focus:ring-primary-500/20 transition-all appearance-none"
                   >
                      <option value="Acessório">Acessório</option>
                      <option value="Roupa">Roupa</option>
                      <option value="Cabelo">Cabelo</option>
                      <option value="Fundo">Fundo</option>
                   </select>
                </div>

                <div className="pt-4 flex gap-3">
                   <Button type="button" variant="outline" onClick={() => setIsModalOpen(false)} className="flex-1 rounded-xl py-3.5">Cancelar</Button>
                   <Button type="submit" variant="primary" className="flex-1 rounded-xl py-3.5 shadow-lg shadow-primary-500/20">Adicionar</Button>
                </div>
             </form>
           </div>
        </div>
      )}
    </div>
  );
};
