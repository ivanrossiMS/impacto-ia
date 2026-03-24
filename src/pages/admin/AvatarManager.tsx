import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Plus, Trash2, Edit2, Search, Filter, Sparkles, Coins,
  Tag, Layout, Image as ImageIcon, Save, X, AlertCircle,
  Upload, RefreshCw, Layers, CheckCircle2, Clock,
  ChevronRight, ChevronLeft, School as SchoolIcon
} from 'lucide-react';
import { useAvatarStore } from '../../store/avatar.store';
import { useAuthStore } from '../../store/auth.store';
import { cn } from '../../lib/utils';
import { toast } from 'sonner';
import type { AvatarCatalogItem, AvatarRarity } from '../../types/avatar';
import { createBulkNotifications } from '../../lib/notificationUtils';
import { supabase } from '../../lib/supabase';

const RARITIES: { value: AvatarRarity; label: string; color: string; desc: string }[] = [
  { value: 'comum',    label: 'Comum',    color: 'bg-slate-400',   desc: 'Item básico — 50–200 🪙' },
  { value: 'incomum',  label: 'Incomum',  color: 'bg-green-500',   desc: 'Pouco comum — 250–600 🪙' },
  { value: 'raro',     label: 'Raro',     color: 'bg-blue-500',    desc: 'Especial — 700–1.500 🪙' },
  { value: 'épico',    label: 'Épico',    color: 'bg-purple-500',  desc: 'Muito valioso — 2.000–5.000 🪙' },
  { value: 'lendário', label: 'Lendário', color: 'bg-amber-500',   desc: 'Exclusivo — 6.000+ 🪙' },
];

const TYPES = [
  { value: 'avatar',     label: 'Avatar',   emoji: '🧑',  desc: 'Personagens e figuras' },
  { value: 'background', label: 'Fundo',    emoji: '🖼️', desc: 'Planos de fundo' },
  { value: 'border',     label: 'Moldura',  emoji: '🖌️', desc: 'Bordas e quadros' },
  { value: 'sticker',    label: 'Adesivo',  emoji: '✨',  desc: 'Adesivos decorativos' },
];

// ── Batch item type ───────────────────────────────────────────────────────────
interface BatchItem {
  id: string;
  file: File;
  preview: string;
  status: 'done' | 'error';
  name: string;
  description: string;
  priceCoins: number;
  rarity: AvatarRarity;
  error?: string;
}

