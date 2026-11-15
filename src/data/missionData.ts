import {
  auToSceneRadius,
  computeHeliocentricHohmann,
  computeLunarHohmann,
  computePlanetaryOrbitMetrics,
  computeSolarFluxRatio,
  EUROPA_ELEMENTS,
  G0_MS2,
  getScientificBodySceneRadius,
  HohmannTransferSummary,
  MOON_ORBIT_ELEMENTS,
  MU_EARTH_KM3_S2,
  PlanetaryOrbitMetrics,
  R_EARTH_KM,
  SOLAR_SYSTEM_EPHEMERIS,
  SUN_EARTH_RADIUS_RATIO,
} from '../physics/orbitalMechanics';

export { SUN_EARTH_RADIUS_RATIO };

export type SceneStage =
  | 'start_menu'
  | 'scenario_select'
  | 'planet_select'
  | 'hangar'
  | 'launch_pad'
  | 'journey'
  | 'orbit_insertion'
  | 'final_visual';

export type MissionScenarioId = 'planetary_pioneer' | 'solar_storm_l1';

export interface MissionScenarioSpec {
  id: MissionScenarioId;
  code: string;
  titleTr: string;
  titleEn: string;
  subtitleTr: string;
  subtitleEn: string;
  destinationTr: string;
  destinationEn: string;
  difficulty: 'STANDARD' | 'HIGH' | 'EXTREME';
  accentColor: string;
  descriptionTr: string;
  descriptionEn: string;
  loopStepsTr: string[];
  loopStepsEn: string[];
  hangarRulesTr: string[];
  hangarRulesEn: string[];
}

export const MISSION_SCENARIOS: Record<MissionScenarioId, MissionScenarioSpec> = {
  planetary_pioneer: {
    id: 'planetary_pioneer',
    code: 'SCENARIO 01 · ARTEMIS & ARES',
    titleTr: 'Gezegen Öncüsü (Planetary Pioneer)',
    titleEn: 'Planetary Pioneer',
    subtitleTr: 'Ay, Mars ve Derin Uzay Yüzey İnişi & Keşif Rover Operasyonları',
    subtitleEn: 'Moon, Mars & Deep Space Surface Landing & Rover Operations',
    destinationTr: 'Ay / Mars / Güneş Sistemi Seçimi',
    destinationEn: 'Moon / Mars / Solar System Selection',
    difficulty: 'STANDARD',
    accentColor: '#22d3ee',
    descriptionTr:
      'Klasik görev döngüsü: Gezegen seçimi (Ay, Mars ve diğer hedefler), tam Hangar özelleştirmesi, fırlatma, Hohmann transferi, yörüngeye giriş & yüzeye iniş ve otonom ChemCam rover keşfi.',
    descriptionEn:
      'Full planetary exploration loop: Target world selection (Moon/Mars/Deep Space), full Hangar customization, launch, Hohmann transfer, planetary landing, and surface rover operations.',
    loopStepsTr: [
      'Gezegen Seçimi (Ay / Mars)',
      'Tam Hangar Özelleştirmesi',
      'Fırlatma & Hohmann Transferi',
      'Yörünge & Yüzeye İniş',
      'Yüzey & Rover Operasyonları',
    ],
    loopStepsEn: [
      'Planet Selection (Moon / Mars)',
      'Full Hangar Customization',
      'Launch & Hohmann Transfer',
      'Orbit & Surface Landing',
      'Surface & Rover Operations',
    ],
    hangarRulesTr: [
      'Gövde/Şasi seçimi serbest (Light, Standard, Heavy)',
      'Standart Güneş Panelleri ve Nükleer RTG açık',
      'Hedef gezegenin yerçekimi ve Δv bütçesine göre tam tasarım',
    ],
    hangarRulesEn: [
      'Unlocked Hull/Body selection (Light, Standard, Heavy)',
      'Both Solar Panels and Nuclear RTG power systems available',
      'Full customization for planetary landing & surface rover payload',
    ],
  },
  solar_storm_l1: {
    id: 'solar_storm_l1',
    code: 'SCENARIO 02 · L1 DEEP SPACE RESCUE',
    titleTr: 'Derin Uzay Kurtarma: Güneş Fırtınası İzleme Ağı',
    titleEn: 'Deep Space Rescue: Solar Storm Monitoring Network',
    subtitleTr: 'Güneş–Dünya L1 Lagrange Noktası · MinXSS X-Işını & Erken Uyarı Yayını',
    subtitleEn: 'Sun–Earth L1 Lagrange Point · MinXSS X-Ray & Early Warning Broadcast',
    destinationTr: 'L1 Lagrange Noktası (Güneş–Dünya Halo Yörüngesi · 1.5M km)',
    destinationEn: 'L1 Lagrange Point (Sun–Earth Halo Orbit · 1.5M km)',
    difficulty: 'HIGH',
    accentColor: '#f59e0b',
    descriptionTr:
      'Hedef: Güneş–Dünya L1 Lagrange Noktası. Hangar aşamasında gövde "L1 Gözlem Sondası" olarak kilitlenir ve bütçeden sabit tutar düşülür. Standart Güneş Panelleri devre dışıdır; alternatif güç kaynağı (RTG) seçerek kalan bütçeyi üst düzey "X-Işını Spektrometreleri (MinXSS)" ve "Radyasyon Kalkanı" seviyeleri arasında dengeleyin.',
    descriptionEn:
      'Target: L1 Lagrange Point. Locks spacecraft Hull/Body to the pre-selected "L1 Observation Probe" with a fixed budget deduction. Standard Solar Panels are disabled—select an Alternative Power Source (RTG) and balance remaining budget between high-tier "X-Ray Spectrometers (MinXSS)" and "Radiation Shielding" to detect solar flares in seconds and protect Earth.',
    loopStepsTr: [
      'Hedef: L1 Lagrange Noktası',
      'Kilitli L1 Sondası + RTG + MinXSS & Kalkan',
      'Fırlatma & L1 Transferi',
      'L1 Halo Yörüngeye Giriş',
      'Erken Uyarı Yayını (Saniyeler İçinde Tespit)',
    ],
    loopStepsEn: [
      'Target: L1 Lagrange Point',
      'Locked L1 Probe + RTG + MinXSS & Shielding',
      'Launch & L1 Transfer',
      'L1 Orbit Insertion',
      'Early Warning Broadcast (Detect Flare in Seconds)',
    ],
    hangarRulesTr: [
      'Gövde/Şasi "L1 Observation Probe" olarak kilitli (-$220M sabit kesinti)',
      'Standart Güneş Panelleri DEVRE DIŞI — Alternatif Güç (RTG) zorunlu',
      'Bütçeyi MinXSS X-Işını Spektrometresi ve Radyasyon Kalkanı arasında dengele',
    ],
    hangarRulesEn: [
      'Hull/Body locked to "L1 Observation Probe" (-$220M fixed deduction)',
      'Standard Solar Panels DISABLED — Alternative Power (RTG) required',
      'Balance remaining budget between MinXSS X-Ray Spectrometers & Radiation Shielding',
    ],
  },
};

export type FlagId = 'tr' | 'us';

export interface FlagOptionSpec {
  id: FlagId;
  name: string;
  subtitle: string;
  badgeText: string;
}

export const FLAG_OPTIONS: FlagOptionSpec[] = [
  {
    id: 'tr',
    name: 'Türk Bayrağı',
    subtitle: 'Kırmızı Sancak · Ay-Yıldız Kol Arması & Ay Yüzeyi Bayrağı',
    badgeText: 'TR · AY-YILDIZ',
  },
  {
    id: 'us',
    name: 'ABD Bayrağı (Apollo 11)',
    subtitle: 'Tarihi 1969 Apollo 11 Görev Sancağı & Omuz Arması',
    badgeText: 'US · APOLLO 11',
  },
];

export type VisorColorId =
  | 'gold_solar'
  | 'cyan_plasma'
  | 'crimson_ruby'
  | 'iridium_violet'
  | 'obsidian_stealth';

export type SuitPaletteId =
  | 'nasa_white'
  | 'obsidian_ops'
  | 'ares_orange'
  | 'cobalt_horizon'
  | 'titan_olive';

export interface VisorOptionSpec {
  id: VisorColorId;
  name: string;
  subtitle: string;
  colorHex: string;
  emissiveHex: string;
  metalness: number;
  roughness: number;
}

export interface SuitPaletteSpec {
  id: SuitPaletteId;
  name: string;
  subtitle: string;
  primaryHex: string;
  secondaryHex: string;
  accentHex: string;
  jointHex: string;
}

export interface CommanderConfig {
  flagId: FlagId;
  visorId: VisorColorId;
  suitPaletteId: SuitPaletteId;
  autoRotate: boolean;
}

