import React, { useState, useEffect } from 'react';
import { useStore } from '../context/StoreContext';
import { X, Upload, Trash2, Save } from 'lucide-react';
import { GalleryItem } from '../types';

interface MagicPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

const MagicPanel: React.FC<MagicPanelProps> = ({ isOpen, onClose }) => {
  const { galleryItems, updateGallery } = useStore();
  const [localItems, setLocalItems] = useState<GalleryItem[]>([]);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      // Initialize 20 slots
      const initial = Array.from({ length: 20 }, (_, i) => {
        const row = i < 10 ? 1 : 2;
        const order = i % 10;
        const existing = galleryItems.find(item => item.row === row && item.order === order);
        return existing || {
          id: crypto.randomUUID(),
          image_url: '',
          city: '',
          date: '',
          row: row as 1 | 2,
          order
        };
      });
      setLocalItems(initial);
    }
  }, [isOpen, galleryItems]);

  if (!isOpen) return null;

  const compressImage = (base64Str: string): Promise<string> => {
    return new Promise((resolve) => {
      const img = new Image();
      img.src = base64Str;
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const MAX_WIDTH = 800; // Reduced for localStorage safety
        let width = img.width;
        let height = img.height;

        if (width > MAX_WIDTH) {
          height *= MAX_WIDTH / width;
          width = MAX_WIDTH;
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx?.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', 0.7)); // Compress to 70% quality JPEG
      };
    });
  };

  const handleFileChange = async (index: number, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        alert("Máx 5MB por foto.");
        return;
      }
      const reader = new FileReader();
      reader.onloadend = async () => {
        const compressed = await compressImage(reader.result as string);
        const newItems = [...localItems];
        newItems[index] = { ...newItems[index], image_url: compressed };
        setLocalItems(newItems);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleUrlChange = (index: number, url: string) => {
    const newItems = [...localItems];
    newItems[index] = { ...newItems[index], image_url: url };
    setLocalItems(newItems);
  };

  const handleDelete = (index: number) => {
    const newItems = [...localItems];
    newItems[index] = { ...newItems[index], image_url: '', city: '', date: '' };
    setLocalItems(newItems);
  };

  const handleSave = async () => {
    const activeItems = localItems.filter(item => item.image_url !== '');
    if (activeItems.length < 4) {
      alert("Necesitas al menos 4 imágenes para activar la galería. Agrega más fotos antes de publicar.");
      return;
    }

    await updateGallery(activeItems);
    setToast("Galería actualizada.");
    setTimeout(() => {
      setToast(null);
      onClose();
    }, 2000);
  };

  return (
    <div className="fixed inset-0 z-[100] bg-void overflow-y-auto">
      {/* Noise Texture Overlay */}
      <div className="fixed inset-0 pointer-events-none opacity-0.01 z-[-1] bg-[url('data:image/svg+xml,%3Csvg viewBox=\'0 0 200 200\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cfilter id=\'noiseFilter\'%3E%3CfeTurbulence type=\'fractalNoise\' baseFrequency=\'0.65\' numOctaves=\'3\' stitchTiles=\'stitch\'/%3E%3C/filter%3E%3Crect width=\'100%25\' height=\'100%25\' filter=\'url(%23noiseFilter)\'/%3E%3C/svg%3E')]" />
      
      <div className="max-w-7xl mx-auto px-6 py-12">
        <div className="flex justify-between items-start mb-12">
          <div>
            <h1 className="text-6xl font-black text-moonlight/10 uppercase tracking-tighter mb-2">MÁGIC</h1>
            <h2 className="text-xl font-bold text-moonlight uppercase tracking-widest">Gestión de Imágenes</h2>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-white/5 transition-colors">
            <X className="w-8 h-8 text-moonlight" />
          </button>
        </div>

        <div className="space-y-16">
          {/* Row 1 */}
          <section>
            <div className="flex justify-between items-center mb-6 border-b border-white/10 pb-2">
              <span className="text-moonlight/50 uppercase text-xs tracking-widest">Fila 1 (10 Slots)</span>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-5 lg:grid-cols-10 gap-4">
              {localItems.slice(0, 10).map((item, idx) => (
                <Slot 
                  key={item.id} 
                  item={item} 
                  index={idx} 
                  onChange={(val) => {
                    const next = [...localItems];
                    next[idx] = { ...next[idx], ...val };
                    setLocalItems(next);
                  }}
                  onFileChange={(e) => handleFileChange(idx, e)}
                  onUrlChange={(url) => handleUrlChange(idx, url)}
                  onDelete={() => handleDelete(idx)}
                />
              ))}
            </div>
          </section>

          {/* Row 2 */}
          <section>
            <div className="flex justify-between items-center mb-6 border-b border-white/10 pb-2">
              <span className="text-moonlight/50 uppercase text-xs tracking-widest">Fila 2 (10 Slots)</span>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-5 lg:grid-cols-10 gap-4">
              {localItems.slice(10, 20).map((item, idx) => (
                <Slot 
                  key={item.id} 
                  item={item} 
                  index={idx + 10} 
                  onChange={(val) => {
                    const next = [...localItems];
                    next[idx + 10] = { ...next[idx + 10], ...val };
                    setLocalItems(next);
                  }}
                  onFileChange={(e) => handleFileChange(idx + 10, e)}
                  onUrlChange={(url) => handleUrlChange(idx + 10, url)}
                  onDelete={() => handleDelete(idx + 10)}
                />
              ))}
            </div>
          </section>
        </div>

        <div className="mt-24 flex gap-4 border-t border-white/10 pt-12">
          <button 
            onClick={handleSave}
            className="bg-eclipse text-moonlight px-12 py-4 font-bold uppercase tracking-widest hover:bg-eclipse/80 transition-colors flex items-center gap-2"
          >
            <Save className="w-5 h-5" />
            Guardar y Publicar
          </button>
          <button 
            onClick={() => {
              if(confirm("¿Limpiar toda la galería?")) {
                setLocalItems(Array.from({ length: 20 }, (_, i) => ({
                  id: crypto.randomUUID(),
                  image_url: '',
                  city: '',
                  date: '',
                  row: (i < 10 ? 1 : 2) as 1 | 2,
                  order: i % 10
                })));
              }
            }}
            className="border border-red-500/30 text-red-500 px-12 py-4 font-bold uppercase tracking-widest hover:bg-red-500/10 transition-colors"
          >
            Limpiar Todo
          </button>
          <button 
            onClick={onClose}
            className="border border-white/10 text-moonlight px-12 py-4 font-bold uppercase tracking-widest hover:bg-white/5 transition-colors"
          >
            Cancelar
          </button>
        </div>
      </div>

      {/* Toast */}
      {toast && (
        <div className="fixed bottom-8 right-8 bg-void border border-eclipse px-6 py-3 text-moonlight font-bold uppercase tracking-widest shadow-2xl animate-bounce">
          {toast}
        </div>
      )}
    </div>
  );
};

