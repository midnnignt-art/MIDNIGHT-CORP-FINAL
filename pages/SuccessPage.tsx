import React from 'react';
import { CheckCircle2, Home, Ticket, ArrowRight, Sparkles } from 'lucide-react';
import { Button } from '../components/ui/button';
import { motion as _motion } from 'framer-motion';

const motion = _motion as any;

export const SuccessPage: React.FC = () => {
  return (
    <div className="min-h-screen bg-midnight-950 relative overflow-hidden flex items-center justify-center p-6">
       {/* Background effects */}
       <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none">
          <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-neon-purple/10 blur-[120px] rounded-full"></div>
          <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-neon-blue/10 blur-[120px] rounded-full"></div>
       </div>

       <motion.div
         initial={{ opacity: 0, scale: 0.9, y: 20 }}
         animate={{ opacity: 1, scale: 1, y: 0 }}
         transition={{ duration: 0.5, type: "spring" }}
         className="relative z-10 max-w-md w-full bg-zinc-900/80 backdrop-blur-2xl border border-white/10 p-8 md:p-10 rounded-[2.5rem] text-center shadow-2xl shadow-neon-purple/20"
       >
          <motion.div 
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: 0.2, type: "spring" }}
            className="w-24 h-24 bg-gradient-to-tr from-neon-purple to-indigo-600 rounded-full flex items-center justify-center mx-auto mb-8 shadow-lg shadow-neon-purple/40 border-4 border-zinc-900"
          >
              <CheckCircle2 className="w-12 h-12 text-white" />
          </motion.div>

          <h1 className="text-3xl md:text-4xl font-black text-white uppercase tracking-tighter mb-2 leading-none">
            ¡Pago Exitoso!
          </h1>
          
          <div className="w-16 h-1 bg-gradient-to-r from-neon-purple to-neon-blue mx-auto rounded-full mb-4"></div>

          <p className="text-zinc-300 text-sm md:text-base mb-8 leading-relaxed font-medium">
            Tu orden ha sido procesada correctamente en nuestra pasarela segura. Hemos enviado los tickets y el recibo a tu correo electrónico.
          </p>

          <div className="space-y-4">
            <Button
              fullWidth
              onClick={() => window.location.href = '/'}
              className="h-14 bg-white text-black font-black text-sm md:text-base rounded-2xl hover:bg-zinc-200 transition-all shadow-lg hover:shadow-xl hover:scale-[1.02]"
            >
                <Home className="mr-2 w-5 h-5"/> VOLVER AL INICIO
            </Button>

            <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest pt-4">
                Midnight Experience Protocol
            </p>
          </div>
       </motion.div>
    </div>
  );
};