import { BookOpen, Eye, EyeOff, Globe, Languages, RotateCcw, Sun, Volume2, VolumeX } from 'lucide-react';
import { MissionScenarioId, SceneStage, WORLD_LIST, WORLDS, WorldId } from '../data/missionData';

export type AppLang = 'tr' | 'en';

interface TopBarProps {
  stage: SceneStage;
  onStageChange: (stage: SceneStage) => void;
  scenarioId: MissionScenarioId;
  targetWorldId: WorldId;
  onSelectWorld: (worldId: WorldId) => void;
  lang: AppLang;
  onToggleLang: () => void;
  audioEnabled: boolean;
  onToggleAudio: () => void;
  hudHidden: boolean;
  onToggleHud: () => void;
  onOpenGuide: () => void;
  onResetMission: () => void;
}

const WORLD_NAMES_TR: Record<WorldId, string> = {
  moon: 'Ay (Shackleton)',
  earth: 'Dünya Yörüngesi',
  mars: 'Mars (Jezero)',
  asteroid: '16 Psyche Asteroiti',
  jupiter: 'Jüpiter · Europa',
  colony: 'Proxima Centauri b',
  l1: 'Güneş–Dünya L1 Noktası',
};

export function TopBar({
  stage,
  onStageChange,
  scenarioId,
  targetWorldId,
  onSelectWorld,
  lang,
  onToggleLang,
  audioEnabled,
  onToggleAudio,
  hudHidden,
  onToggleHud,
  onOpenGuide,
  onResetMission,
}: TopBarProps) {
  const world = WORLDS[targetWorldId];
  const isTr = lang === 'tr';
  const isL1 = scenarioId === 'solar_storm_l1' || targetWorldId === 'l1';

  const stages: { id: SceneStage; label: string }[] = isL1
    ? [
        { id: 'start_menu', label: isTr ? '0. Karakter' : '0. Commander' },
        { id: 'scenario_select', label: isTr ? '1. Senaryo' : '1. Scenario' },
        { id: 'hangar', label: '2. Hangar (L1)' },
        { id: 'launch_pad', label: isTr ? '3. Fırlatma' : '3. Launch' },
        { id: 'journey', label: isTr ? '4. L1 Transfer' : '4. L1 Transit' },
        {
          id: 'orbit_insertion',
          label: isTr ? '5. L1 Yörüngeye Giriş' : '5. L1 Orbit Insertion',
        },
        {
          id: 'final_visual',
          label: isTr ? '6. Erken Uyarı Yayını' : '6. Early Warning Broadcast',
        },
      ]
    : [
        { id: 'start_menu', label: isTr ? '0. Karakter' : '0. Commander' },
        { id: 'scenario_select', label: isTr ? '1. Senaryo' : '1. Scenario' },
        { id: 'planet_select', label: isTr ? '2. Gezegenler' : '2. Planets' },
        { id: 'hangar', label: '3. Hangar' },
        { id: 'launch_pad', label: isTr ? '4. Fırlatma' : '4. Launch' },
        { id: 'journey', label: isTr ? '5. Yolculuk' : '5. Journey' },
        {
          id: 'orbit_insertion',
          label: isTr ? '6. Yörünge & İniş' : '6. Orbit & De-Orbit',
        },
        {
          id: 'final_visual',
          label: isTr ? '7. Yüzey & Rover' : '7. Landing & Rover',
        },
      ];

  return (
    <header className="relative z-30 flex items-center justify-between gap-3 px-4 h-14 bg-[#070b14]/95 border-b border-slate-800/90 select-none">
      {/* Zone 1: Brand & Target World Switcher */}
      <div className="flex items-center gap-2.5 min-w-0 shrink-0">
        <div className="w-7 h-7 rounded-md bg-rose-600 flex items-center justify-center font-display font-bold text-xs text-white tracking-wider">
          MF
        </div>
        <span className="font-display font-bold text-base tracking-wide text-slate-100 whitespace-nowrap">
          MissionForge
        </span>

        {isL1 ? (
          <div className="hidden xl:flex items-center gap-1.5 bg-amber-950/60 border border-amber-500/50 rounded-lg px-2.5 py-1 text-xs font-mono-tabular text-amber-200">
            <Sun className="w-3.5 h-3.5 text-amber-400 shrink-0" />
            <span className="font-semibold">
              {isTr ? 'L1 Lagrange Noktası (1.5M km)' : 'L1 Lagrange Point (1.5M km)'}
            </span>
          </div>
        ) : (
          <div className="hidden xl:flex items-center gap-1.5 bg-[#0b1222] border border-slate-800 rounded-lg px-2.5 py-1">
            <Globe className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
            <select
              aria-label={isTr ? 'Hedef Gezegen' : 'Target Planet'}
              value={targetWorldId}
              onChange={(e) => onSelectWorld(e.target.value as WorldId)}
              className="bg-transparent text-xs font-medium text-cyan-200 focus:outline-none cursor-pointer"
            >
              {WORLD_LIST.map((w) => (
                <option key={w.id} value={w.id} className="bg-[#0b1222] text-slate-100">
                  {isTr ? WORLD_NAMES_TR[w.id] : w.name}
                </option>
              ))}
            </select>
            <span className="hidden 2xl:inline text-[11px] font-mono-tabular text-slate-400 pl-1 border-l border-slate-800">
              {world.id === 'jupiter'
                ? `Europa ${world.surfaceGravity} m/s²`
                : `${world.surfaceGravity} m/s²`}
            </span>
          </div>
        )}
      </div>

      {/* Zone 2: Full 0..6 Stage Pipeline Navigation */}
      <nav
        aria-label="Mission Stages"
        className="flex items-center gap-1 bg-[#0b1222] border border-slate-800 rounded-lg p-1 overflow-x-auto mission-scroll"
      >
        {stages.map((item) => {
          const active = stage === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onStageChange(item.id)}
              className={`px-2.5 py-1.5 rounded-md text-xs font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                active
                  ? 'bg-rose-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-100 hover:bg-slate-800/70'
              }`}
            >
              {item.label}
            </button>
          );
        })}
      </nav>

      {/* Zone 3: Language Switcher (TR/EN), Utilities & Field Guide */}
      <div className="flex items-center gap-1.5 shrink-0">
        <button
          type="button"
          onClick={onToggleLang}
          title={isTr ? 'Switch to English (EN)' : 'Türkçe diline geç (TR)'}
          className="flex items-center gap-1 px-2 py-1.5 rounded-md border border-cyan-500/45 bg-[#0b1222] text-xs font-mono-tabular font-bold text-cyan-200 hover:bg-cyan-500/20 transition-colors whitespace-nowrap cursor-pointer"
        >
          <Languages className="w-3.5 h-3.5 text-cyan-400" />
          <span>{isTr ? 'TR' : 'EN'}</span>
        </button>

        <button
          type="button"
          onClick={onToggleHud}
          title={isTr ? 'Arayüzü Gizle/Göster (H)' : 'Toggle HUD visibility (H)'}
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md border border-slate-800 bg-[#0b1222] text-xs text-slate-300 hover:text-cyan-300 transition-colors whitespace-nowrap cursor-pointer"
        >
          {hudHidden ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
          <span className="hidden lg:inline">
            {hudHidden ? (isTr ? 'HUD Göster' : 'Show HUD') : isTr ? 'HUD Gizle' : 'Hide HUD'}
          </span>
        </button>

        <button
          type="button"
          onClick={onToggleAudio}
          title={isTr ? 'Ses Efektleri' : 'Toggle synthesized audio'}
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md border border-slate-800 bg-[#0b1222] text-xs text-slate-300 hover:text-cyan-300 transition-colors whitespace-nowrap cursor-pointer"
        >
          {audioEnabled ? (
            <Volume2 className="w-3.5 h-3.5 text-cyan-400" />
          ) : (
            <VolumeX className="w-3.5 h-3.5" />
          )}
          <span className="hidden xl:inline">
            {audioEnabled ? (isTr ? 'Ses' : 'Audio') : isTr ? 'Sessiz' : 'Muted'}
          </span>
        </button>

        <button
          type="button"
          onClick={onResetMission}
          title={isTr ? 'Görevi Sıfırla' : 'Reset mission'}
          className="p-1.5 rounded-md border border-slate-800 bg-[#0b1222] text-slate-400 hover:text-amber-300 transition-colors cursor-pointer"
        >
          <RotateCcw className="w-3.5 h-3.5" />
        </button>

        <button
          type="button"
          onClick={onOpenGuide}
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md bg-cyan-500/15 border border-cyan-500/40 text-xs font-medium text-cyan-200 hover:bg-cyan-500/25 transition-colors whitespace-nowrap cursor-pointer"
        >
          <BookOpen className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">{isTr ? 'Rehber' : 'Field Guide'}</span>
        </button>
      </div>
    </header>
  );
}
