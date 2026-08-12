import React from 'react';
import { X, Share2, MessageCircle, Instagram, Facebook, GitFork, User, ArrowRight } from 'lucide-react';
import { dataAdapter } from '../services/dataAdapter';

export default function MemberProfileModal({ memberId, onClose, onNavigateToTree, onSelectMember }) {
  if (!memberId) return null;

  const member = dataAdapter.getMemberById(memberId);
  if (!member) return null;

  const { father } = dataAdapter.getParents(memberId);

  // Formatted DOB: Show DOB if present, otherwise strictly "जन्म तिथि: उपलब्ध नहीं"
  const dobDisplay = member.DOB 
    ? `जन्म तिथि: ${member.DOB}`
    : `जन्म तिथि: उपलब्ध नहीं`;

  // Share profile text via WhatsApp
  const handleShareWhatsApp = () => {
    const text = `परिवार सदस्य: ${member.Full_Name}\n${member.Marriage_Note ? `विवाह स्थिति: ${member.Marriage_Note}\n` : ''}${dobDisplay}\nFamily-GenApp Portal`;
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank');
  };

  const handleFacebookShare = () => {
    window.open(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(window.location.href)}`, '_blank');
  };

  const handleInstagramShare = () => {
    window.open('https://instagram.com', '_blank');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-fadeIn" onClick={onClose}>
      <div 
        className="relative w-full max-w-sm bg-gradient-to-b from-slate-900 via-slate-900 to-indigo-950/90 border border-slate-800 rounded-3xl p-6 shadow-2xl text-slate-100 flex flex-col items-center text-center overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Ambient Top Glow */}
        <div className="absolute -top-16 inset-x-0 h-32 bg-indigo-500/20 rounded-full blur-2xl pointer-events-none" />

        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2.5 rounded-full bg-slate-800/80 text-slate-400 hover:text-white hover:bg-slate-700 transition-all border border-slate-700/50"
          aria-label="Close modal"
        >
          <X className="w-5 h-5" />
        </button>

        {/* 1. Profile Image (Rounded avatar centered at top) */}
        <div className="relative mt-2 mb-3">
          <div className="w-28 h-28 rounded-full p-1 bg-gradient-to-tr from-amber-400 via-amber-500 to-yellow-600 shadow-xl shadow-indigo-500/20">
            <img
              src={member.Profile_Image}
              alt={member.Full_Name}
              className="w-full h-full rounded-full object-cover bg-slate-950 border-2 border-slate-900"
            />
          </div>
        </div>

        {/* 2. Full Name */}
        <h2 className="text-2xl font-black text-white tracking-tight leading-snug px-2">
          {member.Full_Name}
        </h2>

        {/* Marriage Badge & Extra Notes */}
        <div className="flex flex-wrap items-center justify-center gap-1.5 mt-2">
          {member.Marriage_Note ? (
            <span className="flex items-center gap-1 px-3 py-1 text-xs font-extrabold bg-amber-500/20 text-amber-300 border border-amber-500/40 rounded-full shadow-inner">
              💍 विवाह स्थिति: {member.Marriage_Note} ({member.Marriages_Count} शादियाँ)
            </span>
          ) : null}

          {member.Notes && member.Notes.map((note, idx) => (
            <span key={idx} className="px-2.5 py-0.5 text-[11px] font-bold bg-indigo-500/20 text-indigo-300 border border-indigo-500/40 rounded-full">
              {note}
            </span>
          ))}
        </div>

        {/* 3. DOB / Birth Year (Only DOB if present, otherwise "जन्म तिथि: उपलब्ध नहीं") */}
        <p className="mt-2.5 text-xs font-semibold text-indigo-300 bg-indigo-950/80 px-4 py-1.5 rounded-full border border-indigo-800/60 shadow-inner">
          {dobDisplay}
        </p>

        {/* Quick Relationship Actions */}
        <div className="w-full mt-4 pt-3 border-t border-slate-800/80 flex flex-col gap-2">
          {father && (
            <button
              onClick={() => onSelectMember(father.Person_ID)}
              className="w-full flex items-center justify-between px-4 py-2.5 rounded-xl bg-slate-800/60 hover:bg-slate-800 border border-slate-700/50 text-xs font-semibold text-slate-200 transition-all group"
            >
              <span className="flex items-center gap-2 text-indigo-400">
                <User className="w-4 h-4" />
                पिता (Father): <strong className="text-white group-hover:text-indigo-300 transition-colors">{father.Full_Name}</strong>
              </span>
              <ArrowRight className="w-3.5 h-3.5 text-slate-400 group-hover:translate-x-0.5 transition-transform" />
            </button>
          )}

          {/* Primary Action Button: View Family Tree */}
          <button
            onClick={() => {
              onClose();
              if (onNavigateToTree) onNavigateToTree(member.Person_ID);
            }}
            className="w-full mt-1 flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-gradient-to-r from-indigo-600 via-indigo-500 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-bold text-sm shadow-lg shadow-indigo-600/30 transition-all hover:scale-[1.02] active:scale-[0.98]"
          >
            <GitFork className="w-4 h-4" />
            पारिवारिक वृक्ष देखें (View Family Tree)
          </button>
        </div>

        {/* 4. Social Media Links */}
        <div className="w-full mt-4 pt-3 border-t border-slate-800/60 flex items-center justify-center gap-4">
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mr-1">शेयर करें:</span>
          
          <button
            onClick={handleShareWhatsApp}
            className="p-2.5 rounded-full bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500 hover:text-white border border-emerald-500/30 transition-all shadow-md hover:scale-110 active:scale-95"
            title="WhatsApp पर शेयर करें"
          >
            <MessageCircle className="w-4 h-4" />
          </button>

          <button
            onClick={handleFacebookShare}
            className="p-2.5 rounded-full bg-blue-500/10 text-blue-400 hover:bg-blue-600 hover:text-white border border-blue-500/30 transition-all shadow-md hover:scale-110 active:scale-95"
            title="Facebook पर साझा करें"
          >
            <Facebook className="w-4 h-4" />
          </button>

          <button
            onClick={handleInstagramShare}
            className="p-2.5 rounded-full bg-pink-500/10 text-pink-400 hover:bg-pink-600 hover:text-white border border-pink-500/30 transition-all shadow-md hover:scale-110 active:scale-95"
            title="Instagram खोलें"
          >
            <Instagram className="w-4 h-4" />
          </button>

          <button
            onClick={handleShareWhatsApp}
            className="p-2.5 rounded-full bg-indigo-500/10 text-indigo-400 hover:bg-indigo-600 hover:text-white border border-indigo-500/30 transition-all shadow-md hover:scale-110 active:scale-95"
            title="डायरेक्ट शेयर"
          >
            <Share2 className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