export const VISOR_OPTIONS: VisorOptionSpec[] = [
  {
    id: 'gold_solar',
    name: 'Altın Güneş Kalkanı',
    subtitle: '24K Buharlaştırılmış Altın Kaplama',
    colorHex: '#f59e0b',
    emissiveHex: '#78350f',
    metalness: 0.96,
    roughness: 0.08,
  },
  {
    id: 'cyan_plasma',
    name: 'Plazma Siyan Vizör',
    subtitle: 'Yüksek Kontrastlı HUD Yansıtıcı',
    colorHex: '#06b6d4',
    emissiveHex: '#083344',
    metalness: 0.92,
    roughness: 0.1,
  },
  {
    id: 'crimson_ruby',
    name: 'Kızıl Kuvars Kalkan',
    subtitle: 'Kızılötesi Lazer & Radyasyon Filtresi',
    colorHex: '#e11d48',
    emissiveHex: '#4c0519',
    metalness: 0.93,
    roughness: 0.1,
  },
  {
    id: 'iridium_violet',
    name: 'İridyum Moru',
    subtitle: 'Derin Uzay UV Spektrum Koruması',
    colorHex: '#8b5cf6',
    emissiveHex: '#2e1065',
    metalness: 0.95,
    roughness: 0.09,
  },
  {
    id: 'obsidian_stealth',
    name: 'Obsidyen Karbon',
    subtitle: 'Polarize Koyu Taktik Vizör',
    colorHex: '#1e293b',
    emissiveHex: '#090d16',
    metalness: 0.9,
    roughness: 0.12,
  },
];

export const SUIT_PALETTE_OPTIONS: SuitPaletteSpec[] = [
  {
    id: 'nasa_white',
    name: 'Artemis Klasik Beyaz',
    subtitle: 'Termal Yansıtıcı Silika Kumaş & Siyan Vurgu',
    primaryHex: '#f1f5f9',
    secondaryHex: '#cbd5e1',
    accentHex: '#0284c7',
    jointHex: '#334155',
  },
  {
    id: 'obsidian_ops',
    name: 'Derin Uzay Antrasit',
    subtitle: 'Karbon-Kompozit Zırh & Kehribar Hatlar',
    primaryHex: '#1e293b',
    secondaryHex: '#0f172a',
    accentHex: '#f59e0b',
    jointHex: '#475569',
  },
  {
    id: 'ares_orange',
    name: 'Ares Yörünge Turuncusu',
    subtitle: 'Yüksek Görünürlüklü Kalkış & Keşif Zırhı',
    primaryHex: '#ea580c',
    secondaryHex: '#f8fafc',
    accentHex: '#38bdf8',
    jointHex: '#1e293b',
  },
  {
    id: 'cobalt_horizon',
    name: 'Kobalt Ufuk Mavisi',
    subtitle: 'Titanyum Alaşım Gövde & Gümüş Plakalar',
    primaryHex: '#1d4ed8',
    secondaryHex: '#e2e8f0',
    accentHex: '#22d3ee',
    jointHex: '#1e293b',
  },
  {
    id: 'titan_olive',
    name: 'Titan Bazalt Haki',
    subtitle: 'Ağır Gezegen Yüzey Zırhı & Bronz Detaylar',
    primaryHex: '#3f6212',
    secondaryHex: '#27272a',
    accentHex: '#eab308',
    jointHex: '#18181b',
  },
];

export const DEFAULT_COMMANDER_CONFIG: CommanderConfig = {
  flagId: 'tr',
  visorId: 'gold_solar',
  suitPaletteId: 'nasa_white',
  autoRotate: false,
};

export type WorldId = 'moon' | 'earth' | 'mars' | 'asteroid' | 'jupiter' | 'colony' | 'l1';

export type CraftClassId = 'light' | 'standard' | 'heavy' | 'l1_probe';
export type EngineId = 'rl10_single' | 'merlin_trio' | 'j2x_twin' | 'rs25_quad' | 'f1b_penta';
export type FuelOptionId = 'fuel_critical' | 'fuel_short' | 'fuel_nominal' | 'fuel_excess';
export type ShieldTierId = 'thin' | 'medium' | 'thick';
export type MinxssTierId = 'minxss_1' | 'minxss_2' | 'minxss_3';

export type ManeuverType = 'retro_burn' | 'aerobraking' | 'gravity_assist';

export type PowerSourceId = 'solar_array' | 'nuclear_rtg' | 'stirling_rtg';

export interface MinxssSpec {
  id: MinxssTierId;
  name: string;
  subtitle: string;
  massKg: number;
  costM: number;
  detectionSeconds: number;
  spectralBand: string;
  warningEfficiencyPct: number;
  description: string;
}

export interface WorldSpec {
  id: WorldId;
  name: string;
  subtitle: string;
  category: string;
  difficulty: 'STANDARD' | 'MODERATE' | 'HIGH' | 'EXTREME';
  gravity: number;
  surfaceGravity: number;
  earthG: number;
  surfaceEarthG: number;
  distanceLabel: string;
  tripDuration: string;
  radioDelay: string;
  radiationHazard: 'LOW' | 'MODERATE' | 'HIGH' | 'EXTREME';
  requiredShield: ShieldTierId;
  solarFluxRatio: number;
  hasAtmosphere: boolean;
  recommendedManeuver: ManeuverType;
  approachVelocityKms: number;
  transferDeltaVKms: number;
  requiredFuelKg: number;
  captureBaseDeltaVms: number;
  idealAngleDeg: number;
  angleToleranceDeg: number;
  accentColor: string;
  smaAU: number;
  eccentricity: number;
  inclinationDeg: number;
  orbitalPeriodDays: number;
  muKm3s2: number;
  meanRadiusKm: number;
  earthRadiusRatio: number;
  orbitAltitudeKm: number;
  orbitRadius: number;
  orbitSpeed: number;
  planetRadius: number;
  hohmannSummary: HohmannTransferSummary;
  orbitMetrics: PlanetaryOrbitMetrics;
  description: string;
  novaGuidance: string;
  finalSummary: string;
}

export interface EngineSpec {
  id: EngineId;
  name: string;
  nasaProgram: string;
  thrustKn: number;
  ispSec: number;
  massKg: number;
  costM: number;
  nozzleCount: number;
  skirtStyle: 'minimal' | 'carbon' | 'ducts' | 'sls_quad' | 'f1b_heavy';
  description: string;
}

export interface FuelOptionSpec {
  id: FuelOptionId;
  name: string;
  ratio: number;
  extraTankMassKg: number;
  costM: number;
  tankScaleY: number;
  tankScaleR: number;
  description: string;
}

export interface CraftClassSpec {
  id: CraftClassId;
  name: string;
  subtitle: string;
  dryMassKg: number;
  fuelCapacityKg: number;
  costM: number;
  thrustN: number;
  ispSec: number;
  powerGenW: number;
  powerDrawW: number;
  solarPanels: number;
  description: string;
}

export interface ShieldTierSpec {
  id: ShieldTierId;
  name: string;
  massKg: number;
  costM: number;
  protectionRating: number;
  stormIntegrityPct: number;
  shellOpacity: number;
  description: string;
}

export interface PowerSourceSpec {
  id: PowerSourceId;
  name: string;
  massKg: number;
  costM: number;
  baseWatts: number;
  solarDependent: boolean;
  description: string;
}

export interface HangarConfig {
  craftClass: CraftClassId;
  engineId: EngineId;
  fuelId: FuelOptionId;
  shieldTier?: ShieldTierId;
  powerSource: PowerSourceId;
  minxssTier?: MinxssTierId;
}

export interface CraftStats {
  totalMassKg: number;
  dryMassKg: number;
  fuelMassKg: number;
  requiredFuelKg: number;
  fuelRatio: number;
  fuelPasses: boolean;
  massLimitKg: number;
  remainingMassKg: number;
  totalCostM: number;
  budgetLimitM: number;
  remainingBudgetM: number;
  hullCostM: number;
  shieldMassKg: number;
  shieldCostM: number;
  shieldIntegrityPct: number;
  minxssCostM: number;
  minxssMassKg: number;
  flareDetectionSeconds: number;
  warningEfficiencyPct: number;
  netPowerW: number;
  thrustN: number;
  thrustKn: number;
  requiredThrustKn: number;
  enginePasses: boolean;
  launchTwr: number;
  twrOnTarget: number;
  ispSec: number;
  exhaustVelocityMs: number;
  massFlowRateKgs: number;
  massRatio: number;
  requiredDeltaVms: number;
  deltaV: number;
  readinessScore: number;
  advisories: { level: 'nominal' | 'caution' | 'critical'; text: string }[];
}

export interface MissionFailureInfo {
  reason: 'underpowered_engine' | 'out_of_fuel';
  title: 'MISSION FAILED';
  subtitle: string;
  detail: string;
}

export interface OrbitOutcome {
  success: boolean;
  reason: 'stable' | 'crash' | 'escape' | 'no_fuel' | 'burnup';
  title: string;
  explanation: string;
  requiredDeltaV: number;
  remainingDeltaV: number;
}

export const NASA_BUDGET_LIMIT_M = 1000;
export const NASA_MASS_LIMIT_KG = 275000;
export const EARTH_LAUNCH_GRAVITY = 9.81;
export const NASA_LIFTOFF_TWR_MIN = 1.25;

const earthLeoMetrics = computePlanetaryOrbitMetrics(
  MU_EARTH_KM3_S2,
  R_EARTH_KM,
  540,
  SOLAR_SYSTEM_EPHEMERIS.earth.surfaceGravityMs2
);

const moonOrbitMetrics = computePlanetaryOrbitMetrics(
  MOON_ORBIT_ELEMENTS.muKm3s2,
  MOON_ORBIT_ELEMENTS.meanRadiusKm,
  100,
  MOON_ORBIT_ELEMENTS.surfaceGravityMs2
);

