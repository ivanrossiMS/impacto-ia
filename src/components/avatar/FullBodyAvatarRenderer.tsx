import React from 'react';

import { motion, AnimatePresence } from 'framer-motion';
import type { AvatarProfile, AvatarLayer, AvatarLayerType } from '../../types/avatar';

interface FullBodyAvatarRendererProps {
  profile: AvatarProfile;
  layers: AvatarLayer[];
  size?: number;
  showShadow?: boolean;
}

export const FullBodyAvatarRenderer: React.FC<FullBodyAvatarRendererProps> = ({
  profile,
  layers,
  size = 512,
  showShadow = true
}) => {
  // Ordered layering strategy
  const layerOrder: AvatarLayerType[] = [
    'background',
    'base_body',
    'bottom',
    'top',
    'shoes',
    'mouth',
    'eyes',
    'hair',
    'headwear',
    'glasses',
    'accessory',
    'effect'
  ];

  const renderLayer = (type: AvatarLayerType) => {
    const layerId = profile.equippedItems?.[type];
    if (!layerId) return null;


    const layer = layers.find(l => l.id === layerId);
    if (!layer) {
      // Fallback to CSS primitive if no image exists yet
      return renderPlaceholder(type);
    }

    return (
      <motion.img
        key={type}
        src={layer.assetUrl || layer.imageUrl}
        alt={layer.name}

        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0 }}
        className="absolute inset-0 w-full h-full object-contain pointer-events-none"
        style={{ zIndex: layerOrder.indexOf(type) * 10 }}
      />
    );
  };

  const renderPlaceholder = (type: AvatarLayerType) => {
    // Elegant fallback visuals while assets are loading/generating
    const colors: Record<string, string> = {
      base_body: profile.skinTone || '#FFDBAC',
      hair: profile.colorOverrides?.hair || '#4b2c20',
      top: '#6366f1',
      bottom: '#475569',
      shoes: '#1e293b'
    };

    if (['eyes', 'mouth', 'background', 'headwear', 'glasses', 'accessory', 'effect'].includes(type) && !profile.equippedItems?.[type]) {
        return null;
    }


    return (
      <div 
        key={`placeholder-${type}`}
        className="absolute inset-0 flex items-center justify-center pointer-events-none"
        style={{ zIndex: layerOrder.indexOf(type) * 10 }}
      >
         {/* Simple abstract shapes to represent the body parts */}
         {type === 'base_body' && (
           <div className="w-1/3 h-2/3 rounded-full" style={{ backgroundColor: colors[type] }} />
         )}
      </div>
    );
  };

  return (
    <div 
      className="relative overflow-hidden rounded-2xl bg-slate-50 shadow-inner"
      style={{ width: size, height: size }}
    >
      <AnimatePresence mode="popLayout">
        {layerOrder.map(type => renderLayer(type))}
      </AnimatePresence>

      {showShadow && (
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 w-1/2 h-4 bg-black/10 blur-xl rounded-full -z-10" />
      )}
    </div>
  );
};
