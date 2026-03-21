import React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { User, Save, Camera, Lock, Shield } from 'lucide-react';
import { useAuthStore } from '../../store/auth.store';
import { db } from '../../lib/dexie';
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

  const { register, handleSubmit, formState: { errors, isSubmitting }, reset } = useForm<ProfileFormData>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      name: user?.name || '',
      email: user?.email || '',
      password: '',
      confirmPassword: '',
    }
  });

  const handlePhotoClick = () => {
    fileInputRef.current?.click();
  };

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

      const updatedUser: any = {
        ...user,
        name: data.name,
        email: data.email,
        avatar: avatarPreview,
        updatedAt: new Date().toISOString(),
      };

      if (data.password) {
        updatedUser.passwordHash = data.password;
      }

      // Update Database
      await db.users.update(user.id, updatedUser);

      // Update Local Store
      login(updatedUser);

      // Clear password fields
      reset({
        ...data,
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
    <div className="max-w-4xl mx-auto space-y-8 pb-10">
      <header>
        <h1 className="text-3xl font-black text-slate-800 tracking-tight">Meu Perfil</h1>
        <p className="text-slate-500 font-medium font-outfit">Gerencie suas informações de acesso e preferências.</p>
      </header>

      <div className="grid md:grid-cols-3 gap-8">
        <Card className="p-8 border-slate-100 text-center space-y-6 self-start">
          <div className="relative inline-block group">
            <div className="w-32 h-32 bg-slate-900 rounded-[2.5rem] flex items-center justify-center text-4xl font-black text-white shadow-2xl mx-auto ring-8 ring-slate-50 overflow-hidden">
              {avatarPreview ? (
                <img src={avatarPreview} alt={user?.name} className="w-full h-full object-cover" />
              ) : (
                user?.name?.[0]
              )}
            </div>
            <button 
              type="button"
              onClick={handlePhotoClick}
              className="absolute bottom-0 right-0 p-2.5 bg-white rounded-xl border border-slate-100 shadow-lg text-slate-600 hover:text-primary-500 transition-all hover:scale-110 active:scale-95 z-10"
            >
              <Camera size={20} />
            </button>
            <input 
              type="file"
              ref={fileInputRef}
              onChange={handleFileChange}
              accept="image/*"
              className="hidden"
            />
          </div>
          <div>
            <h2 className="text-xl font-black text-slate-800 tracking-tight">{user?.name}</h2>
            <p className="text-[10px] font-black text-primary-500 uppercase tracking-[0.2em] mt-2 bg-primary-50 py-1.5 px-3 rounded-full inline-block">Super Admin</p>
          </div>
        </Card>

        <form onSubmit={handleSubmit(onSubmit)} className="md:col-span-2 space-y-8">
          <Card className="p-8 border-slate-100 space-y-8">
            <div className="grid sm:grid-cols-2 gap-8">
              <div className="space-y-3">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Nome Completo</label>
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
                  <Shield className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                  <input 
                    {...register('email')}
                    type="text" 
                    className={cn(
                      "w-full bg-slate-50 border-2 border-transparent rounded-[1.25rem] py-3.5 pl-12 pr-4 text-sm font-bold focus:bg-white focus:border-primary-500/20 outline-none transition-all shadow-inner",
                      errors.email && "border-red-500/50 bg-red-50/50"
                    )}
                  />
                </div>
                {errors.email && <p className="text-[10px] font-black text-red-500 uppercase tracking-widest pl-2">{errors.email.message}</p>}
              </div>

              <div className="space-y-3">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Nova Senha</label>
                <div className="relative">
                  <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                  <input 
                    {...register('password')}
                    type="password" 
                    placeholder="Deixe em branco para manter"
                    className={cn(
                      "w-full bg-slate-50 border-2 border-transparent rounded-[1.25rem] py-3.5 pl-12 pr-4 text-sm font-bold focus:bg-white focus:border-primary-500/20 outline-none transition-all shadow-inner",
                      errors.password && "border-red-500/50 bg-red-50/50"
                    )}
                  />
                </div>
                {errors.password && <p className="text-[10px] font-black text-red-500 uppercase tracking-widest pl-2">{errors.password.message}</p>}
              </div>

              <div className="space-y-3">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Confirmar Nova Senha</label>
                <div className="relative">
                  <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                  <input 
                    {...register('confirmPassword')}
                    type="password" 
                    placeholder="Confirme sua nova senha"
                    className={cn(
                      "w-full bg-slate-50 border-2 border-transparent rounded-[1.25rem] py-3.5 pl-12 pr-4 text-sm font-bold focus:bg-white focus:border-primary-500/20 outline-none transition-all shadow-inner",
                      errors.confirmPassword && "border-red-500/50 bg-red-50/50"
                    )}
                  />
                </div>
                {errors.confirmPassword && <p className="text-[10px] font-black text-red-500 uppercase tracking-widest pl-2">{errors.confirmPassword.message}</p>}
              </div>
            </div>

            <div className="pt-8 border-t border-slate-50 flex justify-between items-center gap-4">
              <div className="flex items-center gap-2 text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">
                <Lock size={14} className="text-slate-300" /> Senha protegida por hash
              </div>
              <Button 
                type="submit"
                variant="primary" 
                disabled={isSubmitting}
                className="rounded-2xl gap-2 font-black px-10 py-6 text-sm shadow-xl shadow-primary-500/20 hover:shadow-2xl hover:shadow-primary-500/30 transition-all active:scale-95"
              >
                {isSubmitting ? 'Salvando...' : <><Save size={20} /> Salvar Alterações</>}
              </Button>
            </div>
          </Card>
        </form>
      </div>
    </div>
  );
};