const marsOrbitMetrics = computePlanetaryOrbitMetrics(
  SOLAR_SYSTEM_EPHEMERIS.mars.muKm3s2,
  SOLAR_SYSTEM_EPHEMERIS.mars.meanRadiusKm,
  400,
  SOLAR_SYSTEM_EPHEMERIS.mars.surfaceGravityMs2
);

const psycheOrbitMetrics = computePlanetaryOrbitMetrics(
  SOLAR_SYSTEM_EPHEMERIS.asteroid.muKm3s2,
  SOLAR_SYSTEM_EPHEMERIS.asteroid.meanRadiusKm,
  65,
  SOLAR_SYSTEM_EPHEMERIS.asteroid.surfaceGravityMs2
);

const europaOrbitMetrics = computePlanetaryOrbitMetrics(
  EUROPA_ELEMENTS.muKm3s2,
  EUROPA_ELEMENTS.meanRadiusKm,
  200,
  EUROPA_ELEMENTS.surfaceGravityMs2
);

const proximaBMetrics = computePlanetaryOrbitMetrics(
  5.1e5, // ~1.27 Earth masses -> mu = 5.1e5 km^3/s^2
  7160,
  450,
  10.8
);

const lunarHohmann = computeLunarHohmann();
const marsHohmann = computeHeliocentricHohmann(SOLAR_SYSTEM_EPHEMERIS.mars.smaAU);
const psycheHohmann = computeHeliocentricHohmann(SOLAR_SYSTEM_EPHEMERIS.asteroid.smaAU);
const jupiterHohmann = computeHeliocentricHohmann(SOLAR_SYSTEM_EPHEMERIS.jupiter.smaAU);