// ── Batch Upload Modal ────────────────────────────────────────────────────────
const BatchUploadModal: React.FC<{
  onClose: () => void;
  onComplete: (count: number) => void;
  catalogLength: number;
  addCatalogItem: (data: any) => Promise<void>;
  uploadCatalogImage: (file: File) => Promise<string>;
  targetSchoolId: string | null;
  schools: { id: string; name: string }[];
  isMaster: boolean;
  adminSchoolId: string | null;
}> = ({ onClose, onComplete, catalogLength, addCatalogItem, uploadCatalogImage,
        isMaster, adminSchoolId, schools: schoolList }) => {

  // Internal scope state: starts at null (global) for master, fixed for admin
  const [batchSchoolId, setBatchSchoolId] = useState<string | null>(
    isMaster ? null : adminSchoolId
  );

  const [step, setStep] = useState<'select' | 'review' | 'uploading' | 'done'>('select');
  const [batchType, setBatchType] = useState<string>('avatar');
  const [items, setItems] = useState<BatchItem[]>([]);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [uploadedCount, setUploadedCount] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ── File selection ──────────────────────────────────────────────────────────
  const handleFilesSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    const newItems: BatchItem[] = files.map(file => ({
      id: crypto.randomUUID(),
      file,
      preview: URL.createObjectURL(file),
      status: 'done',
      // Pre-fill name from filename (without extension), underscores/dashes → spaces
      name: file.name.replace(/\.[^/.]+$/, '').replace(/[-_]/g, ' '),
      description: '',
      priceCoins: 200,
      rarity: 'comum',
    }));
    setItems(newItems);
    setCurrentIdx(0);
    setStep('review');
  };

  // ── Item editing ────────────────────────────────────────────────────────────
  const updateItem = (id: string, patch: Partial<BatchItem>) => {
    setItems(prev => prev.map(it => it.id === id ? { ...it, ...patch } : it));
  };

  const removeItem = (id: string) => {
    setItems(prev => {
      const filtered = prev.filter(it => it.id !== id);
      if (currentIdx >= filtered.length) setCurrentIdx(Math.max(0, filtered.length - 1));
      return filtered;
    });
  };

  // ── Upload all ──────────────────────────────────────────────────────────────
  const handleUpload = async () => {
    setStep('uploading');
    let count = 0;
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      setCurrentIdx(i);
      try {
        const assetUrl = await uploadCatalogImage(item.file);
        await addCatalogItem({
          name: item.name,
          description: item.description,
          priceCoins: item.priceCoins,
          rarity: item.rarity,
          type: batchType,
          assetUrl,
          isActive: 1,
          sortOrder: catalogLength + i + 1,
          schoolId: batchSchoolId,
        });
        count++;
        setUploadedCount(count);
      } catch (err: any) {
        console.error('[BatchUpload] item error:', err.message || err);
      }
    }
    setStep('done');
    try {
      const { data: allStudents } = await supabase.from('users').select('id').eq('role', 'student');
      if (allStudents && allStudents.length > 0) {
        await createBulkNotifications(
          allStudents.map(s => s.id),
          'student',
          `${count} novos itens na Loja! 🎨`,
          `Acabaram de chegar ${count} novos ${TYPES.find(t => t.value === batchType)?.label?.toLowerCase() || 'items'} na Loja de Avatares! Confira agora!`,
          'info',
          'normal',
          '/student/store'
        );
      }
    } catch (_) {}
    onComplete(count);
  };

  const currentItem = items[currentIdx];

  return (
    <div className="fixed inset-0 z-[300] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md">
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="bg-white rounded-[2.5rem] shadow-2xl w-full max-w-5xl h-[92vh] overflow-hidden flex flex-col"
      >
        {/* Header */}
        <div className="bg-gradient-to-r from-indigo-600 to-purple-700 p-8 text-white flex items-center justify-between flex-shrink-0">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <Layers size={28} className="text-indigo-200" />
              <h2 className="text-2xl font-black tracking-tight">Envio em Lote</h2>
            </div>
            <p className="text-indigo-200 text-sm font-medium">
              Selecione múltiplas imagens e preencha os campos de cada item antes de enviar.
            </p>
          </div>
          {step !== 'uploading' && (
            <button onClick={onClose} className="p-2 bg-white/10 hover:bg-white/20 rounded-xl transition-all">
              <X size={20} />
            </button>
          )}
        </div>

        {/* Progress steps */}
        <div className="px-8 pt-6 pb-4 flex items-center gap-2 flex-shrink-0 border-b border-slate-100">
          {(['select', 'review', 'uploading', 'done'] as const).map((s, i) => {
            const labels = ['Configurar', 'Preencher', 'Enviando', 'Concluído'];
            const active = step === s;
            const past = ['select', 'review', 'uploading', 'done'].indexOf(step) > i;
            return (
              <React.Fragment key={s}>
                <div className={cn(
                  'flex items-center gap-2 px-4 py-2 rounded-full text-xs font-black uppercase tracking-wider transition-all',
                  active ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-200' :
                  past ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-400'
                )}>
                  {past ? <CheckCircle2 size={14} /> : <span className="w-4 h-4 flex items-center justify-center">{i + 1}</span>}
                  {labels[i]}
                </div>
                {i < 3 && <ChevronRight size={14} className="text-slate-300 flex-shrink-0" />}
              </React.Fragment>
            );
          })}
        </div>

        {/* Body */}
        <div className="flex-1 overflow-hidden min-h-0 flex flex-col">

          {/* Step 1: Select type + files */}
          {step === 'select' && (
            <div className="p-8 space-y-8 overflow-y-auto h-full">
              <div>
                <h3 className="text-sm font-black uppercase text-slate-400 tracking-widest mb-4">1. Escolha o tipo de item</h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {TYPES.map(t => (
                    <button
                      key={t.value}
                      onClick={() => setBatchType(t.value)}
                      className={cn(
                        'p-5 rounded-[1.5rem] border-2 flex flex-col items-center gap-2 font-black transition-all text-center',
                        batchType === t.value
                          ? 'border-indigo-500 bg-indigo-50 text-indigo-700 shadow-lg shadow-indigo-100'
                          : 'border-slate-200 hover:border-indigo-300 text-slate-600'
                      )}
                    >
                      <span className="text-3xl">{t.emoji}</span>
                      <span className="text-sm">{t.label}</span>
                      <span className="text-[10px] font-medium text-slate-400 normal-case">{t.desc}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* School scope selector inside modal */}
              <div>
                <h3 className="text-sm font-black uppercase text-slate-400 tracking-widest mb-4">2. Destino dos itens</h3>
                {isMaster ? (
                  <div className="flex flex-wrap gap-2">
                    <button
                      onClick={() => setBatchSchoolId(null)}
                      className={cn(
                        'px-4 py-2.5 rounded-2xl text-xs font-black uppercase tracking-wide transition-all flex items-center gap-2',
                        batchSchoolId === null
                          ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-200'
                          : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                      )}
                    >
                      🌐 Todas as Escolas
                      {batchSchoolId === null && <span className="text-[9px] bg-white/20 px-1.5 py-0.5 rounded-full">Global</span>}
                    </button>
                    {schoolList.map(s => (
                      <button
                        key={s.id}
                        onClick={() => setBatchSchoolId(s.id)}
                        className={cn(
                          'px-4 py-2.5 rounded-2xl text-xs font-black uppercase tracking-wide transition-all',
                          batchSchoolId === s.id
                            ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-200'
                            : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                        )}
                      >
                        🏫 {s.name}
                      </button>
                    ))}
                  </div>
                ) : (
                  <div className="flex items-center gap-3 p-4 bg-slate-50 rounded-2xl border border-slate-100">
                    <SchoolIcon size={16} className="text-slate-400" />
                    <span className="text-sm font-bold text-slate-700">
                      {schoolList.find(s => s.id === adminSchoolId)?.name || 'Sua escola'}
                    </span>
                    <span className="ml-auto text-[10px] text-slate-400 font-bold uppercase">Fixo para admins</span>
                  </div>
                )}
              </div>

              <div>
                <h3 className="text-sm font-black uppercase text-slate-400 tracking-widest mb-4">3. Selecione as imagens</h3>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  multiple
                  className="hidden"
                  onChange={handleFilesSelected}
                />
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full h-48 border-2 border-dashed border-indigo-300 rounded-[2rem] hover:border-indigo-500 hover:bg-indigo-50/50 transition-all flex flex-col items-center justify-center gap-3 group"
                >
                  <div className="w-16 h-16 bg-indigo-100 rounded-2xl flex items-center justify-center group-hover:bg-indigo-200 transition-colors">
                    <Upload size={28} className="text-indigo-500" />
                  </div>
                  <div className="text-center">
                    <p className="font-black text-slate-700 text-lg">Clique para selecionar imagens</p>
                    <p className="text-slate-400 text-sm">PNG, JPG, GIF, WEBP • Múltiplos arquivos aceitos</p>
                  </div>
                </button>
              </div>
            </div>
          )}

          {/* Step 2: Fill in manually */}
          {step === 'review' && items.length > 0 && (
            <div className="flex-1 flex overflow-hidden">
              {/* Thumbnails sidebar */}
              <div className="w-48 flex-shrink-0 border-r border-slate-100 overflow-y-scroll p-3 space-y-2 bg-slate-50">
                <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest px-2 py-1">{items.length} arquivo{items.length !== 1 ? 's' : ''}</p>
                {items.map((item, idx) => (
                  <button
                    key={item.id}
                    onClick={() => setCurrentIdx(idx)}
                    className={cn(
                      'w-full p-2 rounded-2xl flex items-center gap-2 transition-all text-left relative',
                      currentIdx === idx ? 'bg-indigo-100 ring-2 ring-indigo-400' : 'bg-white hover:bg-slate-100 border border-slate-100'
                    )}
                  >
                    <img src={item.preview} className="w-10 h-10 rounded-xl object-contain bg-slate-50 flex-shrink-0" alt="" />
                    <div className="min-w-0 flex-1">
                      <p className="text-[10px] font-black text-slate-700 truncate">{item.name || '...'}</p>
                      <div className={cn('h-1.5 w-full rounded-full mt-1',
                        item.status === 'error' ? 'bg-red-400' : item.name ? 'bg-emerald-400' : 'bg-slate-200'
                      )} />
                    </div>
                  </button>
                ))}
              </div>

              {/* Editor panel */}
              {currentItem && (
                <div className="flex-1 overflow-y-auto p-8 space-y-6">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setCurrentIdx(Math.max(0, currentIdx - 1))}
                        disabled={currentIdx === 0}
                        className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 disabled:opacity-30 transition-all"
                      >
                        <ChevronLeft size={16} />
                      </button>
                      <span className="text-sm font-black text-slate-500">{currentIdx + 1} / {items.length}</span>
                      <button
                        onClick={() => setCurrentIdx(Math.min(items.length - 1, currentIdx + 1))}
                        disabled={currentIdx === items.length - 1}
                        className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 disabled:opacity-30 transition-all"
                      >
                        <ChevronRight size={16} />
                      </button>
                    </div>
                    <button
                      onClick={() => removeItem(currentItem.id)}
                      className="text-[10px] font-black uppercase text-red-400 hover:text-red-600 transition-colors flex items-center gap-1"
                    >
                      <Trash2 size={12} /> Remover
                    </button>
                  </div>

                  <div className="flex gap-8">
                    {/* Image preview */}
                    <div className="flex-shrink-0 w-40">
                      <div className="w-40 h-40 rounded-3xl bg-slate-50 border-2 border-slate-100 flex items-center justify-center overflow-hidden">
                        <img src={currentItem.preview} className="w-full h-full object-contain p-3" alt="" />
                      </div>
                      <p className="text-[10px] text-slate-400 font-bold text-center mt-2 truncate">{currentItem.file.name}</p>
                    </div>

                    {/* Fields */}
                    <div className="flex-1 space-y-4">
                      <div className="space-y-1">
                        <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Nome</label>
                        <input
                          value={currentItem.name}
                          onChange={e => updateItem(currentItem.id, { name: e.target.value })}
                          className="w-full bg-slate-50 rounded-2xl px-4 py-3 font-bold outline-none border border-slate-200 focus:border-indigo-400 transition-colors text-slate-800 text-sm"
                          placeholder="Nome do item..."
                        />
                      </div>

                      <div className="space-y-1">
                        <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Legenda</label>
                        <textarea
                          value={currentItem.description}
                          onChange={e => updateItem(currentItem.id, { description: e.target.value })}
                          rows={2}
                          className="w-full bg-slate-50 rounded-2xl px-4 py-3 font-medium outline-none border border-slate-200 focus:border-indigo-400 transition-colors text-slate-700 text-sm resize-none"
                          placeholder="Legenda curta..."
                        />
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1">
                          <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest flex items-center gap-1">
                            <Coins size={10} /> Preço
                          </label>
                          <input
                            type="number"
                            min={0}
                            value={currentItem.priceCoins}
                            onChange={e => updateItem(currentItem.id, { priceCoins: Number(e.target.value) })}
                            className="w-full bg-slate-50 rounded-2xl px-4 py-3 font-black text-amber-700 outline-none border border-slate-200 focus:border-amber-400 transition-colors text-sm"
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Raridade</label>
                          <select
                            value={currentItem.rarity}
                            onChange={e => updateItem(currentItem.id, { rarity: e.target.value as AvatarRarity })}
                            className="w-full bg-slate-50 rounded-2xl px-4 py-3 font-black outline-none border border-slate-200 focus:border-indigo-400 transition-colors text-sm appearance-none"
                          >
                            {RARITIES.map(r => (
                              <option key={r.value} value={r.value}>{r.label}</option>
                            ))}
                          </select>
                        </div>
                      </div>

                      {/* Badge preview */}
                      <div className="flex items-center gap-2 pt-1">
                        <span className={cn('px-3 py-1 rounded-full text-[10px] font-black text-white', RARITIES.find(r => r.value === currentItem.rarity)?.color)}>
                          {currentItem.rarity}
                        </span>
                        <span className="bg-amber-50 text-amber-700 border border-amber-100 px-3 py-1 rounded-full text-[10px] font-black flex items-center gap-1">
                          <Coins size={10} /> {currentItem.priceCoins} moedas
                        </span>
                        <span className="bg-slate-100 text-slate-600 px-3 py-1 rounded-full text-[10px] font-black uppercase">
                          {TYPES.find(t => t.value === batchType)?.label}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Step 3: Uploading */}
          {step === 'uploading' && (
            <div className="p-8 flex flex-col items-center justify-center h-full space-y-8">
              <div className="relative">
                <div className="w-24 h-24 border-4 border-indigo-100 rounded-full" />
                <div className="absolute inset-0 w-24 h-24 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin" />
                <Upload className="absolute inset-0 m-auto text-indigo-500" size={28} />
              </div>
              <div className="text-center space-y-2">
                <h3 className="text-xl font-black text-slate-800">Enviando itens para a loja...</h3>
                <p className="text-slate-500 text-sm font-medium">{uploadedCount} de {items.length} enviados</p>
              </div>
              <div className="w-full max-w-sm">
                <div className="h-3 bg-slate-100 rounded-full overflow-hidden">
                  <motion.div
                    className="h-full bg-gradient-to-r from-indigo-500 to-purple-500 rounded-full"
                    animate={{ width: `${(uploadedCount / items.length) * 100}%` }}
                    transition={{ type: 'spring', stiffness: 100 }}
                  />
                </div>
                <p className="text-center text-xs text-slate-400 font-bold mt-2">{Math.round((uploadedCount / items.length) * 100)}%</p>
              </div>
              <div className="w-full overflow-y-auto flex-1 px-2">
                <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-2">
                  {items.map((item, i) => (
                    <div key={item.id} className={cn(
                      'flex flex-col items-center gap-1.5 p-2 rounded-2xl text-center transition-all border',
                      i === currentIdx ? 'bg-indigo-50 border-indigo-200 shadow-sm shadow-indigo-100' :
                      i < currentIdx  ? 'bg-emerald-50 border-emerald-100' :
                      'bg-slate-50 border-slate-100'
                    )}>
                      <div className="relative">
                        <img src={item.preview} className="w-10 h-10 rounded-xl object-contain bg-white" alt="" />
                        {i === currentIdx && (
                          <span className="absolute -top-1 -right-1 w-4 h-4 bg-indigo-500 rounded-full flex items-center justify-center">
                            <Clock size={9} className="text-white animate-pulse" />
                          </span>
                        )}
                        {i < currentIdx && (
                          <span className="absolute -top-1 -right-1 w-4 h-4 bg-emerald-500 rounded-full flex items-center justify-center">
                            <CheckCircle2 size={9} className="text-white" />
                          </span>
                        )}
                      </div>
                      <span className="text-[9px] font-bold text-slate-600 truncate w-full leading-tight">{item.name || item.file.name}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Step 4: Done */}
          {step === 'done' && (
            <div className="p-8 flex flex-col items-center justify-center h-full space-y-6">
              <div className="w-24 h-24 bg-emerald-100 rounded-full flex items-center justify-center">
                <CheckCircle2 size={48} className="text-emerald-500" />
              </div>
              <div className="text-center space-y-2">
                <h3 className="text-2xl font-black text-slate-800">Lote enviado! 🎉</h3>
                <p className="text-slate-500 font-medium">{uploadedCount} item{uploadedCount !== 1 ? 's' : ''} adicionado{uploadedCount !== 1 ? 's' : ''} à loja com sucesso.</p>
                <p className="text-slate-400 text-sm">Os alunos foram notificados sobre os novos itens! ✨</p>
              </div>
              <button
                onClick={onClose}
                className="px-10 py-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl font-black transition-all shadow-lg shadow-indigo-200"
              >
                Fechar
              </button>
            </div>
          )}
        </div>

        {/* Footer actions */}
        {step === 'review' && (
          <div className="flex-shrink-0 p-6 border-t border-slate-100 flex items-center justify-between bg-slate-50/50">
            <span className="text-xs font-black text-slate-500 uppercase tracking-widest">
              {items.length} item{items.length !== 1 ? 's' : ''} no lote
            </span>
            <div className="flex gap-3">
              <button
                onClick={() => { setItems([]); setStep('select'); }}
                className="px-6 py-3 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-2xl font-bold transition-all text-sm"
              >
                ← Voltar
              </button>
              <button
                onClick={handleUpload}
                disabled={items.length === 0}
                className="px-8 py-3 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white rounded-2xl font-black transition-all shadow-lg shadow-indigo-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 text-sm"
              >
                <Upload size={16} />
                Enviar {items.length} item{items.length !== 1 ? 's' : ''} para a Loja
              </button>
            </div>
          </div>
        )}
      </motion.div>
    </div>
  );
};

// ── Main Component ────────────────────────────────────────────────────────────
export const AvatarManager: React.FC = () => {
  const { catalog, fetchCatalog, addCatalogItem, updateCatalogItem, deleteCatalogItem, uploadCatalogImage, isLoading } = useAvatarStore();
  const { user } = useAuthStore();

  const isMaster = !!(user as any)?.isMaster;
  const adminSchoolId = user?.schoolId || null;

  // scope now managed inside BatchUploadModal — keep null here only for prop passing
  const targetSchoolId: string | null = null;
  const [schools, setSchools] = useState<{ id: string; name: string }[]>([]);

  // ── Other UI state ─────────────────────────────────────────────────────────
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isBatchOpen, setIsBatchOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<AvatarCatalogItem | null>(null);
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState<string>('all');
  const [filterSchool, setFilterSchool] = useState<string>('all'); // 'all' | 'global' | schoolId
  const [isProcessing, setIsProcessing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [formData, setFormData] = useState({
    name: '',
    description: '',
    priceCoins: 0,
    rarity: 'comum' as AvatarRarity,
    type: 'avatar' as any,
    assetUrl: '',
    isActive: 1 as number,
    sortOrder: 1
  });

  // ── Load catalog + schools ─────────────────────────────────────────────────
  useEffect(() => {
    if (isMaster) {
      fetchCatalog({ isMaster: true });
      supabase.from('schools').select('id, name').then(({ data }) => {
        if (data) setSchools(data);
      });
    } else {
      fetchCatalog({ schoolId: adminSchoolId });
    }
  }, [isMaster, adminSchoolId]);

  // Filter by school dropdown (admin master sees all, can filter)
  const filteredByScope = isMaster
    ? catalog.filter(item => {
        if (filterSchool === 'all') return true;
        if (filterSchool === 'global') return item.schoolId == null;
        return item.schoolId === filterSchool;
      })
    : catalog;

  const filteredCatalog = filteredByScope.filter(item => {
    const matchesSearch = item.name.toLowerCase().includes(search.toLowerCase());
    const matchesType = filterType === 'all' || item.type === filterType;
    return matchesSearch && matchesType;
  });

  // ── Helpers ────────────────────────────────────────────────────────────────
  const handleOpenForm = (item?: AvatarCatalogItem) => {
    if (item) {
      setEditingItem(item);
      setFormData({
        name: item.name,
        description: item.description || '',
        priceCoins: item.priceCoins,
        rarity: item.rarity,
        type: item.type,
        assetUrl: item.assetUrl,
        isActive: item.isActive,
        sortOrder: item.sortOrder || 1
      });
    } else {
      setEditingItem(null);
      setFormData({
        name: '', description: '', priceCoins: 0, rarity: 'comum',
        type: 'avatar', assetUrl: '', isActive: 1, sortOrder: catalog.length + 1
      });
    }
    setIsFormOpen(true);
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsProcessing(true);
    try {
      const url = await uploadCatalogImage(file);
      setFormData(prev => ({ ...prev, assetUrl: url }));
      toast.success('Imagem carregada com sucesso!');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingItem) {
        await updateCatalogItem(editingItem.id, formData);
        toast.success('Avatar atualizado!');
      } else {
        const payload = { ...formData, schoolId: targetSchoolId };
        await addCatalogItem(payload);
        // Notify students in scope
        let studentQuery = supabase.from('users').select('id').eq('role', 'student');
        if (targetSchoolId) studentQuery = studentQuery.eq('schoolId', targetSchoolId);
        const { data: allStudents } = await studentQuery;
        if (allStudents && allStudents.length > 0) {
          await createBulkNotifications(
            allStudents.map(s => s.id), 'student',
            'Novos itens na Loja! 🪙',
            `Novos itens chegaram na Loja de Avatares: "${formData.name}". Confira as novidades!`,
            'info', 'normal', '/student/store'
          );
        }
        toast.success('Novo item adicionado à loja!');
      }
      setIsFormOpen(false);
    } catch {
      toast.error('Erro ao salvar item.');
    }
  };

  const handleDelete = async (id: string) => {
    if (window.confirm('Tem certeza que deseja excluir este item?')) {
      await deleteCatalogItem(id);
      toast.success('Item excluído da loja.');
    }
  };

  const refreshCatalog = () => {
    if (isMaster) fetchCatalog({ isMaster: true });
    else fetchCatalog({ schoolId: adminSchoolId });
  };

  return (
    <div className="p-8 max-w-7xl mx-auto">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-10">
        <div>
          <h1 className="text-4xl font-black text-slate-900 mb-2 flex items-center gap-3">
            <Sparkles className="w-10 h-10 text-primary-500" />
            Avatar Studio Admin
          </h1>
          <p className="text-slate-500">Gerencie o catálogo da loja e crie novos itens premium.</p>
        </div>

        {isLoading && <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary-500" />}

        <div className="flex items-center gap-3">
          <button
            onClick={() => setIsBatchOpen(true)}
            className="flex items-center gap-2 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white px-6 py-3 rounded-2xl font-bold shadow-lg shadow-indigo-200 transition-all active:scale-95"
          >
            <Layers className="w-5 h-5" />
            Envio em Lote
          </button>
        </div>
      </header>

      {/* ── School Scope Bar removed — now inside BatchUploadModal ── */}

      {/* Filters */}
      <div className="bg-white rounded-[2rem] p-6 shadow-sm border border-slate-100 mb-8 flex flex-col md:flex-row gap-4 items-center">
        <div className="relative flex-1 group">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400 group-focus-within:text-primary-500 transition-colors" />
          <input
            type="text" placeholder="Pesquisar por nome..."
            value={search} onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-12 pr-4 py-3 bg-slate-50 border-none rounded-2xl focus:ring-2 focus:ring-primary-500/20 text-slate-700 font-medium"
          />
        </div>
        <div className="flex items-center gap-2 min-w-[180px]">
          <Filter className="w-5 h-5 text-slate-400 flex-shrink-0" />
          <select
            value={filterType} onChange={(e) => setFilterType(e.target.value)}
            className="flex-1 bg-slate-50 border-none rounded-2xl py-3 px-4 font-bold text-slate-600 focus:ring-2 focus:ring-primary-500/20 outline-none"
          >
            <option value="all">Todos os tipos</option>
            {TYPES.map(t => <option key={t.value} value={t.value}>{t.emoji} {t.label}</option>)}
          </select>
        </div>
        {/* School filter: visible only to master since admin only sees own school */}
        {isMaster && (
          <div className="flex items-center gap-2 min-w-[200px]">
            <SchoolIcon className="w-5 h-5 text-slate-400 flex-shrink-0" />
            <select
              value={filterSchool} onChange={(e) => setFilterSchool(e.target.value)}
              className="flex-1 bg-slate-50 border-none rounded-2xl py-3 px-4 font-bold text-slate-600 focus:ring-2 focus:ring-primary-500/20 outline-none"
            >
              <option value="all">Todas as escolas</option>
              <option value="global">🌐 Global</option>
              {schools.map(s => <option key={s.id} value={s.id}>🏫 {s.name}</option>)}
            </select>
          </div>
        )}
        <div className="text-[10px] font-black uppercase text-slate-400 tracking-widest whitespace-nowrap">
          {filteredCatalog.length} item{filteredCatalog.length !== 1 ? 's' : ''}
        </div>
      </div>

      {/* Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        <AnimatePresence>
          {filteredCatalog.map((item: AvatarCatalogItem) => {
            const itemSchoolName = item.schoolId
              ? schools.find(s => s.id === item.schoolId)?.name
              : null;
            return (
              <motion.div
                key={item.id} layout
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.8 }}
                className="bg-white rounded-[2rem] overflow-hidden border border-slate-100 shadow-sm hover:shadow-xl transition-all group flex flex-col h-full"
              >
                <div className="aspect-square relative bg-slate-50 flex items-center justify-center p-8 group-hover:bg-primary-50/30 transition-colors border-b border-slate-50 overflow-hidden">
                  <img src={item.assetUrl} className="w-full h-full object-contain filter drop-shadow-xl group-hover:scale-110 transition-transform duration-500" alt={item.name} />
                  <div className="absolute top-4 right-4">
                    <span className={cn('px-3 py-1 rounded-full text-[10px] font-black uppercase text-white shadow-lg', RARITIES.find(r => r.value === item.rarity)?.color)}>{item.rarity}</span>
                  </div>
                  <div className="absolute top-4 left-4 flex flex-col gap-1">
                    <span className="bg-white/80 backdrop-blur-md px-3 py-1 rounded-full text-[10px] font-black uppercase text-slate-600 border border-slate-100">
                      {TYPES.find(t => t.value === item.type)?.emoji} {item.type}
                    </span>
                    {/* School badge */}
                    {isMaster && (
                      <span className={cn(
                        'px-2 py-0.5 rounded-full text-[9px] font-black uppercase backdrop-blur-md border',
                        itemSchoolName
                          ? 'bg-blue-50/90 text-blue-700 border-blue-100'
                          : 'bg-emerald-50/90 text-emerald-700 border-emerald-100'
                      )}>
                        {itemSchoolName ? `🏫 ${itemSchoolName}` : '🌐 Global'}
                      </span>
                    )}
                  </div>
                </div>
                <div className="p-6 flex flex-col flex-1">
                  <h3 className="font-bold text-slate-900 text-lg mb-1 leading-tight">{item.name}</h3>
                  <p className="text-slate-500 text-sm line-clamp-2 mb-4 flex-1 italic">"{item.description}"</p>
                  <div className="flex items-center justify-between mt-auto pt-4 border-slate-50">
                    <div className="flex items-center gap-1 bg-amber-50 text-amber-600 px-3 py-1.5 rounded-xl font-black text-sm border border-amber-100">
                      <Coins className="w-4 h-4" />{item.priceCoins}
                    </div>
                    <div className="flex items-center gap-2">
                      <button onClick={() => handleOpenForm(item)} className="p-2 hover:bg-primary-50 text-slate-400 hover:text-primary-500 rounded-xl transition-colors">
                        <Edit2 className="w-5 h-5" />
                      </button>
                      <button onClick={() => handleDelete(item.id)} className="p-2 hover:bg-red-50 text-slate-400 hover:text-red-500 rounded-xl transition-colors">
                        <Trash2 className="w-5 h-5" />
                      </button>
                    </div>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </AnimatePresence>
        {filteredCatalog.length === 0 && (
          <div className="col-span-full py-20 flex flex-col items-center justify-center text-slate-400">
            <ImageIcon className="w-16 h-16 mb-4 opacity-20" />
            <p className="font-bold text-xl">Nenhum item encontrado para este escopo</p>
          </div>
        )}
      </div>

      {/* Single Item Modal */}
      <AnimatePresence>
        {isFormOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setIsFormOpen(false)}
              className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="bg-white w-full max-w-2xl rounded-[2.5rem] shadow-2xl relative overflow-hidden"
            >
              <div className="p-8 border-b border-slate-50 flex items-center justify-between bg-primary-50/30">
                <div>
                  <h2 className="text-2xl font-black text-slate-900 flex items-center gap-3">
                    {editingItem ? <Edit2 className="w-8 h-8 text-primary-500" /> : <Plus className="w-8 h-8 text-primary-500" />}
                    {editingItem ? 'Editar Item' : 'Novo Item da Loja'}
                  </h2>
                  {!editingItem && (
                    <p className="text-xs font-bold text-slate-400 mt-1">
                      Destino: <span className="text-indigo-600">{targetSchoolId === null ? '🌐 Todas as Escolas' : `🏫 ${schools.find(s => s.id === targetSchoolId)?.name || 'Escola'}`}</span>
                    </p>
                  )}
                </div>
                <button onClick={() => setIsFormOpen(false)} className="p-2 hover:bg-white rounded-full transition-colors text-slate-400">
                  <X className="w-6 h-6" />
                </button>
              </div>
              <form onSubmit={handleSubmit} className="p-8 grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-bold text-slate-700 mb-1.5 ml-1 flex items-center gap-2"><Tag className="w-4 h-4" /> Nome do Item</label>
                    <input required type="text" value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })}
                      className="w-full bg-slate-50 border-none rounded-2xl py-3 px-4 focus:ring-2 focus:ring-primary-500/20 text-slate-800 font-bold" placeholder="Ex: Capivara Lendária" />
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-slate-700 mb-1.5 ml-1 flex items-center gap-2"><AlertCircle className="w-4 h-4" /> Legenda / Descrição</label>
                    <textarea required rows={3} value={formData.description} onChange={e => setFormData({ ...formData, description: e.target.value })}
                      className="w-full bg-slate-50 border-none rounded-2xl py-3 px-4 focus:ring-2 focus:ring-primary-500/20 text-slate-800 font-medium resize-none" placeholder="Descreve o item..." />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-bold text-slate-700 mb-1.5 ml-1 flex items-center gap-2"><Coins className="w-4 h-4" /> Preço</label>
                      <input required type="number" min="0" value={formData.priceCoins} onChange={e => setFormData({ ...formData, priceCoins: Number(e.target.value) })}
                        className="w-full bg-slate-50 border-none rounded-2xl py-3 px-4 focus:ring-2 focus:ring-primary-500/20 text-slate-800 font-black" />
                    </div>
                    <div>
                      <label className="block text-sm font-bold text-slate-700 mb-1.5 ml-1">Raridade</label>
                      <select value={formData.rarity} onChange={e => setFormData({ ...formData, rarity: e.target.value as any })}
                        className="w-full bg-slate-50 border-none rounded-2xl py-3 px-4 focus:ring-2 focus:ring-primary-500/20 text-slate-800 font-bold appearance-none outline-none">
                        {RARITIES.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
                      </select>
                    </div>
                  </div>
                </div>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-bold text-slate-700 mb-1.5 ml-1 flex items-center gap-2"><Layout className="w-4 h-4" /> Tipo de Item</label>
                    <select value={formData.type} onChange={e => setFormData({ ...formData, type: e.target.value as any })}
                      className="w-full bg-slate-50 border-none rounded-2xl py-3 px-4 focus:ring-2 focus:ring-primary-500/20 text-slate-800 font-bold appearance-none outline-none">
                      {TYPES.map((t: any) => <option key={t.value} value={t.value}>{t.emoji} {t.label}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-slate-700 mb-1.5 ml-1 flex items-center gap-2"><ImageIcon className="w-4 h-4" /> Upload de Imagem</label>
                    <div className="flex gap-2">
                      <input ref={fileInputRef} type="file" accept="image/*" onChange={handleImageUpload} className="hidden" />
                      <button type="button" onClick={() => fileInputRef.current?.click()} disabled={isProcessing}
                        className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-700 px-4 py-3 rounded-2xl font-bold transition-all flex items-center justify-center gap-2 border-2 border-dashed border-slate-300">
                        {isProcessing ? <RefreshCw className="w-5 h-5 animate-spin" /> : <Upload className="w-5 h-5" />}
                        {isProcessing ? 'Enviando...' : 'Selecionar Arquivo'}
                      </button>
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-slate-700 mb-1.5 ml-1 flex items-center gap-2"><ImageIcon className="w-4 h-4" /> URL da Imagem (Opcional)</label>
                    <input type="text" value={formData.assetUrl} onChange={e => setFormData({ ...formData, assetUrl: e.target.value })}
                      className="w-full bg-slate-50 border-none rounded-2xl py-3 px-4 focus:ring-2 focus:ring-primary-500/20 text-slate-800 font-medium" placeholder="Ou cole uma URL direta..." />
                  </div>
                  <div className="aspect-video bg-slate-50 rounded-2xl border-2 border-dashed border-slate-200 flex items-center justify-center overflow-hidden">
                    {formData.assetUrl ? (
                      <img src={formData.assetUrl} className="w-full h-full object-contain p-4" alt="Preview" />
                    ) : (
                      <div className="text-center">
                        <ImageIcon className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                        <span className="text-slate-400 text-xs font-bold">Pré-visualização</span>
                      </div>
                    )}
                  </div>
                </div>
                <div className="md:col-span-2 pt-4 flex gap-4">
                  <button type="button" onClick={() => setIsFormOpen(false)}
                    className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-600 px-6 py-4 rounded-2xl font-bold transition-colors">Cancelar</button>
                  <button type="submit"
                    className="flex-1 bg-primary-600 hover:bg-primary-700 text-white px-6 py-4 rounded-2xl font-bold shadow-lg shadow-primary-200 transition-all flex items-center justify-center gap-2">
                    <Save className="w-5 h-5" /> Salvar Item
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Batch Upload Modal */}
      <AnimatePresence>
        {isBatchOpen && (
          <BatchUploadModal
            onClose={() => { setIsBatchOpen(false); refreshCatalog(); }}
            onComplete={(count) => {
              toast.success(`${count} item${count !== 1 ? 's' : ''} adicionado${count !== 1 ? 's' : ''} à loja! 🎨`);
              refreshCatalog();
            }}
            catalogLength={catalog.length}
            addCatalogItem={addCatalogItem}
            uploadCatalogImage={uploadCatalogImage}
            targetSchoolId={targetSchoolId}
            schools={schools}
            isMaster={isMaster}
            adminSchoolId={adminSchoolId}
          />
        )}
      </AnimatePresence>
    </div>
  );
};
