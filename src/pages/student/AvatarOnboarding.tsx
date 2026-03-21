import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowRight, Check, Sparkles, User, Palette, Shirt, Crown } from 'lucide-react';

import { AvatarComposer } from '../../features/avatar/components/AvatarComposer';
import { useAvatarStore } from '../../store/avatar.store';
import { cn } from '../../lib/utils';
import { useAuthStore } from '../../store/auth.store';

const STEPS = [
  { id: 'start', title: 'Bem-vindo ao Impacto IA!', subtitle: 'Vamos criar sua identidade única no nosso mundo!', icon: Sparkles },
  { id: 'skin', title: 'Qual seu tom de pele?', subtitle: 'Escolha o que mais combina com você.', icon: User },
  { id: 'hairStyle', title: 'Escolha seu cabelo', subtitle: 'Como você gosta do seu visual?', icon: Palette },
  { id: 'hairColor', title: 'E a cor do cabelo?', subtitle: 'Vamos dar vida ao seu estilo!', icon: Palette },
  { id: 'top', title: 'Sua camiseta favorita', subtitle: 'Escolha uma cor bem vibrante!', icon: Shirt },
  { id: 'name', title: 'Como quer ser chamado?', subtitle: 'Escolha um nome incrível para seu herói.', icon: Crown },
  { id: 'final', title: 'Tudo pronto!', subtitle: 'Seu herói está preparado para a aventura!', icon: Check },
];

const SKIN_TONES = ['#FFDBAC', '#F1C27D', '#E0AC69', '#8D5524'];
const HAIR_COLORS = ['#4b2c20', '#d2691e', '#daa520', '#b8860b'];
const TOP_COLORS = ['#6366f1', '#ec4899', '#f59e0b', '#10b981'];