export const WORLDS: Record<WorldId, WorldSpec> = {
  moon: {
    id: 'moon',
    transferDeltaVKms: 12.6,
    requiredFuelKg: 118000,
    name: 'The Moon',
    subtitle: 'Shackleton Crater · Lunar South Pole',
    category: 'LUNAR SURFACE',
    difficulty: 'STANDARD',
    gravity: 1.624,
    surfaceGravity: 1.624,
    earthG: 0.166,
    surfaceEarthG: 0.166,
    distanceLabel: '384,400 km (0.00257 AU)',
    tripDuration: `${lunarHohmann.transferDays.toFixed(1)} Days (Hohmann)`,
    radioDelay: '1.28 s',
    radiationHazard: 'LOW',
    requiredShield: 'thin',
    solarFluxRatio: Number(computeSolarFluxRatio(1.0).toFixed(3)),
    hasAtmosphere: false,
    recommendedManeuver: 'retro_burn',
    approachVelocityKms: moonOrbitMetrics.escapeVelocityKms, // 2.38 km/s lunar escape
    captureBaseDeltaVms: 840, // Real LOI capture Δv (km/s -> m/s)
    idealAngleDeg: 0,
    angleToleranceDeg: 8,
    accentColor: '#cbd5e1',
    smaAU: 1.0,
    eccentricity: MOON_ORBIT_ELEMENTS.eccentricity,
    inclinationDeg: MOON_ORBIT_ELEMENTS.inclinationDeg,
    orbitalPeriodDays: MOON_ORBIT_ELEMENTS.periodDays,
    muKm3s2: MOON_ORBIT_ELEMENTS.muKm3s2,
    meanRadiusKm: MOON_ORBIT_ELEMENTS.meanRadiusKm,
    earthRadiusRatio: MOON_ORBIT_ELEMENTS.earthRadiusRatio,
    orbitAltitudeKm: 100,
    orbitRadius: 2.35,
    orbitSpeed: 0.72,
    planetRadius: getScientificBodySceneRadius('moon', 'orrery_proportional'),
    hohmannSummary: lunarHohmann,
    orbitMetrics: moonOrbitMetrics,
    description:
      'Low lunar gravity (1.624 m/s², 0.273 R⊕) and 100% solar irradiance (1,361 W/m²). Airless world requiring a ~840 m/s LOI retro-burn at periapsis.',
    novaGuidance:
      'Low radiation and 1.624 m/s² gravity: a Light or Standard craft with Thin shielding leaves generous budget and Δv margins.',
    finalSummary:
      'Orbit stabilized above the gray cratered lunar regolith with a crisp curved horizon.',
  },
  earth: {
    id: 'earth',
    transferDeltaVKms: 9.4,
    requiredFuelKg: 102000,
    name: 'Earth Orbit',
    subtitle: '540 km Sun-Synchronous Orbital Corridor',
    category: 'LOW EARTH ORBIT',
    difficulty: 'STANDARD',
    gravity: 9.807,
    surfaceGravity: 9.807,
    earthG: 1.0,
    surfaceEarthG: 1.0,
    distanceLabel: '1.000 AU (540 km LEO)',
    tripDuration: '9 Minutes (Ascent)',
    radioDelay: '< 0.01 s',
    radiationHazard: 'LOW',
    requiredShield: 'thin',
    solarFluxRatio: Number(computeSolarFluxRatio(1.0).toFixed(3)),
    hasAtmosphere: true,
    recommendedManeuver: 'retro_burn',
    approachVelocityKms: earthLeoMetrics.orbitalVelocityKms, // 7.592 km/s at 540 km
    captureBaseDeltaVms: 480,
    idealAngleDeg: 0,
    angleToleranceDeg: 9,
    accentColor: '#38bdf8',
    smaAU: SOLAR_SYSTEM_EPHEMERIS.earth.smaAU,
    eccentricity: SOLAR_SYSTEM_EPHEMERIS.earth.eccentricity,
    inclinationDeg: SOLAR_SYSTEM_EPHEMERIS.earth.inclinationDeg,
    orbitalPeriodDays: SOLAR_SYSTEM_EPHEMERIS.earth.periodDays,
    muKm3s2: MU_EARTH_KM3_S2,
    meanRadiusKm: R_EARTH_KM,
    earthRadiusRatio: SOLAR_SYSTEM_EPHEMERIS.earth.earthRadiusRatio,
    orbitAltitudeKm: 540,
    orbitRadius: auToSceneRadius(SOLAR_SYSTEM_EPHEMERIS.earth.smaAU, 'orrery_proportional'),
    orbitSpeed: 0.22,
    planetRadius: getScientificBodySceneRadius('earth', 'orrery_proportional'),
    hohmannSummary: {
      transferSmaLabel: '6,641 km',
      eccentricity: 0.0268,
      transferDays: 0.03,
      departureDvKms: 7.59,
      captureDvKms: 0.16,
      totalDvKms: 7.75,
      vDepartureKms: 7.79,
      vArrivalKms: 7.59,
      phaseAngleDeg: 0,
    },
    orbitMetrics: earthLeoMetrics,
    description:
      'Full 9.807 m/s² Earth gravity (1.000 R⊕) demands high liftoff TWR. Orbital velocity at 540 km is 7.59 km/s with a 95.4-minute period.',
    novaGuidance:
      'Earth’s 9.807 m/s² gravity demands strong thrust-to-weight. Thin radiation shielding is sufficient below the Van Allen belts.',
    finalSummary:
      'Observatory locked into stable orbital flight with the blue curvature of Earth gleaming below.',
  },
  mars: {
    id: 'mars',
    transferDeltaVKms: 13.1,
    requiredFuelKg: 126000,
    name: 'Mars',
    subtitle: 'Jezero Crater Delta · 1.524 AU',
    category: 'TERRESTRIAL PLANET',
    difficulty: 'MODERATE',
    gravity: 3.721,
    surfaceGravity: 3.721,
    earthG: 0.379,
    surfaceEarthG: 0.379,
    distanceLabel: '227.9M km (1.524 AU)',
    tripDuration: `${marsHohmann.transferDays} Days (Hohmann)`,
    radioDelay: '12.6 min (avg)',
    radiationHazard: 'MODERATE',
    requiredShield: 'medium',
    solarFluxRatio: Number(computeSolarFluxRatio(SOLAR_SYSTEM_EPHEMERIS.mars.smaAU).toFixed(3)),
    hasAtmosphere: true,
    recommendedManeuver: 'aerobraking',
    approachVelocityKms: SOLAR_SYSTEM_EPHEMERIS.mars.meanRadiusKm ? 5.027 : 5.03, // Escape vel 5.03 km/s
    captureBaseDeltaVms: 2100, // MOI + orbit circularization (or ~880 m/s with aerobraking)
    idealAngleDeg: -2,
    angleToleranceDeg: 6.5,
    accentColor: '#f97316',
    smaAU: SOLAR_SYSTEM_EPHEMERIS.mars.smaAU,
    eccentricity: SOLAR_SYSTEM_EPHEMERIS.mars.eccentricity,
    inclinationDeg: SOLAR_SYSTEM_EPHEMERIS.mars.inclinationDeg,
    orbitalPeriodDays: SOLAR_SYSTEM_EPHEMERIS.mars.periodDays,
    muKm3s2: SOLAR_SYSTEM_EPHEMERIS.mars.muKm3s2,
    meanRadiusKm: SOLAR_SYSTEM_EPHEMERIS.mars.meanRadiusKm,
    earthRadiusRatio: SOLAR_SYSTEM_EPHEMERIS.mars.earthRadiusRatio,
    orbitAltitudeKm: 400,
    orbitRadius: auToSceneRadius(SOLAR_SYSTEM_EPHEMERIS.mars.smaAU, 'orrery_proportional'),
    orbitSpeed: 0.16,
    planetRadius: getScientificBodySceneRadius('mars', 'orrery_proportional'),
    hohmannSummary: marsHohmann,
    orbitMetrics: marsOrbitMetrics,
    description:
      '38% Earth gravity (3.721 m/s², 0.532 R⊕), 43.1% solar flux (1/1.524²), and a thin CO₂ atmosphere enabling fuel-saving aerobraking capture.',
    novaGuidance:
      'Interplanetary Hohmann transit takes ~259 days—equip Medium shielding and use Mars’s upper atmosphere for aerobraking!',
    finalSummary:
      'Captured into Martian orbit overlooking rust-red dusty ridges and ancient delta valleys.',
  },
  asteroid: {
    id: 'asteroid',
    transferDeltaVKms: 13.7,
    requiredFuelKg: 130000,
    name: '16 Psyche (Main Belt)',
    subtitle: 'Metallic Planetesimal · 2.923 AU',
    category: 'ASTEROID BELT',
    difficulty: 'MODERATE',
    gravity: 0.144,
    surfaceGravity: 0.144,
    earthG: 0.015,
    surfaceEarthG: 0.015,
    distanceLabel: '437.3M km (2.923 AU)',
    tripDuration: `${psycheHohmann.transferDays} Days (~2.5 Yr)`,
    radioDelay: '24.3 min (avg)',
    radiationHazard: 'MODERATE',
    requiredShield: 'medium',
    solarFluxRatio: Number(computeSolarFluxRatio(SOLAR_SYSTEM_EPHEMERIS.asteroid.smaAU).toFixed(3)),
    hasAtmosphere: false,
    recommendedManeuver: 'retro_burn',
    approachVelocityKms: psycheOrbitMetrics.escapeVelocityKms, // 0.17 km/s escape; rendezvous ~1.15 km/s
    captureBaseDeltaVms: 1650,
    idealAngleDeg: 0,
    angleToleranceDeg: 7.5,
    accentColor: '#fb7185',
    smaAU: SOLAR_SYSTEM_EPHEMERIS.asteroid.smaAU,
    eccentricity: SOLAR_SYSTEM_EPHEMERIS.asteroid.eccentricity,
    inclinationDeg: SOLAR_SYSTEM_EPHEMERIS.asteroid.inclinationDeg,
    orbitalPeriodDays: SOLAR_SYSTEM_EPHEMERIS.asteroid.periodDays,
    muKm3s2: SOLAR_SYSTEM_EPHEMERIS.asteroid.muKm3s2,
    meanRadiusKm: SOLAR_SYSTEM_EPHEMERIS.asteroid.meanRadiusKm,
    earthRadiusRatio: SOLAR_SYSTEM_EPHEMERIS.asteroid.earthRadiusRatio,
    orbitAltitudeKm: 65,
    orbitRadius: auToSceneRadius(SOLAR_SYSTEM_EPHEMERIS.asteroid.smaAU, 'orrery_proportional'),
    orbitSpeed: 0.11,
    planetRadius: getScientificBodySceneRadius('asteroid', 'orrery_proportional'),
    hohmannSummary: psycheHohmann,
    orbitMetrics: psycheOrbitMetrics,
    description:
      'Microgravity (0.144 m/s², 0.018 R⊕) at 2.923 AU (11.7% sunlight). Escape velocity is only 170 m/s—overshooting easily sends a craft into heliocentric drift.',
    novaGuidance:
      'No atmosphere for aerobraking here, and sunlight drops to 11.7% (1/2.923²). Bring Medium shielding and consider Nuclear RTG for Heavy buses.',
    finalSummary:
      'Station-keeping orbit established around the rugged dark-metallic planetesimal in the Main Belt.',
  },
  jupiter: {
    id: 'jupiter',
    transferDeltaVKms: 15.8,
    requiredFuelKg: 138000,
    name: 'Jupiter / Europa',
    subtitle: 'Jovian Radiation Belt & Europa Ice Moon · 5.204 AU',
    category: 'OUTER GAS GIANT',
    difficulty: 'EXTREME',
    gravity: 24.79, // Jovian gravity well for mission sizing
    surfaceGravity: EUROPA_ELEMENTS.surfaceGravityMs2, // 1.315 m/s^2 on Europa's ice shell
    earthG: 2.528,
    surfaceEarthG: 0.134,
    distanceLabel: '778.6M km (5.204 AU)',
    tripDuration: `${jupiterHohmann.transferDays} Days (~2.7 Yr Hohmann)`,
    radioDelay: '43.3 min (avg)',
    radiationHazard: 'EXTREME',
    requiredShield: 'thick',
    solarFluxRatio: Number(computeSolarFluxRatio(SOLAR_SYSTEM_EPHEMERIS.jupiter.smaAU).toFixed(3)),
    hasAtmosphere: false,
    recommendedManeuver: 'gravity_assist',
    approachVelocityKms: EUROPA_ELEMENTS.orbitalSpeedKms, // 13.743 km/s at Europa's 671,034 km orbit
    captureBaseDeltaVms: 3050, // High JOI + Europa capture Δv (reduced to ~1,980 m/s via Galilean gravity assist)
    idealAngleDeg: 3,
    angleToleranceDeg: 5.5,
    accentColor: '#f59e0b',
    smaAU: SOLAR_SYSTEM_EPHEMERIS.jupiter.smaAU,
    eccentricity: SOLAR_SYSTEM_EPHEMERIS.jupiter.eccentricity,
    inclinationDeg: SOLAR_SYSTEM_EPHEMERIS.jupiter.inclinationDeg,
    orbitalPeriodDays: SOLAR_SYSTEM_EPHEMERIS.jupiter.periodDays,
    muKm3s2: EUROPA_ELEMENTS.muKm3s2, // Europa orbital capture & de-orbit frame
    meanRadiusKm: EUROPA_ELEMENTS.meanRadiusKm,
    earthRadiusRatio: SOLAR_SYSTEM_EPHEMERIS.jupiter.earthRadiusRatio,
    orbitAltitudeKm: 200,
    orbitRadius: auToSceneRadius(SOLAR_SYSTEM_EPHEMERIS.jupiter.smaAU, 'orrery_proportional'),
    orbitSpeed: 0.075,
    planetRadius: getScientificBodySceneRadius('jupiter', 'orrery_proportional'),
    hohmannSummary: jupiterHohmann,
    orbitMetrics: europaOrbitMetrics,
    description:
      'Deep Jovian gravity well (24.79 m/s² 1-bar, 10.97 R⊕; Europa surface 1.315 m/s²), 3.7% sunlight (1/5.204²), and extreme radiation belts. Galilean gravity assist saves ~35% capture Δv.',
    novaGuidance:
      'Extreme radiation and 3.7% sunlight! Equip Heavy spacecraft, Thick radiation shielding (300 kg / $40M), Nuclear RTG, and use Gravity Assist.',
    finalSummary:
      'Protected behind Thick radiation armor on Europa’s 1.315 m/s² ice shell with giant banded Jupiter filling the sky.',
  },
  colony: {
    id: 'colony',
    transferDeltaVKms: 17.5,
    requiredFuelKg: 144000,
    name: 'Proxima b (New Eden)',
    subtitle: 'Alpha Centauri Interstellar Outpost · 4.2465 ly',
    category: 'EXOPLANET COLONY',
    difficulty: 'HIGH',
    gravity: 10.8,
    surfaceGravity: 10.8,
    earthG: 1.101,
    surfaceEarthG: 1.101,
    distanceLabel: '4.2465 Light Years',
    tripDuration: '18 Months (Relativistic Cruise)',
    radioDelay: '4.25 Years',
    radiationHazard: 'HIGH',
    requiredShield: 'thick',
    solarFluxRatio: 0.65, // Proxima b receives ~65% Earth irradiance from M5.5Ve red dwarf at 0.04856 AU
    hasAtmosphere: true,
    recommendedManeuver: 'aerobraking',
    approachVelocityKms: 9.4,
    captureBaseDeltaVms: 2850,
    idealAngleDeg: -1,
    angleToleranceDeg: 6.0,
    accentColor: '#14b8a6',
    smaAU: 0.04856, // Semi-major axis around Proxima Centauri
    eccentricity: 0.02,
    inclinationDeg: 1.5,
    orbitalPeriodDays: 11.186,
    muKm3s2: 5.1e5,
    meanRadiusKm: 7160,
    earthRadiusRatio: SOLAR_SYSTEM_EPHEMERIS.colony.earthRadiusRatio,
    orbitAltitudeKm: 450,
    orbitRadius: auToSceneRadius(SOLAR_SYSTEM_EPHEMERIS.colony.smaAU, 'orrery_proportional'),
    orbitSpeed: 0.04,
    planetRadius: getScientificBodySceneRadius('colony', 'orrery_proportional'),
    hohmannSummary: {
      transferSmaLabel: '2.123 ly',
      eccentricity: 0.9999,
      transferDays: 548,
      departureDvKms: 9.4,
      captureDvKms: 2.85,
      totalDvKms: 12.25,
      vDepartureKms: 42.1,
      vArrivalKms: 9.4,
      phaseAngleDeg: 0,
    },
    orbitMetrics: proximaBMetrics,
    description:
      'Rocky exoplanet orbiting Proxima Centauri (a = 0.0486 AU, T = 11.2 d, 1.124 R⊕) with 65% irradiance, frequent M-dwarf XUV flares, and 10.8 m/s² gravity.',
    novaGuidance:
      'Proxima Centauri emits strong stellar flares—Thick shielding is strongly advised, and atmospheric aerobraking cuts capture Δv by 55%.',
    finalSummary:
      'Stable survey orbit confirmed over the orange alien terrain and illuminated blue colony biodome.',
  },
  l1: {
    id: 'l1',
    transferDeltaVKms: 11.2,
    requiredFuelKg: 110000,
    name: 'L1 Lagrange Point',
    subtitle: 'Sun–Earth Gravitational Equilibrium · 1.5M km Sunward',
    category: 'LAGRANGE HALO ORBIT',
    difficulty: 'HIGH',
    gravity: 0.006,
    surfaceGravity: 0.006,
    earthG: 0.0006,
    surfaceEarthG: 0.0006,
    distanceLabel: '1,500,000 km (0.01 AU Sunward)',
    tripDuration: '30.5 Days (L1 Transfer)',
    radioDelay: '5.0 s',
    radiationHazard: 'EXTREME',
    requiredShield: 'thick',
    solarFluxRatio: 1.02,
    hasAtmosphere: false,
    recommendedManeuver: 'retro_burn',
    approachVelocityKms: 0.94,
    captureBaseDeltaVms: 680,
    idealAngleDeg: 0,
    angleToleranceDeg: 8.5,
    accentColor: '#f59e0b',
    smaAU: 0.9900265,
    eccentricity: 0.0167,
    inclinationDeg: 0.0,
    orbitalPeriodDays: 365.256,
    muKm3s2: 120.0,
    meanRadiusKm: 250,
    earthRadiusRatio: 0.18,
    orbitAltitudeKm: 250000,
    orbitRadius: 2.35,
    orbitSpeed: 0.65,
    planetRadius: 0.18,
    hohmannSummary: {
      transferSmaLabel: '753,278 km',
      eccentricity: 0.9827,
      transferDays: 30.5,
      departureDvKms: 3.21,
      captureDvKms: 0.68,
      totalDvKms: 3.89,
      vDepartureKms: 10.92,
      vArrivalKms: 0.94,
      phaseAngleDeg: 0,
    },
    orbitMetrics: {
      orbitRadiusKm: 250000,
      orbitalVelocityKms: 0.892,
      orbitalPeriodMin: 178.4,
      deorbitBurnMs: 145,
      escapeVelocityKms: 0.98,
      surfaceGravityMs2: 0.006,
    },
    description:
      'Unobstructed solar-wind and coronal mass ejection (CME) vantage point 1.5 million km upstream of Earth. Unshielded solar arrays suffer severe proton degradation during X-class solar storms.',
    novaGuidance:
      'Hull is locked to the L1 Observation Probe (-$220M). Standard Solar Panels are disabled—select an RTG power source and balance remaining budget between MinXSS X-Ray Spectrometers and Radiation Shielding!',
    finalSummary:
      'L1 Observation Probe locked in Halo Orbit, monitoring solar X-ray flux and broadcasting early warning telemetry to Earth.',
  },
};

