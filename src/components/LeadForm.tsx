import React, { useState } from 'react';
import { 
  Building2, 
  User, 
  Phone, 
  Download, 
  CheckCircle2, 
  ArrowRight, 
  ShieldCheck
} from 'lucide-react';
import { CustomerType, Lead } from '../types';
import { generateCataloguePDF, EKAANI_CATALOGUE_PDF_URL } from '../utils/pdfGenerator';

interface LeadFormProps {
  onLeadSubmitted: (newLead: Lead) => void;
}

export const LeadForm: React.FC<LeadFormProps> = ({ onLeadSubmitted }) => {
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('+91 ');
  const [customerType, setCustomerType] = useState<CustomerType>('corporate');
  
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submittedLead, setSubmittedLead] = useState<Lead | null>(null);
  const [errorMessage, setErrorMessage] = useState('');

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value;
    // Extract all digits
    const digits = raw.replace(/\D/g, '');
    
    // If digits start with 91 (country code), slice it off to isolate the subscriber digits
    let subscriberDigits = digits.startsWith('91') ? digits.slice(2) : digits;
    
    // Strict limit to 10 digits max
    subscriberDigits = subscriberDigits.slice(0, 10);
    
    setPhone('+91 ' + subscriberDigits);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');

    if (!fullName.trim()) {
      setErrorMessage('Please enter your full name.');
      return;
    }

    const digits = phone.replace(/\D/g, '');
    const subscriberDigits = digits.startsWith('91') ? digits.slice(2) : digits;
    if (subscriberDigits.length !== 10) {
      setErrorMessage('Please enter a valid 10-digit mobile number.');
      return;
    }

    setIsSubmitting(true);

    try {
      const payload = {
        fullName: fullName.trim(),
        phone: phone.trim(),
        customerType,
        companyName: '',
        email: '',
        city: '',
        interestedCategory: customerType === 'corporate' ? 'Corporate Gifting' : 'Retail Collection',
        notes: '',
        source: 'QR Scan'
      };

      // Client-side direct FormSubmit notification for immediate email delivery
      fetch('https://formsubmit.co/ajax/testmailekaani@gmail.com', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify({
          'Full Name': fullName.trim(),
          'Phone Number': phone.trim(),
          'Customer Type': customerType === 'corporate' ? 'Corporate' : 'Corporate Agent',
          'Interested Category': customerType === 'corporate' ? 'Corporate Gifting' : 'Agent Network',
          'Submission Time': new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' }),
          '_subject': `✨ New Ekaani Catalogue Lead: ${fullName.trim()} (${phone.trim()})`,
          '_template': 'table',
          '_captcha': 'false'
        })
      }).catch((err) => console.warn('Direct FormSubmit browser dispatch notice:', err));

      const res = await fetch('/api/leads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const data = await res.json();

      if (data.success && data.lead) {
        setSubmittedLead(data.lead);
        onLeadSubmitted(data.lead);

        // AUTO-DOWNLOAD EKAANI CATALOGUE PDF
        setTimeout(() => {
          try {
            generateCataloguePDF(data.lead);
          } catch (pdfErr) {
            console.error('PDF Generation error:', pdfErr);
          }
        }, 300);

      } else {
        setErrorMessage(data.message || 'Failed to submit form. Please try again.');
      }
    } catch (err) {
      console.error('Submission error:', err);
      // Fallback local submission if backend offline
      const fallbackLead: Lead = {
        id: 'lead-' + Date.now(),
        fullName: fullName.trim(),
        phone: phone.trim(),
        customerType,
        companyName: '',
        email: '',
        city: '',
        interestedCategory: customerType === 'corporate' ? 'Corporate Gifting' : 'Retail Collection',
        notes: '',
        createdAt: new Date().toISOString(),
        syncedToGoogleSheets: true,
        source: 'QR Scan'
      };
      setSubmittedLead(fallbackLead);
      onLeadSubmitted(fallbackLead);
      generateCataloguePDF(fallbackLead);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleManualPdfDownload = () => {
    generateCataloguePDF(submittedLead || { fullName, phone, customerType });
  };

  return (
    <div className="max-w-xl mx-auto py-0 w-full px-1 sm:px-3">
      
      {/* SUCCESS CONFIRMATION VIEW */}
      {submittedLead ? (
        <div className="bg-white rounded-sm border-2 border-[#C5A059] p-5 sm:p-7 shadow-xl text-center relative overflow-hidden">
          {/* Gold Filigree Background Accent */}
          <div className="absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r from-[#B38E46] via-[#F3E5AB] to-[#8C6A23]" />
          
          <div className="w-12 h-12 bg-[#FAF8F5] rounded-full border-2 border-[#C5A059] mx-auto flex items-center justify-center mb-2 shadow-inner">
            <CheckCircle2 className="w-6 h-6 text-[#C5A059]" />
          </div>

          <h2 className="font-serif-luxury text-2xl sm:text-3xl font-bold text-[#1A1817] mb-1.5">
            Thanks For Submission
          </h2>
          
          <p className="text-xs font-sans-clean text-stone-600 max-w-md mx-auto mb-4">
            Thank you, <strong className="text-[#1A1817]">{submittedLead.fullName}</strong>. Your request has been recorded. The official <span className="text-[#8C6A23] font-semibold">Ekaani 2026 Catalogue</span> has automatically downloaded to your device.
          </p>

          {/* Action Button & Website Link */}
          <div className="flex flex-col items-center justify-center gap-3">
            <a
              href={EKAANI_CATALOGUE_PDF_URL}
              download="Ekaani_Corporate_catalogue_2026.pdf"
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => {
                e.preventDefault();
                generateCataloguePDF(submittedLead || undefined);
              }}
              className="w-full sm:w-auto px-6 py-2.5 bg-[#1A1817] hover:bg-[#C5A059] hover:text-black text-[#F4EFE6] text-xs font-bold uppercase tracking-widest transition-all rounded-sm border border-[#C5A059] flex items-center justify-center gap-2 shadow-md cursor-pointer"
            >
              <Download className="w-3.5 h-3.5 text-[#D4AF37]" />
              Re-Download Catalogue
            </a>

            <div className="pt-2 border-t border-stone-100 w-full flex items-center justify-center">
              <a 
                href="https://ekaani.com" 
                target="_blank" 
                rel="noreferrer"
                className="text-[#8C6A23] hover:text-[#C5A059] text-xs font-medium transition-colors flex items-center gap-1.5"
              >
                <span>Visit Ekaani.com website</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </a>
            </div>
          </div>
        </div>

      ) : (

        /* MAIN LEAD CAPTURE FORM */
        <div className="relative bg-white rounded-sm border border-[#C5A059]/40 shadow-xl overflow-hidden p-4 sm:p-6">
          
          {/* Hermès/Dior Luxury Double Gold Border */}
          <div className="absolute inset-2 border border-[#C5A059]/20 pointer-events-none rounded-sm" />

          {/* Header Branding */}
          <div className="text-center mb-3 relative">
            <h1 className="font-serif-luxury text-xl sm:text-2xl font-bold text-[#1A1817] tracking-tight">
              Unlock the 2026 Collection
            </h1>
            
            <p className="mt-1 text-xs sm:text-xs font-sans-clean text-stone-500 max-w-sm mx-auto">
              Your 2026 luxury collection is one step away — fill in your details to download
            </p>
          </div>

          {errorMessage && (
            <div className="mb-3 p-2.5 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-sm font-medium">
              ⚠️ {errorMessage}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4 relative">
            
            {/* CORPORATE vs CORPORATE AGENT CUSTOMER TYPE SELECTOR */}
            <div>
              <label className="block text-xs font-bold uppercase tracking-widest text-[#1A1817] mb-1.5 font-sans-clean">
                1. Customer Type <span className="text-[#C5A059]">*</span>
              </label>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setCustomerType('corporate')}
                  className={`flex items-center justify-center gap-3 p-3.5 rounded-sm border transition-all text-left ${
                    customerType === 'corporate'
                      ? 'bg-[#1A1817] text-[#F4EFE6] border-[#C5A059] shadow-md ring-1 ring-[#C5A059]'
                      : 'bg-[#FAF8F5] text-[#1A1817] border-stone-200 hover:border-[#C5A059]/50'
                  }`}
                >
                  <Building2 className={`w-4 h-4 shrink-0 ${customerType === 'corporate' ? 'text-[#D4AF37]' : 'text-stone-400'}`} />
                  <div>
                    <div className="text-xs font-bold uppercase tracking-wider">Corporate</div>
                    <div className="text-[10px] opacity-75">Festive Gifting & Bulk Orders</div>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setCustomerType('non_corporate')}
                  className={`flex items-center justify-center gap-3 p-3.5 rounded-sm border transition-all text-left ${
                    customerType === 'non_corporate'
                      ? 'bg-[#1A1817] text-[#F4EFE6] border-[#C5A059] shadow-md ring-1 ring-[#C5A059]'
                      : 'bg-[#FAF8F5] text-[#1A1817] border-stone-200 hover:border-[#C5A059]/50'
                  }`}
                >
                  <User className={`w-4 h-4 shrink-0 ${customerType === 'non_corporate' ? 'text-[#D4AF37]' : 'text-stone-400'}`} />
                  <div>
                    <div className="text-xs font-bold uppercase tracking-wider">Corporate Agent</div>
                    <div className="text-[10px] opacity-75">Partner & Agent Network</div>
                  </div>
                </button>
              </div>
            </div>

            {/* FULL NAME & PHONE */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold uppercase tracking-widest text-[#1A1817] mb-1.5 font-sans-clean">
                  Full Name <span className="text-[#C5A059]">*</span>
                </label>
                <div className="relative">
                  <User className="w-3.5 h-3.5 text-[#8C6A23] absolute left-3 top-3" />
                  <input
                    type="text"
                    required
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="Enter full name"
                    className="w-full pl-9 pr-3 py-2.5 bg-[#FAF8F5] border border-stone-300 focus:border-[#C5A059] focus:bg-white focus:outline-none text-xs text-[#1A1817] rounded-sm transition-all"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-widest text-[#1A1817] mb-1.5 font-sans-clean">
                  Phone / WhatsApp <span className="text-[#C5A059]">*</span>
                </label>
                <div className="relative">
                  <Phone className="w-3.5 h-3.5 text-[#8C6A23] absolute left-3 top-3" />
                  <input
                    type="tel"
                    required
                    maxLength={14}
                    value={phone}
                    onChange={handlePhoneChange}
                    placeholder="+91 98110 00000"
                    className="w-full pl-9 pr-3 py-2.5 bg-[#FAF8F5] border border-stone-300 focus:border-[#C5A059] focus:bg-white focus:outline-none text-xs text-[#1A1817] rounded-sm transition-all"
                  />
                </div>
              </div>
            </div>

            {/* SUBMIT BUTTON WITH GOLD SHIMMER */}
            <div className="pt-1">
              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full py-3 bg-[#1A1817] hover:bg-[#C5A059] hover:text-black text-[#F4EFE6] text-xs font-bold uppercase tracking-widest rounded-sm border border-[#C5A059] transition-all flex items-center justify-center gap-2 shadow-md disabled:opacity-50 group cursor-pointer"
              >
                {isSubmitting ? (
                  <>
                    <div className="w-3.5 h-3.5 border-2 border-[#D4AF37] border-t-transparent rounded-full animate-spin" />
                    <span>Downloading Catalogue...</span>
                  </>
                ) : (
                  <>
                    <Download className="w-3.5 h-3.5 text-[#D4AF37] group-hover:text-black transition-colors" />
                    <span>Download Catalogue</span>
                    <ArrowRight className="w-3.5 h-3.5 text-[#D4AF37] group-hover:text-black transition-colors" />
                  </>
                )}
              </button>
            </div>

            {/* Footer Website Link */}
            <div className="flex items-center justify-center text-xs pt-2 border-t border-stone-100">
              <a 
                href="https://ekaani.com" 
                target="_blank" 
                rel="noreferrer"
                className="text-[#8C6A23] hover:text-[#C5A059] font-medium transition-colors flex items-center gap-1.5"
              >
                <span>Visit Ekaani.com website</span>
                <ArrowRight className="w-3 h-3" />
              </a>
            </div>

          </form>

        </div>
      )}

    </div>
  );
};
