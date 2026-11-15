import {
  Activity,
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Compass,
  Lock,
  Radio,
  ShieldAlert,
  Sparkles,
  Sun,
  Zap,
} from 'lucide-react';
import {
  CommanderConfig,
  FLAG_OPTIONS,
  MISSION_SCENARIOS,
  MissionScenarioId,
  SUIT_PALETTE_OPTIONS,
} from '../data/missionData';
import { AppLang } from './TopBar';

interface ScenarioSelectOverlayProps {
  lang: AppLang;
  selectedScenarioId: MissionScenarioId;
  commanderConfig: CommanderConfig;
  onSelectScenario: (scenarioId: MissionScenarioId) => void;
  onConfirmScenario: (scenarioId: MissionScenarioId) => void;
  onBackToSuitStudio: () => void;
}

export function ScenarioSelectOverlay({
  lang,
  selectedScenarioId,
  commanderConfig,
  onSelectScenario,
  onConfirmScenario,
  onBackToSuitStudio,
}: ScenarioSelectOverlayProps) {
  const isTr = lang === 'tr';
  const activeFlag =
    FLAG_OPTIONS.find((f) => f.id === commanderConfig.flagId) ?? FLAG_OPTIONS[0];
  const activeSuit =
    SUIT_PALETTE_OPTIONS.find((s) => s.id === commanderConfig.suitPaletteId) ??
    SUIT_PALETTE_OPTIONS[0];

  const scenarios: MissionScenarioId[] = ['planetary_pioneer', 'solar_storm_l1'];

  return (
    <div className="pointer-events-none absolute inset-0 z-20 flex flex-col justify-between p-4 sm:p-6 overflow-y-auto">
      {/* Subtle dark vignette backdrop so cards are crisp over the 3D scene */}
      <div className="pointer-events-none fixed inset-0 bg-gradient-to-b from-[#030712]/80 via-[#030712]/65 to-[#030712]/90" />

      {/* Top Header Bar */}
      <div className="pointer-events-auto relative z-10 flex flex-wrap items-center justify-between gap-3 bg-[#070d1c]/92 border border-slate-800/90 rounded-xl px-4 py-3 shadow-2xl">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onBackToSuitStudio}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#0d172a] hover:bg-slate-800 border border-slate-700/80 text-xs font-medium text-slate-200 cursor-pointer transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5 text-cyan-400" />
            <span>{isTr ? 'Astronot & Ülke Kurulumu' : 'Commander & Country Setup'}</span>
          </button>

          <div className="hidden sm:block h-5 w-px bg-slate-800" />

          <div>
            <div className="text-[10px] font-mono-tabular uppercase tracking-widest text-cyan-400">
              {isTr
                ? 'AŞAMA 01 · GÖREV SENARYOSU SEÇİMİ'
                : 'PHASE 01 · MISSION SCENARIO SELECTION'}
            </div>
            <h1 className="font-display text-base sm:text-lg font-bold text-white">
              {isTr
                ? 'Görev Mimarisini ve Hedef Profilini Seçin'
                : 'Select Mission Scenario & Architecture'}
            </h1>
          </div>
        </div>

        {/* Commander & Country summary badge */}
        <div className="flex items-center gap-2.5 px-3 py-1.5 rounded-lg bg-[#0b1326] border border-slate-800 text-xs font-mono-tabular">
          <span
            className="w-2.5 h-2.5 rounded-full shrink-0"
            style={{ backgroundColor: activeSuit.accentHex }}
          />
          <span className="text-slate-300 font-semibold">{activeFlag.badgeText}</span>
          <span className="text-slate-600">·</span>
          <span className="text-cyan-300">{activeSuit.name}</span>
        </div>
      </div>

      {/* Main 2-Column Scenario Selection Grid */}
      <div className="pointer-events-auto relative z-10 my-auto py-4 max-w-6xl w-full mx-auto grid grid-cols-1 lg:grid-cols-2 gap-5">
        {scenarios.map((id) => {
          const spec = MISSION_SCENARIOS[id];
          const isSelected = selectedScenarioId === id;
          const isL1 = id === 'solar_storm_l1';

          return (
            <div
              key={id}
              onClick={() => onSelectScenario(id)}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  onSelectScenario(id);
                }
              }}
              className={`group text-left rounded-2xl border p-5 transition-all cursor-pointer flex flex-col justify-between shadow-2xl ${
                isSelected
                  ? isL1
                    ? 'bg-[#0c1324]/95 border-amber-400 ring-1 ring-amber-400/40'
                    : 'bg-[#091528]/95 border-cyan-400 ring-1 ring-cyan-400/40'
                  : 'bg-[#070c18]/90 border-slate-800/90 hover:border-slate-700'
              }`}
            >
              <div>
                {/* Top Code & Difficulty Row */}
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span
                      className={`w-8 h-8 rounded-lg flex items-center justify-center border ${
                        isL1
                          ? 'bg-amber-500/15 border-amber-400/50 text-amber-300'
                          : 'bg-cyan-500/15 border-cyan-400/50 text-cyan-300'
                      }`}
                    >
                      {isL1 ? <Sun className="w-4 h-4" /> : <Compass className="w-4 h-4" />}
                    </span>
                    <span
                      className={`text-[11px] font-mono-tabular font-bold tracking-wider ${
                        isL1 ? 'text-amber-300' : 'text-cyan-300'
                      }`}
                    >
                      {spec.code}
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-mono-tabular font-bold border ${
                        isL1
                          ? 'bg-amber-950/70 border-amber-500/50 text-amber-300'
                          : 'bg-cyan-950/70 border-cyan-500/50 text-cyan-300'
                      }`}
                    >
                      {isL1
                        ? isTr
                          ? 'HEDEF: L1 LAGRANGE'
                          : 'TARGET: L1 LAGRANGE'
                        : isTr
                        ? 'HEDEF: AY / MARS'
                        : 'TARGET: MOON / MARS'}
                    </span>

                    {isSelected && (
                      <CheckCircle2
                        className={`w-5 h-5 ${isL1 ? 'text-amber-400' : 'text-cyan-400'}`}
                      />
                    )}
                  </div>
                </div>

                {/* Scenario Title & Subtitle */}
                <h2 className="font-display text-xl font-bold text-white mt-3">
                  {isTr ? spec.titleTr : spec.titleEn}
                </h2>
                <p className="text-xs text-slate-300 mt-1 font-medium">
                  {isTr ? spec.subtitleTr : spec.subtitleEn}
                </p>

                {/* Description */}
                <p className="text-xs text-slate-400 mt-3 leading-relaxed">
                  {isTr ? spec.descriptionTr : spec.descriptionEn}
                </p>

                {/* Mission Phase Pipeline */}
                <div className="mt-4 pt-3 border-t border-slate-800/80">
                  <div className="text-[10px] font-mono-tabular uppercase tracking-wider text-slate-400 mb-2">
                    {isTr ? 'GÖREV AŞAMA AKIŞI (FAZ DÖNGÜSÜ)' : 'MISSION PHASE PIPELINE'}
                  </div>
                  <div className="flex flex-wrap items-center gap-1.5">
                    {(isTr ? spec.loopStepsTr : spec.loopStepsEn).map((step, idx) => (
                      <div key={step} className="flex items-center gap-1.5">
                        <span
                          className={`px-2 py-1 rounded-md text-[11px] font-mono-tabular border ${
                            isL1 && idx >= 3
                              ? 'bg-amber-950/60 border-amber-500/50 text-amber-200 font-semibold'
                              : 'bg-[#0d1629] border-slate-800 text-slate-200'
                          }`}
                        >
                          {idx + 1}. {step}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Hangar & Engineering Mechanics Rules */}
                <div className="mt-4 rounded-xl bg-[#050914] border border-slate-800/90 p-3 space-y-2">
                  <div className="flex items-center justify-between text-[11px] font-mono-tabular">
                    <span className={isL1 ? 'text-amber-300 font-bold' : 'text-cyan-300 font-bold'}>
                      {isL1
                        ? isTr
                          ? 'HANGAR & SİMÜLASYON KURALLARI (SENARYO 2)'
                          : 'HANGAR & PHASE OVERRIDES (SCENARIO 2)'
                        : isTr
                        ? 'HANGAR & KEŞİF ÖZELLİKLERİ (SENARYO 1)'
                        : 'HANGAR & EXPLORATION MECHANICS (SCENARIO 1)'}
                    </span>
                    <span className="text-emerald-300 font-semibold">$1,000M NASA BUDGET</span>
                  </div>

                  {isL1 ? (
                    <div className="space-y-1.5 text-[11px] text-slate-300">
                      <div className="flex items-start gap-2">
                        <Lock className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5" />
                        <span>
                          <strong className="text-white">
                            {isTr ? 'Kilitli Gövde:' : 'Locked Hull/Body:'}
                          </strong>{' '}
                          {isTr
                            ? '"L1 Observation Probe" seçili ve kilitlidir (-$220M sabit bütçe kesintisi).'
                            : 'Pre-selected "L1 Observation Probe" locked (-$220M fixed budget deduction).'}
                        </span>
                      </div>
                      <div className="flex items-start gap-2">
                        <Zap className="w-3.5 h-3.5 text-rose-400 shrink-0 mt-0.5" />
                        <span>
                          <strong className="text-white">
                            {isTr ? 'Güneş Panelleri Devre Dışı:' : 'Solar Panels Disabled:'}
                          </strong>{' '}
                          {isTr
                            ? 'L1 proton fırtınası nedeniyle standart paneller kapalıdır; Alternatif Güç Kaynağı (RTG) zorunludur.'
                            : 'Standard Solar Panels disabled; requires Alternative Power Source (RTG).'}
                        </span>
                      </div>
                      <div className="flex items-start gap-2">
                        <Activity className="w-3.5 h-3.5 text-cyan-400 shrink-0 mt-0.5" />
                        <span>
                          <strong className="text-white">
                            {isTr
                              ? 'MinXSS & Radyasyon Kalkanı Dengesi:'
                              : 'MinXSS & Radiation Shielding Balance:'}
                          </strong>{' '}
                          {isTr
                            ? 'Kalan bütçeyi X-Işını Spektrometreleri (MinXSS-1/2/3) ve Radyasyon Kalkanı seviyeleri arasında dengeleyin.'
                            : 'Balance remaining budget between high-tier X-Ray Spectrometers (MinXSS) and Radiation Shielding grades.'}
                        </span>
                      </div>
                      <div className="flex items-start gap-2">
                        <Radio className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
                        <span>
                          <strong className="text-white">
                            {isTr ? 'Başarı Kriteri:' : 'Success Criteria:'}
                          </strong>{' '}
                          {isTr
                            ? 'Güneş patlamasını saniyeler içinde tespit edip Dünya uydularını ve elektrik şebekelerini korumak için erken uyarı sinyali gönderin.'
                            : 'Detect solar flare in seconds and broadcast the early warning signal to Earth to protect satellites and power grids.'}
                        </span>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-1.5 text-[11px] text-slate-300">
                      <div className="flex items-start gap-2">
                        <Sparkles className="w-3.5 h-3.5 text-cyan-400 shrink-0 mt-0.5" />
                        <span>
                          <strong className="text-white">
                            {isTr ? 'Gezegen Seçimi:' : 'Planet Selection:'}
                          </strong>{' '}
                          {isTr
                            ? 'Ay, Mars, 16 Psyche, Jüpiter/Europa veya Proxima b hedeflerinden birini seçin.'
                            : 'Choose between The Moon, Mars, 16 Psyche, Jupiter/Europa, or Proxima b.'}
                        </span>
                      </div>
                      <div className="flex items-start gap-2">
                        <ShieldAlert className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
                        <span>
                          <strong className="text-white">
                            {isTr ? 'Tam Hangar Özelleştirmesi:' : 'Full Hangar Customization:'}
                          </strong>{' '}
                          {isTr
                            ? 'Serbest gövde, motor itki gücü, yakıt tankı ve güneş/nükleer güç sistemi seçimi.'
                            : 'Full control over spacecraft hull, rocket propulsion, fuel tanks, and solar/RTG power.'}
                        </span>
                      </div>
                      <div className="flex items-start gap-2">
                        <Compass className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5" />
                        <span>
                          <strong className="text-white">
                            {isTr ? 'Yörünge İnişi & Rover:' : 'Landing & Rover Operations:'}
                          </strong>{' '}
                          {isTr
                            ? 'İniş bölgesi hedefleme, itkili iniş ve yüzeyde ChemCam lazer spektrometre keşfi.'
                            : 'De-orbit targeting, powered surface landing, and autonomous rover spectroscopy.'}
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Action CTA Button */}
              <div className="mt-5 pt-3 border-t border-slate-800/80 flex items-center justify-between gap-3">
                <div className="text-[11px] font-mono-tabular text-slate-400">
                  {isL1
                    ? isTr
                      ? 'Doğrudan L1 Hangar Kurulumuna Geçer'
                      : 'Proceeds to L1 Hangar Configuration'
                    : isTr
                    ? '3B Güneş Sistemi Gezegen Seçimine Geçer'
                    : 'Proceeds to 3D Solar System Planet Selection'}
                </div>

                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onConfirmScenario(id);
                  }}
                  className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-colors cursor-pointer ${
                    isL1
                      ? 'bg-amber-500 hover:bg-amber-400 text-slate-950'
                      : 'bg-cyan-500 hover:bg-cyan-400 text-slate-950'
                  }`}
                >
                  <span>
                    {isL1
                      ? isTr
                        ? 'Senaryo 2’yi Başlat (L1 Ağı)'
                        : 'Launch Scenario 2 (L1 Network)'
                      : isTr
                      ? 'Senaryo 1’i Başlat (Gezegen Öncüsü)'
                      : 'Launch Scenario 1 (Planetary Pioneer)'}
                  </span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
