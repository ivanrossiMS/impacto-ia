import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Plus, 
  Trash2, 
  Edit2, 
  Search, 
  Filter, 
  Sparkles, 
  Coins, 
  Tag, 
  Layout, 
  Image as ImageIcon,
  Save,
  X,
  AlertCircle,
  Upload,
  RefreshCw
} from 'lucide-react';
import { useAvatarStore } from '../../store/avatar.store';
import { cn } from '../../lib/utils';
import { toast } from 'sonner';
import type { AvatarCatalogItem, AvatarRarity } from '../../types/avatar';
import { createBulkNotifications } from '../../lib/notificationUtils';
import { supabase } from '../../lib/supabase';

const RARITIES: { value: AvatarRarity; label: string; color: string }[] = [
  { value: 'comum', label: 'Comum', color: 'bg-slate-400' },
  { value: 'raro', label: 'Raro', color: 'bg-primary-500' },
  { value: 'épico', label: 'Épico', color: 'bg-purple-500' },
  { value: 'lendário', label: 'Lendário', color: 'bg-amber-500' }
];

const TYPES = [
  { value: 'avatar', label: 'Avatar' },
  { value: 'background', label: 'Fundo' },
  { value: 'border', label: 'Moldura' },
  { value: 'sticker', label: 'Adesivo' }
];

