import {
  ArrowRight,
  Box,
  Compass,
  Eye,
  Flag,
  RotateCcw,
  Shield,
  X,
} from 'lucide-react';
import { useState } from 'react';
import {
  CommanderConfig,
  FLAG_OPTIONS,
  FlagId,
  SUIT_PALETTE_OPTIONS,
  SuitPaletteId,
  VISOR_OPTIONS,
  VisorColorId,
  WorldId,
} from '../data/missionData';

interface StartMenuOverlayProps {
  commanderConfig: CommanderConfig;
  targetWorldId: WorldId;
  onChangeFlag: (flagId: FlagId) => void;
  onChangeVisor: (visorId: VisorColorId) => void;
  onChangeSuitPalette: (suitPaletteId: SuitPaletteId) => void;
  onToggleAutoRotate: () => void;
  onResetCamera: () => void;
  onStartMission: () => void;
}

function FlagSvgPreview({ flagId }: { flagId: FlagId }) {
  if (flagId === 'tr') {
    return (
      <svg
        viewBox="0 0 36 24"
        className="w-8 h-5 rounded border border-white/25 shrink-0 shadow-sm"
        aria-hidden="true"
      >
        <rect width="36" height="24" fill="#E30A17" />
        <circle cx="13.5" cy="12" r="6" fill="#ffffff" />
        <circle cx="15" cy="12" r="4.8" fill="#E30A17" />
        <polygon
          points="22.8,12 18.7,13.3 20.2,9.8 20.2,14.2 18.7,10.7"
          fill="#ffffff"
        />
      </svg>
    );
  }
  return (
    <svg
      viewBox="0 0 36 24"
      className="w-8 h-5 rounded border border-white/25 shrink-0 shadow-sm"
      aria-hidden="true"
    >
      <rect width="36" height="24" fill="#ffffff" />
      <rect y="0" width="36" height="2" fill="#B22234" />
      <rect y="4" width="36" height="2" fill="#B22234" />
      <rect y="8" width="36" height="2" fill="#B22234" />
      <rect y="12" width="36" height="2" fill="#B22234" />
      <rect y="16" width="36" height="2" fill="#B22234" />
      <rect y="20" width="36" height="2" fill="#B22234" />
      <rect width="15" height="13" fill="#3C3B6E" />
      <circle cx="3.5" cy="3.2" r="0.8" fill="#ffffff" />
      <circle cx="7.5" cy="3.2" r="0.8" fill="#ffffff" />
      <circle cx="11.5" cy="3.2" r="0.8" fill="#ffffff" />
      <circle cx="5.5" cy="6.5" r="0.8" fill="#ffffff" />
      <circle cx="9.5" cy="6.5" r="0.8" fill="#ffffff" />
      <circle cx="3.5" cy="9.8" r="0.8" fill="#ffffff" />
      <circle cx="7.5" cy="9.8" r="0.8" fill="#ffffff" />
      <circle cx="11.5" cy="9.8" r="0.8" fill="#ffffff" />
    </svg>
  );
}

