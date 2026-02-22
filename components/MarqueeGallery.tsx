import React from 'react';
import { useStore } from '../context/StoreContext';

const MarqueeGallery: React.FC = () => {
  const { galleryItems } = useStore();

  if (galleryItems.length < 4) {
    return (
      <div className="w-full py-24 flex items-center justify-center border-y border-white/5 bg-void">
        <span className="text-moonlight/30 font-light tracking-[0.2em] uppercase text-sm">
          ── PRÓXIMAMENTE ──
        </span>
      </div>
    );
  }

  const row1 = galleryItems.filter(item => item.row === 1).sort((a, b) => a.order - b.order);
  const row2 = galleryItems.filter(item => item.row === 2).sort((a, b) => a.order - b.order);

  // Duplicate items for seamless loop
  const duplicatedRow1 = [...row1, ...row1];
  const duplicatedRow2 = [...row2, ...row2];

  return (
    <section className="w-full py-12 bg-void overflow-hidden flex flex-col gap-6">
      <style>{`
        @keyframes marquee-left {
          0% { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
        @keyframes marquee-right {
          0% { transform: translateX(-50%); }
          100% { transform: translateX(0); }
        }
        .animate-marquee-left {
          animation: marquee-left 50s linear infinite;
        }
        .animate-marquee-right {
          animation: marquee-right 50s linear infinite;
        }
        @media (max-width: 768px) {
          .animate-marquee-left, .animate-marquee-right {
            animation-duration: 70s;
          }
        }
      `}</style>

      {/* Row 1 */}
      <div className="relative flex whitespace-nowrap">
        <div className="flex gap-4 animate-marquee-left">
          {duplicatedRow1.map((item, idx) => (
            <GalleryCard key={`row1-${item.id}-${idx}`} item={item} />
          ))}
        </div>
      </div>

      {/* Row 2 */}
      <div className="relative flex whitespace-nowrap">
        <div className="flex gap-4 animate-marquee-right">
          {duplicatedRow2.map((item, idx) => (
            <GalleryCard key={`row2-${item.id}-${idx}`} item={item} />
          ))}
        </div>
      </div>
    </section>
  );
};

const GalleryCard: React.FC<{ item: any }> = ({ item }) => {
  return (
    <div className="relative w-[280px] flex-shrink-0 group cursor-default">
      {/* Image Container */}
      <div className="relative aspect-[3/4] overflow-hidden">
        {/* Event Image */}
        <img 
          src={item.image_url || "https://picsum.photos/seed/midnight/280/373"} 
          alt={`${item.city} event`}
          className="w-full h-full object-cover"
          loading="lazy"
        />

        {/* Hover Overlay */}
        <div className="absolute inset-0 bg-void/0 group-hover:bg-void/30 transition-colors duration-400 z-10" />
      </div>

      {/* Footer */}
      <div className="bg-moonlight p-[10px_14px] flex justify-between items-center">
        <span className="text-void font-bold uppercase text-[13px] tracking-[0.12em]">
          {item.city || 'CITY'}
        </span>
        <span className="text-void font-light uppercase text-[11px] tracking-[0.1em]">
          {item.date || 'DATE'}
        </span>
      </div>
    </div>
  );
};

export default MarqueeGallery;
