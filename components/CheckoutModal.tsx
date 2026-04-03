
import React from 'react';
import { X } from 'lucide-react';
import { Event } from '../types';
import { useStore } from '../context/StoreContext';
import QuickCheckout from './QuickCheckout';

interface CheckoutModalProps {
  event: Event | null;
  isOpen: boolean;
  onClose: () => void;
}

export const CheckoutModal: React.FC<CheckoutModalProps> = ({ event, isOpen, onClose }) => {
  const { getEventTiers, createOrder } = useStore();

  if (!isOpen || !event) return null;

  const tiers = getEventTiers(event.id);

  const handleComplete = async (data: any) => {
      // QuickCheckout ya devuelve los items con la estructura correcta:
      // { tier_id, tier_name, quantity, unit_price, subtotal }
      // createOrder espera exactamente eso.
      return await createOrder(event.id, data.items, data.method || 'digital', undefined, data.customerInfo);
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center">
      <div className="absolute inset-0 bg-black/80 backdrop-blur-sm transition-opacity" onClick={onClose} />

      <div className="relative w-full sm:max-w-md z-10 sm:p-4">

        {/* Close button — above sheet on mobile, top-right on desktop */}
        <div className="absolute -top-12 right-4 sm:right-0 z-20">
          <button onClick={onClose} className="p-3 bg-white/10 hover:bg-white/20 rounded-full text-white transition-all">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Bottom-sheet wrapper on mobile */}
        <div className="rounded-t-3xl sm:rounded-3xl overflow-hidden max-h-[82vh] sm:max-h-none overflow-y-auto">
          {/* Drag handle — mobile only */}
          <div className="sm:hidden flex justify-center pt-3 pb-1 bg-void">
            <div className="w-10 h-1 rounded-full bg-white/20" />
          </div>

          <QuickCheckout event={event} tiers={tiers} onComplete={handleComplete} />
        </div>

      </div>
    </div>
  );
};