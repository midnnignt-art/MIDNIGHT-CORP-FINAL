import React, { useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Loader2 } from 'lucide-react';

const DiscountLanding: React.FC<{ codigo: string }> = ({ codigo }) => {
  useEffect(() => {
    supabase
      .from('campaigns')
      .select('code, label, discount_pct, active, tier_id, tier_name, event_id')
      .eq('code', codigo.toUpperCase())
      .eq('type', 'discount')
      .maybeSingle()
      .then(({ data }) => {
        if (data && data.active) {
          localStorage.setItem('ms_dc_code',     data.code);
          localStorage.setItem('ms_dc_pct',      String(data.discount_pct));
          localStorage.setItem('ms_dc_label',    data.label);
          localStorage.setItem('ms_dc_event_id', data.event_id ?? '');
          if (data.tier_id)   localStorage.setItem('ms_dc_tier_id',   data.tier_id);
          if (data.tier_name) localStorage.setItem('ms_dc_tier_name', data.tier_name);
        }
        window.location.href = '/';
      });
  }, [codigo]);

  return (
    <div className="fixed inset-0 bg-void flex items-center justify-center">
      <Loader2 className="w-8 h-8 text-[#C9A84C] animate-spin" />
    </div>
  );
};

export default DiscountLanding;