const Slot: React.FC<{ 
  item: GalleryItem; 
  index: number;
  onChange: (val: Partial<GalleryItem>) => void;
  onFileChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onUrlChange: (url: string) => void;
  onDelete: () => void;
}> = ({ item, onChange, onFileChange, onUrlChange, onDelete }) => {
  return (
    <div className="flex flex-col gap-2">
      <div className="relative aspect-[3/4] bg-white/5 border border-white/10 group overflow-hidden">
        {item.image_url ? (
          <>
            <img src={item.image_url} className="w-full h-full object-cover" />
            <div className="absolute inset-0 bg-void/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
              <label className="p-2 bg-white/10 hover:bg-white/20 cursor-pointer rounded-full">
                <Upload className="w-4 h-4" />
                <input type="file" className="hidden" accept="image/*" onChange={onFileChange} />
              </label>
              <button onClick={onDelete} className="p-2 bg-red-500/20 hover:bg-red-500/40 text-red-500 rounded-full">
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </>
        ) : (
          <label className="absolute inset-0 flex flex-col items-center justify-center cursor-pointer hover:bg-white/5 transition-colors">
            <Upload className="w-6 h-6 text-moonlight/30 mb-2" />
            <span className="text-[10px] text-moonlight/30 uppercase font-bold">Subir</span>
            <input type="file" className="hidden" accept="image/*" onChange={onFileChange} />
          </label>
        )}
      </div>
      
      <div className="space-y-1">
        <input 
          type="text" 
          placeholder="URL de Imagen"
          value={item.image_url.startsWith('data:') ? 'Imagen Subida' : item.image_url}
          onChange={(e) => onUrlChange(e.target.value)}
          disabled={item.image_url.startsWith('data:')}
          className="w-full bg-white/5 border border-white/15 px-2 py-1 text-[9px] text-white placeholder:text-white/20 focus:outline-none focus:border-eclipse disabled:opacity-50"
        />
        <input 
          type="text" 
          placeholder="Ciudad"
          value={item.city}
          onChange={(e) => onChange({ city: e.target.value.toUpperCase() })}
          className="w-full bg-white/5 border border-white/15 px-2 py-1 text-[10px] text-white placeholder:text-white/20 focus:outline-none focus:border-eclipse"
        />
        <input 
          type="text" 
          placeholder="Fecha"
          value={item.date}
          onChange={(e) => onChange({ date: e.target.value })}
          className="w-full bg-white/5 border border-white/15 px-2 py-1 text-[10px] text-white placeholder:text-white/20 focus:outline-none focus:border-eclipse"
        />
      </div>
    </div>
  );
};

export default MagicPanel;
