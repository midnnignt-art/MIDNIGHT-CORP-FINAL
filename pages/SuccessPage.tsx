import React from 'react';
import { CheckCircle2, Home } from 'lucide-react';
import { Button } from '../components/ui/button';
import { motion as _motion } from 'framer-motion';

const motion = _motion as any;

export const SuccessPage: React.FC = () => {
  return (
    <div className="min-h-screen bg-void relative overflow-hidden flex items-center justify-center p-6">
      {/* Background glows — brand colors */}
      <div className="absolute top-[-15%] left-1/2 -translate-x-1/2 w-[700px] h-[700px] bg-eclipse/15 blur-[180px] rounded-full pointer-events-none" />
      <div className="absolute bottom-[-15%] right-[-10%] w-[400px] h-[400px] bg-neon-purple/8 blur-[140px] rounded-full pointer-events-none" />
      <div className="absolute top-[40%] left-[-10%] w-[300px] h-[300px] bg-midnight/60 blur-[120px] rounded-full pointer-events-none" />

      <motion.div
        initial={{ opacity: 0, scale: 0.92, y: 24 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.6, type: 'spring', damping: 22, stiffness: 160 }}
        className="relative z-10 max-w-md w-full"
      >
        {/* Card — ticket-stub aesthetic con brand colors */}
        <div className="bg-midnight border border-moonlight/8 shadow-[0_40px_100px_rgba(73,15,124,0.25),0_0_0_1px_rgba(242,242,242,0.03)]">

          {/* Top section */}
          <div className="p-8 md:p-10 text-center">
            {/* Check icon con glow de eclipse */}
            <motion.div
              initial={{ scale: 0, rotate: -15 }}
              animate={{ scale: 1, rotate: 0 }}
              transition={{ delay: 0.25, type: 'spring', stiffness: 220, damping: 18 }}
              className="relative w-20 h-20 mx-auto mb-7"
            >
              <div className="absolute inset-0 bg-eclipse/50 blur-2xl rounded-full scale-110" />
              <div className="relative w-full h-full bg-eclipse border border-eclipse/40 rounded-full flex items-center justify-center shadow-[0_0_40px_rgba(73,15,124,0.6)]">
                <CheckCircle2 className="w-10 h-10 text-moonlight" strokeWidth={1.5} />
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4, duration: 0.5 }}
            >
              <h1 className="text-3xl md:text-4xl font-black text-moonlight uppercase tracking-tighter leading-none mb-3">
                ¡Pago Exitoso!
              </h1>
              <div className="w-16 h-px bg-eclipse mx-auto mb-5" />
              <p className="text-moonlight/50 text-sm leading-relaxed font-light max-w-sm mx-auto">
                Tu orden ha sido procesada correctamente. Hemos enviado los tickets y el recibo a tu correo electrónico.
              </p>
            </motion.div>
          </div>

          {/* Divider dashed — ticket stub cut */}
          <div className="relative border-t border-dashed border-moonlight/10 mx-6">
            <div className="absolute -left-9 top-1/2 -translate-y-1/2 w-6 h-6 rounded-full bg-void border border-moonlight/8" />
            <div className="absolute -right-9 top-1/2 -translate-y-1/2 w-6 h-6 rounded-full bg-void border border-moonlight/8" />
          </div>

          {/* Bottom section */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.55, duration: 0.5 }}
            className="p-6 md:p-8 space-y-4"
          >
            <Button
              fullWidth
              onClick={() => window.location.href = '/'}
              className="h-14 bg-eclipse hover:bg-eclipse/80 text-moonlight font-black text-sm tracking-[0.3em] uppercase rounded-2xl border-0 shadow-[0_0_40px_rgba(73,15,124,0.3)] hover:shadow-[0_0_60px_rgba(73,15,124,0.5)] transition-all duration-300"
            >
              <Home className="mr-2 w-4 h-4" /> VOLVER AL INICIO
            </Button>

            <p className="text-center text-[9px] text-moonlight/20 font-light uppercase tracking-[0.5em] pt-1">
              Midnight Experience Protocol
            </p>
          </motion.div>
        </div>
      </motion.div>
    </div>
  );
};
