import React from 'react';
import { 
  Save, Sparkles, User, Palette, Plus
} from 'lucide-react';
import { useAuthStore } from '../../store/auth.store';
import { useAvatarStore } from '../../store/avatar.store';
import { AvatarComposer } from '../../features/avatar/components/AvatarComposer';
import { Button } from '../../components/ui/Button';
import { cn } from '../../lib/utils';
import { toast } from 'sonner';


import { motion, AnimatePresence } from 'framer-motion';

export const AvatarStudio: React.FC = () => {
  const user = useAuthStore(state => state.user);
  const { 
    profile, 
    ownedItems, 
    catalog, 
    fetchProfile, 
    fetchOwnedItems, 
    fetchCatalog, 
    updateProfile,
    isLoading 
  } = useAvatarStore();
  
  const [activeTab, setActiveTab] = React.useState<'avatar' | 'background' | 'border' | 'stickers'>('avatar');

  React.useEffect(() => {
    if (user) {
      fetchProfile(user.id);
      fetchOwnedItems(user.id);
      fetchCatalog();
    }
  }, [user, fetchProfile, fetchOwnedItems, fetchCatalog]);

  const handleSave = async () => {
    if (profile) {
      await updateProfile(profile);
      toast.success('Seu novo visual foi salvo! ✨', {
        description: 'Todos verão sua capivara renovada agora.'
      });
    }
  };

  if (isLoading || !profile) {
    return (
      <div className="flex flex-col items-center justify-center p-20 space-y-4 h-full">
         <div className="w-20 h-20 bg-primary-100 rounded-[2rem] flex items-center justify-center animate-bounce">
            <User size={40} className="text-primary-500" />
         </div>
         <p className="font-black text-primary-600 tracking-widest animate-pulse">PREPARANDO ESTÚDIO...</p>
      </div>
    );
  }

  const filterOwnedByType = (type: 'avatar' | 'background' | 'border' | 'sticker') => {
    const ownedCatalogIds = ownedItems.map(i => i.catalogItemId);
    return catalog.filter(item => item.type === type && ownedCatalogIds.includes(item.id));
  };

  const handleSelect = (itemId: string) => {
    const newProfile = { ...profile };
    if (activeTab === 'avatar') {
      if (itemId) newProfile.selectedAvatarId = itemId;
    }
    if (activeTab === 'background') {
      newProfile.selectedBackgroundId = newProfile.selectedBackgroundId === itemId || !itemId ? undefined : itemId;
    }
    if (activeTab === 'border') {
      newProfile.selectedBorderId = newProfile.selectedBorderId === itemId || !itemId ? undefined : itemId;
    }
    if (activeTab === 'stickers' && itemId) {
      if (newProfile.equippedStickerIds.includes(itemId)) {
        newProfile.equippedStickerIds = newProfile.equippedStickerIds.filter(id => id !== itemId);
      } else if (newProfile.equippedStickerIds.length < 4) {
        newProfile.equippedStickerIds.push(itemId);
      } else {
        toast.error('Limite de 4 stickers atingido!');
        return;
      }
    }
    updateProfile(newProfile);
  };

  const activeAvatar = catalog.find(i => i.id === profile.selectedAvatarId);
  const activeBg = catalog.find(i => i.id === profile.selectedBackgroundId);
  const activeBorder = catalog.find(i => i.id === profile.selectedBorderId);
  const activeStickers = profile.equippedStickerIds
    .map(id => catalog.find(i => i.id === id)?.assetUrl)
    .filter((url): url is string => !!url);

  return (
    <div className="flex flex-col lg:flex-row h-[calc(100vh-120px)] bg-background gap-8 overflow-hidden">
      
      {/* ── LEFT: PREVIEW ── */}
      <motion.div 
        initial={{ opacity: 0, x: -50 }}
        animate={{ opacity: 1, x: 0 }}
        className="lg:w-1/2 flex flex-col h-full"
      >
        <div className="flex-1 flex flex-col items-center justify-center relative overflow-hidden bg-slate-900 rounded-[2rem] shadow-2xl group border-8 border-white">
          <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-10" />
          <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-b from-primary-500/20 to-transparent" />
          
          <motion.div 
            key={profile.selectedAvatarId + profile.selectedBackgroundId}
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1.1, opacity: 1 }}
            transition={{ type: 'spring', damping: 20 }}
            className="relative z-10"
          >
             <div className="absolute -inset-20 bg-primary-500/10 rounded-full blur-[80px] animate-pulse" />
             <AvatarComposer 
                avatarUrl={activeAvatar?.assetUrl || '/avatars/default-capybara.png'}
                backgroundUrl={activeBg?.assetUrl}
                borderUrl={activeBorder?.assetUrl}
                stickerUrls={activeStickers}
                size="2xl"
             />
          </motion.div>

          <div className="absolute bottom-12 flex flex-col items-center gap-6 z-20 w-full px-12">
            <div className="bg-white/10 backdrop-blur-md px-6 py-2 rounded-2xl border border-white/10 shadow-lg mb-2">
                <h1 className="text-2xl font-black text-white flex items-center gap-2 tracking-tight">
                <Sparkles className="text-warning-400 group-hover:rotate-12 transition-transform" /> 
                Seu Visual Premium
                </h1>
            </div>
            <Button variant="ai" size="xl" className="w-full max-w-sm shadow-2xl gap-3 rounded-[1.5rem] py-8 text-xl" onClick={handleSave}>
              <Save size={24} /> Salvar Avatar
            </Button>
          </div>
        </div>
      </motion.div>

      {/* ── RIGHT: EDITOR ── */}
      <motion.div 
        initial={{ opacity: 0, x: 50 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ delay: 0.2 }}
        className="lg:w-1/2 flex flex-col gap-6 overflow-hidden h-full"
      >
        <div className="flex gap-3 p-2 bg-slate-100 rounded-[2rem]">
          {(['avatar', 'background', 'border', 'stickers'] as const).map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={cn(
                "flex-1 py-4 rounded-[1.25rem] font-black text-[10px] uppercase tracking-widest transition-all gap-2 flex flex-col items-center justify-center relative overflow-hidden",
                activeTab === tab 
                  ? "bg-white text-primary-600 shadow-premium scale-[1.05] z-10" 
                  : "text-slate-400 hover:text-slate-600 hover:bg-white/50"
              )}
            >
              <div className={cn(
                  "p-2.5 rounded-xl transition-colors",
                  activeTab === tab ? "bg-primary-50" : "bg-transparent"
              )}>
                {tab === 'avatar' && <User size={20} />}
                {tab === 'background' && <Palette size={20} />}
                {tab === 'border' && <Sparkles size={20} />}
                {tab === 'stickers' && <Plus size={20} />}
              </div>
              {tab === 'stickers' ? 'Adesivos' : tab === 'avatar' ? 'Corpo' : tab === 'background' ? 'Fundo' : 'Bordas'}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto no-scrollbar glass-card rounded-[2rem] p-10 shadow-premium border border-white/50">
          <AnimatePresence mode="wait">
            <motion.div 
                key={activeTab}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                transition={{ duration: 0.2 }}
                className="grid grid-cols-2 sm:grid-cols-3 gap-8"
            >
                {(activeTab === 'background' || activeTab === 'border') && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    onClick={() => handleSelect('')}
                    className={cn(
                      "group relative aspect-square rounded-[2.5rem] border-4 cursor-pointer transition-all flex flex-col items-center justify-center p-6",
                      (activeTab === 'background' ? !profile.selectedBackgroundId : !profile.selectedBorderId)
                        ? "border-primary-500 bg-primary-50/50 shadow-lg scale-105" 
                        : "border-slate-50 bg-slate-50/30 hover:border-primary-200 hover:bg-white hover:shadow-card"
                    )}
                  >
                    <div className="w-12 h-12 rounded-full border-4 border-dashed border-slate-300 flex items-center justify-center text-slate-300">
                      <Plus size={24} />
                    </div>
                    <div className="mt-2 text-[10px] font-black text-slate-400 uppercase">Remover</div>
                  </motion.div>
                )}

                {filterOwnedByType(activeTab === 'stickers' ? 'sticker' : activeTab).map((item, idx) => {
                const isSelected = activeTab === 'stickers' 
                    ? profile.equippedStickerIds.includes(item.id)
                    : (activeTab === 'avatar' ? profile.selectedAvatarId : activeTab === 'background' ? profile.selectedBackgroundId : profile.selectedBorderId) === item.id;

                return (
                    <motion.div
                        key={item.id}
                        initial={{ opacity: 0, scale: 0.8 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ delay: idx * 0.05 }}
                        onClick={() => handleSelect(item.id)}
                        className={cn(
                            "group relative aspect-square rounded-2xl border-4 cursor-pointer transition-all flex flex-col items-center justify-center p-6",
                            isSelected 
                            ? "border-primary-500 bg-primary-50/50 shadow-lg scale-105" 
                            : "border-slate-50 bg-slate-50/30 hover:border-primary-200 hover:bg-white hover:shadow-card"
                        )}
                    >
                        <div className="w-full h-full relative">
                            <img 
                                src={item.assetUrl} 
                                className={cn(
                                "w-full h-full object-contain drop-shadow-2xl group-hover:scale-110 transition-transform duration-500",
                                activeTab === 'background' && "rounded-lg"
                                )} 
                                alt={item.name} 
                            />
                        </div>
                        
                        {isSelected && (
                            <motion.div 
                                layoutId="selection-check"
                                className="absolute -top-3 -right-3 bg-primary-500 text-white p-2 rounded-2xl shadow-xl ring-4 ring-white"
                            >
                                <Sparkles size={16} fill="white" />
                            </motion.div>
                        )}
                        <div className="absolute -bottom-3 left-1/2 -translate-x-1/2 bg-slate-900 text-white text-[9px] font-black uppercase tracking-widest px-3 py-1.5 rounded-full opacity-0 group-hover:opacity-100 transition-all shadow-lg whitespace-nowrap">
                            {item.name}
                        </div>
                    </motion.div>
                );
                })}

                {/* Empty State */}
                {filterOwnedByType(activeTab === 'stickers' ? 'sticker' : activeTab).length === 0 && (
                <div className="col-span-full py-20 text-center space-y-6">
                    <div className="bg-slate-50 w-24 h-24 rounded-[2rem] flex items-center justify-center mx-auto text-slate-300 shadow-inner">
                    <Palette size={48} />
                    </div>
                    <div>
                        <p className="text-slate-400 font-black text-xl tracking-tight">Coleção Vazia</p>
                        <p className="text-slate-400 font-medium text-sm mt-1">Conquiste novos itens na loja!</p>
                    </div>
                    <Button variant="outline" className="rounded-2xl px-10 py-5 font-black border-2" onClick={() => (window.location.href = '/student/store')}>
                        Ir para a Loja 🪙
                    </Button>
                    <div className="pt-4">
                        <button 
                          onClick={async () => {
                            const { seedDatabase } = await import('../../lib/seed');
                            await seedDatabase();
                            window.location.reload();
                          }}
                          className="text-[10px] font-black text-slate-300 hover:text-slate-400 uppercase tracking-tighter"
                        >
                          Recarregar Itens (Dev Only)
                        </button>
                    </div>
                </div>
                )}
            </motion.div>
          </AnimatePresence>
        </div>
      </motion.div>
    </div>
  );
};
