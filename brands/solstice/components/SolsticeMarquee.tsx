import React from 'react';

interface Props {
  items: string[];
  speedSeconds?: number;     // tiempo en segundos para una vuelta completa
  separator?: React.ReactNode;
  className?: string;
}

/**
 * Marquee horizontal infinito.
 *
 * Duplica los items 2 veces y los desplaza con CSS animation translateX(-50%)
 * para loop suave. Mantiene el tipo de cosa que pondrían los grandes:
 * Posh, Boiler Room, RA, todos tienen un strip así.
 */
export const SolsticeMarquee: React.FC<Props> = ({
  items,
  speedSeconds = 40,
  separator,
  className,
}) => {
  const sep = separator ?? <span style={{ color: '#E6392F', margin: '0 2rem', fontSize: '0.6em' }}>✦</span>;

  return (
    <div
      className={className}
      style={{
        overflow: 'hidden',
        whiteSpace: 'nowrap',
        position: 'relative',
        maskImage: 'linear-gradient(90deg, transparent 0%, #000 8%, #000 92%, transparent 100%)',
        WebkitMaskImage: 'linear-gradient(90deg, transparent 0%, #000 8%, #000 92%, transparent 100%)',
      }}
    >
      <div
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          animation: `solstice-marquee ${speedSeconds}s linear infinite`,
        }}
      >
        {[0, 1].map(i => (
          <React.Fragment key={i}>
            {items.map((item, j) => (
              <React.Fragment key={`${i}-${j}`}>
                <span
                  style={{
                    fontFamily: "'Poiret One', sans-serif",
                    fontSize: 'clamp(2rem, 6vw, 5rem)',
                    fontWeight: 300,
                    letterSpacing: '0.04em',
                    color: '#F9F2D7',
                    textTransform: 'uppercase',
                    flexShrink: 0,
                  }}
                >
                  {item}
                </span>
                {sep}
              </React.Fragment>
            ))}
          </React.Fragment>
        ))}
      </div>

      <style>{`
        @keyframes solstice-marquee {
          0%   { transform: translateX(0%); }
          100% { transform: translateX(-50%); }
        }
      `}</style>
    </div>
  );
};

export default SolsticeMarquee;