export const WORLD_LIST: WorldSpec[] = [
  WORLDS.moon,
  WORLDS.earth,
  WORLDS.mars,
  WORLDS.asteroid,
  WORLDS.jupiter,
  WORLDS.colony,
];

export const ENGINE_OPTIONS: EngineSpec[] = [
  {
    id: 'rl10_single',
    name: 'RL10-C Cryo Single',
    nasaProgram: 'NASA Centaur / SLS ICPS',
    thrustKn: 980,
    ispSec: 453,
    massKg: 2100,
    costM: 95,
    nozzleCount: 1,
    skirtStyle: 'minimal',
    description:
      'Single compact expander bell (980 kN). Upper-stage vacuum thruster — far below Earth orbital liftoff requirement.',
  },
  {
    id: 'merlin_trio',
    name: 'Merlin-1D Trio Array',
    nasaProgram: 'Commercial Cargo Cluster',
    thrustKn: 1520,
    ispSec: 311,
    massKg: 3400,
    costM: 155,
    nozzleCount: 3,
    skirtStyle: 'carbon',
    description:
      '3 compact kerolox bells with twin stubby fins (1,520 kN). Insufficient thrust to escape thick lower atmosphere.',
  },
  {
    id: 'j2x_twin',
    name: 'J-2X Twin Gas-Gen',
    nasaProgram: 'NASA Constellation / Ares',
    thrustKn: 2020,
    ispSec: 448,
    massKg: 4900,
    costM: 235,
    nozzleCount: 2,
    skirtStyle: 'ducts',
    description:
      '2 wide high-expansion nozzles with vertical turbopump exhaust ducts (2,020 kN). Still underpowered for full atmospheric escape.',
  },
  {
    id: 'rs25_quad',
    name: 'RS-25D Quad SLS Core',
    nasaProgram: 'NASA Space Shuttle / Artemis SLS',
    thrustKn: 2500,
    ispSec: 452,
    massKg: 6600,
    costM: 340,
    nozzleCount: 4,
    skirtStyle: 'sls_quad',
    description:
      '4 contoured cryogenic bells, gold thermal boat-tail & 4 delta fins (2,500 kN). Matches NASA Nominal Liftoff Thrust exactly (fail only if overloaded).',
  },
  {
    id: 'f1b_penta',
    name: 'SLS F-1B Heavy Penta',
    nasaProgram: 'NASA Saturn V / SLS Block-2',
    thrustKn: 3550,
    ispSec: 380,
    massKg: 9400,
    costM: 490,
    nozzleCount: 5,
    skirtStyle: 'f1b_heavy',
    description:
      '5 massive wide-throat boosters, armored flare skirt & twin side manifolds (3,550 kN). Easily lifts even Extended Heavy Fuel tanks!',
  },
];

/**
 * 4 Official NASA Propellant Tank Options (relative to target world's requiredFuelKg):
 * - 2 Options < Required Fuel (runs dry in deep space -> MISSION FAILED)
 * - 1 Option == Required Fuel (exact NASA transfer budget)
 * - 1 Option > Required Fuel (increases rocket mass & increases required engine thrust!)
 */
export const FUEL_OPTIONS: FuelOptionSpec[] = [
  {
    id: 'fuel_critical',
    name: 'Sub-Orbital Short Tank',
    ratio: 0.76,
    extraTankMassKg: 0,
    costM: 65,
    tankScaleY: 0.68,
    tankScaleR: 0.82,
    description:
      '76% propellant in slim gunmetal core with open truss adapter. Runs dry mid-transit.',
  },
  {
    id: 'fuel_short',
    name: 'Compact Silver Reserve',
    ratio: 0.89,
    extraTankMassKg: 0,
    costM: 105,
    tankScaleY: 0.86,
    tankScaleR: 0.93,
    description:
      '89% propellant in ribbed aluminum tank. Exhausts fuel before orbit capture.',
  },
  {
    id: 'fuel_nominal',
    name: 'NASA Nominal Cryo Tank',
    ratio: 1.0,
    extraTankMassKg: 0,
    costM: 150,
    tankScaleY: 1.04,
    tankScaleR: 1.02,
    description:
      '100% exact NASA mission propellant in flush ceramic-white cryo fuselage.',
  },
  {
    id: 'fuel_excess',
    name: 'Heavy Orange + Twin Side Tanks',
    ratio: 1.38,
    extraTankMassKg: 6500,
    costM: 245,
    tankScaleY: 1.38,
    tankScaleR: 1.15,
    description:
      '138% propellant with orange SOFI core + twin side drop-tanks (+weight & +thrust req!).',
  },
];

export const CRAFT_CLASSES: CraftClassSpec[] = [
  {
    id: 'light',
    name: 'Light Scout (Mk-I)',
    subtitle: 'Compact carbon-composite bus',
    dryMassKg: 1180,
    fuelCapacityKg: 1950,
    costM: 185,
    thrustN: 36000,
    ispSec: 345,
    powerGenW: 1200,
    powerDrawW: 380,
    solarPanels: 2,
    description:
      'Low structural mass and cost (Isp 345 s). Ideal for Moon, LEO, and Asteroid missions; tight Δv for Jupiter.',
  },
  {
    id: 'standard',
    name: 'Standard Explorer (Titan-II)',
    subtitle: 'Balanced NASA deep-space bus',
    dryMassKg: 1750,
    fuelCapacityKg: 3100,
    costM: 215,
    thrustN: 76000,
    ispSec: 385,
    powerGenW: 1800,
    powerDrawW: 520,
    solarPanels: 4,
    description:
      'Proven gold-foil bus with twin 2-wing solar blankets and methalox propulsion (Isp 385 s). Balances Δv margin and cost.',
  },
  {
    id: 'heavy',
    name: 'Heavy Deep-Space (DeepForge)',
    subtitle: 'High-thrust cryogenic flagship',
    dryMassKg: 2200,
    fuelCapacityKg: 3600,
    costM: 265,
    thrustN: 185000,
    ispSec: 452,
    powerGenW: 2400,
    powerDrawW: 720,
    solarPanels: 6,
    description:
      'LH2/LOX cryogenic engine (Isp 452 s, 185 kN) built for Jupiter’s 24.79 m/s² gravity well and interstellar captures.',
  },
  {
    id: 'l1_probe',
    name: 'L1 Observation Probe (SOHO/DSCOVR Bus)',
    subtitle: 'Locked Heliophysics Early-Warning Chassis',
    dryMassKg: 1450,
    fuelCapacityKg: 2800,
    costM: 220,
    thrustN: 68000,
    ispSec: 398,
    powerGenW: 1950,
    powerDrawW: 640,
    solarPanels: 0,
    description:
      'Pre-selected L1 Lagrange Point spacecraft hull with sunward Faraday cup mount, MinXSS X-ray bench, and high-gain Earth Dish (-$220M fixed budget deduction).',
  },
];

