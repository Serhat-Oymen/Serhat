import { ArrowRight, Compass, Gauge, Orbit } from 'lucide-react';
import { WORLD_LIST, WORLDS, WorldId } from '../data/missionData';
import { SolarScaleMode } from '../physics/orbitalMechanics';
import { SolarEphemerisTelemetry } from '../three/MissionWorldEngine';

interface PlanetSelectOverlayProps {
  targetWorldId: WorldId;
  solarTelemetry?: SolarEphemerisTelemetry;
  onSelectWorld: (worldId: WorldId) => void;
  onChangeScaleMode?: (mode: SolarScaleMode) => void;
  onChangeTimeSpeed?: (daysPerSec: number) => void;
  onEnterHangar: () => void;
}

const KEPLER_SPEEDS = [1, 10, 60];

export function PlanetSelectOverlay({
  targetWorldId,
  solarTelemetry,
  onSelectWorld,
  onChangeScaleMode,
  onChangeTimeSpeed,
  onEnterHangar,
}: PlanetSelectOverlayProps) {
  const world = WORLDS[targetWorldId];
  const scaleMode = solarTelemetry?.scaleMode ?? 'orrery_proportional';
  const timeSpeed = solarTelemetry?.timeSpeedDaysPerSec ?? 10;

  return (
    <>
      <div className="pointer-events-auto absolute top-4 left-4 z-20 flex flex-col gap-2 max-w-[92vw]">
        <div className="bg-[#080d1a]/92 border border-slate-800 rounded-lg px-3.5 py-2 text-xs text-slate-300 flex flex-wrap items-center gap-2.5 shadow-lg">
          <Compass className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
          <span>Drag to orbit · Scroll to zoom · Click any planet for NASA ephemeris</span>
          <span className="text-slate-600 hidden sm:inline">|</span>
          <span className="font-mono-tabular text-[11px] text-amber-300 font-semibold">
            R☉ = 109.3 R⊕ · J2000: {solarTelemetry?.epochDateStr ?? '2026-01-01'}
          </span>
        </div>

        {/* NASA mission-viz Scale Mode + Keplerian Propagator Speed Bar */}
        <div className="bg-[#080d1a]/94 border border-slate-800 rounded-lg px-3 py-2 flex flex-wrap items-center gap-3 text-[11px] shadow-lg">
          <div className="flex items-center gap-1.5">
            <Orbit className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
            <span className="text-slate-400 font-mono-tabular uppercase">Ölçek Modu:</span>
            <div className="flex items-center gap-1 bg-[#050913] p-0.5 rounded-md border border-slate-800">
              <button
                type="button"
                onClick={() => onChangeScaleMode?.('orrery_proportional')}
                className={`px-2.5 py-1 rounded text-[11px] font-medium transition-colors cursor-pointer ${
                  scaleMode === 'orrery_proportional'
                    ? 'bg-cyan-500 text-slate-950 font-semibold'
                    : 'text-slate-300 hover:text-white'
                }`}
              >
                Bilimsel Orantılı Orrery
              </button>
              <button
                type="button"
                onClick={() => onChangeScaleMode?.('true_astronomical_1to1')}
                className={`px-2.5 py-1 rounded text-[11px] font-medium transition-colors cursor-pointer ${
                  scaleMode === 'true_astronomical_1to1'
                    ? 'bg-amber-500 text-slate-950 font-semibold'
                    : 'text-slate-300 hover:text-white'
                }`}
              >
                1:1 Gerçek Astronomik Ölçek
              </button>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            <Gauge className="w-3.5 h-3.5 text-amber-400 shrink-0" />
            <span className="text-slate-400 font-mono-tabular uppercase">Kepler Hızı:</span>
            <div className="flex items-center gap-1">
              {KEPLER_SPEEDS.map((spd) => (
                <button
                  key={spd}
                  type="button"
                  onClick={() => onChangeTimeSpeed?.(spd)}
                  className={`px-2 py-0.5 rounded border font-mono-tabular text-[11px] transition-colors cursor-pointer ${
                    timeSpeed === spd
                      ? 'bg-amber-500/20 border-amber-400 text-amber-200 font-semibold'
                      : 'bg-[#050913] border-slate-800 text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {spd}g/sn
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Destination Picker + Enter Hangar Action */}
      <div className="pointer-events-auto absolute bottom-4 left-4 right-4 z-20 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-1.5 p-1.5 bg-[#080d19]/94 border border-slate-800 rounded-xl overflow-x-auto mission-scroll">
          {WORLD_LIST.map((w) => {
            const active = w.id === targetWorldId;
            return (
              <button
                key={w.id}
                type="button"
                onClick={() => onSelectWorld(w.id)}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  active
                    ? 'bg-slate-100 text-slate-950 font-semibold'
                    : 'text-slate-300 hover:bg-slate-800/80 hover:text-white'
                }`}
              >
                <span
                  className="w-2.5 h-2.5 rounded-full shrink-0"
                  style={{ backgroundColor: w.accentColor }}
                />
                <span>{w.name}</span>
                <span className="text-[10px] font-mono-tabular opacity-75">
                  ({w.earthRadiusRatio} R⊕)
                </span>
              </button>
            );
          })}
        </div>

        <button
          type="button"
          onClick={onEnterHangar}
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-xs font-bold text-slate-950 transition-colors shadow-lg whitespace-nowrap cursor-pointer"
        >
          <span>Build Spacecraft for {world.name}</span>
          <ArrowRight className="w-4 h-4" />
        </button>
      </div>
    </>
  );
}

