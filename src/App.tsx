import React, { useState } from 'react';
import { LeadForm } from './components/LeadForm';
import { Lead } from './types';

const EKAANI_LOGO_SVG = 'https://cdn.shopify.com/s/files/1/0748/5014/0446/files/Layer_x0020_1_83f4e6f8-cf11-4a6c-9d21-9bb72e6775d8.svg?v=1683268225';

export default function App() {
  const [, setLeads] = useState<Lead[]>([]);

  const handleLeadSubmitted = (newLead: Lead) => {
    setLeads((prev) => [newLead, ...prev]);
  };

  return (
    <div className="bg-[#FAF8F5] text-[#1A1817] flex flex-col font-sans-clean">
      
      {/* BRAND HEADER - SLIM CENTRAL LOGO ONLY */}
      <header className="py-2 px-3 flex items-center justify-center border-b border-[#C5A059]/20 relative bg-[#FAF8F5]">
        <img 
          src={EKAANI_LOGO_SVG} 
          alt="Ekaani Crest" 
          width="120"
          height="28"
          loading="eager"
          // @ts-ignore
          fetchPriority="high"
          className="h-6.5 w-auto object-contain" 
        />
      </header>

      {/* MAIN VIEW CONTENT */}
      <main className="py-2 sm:py-3 px-2 sm:px-4 flex flex-col items-center justify-center">
        <LeadForm 
          onLeadSubmitted={handleLeadSubmitted} 
        />
      </main>

    </div>
  );
}
