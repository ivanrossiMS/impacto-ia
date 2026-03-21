import React, { useEffect, useState } from 'react';
import { useAuthStore } from '../../store/auth.store';
import { useAvatarStore } from '../../store/avatar.store';
import { 
  ShoppingBag, 
  Wallet, 
  ShoppingCart, 
  CheckCircle2, 
  Star,
  Sparkles
} from 'lucide-react';

import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { cn } from '../../lib/utils';
import { toast } from 'sonner';
import { db } from '../../lib/dexie';
import { incrementMissionProgress } from '../../lib/missionUtils';
import type { GamificationStats } from '../../types/gamification';
import type { AvatarCatalogItem } from '../../types/avatar';

export const AvatarStore: React.FC = () => {
  const user = useAuthStore(state => state.user);
  const { catalog, ownedItems, fetchCatalog, fetchOwnedItems, buyItem, isLoading } = useAvatarStore();
  const [activeCategory, setActiveCategory] = useState<string>('all');
  const [stats, setStats] = useState<GamificationStats | null>(null);

  useEffect(() => {
    if (user) {
      fetchCatalog();
      fetchOwnedItems(user.id);
      loadStats();
      incrementMissionProgress(user.id, 'store_visit', 1);
    }
  }, [user, fetchCatalog, fetchOwnedItems]);

  const loadStats = async () => {
    if (user) {
      const s = await db.gamificationStats.get(user.id);
      if (s) setStats(s);
    }
  };

  const handlePurchase = async (item: AvatarCatalogItem) => {
    if (!user) return;
    try {
      await buyItem(user.id, item);
      toast.success(`${item.name} desbloqueado! Aproveite! ✨`);
      loadStats(); // Update coins locally
    } catch (error: any) {
      toast.error(error.message || 'Erro ao comprar item.');
    }
  };

  const categories = [
    { id: 'all', label: 'Todos', icon: ShoppingBag },
    { id: 'avatar', label: 'Capivaras', icon: Star },
    { id: 'background', label: 'Fundos', icon: Wallet },
    { id: 'border', label: 'Bordas', icon: Sparkles },
    { id: 'sticker', label: 'Stickers', icon: ShoppingCart },
  ];

  const filteredItems = activeCategory === 'all' 
    ? catalog 
    : catalog.filter(i => i.type === activeCategory);

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-4">
        <div className="w-12 h-12 border-4 border-warning-100 border-t-warning-500 rounded-full animate-spin" />
        <p className="font-black text-warning-500 animate-pulse">Abrindo a Loja...</p>
      </div>
    );
  }

  const coins = stats?.coins ?? 0;

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h1 className="text-5xl font-black text-slate-800 flex items-center gap-5">
             <div className="w-16 h-16 bg-gradient-to-br from-warning-400 to-warning-600 text-white rounded-3xl flex items-center justify-center shadow-premium animate-float">
                <ShoppingBag size={32} />
             </div>
             <span className="text-gradient">Loja de Itens</span>
          </h1>
          <p className="text-slate-500 font-bold mt-2 text-lg">Colecione itens raros e deixe seu perfil incrível! ✨</p>
        </div>
        
        <div className="flex items-center gap-4">
          <Card className="px-8 py-4 flex items-center gap-4 glass-card border-warning-200/50 shadow-premium">
            <span className="text-3xl animate-bounce">🪙</span>
            <div>
              <span className="block text-[11px] font-black uppercase text-warning-600 leading-none tracking-widest">Minhas Moedas</span>
              <span className="text-3xl font-black text-slate-800">{coins}</span>
            </div>
          </Card>
        </div>
      </header>

      <div className="flex flex-col lg:flex-row gap-8">
        {/* Sidebar Filters */}
        <aside className="lg:w-72 space-y-4">
          <div className="sticky top-24 space-y-4">
            <h3 className="font-black text-slate-400 uppercase tracking-widest text-xs ml-4">Categorias</h3>
            <div className="flex flex-col gap-2">
              {categories.map(cat => (
                <button
                  key={cat.id}
                  onClick={() => setActiveCategory(cat.id)}
                  className={cn(
                    "flex items-center gap-4 px-6 py-4 rounded-2xl font-black transition-all",
                    activeCategory === cat.id 
                      ? "bg-primary-600 text-white shadow-card translate-x-1" 
                      : "bg-surface text-slate-500 hover:bg-slate-50 hover:text-slate-800 border border-slate-100"
                  )}
                >
                  <cat.icon size={20} />
                  {cat.label}
                </button>
              ))}
            </div>
          </div>
        </aside>

        {/* Catalog */}
        <div className="flex-1">
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-6">
            {filteredItems.map(item => {
              const isOwned = ownedItems.some(oi => oi.catalogItemId === item.id);
              const canAfford = coins >= item.priceCoins;
              
              return (
                <Card 
                  key={item.id}
                  className={cn(
                    "flex flex-col p-6 group transition-all duration-300 relative",
                    isOwned ? "bg-slate-50 opacity-80" : "hover:-translate-y-2 hover:shadow-floating"
                  )}
                >
                  {/* Rarity Badge */}
                  <div className="absolute top-4 left-4 z-10">
                    <Badge variant={item.rarity === 'lendário' ? 'ai' : item.rarity === 'raro' ? 'energy' : 'primary'}>
                      {item.rarity}
                    </Badge>
                  </div>


                  {/* Asset Preview */}
                  <div className="aspect-square bg-slate-50 rounded-2xl mb-6 flex items-center justify-center p-4 relative overflow-hidden shadow-inner group-hover:bg-white transition-colors border-2 border-slate-100">
                    <img 
                      src={item.assetUrl} 
                      className={cn(
                        "w-full h-full object-contain drop-shadow-2xl transition-transform duration-500 group-hover:scale-110",
                        activeCategory === 'background' ? "rounded-2xl" : "avatar-blend"
                      )} 
                      alt={item.name} 
                    />
                    {item.priceCoins === 0 && !isOwned && (
                      <div className="absolute top-2 right-2 bg-success-500 text-white px-2 py-1 rounded-lg text-[10px] font-black uppercase">Grátis!</div>
                    )}
                  </div>

                  <div className="space-y-2 mb-6 flex-1">
                    <h4 className="font-black text-slate-800 text-xl tracking-tight">{item.name}</h4>
                    <p className="text-slate-400 text-sm font-medium line-clamp-2">{item.description}</p>
                  </div>

                  <Button
                    disabled={isOwned || !canAfford}
                    onClick={() => handlePurchase(item)}
                    variant={isOwned ? 'ghost' : canAfford ? 'primary' : 'outline'}
                    className="w-full h-14 rounded-2xl gap-2 font-black uppercase tracking-widest text-xs"
                  >
                    {isOwned ? (
                      <><CheckCircle2 size={18} /> Já é seu!</>
                    ) : (
                      <>
                        <span className="text-xl">🪙</span> {item.priceCoins}
                      </>
                    )}
                  </Button>
                </Card>
              );
            })}
          </div>

          {filteredItems.length === 0 && (
            <div className="text-center py-40 space-y-6">
              <div className="bg-slate-100 w-24 h-24 rounded-full flex items-center justify-center mx-auto text-slate-400">
                <ShoppingCart size={48} />
              </div>
              <div>
                <h3 className="text-2xl font-black text-slate-700">Nada por aqui hoje!</h3>
                <p className="text-slate-400 font-bold">Volte em breve para novos itens.</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