export function AvatarOnboarding() {
  const navigate = useNavigate();
  const user = useAuthStore(state => state.user);
  const { profile, updateProfile, catalog, fetchCatalog } = useAvatarStore();
  
  const [currentStep, setCurrentStep] = useState(0);
  const [heroName, setHeroName] = useState('');
  
  const [config, setConfig] = useState<Record<string, string>>({
    skinTone: SKIN_TONES[0],
    hairColor: HAIR_COLORS[0],
    topColor: TOP_COLORS[0],
    hairStyleId: ''
  });

  useEffect(() => {
    fetchCatalog();
  }, [fetchCatalog]);

  const applyValue = (key: string, value: string) => {
    setConfig(prev => ({ ...prev, [key]: value }));
  };

  const nextStep = async () => {
    if (currentStep < STEPS.length - 1) {
      setCurrentStep(prev => prev + 1);
    } else {
      if (user && profile) {
        await updateProfile({
          ...profile,
          selectedAvatarId: config.hairStyleId || profile.selectedAvatarId,
          skinTone: config.skinTone,
          colorOverrides: {
            hair: config.hairColor,
            top: config.topColor
          }
        });
      }
      navigate('/student');
    }
  };

  const stepInfo = STEPS[currentStep];

  return (
    <div className="flex h-screen bg-slate-50 overflow-hidden">
      
      {/* ── LEFT: AVATAR SHOWCASE ── */}
      <div className="hidden lg:flex w-1/2 bg-gradient-to-br from-indigo-600 to-indigo-800 items-center justify-center relative overflow-hidden">
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-0 left-0 w-96 h-96 bg-white rounded-full blur-3xl -translate-x-1/2 -translate-y-1/2" />
          <div className="absolute bottom-0 right-0 w-96 h-96 bg-indigo-400 rounded-full blur-3xl translate-x-1/2 translate-y-1/2" />
        </div>

        <motion.div
          key={currentStep}
          initial={{ scale: 0.8, opacity: 0, y: 50 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          className="relative drop-shadow-[0_35px_60px_rgba(0,0,0,0.4)]"
        >
          <div className="absolute inset-0 bg-white/20 blur-[100px] rounded-full scale-110 -z-10" />
          <AvatarComposer 
            avatarUrl={config.hairStyleId || (catalog.find(i => i.type === 'avatar')?.assetUrl || '')} 
            size="xl" 
            animate 
          />
        </motion.div>
      </div>

      {/* ── RIGHT: STEP CONTENT ── */}
      <div className="flex-1 flex flex-col items-center justify-center p-8 lg:p-20 relative bg-white">
        
        {/* Progress Dots */}
        <div className="absolute top-12 flex gap-3">
          {STEPS.map((_, idx) => (
            <div 
              key={idx} 
              className={cn(
                "h-2.5 rounded-full transition-all duration-500",
                idx === currentStep ? "w-10 bg-indigo-600 shadow-[0_0_10px_rgba(79,70,229,0.4)]" : "w-2.5 bg-slate-200",
                idx < currentStep && "bg-indigo-300"
              )} 
            />
          ))}
        </div>

        <AnimatePresence mode="wait">
          <motion.div
            key={currentStep}
            initial={{ opacity: 0, x: 50 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -50 }}
            className="w-full max-w-md text-center"
          >
            <div className="inline-flex items-center justify-center w-16 h-16 bg-indigo-50 rounded-2xl mb-6 shadow-inner ring-1 ring-indigo-100">
              <stepInfo.icon className="w-8 h-8 text-indigo-600" />
            </div>

            <h2 className="text-3xl font-black text-slate-900 mb-2 tracking-tight">{stepInfo.title}</h2>
            <p className="text-slate-500 mb-10 font-medium">{stepInfo.subtitle}</p>

            <div className="flex flex-wrap justify-center gap-4 mb-12">
              {stepInfo.id === 'start' && (
                <div className="bg-gradient-to-br from-indigo-50 to-white p-8 rounded-[32px] border-2 border-indigo-100/50 mt-4 shadow-sm">
                  <p className="text-indigo-600 font-black text-lg">O Impacto IA é onde o aprendizado encontra a diversão.</p>
                </div>
              )}

              {stepInfo.id === 'skin' && SKIN_TONES.map((color) => (
                <button
                  key={color}
                  onClick={() => applyValue('skinTone', color)}
                  className={cn(
                    "w-16 h-16 rounded-2xl transition-all hover:scale-110",
                    config.skinTone === color ? "ring-4 ring-indigo-500 ring-offset-4 shadow-xl z-10" : "shadow-sm border border-slate-100 opacity-60 hover:opacity-100"
                  )}
                  style={{ backgroundColor: color }}
                />
              ))}

              {stepInfo.id === 'hairStyle' && catalog.filter(i => i.type === 'avatar' && i.isFree).map((item) => (
                <button
                  key={item.id}
                  onClick={() => applyValue('hairStyleId', item.assetUrl)}
                  className={cn(
                    "px-6 py-4 rounded-2xl font-bold bg-slate-50 border-2 transition-all hover:border-indigo-200",
                    config.hairStyleId === item.assetUrl ? "border-indigo-600 bg-indigo-50 text-indigo-700" : "border-slate-100 text-slate-600"
                  )}
                >
                  {item.name}
                </button>
              ))}

              {stepInfo.id === 'hairColor' && HAIR_COLORS.map((color) => (
                <button
                  key={color}
                  onClick={() => applyValue('hairColor', color)}
                  className={cn(
                    "w-12 h-12 rounded-xl transition-all hover:scale-110 border-2",
                    config.hairColor === color ? "border-indigo-500 scale-110 shadow-lg" : "border-transparent"
                  )}
                  style={{ backgroundColor: color }}
                />
              ))}

              {stepInfo.id === 'top' && TOP_COLORS.map((color) => (
                <button
                  key={color}
                  onClick={() => applyValue('topColor', color)}
                  className={cn(
                    "w-14 h-14 rounded-2xl transition-all hover:scale-110 shadow-sm border-2",
                    config.topColor === color ? "border-indigo-500 scale-110" : "border-transparent"
                  )}
                  style={{ backgroundColor: color }}
                />
              ))}

              {stepInfo.id === 'name' && (
                <input
                  type="text"
                  placeholder="Seu apelido aqui..."
                  value={heroName}
                  onChange={(e) => setHeroName(e.target.value)}
                  className="w-full h-16 px-6 rounded-2xl bg-slate-50 border-2 border-slate-100 focus:border-indigo-500 focus:outline-none text-center text-xl font-bold text-slate-800 transition-colors"
                />
              )}

              {stepInfo.id === 'final' && (
                <div className="bg-emerald-50 p-8 rounded-3xl border-2 border-emerald-100 w-full animate-bounce">
                  <span className="text-4xl mb-4 block">🎉</span>
                  <p className="text-emerald-700 font-bold text-lg">Seu avatar está incrível!</p>
                </div>
              )}
            </div>

            <button
              onClick={nextStep}
              className="group w-full h-16 bg-indigo-600 hover:bg-indigo-500 text-white rounded-2xl font-black text-lg flex items-center justify-center gap-3 transition-all shadow-xl shadow-indigo-600/20 active:scale-95"
            >
              {currentStep === STEPS.length - 1 ? 'Começar Aventura!' : 'Continuar'}
              <ArrowRight className="w-6 h-6 group-hover:translate-x-1 transition-transform" />
            </button>
          </motion.div>
        </AnimatePresence>

        <p className="absolute bottom-12 text-slate-400 text-sm font-medium">
          Dica: Você pode mudar tudo isso depois no Estúdio de Estilo!
        </p>
      </div>
    </div>
  );
}

