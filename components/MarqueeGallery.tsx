import React from 'react';
import { useStore } from '../context/StoreContext';

const MarqueeGallery: React.FC = () => {
  const { galleryItems } = useStore();

  // Ensure each image URL only appears ONCE in the original set to avoid accidental duplicates in the source
  const uniqueItems = React.useMemo(() => {
    const seen = new Set<string>();
    return galleryItems.filter(item => {
      if (!item.image_url || seen.has(item.image_url)) return false;
      seen.add(item.image_url);
      return true;
    });
  }, [galleryItems]);

  const row1 = uniqueItems.filter(item => item.row === 1).sort((a, b) => a.order - b.order);
  const row2 = uniqueItems.filter(item => item.row === 2).sort((a, b) => a.order - b.order);

  // Enforce minimum of 4 items per row as requested
  if (row1.length < 4 || row2.length < 4) {
    return (
      <div className="w-full py-24 flex items-center justify-center border-y border-white/5 bg-void">
        <span className="text-moonlight/30 font-light tracking-[0.2em] uppercase text-sm">
          ── PRÓXIMAMENTE ──
        </span>
      </div>
    );
  }

  // Duplicate once for seamless infinite loop
  const duplicatedRow1 = [...row1, ...row1];
  const duplicatedRow2 = [...row2, ...row2];

  // Calculate dynamic duration for constant speed
  // Time = Distance / Speed
  const DESKTOP_ITEM_WIDTH = 296; // 280px + 16px gap
  const MOBILE_ITEM_WIDTH = 188;  // 180px + 8px gap
  const DESKTOP_SPEED = 85;       // pixels per second
  const MOBILE_SPEED = 65;        // pixels per second

  // Duration for a single pass of the original set (50% of the duplicated set)
  const duration1 = (row1.length * DESKTOP_ITEM_WIDTH) / DESKTOP_SPEED;
  const duration2 = (row2.length * DESKTOP_ITEM_WIDTH) / DESKTOP_SPEED;
  const mobileDuration1 = (row1.length * MOBILE_ITEM_WIDTH) / MOBILE_SPEED;
  const mobileDuration2 = (row2.length * MOBILE_ITEM_WIDTH) / MOBILE_SPEED;

  return (
    <section className="w-full py-4 md:py-12 bg-void overflow-hidden flex flex-col gap-3 md:gap-6 relative">
      {/* Edge Fades */}
      <div className="absolute inset-y-0 left-0 w-16 md:w-40 bg-gradient-to-r from-void to-transparent z-20 pointer-events-none" />
      <div className="absolute inset-y-0 right-0 w-16 md:w-40 bg-gradient-to-l from-void to-transparent z-20 pointer-events-none" />

      <style>{`
        @keyframes marquee-left-loop {
          0% { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
        @keyframes marquee-right-loop {
          0% { transform: translateX(-50%); }
          100% { transform: translateX(0); }
        }
        
        .row1-animate { animation: marquee-left-loop ${duration1}s linear infinite; }
        .row2-animate { animation: marquee-right-loop ${duration2}s linear infinite; }

        @media (max-width: 768px) {
          .row1-animate { animation-duration: ${mobileDuration1}s; }
          .row2-animate { animation-duration: ${mobileDuration2}s; }
        }
      `}</style>

      {/* Row 1 */}
      <div className="relative flex whitespace-nowrap">
        <div className="flex gap-2 md:gap-4 row1-animate">
          {duplicatedRow1.map((item, idx) => (
            <GalleryCard key={`row1-${item.id}-${idx}`} item={item} />
          ))}
        </div>
      </div>

      {/* Row 2 */}
      <div className="relative flex whitespace-nowrap">
        <div className="flex gap-2 md:gap-4 row2-animate">
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
    <div className="relative w-[180px] md:w-[280px] flex-shrink-0 group cursor-default">
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
      <div className="bg-moonlight p-[6px_10px] md:p-[10px_14px] flex justify-between items-center">
        <span className="text-void font-bold uppercase text-[10px] md:text-[13px] tracking-[0.12em]">
          {item.city || 'CITY'}
        </span>
        <span className="text-void font-light uppercase text-[8px] md:text-[11px] tracking-[0.1em]">
          {item.date || 'DATE'}
        </span>
      </div>
    </div>
  );
};

export default MarqueeGallery;