export const AvatarManager: React.FC = () => {
    const { catalog, fetchCatalog, addCatalogItem, updateCatalogItem, deleteCatalogItem, isLoading } = useAvatarStore();
    const [isFormOpen, setIsFormOpen] = useState(false);
    const [editingItem, setEditingItem] = useState<AvatarCatalogItem | null>(null);
    const [search, setSearch] = useState('');
    const [filterType, setFilterType] = useState<string>('all');

    const [isProcessing, setIsProcessing] = useState(false);
    const fileInputRef = React.useRef<HTMLInputElement>(null);

    // Form State
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

    useEffect(() => {
        fetchCatalog();
    }, []);

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
                name: '',
                description: '',
                priceCoins: 0,
                rarity: 'comum',
                type: 'avatar',
                assetUrl: '',
                isActive: 1,
                sortOrder: catalog.length + 1
            });
        }
        setIsFormOpen(true);
    };

    const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setIsProcessing(true);
        const reader = new FileReader();
        
        reader.onload = async (event) => {
            const result = event.target?.result as string;
            setFormData({ ...formData, assetUrl: result });
            setIsProcessing(false);
            toast.success('Imagem carregada com sucesso!');
        };
        reader.readAsDataURL(file);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            if (editingItem) {
                await updateCatalogItem(editingItem.id, formData);
                toast.success('Avatar atualizado com sucesso!');
            } else {
                await addCatalogItem(formData);
                
                // Notify students (and Guardians automatically via mirroring)
                const { data: allStudents } = await supabase.from('users').select('id').eq('role', 'student');
                if (allStudents && allStudents.length > 0) {
                  await createBulkNotifications(
                    allStudents.map(s => s.id),
                    'student',
                    'Novos itens na Loja! 🪙',
                    `Novos itens chegaram na Loja de Avatares: "${formData.name}". Confira as novidades!`,
                    'info',
                    'normal',
                    '/student/store'
                  );
                }
                
                toast.success('Novo item adicionado à loja!');
            }
            setIsFormOpen(false);
        } catch (error) {
            toast.error('Erro ao salvar item.');
        }
    };

    const handleDelete = async (id: string) => {
        if (window.confirm('Tem certeza que deseja excluir este item?')) {
            await deleteCatalogItem(id);
            toast.success('Item excluído da loja.');
        }
    };

    const filteredCatalog = catalog.filter(item => {
        const matchesSearch = item.name.toLowerCase().includes(search.toLowerCase());
        const matchesType = filterType === 'all' || item.type === filterType;
        return matchesSearch && matchesType;
    });

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

                <button 
                    onClick={() => handleOpenForm()}
                    className="flex items-center gap-2 bg-primary-600 hover:bg-primary-700 text-white px-6 py-3 rounded-2xl font-bold shadow-lg shadow-primary-200 transition-all scale-hover active:scale-95"
                >
                    <Plus className="w-5 h-5" />
                    Novo Item
                </button>
            </header>

            {/* Filters */}
            <div className="bg-white rounded-[2rem] p-6 shadow-sm border border-slate-100 mb-8 flex flex-col md:flex-row gap-4 items-center">
                <div className="relative flex-1 group">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400 group-focus-within:text-primary-500 transition-colors" />
                    <input 
                        type="text"
                        placeholder="Pesquisar por nome..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className="w-full pl-12 pr-4 py-3 bg-slate-50 border-none rounded-2xl focus:ring-2 focus:ring-primary-500/20 text-slate-700 font-medium w-full"
                    />
                </div>
                
                <div className="flex items-center gap-2 min-w-[200px]">
                    <Filter className="w-5 h-5 text-slate-400" />
                    <select 
                        value={filterType}
                        onChange={(e) => setFilterType(e.target.value)}
                        className="flex-1 bg-slate-50 border-none rounded-2xl py-3 px-4 font-bold text-slate-600 focus:ring-2 focus:ring-primary-500/20 outline-none"
                    >
                        <option value="all">Todos os tipos</option>
                        {TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                    </select>
                </div>
            </div>

            {/* Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                <AnimatePresence>
                    {filteredCatalog.map((item: AvatarCatalogItem) => (
                        <motion.div 
                            key={item.id}
                            layout
                            initial={{ opacity: 0, scale: 0.9 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.8 }}
                            className="bg-white rounded-[2rem] overflow-hidden border border-slate-100 shadow-sm hover:shadow-xl transition-all group flex flex-col h-full"
                        >
                            {/* Preview */}
                            <div className="aspect-square relative bg-slate-50 flex items-center justify-center p-8 group-hover:bg-primary-50/30 transition-colors border-b border-slate-50 overflow-hidden">
                                <img 
                                    src={item.assetUrl} 
                                    className="w-full h-full object-contain filter drop-shadow-xl group-hover:scale-110 transition-transform duration-500" 
                                    alt={item.name} 
                                />
                                <div className="absolute top-4 right-4">
                                    <span className={cn(
                                        "px-3 py-1 rounded-full text-[10px] font-black uppercase text-white shadow-lg",
                                        RARITIES.find(r => r.value === item.rarity)?.color
                                    )}>
                                        {item.rarity}
                                    </span>
                                </div>
                                <div className="absolute top-4 left-4">
                                    <span className="bg-white/80 backdrop-blur-md px-3 py-1 rounded-full text-[10px] font-black uppercase text-slate-600 border border-slate-100">
                                        {item.type}
                                    </span>
                                </div>
                            </div>

                            {/* Info */}
                            <div className="p-6 flex flex-col flex-1">
                                <h3 className="font-bold text-slate-900 text-lg mb-1 leading-tight">{item.name}</h3>
                                <p className="text-slate-500 text-sm line-clamp-2 mb-4 flex-1 italic">"{item.description}"</p>
                                
                                <div className="flex items-center justify-between mt-auto pt-4 border-slate-50">
                                    <div className="flex items-center gap-1 bg-amber-50 text-amber-600 px-3 py-1.5 rounded-xl font-black text-sm border border-amber-100">
                                        <Coins className="w-4 h-4" />
                                        {item.priceCoins}
                                    </div>
                                    
                                    <div className="flex items-center gap-2">
                                        <button 
                                            onClick={() => handleOpenForm(item)}
                                            className="p-2 hover:bg-primary-50 text-slate-400 hover:text-primary-500 rounded-xl transition-colors"
                                        >
                                            <Edit2 className="w-5 h-5" />
                                        </button>
                                        <button 
                                            onClick={() => handleDelete(item.id)}
                                            className="p-2 hover:bg-red-50 text-slate-400 hover:text-red-500 rounded-xl transition-colors"
                                        >
                                            <Trash2 className="w-5 h-5" />
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </motion.div>
                    ))}
                </AnimatePresence>
                
                {filteredCatalog.length === 0 && (
                    <div className="col-span-full py-20 flex flex-col items-center justify-center text-slate-400">
                        <ImageIcon className="w-16 h-16 mb-4 opacity-20" />
                        <p className="font-bold text-xl">Nenhum item encontrado no catálogo</p>
                    </div>
                )}
            </div>

            {/* Modal Form */}
            <AnimatePresence>
                {isFormOpen && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                        <motion.div 
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
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
                                <h2 className="text-2xl font-black text-slate-900 flex items-center gap-3">
                                    {editingItem ? <Edit2 className="w-8 h-8 text-primary-500" /> : <Plus className="w-8 h-8 text-primary-500" />}
                                    {editingItem ? 'Editar Item' : 'Novo Item da Loja'}
                                </h2>
                                <button onClick={() => setIsFormOpen(false)} className="p-2 hover:bg-white rounded-full transition-colors text-slate-400">
                                    <X className="w-6 h-6" />
                                </button>
                            </div>

                            <form onSubmit={handleSubmit} className="p-8 grid grid-cols-1 md:grid-cols-2 gap-6">
                                {/* Basic Info */}
                                <div className="space-y-4">
                                    <div>
                                        <label className="block text-sm font-bold text-slate-700 mb-1.5 ml-1 flex items-center gap-2">
                                            <Tag className="w-4 h-4" /> Nome do Item
                                        </label>
                                        <input 
                                            required
                                            type="text" 
                                            value={formData.name}
                                            onChange={e => setFormData({...formData, name: e.target.value})}
                                            className="w-full bg-slate-50 border-none rounded-2xl py-3 px-4 focus:ring-2 focus:ring-primary-500/20 text-slate-800 font-bold"
                                            placeholder="Ex: Capivara Lendária"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-bold text-slate-700 mb-1.5 ml-1 flex items-center gap-2">
                                            <AlertCircle className="w-4 h-4" /> Legenda / Descrição
                                        </label>
                                        <textarea 
                                            required
                                            rows={3}
                                            value={formData.description}
                                            onChange={e => setFormData({...formData, description: e.target.value})}
                                            className="w-full bg-slate-50 border-none rounded-2xl py-3 px-4 focus:ring-2 focus:ring-primary-500/20 text-slate-800 font-medium resize-none"
                                            placeholder="Descreve o item..."
                                        />
                                    </div>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <label className="block text-sm font-bold text-slate-700 mb-1.5 ml-1 flex items-center gap-2">
                                                <Coins className="w-4 h-4" /> Preço
                                            </label>
                                            <input 
                                                required
                                                type="number" 
                                                min="0"
                                                value={formData.priceCoins}
                                                onChange={e => setFormData({...formData, priceCoins: Number(e.target.value)})}
                                                className="w-full bg-slate-50 border-none rounded-2xl py-3 px-4 focus:ring-2 focus:ring-primary-500/20 text-slate-800 font-black"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-sm font-bold text-slate-700 mb-1.5 ml-1">Raridade</label>
                                            <select 
                                                value={formData.rarity}
                                                onChange={e => setFormData({...formData, rarity: e.target.value as any})}
                                                className="w-full bg-slate-50 border-none rounded-2xl py-3 px-4 focus:ring-2 focus:ring-primary-500/20 text-slate-800 font-bold appearance-none outline-none"
                                            >
                                                {RARITIES.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
                                            </select>
                                        </div>
                                    </div>
                                </div>

                                {/* Media & Type */}
                                <div className="space-y-4">
                                    <div>
                                        <label className="block text-sm font-bold text-slate-700 mb-1.5 ml-1 flex items-center gap-2">
                                            <Layout className="w-4 h-4" /> Tipo de Item
                                        </label>
                                        <select 
                                            value={formData.type}
                                            onChange={e => setFormData({...formData, type: e.target.value as any})}
                                            className="w-full bg-slate-50 border-none rounded-2xl py-3 px-4 focus:ring-2 focus:ring-primary-500/20 text-slate-800 font-bold appearance-none outline-none"
                                        >
                                            {TYPES.map((t: any) => <option key={t.value} value={t.value}>{t.label}</option>)}
                                        </select>
                                    </div>
                                    <div>
                                        <label className="block text-sm font-bold text-slate-700 mb-1.5 ml-1 flex items-center gap-2">
                                            <ImageIcon className="w-4 h-4" /> Upload de Imagem
                                        </label>
                                        <div className="flex gap-2">
                                            <input 
                                                ref={fileInputRef}
                                                type="file" 
                                                accept="image/*"
                                                onChange={handleImageUpload}
                                                className="hidden"
                                            />
                                            <button 
                                                type="button"
                                                onClick={() => fileInputRef.current?.click()}
                                                disabled={isProcessing}
                                                className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-700 px-4 py-3 rounded-2xl font-bold transition-all flex items-center justify-center gap-2 border-2 border-dashed border-slate-300"
                                            >
                                                {isProcessing ? <RefreshCw className="w-5 h-5 animate-spin" /> : <Upload className="w-5 h-5" />}
                                                {isProcessing ? 'Processando...' : 'Selecionar Arquivo'}
                                            </button>
                                        </div>
                                    </div>
                                    <div>
                                        <label className="block text-sm font-bold text-slate-700 mb-1.5 ml-1 flex items-center gap-2">
                                            <ImageIcon className="w-4 h-4" /> URL da Imagem (Opcional)
                                        </label>
                                        <input 
                                            type="text" 
                                            value={formData.assetUrl}
                                            onChange={e => setFormData({...formData, assetUrl: e.target.value})}
                                            className="w-full bg-slate-50 border-none rounded-2xl py-3 px-4 focus:ring-2 focus:ring-primary-500/20 text-slate-800 font-medium"
                                            placeholder="Ou cole uma URL direta..."
                                        />
                                        <p className="mt-2 text-[10px] text-slate-400 ml-1">Imagem original preservada (sem remoção de fundo).</p>
                                    </div>
                                    
                                    {/* Small Preview Box */}
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
                                    <button 
                                        type="button"
                                        onClick={() => setIsFormOpen(false)}
                                        className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-600 px-6 py-4 rounded-2xl font-bold transition-colors"
                                    >
                                        Cancelar
                                    </button>
                                    <button 
                                        type="submit"
                                        className="flex-1 bg-primary-600 hover:bg-primary-700 text-white px-6 py-4 rounded-2xl font-bold shadow-lg shadow-primary-200 transition-all flex items-center justify-center gap-2"
                                    >
                                        <Save className="w-5 h-5" />
                                        Salvar Item
                                    </button>
                                </div>
                            </form>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </div>
    );
};
