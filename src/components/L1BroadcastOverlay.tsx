import {
  Activity,
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  Cpu,
  Radio,
  RotateCcw,
  Shield,
  ShieldAlert,
  Sun,
  Zap,
} from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  CraftStats,
  HangarConfig,
  MINXSS_OPTIONS,
  POWER_SOURCES,
  SHIELD_TIERS,
} from '../data/missionData';
import { AppLang } from './TopBar';

interface L1BroadcastOverlayProps {
  lang: AppLang;
  config: HangarConfig;
  stats: CraftStats;
  onFlareVisualChange?: (flareIntensity01: number, isBroadcasting: boolean) => void;
  onReturnToOrbit: () => void;
  onReturnToHangar: () => void;
}

type BroadcastPhase =
  | 'monitoring'
  | 'flare_erupting'
  | 'flare_detected'
  | 'broadcasting'
  | 'completed';

export function L1BroadcastOverlay({
  lang,
  config,
  stats,
  onFlareVisualChange,
  onReturnToOrbit,
  onReturnToHangar,
}: L1BroadcastOverlayProps) {
  const isTr = lang === 'tr';

  const selectedMinxss = useMemo(
    () =>
      MINXSS_OPTIONS.find((m) => m.id === (config.minxssTier ?? 'minxss_2')) ??
      MINXSS_OPTIONS[1],
    [config.minxssTier]
  );
  const selectedShield = useMemo(
    () =>
      SHIELD_TIERS.find((s) => s.id === (config.shieldTier ?? 'medium')) ??
      SHIELD_TIERS[1],
    [config.shieldTier]
  );
  const selectedPower = useMemo(
    () =>
      POWER_SOURCES.find((p) => p.id === config.powerSource) ?? POWER_SOURCES[1],
    [config.powerSource]
  );

  const [phase, setPhase] = useState<BroadcastPhase>('monitoring');
  const [elapsedDetectSec, setElapsedDetectSec] = useState(0);
  const [broadcastPct, setBroadcastPct] = useState(0);
  const [liveShieldHealth, setLiveShieldHealth] = useState(100);
  const [xrayFluxLog, setXrayFluxLog] = useState<number[]>(() =>
    Array.from({ length: 36 }, (_, i) => 0.14 + Math.sin(i * 0.4) * 0.03)
  );

  const phaseRef = useRef<BroadcastPhase>(phase);
  phaseRef.current = phase;

  const targetDetectionSec = selectedMinxss.detectionSeconds;
  const minShieldHealth = selectedShield.stormIntegrityPct;

  // Evaluate overall success criteria based on Hangar choices
  const evaluation = useMemo(() => {
    const shieldPassed = selectedShield.id !== 'thin';
    const sensorFast = selectedMinxss.detectionSeconds <= 6.0;
    const powerValid = selectedPower.id !== 'solar_array';
    const success = shieldPassed && sensorFast && powerValid;

    const gridSavedPct = !powerValid
      ? 18
      : !shieldPassed
      ? Math.round(selectedMinxss.warningEfficiencyPct * 0.42)
      : selectedShield.id === 'thick'
      ? selectedMinxss.warningEfficiencyPct
      : Math.round(selectedMinxss.warningEfficiencyPct * 0.94);

    return {
      success,
      shieldPassed,
      sensorFast,
      powerValid,
      gridSavedPct,
    };
  }, [selectedMinxss, selectedShield, selectedPower]);

  // Auto-trigger solar flare eruption 1.4 seconds after entering monitoring
  useEffect(() => {
    if (phase !== 'monitoring') return;
    onFlareVisualChange?.(0.08, false);
    const timer = window.setTimeout(() => {
      setPhase('flare_erupting');
      setElapsedDetectSec(0);
      setBroadcastPct(0);
    }, 1400);
    return () => window.clearTimeout(timer);
  }, [phase, onFlareVisualChange]);

  // Simulation loop for X-Ray Flux chart, detection timer, and broadcast progress
  useEffect(() => {
    const interval = window.setInterval(() => {
      const currentPhase = phaseRef.current;

      setXrayFluxLog((prev) => {
        const next = prev.slice(1);
        let sample = 0.15 + (Math.random() - 0.5) * 0.04;
        if (currentPhase === 'flare_erupting') {
          sample = 0.78 + Math.random() * 0.18;
        } else if (currentPhase === 'flare_detected' || currentPhase === 'broadcasting') {
          sample = 0.9 + Math.random() * 0.09;
        } else if (currentPhase === 'completed') {
          sample = 0.55 + Math.random() * 0.1;
        }
        next.push(Math.max(0.05, Math.min(0.99, sample)));
        return next;
      });

      if (currentPhase === 'flare_erupting') {
        setElapsedDetectSec((prev) => {
          const step = targetDetectionSec > 10 ? 0.35 : 0.18;
          const next = Number((prev + step).toFixed(1));
          const progress = Math.min(1, next / targetDetectionSec);
          setLiveShieldHealth(
            Math.round(100 - (100 - minShieldHealth) * Math.min(1, progress * 1.1))
          );
          onFlareVisualChange?.(0.35 + progress * 0.65, false);

          if (next >= targetDetectionSec) {
            setPhase('flare_detected');
            return targetDetectionSec;
          }
          return next;
        });
      } else if (currentPhase === 'broadcasting') {
        setBroadcastPct((prev) => {
          const next = Math.min(100, prev + 5);
          onFlareVisualChange?.(0.95, true);
          if (next >= 100) {
            setPhase('completed');
            return 100;
          }
          return next;
        });
      }
    }, 100);

    return () => window.clearInterval(interval);
  }, [targetDetectionSec, minShieldHealth, onFlareVisualChange]);

  const handleBroadcastWarning = () => {
    setPhase('broadcasting');
    setBroadcastPct(8);
    onFlareVisualChange?.(1.0, true);
  };

  const handleReplayStorm = () => {
    setElapsedDetectSec(0);
    setBroadcastPct(0);
    setLiveShieldHealth(100);
    setPhase('monitoring');
    onFlareVisualChange?.(0.08, false);
  };

  const currentFlareClass =
    phase === 'monitoring'
      ? 'B4.2 (QUIET)'
      : phase === 'flare_erupting'
      ? 'M8.9 → X14.6 CME'
      : 'X14.6 EXTREME FLARE';

  return (
    <div className="pointer-events-none absolute inset-0 z-20 flex flex-col justify-between p-3 sm:p-4 overflow-hidden">
      {/* Top Status Strip */}
      <div className="pointer-events-auto flex flex-wrap items-center justify-between gap-2">
        <div className="bg-[#080d1a]/94 border border-amber-500/50 rounded-xl px-3.5 py-2 flex flex-wrap items-center gap-2.5 text-xs shadow-xl">
          <span className="inline-flex items-center gap-1.5 font-display font-bold text-amber-300">
            <Sun className="w-4 h-4 text-amber-400" />
            <span>
              {isTr
                ? 'AŞAMA 6 · ERKEN UYARI YAYINI (GÜNEŞ–DÜNYA L1)'
                : 'PHASE 6 · EARLY WARNING BROADCAST (SUN–EARTH L1)'}
            </span>
          </span>
          <span className="text-slate-600">·</span>
          <span className="font-mono-tabular text-slate-200">
            1,500,000 km (0.01 AU) · Light Delay: 5.00 s
          </span>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleReplayStorm}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-[#080d1a]/94 border border-slate-800 hover:border-cyan-400/60 text-xs font-medium text-slate-200 cursor-pointer transition-colors"
          >
            <RotateCcw className="w-3.5 h-3.5 text-cyan-400" />
            <span>{isTr ? 'Fırtınayı Yeniden Simüle Et' : 'Replay Solar Storm'}</span>
          </button>

          <button
            type="button"
            onClick={onReturnToOrbit}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-[#080d1a]/94 border border-slate-800 hover:border-slate-700 text-xs font-medium text-slate-300 cursor-pointer transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>{isTr ? 'L1 Yörüngeye Dön' : 'Back to L1 Orbit'}</span>
          </button>
        </div>
      </div>

      {/* Edge-Docked Left & Right Panels — Keeps the Central 3D L1 Probe, Solar Flare & Earth Signal Completely Open */}
      <div className="flex-1 flex flex-col lg:flex-row items-stretch lg:items-end justify-between gap-3 pt-2 overflow-y-auto lg:overflow-visible">
        {/* Left Edge Docked Panel: MinXSS Soft X-Ray Spectrometer Live Waveform & Hangar Hardware */}
        <div className="pointer-events-auto w-full lg:w-[340px] xl:w-[360px] shrink-0 bg-[#070c18]/90 backdrop-blur-md border border-slate-800/90 rounded-2xl p-3.5 shadow-2xl space-y-2.5">
          <div className="flex items-center justify-between gap-2 border-b border-slate-800 pb-2">
            <div className="min-w-0">
              <div className="text-[10px] font-mono-tabular uppercase tracking-wider text-cyan-400 flex items-center gap-1.5">
                <Activity className="w-3.5 h-3.5 shrink-0" />
                <span className="truncate">MINXSS X-RAY (0.1–0.8 nm)</span>
              </div>
              <div className="font-display text-xs sm:text-sm font-bold text-white mt-0.5 truncate">
                {selectedMinxss.name}
              </div>
            </div>

            <span
              className={`shrink-0 px-2 py-0.5 rounded-lg border text-[10px] font-mono-tabular font-bold ${
                phase === 'monitoring'
                  ? 'bg-emerald-950/70 border-emerald-500/50 text-emerald-300'
                  : 'bg-rose-950/80 border-rose-500/70 text-rose-200'
              }`}
            >
              {currentFlareClass}
            </span>
          </div>

          {/* Live SVG X-Ray Flux Waveform Chart */}
          <div className="rounded-xl bg-[#040811]/95 border border-slate-800/90 p-2.5">
            <div className="flex items-center justify-between text-[10px] font-mono-tabular text-slate-400 mb-1">
              <span>X-RAY FLUX (W/m²)</span>
              <span className="text-amber-300">X10 (10⁻³ W/m²)</span>
            </div>

            <svg viewBox="0 0 360 84" className="w-full h-20 overflow-visible">
              {/* X-Class Danger Threshold Line */}
              <line
                x1="0"
                y1="18"
                x2="360"
                y2="18"
                stroke="#f43f5e"
                strokeWidth="1"
                strokeDasharray="4 3"
              />
              {/* M-Class Threshold Line */}
              <line
                x1="0"
                y1="46"
                x2="360"
                y2="46"
                stroke="#f59e0b"
                strokeWidth="0.8"
                strokeDasharray="3 3"
              />

              {/* Live Polyline */}
              <polyline
                fill="none"
                stroke={phase === 'monitoring' ? '#22d3ee' : '#f59e0b'}
                strokeWidth="2.4"
                points={xrayFluxLog
                  .map((val, idx) => {
                    const x = (idx / Math.max(1, xrayFluxLog.length - 1)) * 360;
                    const y = 78 - val * 70;
                    return `${x.toFixed(1)},${y.toFixed(1)}`;
                  })
                  .join(' ')}
              />
            </svg>

            <div className="grid grid-cols-3 gap-1.5 pt-2 border-t border-slate-800/80 text-[10px] font-mono-tabular">
              <div>
                <div className="text-[9px] text-slate-400">
                  {isTr ? 'TESPİT SÜRESİ' : 'DETECT TIME'}
                </div>
                <div
                  className={`font-bold text-xs ${
                    selectedMinxss.detectionSeconds <= 6 ? 'text-cyan-300' : 'text-amber-300'
                  }`}
                >
                  {elapsedDetectSec.toFixed(1)}s / {targetDetectionSec.toFixed(1)}s
                </div>
              </div>
              <div>
                <div className="text-[9px] text-slate-400">
                  {isTr ? 'KALKAN' : 'SHIELD'}
                </div>
                <div
                  className={`font-bold text-xs ${
                    liveShieldHealth >= 80 ? 'text-emerald-300' : 'text-rose-400'
                  }`}
                >
                  {liveShieldHealth}%
                </div>
              </div>
              <div>
                <div className="text-[9px] text-slate-400">
                  {isTr ? 'KORUMA' : 'PROTECTION'}
                </div>
                <div className="font-bold text-xs text-amber-300">
                  {evaluation.gridSavedPct}%
                </div>
              </div>
            </div>
          </div>

          {/* Installed Hangar Hardware Summary */}
          <div className="grid grid-cols-3 gap-1.5 text-[10px] font-mono-tabular">
            <div className="p-2 rounded-lg bg-[#0b1325]/90 border border-slate-800">
              <div className="text-slate-400 flex items-center gap-1">
                <Cpu className="w-3 h-3 text-amber-400 shrink-0" />
                <span>HULL</span>
              </div>
              <div className="text-slate-100 font-semibold mt-0.5 truncate">
                L1 Probe
              </div>
            </div>
            <div className="p-2 rounded-lg bg-[#0b1325]/90 border border-slate-800">
              <div className="text-slate-400 flex items-center gap-1">
                <Shield className="w-3 h-3 text-cyan-400 shrink-0" />
                <span>SHIELD</span>
              </div>
              <div className="text-slate-100 font-semibold mt-0.5 truncate">
                {selectedShield.name}
              </div>
            </div>
            <div className="p-2 rounded-lg bg-[#0b1325]/90 border border-slate-800">
              <div className="text-slate-400 flex items-center gap-1">
                <Zap className="w-3 h-3 text-emerald-400 shrink-0" />
                <span>POWER</span>
              </div>
              <div className="text-slate-100 font-semibold mt-0.5 truncate">
                {selectedPower.name}
              </div>
            </div>
          </div>
        </div>

        {/* Right Edge Docked Panel: Early Warning Broadcast Action & Mission Evaluation */}
        <div className="pointer-events-auto w-full lg:w-[370px] xl:w-[395px] shrink-0 bg-[#070c18]/90 backdrop-blur-md border border-slate-800/90 rounded-2xl p-3.5 sm:p-4 shadow-2xl space-y-3">
          {phase !== 'completed' ? (
            <>
              <div>
                <div className="text-[10px] font-mono-tabular text-amber-300 uppercase tracking-wider flex items-center gap-1.5">
                  <Radio className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                  <span>
                    {isTr
                      ? 'ACİL DURUM TELEMETRİ VERİCİSİ · L1'
                      : 'EMERGENCY TELEMETRY TRANSMITTER · L1'}
                  </span>
                </div>
                <h2 className="font-display text-sm sm:text-base font-bold text-white mt-1 leading-snug">
                  {phase === 'monitoring'
                    ? isTr
                      ? 'Güneş Koronası İzleniyor — X-Işını Taranıyor...'
                      : 'Monitoring Solar Corona — Scanning X-Ray Flux...'
                    : phase === 'flare_erupting'
                    ? isTr
                      ? `X14.6 Güneş Patlaması Algılanıyor! (${elapsedDetectSec.toFixed(1)}s / ${targetDetectionSec}s)`
                      : `Resolving X14.6 Solar Flare Peak! (${elapsedDetectSec.toFixed(1)}s / ${targetDetectionSec}s)`
                    : phase === 'flare_detected'
                    ? isTr
                      ? `Patlama ${targetDetectionSec}s İçinde Tespit Edildi! Sinyali Gönderin!`
                      : `Flare Detected in ${targetDetectionSec}s! Broadcast Signal to Earth!`
                    : isTr
                    ? 'Erken Uyarı Paketi Dünya’ya İletiliyor...'
                    : 'Broadcasting Early Warning Packet to Earth...'}
                </h2>
              </div>

              {/* Progress Bars for Detection & Signal Transmission */}
              <div className="space-y-2.5 bg-[#050914]/95 border border-slate-800 rounded-xl p-3">
                <div>
                  <div className="flex justify-between text-[11px] font-mono-tabular mb-1">
                    <span className="text-slate-300">
                      {isTr
                        ? '1. MinXSS Patlama Kilitleme'
                        : '1. MinXSS Flare Detection Lock'}
                    </span>
                    <span className="text-cyan-300 font-bold">
                      {elapsedDetectSec.toFixed(1)}s / {targetDetectionSec.toFixed(1)}s
                    </span>
                  </div>
                  <div className="h-2 bg-slate-900 rounded-full overflow-hidden border border-slate-800">
                    <div
                      className="h-full bg-cyan-400 transition-all duration-100"
                      style={{
                        width: `${Math.min(100, (elapsedDetectSec / targetDetectionSec) * 100)}%`,
                      }}
                    />
                  </div>
                </div>

                <div>
                  <div className="flex justify-between text-[11px] font-mono-tabular mb-1">
                    <span className="text-slate-300">
                      {isTr
                        ? '2. Dünya Erken Uyarı Yayını (Ka-Bant)'
                        : '2. Earth Warning Broadcast (Ka-Band)'}
                    </span>
                    <span className="text-emerald-300 font-bold">{broadcastPct}%</span>
                  </div>
                  <div className="h-2 bg-slate-900 rounded-full overflow-hidden border border-slate-800">
                    <div
                      className="h-full bg-emerald-400 transition-all duration-100"
                      style={{ width: `${broadcastPct}%` }}
                    />
                  </div>
                </div>
              </div>

              <p className="text-[11px] text-slate-400 leading-relaxed">
                {isTr
                  ? 'CME Dünya manyetosferine çarpmadan önce uyduları güvenli moda almak ve güç şebekelerini korumak için sinyali yayınlayın.'
                  : 'Transmit the warning packet before the CME impacts Earth’s magnetosphere to safe-mode satellites and isolate power grids.'}
              </p>

              <button
                type="button"
                disabled={phase === 'monitoring' || phase === 'broadcasting'}
                onClick={handleBroadcastWarning}
                className={`w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all ${
                  phase === 'flare_detected' || phase === 'flare_erupting'
                    ? 'bg-amber-500 hover:bg-amber-400 text-slate-950 shadow-lg shadow-amber-500/25 cursor-pointer'
                    : 'bg-slate-800 text-slate-500 cursor-not-allowed'
                }`}
              >
                <Radio className="w-4 h-4 shrink-0" />
                <span>
                  {phase === 'broadcasting'
                    ? isTr
                      ? 'Sinyal Gönderiliyor...'
                      : 'Broadcasting Signal...'
                    : isTr
                    ? "Erken Uyarı Sinyalini Dünya'ya Gönder"
                    : 'Broadcast Early Warning Signal to Earth'}
                </span>
              </button>
            </>
          ) : (
            /* Mission Outcome Report Card (Docked to Right Edge) */
            <div className="space-y-2.5">
              <div
                className={`flex items-start gap-2.5 p-3 rounded-xl border ${
                  evaluation.success
                    ? 'bg-emerald-950/45 border-emerald-500/60 text-emerald-100'
                    : 'bg-rose-950/55 border-rose-500/60 text-rose-100'
                }`}
              >
                {evaluation.success ? (
                  <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
                ) : (
                  <AlertTriangle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
                )}
                <div className="min-w-0">
                  <div className="text-[9px] font-mono-tabular uppercase tracking-wider opacity-80">
                    {evaluation.success
                      ? isTr
                        ? 'SENARYO 2 BAŞARILI · ŞEBEKE KORUNDU'
                        : 'SCENARIO 2 SUCCESS · GRID PROTECTED'
                      : isTr
                      ? 'KRİTİK UYARI KAYBI · YÜKSELTME GEREKLİ'
                      : 'DEGRADED WARNING · UPGRADE REQUIRED'}
                  </div>
                  <h3 className="font-display text-xs sm:text-sm font-bold text-white mt-0.5 leading-snug">
                    {evaluation.success
                      ? isTr
                        ? `X14.6 Fırtınası ${targetDetectionSec}s İçinde Yakalandı — %${evaluation.gridSavedPct} Koruma!`
                        : `X14.6 Flare Locked in ${targetDetectionSec}s — ${evaluation.gridSavedPct}% Protection!`
                      : !evaluation.shieldPassed
                      ? isTr
                        ? 'İnce Kalkan (35%) Proton Fırtınasında Hasar Aldı!'
                        : 'Thin Shielding (35%) Suffered Proton Brownout!'
                      : isTr
                      ? `MinXSS-1 (${targetDetectionSec}s) Çok Yavaş Kaldı!`
                      : `MinXSS-1 (${targetDetectionSec}s) Too Slow for X-Flare!`}
                  </h3>
                  <p className="text-[11px] opacity-90 mt-1 leading-relaxed">
                    {evaluation.success
                      ? isTr
                        ? `${selectedMinxss.name} (${targetDetectionSec}s) ve ${selectedShield.name} (%${selectedShield.stormIntegrityPct}) sayesinde uydular ve şebekeler zamanında korundu.`
                        : `${selectedMinxss.name} (${targetDetectionSec}s) and ${selectedShield.name} (${selectedShield.stormIntegrityPct}%) protected Earth’s satellites and power grids in time.`
                      : !evaluation.shieldPassed
                      ? isTr
                        ? 'İnce Kapton kalkan yüksek proton akısında SEU kesintisi yaşadı. Hangar’da Grade-II veya Grade-III kalkan seçin.'
                        : 'Thin Kapton foil suffered SEU avionic brownouts. Upgrade to Grade-II or Grade-III Shielding in the Hangar.'
                      : isTr
                      ? '14.2 saniyelik gecikme erken uyarı süresini aştı. Hangar’da MinXSS-2 (5.2s) veya MinXSS-3 (1.8s) seçin.'
                      : '14.2s detection latency was too slow. Upgrade to MinXSS-2 (5.2s) or MinXSS-3 (1.8s) in the Hangar.'}
                  </p>
                </div>
              </div>

              {/* Breakdown of Hangar Choices vs Criteria */}
              <div className="grid grid-cols-3 gap-1.5 text-[10px] font-mono-tabular">
                <div
                  className={`p-2 rounded-xl border ${
                    evaluation.sensorFast
                      ? 'bg-emerald-950/30 border-emerald-500/40 text-emerald-200'
                      : 'bg-amber-950/40 border-amber-500/50 text-amber-200'
                  }`}
                >
                  <div className="text-[9px] opacity-75">MINXSS LOCK</div>
                  <div className="font-bold text-xs mt-0.5">{targetDetectionSec}s</div>
                  <div className="text-[9px] mt-0.5">
                    {evaluation.sensorFast ? 'PASS (<6s)' : 'SLOW (>6s)'}
                  </div>
                </div>

                <div
                  className={`p-2 rounded-xl border ${
                    evaluation.shieldPassed
                      ? 'bg-emerald-950/30 border-emerald-500/40 text-emerald-200'
                      : 'bg-rose-950/40 border-rose-500/50 text-rose-200'
                  }`}
                >
                  <div className="text-[9px] opacity-75">SHIELDING</div>
                  <div className="font-bold text-xs mt-0.5">
                    {selectedShield.stormIntegrityPct}%
                  </div>
                  <div className="text-[9px] mt-0.5">
                    {evaluation.shieldPassed ? 'PASS' : 'FAIL (SEU)'}
                  </div>
                </div>

                <div className="p-2 rounded-xl border bg-cyan-950/30 border-cyan-500/40 text-cyan-200">
                  <div className="text-[9px] opacity-75">BUDGET LEFT</div>
                  <div className="font-bold text-xs mt-0.5">
                    ${stats.remainingBudgetM}M
                  </div>
                  <div className="text-[9px] mt-0.5 truncate">RTG Active</div>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-0.5">
                <button
                  type="button"
                  onClick={onReturnToHangar}
                  className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-[#0e1b33] hover:bg-[#16294d] border border-cyan-500/50 text-[11px] font-semibold text-cyan-200 cursor-pointer transition-colors"
                >
                  <ShieldAlert className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                  <span className="truncate">
                    {isTr ? 'Hangar’da Düzenle' : 'Edit in Hangar'}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={handleReplayStorm}
                  className="flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-[11px] font-bold text-slate-950 cursor-pointer transition-colors"
                >
                  <RotateCcw className="w-3.5 h-3.5 shrink-0" />
                  <span>{isTr ? 'Tekrar' : 'Replay'}</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