export function StartMenuOverlay({
  commanderConfig,
  onChangeFlag,
  onChangeVisor,
  onChangeSuitPalette,
  onResetCamera,
  onStartMission,
}: StartMenuOverlayProps) {
  const [sketchfabModalOpen, setSketchfabModalOpen] = useState(false);

  const activeVisor =
    VISOR_OPTIONS.find((v) => v.id === commanderConfig.visorId) || VISOR_OPTIONS[0];
  const activeSuit =
    SUIT_PALETTE_OPTIONS.find((s) => s.id === commanderConfig.suitPaletteId) ||
    SUIT_PALETTE_OPTIONS[0];

  return (
    <>
      {/* Top-Left Minimal Floating Title & Primary Mission CTA */}
      <div className="pointer-events-auto absolute top-5 left-5 z-20 max-w-sm space-y-3">
        <div className="bg-[#060b16]/80 backdrop-blur-md border border-slate-800/80 rounded-2xl p-4 shadow-2xl">
          <div className="text-[11px] font-mono-tabular text-cyan-400 tracking-wider">
            TRANQUILITY BASE · APOLLO 11
          </div>
          <h1 className="font-display text-2xl font-bold text-white tracking-tight mt-0.5">
            MissionForge
          </h1>
          <p className="text-xs text-slate-300 mt-1 leading-relaxed">
            Komutan kıyafetini ve görev bayrağını seçip Güneş Sistemi rotasına başla.
          </p>

          <div className="flex items-center gap-2 mt-3.5">
            <button
              type="button"
              onClick={onStartMission}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-xs font-bold text-slate-950 transition-colors shadow-lg cursor-pointer whitespace-nowrap"
            >
              <span>Göreve Başla</span>
              <ArrowRight className="w-4 h-4" />
            </button>

            <button
              type="button"
              onClick={() => setSketchfabModalOpen(true)}
              title="Apollo 11 Tarihi 3B Arşiv Sahnesi"
              className="flex items-center gap-1.5 px-3 py-2.5 rounded-xl bg-[#0c1629] hover:bg-slate-800 border border-cyan-500/40 text-xs font-medium text-cyan-300 transition-colors cursor-pointer whitespace-nowrap"
            >
              <Box className="w-3.5 h-3.5" />
              <span>3B Arşiv</span>
            </button>
          </div>
        </div>
      </div>

      {/* Right Compact Customization Studio Dock */}
      <aside className="pointer-events-auto absolute top-5 right-5 z-20 w-[288px] max-w-[90vw] bg-[#060b16]/85 backdrop-blur-md border border-slate-800/85 rounded-2xl p-4 shadow-2xl space-y-4">
        {/* 1. Compact Flag Selector */}
        <div>
          <div className="flex items-center justify-between text-[11px] font-mono-tabular text-rose-400 mb-2">
            <span className="flex items-center gap-1.5">
              <Flag className="w-3.5 h-3.5" />
              <span>GÖREV BAYRAĞI</span>
            </span>
            <span className="text-slate-400">Kol · Ay · Modül</span>
          </div>

          <div className="grid grid-cols-2 gap-2">
            {FLAG_OPTIONS.map((f) => {
              const active = commanderConfig.flagId === f.id;
              return (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => onChangeFlag(f.id)}
                  className={`rounded-xl border px-2.5 py-2 transition-colors cursor-pointer flex items-center gap-2 ${
                    active
                      ? 'bg-[#13203b] border-rose-400 text-white'
                      : 'bg-[#0b1222]/90 border-slate-800 text-slate-300 hover:border-slate-700'
                  }`}
                >
                  <FlagSvgPreview flagId={f.id} />
                  <span className="font-display font-semibold text-xs truncate">
                    {f.id === 'tr' ? 'Türkiye' : 'ABD'}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* 2. Compact Visor Color Swatch Bar */}
        <div className="pt-3 border-t border-slate-800/80">
          <div className="flex items-center justify-between text-[11px] font-mono-tabular text-cyan-300 mb-2">
            <span className="flex items-center gap-1.5">
              <Eye className="w-3.5 h-3.5" />
              <span>KASK VİZÖRÜ</span>
            </span>
            <span className="text-slate-200 font-sans font-medium truncate max-w-[130px]">
              {activeVisor.name}
            </span>
          </div>

          <div className="flex items-center justify-between gap-2 bg-[#0b1222]/90 border border-slate-800/90 rounded-xl p-2">
            {VISOR_OPTIONS.map((v) => {
              const active = commanderConfig.visorId === v.id;
              return (
                <button
                  key={v.id}
                  type="button"
                  title={v.name}
                  onClick={() => onChangeVisor(v.id)}
                  className={`w-9 h-9 rounded-full transition-transform cursor-pointer flex items-center justify-center ${
                    active
                      ? 'scale-110 ring-2 ring-cyan-400 ring-offset-2 ring-offset-[#0b1222]'
                      : 'opacity-80 hover:opacity-100 hover:scale-105'
                  }`}
                  style={{
                    background: `radial-gradient(circle at 32% 30%, #ffffff 0%, ${v.colorHex} 48%, ${v.emissiveHex} 100%)`,
                  }}
                />
              );
            })}
          </div>
        </div>

        {/* 3. Compact Suit 3-Tone Color Palette Selector */}
        <div className="pt-3 border-t border-slate-800/80">
          <div className="flex items-center justify-between text-[11px] font-mono-tabular text-amber-300 mb-2">
            <span className="flex items-center gap-1.5">
              <Shield className="w-3.5 h-3.5" />
              <span>KIYAFET PALETİ</span>
            </span>
            <span className="text-slate-200 font-sans font-medium truncate max-w-[130px]">
              {activeSuit.name}
            </span>
          </div>

          <div className="space-y-1.5">
            {SUIT_PALETTE_OPTIONS.map((s) => {
              const active = commanderConfig.suitPaletteId === s.id;
              return (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => onChangeSuitPalette(s.id)}
                  className={`w-full text-left rounded-xl border px-3 py-2 transition-colors cursor-pointer flex items-center justify-between gap-2 ${
                    active
                      ? 'bg-[#13203b] border-amber-400'
                      : 'bg-[#0b1222]/90 border-slate-800 hover:border-slate-700'
                  }`}
                >
                  <span className="font-display font-semibold text-xs text-slate-100 truncate">
                    {s.name}
                  </span>

                  {/* 3-Tone Palette Swatch Preview (Primary, Secondary, Accent) */}
                  <div className="flex items-center -space-x-1 shrink-0">
                    <span
                      className="w-4 h-4 rounded-full border border-slate-950"
                      style={{ backgroundColor: s.primaryHex }}
                    />
                    <span
                      className="w-4 h-4 rounded-full border border-slate-950"
                      style={{ backgroundColor: s.secondaryHex }}
                    />
                    <span
                      className="w-4 h-4 rounded-full border border-slate-950"
                      style={{ backgroundColor: s.accentHex }}
                    />
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </aside>

      {/* Bottom-Center Minimal Camera Hint */}
      <div className="pointer-events-auto absolute bottom-4 left-1/2 -translate-x-1/2 z-20 flex items-center gap-2.5 bg-[#060b16]/80 backdrop-blur-md border border-slate-800/80 rounded-xl px-3.5 py-1.5 shadow-xl">
        <Compass className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
        <span className="text-xs text-slate-300 whitespace-nowrap">
          360° İncelemek İçin Sürükle · Yakınlaşmak İçin Kaydır
        </span>
        <button
          type="button"
          onClick={onResetCamera}
          className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-800/90 hover:bg-slate-700 text-xs text-slate-200 hover:text-amber-300 transition-colors cursor-pointer whitespace-nowrap"
        >
          <RotateCcw className="w-3 h-3" />
          <span>Sıfırla</span>
        </button>
      </div>

      {/* Interactive Sketchfab Apollo 11 Moon Landing 3D Embed Modal */}
      {sketchfabModalOpen && (
        <div className="pointer-events-auto fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4">
          <div className="relative w-full max-w-4xl h-[78vh] flex flex-col bg-[#080d19] border border-cyan-500/40 rounded-2xl overflow-hidden shadow-2xl">
            <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-800 bg-[#0b1324]">
              <div>
                <div className="text-[11px] font-mono-tabular text-cyan-400">
                  SKETCHFAB 3B ARŞİV MODELİ · ARCK-PROJECT
                </div>
                <h3 className="font-display text-base font-bold text-white">
                  Apollo 11 Moon Landing (Recreation) — Sea of Tranquility
                </h3>
              </div>

              <button
                type="button"
                onClick={() => setSketchfabModalOpen(false)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs text-slate-200 cursor-pointer"
              >
                <X className="w-4 h-4" />
                <span>Kapat</span>
              </button>
            </div>

            <div className="relative flex-1 w-full bg-black">
              <iframe
                title="Apollo 11 Moon Landing (Recreation)"
                className="w-full h-full border-0"
                allowFullScreen
                allow="autoplay; fullscreen; xr-spatial-tracking"
                src="https://sketchfab.com/models/61ac05690933458d9bec728992027605/embed?autostart=1&ui_theme=dark"
              />
            </div>
          </div>
        </div>
      )}
    </>
  );
}
