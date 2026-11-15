import { ArrowRight, X } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { FinalVisualOverlay } from './components/FinalVisualOverlay';
import { GuideModal } from './components/GuideModal';
import { HangarOverlay } from './components/HangarOverlay';
import { JourneyOverlay } from './components/JourneyOverlay';
import { L1BroadcastOverlay } from './components/L1BroadcastOverlay';
import { LaunchOverlay } from './components/LaunchOverlay';
import { MissionFailedModal } from './components/MissionFailedModal';
import { OrbitInsertionOverlay } from './components/OrbitInsertionOverlay';
import { PlanetSelectOverlay } from './components/PlanetSelectOverlay';
import { ScenarioSelectOverlay } from './components/ScenarioSelectOverlay';
import { StartMenuOverlay } from './components/StartMenuOverlay';
import { AppLang, TopBar } from './components/TopBar';
import {
  CommanderConfig,
  computeCraftStats,
  CraftClassId,
  DEFAULT_COMMANDER_CONFIG,
  DEFAULT_HANGAR_CONFIG,
  DEFAULT_L1_HANGAR_CONFIG,
  EngineId,
  FlagId,
  FuelOptionId,
  HangarConfig,
  JourneyWarpSpeed,
  LANDING_SITES,
  MinxssTierId,
  MissionFailureInfo,
  MissionScenarioId,
  PowerSourceId,
  SceneStage,
  ShieldTierId,
  SuitPaletteId,
  SurfacePhase,
  VisorColorId,
  WORLDS,
  WorldId,
} from './data/missionData';
import {
  evaluateHohmannTransitState,
  HohmannTransitState,
  SolarScaleMode,
} from './physics/orbitalMechanics';
import {
  LaunchTelemetry,
  MissionWorldEngine,
  OrbitTelemetry,
  OrbitTimeWarp,
  ProjectedLabel,
  RoverNavTelemetry,
  ScienceMissionState,
  SolarEphemerisTelemetry,
  SurfaceCameraMode,
  SurfaceTelemetry,
} from './three/MissionWorldEngine';
import { missionAudio } from './utils/audio';

const SOLAR_LABELS: { id: string; text: string; worldId?: WorldId }[] = [
  { id: 'mercury', text: 'Mercury' },
  { id: 'venus', text: 'Venus' },
  { id: 'earth', text: 'Earth Orbit', worldId: 'earth' },
  { id: 'moon', text: 'The Moon', worldId: 'moon' },
  { id: 'iss', text: 'ISS' },
  { id: 'jwst', text: 'JWST (L2)' },
  { id: 'mars', text: 'Mars', worldId: 'mars' },
  { id: 'asteroid', text: 'Psyche / Bennu', worldId: 'asteroid' },
  { id: 'jupiter', text: 'Jupiter / Europa', worldId: 'jupiter' },
  { id: 'saturn', text: 'Saturn' },
  { id: 'uranus', text: 'Uranus' },
  { id: 'neptune', text: 'Neptune' },
  { id: 'colony', text: 'Proxima b', worldId: 'colony' },
];

const INITIAL_LAUNCH_TELEMETRY: LaunchTelemetry = {
  phase: 'pad',
  countdownValue: 5,
  altitudeKm: 0,
  velocityKmh: 0,
  accelG: 1.0,
  fuelPct: 100,
  stageLabel: 'PAD LC-39A · READY FOR IGNITION',
  sepVelocityMs: 0,
};

const INITIAL_ORBIT_TELEMETRY: OrbitTelemetry = {
  craftAngleDeg: 0,
  siteAngleDeg: 35,
  alignmentPct: 0,
  altitudeKm: WORLDS.moon.orbitAltitudeKm,
  orbitalVelocityKms: WORLDS.moon.orbitMetrics.orbitalVelocityKms,
  orbitalPeriodMin: WORLDS.moon.orbitMetrics.orbitalPeriodMin,
  deorbitBurnMs: WORLDS.moon.orbitMetrics.deorbitBurnMs,
  phase: 'orbiting',
  timeWarp: 1,
  tpsTempC: 20,
  accelG: 0,
};

const INITIAL_SURFACE_TELEMETRY: SurfaceTelemetry = {
  altitudeM: 150,
  verticalSpeedMs: 19,
  surfaceGravityMs2: WORLDS.moon.surfaceGravity,
  maneuverLabel: 'HLS POWERED DESCENT',
  fuelPct: 100,
  manualThrottlePct: null,
  pitchDeg: 14,
  mach: 0,
  dynamicPressureKpa: 0,
  gLoad: 0.27,
};

const INITIAL_ROVER_NAV: RoverNavTelemetry = {
  active: false,
  targetX: null,
  targetZ: null,
  distanceM: 0,
  obstacleNotice: null,
};

const INITIAL_SCIENCE_STATE: ScienceMissionState = {
  totalTargets: 4,
  collectedCount: 0,
  samples: [],
  activeScanLabel: null,
  scanningProgress: 0,
  missionComplete: false,
  lastSpectroReadout: null,
  autonomousMissionActive: false,
  roverStatus: 'BEKLİYOR / ŞARJ OLUYOR',
  batteryPct: 100,
  maxBattery: 100,
  totalDistanceM: 0,
  sensorTempC: -62.5,
  sensorRadUsv: 0.42,
  sensorSlopeDeg: 0,
  sensorIrReflectance: 0.34,
  sensorCameraStatus: 'Geniş Açı (Bekleme)',
  spectrometerSummary: 'Tarama bekleniyor...',
  systemLog: 'Hazır. Otonom görev başlatın veya zemine tıklayın.',
  roverX: 0,
  roverZ: 3.1,
  roverHeading: 0,
  maxMapRadius: 21,
  radarTargets: [],
  radarCraters: [],
  radarRoute: [],
};

