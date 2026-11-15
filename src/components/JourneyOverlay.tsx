import { AlertTriangle, ArrowRight, Compass, FastForward, Flame, Fuel } from 'lucide-react';
import { JourneyWarpSpeed, WORLDS, WorldId } from '../data/missionData';
import { HohmannTransitState } from '../physics/orbitalMechanics';

interface JourneyOverlayProps {
  targetWorldId: WorldId;
  progressPct: number;
  fuelPct: number;
  fuelPasses: boolean;
  warpSpeed: JourneyWarpSpeed;
  transitState?: HohmannTransitState | null;
  onChangeWarpSpeed: (speed: JourneyWarpSpeed) => void;
  onSkipToOrbit?: () => void;
}

const WARP_SPEEDS: JourneyWarpSpeed[] = [1, 1000, 2000, 10000];

export function JourneyOverlay({
  targetWorldId,
  progressPct,
  fuelPct,
  fuelPasses,
  warpSpeed,
  transitState,
  onChangeWarpSpeed,
  onSkipToOrbit,
}: JourneyOverlayProps) {
  const world = WORLDS[targetWorldId];
  const fuelEmpty = fuelPct <= 0;

  const isLocalEarthMoon = targetWorldId === 'moon' || targetWorldId === 'earth';
  const radiusReadout = transitState
    ? isLocalEarthMoon
      ? `${Math.round(transitState.radiusKm).toLocaleString()} km`
      : `${transitState.radiusAU.toFixed(3)} AU (${(transitState.radiusKm / 1e6).toFixed(1)}M km)`
    : world.distanceLabel;

  const phaseBadge =
    transitState?.maneuverPhase === 'tli_burn'
      ? `Δv₁ DEPARTURE INJECTION (${world.hohmannSummary.departureDvKms} km/s)`
      : transitState?.maneuverPhase === 'loi_capture_burn'
      ? `Δv₂ PERIAPSIS RETRO-CAPTURE (${world.hohmannSummary.captureDvKms} km/s)`
      : 'KEPLERIAN BALLISTIC TRANSFER COAST (Vis-Viva)';

  return (
    <>
      <div className="pointer-events-none absolute top-4 left-4 z-20 flex flex-col gap-2 max-w-[92vw]">
        <div className="bg-[#080d1a]/94 border border-slate-800 rounded-lg px-4 py-2 text-xs flex flex-wrap items-center gap-2">
          <span className="font-display font-semibold text-cyan-300">
            NASA GMAT Hohmann Transfer · {warpSpeed.toLocaleString()}× Warp
          </span>
          <span className="text-slate-600">·</span>
          <span className="text-slate-300">
            Earth (1.000 AU) → {world.name} ({world.distanceLabel})
          </span>
          <span className="text-slate-600">·</span>
          <span className="font-mono-tabular text-[11px] text-amber-300">
            Rp = {world.earthRadiusRatio} R⊕ ({world.meanRadiusKm.toLocaleString()} km)
          </span>
        </div>

        {/* Active NASA Maneuver Phase & Retrograde Flip Indicator */}
        <div className="bg-[#080d1a]/92 border border-slate-800/90 rounded-lg px-3.5 py-1.5 text-[11px] font-mono-tabular flex flex-wrap items-center gap-2.5">
          <Flame
            className={`w-3.5 h-3.5 shrink-0 ${
              transitState?.maneuverPhase === 'kepler_coast' ? 'text-cyan-400' : 'text-amber-400'
            }`}
          />
          <span className="text-slate-200 font-semibold">{phaseBadge}</span>
          {transitState && transitState.retroFlipFactor > 0.1 && (
            <span className="px-2 py-0.5 rounded bg-amber-500/20 border border-amber-400/50 text-amber-200 text-[10px]">
              RCS 180° RETROGRADE ATTITUDE ({Math.round(transitState.retroFlipFactor * 180)}°)
            </span>
          )}
        </div>

        {fuelEmpty && (
          <div className="bg-rose-950/95 border border-rose-500 rounded-lg px-4 py-2 text-xs font-mono-tabular text-rose-100 flex items-center gap-2 shadow-xl">
            <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
            <span>PROPELLANT EXHAUSTED · SPACECRAFT ADRIFT IN DEEP SPACE</span>
          </div>
        )}
      </div>

      <div className="pointer-events-auto absolute bottom-5 left-1/2 -translate-x-1/2 z-20 w-[820px] max-w-[95vw] bg-[#080d19]/95 border border-slate-800 rounded-xl px-5 py-4 space-y-3 shadow-2xl">
        {/* Live NASA mission-viz Keplerian & Vis-Viva Telemetry Grid */}
        {transitState && (
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5 pb-2.5 border-b border-slate-800/90 text-[11px] font-mono-tabular">
            <div className="bg-[#050914] border border-slate-800/80 rounded-lg px-2.5 py-1.5">
              <div className="text-[10px] text-slate-400">VIS-VIVA SPEED v(r)</div>
              <div className="text-cyan-300 font-bold text-xs mt-0.5">
                {transitState.instantVelocityKms.toFixed(2)} km/s
              </div>
            </div>
            <div className="bg-[#050914] border border-slate-800/80 rounded-lg px-2.5 py-1.5">
              <div className="text-[10px] text-slate-400">TRUE ANOMALY θ</div>
              <div className="text-amber-300 font-bold text-xs mt-0.5">
                {transitState.trueAnomalyDeg.toFixed(1)}°
              </div>
            </div>
            <div className="bg-[#050914] border border-slate-800/80 rounded-lg px-2.5 py-1.5">
              <div className="text-[10px] text-slate-400">ORBITAL RADIUS r(θ)</div>
              <div className="text-slate-100 font-semibold text-xs mt-0.5 truncate">
                {radiusReadout}
              </div>
            </div>
            <div className="bg-[#050914] border border-slate-800/80 rounded-lg px-2.5 py-1.5">
              <div className="text-[10px] text-slate-400">REMAINING ARC</div>
              <div className="text-emerald-300 font-bold text-xs mt-0.5">
                {transitState.distanceRemainingKm > 1e6
                  ? `${(transitState.distanceRemainingKm / 1e6).toFixed(2)}M km`
                  : `${transitState.distanceRemainingKm.toLocaleString()} km`}
              </div>
            </div>
            <div className="col-span-2 sm:col-span-1 bg-[#050914] border border-slate-800/80 rounded-lg px-2.5 py-1.5">
              <div className="text-[10px] text-slate-400">MISSION TIME (TOF)</div>
              <div className="text-slate-200 font-bold text-xs mt-0.5">
                {transitState.elapsedDays} / {transitState.totalDays} d
              </div>
            </div>
          </div>
        )}

        {/* Transfer Progress + Live Fuel Remaining */}
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex-1 min-w-[240px]">
            <div className="flex justify-between text-xs font-mono-tabular mb-1.5">
              <span className={fuelEmpty ? 'text-rose-300 font-semibold' : 'text-slate-300'}>
                {fuelEmpty
                  ? 'Engine Flameout — Drifting Off Trajectory'
                  : progressPct < 22
                  ? `Δv₁ Escape Burn & Booster Separation (${world.hohmannSummary.vDepartureKms} km/s)`
                  : progressPct < 72
                  ? `Keplerian Elliptical Transfer Cruise (${warpSpeed.toLocaleString()}×)`
                  : `Δv₂ Retrograde Capture Burn into ${world.name} Orbit (${world.orbitAltitudeKm} km)`}
              </span>
              <span className="text-cyan-300 font-semibold">{progressPct}%</span>
            </div>
            <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
              <div
                className={`h-full transition-all duration-150 ${
                  fuelEmpty ? 'bg-rose-500' : 'bg-cyan-400'
                }`}
                style={{ width: `${progressPct}%` }}
              />
            </div>

            {/* Live Propellant Fuel Gauge */}
            <div className="mt-2.5 flex items-center gap-3">
              <div className="flex items-center gap-1.5 text-[11px] font-mono-tabular text-slate-400 shrink-0">
                <Fuel className={`w-3.5 h-3.5 ${fuelEmpty ? 'text-rose-400' : 'text-amber-400'}`} />
                <span>PROPELLANT</span>
              </div>
              <div className="flex-1 h-1.5 bg-slate-800 rounded-full overflow-hidden">
                <div
                  className={`h-full transition-all duration-150 ${
                    fuelEmpty
                      ? 'bg-rose-500'
                      : fuelPct < 25
                      ? 'bg-amber-400'
                      : 'bg-emerald-400'
                  }`}
                  style={{ width: `${Math.max(0, Math.min(100, fuelPct))}%` }}
                />
              </div>
              <span
                className={`text-[11px] font-mono-tabular font-bold w-12 text-right ${
                  fuelEmpty ? 'text-rose-400' : fuelPct < 25 ? 'text-amber-300' : 'text-emerald-300'
                }`}
              >
                {fuelPct}%
              </span>
            </div>
          </div>

          {fuelPasses && !fuelEmpty && onSkipToOrbit && (
            <button
              type="button"
              onClick={onSkipToOrbit}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-medium text-cyan-200 transition-colors whitespace-nowrap cursor-pointer"
            >
              <span>Skip to Orbit</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Time-Warp Speed Multiplier Controls */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-2.5 border-t border-slate-800/90">
          <div className="flex items-center gap-2 text-[11px] font-mono-tabular text-slate-400">
            <FastForward className="w-3.5 h-3.5 text-amber-400" />
            <span>TIME WARP MULTIPLIER</span>
            <span className="hidden md:inline text-slate-600">·</span>
            <span className="hidden md:inline-flex items-center gap-1 text-[10px] text-cyan-300">
              <Compass className="w-3 h-3" /> GMAT Tactical Tracking Scale Active
            </span>
          </div>
          <div className="flex items-center gap-2">
            {WARP_SPEEDS.map((speed) => {
              const active = warpSpeed === speed;
              return (
                <button
                  key={speed}
                  type="button"
                  onClick={() => onChangeWarpSpeed(speed)}
                  className={`px-3.5 py-1.5 rounded-lg border font-mono-tabular text-xs font-bold transition-colors cursor-pointer ${
                    active
                      ? 'bg-amber-500 border-amber-400 text-slate-950 shadow-sm'
                      : 'bg-[#0b1222] border-slate-700 text-slate-200 hover:border-cyan-400/70 hover:text-cyan-200'
                  }`}
                >
                  {speed}×
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </>
  );
}