export const MINXSS_OPTIONS: MinxssSpec[] = [
  {
    id: 'minxss_1',
    name: 'MinXSS-1 Soft X-Ray Sensor',
    subtitle: 'Single-Band Silicon Drift Detector (0.5–3.0 nm)',
    massKg: 45,
    costM: 40,
    detectionSeconds: 14.2,
    spectralBand: '0.5–3.0 nm (Slow Cadence)',
    warningEfficiencyPct: 62,
    description:
      'Baseline CubeSat spectrometer ($40M). Takes 14.2s to confirm an X-class flare peak — too slow to prevent partial satellite & grid overload.',
  },
  {
    id: 'minxss_2',
    name: 'MinXSS-2 Dual-Band XUV Array',
    subtitle: 'High-Speed Soft X-Ray + Pico-Magnetometer (0.1–1.2 nm)',
    massKg: 95,
    costM: 90,
    detectionSeconds: 5.2,
    spectralBand: '0.1–1.2 nm (Fast 5.2s Lock)',
    warningEfficiencyPct: 93,
    description:
      'Flight-proven dual-band spectrometer ($90M). Resolves coronal temperature spikes in 5.2 seconds, giving Earth power grids & satellites critical shelter lead time.',
  },
  {
    id: 'minxss_3',
    name: 'MinXSS-3 High-Cadence CdTe Suite',
    subtitle: 'Cryo CdTe X-Ray + Lyman-Alpha CME Coronagraph (0.05–2.5 nm)',
    massKg: 160,
    costM: 145,
    detectionSeconds: 1.8,
    spectralBand: '0.05–2.5 nm (Sub-2s Instant Lock)',
    warningEfficiencyPct: 99.8,
    description:
      'Flagship heliophysics observatory payload ($145M). Detects X-class solar flares in 1.8 seconds with 99.8% Earth grid & constellation protection.',
  },
];

export const SHIELD_TIERS: ShieldTierSpec[] = [
  {
    id: 'thin',
    name: 'Grade-I Thin Kapton Foil',
    massKg: 40,
    costM: 15,
    protectionRating: 1,
    stormIntegrityPct: 35,
    shellOpacity: 0.16,
    description:
      'Lightweight multi-layer Kapton foil (+40 kg, $15M). Sufficient for Moon & LEO, but suffers severe SEU brownouts during L1 X-class proton storms (35% integrity).',
  },
  {
    id: 'medium',
    name: 'Grade-II Boron-Polyethylene Shell',
    massKg: 140,
    costM: 60,
    protectionRating: 2,
    stormIntegrityPct: 86,
    shellOpacity: 0.3,
    description:
      'Hydrogen-rich boron-polyethylene composite (+140 kg, $60M). Absorbs secondary neutrons & solar protons with 86% storm survival.',
  },
  {
    id: 'thick',
    name: 'Grade-III Graded-Z Tungsten Vault',
    massKg: 300,
    costM: 110,
    protectionRating: 3,
    stormIntegrityPct: 100,
    shellOpacity: 0.48,
    description:
      'Heavy Tantalum-Tungsten-HDPE radiation vault (+300 kg, $110M). 100% immunity against extreme X15+ Carrington-class solar flares.',
  },
];

export const POWER_SOURCES: PowerSourceSpec[] = [
  {
    id: 'solar_array',
    name: 'Standard Photovoltaic Wings',
    massKg: 180,
    costM: 45,
    baseWatts: 2800,
    solarDependent: true,
    description:
      'Follows 1/r² solar law. Disabled in Scenario 2 (L1 Solar Storm Network) due to severe proton degradation of exposed PV cells.',
  },
  {
    id: 'nuclear_rtg',
    name: 'MMRTG Pu-238 Radioisotope Array',
    massKg: 320,
    costM: 85,
    baseWatts: 2100,
    solarDependent: false,
    description:
      'Radiation-hardened Plutonium-238 thermoelectric generator ($85M). Delivers uninterrupted power through extreme CME plasma storms.',
  },
  {
    id: 'stirling_rtg',
    name: 'Advanced Stirling Isotope Gen (ASRG)',
    massKg: 240,
    costM: 130,
    baseWatts: 2650,
    solarDependent: false,
    description:
      'High-efficiency dynamic Stirling radioisotope powerplant ($130M, lighter 240 kg mass) boosting high-gain Earth warning transmitter power.',
  },
];

export const DEFAULT_HANGAR_CONFIG: HangarConfig = {
  craftClass: 'standard',
  engineId: 'rs25_quad',
  fuelId: 'fuel_nominal',
  shieldTier: 'medium',
  powerSource: 'solar_array',
  minxssTier: 'minxss_2',
};

export const DEFAULT_L1_HANGAR_CONFIG: HangarConfig = {
  craftClass: 'l1_probe',
  engineId: 'rs25_quad',
  fuelId: 'fuel_nominal',
  shieldTier: 'medium',
  powerSource: 'nuclear_rtg',
  minxssTier: 'minxss_2',
};

