
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
      const orderItems = data.items.map((item: any) => ({
          tierId: item.tier.id,
          quantity: item.quantity
      }));
      
      // Retornamos el resultado de la creación de la orden para que el modal muestre el éxito
      return await createOrder(event.id, orderItems, 'digital', undefined, data.customerInfo);
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/90 backdrop-blur-md transition-opacity" onClick={onClose} />
      <div className="relative w-full max-w-md z-10">
          <div className="absolute -top-14 right-0">
             <button onClick={onClose} className="p-3 bg-white/10 hover:bg-white/20 rounded-full text-white transition-all"><X className="w-6 h-6" /></button>
          </div>
          <QuickCheckout event={event} tiers={tiers} onComplete={handleComplete} />
      </div>
    </div>
  );
};
