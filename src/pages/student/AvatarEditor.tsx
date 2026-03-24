import React, { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import type { AvatarProfile, AvatarLayer, AvatarLayerType } from '../../types/avatar';
import { useAuthStore } from '../../store/auth.store';
import { AvatarComposer as AvatarPreview } from '../../features/avatar/components/AvatarComposer';
import { Sparkles, Save, Undo2, Palette, Shirt, User, Footprints, Image as ImageIcon, Star } from 'lucide-react';
import { cn } from '../../lib/utils';
import { toast } from 'sonner';


export const AvatarEditor: React.FC = () => {
  const user = useAuthStore(state => state.user);
  const [profile, setProfile] = useState<AvatarProfile | null>(null);
  const [initialProfile, setInitialProfile] = useState<AvatarProfile | null>(null);

  const [activeCategory, setActiveCategory] = useState<AvatarLayerType>('hair');
  const [fullCatalog, setFullCatalog] = useState<AvatarLayer[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadAvatarData = async () => {
      if (!user) return;
      let { data: p } = await supabase.from('student_avatar_profiles').select('*').eq('studentId', user.id).single();
      if (!p) {
        // Create default empty profile for this user
        const now = new Date().toISOString();
        const defaultProfile = {
          studentId: user.id,
          selectedAvatarId: null,
          selectedBackgroundId: null,
          selectedBorderId: null,
          equippedStickerIds: [],
          equippedItems: {},
          updatedAt: now
        } as any;
        const { data: insertedP } = await supabase.from('student_avatar_profiles').insert(defaultProfile).select().single();
        p = insertedP;
      }
      setProfile({ ...(p as AvatarProfile) });
      setInitialProfile({ ...(p as AvatarProfile) });

      setLoading(false);
    };

    loadAvatarData();
  }, [user]);

  useEffect(() => {
    const fetchCatalog = async () => {
      const { data: items } = await supabase.rpc('get_avatar_catalog');
      setFullCatalog((items || []) as AvatarLayer[]);
    };

    fetchCatalog();
  }, []);

  const handleEquip = (layerId: string) => {
    if (!profile) return;
    
    let updates: Partial<AvatarProfile> = {};
    if (activeCategory === 'base') updates.selectedAvatarId = layerId;
    if (activeCategory === 'background') updates.selectedBackgroundId = layerId;
    // We don't have border in categories here, but mapping accessory or others to sticklers etc could be done
    // For now we map main fields
    setProfile({
      ...profile,
      ...updates,
      equippedItems: {
        ...(profile.equippedItems || {}),
        [activeCategory]: layerId
      }
    });

  };

  const handleSave = async () => {
    if (!profile || !user) return;
    try {
      const cleanProfile = { ...profile } as any;
      if (!cleanProfile.selectedAvatarId) cleanProfile.selectedAvatarId = null;
      if (!cleanProfile.selectedBackgroundId) cleanProfile.selectedBackgroundId = null;
      if (!cleanProfile.selectedBorderId) cleanProfile.selectedBorderId = null;

      await supabase.from('student_avatar_profiles').upsert(cleanProfile, { onConflict: 'studentId' });
      setInitialProfile({ ...profile });

      toast.success('Visual salvo com sucesso!');
    } catch (error) {
      toast.error('Erro ao salvar avatar.');
    }
  };

  const handleReset = () => {
    if (initialProfile) {
      setProfile({ ...initialProfile });
      toast.info('Alterações descartadas.');
    }
  };

  if (loading || !profile) return <div className="p-20 text-center text-primary-500 animate-pulse font-bold">Carregando seu estilo...</div>;

  const categories: { type: AvatarLayerType; label: string; icon: any }[] = [
    { type: 'base', label: 'Corpo', icon: User },
    { type: 'hair', label: 'Cabelo', icon: Palette },
    { type: 'clothes', label: 'Roupa', icon: Shirt },
    { type: 'shoes', label: 'Calçado', icon: Footprints },
    { type: 'accessory', label: 'Acessório', icon: Star },
    { type: 'background', label: 'Fundo', icon: ImageIcon },
  ];

  const isChanged = JSON.stringify(profile) !== JSON.stringify(initialProfile);

  const availableItems = fullCatalog.filter(item => item.type === activeCategory);

  const activeAvatar = fullCatalog.find(i => i.id === profile?.selectedAvatarId);
  const activeBackground = fullCatalog.find(i => i.id === profile?.selectedBackgroundId);
  const activeBorder = fullCatalog.find(i => i.id === profile?.selectedBorderId);

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-extrabold text-slate-800">Estúdio de Estilo</h1>
          <p className="text-slate-500 font-medium">Crie um visual único para sua jornada!</p>
        </div>
        <div className="flex gap-2">
          {isChanged && (
            <button 
              onClick={handleReset}
              className="flex items-center gap-2 px-6 py-3 rounded-2xl font-bold text-slate-600 bg-white border border-slate-200 hover:bg-slate-50 transition-all"
            >
              <Undo2 size={20} /> Descartar
            </button>
          )}
          <button 
            onClick={handleSave}
            disabled={!isChanged}
            className={cn(
              "flex items-center gap-2 px-8 py-3 rounded-2xl font-bold text-white shadow-card transition-all",
              isChanged ? "bg-primary-600 hover:bg-primary-700 hover:-translate-y-0.5" : "bg-slate-300 cursor-not-allowed"
            )}
          >
            <Save size={20} /> Salvar Visual
          </button>
        </div>
      </header>

      <div className="flex flex-col lg:flex-row gap-8">
        {/* Preview Side */}
        <div className="lg:w-1/3 flex flex-col items-center">
          <div className="sticky top-24 space-y-6 flex flex-col items-center w-full">
            <div className="relative group p-4 bg-white rounded-[3rem] shadow-floating border-4 border-white">
               <AvatarPreview 
                  avatarUrl={activeAvatar?.assetUrl || activeAvatar?.imageUrl || ''} 
                  backgroundUrl={activeBackground?.assetUrl || activeBackground?.imageUrl}
                  borderUrl={activeBorder?.assetUrl || activeBorder?.imageUrl}
                  size="xl" 
               />
               <div className="absolute -bottom-4 -right-4 bg-special-500 text-white p-4 rounded-full shadow-lg animate-bounce">
                  <Sparkles size={24} />
               </div>
            </div>

            
            <div className="w-full bg-surface p-6 rounded-3xl border border-slate-100 shadow-sm">
              <h4 className="font-bold text-slate-700 mb-4 text-center border-b border-slate-50 pb-4">Status do Visual</h4>
              <div className="grid grid-cols-2 gap-4">
                <div className="text-center">
                  <div className="text-[10px] font-black uppercase text-slate-400">Raridade</div>
                  <div className="text-sm font-bold text-special-600">Comum</div>
                </div>
                <div className="text-center border-l border-slate-100">
                  <div className="text-[10px] font-black uppercase text-slate-400">Estilo</div>
                  <div className="text-sm font-bold text-primary-600">Escolar</div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Editor Side */}
        <div className="flex-1 bg-surface rounded-[2.5rem] border border-slate-100 shadow-sm flex flex-col overflow-hidden min-h-[600px]">
          {/* Category Tabs */}
          <div className="flex overflow-x-auto no-scrollbar border-b border-slate-100 p-4 gap-2 bg-slate-50/50">
            {categories.map(cat => (
              <button
                key={cat.type}
                onClick={() => setActiveCategory(cat.type)}
                className={cn(
                  "flex items-center gap-2 px-6 py-3 rounded-2xl font-bold transition-all whitespace-nowrap",
                  activeCategory === cat.type 
                    ? "bg-white text-primary-700 shadow-sm border border-primary-100 ring-1 ring-primary-500/10" 
                    : "text-slate-500 hover:text-slate-700 hover:bg-white"
                )}
              >
                <cat.icon size={20} />
                {cat.label}
              </button>
            ))}
          </div>

          {/* Items Grid */}
          <div className="flex-1 p-8 overflow-y-auto">
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-6">
              {availableItems.map(item => {
                const isEquipped = (profile.equippedItems?.[activeCategory as keyof typeof profile.equippedItems]) === item.id;

                
                return (
                  <button
                    key={item.id}
                    onClick={() => handleEquip(item.id)}
                    className={cn(
                      "group relative aspect-square rounded-3xl border-2 transition-all p-2 flex flex-col items-center justify-center overflow-hidden",
                      isEquipped 
                        ? "border-primary-500 bg-primary-50 shadow-inner" 
                        : "border-slate-100 hover:border-primary-200 hover:bg-slate-50"
                    )}
                  >
                    <div className="w-full h-full bg-white rounded-2xl border border-slate-50 shadow-sm overflow-hidden flex items-center justify-center mb-2">
                       <img src={item.assetUrl || item.imageUrl} alt={item.name} className="w-20 h-20 object-contain group-hover:scale-110 transition-transform" />
                    </div>

                    <span className={cn(
                      "text-[11px] font-bold truncate w-full text-center px-1",
                      isEquipped ? "text-primary-700" : "text-slate-500"
                    )}>
                      {item.name}
                    </span>
                    
                    {isEquipped && (
                      <div className="absolute top-2 right-2 bg-primary-500 text-white p-1 rounded-full shadow-sm">
                        <Save size={12} />
                      </div>
                    )}

                    {item.isPremium && !isEquipped && (
                      <div className="absolute top-2 left-2 bg-warning-400 text-white p-1 rounded-full shadow-sm">
                        <Star size={12} fill="currentColor" />
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
            
            {availableItems.length === 0 && (
              <div className="flex flex-col items-center justify-center h-full text-slate-400 space-y-4 py-20">
                <ImageIcon size={64} className="opacity-20" />
                <p className="font-bold">Nenhum item disponível nesta categoria</p>
                <button className="text-primary-600 font-bold hover:underline">Ir para a Loja</button>
              </div>
            )}
          </div>

          <div className="p-6 bg-slate-50/50 border-t border-slate-100 flex justify-between items-center">
            <div className="text-xs font-bold text-slate-400 uppercase tracking-widest">
              Mostrando {availableItems.length} itens de {activeCategory}
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-slate-500">Dica: Items especiais dão bônus de XP!</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
