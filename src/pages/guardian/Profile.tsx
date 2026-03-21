import React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { User, Mail, Save, Camera, Lock, Heart } from 'lucide-react';
import { useAuthStore } from '../../store/auth.store';
import { supabase } from '../../lib/supabase';
import { cn } from '../../lib/utils';

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
  const [avatarPreview, setAvatarPreview] = React.useState<string | undefined>(user?.avatar);

  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm<ProfileFormData>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      name: user?.name || '',
      email: user?.email || (user as any)?.guardianCode || '',
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
      }

      if (data.password) {
        updateData.passwordHash = data.password;
      }

      const { error } = await supabase.from('users').update(updateData).eq('id', user.id);
      if (error) throw error;
      
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
        <h1 className="text-3xl font-black text-slate-800 tracking-tight">Perfil do Responsável</h1>
        <p className="text-slate-500 font-medium font-outfit">Gerencie suas informações e mantenha-se conectado ao progresso dos seus dependentes.</p>
      </header>

      <div className="grid md:grid-cols-3 gap-8">
        <Card className="p-8 border-slate-100 text-center space-y-6 self-start shadow-xl shadow-slate-200/50">
          <div className="relative inline-block">
            <input 
              type="file" 
              ref={fileInputRef}
              className="hidden" 
              accept="image/*"
              onChange={handleFileChange}
            />
            <div className="w-32 h-32 bg-energy-500 rounded-[2.5rem] flex items-center justify-center text-4xl font-black text-white shadow-2xl mx-auto ring-8 ring-energy-50 overflow-hidden">
              {avatarPreview ? (
                <img src={avatarPreview} alt={user?.name} className="w-full h-full object-cover" />
              ) : (
                user?.name?.[0]
              )}
            </div>
            <button 
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="absolute bottom-0 right-0 p-2.5 bg-white rounded-xl border border-slate-100 shadow-lg text-slate-600 hover:text-energy-500 transition-all hover:scale-110 active:scale-95"
            >
              <Camera size={20} />
            </button>
          </div>
          <div>
            <h2 className="text-xl font-black text-slate-800 tracking-tight">{user?.name}</h2>
            <div className="flex items-center justify-center gap-2 mt-2">
                <span className="bg-energy-50 text-energy-600 py-1.5 px-4 rounded-full font-black text-[10px] uppercase tracking-wider flex items-center gap-1.5">
                    <Heart size={14} /> Tutor Familiar
                </span>
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
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Nome Completo</label>
                <div className="relative">
                  <User className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                  <input 
                    {...register('name')}
                    type="text" 
                    className={cn(
                      "w-full bg-slate-50 border-2 border-transparent rounded-[1.25rem] py-3.5 pl-12 pr-4 text-sm font-bold focus:bg-white focus:border-energy-500/20 outline-none transition-all shadow-inner",
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
                      "w-full bg-slate-50 border-2 border-transparent rounded-[1.25rem] py-3.5 pl-12 pr-4 text-sm font-bold focus:bg-white focus:border-energy-500/20 outline-none transition-all shadow-inner",
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
                      "w-full bg-slate-50 border-2 border-transparent rounded-[1.25rem] py-3.5 pl-12 pr-4 text-sm font-bold focus:bg-white focus:border-energy-500/20 outline-none transition-all shadow-inner",
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
                className="w-full sm:w-auto rounded-2xl gap-2 font-black px-10 py-6 text-sm bg-energy-600 hover:bg-energy-700 shadow-xl shadow-energy-500/20 hover:shadow-2xl hover:shadow-energy-500/30 transition-all active:scale-95"
              >
                {isSubmitting ? 'Salvando...' : <><Save size={20} /> Salvar Perfil</>}
              </Button>
            </div>
          </Card>
        </form>
      </div>
    </div>
  );
};