export function computeCraftStats(
  config: HangarConfig,
  worldId: WorldId,
  scenarioId: MissionScenarioId = 'planetary_pioneer'
): CraftStats {
  const isL1Scenario = scenarioId === 'solar_storm_l1' || worldId === 'l1';
  const world = WORLDS[isL1Scenario ? 'l1' : worldId];
  const effectiveClassId: CraftClassId = isL1Scenario ? 'l1_probe' : config.craftClass;
  const craftClassSpec =
    CRAFT_CLASSES.find((c) => c.id === effectiveClassId) || CRAFT_CLASSES[1];
  const engine = ENGINE_OPTIONS.find((e) => e.id === config.engineId) || ENGINE_OPTIONS[3];
  const fuel = FUEL_OPTIONS.find((f) => f.id === config.fuelId) || FUEL_OPTIONS[2];
  const shield =
    SHIELD_TIERS.find((s) => s.id === (config.shieldTier || 'medium')) || SHIELD_TIERS[1];
  const power = POWER_SOURCES.find((p) => p.id === config.powerSource) || POWER_SOURCES[0];
  const minxss =
    MINXSS_OPTIONS.find((m) => m.id === (config.minxssTier || 'minxss_2')) || MINXSS_OPTIONS[1];

  const requiredFuelKg = world.requiredFuelKg;
  const fuelMassKg = Math.round(requiredFuelKg * fuel.ratio);

  const refStackNominalKg = 203900;
  const baselineCarrierDryKg = refStackNominalKg - requiredFuelKg - 6600 - 180;
  const extraPayloadMassKg = isL1Scenario ? shield.massKg + minxss.massKg : 0;
  const dryMassKg =
    baselineCarrierDryKg +
    engine.massKg +
    fuel.extraTankMassKg +
    power.massKg +
    extraPayloadMassKg;
  const totalMassKg = dryMassKg + fuelMassKg;
  const remainingMassKg = NASA_MASS_LIMIT_KG - totalMassKg;

  const hullCostM = isL1Scenario ? 220 : craftClassSpec.costM;
  const shieldCostM = isL1Scenario ? shield.costM : 0;
  const minxssCostM = isL1Scenario ? minxss.costM : 0;
  const totalCostM =
    hullCostM + engine.costM + fuel.costM + power.costM + shieldCostM + minxssCostM;
  const remainingBudgetM = NASA_BUDGET_LIMIT_M - totalCostM;

  const effectiveGenW = power.solarDependent
    ? Math.round((880 + power.baseWatts) * world.solarFluxRatio)
    : Math.round(550 + power.baseWatts);
  const netPowerW = effectiveGenW - 880;

  const thrustRefMassKg =
    refStackNominalKg + (fuelMassKg - requiredFuelKg) + fuel.extraTankMassKg;
  const rawReqKn = (thrustRefMassKg * EARTH_LAUNCH_GRAVITY * NASA_LIFTOFF_TWR_MIN) / 1000;
  const requiredThrustKn = Math.round(rawReqKn / 10) * 10;

  const thrustKn = engine.thrustKn;
  const thrustN = thrustKn * 1000;
  const launchTwr = Number(
    (thrustN / Math.max(1, thrustRefMassKg * EARTH_LAUNCH_GRAVITY)).toFixed(2)
  );

  const targetWeightN = totalMassKg * world.gravity;
  const twrOnTarget = targetWeightN > 0 ? thrustN / targetWeightN : 0;

  const enginePasses = thrustKn >= requiredThrustKn;
  const fuelPasses = fuelMassKg >= requiredFuelKg;

  // Tsiolkovsky Rocket Equation: v_e = Isp * g0, m_dot = F / v_e, massRatio = m0 / mf
  const ispSec = engine.ispSec;
  const exhaustVelocityMs = Math.round(ispSec * G0_MS2);
  const massFlowRateKgs = Number((thrustN / Math.max(1, ispSec * G0_MS2)).toFixed(1));
  const massRatio = Number((totalMassKg / Math.max(1, dryMassKg)).toFixed(2));
  const requiredDeltaVms = Math.round(world.transferDeltaVKms * 1000);

  const deltaV = Math.round(
    engine.ispSec * G0_MS2 * Math.log(totalMassKg / Math.max(1, dryMassKg)) * 3.85
  );

  const advisories: CraftStats['advisories'] = [];

  if (!enginePasses) {
    advisories.push({
      level: 'critical',
      text: `THRUST DEFICIT: ${thrustKn.toLocaleString()} kN < ${requiredThrustKn.toLocaleString()} kN required (TWR ${launchTwr.toFixed(
        2
      )}× < 1.25×)! Rocket will crash on liftoff.`,
    });
  }
  if (!fuelPasses) {
    advisories.push({
      level: 'critical',
      text: `TSIOLKOVSKY FUEL DEFICIT: ${fuelMassKg.toLocaleString()} kg < ${requiredFuelKg.toLocaleString()} kg needed for ${world.name} (Δv ${world.transferDeltaVKms} km/s). Craft will run dry in space!`,
    });
  }
  if (isL1Scenario && config.powerSource === 'solar_array') {
    advisories.push({
      level: 'critical',
      text: `SOLAR PANELS DISABLED FOR L1: Intense solar proton events degrade standard PV wings. Select an Alternative Power Source (RTG)!`,
    });
  }
  if (remainingMassKg < 0) {
    advisories.push({
      level: 'critical',
      text: `Over pad gantry mass limit by ${Math.abs(remainingMassKg).toLocaleString()} kg!`,
    });
  }
  if (remainingBudgetM < 0) {
    advisories.push({
      level: 'critical',
      text: `Over NASA mission budget by $${Math.abs(remainingBudgetM)}M! Rebalance MinXSS Spectrometer, Radiation Shielding, or RTG tier.`,
    });
  }
  if (netPowerW < 0) {
    advisories.push({
      level: 'critical',
      text: `Power deficit (${netPowerW} W) at ${Math.round(world.solarFluxRatio * 100)}% sunlight. Switch to Nuclear Stirling RTG!`,
    });
  }
  if (isL1Scenario && shield.id === 'thin') {
    advisories.push({
      level: 'caution',
      text: `SHIELDING WARNING: Thin Kapton foil (35% integrity) risks severe sensor brownouts during an X-class solar flare at L1.`,
    });
  }
  if (isL1Scenario && minxss.id === 'minxss_1') {
    advisories.push({
      level: 'caution',
      text: `SENSOR LATENCY CAUTION: MinXSS-1 takes ${minxss.detectionSeconds}s to lock flare onset. Upgrade to MinXSS-2 or MinXSS-3 for sub-6s warning.`,
    });
  }

  if (advisories.length === 0) {
    advisories.push({
      level: 'nominal',
      text: isL1Scenario
        ? `L1 Probe Certified: Flare Lock ${minxss.detectionSeconds}s · Shield Integrity ${shield.stormIntegrityPct}% · Budget $${remainingBudgetM}M left`
        : `Certified for ${world.name}: ${thrustKn.toLocaleString()} kN · Isp ${ispSec}s · m₀/mf ${massRatio}× · TWR ${launchTwr.toFixed(
            2
          )}×`,
    });
  }

  let score = 100;
  if (!enginePasses) score -= 45;
  if (!fuelPasses) score -= 40;
  if (remainingMassKg < 0) score -= 20;
  if (remainingBudgetM < 0) score -= 25;
  if (netPowerW < 0) score -= 20;
  if (isL1Scenario && config.powerSource === 'solar_array') score -= 40;
  if (isL1Scenario && shield.id === 'thin') score -= 25;
  if (isL1Scenario && minxss.id === 'minxss_1') score -= 15;

  return {
    totalMassKg,
    dryMassKg,
    fuelMassKg,
    requiredFuelKg,
    fuelRatio: fuel.ratio,
    fuelPasses,
    massLimitKg: NASA_MASS_LIMIT_KG,
    remainingMassKg,
    totalCostM,
    budgetLimitM: NASA_BUDGET_LIMIT_M,
    remainingBudgetM,
    hullCostM,
    shieldMassKg: shield.massKg,
    shieldCostM: shield.costM,
    shieldIntegrityPct: shield.stormIntegrityPct,
    minxssCostM: isL1Scenario ? minxss.costM : 0,
    minxssMassKg: isL1Scenario ? minxss.massKg : 0,
    flareDetectionSeconds: minxss.detectionSeconds,
    warningEfficiencyPct: minxss.warningEfficiencyPct,
    netPowerW,
    thrustN,
    thrustKn,
    requiredThrustKn,
    enginePasses,
    launchTwr,
    twrOnTarget,
    ispSec,
    exhaustVelocityMs,
    massFlowRateKgs,
    massRatio,
    requiredDeltaVms,
    deltaV,
    readinessScore: Math.max(5, Math.min(100, score)),
    advisories,
  };
}

export function computeRequiredInsertionDeltaV(params: {
  world: WorldSpec;
  maneuver: ManeuverType;
  burnTimingAccuracy: number;
}): number {
  const { world, maneuver, burnTimingAccuracy } = params;
  const maneuverMultiplier =
    maneuver === 'aerobraking' ? 0.42 : maneuver === 'gravity_assist' ? 0.65 : 1.0;
  const timingPenalty = 1 + (1 - Math.max(0, Math.min(1, burnTimingAccuracy))) * 0.45;
  return Math.round(world.captureBaseDeltaVms * maneuverMultiplier * timingPenalty);
}

export function evaluateOrbitInsertion(params: {
  world: WorldSpec;
  stats: CraftStats;
  maneuver: ManeuverType;
  approachAngleDeg: number;
  burnTimingAccuracy: number; // 0..1 where 1 = dead center of periapsis window
}): OrbitOutcome {
  const { world, stats, maneuver, approachAngleDeg, burnTimingAccuracy } = params;
  const angleDelta = Math.abs(approachAngleDeg - world.idealAngleDeg);

  // Check invalid aerobraking on airless world
  if (maneuver === 'aerobraking' && !world.hasAtmosphere) {
    return {
      success: false,
      reason: 'escape',
      title: 'Aerobraking Failed — No Atmosphere',
      explanation: `${world.name} has virtually no atmosphere to slow your spacecraft. Without atmospheric drag, the craft skipped past on a hyperbolic escape trajectory! Use Retro-Burn or Gravity Assist.`,
      requiredDeltaV: 0,
      remainingDeltaV: stats.deltaV,
    };
  }

  // Check steep crash angle
  if (approachAngleDeg < world.idealAngleDeg - world.angleToleranceDeg) {
    return {
      success: false,
      reason: maneuver === 'aerobraking' ? 'burnup' : 'crash',
      title:
        maneuver === 'aerobraking'
          ? 'Atmospheric Entry Burn-Up'
          : 'Impact Trajectory — Too Steep',
      explanation: `Approach angle (${approachAngleDeg.toFixed(
        1
      )}°) dipped too steeply into ${world.name}’s gravity well. Steep angles cause destructive heating or surface impact.`,
      requiredDeltaV: 0,
      remainingDeltaV: Math.max(0, stats.deltaV - 950),
    };
  }

  // Check shallow escape angle
  if (approachAngleDeg > world.idealAngleDeg + world.angleToleranceDeg) {
    return {
      success: false,
      reason: 'escape',
      title: 'Orbit Missed — Approach Too Shallow',
      explanation: `Approach angle (+${approachAngleDeg.toFixed(
        1
      )}°) was too shallow, so ${world.name}’s gravity couldn’t bend your trajectory enough to capture into orbit.`,
      requiredDeltaV: 0,
      remainingDeltaV: Math.max(0, stats.deltaV - 700),
    };
  }

  // Check timing accuracy at Periapsis
  if (burnTimingAccuracy < 0.52) {
    return {
      success: false,
      reason: 'escape',
      title: 'Missed Periapsis Burn Window',
      explanation:
        'Per the Oberth Effect, orbital capture burns are most efficient right at periapsis (closest approach). Firing off-window wasted kinetic energy and missed capture.',
      requiredDeltaV: 0,
      remainingDeltaV: Math.max(0, stats.deltaV - 1100),
    };
  }

  const requiredDv = computeRequiredInsertionDeltaV({
    world,
    maneuver,
    burnTimingAccuracy,
  });

  if (stats.deltaV < requiredDv) {
    return {
      success: false,
      reason: 'no_fuel',
      title: 'Propellant Exhausted Before Capture',
      explanation: `This maneuver required ${requiredDv.toLocaleString()} m/s Δv, but your craft only carried ${stats.deltaV.toLocaleString()} m/s (Tsiolkovsky limit). Try ${
        world.hasAtmosphere ? 'Aerobraking to save fuel' : 'Gravity Assist or a Heavy LH2/LOX craft'
      }!`,
      requiredDeltaV: requiredDv,
      remainingDeltaV: 0,
    };
  }

  const remainingDeltaV = stats.deltaV - requiredDv;
  const maneuverLabel =
    maneuver === 'aerobraking'
      ? 'Aerobraking Pass'
      : maneuver === 'gravity_assist'
      ? 'Gravity Assist Capture'
      : 'Periapsis Retro-Burn';

  return {
    success: true,
    reason: 'stable',
    title: `Stable ${world.name} Orbit Achieved`,
    explanation: `${maneuverLabel} executed cleanly at ${angleDelta.toFixed(
      1
    )}° off ideal corridor using ${requiredDv.toLocaleString()} m/s Δv (v_orb = ${
      world.orbitMetrics.orbitalVelocityKms
    } km/s). ${remainingDeltaV.toLocaleString()} m/s reserve remains.`,
    requiredDeltaV: requiredDv,
    remainingDeltaV,
  };
}

