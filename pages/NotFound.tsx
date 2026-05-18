import React, { useEffect } from 'react';

export const NotFound: React.FC = () => {
  useEffect(() => {
    document.title = '404 — Página no encontrada | MIDNIGHT CORP';
    // Marca para SEO de SPA: meta robots noindex en esta vista
    const meta = document.createElement('meta');
    meta.name = 'robots';
    meta.content = 'noindex, follow';
    document.head.appendChild(meta);
    return () => { document.head.removeChild(meta); };
  }, []);

  return (
    <div className="min-h-screen bg-void text-moonlight flex flex-col items-center justify-center px-6 text-center">
      <div className="mb-10">
        <h1 className="text-xl md:text-3xl font-black tracking-[-0.1em] text-moonlight">MIDNIGHT</h1>
        <p className="text-[8px] font-light tracking-[0.8em] uppercase -mt-1 text-moonlight/70">Worldwide</p>
      </div>

      <p className="text-[10px] md:text-[11px] font-black uppercase tracking-[0.4em] text-moonlight/40 mb-4">
        Error 404
      </p>
      <h2 className="text-3xl md:text-5xl font-black uppercase tracking-tighter mb-4">
        Esta página no existe
      </h2>
      <p className="text-moonlight/50 text-sm md:text-base max-w-md mb-10 leading-relaxed">
        El enlace puede estar caducado, mal escrito, o el evento ya terminó.
        Te llevamos de vuelta al inicio.
      </p>

      <a
        href="/"
        className="bg-white text-black font-black text-[11px] uppercase tracking-[0.3em] px-8 py-4 rounded-full hover:opacity-90 transition-opacity"
      >
        Volver al inicio
      </a>
    </div>
  );
};

export default NotFound;