const CAMERA_MODE_ORDER: SurfaceCameraMode[] = [
  'chase',
  'starship_cam',
  'pad_cam',
  'rover_cam',
];

export default function App() {
  const canvasMountRef = useRef<HTMLDivElement | null>(null);
  const engineRef = useRef<MissionWorldEngine | null>(null);
  const labelRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const planetCardRef = useRef<HTMLDivElement | null>(null);
  const planetCardOpenRef = useRef<boolean>(true);

  const [stage, setStage] = useState<SceneStage>('start_menu');
  const [scenarioId, setScenarioId] = useState<MissionScenarioId>('planetary_pioneer');
  const [commanderConfig, setCommanderConfig] = useState<CommanderConfig>({
    ...DEFAULT_COMMANDER_CONFIG,
  });
  const [targetWorldId, setTargetWorldId] = useState<WorldId>('moon');
  const [planetCardOpen, setPlanetCardOpen] = useState<boolean>(true);
  const [hangarConfig, setHangarConfig] = useState<HangarConfig>({ ...DEFAULT_HANGAR_CONFIG });
  const [turntablePaused, setTurntablePaused] = useState(false);

  // Stage 1 Solar Ephemeris state (NASA mission-viz OrbitalPropagator)
  const [solarTelemetry, setSolarTelemetry] = useState<SolarEphemerisTelemetry>({
    epochDateStr: '2026-01-01',
    elapsedDays: 0,
    scaleMode: 'orrery_proportional',
    timeSpeedDaysPerSec: 10,
    selectedRadiusAU: 0.00257,
    selectedRadiusKm: 384400,
    selectedVelocityKms: 1.022,
    selectedTrueAnomalyDeg: 0,
    selectedEarthRadiusRatio: WORLDS.moon.earthRadiusRatio,
    sunEarthRadiusRatio: 109.3,
  });

  // Stage 3 & 4 state (from Nasa-hackathon-2-3-4 + NASA GMAT Hohmann/Vis-Viva)
  const [launchTelemetry, setLaunchTelemetry] = useState<LaunchTelemetry>(
    INITIAL_LAUNCH_TELEMETRY
  );
  const [journeyProgress, setJourneyProgress] = useState(0);
  const [journeyFuelPct, setJourneyFuelPct] = useState(100);
  const [journeyWarp, setJourneyWarp] = useState<JourneyWarpSpeed>(1000);
  const [journeyTransitState, setJourneyTransitState] = useState<HohmannTransitState>(() =>
    evaluateHohmannTransitState('moon', 0)
  );
  const [missionFailure, setMissionFailure] = useState<MissionFailureInfo | null>(null);

  // Stage 5 & 6 state (from Nasa-hackathon)
  const [orbitTelemetry, setOrbitTelemetry] = useState<OrbitTelemetry>(INITIAL_ORBIT_TELEMETRY);
  const [surfacePhase, setSurfacePhase] = useState<SurfacePhase>('descending');
  const [surfaceTelemetry, setSurfaceTelemetry] = useState<SurfaceTelemetry>(
    INITIAL_SURFACE_TELEMETRY
  );
  const [cameraMode, setCameraMode] = useState<SurfaceCameraMode>('chase');
  const [autoRoam, setAutoRoam] = useState(false);
  const [headlightsOn, setHeadlightsOn] = useState(false);
  const [sunElevationDeg, setSunElevationDeg] = useState(48);
  const [autoShowcaseOrbit, setAutoShowcaseOrbit] = useState(false);
  const [orbitHoloGridVisible, setOrbitHoloGridVisible] = useState(true);
  const [roverNav, setRoverNav] = useState<RoverNavTelemetry>(INITIAL_ROVER_NAV);
  const [scienceState, setScienceState] = useState<ScienceMissionState>(INITIAL_SCIENCE_STATE);

  const [lang, setLang] = useState<AppLang>('tr');
  const [audioEnabled, setAudioEnabled] = useState(false);
  const [hudHidden, setHudHidden] = useState(false);
  const [guideOpen, setGuideOpen] = useState(false);
  const [webglError, setWebglError] = useState(false);

  const craftStats = useMemo(
    () => computeCraftStats(hangarConfig, targetWorldId, scenarioId),
    [hangarConfig, targetWorldId, scenarioId]
  );
  const activeWorld = WORLDS[targetWorldId];

  const setCardVisibility = useCallback((open: boolean) => {
    planetCardOpenRef.current = open;
    setPlanetCardOpen(open);
    if (!open && planetCardRef.current) {
      planetCardRef.current.style.opacity = '0';
      planetCardRef.current.style.pointerEvents = 'none';
    }
  }, []);

  const updateSolarLabelsDOM = useCallback((labels: ProjectedLabel[]) => {
    const vw = window.innerWidth;
    const vh = window.innerHeight;

    for (const lbl of labels) {
      const el = labelRefs.current[lbl.id];
      if (el) {
        if (!lbl.visible) {
          el.style.opacity = '0';
          el.style.pointerEvents = 'none';
        } else {
          el.style.opacity = lbl.selected ? '1' : lbl.hovered ? '0.96' : '0.78';
          el.style.pointerEvents = 'auto';
          el.style.transform = `translate3d(${Math.round(lbl.x)}px, ${Math.round(
            lbl.y
          )}px, 0) translate(-50%, -100%)`;
          el.dataset.selected = lbl.selected ? 'true' : 'false';
        }
      }

      if (lbl.selected && planetCardRef.current) {
        if (!lbl.visible || !planetCardOpenRef.current) {
          planetCardRef.current.style.opacity = '0';
          planetCardRef.current.style.pointerEvents = 'none';
        } else {
          const cardX = Math.max(16, Math.min(vw - 270, lbl.x + 26));
          const cardY = Math.max(18, Math.min(vh - 290, lbl.y - 45));
          planetCardRef.current.style.opacity = '1';
          planetCardRef.current.style.pointerEvents = 'auto';
          planetCardRef.current.style.transform = `translate3d(${Math.round(
            cardX
          )}px, ${Math.round(cardY)}px, 0)`;
        }
      }
    }
  }, []);

  const switchStage = useCallback(
    (nextStage: SceneStage) => {
      missionAudio.playClick();
      setMissionFailure(null);
      setStage(nextStage);

      if (nextStage === 'journey') {
        setJourneyProgress(0);
        setJourneyFuelPct(100);
        engineRef.current?.setJourneySpeed(journeyWarp);
      } else if (nextStage === 'orbit_insertion') {
        const w = WORLDS[targetWorldId];
        const defaultSite = LANDING_SITES[targetWorldId][0];
        setOrbitTelemetry((prev) => ({
          craftAngleDeg: 0,
          siteAngleDeg: defaultSite.angleDeg,
          alignmentPct: 0,
          altitudeKm: w.orbitAltitudeKm,
          orbitalVelocityKms: w.orbitMetrics.orbitalVelocityKms,
          orbitalPeriodMin: w.orbitMetrics.orbitalPeriodMin,
          deorbitBurnMs: w.orbitMetrics.deorbitBurnMs,
          phase: 'orbiting',
          timeWarp: prev.timeWarp,
          tpsTempC: 20,
          accelG: 0,
        }));
      } else if (nextStage === 'final_visual') {
        const w = WORLDS[targetWorldId];
        setSurfacePhase('descending');
        setSurfaceTelemetry({
          altitudeM: 150,
          verticalSpeedMs: 19,
          surfaceGravityMs2: w.surfaceGravity,
          maneuverLabel: w.hasAtmosphere ? 'BELLY FLOP SKYDIVE' : 'HLS POWERED DESCENT',
          fuelPct: 100,
          manualThrottlePct: null,
          pitchDeg: w.hasAtmosphere ? 73 : 14,
          mach: w.hasAtmosphere ? 0.08 : 0,
          dynamicPressureKpa: w.hasAtmosphere ? 0.42 : 0,
          gLoad: Number(((w.surfaceGravity * (w.hasAtmosphere ? 1.0 : 1.65)) / 9.80665).toFixed(2)),
        });
        setAutoRoam(false);
        setRoverNav(INITIAL_ROVER_NAV);
      }

      engineRef.current?.setStage(nextStage);
    },
    [journeyWarp, targetWorldId]
  );

  useEffect(() => {
    const mount = canvasMountRef.current;
    if (!mount) return;

    try {
      const engine = new MissionWorldEngine(
        mount,
        hangarConfig,
        craftStats,
        targetWorldId,
        {
          onWorldSelect: (wId) => {
            setTargetWorldId(wId);
            setCardVisibility(true);
          },
          onWorldDeselect: () => {
            setCardVisibility(false);
          },
          onWorldHover: () => {},
          onSolarTelemetryUpdate: (st) => {
            setSolarTelemetry(st);
          },
          onLaunchTelemetry: (t) => {
            setLaunchTelemetry(t);
          },
          onLaunchComplete: () => {
            setMissionFailure(null);
            setStage('journey');
            setJourneyProgress(0);
            setJourneyFuelPct(100);
            engine.setStage('journey');
          },
          onMissionFailed: (failure) => {
            setMissionFailure(failure);
          },
          onJourneyProgress: (pct) => {
            setJourneyProgress(pct);
          },
          onJourneyFuelUpdate: (fuelPct) => {
            setJourneyFuelPct(fuelPct);
          },
          onJourneyTransitUpdate: (ts) => {
            setJourneyTransitState(ts);
          },
          onJourneyComplete: () => {
            setMissionFailure(null);
            setStage('orbit_insertion');
            engine.setStage('orbit_insertion');
          },
          onOrbitStateUpdate: (state) => {
            setOrbitTelemetry(state);
          },
          onOrbitDescentComplete: () => {
            setStage('final_visual');
            setSurfacePhase('descending');
            setSurfaceTelemetry((prev) => ({
              altitudeM: 150,
              verticalSpeedMs: 19,
              surfaceGravityMs2: prev.surfaceGravityMs2,
              maneuverLabel: 'HLS POWERED DESCENT',
              fuelPct: 100,
              manualThrottlePct: prev.manualThrottlePct,
              pitchDeg: 14,
              mach: 0,
              dynamicPressureKpa: 0,
              gLoad: Number((prev.surfaceGravityMs2 / 9.80665).toFixed(2)),
            }));
            setAutoRoam(false);
            setRoverNav(INITIAL_ROVER_NAV);
            engine.setStage('final_visual');
          },
          onSurfacePhaseChange: (phase) => {
            setSurfacePhase(phase);
          },
          onSurfaceTelemetry: (st) => {
            setSurfaceTelemetry(st);
          },
          onRoverNavUpdate: (nav) => {
            setRoverNav(nav);
          },
          onScienceUpdate: (sci) => {
            setScienceState(sci);
          },
          onCameraModeChange: (mode) => {
            setCameraMode(mode);
          },
          onLabelsUpdate: updateSolarLabelsDOM,
        }
      );

      const canvas = mount.querySelector('canvas');
      const handleLost = (e: Event) => {
        e.preventDefault();
        setWebglError(true);
      };
      const handleRestored = () => setWebglError(false);
      canvas?.addEventListener('webglcontextlost', handleLost);
      canvas?.addEventListener('webglcontextrestored', handleRestored);

      engineRef.current = engine;

      return () => {
        canvas?.removeEventListener('webglcontextlost', handleLost);
        canvas?.removeEventListener('webglcontextrestored', handleRestored);
        engine.dispose();
        engineRef.current = null;
      };
    } catch {
      setWebglError(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSelectWorld = useCallback(
    (worldId: WorldId) => {
      missionAudio.playClick();
      setTargetWorldId(worldId);
      setCardVisibility(true);
      const world = WORLDS[worldId];
      const nextConfig: HangarConfig = {
        ...hangarConfig,
        shieldTier: world.requiredShield,
      };
      setHangarConfig(nextConfig);
      const nextStats = computeCraftStats(nextConfig, worldId, scenarioId);
      engineRef.current?.updateHangarConfig(nextConfig, nextStats);
      engineRef.current?.focusWorld(worldId);

      const defaultSite = LANDING_SITES[worldId][0];
      setOrbitTelemetry((prev) => ({
        craftAngleDeg: 0,
        siteAngleDeg: defaultSite.angleDeg,
        alignmentPct: 0,
        altitudeKm: world.orbitAltitudeKm,
        orbitalVelocityKms: world.orbitMetrics.orbitalVelocityKms,
        orbitalPeriodMin: world.orbitMetrics.orbitalPeriodMin,
        deorbitBurnMs: world.orbitMetrics.deorbitBurnMs,
        phase: 'orbiting',
        timeWarp: prev.timeWarp,
        tpsTempC: 20,
        accelG: 0,
      }));
    },
    [hangarConfig, scenarioId, setCardVisibility]
  );

  const updateConfig = useCallback(
    (patch: Partial<HangarConfig>) => {
      missionAudio.playSnap();
      setMissionFailure(null);
      const next: HangarConfig = { ...hangarConfig, ...patch };
      if (scenarioId === 'solar_storm_l1') {
        next.craftClass = 'l1_probe';
        if (next.powerSource === 'solar_array') {
          next.powerSource = 'nuclear_rtg';
        }
      }
      setHangarConfig(next);
      const nextStats = computeCraftStats(next, targetWorldId, scenarioId);
      engineRef.current?.updateHangarConfig(next, nextStats);
    },
    [hangarConfig, targetWorldId, scenarioId]
  );

  const handleSelectCraftClass = useCallback(
    (craftClass: CraftClassId) => {
      if (scenarioId === 'solar_storm_l1') return;
      updateConfig({ craftClass });
    },
    [scenarioId, updateConfig]
  );

  const handleConfirmScenario = useCallback(
    (chosenScenario: MissionScenarioId) => {
      missionAudio.playClick();
      setMissionFailure(null);
      setScenarioId(chosenScenario);

      if (chosenScenario === 'solar_storm_l1') {
        const nextWorld: WorldId = 'l1';
        const nextConfig: HangarConfig = { ...DEFAULT_L1_HANGAR_CONFIG };
        setTargetWorldId(nextWorld);
        setHangarConfig(nextConfig);
        const nextStats = computeCraftStats(nextConfig, nextWorld, 'solar_storm_l1');
        engineRef.current?.focusWorld(nextWorld);
        engineRef.current?.updateHangarConfig(nextConfig, nextStats);
        setStage('hangar');
        engineRef.current?.setStage('hangar');
      } else {
        const nextWorld: WorldId = targetWorldId === 'l1' ? 'moon' : targetWorldId;
        const nextConfig: HangarConfig = {
          ...DEFAULT_HANGAR_CONFIG,
          shieldTier: WORLDS[nextWorld].requiredShield,
        };
        setTargetWorldId(nextWorld);
        setHangarConfig(nextConfig);
        const nextStats = computeCraftStats(nextConfig, nextWorld, 'planetary_pioneer');
        engineRef.current?.focusWorld(nextWorld);
        engineRef.current?.updateHangarConfig(nextConfig, nextStats);
        setStage('planet_select');
        engineRef.current?.setStage('planet_select');
      }
    },
    [targetWorldId]
  );

  const updateCommander = useCallback(
    (patch: Partial<CommanderConfig>) => {
      missionAudio.playSnap();
      const next = { ...commanderConfig, ...patch };
      setCommanderConfig(next);
      engineRef.current?.updateCommanderConfig(next);
    },
    [commanderConfig]
  );

  const handleSetTimeWarp = useCallback((warp: OrbitTimeWarp) => {
    missionAudio.playClick();
    setOrbitTelemetry((prev) => ({ ...prev, timeWarp: warp }));
    engineRef.current?.setOrbitTimeWarp(warp);
  }, []);

  const handleSelectCameraMode = useCallback((mode: SurfaceCameraMode) => {
    missionAudio.playClick();
    setCameraMode(mode);
    engineRef.current?.setSurfaceCameraMode(mode);
  }, []);

  const handleSetManualThrottle = useCallback((pct: number | null) => {
    setSurfaceTelemetry((prev) => ({ ...prev, manualThrottlePct: pct }));
    engineRef.current?.setManualThrottle(pct);
  }, []);

  const handleSetSunElevationDeg = useCallback((deg: number) => {
    setSunElevationDeg(deg);
    engineRef.current?.setSunElevationDeg(deg);
  }, []);

  const handleToggleAutoShowcaseOrbit = useCallback(() => {
    missionAudio.playClick();
    setAutoShowcaseOrbit((prev) => {
      const next = !prev;
      engineRef.current?.setAutoShowcaseOrbit(next);
      return next;
    });
  }, []);

  const handleToggleOrbitHoloGrid = useCallback(() => {
    missionAudio.playClick();
    setOrbitHoloGridVisible((prev) => {
      const next = !prev;
      engineRef.current?.setOrbitHoloGridVisible(next);
      return next;
    });
  }, []);

  const handleToggleHeadlights = useCallback(() => {
    missionAudio.playClick();
    const state = engineRef.current?.toggleRoverHeadlights() ?? false;
    setHeadlightsOn(state);
  }, []);

  const handleTriggerChemCam = useCallback(() => {
    engineRef.current?.triggerChemCamScan();
  }, []);

  // Keyboard shortcuts across all stages (H, Space, WASD, C, T, L, F)
  useEffect(() => {
    const pressedKeys = new Set<string>();

    const syncRoverKeys = () => {
      let forward = 0;
      let turn = 0;
      if (pressedKeys.has('KeyW') || pressedKeys.has('ArrowUp')) forward += 1;
      if (pressedKeys.has('KeyS') || pressedKeys.has('ArrowDown')) forward -= 1;
      if (pressedKeys.has('KeyA') || pressedKeys.has('ArrowLeft')) turn += 1;
      if (pressedKeys.has('KeyD') || pressedKeys.has('ArrowRight')) turn -= 1;

      if (forward !== 0 || turn !== 0) {
        setAutoRoam(false);
        engineRef.current?.clearRoverNavigation();
        engineRef.current?.setRoverDriveInput({ forward, turn, autoRoam: false });
      } else {
        engineRef.current?.setRoverDriveInput({ forward: 0, turn: 0 });
      }
    };

    const onKeyDown = (e: KeyboardEvent) => {
      if (guideOpen || missionFailure) return;

      if (e.code === 'KeyH') {
        setHudHidden((prev) => !prev);
        return;
      }

      if (stage === 'orbit_insertion' && e.code === 'Space') {
        e.preventDefault();
        missionAudio.playClick();
        if (orbitTelemetry.phase === 'orbiting') {
          engineRef.current?.armDeorbitDescent();
        } else if (orbitTelemetry.phase === 'armed') {
          engineRef.current?.cancelDeorbitArm();
        }
        return;
      }

      if (stage === 'final_visual') {
        if (e.code === 'KeyC') {
          e.preventDefault();
          const nextIdx = (CAMERA_MODE_ORDER.indexOf(cameraMode) + 1) % CAMERA_MODE_ORDER.length;
          handleSelectCameraMode(CAMERA_MODE_ORDER[nextIdx]);
          return;
        }
        if (e.code === 'KeyT' && surfacePhase === 'descending') {
          e.preventDefault();
          missionAudio.playClick();
          handleSetManualThrottle(surfaceTelemetry.manualThrottlePct === null ? 78 : null);
          return;
        }
        if (e.code === 'KeyL' && surfacePhase === 'rover_active') {
          e.preventDefault();
          handleToggleHeadlights();
          return;
        }
        if (e.code === 'KeyF' && surfacePhase === 'rover_active') {
          e.preventDefault();
          handleTriggerChemCam();
          return;
        }

        if (
          surfacePhase === 'rover_active' &&
          (e.code === 'KeyW' ||
            e.code === 'KeyA' ||
            e.code === 'KeyS' ||
            e.code === 'KeyD' ||
            e.code === 'ArrowUp' ||
            e.code === 'ArrowDown' ||
            e.code === 'ArrowLeft' ||
            e.code === 'ArrowRight')
        ) {
          e.preventDefault();
          pressedKeys.add(e.code);
          syncRoverKeys();
        }
      }
    };

    const onKeyUp = (e: KeyboardEvent) => {
      if (pressedKeys.has(e.code)) {
        pressedKeys.delete(e.code);
        if (stage === 'final_visual' && surfacePhase === 'rover_active') {
          syncRoverKeys();
        }
      }
    };

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      engineRef.current?.setRoverDriveInput({ forward: 0, turn: 0 });
    };
  }, [
    guideOpen,
    missionFailure,
    stage,
    orbitTelemetry.phase,
    surfacePhase,
    cameraMode,
    surfaceTelemetry.manualThrottlePct,
    handleSelectCameraMode,
    handleSetManualThrottle,
    handleToggleHeadlights,
    handleTriggerChemCam,
  ]);

  const handleResetMission = useCallback(() => {
    missionAudio.playClick();
    setMissionFailure(null);
    setScenarioId('planetary_pioneer');
    setCommanderConfig({ ...DEFAULT_COMMANDER_CONFIG });
    setHangarConfig({ ...DEFAULT_HANGAR_CONFIG });
    setTargetWorldId('moon');
    setCardVisibility(true);
    setJourneyWarp(1000);
    setJourneyProgress(0);
    setJourneyFuelPct(100);
    setLaunchTelemetry(INITIAL_LAUNCH_TELEMETRY);
    setOrbitTelemetry(INITIAL_ORBIT_TELEMETRY);
    setSurfacePhase('descending');
    setSurfaceTelemetry(INITIAL_SURFACE_TELEMETRY);
    setCameraMode('chase');
    setAutoRoam(false);
    setHeadlightsOn(false);
    setSunElevationDeg(48);
    setAutoShowcaseOrbit(false);
    setOrbitHoloGridVisible(true);
    setRoverNav(INITIAL_ROVER_NAV);
    setScienceState(INITIAL_SCIENCE_STATE);
    setStage('start_menu');

    const nextStats = computeCraftStats(DEFAULT_HANGAR_CONFIG, 'moon', 'planetary_pioneer');
    engineRef.current?.setJourneySpeed(1000);
    engineRef.current?.setOrbitTimeWarp(1);
    engineRef.current?.setManualThrottle(null);
    engineRef.current?.setSunElevationDeg(48);
    engineRef.current?.setAutoShowcaseOrbit(false);
    engineRef.current?.setOrbitHoloGridVisible(true);
    engineRef.current?.setSurfaceCameraMode('chase');
    engineRef.current?.updateCommanderConfig(DEFAULT_COMMANDER_CONFIG);
    engineRef.current?.updateHangarConfig(DEFAULT_HANGAR_CONFIG, nextStats);
    engineRef.current?.focusWorld('moon');
    engineRef.current?.setStage('start_menu');
  }, [setCardVisibility]);

  return (
    <div className="relative w-screen h-screen flex flex-col bg-[#03050c] text-slate-100 overflow-hidden">
      <TopBar
        stage={stage}
        onStageChange={switchStage}
        scenarioId={scenarioId}
        targetWorldId={targetWorldId}
        onSelectWorld={handleSelectWorld}
        lang={lang}
        onToggleLang={() => {
          missionAudio.playClick();
          setLang((prev) => (prev === 'tr' ? 'en' : 'tr'));
        }}
        audioEnabled={audioEnabled}
        onToggleAudio={() => {
          const next = !audioEnabled;
          setAudioEnabled(next);
          missionAudio.setEnabled(next);
        }}
        hudHidden={hudHidden}
        onToggleHud={() => setHudHidden((prev) => !prev)}
        onOpenGuide={() => {
          missionAudio.playClick();
          setGuideOpen(true);
        }}
        onResetMission={handleResetMission}
      />

      <main className="relative flex-1 w-full h-full overflow-hidden">
        {/* Isolated WebGL Mount Container */}
        <div ref={canvasMountRef} className="absolute inset-0 w-full h-full" />

        {/* Scene 0: Cinematic Main Menu & 3D Character / Suit Design Studio */}
        {!hudHidden && stage === 'start_menu' && (
          <StartMenuOverlay
            commanderConfig={commanderConfig}
            targetWorldId={targetWorldId}
            onChangeFlag={(flagId: FlagId) => updateCommander({ flagId })}
            onChangeVisor={(visorId: VisorColorId) => updateCommander({ visorId })}
            onChangeSuitPalette={(suitPaletteId: SuitPaletteId) =>
              updateCommander({ suitPaletteId })
            }
            onToggleAutoRotate={() =>
              updateCommander({ autoRotate: !commanderConfig.autoRotate })
            }
            onResetCamera={() => {
              missionAudio.playClick();
              engineRef.current?.resetStartCamera();
            }}
            onStartMission={() => switchStage('scenario_select')}
          />
        )}

        {/* Scene 0.5: Mission Scenario Selection (Planetary Pioneer vs Deep Space Rescue: L1 Solar Storm) */}
        {!hudHidden && stage === 'scenario_select' && (
          <ScenarioSelectOverlay
            lang={lang}
            selectedScenarioId={scenarioId}
            commanderConfig={commanderConfig}
            onSelectScenario={(id) => {
              missionAudio.playSnap();
              setScenarioId(id);
            }}
            onConfirmScenario={handleConfirmScenario}
            onBackToSuitStudio={() => switchStage('start_menu')}
          />
        )}

        {/* Scene 1: Projected Planet Labels + Dismissible NASA Data Card */}
        {stage === 'planet_select' && !hudHidden && (
          <div className="pointer-events-none absolute inset-0 z-10 overflow-hidden">
            {SOLAR_LABELS.map((item) => (
              <button
                key={item.id}
                type="button"
                ref={(el) => {
                  labelRefs.current[item.id] = el;
                }}
                onClick={() => {
                  if (item.worldId) handleSelectWorld(item.worldId);
                }}
                style={{ opacity: 0, left: 0, top: 0 }}
                className="absolute px-2 py-0.5 rounded text-[11px] font-medium transition-colors whitespace-nowrap select-none cursor-pointer bg-[#060b16]/80 text-slate-200 data-[selected=true]:bg-cyan-950/90 data-[selected=true]:text-cyan-200 data-[selected=true]:border data-[selected=true]:border-cyan-400"
              >
                {item.text}
              </button>
            ))}

            {/* Selected Planet Real NASA Data Callout */}
            <div
              ref={planetCardRef}
              style={{ opacity: planetCardOpen ? 1 : 0, left: 0, top: 0 }}
              className="absolute w-64 bg-[#070d1c]/94 border border-cyan-400/60 rounded-xl p-3.5 shadow-2xl transition-opacity duration-150"
            >
              <div className="flex items-center justify-between text-[10px] font-mono-tabular">
                <span className="text-cyan-400">{activeWorld.category}</span>
                <div className="flex items-center gap-2">
                  <span
                    className={
                      activeWorld.radiationHazard === 'EXTREME'
                        ? 'text-rose-400 font-semibold'
                        : activeWorld.radiationHazard === 'HIGH'
                        ? 'text-amber-300 font-semibold'
                        : 'text-emerald-300 font-semibold'
                    }
                  >
                    RAD: {activeWorld.radiationHazard}
                  </span>
                  <button
                    type="button"
                    aria-label="Bilgi kutusunu kapat"
                    onClick={() => {
                      missionAudio.playClick();
                      setCardVisibility(false);
                    }}
                    className="text-slate-400 hover:text-white cursor-pointer"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              <div className="font-display text-base font-bold text-white mt-0.5">
                {activeWorld.name}
              </div>

              <div className="mt-2 space-y-1 text-[11px] font-mono-tabular border-t border-slate-800 pt-2">
                <div className="flex justify-between">
                  <span className="text-slate-400">Radius (Rp / R⊕)</span>
                  <span className="text-amber-300 font-semibold">
                    {activeWorld.earthRadiusRatio} R⊕ ({activeWorld.meanRadiusKm.toLocaleString()} km)
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Ephemeris r(θ)</span>
                  <span className="text-slate-100">
                    {targetWorldId === 'moon' || targetWorldId === 'earth'
                      ? activeWorld.distanceLabel
                      : `${solarTelemetry.selectedRadiusAU.toFixed(3)} AU (${activeWorld.distanceLabel})`}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Vis-Viva Speed v(θ)</span>
                  <span className="text-cyan-300 font-semibold">
                    {solarTelemetry.selectedVelocityKms.toFixed(2)} km/s (θ={solarTelemetry.selectedTrueAnomalyDeg}°)
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Trip Duration</span>
                  <span className="text-slate-100">{activeWorld.tripDuration}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Gravity</span>
                  <span className="text-amber-300">
                    {activeWorld.gravity} m/s² ({activeWorld.earthG} g)
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Hohmann Δv / Fuel</span>
                  <span className="text-cyan-300">
                    {activeWorld.transferDeltaVKms} km/s · {(activeWorld.requiredFuelKg / 1000).toFixed(0)}t
                  </span>
                </div>
              </div>

              <button
                type="button"
                onClick={() => switchStage('hangar')}
                className="mt-2.5 w-full flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-xs font-semibold text-white cursor-pointer"
              >
                <span>Enter Hangar</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}

        {webglError && (
          <div className="absolute inset-0 z-40 flex items-center justify-center bg-[#060911] p-6 text-center">
            <div className="max-w-md bg-[#0b1222] border border-slate-800 rounded-xl p-6">
              <h2 className="font-display text-lg font-bold text-white">
                3D Graphics Context Unavailable
              </h2>
              <p className="text-xs text-slate-400 mt-2">
                WebGL rendering was interrupted. Reload the page to reinitialize MissionForge.
              </p>
            </div>
          </div>
        )}

        {!hudHidden && stage === 'planet_select' && (
          <PlanetSelectOverlay
            targetWorldId={targetWorldId}
            solarTelemetry={solarTelemetry}
            onSelectWorld={handleSelectWorld}
            onChangeScaleMode={(mode: SolarScaleMode) => {
              missionAudio.playClick();
              engineRef.current?.setSolarScaleMode(mode);
            }}
            onChangeTimeSpeed={(daysPerSec: number) => {
              missionAudio.playClick();
              engineRef.current?.setSolarTimeSpeed(daysPerSec);
            }}
            onEnterHangar={() => switchStage('hangar')}
          />
        )}

        {/* Scene 2: Hangar (from Nasa-hackathon-2-3-4) */}
        {!hudHidden && stage === 'hangar' && (
          <HangarOverlay
            scenarioId={scenarioId}
            targetWorldId={targetWorldId}
            config={hangarConfig}
            stats={craftStats}
            turntablePaused={turntablePaused}
            onChangeCraftClass={handleSelectCraftClass}
            onChangeEngineId={(id: EngineId) => updateConfig({ engineId: id })}
            onChangeFuelId={(id: FuelOptionId) => updateConfig({ fuelId: id })}
            onChangePowerSource={(id: PowerSourceId) => updateConfig({ powerSource: id })}
            onChangeShieldTier={(id: ShieldTierId) => updateConfig({ shieldTier: id })}
            onChangeMinxssTier={(id: MinxssTierId) => updateConfig({ minxssTier: id })}
            onToggleTurntable={() => {
              const next = !turntablePaused;
              setTurntablePaused(next);
              engineRef.current?.setTurntablePaused(next);
            }}
            onProceedToLaunch={() => switchStage('launch_pad')}
          />
        )}

        {/* Scene 3: Launch Pad (from Nasa-hackathon-2-3-4) */}
        {!hudHidden && stage === 'launch_pad' && (
          <LaunchOverlay
            targetWorldId={targetWorldId}
            stats={craftStats}
            telemetry={launchTelemetry}
            onStartCountdown={() => engineRef.current?.startCountdown()}
            onResetPad={() => engineRef.current?.resetLaunchState()}
            onSkipToJourney={() => switchStage('journey')}
            onReturnHangar={() => switchStage('hangar')}
          />
        )}

        {/* Scene 4: Interplanetary Journey (from Nasa-hackathon-2-3-4 + NASA GMAT Hohmann/Vis-Viva) */}
        {!hudHidden && stage === 'journey' && (
          <JourneyOverlay
            targetWorldId={targetWorldId}
            progressPct={journeyProgress}
            fuelPct={journeyFuelPct}
            fuelPasses={craftStats.fuelPasses}
            warpSpeed={journeyWarp}
            transitState={journeyTransitState}
            onChangeWarpSpeed={(speed) => {
              missionAudio.playClick();
              setJourneyWarp(speed);
              engineRef.current?.setJourneySpeed(speed);
            }}
            onSkipToOrbit={() => switchStage('orbit_insertion')}
          />
        )}

        {/* Scene 5: Orbit Insertion & De-Orbit Targeting (or L1 Orbit Insertion in Scenario 2) */}
        {!hudHidden && stage === 'orbit_insertion' && (
          <OrbitInsertionOverlay
            lang={lang}
            scenarioId={scenarioId}
            targetWorldId={targetWorldId}
            craftClass={hangarConfig.craftClass}
            stats={craftStats}
            telemetry={orbitTelemetry}
            orbitHoloGridVisible={orbitHoloGridVisible}
            onToggleOrbitHoloGrid={handleToggleOrbitHoloGrid}
            onSelectCraftClass={handleSelectCraftClass}
            onSelectSiteAngle={(deg) => {
              missionAudio.playSnap();
              engineRef.current?.selectLandingSiteAngle(deg);
            }}
            onSetTimeWarp={handleSetTimeWarp}
            onArmDeorbit={() => {
              missionAudio.playClick();
              engineRef.current?.armDeorbitDescent();
            }}
            onCancelArm={() => {
              missionAudio.playClick();
              engineRef.current?.cancelDeorbitArm();
            }}
          />
        )}

        {/* Scene 6: Surface Landing & Rover ChemCam Exploration OR L1 Early Warning Broadcast */}
        {!hudHidden && stage === 'final_visual' && scenarioId === 'solar_storm_l1' && (
          <L1BroadcastOverlay
            lang={lang}
            config={hangarConfig}
            stats={craftStats}
            onReturnToOrbit={() => switchStage('orbit_insertion')}
            onReturnToHangar={() => switchStage('hangar')}
            onFlareVisualChange={(intensity01: number, isBroadcasting: boolean) => {
              engineRef.current?.setL1FlareVisualState(intensity01, isBroadcasting);
            }}
          />
        )}

        {!hudHidden && stage === 'final_visual' && scenarioId !== 'solar_storm_l1' && (
          <FinalVisualOverlay
            lang={lang}
            targetWorldId={targetWorldId}
            stats={craftStats}
            surfacePhase={surfacePhase}
            surfaceTelemetry={surfaceTelemetry}
            cameraMode={cameraMode}
            autoRoam={autoRoam}
            headlightsOn={headlightsOn}
            sunElevationDeg={sunElevationDeg}
            autoShowcaseOrbit={autoShowcaseOrbit}
            roverNav={roverNav}
            scienceState={scienceState}
            onSelectCameraMode={handleSelectCameraMode}
            onSetManualThrottle={handleSetManualThrottle}
            onSetSunElevationDeg={handleSetSunElevationDeg}
            onToggleAutoShowcaseOrbit={handleToggleAutoShowcaseOrbit}
            onToggleAutoRoam={() => {
              missionAudio.playClick();
              const next = !autoRoam;
              setAutoRoam(next);
              engineRef.current?.setRoverDriveInput({ autoRoam: next });
            }}
            onToggleHeadlights={handleToggleHeadlights}
            onTriggerChemCam={handleTriggerChemCam}
            onStartAutonomousMission={() => {
              missionAudio.playClick();
              engineRef.current?.startAutonomousRoverMission();
            }}
            onResetRoverState={() => {
              missionAudio.playClick();
              setAutoRoam(false);
              engineRef.current?.resetRoverState();
            }}
            onDriveControl={(forward, turn) => {
              engineRef.current?.setRoverDriveInput({ forward, turn });
            }}
            onCancelRoverRoute={() => {
              missionAudio.playClick();
              engineRef.current?.clearRoverNavigation();
            }}
            onReplaySequence={() => {
              missionAudio.playClick();
              setAutoRoam(false);
              setRoverNav(INITIAL_ROVER_NAV);
              engineRef.current?.replaySurfaceSequence();
            }}
            onSkipToRover={() => {
              missionAudio.playClick();
              engineRef.current?.skipToRoverActive();
            }}
            onReturnToOrbit={() => switchStage('orbit_insertion')}
          />
        )}

        {hudHidden && (
          <div className="pointer-events-auto absolute bottom-4 left-1/2 -translate-x-1/2 z-30">
            <button
              type="button"
              onClick={() => setHudHidden(false)}
              className="px-4 py-2 rounded-lg bg-[#080d1a]/92 border border-cyan-500/40 text-xs font-medium text-cyan-200 hover:bg-cyan-500/20 cursor-pointer"
            >
              {lang === 'tr' ? 'HUD Göster [H]' : 'Show HUD [H]'}
            </button>
          </div>
        )}
      </main>

      <MissionFailedModal
        failure={missionFailure}
        onReturnToHangar={() => switchStage('hangar')}
        onRetryStage={() => {
          missionAudio.playClick();
          const reason = missionFailure?.reason;
          setMissionFailure(null);
          if (reason === 'underpowered_engine') {
            engineRef.current?.resetLaunchState();
          } else {
            setJourneyProgress(0);
            setJourneyFuelPct(100);
            engineRef.current?.setStage('journey');
          }
        }}
      />

      <GuideModal open={guideOpen} onClose={() => setGuideOpen(false)} />
    </div>
  );
}