export type JourneyWarpSpeed = 1 | 1000 | 2000 | 10000;

export type SurfacePhase =
  | 'descending'
  | 'landed'
  | 'ramp_deploy'
  | 'rover_exit'
  | 'rover_active';

export interface LandingSiteSpec {
  id: string;
  name: string;
  angleDeg: number; // 0..360 around equatorial orbit plane
  terrainType: string;
  risk: 'LOW' | 'MODERATE' | 'HIGH';
  scienceValue: string;
  description: string;
}

export const LANDING_SITES: Record<WorldId, LandingSiteSpec[]> = {
  moon: [
    {
      id: 'shackleton_rim',
      name: 'Shackleton Crater Rim',
      angleDeg: 35,
      terrainType: 'Sunlit Ridge · Water Ice Edge',
      risk: 'LOW',
      scienceValue: 'Polar Ice & Eternal Sunlight',
      description: 'Flat high-illumination ridge ideal for vertical landing and rover traverse.',
    },
    {
      id: 'mare_tranquillitatis',
      name: 'Mare Tranquillitatis',
      angleDeg: 150,
      terrainType: 'Smooth Basalt Plain',
      risk: 'LOW',
      scienceValue: 'Ancient Volcanic Regolith',
      description: 'Wide low-slope basalt floor with minimal boulder hazards.',
    },
    {
      id: 'tycho_central',
      name: 'Tycho Central Peak',
      angleDeg: 265,
      terrainType: 'Crater Uplift · Steep Terrace',
      risk: 'MODERATE',
      scienceValue: 'Deep Lunar Crustal Ejecta',
      description: 'Rugged highland ejecta requiring precise overhead de-orbit alignment.',
    },
  ],
  earth: [
    {
      id: 'atlantic_drone_pad',
      name: 'Atlantic Recovery Platform',
      angleDeg: 40,
      terrainType: 'Autonomous Ocean Landing Pad',
      risk: 'LOW',
      scienceValue: 'Orbital Re-Entry & Recovery',
      description: 'Stabilized offshore recovery deck for vertical retro-propulsive touchdown.',
    },
    {
      id: 'kennedy_coastal',
      name: 'Cape Canaveral Landing Zone 1',
      angleDeg: 165,
      terrainType: 'Concrete Coastal Pad',
      risk: 'LOW',
      scienceValue: 'Precision RTLS Touchdown',
      description: 'Primary coastal recovery apron with full telemetry tracking.',
    },
    {
      id: 'pacific_atoll',
      name: 'Equatorial Atoll Test Range',
      angleDeg: 280,
      terrainType: 'Coral Island Pad',
      risk: 'MODERATE',
      scienceValue: 'Cross-Range Aerocapture',
      description: 'Remote equatorial recovery strip testing high-energy de-orbit accuracy.',
    },
  ],
  mars: [
    {
      id: 'jezero_delta',
      name: 'Jezero Crater Delta',
      angleDeg: 45,
      terrainType: 'Ancient River Delta Basin',
      risk: 'LOW',
      scienceValue: 'Biosignature Clay Minerals',
      description: 'NASA Perseverance landing zone with flat sediment plains for rover science.',
    },
    {
      id: 'elysium_planitia',
      name: 'Elysium Planitia',
      angleDeg: 170,
      terrainType: 'Broad Volcanic Plain',
      risk: 'LOW',
      scienceValue: 'Seismic & Subsurface Ice',
      description: 'Extremely smooth equatorial plain offering maximum landing safety.',
    },
    {
      id: 'valles_rim',
      name: 'Valles Marineris Rim',
      angleDeg: 285,
      terrainType: 'Canyon Plateau Edge',
      risk: 'HIGH',
      scienceValue: 'Exposed Crustal Strata',
      description: 'High-value geological canyon terrace with steeper descent winds.',
    },
  ],
  asteroid: [
    {
      id: 'nightingale_crater',
      name: 'Nightingale Crater Floor',
      angleDeg: 30,
      terrainType: 'Fine Carbonaceous Regolith',
      risk: 'LOW',
      scienceValue: 'Pristine Solar Nebula Organics',
      description: 'Sheltered microgravity basin suited for soft thruster touchdown.',
    },
    {
      id: 'psyche_ridge',
      name: 'Psyche Nickel-Iron Ridge',
      angleDeg: 155,
      terrainType: 'Metallic Core Exposure',
      risk: 'MODERATE',
      scienceValue: 'Planetesimal Metallic Core',
      description: 'Dense iron-nickel outcrop ideal for magnetic rover anchoring.',
    },
    {
      id: 'equatorial_boulder',
      name: 'Equatorial Boulder Field',
      angleDeg: 270,
      terrainType: 'Fractured Rubble Pile',
      risk: 'HIGH',
      scienceValue: 'Impact Breccia Diversity',
      description: 'Uneven rubble surface demanding careful microgravity descent.',
    },
  ],
  jupiter: [
    {
      id: 'conamara_chaos',
      name: 'Conamara Chaos Ice Shelf',
      angleDeg: 50,
      terrainType: 'Refrozen Ocean Ice Raft',
      risk: 'LOW',
      scienceValue: 'Subsurface Brine Plumes',
      description: 'Relatively level cryogenic ice floe directly beneath giant Jupiter.',
    },
    {
      id: 'pwyll_ejecta',
      name: 'Pwyll Crater Ice Plain',
      angleDeg: 180,
      terrainType: 'Fresh Water-Ice Blanket',
      risk: 'MODERATE',
      scienceValue: 'Pure Subsurface Ice Sample',
      description: 'Bright fresh ice sheet exposed by recent impact excavation.',
    },
    {
      id: 'thrace_lineae',
      name: 'Thrace Macula Fracture',
      angleDeg: 295,
      terrainType: 'Tectonic Double-Ridge',
      risk: 'HIGH',
      scienceValue: 'Active Hydrated Salt Vent',
      description: 'Dark reddish tectonic fissure with extreme radiation & ridge relief.',
    },
  ],
  colony: [
    {
      id: 'new_eden_pad',
      name: 'New Eden Biodome Pad',
      angleDeg: 40,
      terrainType: 'Leveled Outpost Apron',
      risk: 'LOW',
      scienceValue: 'Colony Resupply & Rover Link',
      description: 'Cleared landing zone adjacent to the blue geodesic colony biodome.',
    },
    {
      id: 'terminator_valley',
      name: 'Twilight Terminator Valley',
      angleDeg: 165,
      terrainType: 'Basaltic Liquid-Water Belt',
      risk: 'LOW',
      scienceValue: 'Habitable Temperate Zone',
      description: 'Mild twilight zone between scorching dayside and frozen nightside.',
    },
    {
      id: 'flare_caldera',
      name: 'Proxima Volcanic Caldera',
      angleDeg: 280,
      terrainType: 'Tidal-Flexed Basalt Rim',
      risk: 'HIGH',
      scienceValue: 'Geothermal Exoplanet Core',
      description: 'Active basaltic highlands exposed to intense Proxima Centauri flares.',
    },
  ],
  l1: [
    {
      id: 'l1_halo_north',
      name: 'L1 Northern Halo Manifold (SOHO Corridor)',
      angleDeg: 45,
      terrainType: 'Out-of-Ecliptic Halo Orbit · Zero Solar Radio Interference',
      risk: 'LOW',
      scienceValue: 'Unbroken 24/7 Solar Corona Line-of-Sight',
      description: 'Optimal 250,000 km amplitude halo loop avoiding solar exclusion zone for continuous Earth telemetry.',
    },
    {
      id: 'l1_lissajous_core',
      name: 'L1 Quasi-Periodic Lissajous Node (DSCOVR)',
      angleDeg: 165,
      terrainType: 'Low-Δv Saddle Equilibrium Corridor',
      risk: 'LOW',
      scienceValue: 'Direct CME Shockwave & IMF Bz Sampling',
      description: 'Minimal station-keeping Δv budget right on the Sun–Earth gravitational saddle point.',
    },
    {
      id: 'l1_sunward_apex',
      name: 'L1 Sub-Solar Forward Apex',
      angleDeg: 285,
      terrainType: 'High-Flux Upstream Bow-Shock Perch',
      risk: 'MODERATE',
      scienceValue: 'Maximum Lead-Time X-Ray & Proton Detection',
      description: 'Positioned at the furthest sunward tip of the L1 halo loop for fastest flare warning lead time.',
    },
  ],
};
