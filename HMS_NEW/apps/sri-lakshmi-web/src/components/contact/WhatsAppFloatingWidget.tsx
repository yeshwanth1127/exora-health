import React, { useState } from 'react';
import { Phone, MessageCircle, X, Calendar, ShieldAlert } from 'lucide-react';
import { hospitalInfo, whatsAppQuickOptions } from '../../data/hospitalInfo';
import { VoiceAgentLauncher } from '../voice/VoiceAgentLauncher';
import { trackContactIntent } from '../../lib/posthog';

interface WhatsAppFloatingWidgetProps {
  onOpenBooking: () => void;
}

export const WhatsAppFloatingWidget: React.FC<WhatsAppFloatingWidgetProps> = ({ onOpenBooking }) => {
  const [isOpen, setIsOpen] = useState(false);

  const openWhatsApp = (msg?: string) => {
    trackContactIntent('home', 'whatsapp');
    const message = encodeURIComponent(msg || hospitalInfo.defaultWhatsAppMessage);
    const url = `https://wa.me/${hospitalInfo.whatsappNumber.replace(/[^0-9]/g, '')}?text=${message}`;
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  return (
    <div className="mobile-contact-trigger fixed bottom-6 right-6 z-40 flex flex-col items-end">
      {/* Expanded Quick Action Popover */}
      {isOpen && (
        <div className="mb-3 w-[calc(100vw-32px)] max-w-96 bg-white rounded-2xl shadow-2xl border border-stone-100 overflow-hidden animate-in fade-in slide-in-from-bottom-5 duration-200">
          {/* Header */}
          <div className="bg-[#154734] p-4 text-white flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-emerald-500/20 flex items-center justify-center text-emerald-300">
                <MessageCircle className="w-5 h-5 fill-current" />
              </div>
              <div>
                <div className="font-semibold text-sm">Sri Lakshmi Care Assistance</div>
                <div className="text-[11px] text-emerald-200 flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                  Call reception to confirm availability
                </div>
              </div>
            </div>
            <button
              onClick={() => setIsOpen(false)}
              aria-label="Close care assistance"
              className="text-white/70 hover:text-white min-w-11 min-h-11 grid place-items-center rounded-lg hover:bg-white/10 transition"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Quick Options */}
          <div className="p-4 space-y-2.5 max-h-[min(380px,calc(100dvh-180px))] overflow-y-auto">
            {/* Book Appointment CTA */}
            <button
              onClick={() => {
                setIsOpen(false);
                onOpenBooking();
              }}
              className="w-full text-left p-3 rounded-xl bg-emerald-50 hover:bg-emerald-100/70 border border-emerald-200/60 flex items-center justify-between transition group"
            >
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-emerald-600 text-white flex items-center justify-center">
                  <Calendar className="w-4 h-4" />
                </div>
                <div>
                  <div className="font-semibold text-xs text-emerald-950">Book Doctor Appointment</div>
                  <div className="text-[11px] text-emerald-700">Find a doctor and confirm consultation times</div>
                </div>
              </div>
              <span className="text-xs font-semibold text-emerald-700">Book →</span>
            </button>

            <div className="sm:hidden"><VoiceAgentLauncher inline /></div>

            {/* WhatsApp Intents */}
            <div className="pt-2 pb-1 text-[11px] font-semibold text-stone-400 uppercase tracking-wider">
              Hospital enquiry topics
            </div>
            {whatsAppQuickOptions.map((opt) => (
              <button
                key={opt.id}
                onClick={() => openWhatsApp(opt.message)}
                className="w-full text-left p-2.5 rounded-xl hover:bg-stone-50 border border-stone-100 flex items-center justify-between transition group"
              >
                <div>
                  <div className="font-medium text-xs text-stone-800 group-hover:text-emerald-700 transition">
                    {opt.title}
                  </div>
                  <div className="text-[11px] text-stone-500">{opt.description}</div>
                </div>
                <MessageCircle className="w-4 h-4 text-emerald-600 opacity-60 group-hover:opacity-100 transition" />
              </button>
            ))}

            {/* Direct Telephone Call Bar */}
            <div className="pt-2 border-t border-stone-100 grid grid-cols-2 gap-2">
              <a
                href={`tel:${hospitalInfo.emergencyPhone}`}
                onClick={() => trackContactIntent('home', 'phone')}
                className="p-2.5 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-100 text-center flex flex-col items-center justify-center transition"
              >
                <ShieldAlert className="w-4 h-4 mb-0.5 text-rose-600" />
                <span className="text-[11px] font-bold">Emergency Call</span>
                <span className="text-[9px] text-rose-500">24/7 Casualty</span>
              </a>
              <a
                href={`tel:${hospitalInfo.phone}`}
                onClick={() => trackContactIntent('home', 'phone')}
                className="p-2.5 rounded-xl bg-stone-50 hover:bg-stone-100 text-stone-700 border border-stone-100 text-center flex flex-col items-center justify-center transition"
              >
                <Phone className="w-4 h-4 mb-0.5 text-stone-600" />
                <span className="text-[11px] font-bold">Reception Call</span>
                <span className="text-[9px] text-stone-500">OPD & Info</span>
              </a>
            </div>
          </div>
        </div>
      )}

      {/* Main Floating Trigger Button */}
      <div className="flex items-center gap-2">
        <button
          onClick={() => setIsOpen(!isOpen)}
          aria-label={isOpen ? 'Close care assistance' : 'Open WhatsApp and call options'}
          aria-expanded={isOpen}
          className="flex items-center gap-2 bg-[#25D366] hover:bg-[#20ba59] text-white px-4 py-3 rounded-full shadow-xl hover:shadow-2xl hover:scale-105 active:scale-95 transition-all cursor-pointer group"
        >
          <div className="relative">
            <MessageCircle className="w-5 h-5 fill-current" />
            <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-white rounded-full flex items-center justify-center">
              <span className="w-1.5 h-1.5 bg-emerald-600 rounded-full animate-ping" />
            </span>
          </div>
          <span className="hidden sm:inline font-semibold text-xs pr-1">WhatsApp & Call</span>
        </button>
      </div>
    </div>
  );
};
