import React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { User, Mail, Save, Camera, Lock, GraduationCap, Zap, Star } from 'lucide-react';
import { useAuthStore } from '../../store/auth.store';
import { supabase } from '../../lib/supabase';
import { cn } from '../../lib/utils';
import { calculateLevel } from '../../lib/gamificationUtils';
import { useAvatarStore } from '../../store/avatar.store';
import { AvatarComposer } from '../../features/avatar/components/AvatarComposer';


const profileSchema = z.object({
  name: z.string().min(3, 'O nome deve ter pelo menos 3 caracteres'),
  email: z.string().min(3, 'O login deve ter pelo menos 3 caracteres'),
  password: z.string().min(6, 'A senha deve ter pelo menos 6 caracteres').optional().or(z.literal('')),
  confirmPassword: z.string().optional().or(z.literal('')),
}).refine((data) => {
  if (data.password && data.password !== data.confirmPassword) {
    return false;
  }
  return true;
}, {
  message: "As senhas não coincidem",
  path: ["confirmPassword"],
});

type ProfileFormData = z.infer<typeof profileSchema>;

export const Profile: React.FC = () => {
  const { user, login } = useAuthStore();
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const [avatarPreview, setAvatarPreview] = React.useState<string | undefined>(user?.avatar || '/avatars/default-impacto.png');

  // liveUser kept for potential future use or removed if unused.
  const [, setLiveUser] = React.useState<any>(null);
  const [myClass, setMyClass] = React.useState<any>(null);
  const [stats, setStats] = React.useState<any>(null);

  const { profile, catalog, fetchProfile, fetchCatalog } = useAvatarStore();

  const fetchProfileData = async () => {
    if (!user) return;
    
    // User
    const { data: u } = await supabase.from('users').select('*').eq('id', user.id).single();
    if (u) {
      setLiveUser(u);
      if (u.classId) {
        const { data: c } = await supabase.from('classes').select('*').eq('id', u.classId).single();
        if (c) setMyClass(c);
      }
    }

    // Stats
    const { data: s } = await supabase.from('gamification_stats').select('*').eq('id', user.id).single();
    if (s) setStats(s);
  };

  React.useEffect(() => {
    fetchProfileData();
    const chStats = supabase.channel('profile_stats')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'gamification_stats', filter: `id=eq.${user?.id}` }, fetchProfileData)
      .subscribe();
    return () => { supabase.removeChannel(chStats); };
  }, [user]);

  React.useEffect(() => {
    if (user && user.role === 'student') {
      fetchProfile(user.id);
      fetchCatalog();
    }
  }, [user, fetchProfile, fetchCatalog]);

  const className = myClass?.name || '';
  const currentLevel = stats ? calculateLevel(stats.xp) : 1;
  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm<ProfileFormData>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      name: user?.name || '',
      email: user?.email || (user as any)?.studentCode || '',
      password: '',
      confirmPassword: '',
    }
  });

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 2 * 1024 * 1024) {
        toast.error('A imagem deve ter no máximo 2MB');
        return;
      }

      const reader = new FileReader();
      reader.onloadend = () => {
        setAvatarPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const onSubmit = async (data: ProfileFormData) => {
    try {
      if (!user) return;

      const updateData: any = {
        name: data.name,
        email: data.email,
        updatedAt: new Date().toISOString(),
      };

      if (avatarPreview) {
        updateData.avatar = avatarPreview;
      } else { // Fallback for students if no avatar is set
        updateData.avatar = '/avatars/default-impacto.png';
      }

      if (data.password) {
        updateData.passwordHash = data.password;
      }

      await supabase.from('users').update(updateData).eq('id', user.id);
      
      const updatedUser = { ...user, ...updateData };
      login(updatedUser as any);
      
      reset({
        name: data.name,
        email: data.email,
        password: '',
        confirmPassword: '',
      });
      
      toast.success('Perfil atualizado com sucesso!');
    } catch (error) {
      console.error(error);
      toast.error('Erro ao atualizar perfil.');
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8 pb-10 animate-in fade-in slide-in-from-bottom-6 duration-700">
      <header>
        <h1 className="text-3xl font-black text-slate-800 tracking-tight">Configurações de Perfil</h1>
        <p className="text-slate-500 font-medium font-outfit">Personalize sua identidade na plataforma e gerencie seus dados.</p>
      </header>

      <div className="grid md:grid-cols-3 gap-8">
        <Card className="p-0 border-none text-center self-start shadow-[0_20px_50px_rgba(0,0,0,0.1)] overflow-hidden bg-white relative group">
          {/* ✅ PREMIUM LIGHT BACKGROUND LAYERS */}
          <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-[0.02] mix-blend-multiply" />
          <div className="absolute top-0 -left-1/4 w-full h-full bg-primary-100/30 rounded-full blur-[120px] animate-pulse" />
          <div className="absolute bottom-0 -right-1/4 w-full h-full bg-special-100/20 rounded-full blur-[120px] animate-pulse delay-1000" />

          <div className="relative z-10 p-8 space-y-6">
            <div className="relative inline-block">
              <input 
                type="file" 
                ref={fileInputRef}
                className="hidden" 
                accept="image/*"
                onChange={handleFileChange}
              />
              
              {(user?.role === 'student' && profile && profile.selectedAvatarId) ? (() => {
                const activeAvatar = catalog.find(i => i.id === profile.selectedAvatarId);
                const activeBackground = catalog.find(i => i.id === profile.selectedBackgroundId);
                const activeBorder = catalog.find(i => i.id === profile.selectedBorderId);
                
                return (
                  <div className="w-40 h-40 rounded-[3rem] mx-auto flex items-center justify-center shadow-xl ring-4 ring-white relative overflow-hidden bg-[#F8FAFF] border-2 border-slate-100 group-hover:scale-105 transition-transform duration-500">
                    <AvatarComposer
                      avatarUrl={activeAvatar?.assetUrl || activeAvatar?.imageUrl || ''}
                      backgroundUrl={activeBackground?.assetUrl || activeBackground?.imageUrl}
                      borderUrl={activeBorder?.assetUrl || activeBorder?.imageUrl}
                      size="xl"
                      className="w-full h-full border-none shadow-none p-0 scale-100"
                      isFloating={true}
                    />
                  </div>
                );
              })() : (
                <div className="w-40 h-40 bg-gradient-to-br from-primary-500 to-primary-600 rounded-[3rem] flex items-center justify-center text-5xl font-black text-white shadow-2xl mx-auto ring-8 ring-white overflow-hidden relative group-hover:scale-105 transition-transform duration-500">
                  {avatarPreview ? (
                    <img src={avatarPreview} alt={user?.name} className="w-full h-full object-cover" />
                  ) : (
                    user?.name?.[0]
                  )}
                  {user?.role !== 'student' && (
                    <button 
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white"
                    >
                      <Camera size={32} />
                    </button>
                  )}
                </div>
              )}
            </div>
            
            <div className="space-y-4 pt-4">
              <div className="space-y-1">
                <h2 className="text-2xl font-black text-slate-900 tracking-tight">{user?.name}</h2>
                {className && (
                  <div className="flex items-center justify-center gap-1.5 bg-primary-50 w-fit mx-auto px-4 py-1.5 rounded-full border border-primary-100">
                    <GraduationCap size={16} className="text-primary-600" />
                    <span className="text-sm font-black text-primary-700 uppercase tracking-wider">{className}</span>
                  </div>
                )}
              </div>

              <div className="flex flex-col gap-2 pt-2">
                {stats && (
                  <>
                    <div className="flex items-center justify-between bg-slate-50 w-full px-5 py-3 rounded-2xl border border-slate-100 group/xp">
                       <span className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] group-hover/xp:text-warning-600 transition-colors">Experiência</span>
                       <span className="flex items-center gap-1.5 text-sm font-black text-slate-900">
                          <Zap size={14} className="fill-warning-400 text-warning-400" /> {stats.xp.toLocaleString()} XP
                       </span>
                    </div>
                    <div className="flex items-center justify-between bg-slate-50 w-full px-5 py-3 rounded-2xl border border-slate-100 group/lvl">
                       <span className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] group-hover/lvl:text-special-500 transition-colors">Progresso</span>
                       <span className="flex items-center gap-1.5 text-sm font-black text-slate-900">
                          <Star size={14} className="fill-special-400 text-special-400" /> Nível {currentLevel}
                       </span>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        </Card>

        <form onSubmit={handleSubmit(onSubmit)} className="md:col-span-2 space-y-6">
          <Card className="p-8 border-slate-100 space-y-6 shadow-xl shadow-slate-200/50">
            <h3 className="text-sm font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
              <User size={16} /> Informações Básicas
            </h3>
            
            <div className="grid sm:grid-cols-2 gap-6">
              <div className="space-y-3">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Nome do Aluno</label>
                <div className="relative">
                  <User className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                  <input 
                    {...register('name')}
                    type="text" 
                    className={cn(
                      "w-full bg-slate-50 border-2 border-transparent rounded-[1.25rem] py-3.5 pl-12 pr-4 text-sm font-bold focus:bg-white focus:border-primary-500/20 outline-none transition-all shadow-inner",
                      errors.name && "border-red-500/50 bg-red-50/50"
                    )}
                  />
                </div>
                {errors.name && <p className="text-[10px] font-black text-red-500 uppercase tracking-widest pl-2">{errors.name.message}</p>}
              </div>

              <div className="space-y-3">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Login / Usuário</label>
                <div className="relative">
                  <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                  <input 
                    {...register('email')}
                    type="text" 
                    readOnly
                    className={cn(
                      "w-full bg-slate-100 border-2 border-transparent rounded-[1.25rem] py-3.5 pl-12 pr-4 text-sm font-bold opacity-70 cursor-not-allowed outline-none transition-all shadow-inner",
                      errors.email && "border-red-500/50 bg-red-50/50"
                    )}
                  />
                  <div className="absolute right-4 top-1/2 -translate-y-1/2">
                    <Lock size={14} className="text-slate-400" />
                  </div>
                </div>
                <p className="text-[9px] font-bold text-slate-400 uppercase tracking-tight pl-2 italic">
                  O login só pode ser alterado pelo administrador.
                </p>
                {errors.email && <p className="text-[10px] font-black text-red-500 uppercase tracking-widest pl-2">{errors.email.message}</p>}
              </div>
            </div>

            <h3 className="text-sm font-black text-slate-400 uppercase tracking-widest flex items-center gap-2 pt-4">
              <Lock size={16} /> Segurança
            </h3>

            <div className="grid sm:grid-cols-2 gap-6">
              <div className="space-y-3">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Nova Senha</label>
                <div className="relative">
                  <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                  <input 
                    {...register('password')}
                    type="password" 
                    placeholder="••••••••"
                    className={cn(
                      "w-full bg-slate-50 border-2 border-transparent rounded-[1.25rem] py-3.5 pl-12 pr-4 text-sm font-bold focus:bg-white focus:border-primary-500/20 outline-none transition-all shadow-inner",
                      errors.password && "border-red-500/50 bg-red-50/50"
                    )}
                  />
                </div>
                {errors.password && <p className="text-[10px] font-black text-red-500 uppercase tracking-widest pl-2">{errors.password.message}</p>}
              </div>

              <div className="space-y-3">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Confirmar Senha</label>
                <div className="relative">
                  <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                  <input 
                    {...register('confirmPassword')}
                    type="password" 
                    placeholder="••••••••"
                    className={cn(
                      "w-full bg-slate-50 border-2 border-transparent rounded-[1.25rem] py-3.5 pl-12 pr-4 text-sm font-bold focus:bg-white focus:border-primary-500/20 outline-none transition-all shadow-inner",
                      errors.confirmPassword && "border-red-500/50 bg-red-50/50"
                    )}
                  />
                </div>
                {errors.confirmPassword && <p className="text-[10px] font-black text-red-500 uppercase tracking-widest pl-2">{errors.confirmPassword.message}</p>}
              </div>
            </div>

            <div className="pt-8 border-t border-slate-50 flex flex-col sm:flex-row justify-end items-center gap-6">
              <Button 
                type="submit"
                variant="primary" 
                disabled={isSubmitting}
                className="w-full sm:w-auto rounded-2xl gap-2 font-black px-10 py-6 text-sm shadow-xl shadow-primary-500/20 hover:shadow-2xl hover:shadow-primary-500/30 transition-all active:scale-95"
              >
                {isSubmitting ? 'Salvando...' : <><Save size={20} /> Atualizar Meu Perfil</>}
              </Button>
            </div>
          </Card>
        </form>
      </div>
    </div>
  );
};

