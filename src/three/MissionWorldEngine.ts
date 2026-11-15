import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { RectAreaLightUniformsLib } from 'three/addons/lights/RectAreaLightUniformsLib.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import {
  CommanderConfig,
  CRAFT_CLASSES,
  CraftStats,
  DEFAULT_COMMANDER_CONFIG,
  ENGINE_OPTIONS,
  FlagId,
  FUEL_OPTIONS,
  HangarConfig,
  JourneyWarpSpeed,
  LANDING_SITES,
  MissionFailureInfo,
  POWER_SOURCES,
  SceneStage,
  SurfacePhase,
  WORLDS,
  WorldId,
} from '../data/missionData';
import {
  auToSceneRadius,
  computeVisVivaSpeedKms,
  evaluateHohmannTransitState,
  getScientificBodySceneRadius,
  HohmannTransitState,
  KeplerianElements as KeplerElements,
  MOON_ORBIT_ELEMENTS,
  propagateKeplerian3D,
  sampleKeplerianOrbit3D,
  SOLAR_SYSTEM_EPHEMERIS,
  SolarScaleMode,
  SUN_EARTH_RADIUS_RATIO,
} from '../physics/orbitalMechanics';
import { missionAudio } from '../utils/audio';
import {
  buildApolloLunarModuleBackdrop,
  buildCarrierRocketSpaceship,
  buildColonyStructures,
  buildHangarSpacecraft,
  buildCommanderAstronautRig,
  buildDropSpaceship,
  buildRoboticArm,
  buildRoverVehicle,
  buildSatellite,
  buildShuttleLaunchTower,
  CarrierRocketRig,
  CommanderAstronautRig,
  createAtmosphereMesh,
  CURIOSITY_WHEEL_HUBS,
  LandingVehicleRig,
  RoverVehicleRig,
  SpacecraftPBRAssets,
  updateCommanderAstronautMaterials,
} from './models';
import {
  clampToFreeSurfacePoint,
  findShortestObstacleFreePath,
  generateWorldObstacles,
  getCraterDisplacement,
  getWorldCraters,
  ROVER_COLLISION_RADIUS,
  RoverNavTelemetry,
  ScienceMissionState,
  ScienceSampleRecord,
  SurfaceObstacle,
} from './surfaceNavigation';

export type { HohmannTransitState, RoverNavTelemetry, ScienceMissionState, ScienceSampleRecord, SolarScaleMode };

import {
  createAsteroidPBR,
  createEaglePanelFlagTexture,
  createEarthLaunchSurfacePBR,
  createEarthPBR,
  createETFoamPBR,
  createEuropaIcePBR,
  createHangarFloorPBR,
  createHangarWallDisplay,
  createJupiterPBR,
  createKaptonFoilPBR,
  createMarsPBR,
  createMilkyWayBackdropTexture,
  createMissionFlagTexture,
  createMoonPBR,
  createSaturnPBR,
  createSaturnRingTexture,
  createShuttleTilesPBR,
  createSmokePuffTexture,
  createSoftGlowTexture,
  createSolarCellPBR,
  createSunPBR,
  fbm3,
  HangarWallDisplay,
  PBRTextureSet,
} from './proceduralTextures';

export type OrbitTimeWarp = 1 | 2 | 4;
export type SurfaceCameraMode = 'chase' | 'starship_cam' | 'pad_cam' | 'rover_cam';

export interface ProjectedLabel {
  id: string;
  text?: string;
  x: number;
  y: number;
  visible: boolean;
  selected: boolean;
  hovered: boolean;
}

export interface SolarEphemerisTelemetry {
  epochDateStr: string;
  elapsedDays: number;
  scaleMode: SolarScaleMode;
  timeSpeedDaysPerSec: number;
  selectedRadiusAU: number;
  selectedRadiusKm: number;
  selectedVelocityKms: number;
  selectedTrueAnomalyDeg: number;
  selectedEarthRadiusRatio: number;
  sunEarthRadiusRatio: number;
}

export interface LaunchTelemetry {
  phase:
    | 'pad'
    | 'countdown'
    | 'liftoff'
    | 'srb_sep'
    | 'tank_sep'
    | 'satellite_sep'
    | 'failed_arc'
    | 'failed_crash';
  countdownValue: number;
  altitudeKm: number;
  velocityKmh: number;
  accelG: number;
  fuelPct: number;
  stageLabel: string;
  sepVelocityMs: number;
}

export interface OrbitTelemetry {
  craftAngleDeg: number;
  siteAngleDeg: number;
  alignmentPct: number;
  altitudeKm: number;
  orbitalVelocityKms: number;
  orbitalPeriodMin: number;
  deorbitBurnMs: number;
  phase: 'orbiting' | 'armed' | 'descending';
  timeWarp: OrbitTimeWarp;
  tpsTempC: number;
  accelG: number;
}

export interface SurfaceTelemetry {
  altitudeM: number;
  verticalSpeedMs: number;
  surfaceGravityMs2: number;
  maneuverLabel: string;
  fuelPct: number;
  manualThrottlePct: number | null;
  pitchDeg: number;
  mach: number;
  dynamicPressureKpa: number;
  gLoad: number;
}

export interface EngineCallbacks {
  onWorldSelect: (worldId: WorldId) => void;
  onWorldDeselect?: () => void;
  onWorldHover: (worldId: WorldId | null) => void;
  onSolarTelemetryUpdate?: (t: SolarEphemerisTelemetry) => void;
  onLaunchTelemetry: (t: LaunchTelemetry) => void;
  onLaunchComplete: () => void;
  onMissionFailed?: (failure: MissionFailureInfo) => void;
  onJourneyProgress: (pct: number) => void;
  onJourneyFuelUpdate?: (fuelPct: number) => void;
  onJourneyTransitUpdate?: (state: HohmannTransitState) => void;
  onJourneyComplete: () => void;
  onOrbitStateUpdate: (state: OrbitTelemetry) => void;
  onOrbitDescentComplete: () => void;
  onSurfacePhaseChange: (phase: SurfacePhase) => void;
  onSurfaceTelemetry?: (t: SurfaceTelemetry) => void;
  onRoverNavUpdate?: (nav: RoverNavTelemetry) => void;
  onScienceUpdate?: (state: ScienceMissionState) => void;
  onCameraModeChange?: (mode: SurfaceCameraMode) => void;
  onLabelsUpdate: (labels: ProjectedLabel[]) => void;
}

const SURFACE_METERS_PER_UNIT = 2.0;
const ORBIT_PLANET_RADIUS = 4.3;

const _v1 = new THREE.Vector3();
const _v2 = new THREE.Vector3();
const _v3 = new THREE.Vector3();
const _v4 = new THREE.Vector3();
const _v5 = new THREE.Vector3();
const _v6 = new THREE.Vector3();
const _v7 = new THREE.Vector3();
const _upAxis = new THREE.Vector3(0, 1, 0);
const _xAxis = new THREE.Vector3(1, 0, 0);
const _mat4 = new THREE.Matrix4();
const _quat = new THREE.Quaternion();
const _euler = new THREE.Euler();
const _scale = new THREE.Vector3();
const _col = new THREE.Color();

export class MissionWorldEngine {
  private container: HTMLElement;
  private renderer: THREE.WebGLRenderer;
  private composer: EffectComposer | null = null;
  private bloomPass: UnrealBloomPass | null = null;
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private controls: OrbitControls;
  private clock = new THREE.Clock();
  private isSoftwareGl = false;
  private frameId = 0;
  private disposed = false;

  private activeStage: SceneStage = 'start_menu';
  private targetWorldId: WorldId = 'moon';
  private hoveredWorldId: WorldId | null = null;
  private currentConfig: HangarConfig;
  private currentStats: CraftStats;
  private callbacks: EngineCallbacks;
  private maxAnisotropy = 8;

  // PBR Texture Suites
  private sunPBR: PBRTextureSet;
  private earthPBR: PBRTextureSet;
  private earthLaunchSurfacePBR: PBRTextureSet;
  private moonPBR: PBRTextureSet;
  private mercuryPBR: PBRTextureSet;
  private marsPBR: PBRTextureSet;
  private jupiterPBR: PBRTextureSet;
  private saturnPBR: PBRTextureSet;
  private saturnRingTex: THREE.DataTexture;
  private europaPBR: PBRTextureSet;
  private asteroidPBR: PBRTextureSet;
  private proximaPBR: PBRTextureSet;
  private hangarFloorPBR: PBRTextureSet;
  private milkyWayTexture: THREE.Texture;
  private glowTexture: THREE.Texture;
  private smokeTexture: THREE.Texture;
  private wallDisplay: HangarWallDisplay;
  private spacecraftAssets: SpacecraftPBRAssets;

  private starField!: THREE.InstancedMesh;
  private skyBackdrop!: THREE.Mesh;
  private hemiLight!: THREE.HemisphereLight;
  private keyLight!: THREE.DirectionalLight;
  private rimLight!: THREE.DirectionalLight;
  private sunVisualGroup!: THREE.Group;
  private sunElevationDeg = 48;

  // Scene root groups (0..6)
  private startGroup = new THREE.Group();
  private solarGroup = new THREE.Group();
  private hangarGroup = new THREE.Group();
  private launchGroup = new THREE.Group();
  private journeyGroup = new THREE.Group();
  private orbitGroup = new THREE.Group();
  private finalGroup = new THREE.Group();

  private cameraFocusTarget: THREE.Vector3 | null = null;
  private cameraFocusPos: THREE.Vector3 | null = null;
  private userOrbiting = false;
  private autoShowcaseOrbit = false;

  // Scene 0: Start Menu & 3D Character / Suit Studio
  private currentCommanderConfig: CommanderConfig = { ...DEFAULT_COMMANDER_CONFIG };
  private astronautTurntable = new THREE.Group();
  private astronautRig: CommanderAstronautRig | null = null;
  private flagTextures!: Record<FlagId, THREE.CanvasTexture>;
  private eaglePanelFlagTextures!: Record<FlagId, THREE.CanvasTexture>;
  private setEaglePanelFlagTex: ((tex: THREE.Texture) => void) | null = null;
  private lunarFlagClothMesh: THREE.Mesh | null = null;
  private lunarFlagClothBasePos: Float32Array | null = null;
  private lunarFlagClothMat: THREE.MeshStandardMaterial | null = null;
  private startEarthRiseGroup: THREE.Group | null = null;
  private startDustPoints: THREE.Points | null = null;
  private startPlatformRing: THREE.Mesh | null = null;

  // Scene 1: Full Solar System Map (NASA mission-viz Keplerian Ephemeris & Scale Modes)
  private sunGroup!: THREE.Group;
  private sunCore!: THREE.Mesh;
  private earthCloudsMesh: THREE.Mesh | null = null;
  private solarScaleMode: SolarScaleMode = 'orrery_proportional';
  private solarSimDays = 0;
  private solarTimeSpeedDaysPerSec = 10;
  private lastSolarTelemetryPush = 0;
  private solarOrbitLoops: { elements: KeplerElements; line: THREE.LineLoop }[] = [];
  private planetEntries: {
    id: string;
    worldId?: WorldId;
    label: string;
    mesh: THREE.Object3D;
    visualScaleGroup?: THREE.Group;
    spinGroup?: THREE.Group;
    glowSprite?: THREE.Sprite;
    ringHighlight?: THREE.Mesh;
    clickProxy?: THREE.Mesh;
    elements?: KeplerElements;
    orbitRadius: number;
    orbitSpeed: number;
    angle: number;
    parentMesh?: THREE.Object3D;
    instantRadiusAU?: number;
    instantRadiusKm?: number;
    instantVelocityKms?: number;
    trueAnomalyDeg?: number;
  }[] = [];
  private worldMeshes = new Map<WorldId, THREE.Object3D>();
  private clickableProxies: THREE.Object3D[] = [];
  private asteroidBelt!: THREE.InstancedMesh;
  private asteroidBeltData: { radiusAU: number; angle: number; speed: number; y: number; scale: number }[] = [];

  // Scene 2: Hangar
  private hangarTurntable = new THREE.Group();
  private hangarCraftRig: CarrierRocketRig | null = null;
  private leftArm!: ReturnType<typeof buildRoboticArm>;
  private armReachTimer = 0;
  private hangarSnapTimer = 0;
  private turntablePaused = false;

  // Scene 3: Launch Pad (from repo_234)
  private shuttleRig!: CarrierRocketRig;
  private launchTower!: ReturnType<typeof buildShuttleLaunchTower>;
  private padSky!: THREE.Mesh;
  private padSkyMat!: THREE.ShaderMaterial;
  private launchEarthHorizon!: THREE.Group;
  private launchEarthRadius = 77272;
  private launchRocketHeight = 8.5;
  private launchRocketMinY = -0.9;
  private launchRocketMaxY = 8.4;
  private launchRocketSrbOffsetX = 1.65;
  private launchCloudSprites: { sprite: THREE.Sprite; baseX: number; baseY: number; baseZ: number; speed: number }[] = [];
  private launchTargetPlanet!: THREE.Mesh;
  private launchStarStreaks!: THREE.Points;
  private launchEngineLight!: THREE.PointLight;
  private launchExplosionGroup!: THREE.Group;
  private launchFireball!: THREE.Mesh;
  private launchShockwave!: THREE.Mesh;
  private launchDebris: { mesh: THREE.Mesh; vel: THREE.Vector3; rotVel: THREE.Vector3 }[] = [];
  private launchFailedTrail!: THREE.Line;
  private launchSepDashLine!: THREE.Line;
  private launchCrashTimer = 0;
  private launchFailTriggered = false;
  private launchFailStartTheta = 0;
  private launchFailEndTheta = 0.003;
  private launchFailStartAlt = 26;
  private launchFailPeakAlt = 48;
  private launchFailDuration = 2.4;
  private launchFailPrevPos = new THREE.Vector3();
  private launchFailImpactPos = new THREE.Vector3();
  private launchLagoonReflection: THREE.Mesh | null = null;
  private launchFog: THREE.FogExp2 | null = null;
  private smokePool: { sprite: THREE.Sprite; vel: THREE.Vector3; age: number; active: boolean; baseScale: number; maxAge: number }[] = [];

  private launchPhase: LaunchTelemetry['phase'] = 'pad';
  private countdownAccum = 0;
  private lastCountdownInt = 5;
  private shuttleY = 0;
  private shuttleZ = 0;
  private shuttleVelY = 0;
  private shuttleVelZ = 0;
  private launchStageTime = 0;
  private launchPitchRad = 0;
  private launchSimAltitudeKm = 0;
  private launchSimVelocityKmh = 0;
  private launchAccelG = 1.0;
  private launchFuelPct = 100;
  private srbSepDist = 0;
  private srbSepDrop = 0;
  private srbSepRot = 0;
  private bayDoorAngle = 0;
  private satSepDist = 0;
  private launchCamOffset = new THREE.Vector3(5.2, 2.75, 33.5);
  private launchLookOffset = new THREE.Vector3(1.5, 4.95, 0);
  private lastTelemetryPush = 0;

  // Scene 4: Journey (from repo_234)
  private journeyCurve!: THREE.CatmullRomCurve3;
  private journeyCraft!: THREE.Group;
  private journeySatGroup!: THREE.Group;
  private journeySatRig: LandingVehicleRig | null = null;
  private journeySatFlame!: THREE.Mesh;
  private lastJourneyTransitPush = 0;
  private journeyCarrierGroup = new THREE.Group();
  private journeyCarrierRig: CarrierRocketRig | null = null;
  private journeyCamLook = new THREE.Vector3();
  private journeyCamOffset = new THREE.Vector3();
  private journeyLookOffset = new THREE.Vector3();
  private journeyTargetQuat = new THREE.Quaternion();
  private journeyOriginPlanetPos = new THREE.Vector3(-8.5, 0, 18.5);
  private journeyTargetPlanet!: THREE.Mesh;
  private journeyProgress = 0;
  private journeySpeedMultiplier: JourneyWarpSpeed = 1000;
  private journeyFuelExhausted = false;
  private journeyLostTimer = 0;
  private journeyLostVel = new THREE.Vector3();
  private journeyFailTriggered = false;
  private lastJourneyFuelPct = 100;

  // Scene 5: Orbit Insertion (from repo_main)
  private orbitPlanetMesh!: THREE.Mesh;
  private orbitAtmoMesh!: THREE.Mesh;
  private orbitHoloGridGroup!: THREE.Group;
  private orbitCraft!: THREE.Group;
  private orbitCraftRig: LandingVehicleRig | null = null;
  private orbitReticleGroup!: THREE.Group;
  private orbitReticleMat!: THREE.MeshBasicMaterial;
  private orbitCraftFlame!: THREE.Mesh;
  private orbitPlasmaMesh!: THREE.Mesh;
  private orbitRingLine!: THREE.LineLoop;
  private orbitDescentLine!: THREE.Line;
  private landingBeaconGroup!: THREE.Group;
  private candidatePinsGroup = new THREE.Group();
  private orbitCraftAngle = 0;
  private selectedSiteAngleDeg = 35;
  private orbitPhase: 'orbiting' | 'armed' | 'descending' = 'orbiting';
  private orbitTimeWarp: OrbitTimeWarp = 1;
  private orbitDescentT = 0;
  private orbitDescentStartAngle = 0;
  private orbitDescentSweep = Math.PI * 2;
  private orbitTouchdownTimer = -1;
  private lastOrbitUiPush = 0;

  // Scene 6: Surface Exploration & Rover ChemCam (from repo_main)
  private landingVehicle: LandingVehicleRig | null = null;
  private landerScorchMesh: THREE.Mesh | null = null;
  private landerScorchIntensity = 0;
  private roverVehicle: RoverVehicleRig | null = null;
  private surfaceTerrainMesh: THREE.Mesh | null = null;
  private surfaceObstacles: SurfaceObstacle[] = [];
  private roverPathWaypoints: THREE.Vector2[] = [];
  private roverWaypointIdx = 0;
  private roverNavLine!: THREE.Line;
  private roverTargetBeacon!: THREE.Group;
  private roverBumpTimer = 0;
  private lastBumpAudioTime = 0;
  private obstacleNoticeTimer = 0;
  private currentObstacleNotice: string | null = null;
  private lastRoverNavPush = 0;
  private surfacePhase: SurfacePhase = 'descending';
  private surfaceCameraMode: SurfaceCameraMode = 'chase';
  private manualThrottlePct: number | null = null;
  private landerFuelPct = 100;
  private flipBurnIgnited = false;
  private surfaceTimer = 0;
  private landerY = 75;
  private landerVelY = 0;
  private landerCompression = 0;
  private landerCompressionVel = 0;
  private landerFlameFade = 1;
  private lastSurfacePush = 0;
  private rampAngle = 0;
  private roverPos = new THREE.Vector3(0, 0.48, -0.05);
  private roverHeading = 0;
  private roverDriveInput = { forward: 0, turn: 0, autoRoam: false };
  private roverHeadlightsOn = false;
  private wheelTrackMesh: THREE.InstancedMesh | null = null;
  private wheelTrackCount = 0;
  private lastWheelTrackPos = new THREE.Vector2(0, 0);
  private chemCamBeamLine: THREE.Line | null = null;
  private chemCamSparkSprite: THREE.Sprite | null = null;
  private chemCamScanTimer = 0;
  private chemCamActiveTarget: SurfaceObstacle | null = null;
  private pendingScanObstacleId: number | null = null;
  private collectedSamples: ScienceSampleRecord[] = [];
  private lastSpectroReadout: string | null = null;

  private autonomousMissionActive = false;
  private roverBattery = 100.0;
  private roverMaxBattery = 100.0;
  private roverTotalDistanceM = 0.0;
  private sensorTempC = -45.0;
  private sensorRadUsv = 55.0;
  private sensorSlopeDeg = 0.0;
  private sensorIrReflectance = 0.85;
  private sensorCameraStatus = 'Geniş Açı (Bekleme)';
  private spectrometerSummary = 'Analiz bekleniyor...';
  private systemLog = 'Sistem aktif. Hedef seçin veya Görev Başlatın.';
  private lastSensorUpdateTime = 0;
  private lastScienceUiPush = 0;
  private surfaceDustPool: {
    sprite: THREE.Sprite;
    vel: THREE.Vector3;
    age: number;
    active: boolean;
    baseScale: number;
  }[] = [];
  private finalRadarDish: THREE.Group | null = null;
  private finalCloudsMesh: THREE.Mesh | null = null;
  private l1ProbeGroup: THREE.Group | null = null;
  private l1SunCoronaSprite: THREE.Sprite | null = null;
  private l1BroadcastRings: THREE.Mesh[] = [];
  private l1FlareIntensity = 0;
  private l1IsBroadcasting = false;

  // Raycasting
  private raycaster = new THREE.Raycaster();
  private pointerNDC = new THREE.Vector2();
  private lastHoverCheck = 0;
  private pointerDownPos = new THREE.Vector2();

  constructor(
    container: HTMLElement,
    initialConfig: HangarConfig,
    initialStats: CraftStats,
    initialWorld: WorldId,
    callbacks: EngineCallbacks
  ) {
    this.container = container;
    this.currentConfig = { ...initialConfig };
    this.currentStats = initialStats;
    this.targetWorldId = initialWorld;
    this.callbacks = callbacks;

    this.isSoftwareGl = this.detectSoftwareWebGL();

    this.renderer = new THREE.WebGLRenderer({
      antialias: !this.isSoftwareGl,
      powerPreference: 'high-performance',
    });
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 0.88;
    this.renderer.setPixelRatio(
      this.isSoftwareGl ? 1 : Math.min(window.devicePixelRatio || 1, 2)
    );
    this.renderer.shadowMap.enabled = !this.isSoftwareGl;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    const width = container.clientWidth || window.innerWidth;
    const height = container.clientHeight || window.innerHeight;
    this.renderer.setSize(width, height);
    container.appendChild(this.renderer.domElement);

    this.maxAnisotropy = Math.min(16, this.renderer.capabilities.getMaxAnisotropy());

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x02040a);

    const pmremGenerator = new THREE.PMREMGenerator(this.renderer);
    this.scene.environment = pmremGenerator.fromScene(new RoomEnvironment(), 0.04).texture;
    this.scene.environmentIntensity = 0.42;
    pmremGenerator.dispose();

    this.camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 750);
    this.camera.position.set(0.18, 1.32, 3.45);

    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = !this.isSoftwareGl;
    this.controls.dampingFactor = 0.06;
    this.controls.minDistance = 1.9;
    this.controls.maxDistance = 135;
    this.controls.target.set(0.32, 1.08, -0.45);
    this.controls.update();

    this.controls.addEventListener('start', () => {
      this.userOrbiting = true;
      this.cameraFocusTarget = null;
      this.cameraFocusPos = null;
    });
    this.controls.addEventListener('end', () => {
      this.userOrbiting = false;
    });

    this.sunPBR = createSunPBR(this.maxAnisotropy);
    this.earthPBR = createEarthPBR(this.maxAnisotropy);
    this.earthLaunchSurfacePBR = createEarthLaunchSurfacePBR(this.maxAnisotropy);
    this.moonPBR = createMoonPBR(this.maxAnisotropy, false);
    this.mercuryPBR = createMoonPBR(this.maxAnisotropy, true);
    this.marsPBR = createMarsPBR(this.maxAnisotropy, false);
    this.jupiterPBR = createJupiterPBR(this.maxAnisotropy);
    this.saturnPBR = createSaturnPBR(this.maxAnisotropy);
    this.saturnRingTex = createSaturnRingTexture(this.maxAnisotropy);
    this.europaPBR = createEuropaIcePBR(this.maxAnisotropy);
    this.asteroidPBR = createAsteroidPBR(this.maxAnisotropy);
    this.proximaPBR = createMarsPBR(this.maxAnisotropy, true);
    this.hangarFloorPBR = createHangarFloorPBR(this.maxAnisotropy);
    this.milkyWayTexture = createMilkyWayBackdropTexture();
    this.glowTexture = createSoftGlowTexture();
    this.smokeTexture = createSmokePuffTexture();
    this.wallDisplay = createHangarWallDisplay(this.maxAnisotropy);

    this.flagTextures = {
      tr: createMissionFlagTexture('tr', this.maxAnisotropy),
      us: createMissionFlagTexture('us', this.maxAnisotropy),
    };
    this.eaglePanelFlagTextures = {
      tr: createEaglePanelFlagTexture(this.flagTextures.tr, this.maxAnisotropy),
      us: createEaglePanelFlagTexture(this.flagTextures.us, this.maxAnisotropy),
    };

    this.spacecraftAssets = {
      kapton: createKaptonFoilPBR(this.maxAnisotropy),
      solar: createSolarCellPBR(this.maxAnisotropy),
      shuttleWhite: createShuttleTilesPBR(this.maxAnisotropy, false),
      shuttleBlack: createShuttleTilesPBR(this.maxAnisotropy, true),
      etFoam: createETFoamPBR(this.maxAnisotropy),
      glow: this.glowTexture,
    };

    if (!this.isSoftwareGl) {
      RectAreaLightUniformsLib.init();
      this.composer = new EffectComposer(this.renderer);
      this.composer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
      this.composer.setSize(width, height);
      const renderPass = new RenderPass(this.scene, this.camera);
      this.bloomPass = new UnrealBloomPass(
        new THREE.Vector2(width, height),
        0.14,
        0.28,
        0.96
      );
      const outputPass = new OutputPass();
      this.composer.addPass(renderPass);
      this.composer.addPass(this.bloomPass);
      this.composer.addPass(outputPass);
    }

    this.setupLighting();
    this.buildSkyAndStars();
    this.buildStartMenuScene();
    this.buildSolarSystemScene();
    this.buildHangarScene();
    this.buildLaunchPadScene();
    this.buildJourneyScene();
    this.buildOrbitInsertionScene();
    this.buildFinalVisualScene();

    this.scene.add(
      this.startGroup,
      this.solarGroup,
      this.hangarGroup,
      this.launchGroup,
      this.journeyGroup,
      this.orbitGroup,
      this.finalGroup
    );

    this.setStage('start_menu');

    if (!this.isSoftwareGl) {
      this.renderer.compile(this.scene, this.camera);
    }

    this.bindEvents();
    this.clock.start();
    this.tick();
  }

  private detectSoftwareWebGL(): boolean {
    try {
      const probe = document.createElement('canvas');
      const gl = probe.getContext('webgl2');
      if (!gl) return true;
      const ext = gl.getExtension('WEBGL_debug_renderer_info');
      const param = ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER;
      const gpu = String(gl.getParameter(param));
      gl.getExtension('WEBGL_lose_context')?.loseContext();
      return /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
    } catch {
      return true;
    }
  }

  private setupLighting(): void {
    this.hemiLight = new THREE.HemisphereLight(0xa5c8ff, 0x0a1020, 0.38);
    this.scene.add(this.hemiLight);

    this.keyLight = new THREE.DirectionalLight(0xfff4e0, 1.65);
    this.keyLight.position.set(22, 34, 24);
    this.keyLight.castShadow = !this.isSoftwareGl;
    this.keyLight.shadow.mapSize.set(2048, 2048);
    this.keyLight.shadow.camera.left = -24;
    this.keyLight.shadow.camera.right = 24;
    this.keyLight.shadow.camera.top = 24;
    this.keyLight.shadow.camera.bottom = -24;
    this.keyLight.shadow.bias = -0.0004;
    this.keyLight.shadow.normalBias = 0.02;
    this.scene.add(this.keyLight);

    this.rimLight = new THREE.DirectionalLight(0x38bdf8, 0.42);
    this.rimLight.position.set(-22, 14, -24);
    this.scene.add(this.rimLight);

    // Solar Photosphere, Corona Halo & Multi-Ring Lens Flare Group
    this.sunVisualGroup = new THREE.Group();
    const sunCore = new THREE.Mesh(
      new THREE.SphereGeometry(2.8, 24, 20),
      new THREE.MeshBasicMaterial({ color: 0xfffbeb })
    );
    this.sunVisualGroup.add(sunCore);

    const coronaSprite = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: this.glowTexture,
        color: 0xfde68a,
        transparent: true,
        opacity: 0.85,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      })
    );
    coronaSprite.scale.setScalar(30);
    this.sunVisualGroup.add(coronaSprite);

    const outerFlareSprite = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: this.glowTexture,
        color: 0x38bdf8,
        transparent: true,
        opacity: 0.36,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      })
    );
    outerFlareSprite.scale.set(64, 18, 1);
    this.sunVisualGroup.add(outerFlareSprite);

    const warmHaloSprite = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: this.glowTexture,
        color: 0xf97316,
        transparent: true,
        opacity: 0.32,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      })
    );
    warmHaloSprite.scale.setScalar(52);
    this.sunVisualGroup.add(warmHaloSprite);

    this.scene.add(this.sunVisualGroup);
    this.setSunElevationDeg(this.sunElevationDeg);
  }

  public setSunElevationDeg(deg: number): void {
    this.sunElevationDeg = THREE.MathUtils.clamp(deg, 5, 85);
    const elevRad = THREE.MathUtils.degToRad(this.sunElevationDeg);
    const azimuthRad = 0.72; // ~41° azimuth for dramatic crater rim lighting
    const dist = 42;
    const horiz = Math.cos(elevRad) * dist;
    const lx = Math.cos(azimuthRad) * horiz;
    const ly = Math.max(3.2, Math.sin(elevRad) * dist);
    const lz = Math.sin(azimuthRad) * horiz;

    this.keyLight.position.set(lx, ly, lz);
    this.sunVisualGroup.position.set(lx * 4.6, ly * 4.6, lz * 4.6);

    // Smooth color temperature & intensity transition from Dusk/Night (5°) -> Golden Hour (22°) -> Midday (55°+)
    const t = THREE.MathUtils.clamp((this.sunElevationDeg - 5) / 55, 0, 1);
    const duskCol = new THREE.Color(0xf97316);
    const goldenCol = new THREE.Color(0xfde68a);
    const noonCol = new THREE.Color(0xfff4e0);

    if (t < 0.35) {
      this.keyLight.color.copy(duskCol).lerp(goldenCol, t / 0.35);
    } else {
      this.keyLight.color.copy(goldenCol).lerp(noonCol, (t - 0.35) / 0.65);
    }

    this.keyLight.intensity = THREE.MathUtils.lerp(0.52, 1.72, Math.pow(t, 0.75));
    this.hemiLight.intensity = THREE.MathUtils.lerp(0.12, 0.40, t);
    this.rimLight.intensity = THREE.MathUtils.lerp(0.62, 0.38, t);
  }

  public setAutoShowcaseOrbit(enabled: boolean): void {
    this.autoShowcaseOrbit = enabled;
    if (enabled) {
      this.userOrbiting = false;
    }
  }

  public setOrbitHoloGridVisible(visible: boolean): void {
    if (this.orbitHoloGridGroup) {
      this.orbitHoloGridGroup.visible = visible;
    }
  }

  private buildSkyAndStars(): void {
    this.skyBackdrop = new THREE.Mesh(
      new THREE.SphereGeometry(290, 48, 32),
      new THREE.MeshBasicMaterial({
        map: this.milkyWayTexture,
        side: THREE.BackSide,
        depthWrite: false,
      })
    );
    this.scene.add(this.skyBackdrop);

    const count = 1200;
    const geo = new THREE.OctahedronGeometry(0.16, 1);
    const mat = new THREE.MeshBasicMaterial({ color: 0xffffff });
    this.starField = new THREE.InstancedMesh(geo, mat, count);
    for (let i = 0; i < count; i++) {
      const r = 145 + Math.random() * 125;
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      _v1.set(
        r * Math.sin(phi) * Math.cos(theta),
        r * Math.sin(phi) * Math.sin(theta),
        r * Math.cos(phi)
      );
      _euler.set(0, 0, 0);
      _quat.setFromEuler(_euler);
      const s = 0.35 + Math.random() * 1.35;
      _scale.set(s, s, s);
      _mat4.compose(_v1, _quat, _scale);
      this.starField.setMatrixAt(i, _mat4);
      const tint = Math.random();
      _col.setHex(tint < 0.22 ? 0x93c5fd : tint < 0.38 ? 0xfde68a : 0xf8fafc);
      this.starField.setColorAt(i, _col);
    }
    this.starField.instanceMatrix.needsUpdate = true;
    if (this.starField.instanceColor) this.starField.instanceColor.needsUpdate = true;
    this.starField.computeBoundingSphere();
    this.scene.add(this.starField);
  }

  private getWorldPBR(worldId: WorldId): PBRTextureSet {
    switch (worldId) {
      case 'earth':
        return this.earthPBR;
      case 'moon':
        return this.moonPBR;
      case 'mars':
        return this.marsPBR;
      case 'jupiter':
        return this.jupiterPBR;
      case 'asteroid':
        return this.asteroidPBR;
      case 'colony':
        return this.proximaPBR;
      case 'l1':
        return this.sunPBR;
    }
  }

  public setL1FlareVisualState(flareIntensity01: number, isBroadcasting: boolean): void {
    this.l1FlareIntensity = THREE.MathUtils.clamp(flareIntensity01, 0, 1);
    this.l1IsBroadcasting = isBroadcasting;
  }


  private buildStartMenuScene(): void {
    const initialFlagTex = this.flagTextures[this.currentCommanderConfig.flagId];

    // 1. Apollo 11 Tranquility Base Cratered Lunar Regolith Terrain Disk
    const lunarGroundGeo = new THREE.PlaneGeometry(34, 34, 96, 96);
    lunarGroundGeo.rotateX(-Math.PI / 2);
    const gPos = lunarGroundGeo.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < gPos.count; i++) {
      const vx = gPos.getX(i);
      const vz = gPos.getZ(i);
      const dist = Math.hypot(vx, vz);
      // Keep central astronaut pedestal area flat, sculpt craters & hills around perimeter
      const flatMask = THREE.MathUtils.smoothstep(dist, 1.8, 3.6);
      let h = fbm3(vx * 0.22, 0, vz * 0.22, 4, 19) * 0.45 * flatMask;
      // Add subtle Apollo 11 West Crater depression to the left-rear
      const cDist = Math.hypot(vx + 3.2, vz + 2.8);
      if (cDist < 2.2) {
        const u = cDist / 2.2;
        h += (u < 0.78 ? -0.28 * (1 - (u / 0.78) ** 2) : 0.09 * Math.sin(((u - 0.78) / 0.22) * Math.PI));
      }
      gPos.setY(i, h - 0.03);
    }
    lunarGroundGeo.computeVertexNormals();

    const lunarGroundMat = new THREE.MeshStandardMaterial({
      map: this.moonPBR.map,
      normalMap: this.moonPBR.normalMap ?? null,
      roughnessMap: this.moonPBR.roughnessMap ?? null,
      color: 0xb8c0cc,
      roughness: 0.92,
      metalness: 0.05,
    });
    const studioFloor = new THREE.Mesh(lunarGroundGeo, lunarGroundMat);
    studioFloor.receiveShadow = true;
    this.startGroup.add(studioFloor);

    // Scattered Lunar Basalt Rocks around the landing site
    const lunarRockGeo = this.sculptCrateredBasaltGeometry(0.28, 2, 707, 4);
    const lunarRockMat = new THREE.MeshStandardMaterial({
      map: this.asteroidPBR.map,
      normalMap: this.asteroidPBR.normalMap ?? null,
      color: 0x64748b,
      roughness: 0.88,
      metalness: 0.18,
    });
    const rockSpots = [
      [-2.3, -1.2, 0.75],
      [-1.85, 1.35, 0.52],
      [2.25, 1.1, 0.64],
      [-3.1, -2.6, 1.15],
      [3.4, -1.5, 0.9],
      [0.85, -2.4, 0.48],
    ];
    for (let i = 0; i < rockSpots.length; i++) {
      const [rx, rz, rs] = rockSpots[i];
      const rock = new THREE.Mesh(lunarRockGeo, lunarRockMat);
      rock.position.set(rx, 0.04, rz);
      rock.scale.set(rs * 1.1, rs * 0.72, rs * 0.95);
      rock.rotation.set(i * 0.7, i * 1.3, 0);
      rock.castShadow = true;
      rock.receiveShadow = true;
      this.startGroup.add(rock);
    }

    // 2. Apollo Ribbed Astronaut Bootprint Impressions Directly in the Lunar Regolith
    const bootTreadMat = new THREE.MeshStandardMaterial({
      color: 0x475569,
      roughness: 0.95,
      metalness: 0.05,
    });
    const bootPositions = [
      [-0.45, 0.42, 0.35],
      [-0.32, 0.62, 0.25],
      [0.48, 0.35, -0.4],
      [-0.55, -0.25, 0.5],
      [0.22, 0.56, -0.18],
    ];
    for (const [bx, bz, brot] of bootPositions) {
      const printGroup = new THREE.Group();
      for (let r = -2; r <= 2; r++) {
        const rib = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.008, 0.022), bootTreadMat);
        rib.position.z = r * 0.034;
        printGroup.add(rib);
      }
      printGroup.position.set(bx, -0.022, bz);
      printGroup.rotation.y = brot;
      this.startGroup.add(printGroup);
    }

    // 3. Planted 3D Lunar Flag Assembly Directly in the Lunar Soil Behind Astronaut (Updates with Flag Selector!)
    const flagAssembly = new THREE.Group();
    const flagPoleMat = new THREE.MeshStandardMaterial({
      color: 0xe2e8f0,
      roughness: 0.25,
      metalness: 0.9,
    });
    const goldFixtureMat = new THREE.MeshStandardMaterial({
      color: 0xfbbf24,
      roughness: 0.3,
      metalness: 0.85,
    });

    // Vertical telescopic flagpole planted in lunar soil
    const verticalPole = new THREE.Mesh(
      new THREE.CylinderGeometry(0.018, 0.022, 2.25, 16),
      flagPoleMat
    );
    verticalPole.position.y = 1.125;
    verticalPole.castShadow = true;
    flagAssembly.add(verticalPole);

    // Base socket collar in lunar regolith
    const baseCollar = new THREE.Mesh(
      new THREE.CylinderGeometry(0.045, 0.055, 0.08, 16),
      goldFixtureMat
    );
    baseCollar.position.y = 0.04;
    flagAssembly.add(baseCollar);

    // Top finial & horizontal Apollo telescopic crossbar (keeps flag unfurled in vacuum)
    const topFinial = new THREE.Mesh(new THREE.SphereGeometry(0.032, 16, 12), goldFixtureMat);
    topFinial.position.y = 2.26;
    flagAssembly.add(topFinial);

    const crossbar = new THREE.Mesh(
      new THREE.CylinderGeometry(0.012, 0.012, 0.94, 12),
      flagPoleMat
    );
    crossbar.rotation.z = Math.PI / 2;
    crossbar.position.set(0.47, 2.23, 0);
    flagAssembly.add(crossbar);

    // Sculpted 3D Rippled Lunar Cloth Flag Mesh
    const clothGeo = new THREE.PlaneGeometry(0.92, 0.61, 24, 14);
    const cPos = clothGeo.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < cPos.count; i++) {
      const cx = cPos.getX(i);
      const cy = cPos.getY(i);
      // Pin left edge to pole (cx = -0.46), add authentic Apollo wire-stiffened crinkle ripples across span
      const pinFactor = THREE.MathUtils.smoothstep(cx, -0.46, -0.2);
      const waveZ =
        (Math.sin((cx + 0.46) * 10.5) * 0.022 + Math.cos(cy * 8.0 + cx * 6.0) * 0.012) *
        pinFactor;
      cPos.setZ(i, waveZ);
    }
    clothGeo.computeVertexNormals();

    this.lunarFlagClothMat = new THREE.MeshStandardMaterial({
      map: initialFlagTex,
      roughness: 0.55,
      metalness: 0.08,
      side: THREE.DoubleSide,
    });
    const clothMesh = new THREE.Mesh(clothGeo, this.lunarFlagClothMat);
    clothMesh.position.set(0.475, 1.91, 0);
    clothMesh.castShadow = true;
    flagAssembly.add(clothMesh);

    flagAssembly.position.set(-1.68, -0.025, -1.08);
    flagAssembly.rotation.y = 0.28;
    this.astronautTurntable.add(flagAssembly);

    // 4. Real 3D Scanned NASA Apollo 11 Astronaut Standing Directly on Lunar Regolith
    this.astronautRig = buildCommanderAstronautRig(
      this.currentCommanderConfig,
      this.spacecraftAssets,
      initialFlagTex
    );
    this.astronautRig.root.position.set(0.06, -0.025, 0.06);
    this.astronautTurntable.add(this.astronautRig.root);
    this.startGroup.add(this.astronautTurntable);

    // 5. Official NASA 3D Apollo 11 Lunar Module ("Eagle" .glb) Facing Camera with Front Ladder & Flag Panel
    const eagleLander = buildApolloLunarModuleBackdrop(
      this.spacecraftAssets,
      this.eaglePanelFlagTextures[this.currentCommanderConfig.flagId],
      (setter) => {
        this.setEaglePanelFlagTex = setter;
      }
    );
    eagleLander.position.set(1.58, -0.02, -2.55);
    eagleLander.rotation.y = -0.14;
    this.startGroup.add(eagleLander);

    // 6. Dedicated Studio & Lunar Sun Lighting for Visor, Flag & Eagle Lander Front Facade
    const visorKeyLight = new THREE.PointLight(0xfffbeb, 2.3, 18, 0.7);
    visorKeyLight.position.set(2.4, 2.8, 3.2);
    this.startGroup.add(visorKeyLight);

    const cyanRimLight = new THREE.PointLight(0x22d3ee, 1.6, 14, 0.8);
    cyanRimLight.position.set(-2.8, 2.4, -2.5);
    this.startGroup.add(cyanRimLight);

    const eagleFrontLight = new THREE.PointLight(0xffffff, 2.6, 18, 0.65);
    eagleFrontLight.position.set(1.6, 2.4, 0.4);
    this.startGroup.add(eagleFrontLight);

    const amberUnderLight = new THREE.PointLight(0xf59e0b, 1.0, 8, 1.0);
    amberUnderLight.position.set(0, 0.5, 1.8);
    this.startGroup.add(amberUnderLight);

    if (!this.isSoftwareGl) {
      const studioSoftbox = new THREE.RectAreaLight(0xe0f2fe, 4.2, 3.2, 4.0);
      studioSoftbox.position.set(-2.2, 2.9, 3.0);
      studioSoftbox.lookAt(0, 1.4, 0);
      this.startGroup.add(studioSoftbox);
    }
  }

  /**
   * Sculpt a jagged, cratered dark basalt/metallic asteroid or meteor BufferGeometry.
   * Combines multi-octave FBM, sharp fracture ridges, and explicit spherical impact crater cavities.
   */
  private sculptCrateredBasaltGeometry(
    baseRadius: number,
    detail: number,
    seed: number,
    craterCount: number
  ): THREE.BufferGeometry {
    const geo = new THREE.IcosahedronGeometry(baseRadius, detail);
    const pos = geo.attributes.position as THREE.BufferAttribute;

    // Deterministic pseudo-random generator for crater placement
    let s = seed | 0;
    const nextRand = () => {
      s = (s + 0x6d2b79f5) | 0;
      let t = Math.imul(s ^ (s >>> 15), 1 | s);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };

    const craters: { cx: number; cy: number; cz: number; rad: number; depth: number }[] = [];
    for (let c = 0; c < craterCount; c++) {
      const theta = nextRand() * Math.PI * 2;
      const phi = Math.acos(2 * nextRand() - 1);
      craters.push({
        cx: Math.sin(phi) * Math.cos(theta),
        cy: Math.cos(phi),
        cz: Math.sin(phi) * Math.sin(theta),
        rad: 0.28 + nextRand() * 0.42,
        depth: 0.16 + nextRand() * 0.22,
      });
    }

    for (let i = 0; i < pos.count; i++) {
      const vx = pos.getX(i);
      const vy = pos.getY(i);
      const vz = pos.getZ(i);
      const len = Math.sqrt(vx * vx + vy * vy + vz * vz) || 1;
      const nx = vx / len;
      const ny = vy / len;
      const nz = vz / len;

      // Coarse jagged lobes + sharp basalt ridges
      const coarse = fbm3(nx * 2.1, ny * 2.1, nz * 2.1, 4, seed);
      const sharp = Math.abs(fbm3(nx * 4.6, ny * 4.6, nz * 4.6, 3, seed + 37) - 0.5) * 2.0;
      let disp = 0.68 + coarse * 0.52 + (1.0 - sharp) * 0.24;

      // Carve deep impact crater bowls & raised sharp rims into the 3D vertices
      for (let c = 0; c < craters.length; c++) {
        const cr = craters[c];
        const dx = nx - cr.cx;
        const dy = ny - cr.cy;
        const dz = nz - cr.cz;
        const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
        const rNorm = dist / cr.rad;
        if (rNorm < 0.78) {
          const bowl = Math.cos((rNorm / 0.78) * (Math.PI * 0.5));
          disp -= bowl * cr.depth;
        } else if (rNorm < 1.16) {
          const rimT = 1.0 - Math.abs(rNorm - 0.95) / 0.21;
          disp += Math.max(0, rimT) * cr.depth * 0.42;
        }
      }

      // Asymmetric rocky meteor proportions
      pos.setXYZ(i, vx * disp * 1.32, vy * disp * 0.78, vz * disp * 0.96);
    }

    geo.computeVertexNormals();
    return geo;
  }

  private buildSolarSystemScene(): void {
    // 1. Blazing Photorealistic Sun (R_Sun = 109.3 R_Earth scientific photosphere + Corona Halo)
    this.sunGroup = new THREE.Group();
    const initialSunR = getScientificBodySceneRadius('sun', this.solarScaleMode);
    this.sunCore = new THREE.Mesh(
      new THREE.SphereGeometry(1.0, 64, 48),
      new THREE.MeshBasicMaterial({ map: this.sunPBR.map })
    );
    this.sunGroup.add(this.sunCore);

    const sunChromosphere = createAtmosphereMesh(1.08, 0xff7b29, 0.52, 2.4);
    this.sunGroup.add(sunChromosphere);

    const corona = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: this.glowTexture,
        color: 0xf97316,
        transparent: true,
        opacity: 0.48,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      })
    );
    corona.scale.set(3.8, 3.8, 1);
    this.sunGroup.add(corona);
    this.sunGroup.scale.setScalar(initialSunR);
    this.solarGroup.add(this.sunGroup);

    const createKeplerOrbitRing = (
      elements: KeplerElements,
      colorHex: number,
      opacity = 0.32
    ) => {
      const pts3D = sampleKeplerianOrbit3D(elements, 192, this.solarScaleMode);
      const pts = pts3D.map((p) => new THREE.Vector3(p.x, p.y, p.z));
      const geo = new THREE.BufferGeometry().setFromPoints(pts);
      const mat = new THREE.LineBasicMaterial({ color: colorHex, transparent: true, opacity });
      const loop = new THREE.LineLoop(geo, mat);
      this.solarGroup.add(loop);
      this.solarOrbitLoops.push({ elements, line: loop });
    };

    const addPlanet = (opts: {
      id: string;
      worldId?: WorldId;
      label: string;
      elements?: KeplerElements;
      orbitRadius: number;
      orbitSpeed: number;
      angle: number;
      pbr?: PBRTextureSet;
      color?: number;
      ringColor: number;
      atmosphereColor?: number;
      hasSaturnRings?: boolean;
      hasClouds?: boolean;
      parentMesh?: THREE.Object3D;
    }) => {
      const sciRadius = getScientificBodySceneRadius(opts.id, this.solarScaleMode);
      if (!opts.parentMesh && opts.elements) {
        createKeplerOrbitRing(opts.elements, opts.ringColor, opts.worldId ? 0.42 : 0.2);
      }

      const holder = new THREE.Group();
      const visualScaleGroup = new THREE.Group();
      visualScaleGroup.scale.setScalar(sciRadius);
      holder.add(visualScaleGroup);

      const spinGroup = new THREE.Group();
      if (opts.elements?.obliquityDeg) {
        spinGroup.rotation.z = THREE.MathUtils.degToRad(opts.elements.obliquityDeg);
      }
      visualScaleGroup.add(spinGroup);

      let geo: THREE.BufferGeometry;
      if (opts.id === 'asteroid') {
        geo = this.sculptCrateredBasaltGeometry(1.0, 4, 808, 18);
      } else {
        geo = new THREE.SphereGeometry(1.0, 56, 40);
      }

      const mat = new THREE.MeshStandardMaterial({
        color: opts.id === 'asteroid' ? 0x6b7280 : opts.pbr ? 0xffffff : opts.color ?? 0x94a3b8,
        map: opts.pbr?.map ?? null,
        normalMap: opts.pbr?.normalMap ?? null,
        normalScale:
          opts.id === 'asteroid' ? new THREE.Vector2(1.85, 1.85) : new THREE.Vector2(1.1, 1.1),
        roughnessMap: opts.pbr?.roughnessMap ?? null,
        roughness: opts.id === 'earth' ? 0.7 : opts.id === 'asteroid' ? 0.76 : 0.82,
        metalness: opts.id === 'asteroid' ? 0.58 : 0.06,
      });
      const planetMesh = new THREE.Mesh(geo, mat);
      planetMesh.castShadow = true;
      planetMesh.receiveShadow = true;
      spinGroup.add(planetMesh);

      if (opts.hasClouds && opts.pbr?.cloudsMap) {
        const cloudsMesh = new THREE.Mesh(
          new THREE.SphereGeometry(1.018, 48, 36),
          new THREE.MeshStandardMaterial({
            map: opts.pbr.cloudsMap,
            transparent: true,
            opacity: 0.88,
            roughness: 0.9,
            depthWrite: false,
          })
        );
        spinGroup.add(cloudsMesh);
        this.earthCloudsMesh = cloudsMesh;
      }

      if (opts.atmosphereColor) {
        visualScaleGroup.add(createAtmosphereMesh(1.055, opts.atmosphereColor, 0.4, 3.2));
      }

      if (opts.hasSaturnRings) {
        const ringGeo = new THREE.RingGeometry(1.38, 2.55, 96, 1);
        const rPos = ringGeo.attributes.position as THREE.BufferAttribute;
        const rUv = ringGeo.attributes.uv as THREE.BufferAttribute;
        const rInner = 1.38;
        const rOuter = 2.55;
        for (let i = 0; i < rPos.count; i++) {
          const rx = rPos.getX(i);
          const ry = rPos.getY(i);
          const dist = Math.sqrt(rx * rx + ry * ry);
          const u = (dist - rInner) / (rOuter - rInner);
          rUv.setXY(i, u, 0.5);
        }
        const rings = new THREE.Mesh(
          ringGeo,
          new THREE.MeshStandardMaterial({
            map: this.saturnRingTex,
            side: THREE.DoubleSide,
            transparent: true,
            roughness: 0.72,
            depthWrite: false,
          })
        );
        rings.rotation.x = Math.PI / 2 - 0.32;
        spinGroup.add(rings);
      }

      let glowSprite: THREE.Sprite | undefined;
      let ringHighlight: THREE.Mesh | undefined;
      let clickProxy: THREE.Mesh | undefined;
      if (opts.worldId) {
        glowSprite = new THREE.Sprite(
          new THREE.SpriteMaterial({
            map: this.glowTexture,
            color: 0x22d3ee,
            transparent: true,
            opacity: 0.0,
            blending: THREE.AdditiveBlending,
            depthWrite: false,
          })
        );
        glowSprite.scale.set(Math.max(1.8, sciRadius * 3.5), Math.max(1.8, sciRadius * 3.5), 1);
        holder.add(glowSprite);

        ringHighlight = new THREE.Mesh(
          new THREE.RingGeometry(1.5, 1.68, 48),
          new THREE.MeshBasicMaterial({
            color: 0x22d3ee,
            side: THREE.DoubleSide,
            transparent: true,
            opacity: 0.0,
          })
        );
        ringHighlight.scale.setScalar(Math.max(0.55, sciRadius));
        ringHighlight.rotation.x = Math.PI / 2 - 0.25;
        holder.add(ringHighlight);

        clickProxy = new THREE.Mesh(
          new THREE.SphereGeometry(1.0, 12, 12),
          new THREE.MeshBasicMaterial({ visible: false })
        );
        clickProxy.scale.setScalar(Math.max(1.5, sciRadius * 1.9));
        clickProxy.userData.worldId = opts.worldId;
        holder.add(clickProxy);
        this.clickableProxies.push(clickProxy);
        this.worldMeshes.set(opts.worldId, holder);
      }

      if (opts.parentMesh) opts.parentMesh.add(holder);
      else this.solarGroup.add(holder);

      this.planetEntries.push({
        id: opts.id,
        worldId: opts.worldId,
        label: opts.label,
        mesh: holder,
        visualScaleGroup,
        spinGroup,
        glowSprite,
        ringHighlight,
        clickProxy,
        elements: opts.elements,
        orbitRadius: opts.orbitRadius,
        orbitSpeed: opts.orbitSpeed,
        angle: opts.angle,
        parentMesh: opts.parentMesh,
      });

      return holder;
    };

    addPlanet({
      id: 'mercury',
      label: 'Mercury (0.38 R⊕)',
      elements: SOLAR_SYSTEM_EPHEMERIS.mercury,
      orbitRadius: auToSceneRadius(SOLAR_SYSTEM_EPHEMERIS.mercury.smaAU, this.solarScaleMode),
      orbitSpeed: 0.38,
      angle: 0.5,
      pbr: this.mercuryPBR,
      ringColor: 0x64748b,
    });
    addPlanet({
      id: 'venus',
      label: 'Venus (0.95 R⊕)',
      elements: SOLAR_SYSTEM_EPHEMERIS.venus,
      orbitRadius: auToSceneRadius(SOLAR_SYSTEM_EPHEMERIS.venus.smaAU, this.solarScaleMode),
      orbitSpeed: 0.28,
      angle: 2.4,
      color: 0xe5b96b,
      atmosphereColor: 0xfde68a,
      ringColor: 0xa16207,
    });

    const earthObj = addPlanet({
      id: 'earth',
      worldId: 'earth',
      label: 'Earth Orbit (1.00 R⊕)',
      elements: SOLAR_SYSTEM_EPHEMERIS.earth,
      orbitRadius: WORLDS.earth.orbitRadius,
      orbitSpeed: WORLDS.earth.orbitSpeed,
      angle: 4.5,
      pbr: this.earthPBR,
      atmosphereColor: 0x38bdf8,
      hasClouds: true,
      ringColor: 0x38bdf8,
    });

    addPlanet({
      id: 'moon',
      worldId: 'moon',
      label: 'The Moon (0.27 R⊕)',
      elements: {
        id: 'moon',
        name: 'Moon',
        smaAU: 0.00256955,
        eccentricity: MOON_ORBIT_ELEMENTS.eccentricity,
        inclinationDeg: MOON_ORBIT_ELEMENTS.inclinationDeg,
        raanDeg: 125.08,
        argPeriapsisDeg: 318.15,
        meanAnomalyEpochDeg: 135.27,
        periodDays: MOON_ORBIT_ELEMENTS.periodDays,
        muKm3s2: MOON_ORBIT_ELEMENTS.muKm3s2,
        meanRadiusKm: MOON_ORBIT_ELEMENTS.meanRadiusKm,
        earthRadiusRatio: MOON_ORBIT_ELEMENTS.earthRadiusRatio,
        surfaceGravityMs2: MOON_ORBIT_ELEMENTS.surfaceGravityMs2,
        rotationPeriodHours: 655.7,
        obliquityDeg: 6.68,
      },
      orbitRadius: 2.35,
      orbitSpeed: 0.72,
      angle: 0.8,
      pbr: this.moonPBR,
      ringColor: 0x94a3b8,
      parentMesh: earthObj,
    });

    const iss = buildSatellite('iss');
    earthObj.add(iss);
    this.planetEntries.push({
      id: 'iss',
      label: 'ISS (408 km)',
      mesh: iss,
      orbitRadius: 1.55,
      orbitSpeed: 1.2,
      angle: 1.9,
      parentMesh: earthObj,
    });

    const jwst = buildSatellite('jwst');
    earthObj.add(jwst);
    this.planetEntries.push({
      id: 'jwst',
      label: 'JWST (L2 · 1.5M km)',
      mesh: jwst,
      orbitRadius: 3.15,
      orbitSpeed: 0.35,
      angle: 4.7,
      parentMesh: earthObj,
    });

    addPlanet({
      id: 'mars',
      worldId: 'mars',
      label: 'Mars (0.53 R⊕)',
      elements: SOLAR_SYSTEM_EPHEMERIS.mars,
      orbitRadius: WORLDS.mars.orbitRadius,
      orbitSpeed: WORLDS.mars.orbitSpeed,
      angle: 3.1,
      pbr: this.marsPBR,
      atmosphereColor: 0xfb923c,
      ringColor: 0xc2410c,
    });

    addPlanet({
      id: 'asteroid',
      worldId: 'asteroid',
      label: '16 Psyche (2.92 AU)',
      elements: SOLAR_SYSTEM_EPHEMERIS.asteroid,
      orbitRadius: WORLDS.asteroid.orbitRadius,
      orbitSpeed: WORLDS.asteroid.orbitSpeed,
      angle: 1.9,
      pbr: this.asteroidPBR,
      ringColor: 0xf43f5e,
    });

    // Main Asteroid Belt between Mars (2.1 AU) and Jupiter (3.3 AU)
    const beltCount = 620;
    const rockGeo = this.sculptCrateredBasaltGeometry(0.18, 2, 419, 12);
    const rockMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      map: this.asteroidPBR.map,
      normalMap: this.asteroidPBR.normalMap,
      normalScale: new THREE.Vector2(1.75, 1.75),
      roughnessMap: this.asteroidPBR.roughnessMap,
      roughness: 0.78,
      metalness: 0.52,
    });
    this.asteroidBelt = new THREE.InstancedMesh(rockGeo, rockMat, beltCount);
    this.asteroidBelt.frustumCulled = false;

    const basaltPalette = [0x27272a, 0x3f3f46, 0x52525b, 0x71717a, 0x94a3b8];
    for (let i = 0; i < beltCount; i++) {
      const radiusAU = 2.15 + Math.random() * 1.15;
      const angle = Math.random() * Math.PI * 2;
      const y = (Math.random() - 0.5) * 1.15;
      const speed = 0.032 + Math.random() * 0.04;
      const scale = 0.45 + Math.random() * 1.35;
      this.asteroidBeltData.push({ radiusAU, angle, y, speed, scale });
      _col.setHex(basaltPalette[i % basaltPalette.length]);
      this.asteroidBelt.setColorAt(i, _col);
    }
    if (this.asteroidBelt.instanceColor) this.asteroidBelt.instanceColor.needsUpdate = true;
    this.solarGroup.add(this.asteroidBelt);

    addPlanet({
      id: 'jupiter',
      worldId: 'jupiter',
      label: 'Jupiter / Europa (10.97 R⊕)',
      elements: SOLAR_SYSTEM_EPHEMERIS.jupiter,
      orbitRadius: WORLDS.jupiter.orbitRadius,
      orbitSpeed: WORLDS.jupiter.orbitSpeed,
      angle: 0.6,
      pbr: this.jupiterPBR,
      atmosphereColor: 0xfbbf24,
      ringColor: 0xf59e0b,
    });

    addPlanet({
      id: 'saturn',
      label: 'Saturn (9.14 R⊕)',
      elements: SOLAR_SYSTEM_EPHEMERIS.saturn,
      orbitRadius: auToSceneRadius(SOLAR_SYSTEM_EPHEMERIS.saturn.smaAU, this.solarScaleMode),
      orbitSpeed: 0.055,
      angle: 0.35,
      pbr: this.saturnPBR,
      atmosphereColor: 0xfde68a,
      hasSaturnRings: true,
      ringColor: 0x94a3b8,
    });

    addPlanet({
      id: 'uranus',
      label: 'Uranus (3.98 R⊕)',
      elements: SOLAR_SYSTEM_EPHEMERIS.uranus,
      orbitRadius: auToSceneRadius(SOLAR_SYSTEM_EPHEMERIS.uranus.smaAU, this.solarScaleMode),
      orbitSpeed: 0.042,
      angle: 0.16,
      color: 0x7dd3fc,
      atmosphereColor: 0x67e8f9,
      ringColor: 0x0e7490,
    });

    addPlanet({
      id: 'neptune',
      label: 'Neptune (3.86 R⊕)',
      elements: SOLAR_SYSTEM_EPHEMERIS.neptune,
      orbitRadius: auToSceneRadius(SOLAR_SYSTEM_EPHEMERIS.neptune.smaAU, this.solarScaleMode),
      orbitSpeed: 0.036,
      angle: 0.92,
      color: 0x2563eb,
      atmosphereColor: 0x3b82f6,
      ringColor: 0x1d4ed8,
    });

    addPlanet({
      id: 'colony',
      worldId: 'colony',
      label: 'Proxima b (1.12 R⊕)',
      elements: SOLAR_SYSTEM_EPHEMERIS.colony,
      orbitRadius: WORLDS.colony.orbitRadius,
      orbitSpeed: WORLDS.colony.orbitSpeed,
      angle: 5.55,
      pbr: this.proximaPBR,
      atmosphereColor: 0xf97316,
      ringColor: 0x14b8a6,
    });
  }

  public setSolarScaleMode(mode: SolarScaleMode): void {
    this.solarScaleMode = mode;
    const sunR = getScientificBodySceneRadius('sun', mode);
    if (this.sunGroup) {
      this.sunGroup.scale.setScalar(sunR);
    }

    // Recompute all Keplerian 3D orbit loops for the new scale mode
    for (const item of this.solarOrbitLoops) {
      const pts3D = sampleKeplerianOrbit3D(item.elements, 192, mode);
      const posAttr = item.line.geometry.attributes.position as THREE.BufferAttribute;
      for (let i = 0; i < pts3D.length && i < posAttr.count; i++) {
        posAttr.setXYZ(i, pts3D[i].x, pts3D[i].y, pts3D[i].z);
      }
      posAttr.needsUpdate = true;
    }

    // Update each planet's scientific radius & selection reticle / click proxy
    for (const entry of this.planetEntries) {
      if (entry.visualScaleGroup) {
        const sciR = getScientificBodySceneRadius(entry.id, mode);
        entry.visualScaleGroup.scale.setScalar(sciR);
        if (entry.glowSprite) {
          const g = Math.max(1.8, sciR * 3.5);
          entry.glowSprite.scale.set(g, g, 1);
        }
        if (entry.ringHighlight) {
          entry.ringHighlight.scale.setScalar(Math.max(0.55, sciR));
        }
        if (entry.clickProxy) {
          entry.clickProxy.scale.setScalar(Math.max(1.6, sciR * 1.9));
        }
      }
    }

    this.focusWorld(this.targetWorldId);
    this.pushSolarTelemetry(true);
  }

  public setSolarTimeSpeed(daysPerSec: number): void {
    this.solarTimeSpeedDaysPerSec = daysPerSec;
    this.pushSolarTelemetry(true);
  }

  private pushSolarTelemetry(force = false): void {
    if (!this.callbacks.onSolarTelemetryUpdate) return;
    const now = performance.now();
    if (!force && now - this.lastSolarTelemetryPush < 90) return;
    this.lastSolarTelemetryPush = now;

    // J2000 Epoch base date (2026-01-01 + simulated days)
    const epochBaseMs = Date.UTC(2026, 0, 1);
    const simDate = new Date(epochBaseMs + this.solarSimDays * 86400 * 1000);
    const epochDateStr = simDate.toISOString().slice(0, 10);

    const selEntry =
      this.planetEntries.find((e) => e.worldId === this.targetWorldId) ??
      this.planetEntries.find((e) => e.id === 'earth');
    const world = WORLDS[this.targetWorldId];

    this.callbacks.onSolarTelemetryUpdate({
      epochDateStr,
      elapsedDays: Number(this.solarSimDays.toFixed(1)),
      scaleMode: this.solarScaleMode,
      timeSpeedDaysPerSec: this.solarTimeSpeedDaysPerSec,
      selectedRadiusAU: selEntry?.instantRadiusAU ?? world.smaAU,
      selectedRadiusKm: selEntry?.instantRadiusKm ?? Math.round(world.smaAU * 149597870.7),
      selectedVelocityKms: selEntry?.instantVelocityKms ?? world.orbitMetrics.orbitalVelocityKms,
      selectedTrueAnomalyDeg: selEntry?.trueAnomalyDeg ?? 0,
      selectedEarthRadiusRatio: world.earthRadiusRatio,
      sunEarthRadiusRatio: SUN_EARTH_RADIUS_RATIO,
    });
  }


  private createEarthGlobeMaterial(
    sunDirRef: THREE.Vector3 = new THREE.Vector3(18, 30, 20).normalize(),
    roughness = 0.56
  ): THREE.MeshStandardMaterial {
    const mat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      map: this.earthPBR.map,
      normalMap: this.earthPBR.normalMap ?? null,
      normalScale: new THREE.Vector2(1.35, 1.35),
      roughnessMap: this.earthPBR.roughnessMap ?? null,
      roughness,
      metalness: 0.08,
      emissive: new THREE.Color(0xffca6a),
      emissiveMap: this.earthPBR.emissiveMap ?? null,
      emissiveIntensity: 1.55,
    });
    mat.customProgramCacheKey = () => 'pateldev-earth-nightlights-v1';
    mat.onBeforeCompile = (shader) => {
      shader.uniforms.uEarthSunDir = { value: sunDirRef };
      shader.vertexShader = shader.vertexShader
        .replace('#include <common>', '#include <common>\nvarying vec3 vEarthWorldNormal;')
        .replace(
          '#include <beginnormal_vertex>',
          '#include <beginnormal_vertex>\nvEarthWorldNormal = normalize(mat3(modelMatrix) * objectNormal);'
        );
      shader.fragmentShader = shader.fragmentShader
        .replace('#include <common>', '#include <common>\nuniform vec3 uEarthSunDir;\nvarying vec3 vEarthWorldNormal;')
        .replace(
          '#include <emissivemap_fragment>',
          '#include <emissivemap_fragment>\nfloat earthDayMask = smoothstep(-0.18, 0.14, dot(normalize(vEarthWorldNormal), normalize(uEarthSunDir)));\ntotalEmissiveRadiance *= (1.0 - earthDayMask);'
        );
    };
    return mat;
  }



  private buildHangarScene(): void {
    // Reflective Cleanroom Epoxy Floor (PBR roughnessMap + cyan calibration grid)
    const floor = new THREE.Mesh(
      new THREE.PlaneGeometry(46, 46),
      new THREE.MeshStandardMaterial({
        map: this.hangarFloorPBR.map,
        roughnessMap: this.hangarFloorPBR.roughnessMap,
        roughness: 0.34,
        metalness: 0.42,
      })
    );
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    this.hangarGroup.add(floor);

    // High-Bay Cleanroom Architecture: Ribbed Acoustic Bulkhead Wall + Overhead Gantry Trusses
    const wallMat = new THREE.MeshStandardMaterial({
      color: 0x08101f,
      roughness: 0.55,
      metalness: 0.62,
    });
    const steelStrutMat = new THREE.MeshStandardMaterial({
      color: 0x1e293b,
      roughness: 0.35,
      metalness: 0.86,
    });

    const backWall = new THREE.Mesh(new THREE.BoxGeometry(30, 13, 0.5), wallMat);
    backWall.position.set(0, 6.5, -10.6);
    backWall.receiveShadow = true;
    this.hangarGroup.add(backWall);

    // Beveled Titanium Screen Bezel + High-DPI Telemetry Screen
    const screenFrame = new THREE.Mesh(new THREE.BoxGeometry(14.1, 6.0, 0.25), steelStrutMat);
    screenFrame.position.set(0, 5.75, -10.3);
    this.hangarGroup.add(screenFrame);

    const screenMesh = new THREE.Mesh(
      new THREE.PlaneGeometry(13.5, 5.5),
      new THREE.MeshBasicMaterial({ map: this.wallDisplay.texture })
    );
    screenMesh.position.set(0, 5.75, -10.15);
    this.hangarGroup.add(screenMesh);

    // Structural High-Bay Columns + Overhead Crane Truss Beams
    [-10.2, -7.8, 7.8, 10.2].forEach((x) => {
      const pillar = new THREE.Mesh(new THREE.BoxGeometry(0.75, 13, 0.9), steelStrutMat);
      pillar.position.set(x, 6.5, -9.9);
      pillar.castShadow = true;
      this.hangarGroup.add(pillar);
    });

    const overheadBeam = new THREE.Mesh(new THREE.BoxGeometry(24, 0.65, 1.1), steelStrutMat);
    overheadBeam.position.set(0, 10.6, -2.5);
    this.hangarGroup.add(overheadBeam);

    // Studio Cleanroom Overhead RectAreaLight Softboxes (GPU only, calibrated)
    if (!this.isSoftwareGl) {
      const softboxMain = new THREE.RectAreaLight(0xe0f2fe, 3.2, 11, 3.8);
      softboxMain.position.set(0, 9.6, 2.5);
      softboxMain.lookAt(0, 2.0, 0);
      this.hangarGroup.add(softboxMain);

      const softboxRim = new THREE.RectAreaLight(0xfef3c7, 1.9, 8, 3.0);
      softboxRim.position.set(5.5, 6.0, -4.5);
      softboxRim.lookAt(0, 2.2, 0);
      this.hangarGroup.add(softboxRim);
    }

    // Precision Rotary Assembly Turntable with Amber Illuminated Perimeter Ring
    const turntableBase = new THREE.Mesh(
      new THREE.CylinderGeometry(3.58, 3.92, 0.36, 64),
      steelStrutMat
    );
    turntableBase.position.y = 0.18;
    turntableBase.receiveShadow = true;
    this.hangarTurntable.add(turntableBase);

    const innerDeck = new THREE.Mesh(
      new THREE.CylinderGeometry(3.25, 3.25, 0.38, 48),
      new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.32, metalness: 0.78 })
    );
    innerDeck.position.y = 0.19;
    innerDeck.receiveShadow = true;
    this.hangarTurntable.add(innerDeck);

    const glowRing = new THREE.Mesh(
      new THREE.RingGeometry(3.52, 3.82, 72),
      new THREE.MeshBasicMaterial({ color: 0xd97706, side: THREE.DoubleSide })
    );
    glowRing.rotation.x = -Math.PI / 2;
    glowRing.position.y = 0.375;
    this.hangarTurntable.add(glowRing);

    // 4-Post Open Titanium Service Cradle elevating the rocket above the turntable so engine bells are fully visible
    const cradleMat = new THREE.MeshStandardMaterial({
      color: 0x334155,
      roughness: 0.42,
      metalness: 0.82,
    });
    const cradleAccentMat = new THREE.MeshStandardMaterial({
      color: 0xf59e0b,
      roughness: 0.45,
      metalness: 0.35,
    });
    const cradleRing = new THREE.Mesh(new THREE.TorusGeometry(1.52, 0.06, 12, 48), cradleMat);
    cradleRing.rotation.x = Math.PI / 2;
    cradleRing.position.y = 1.24;
    this.hangarTurntable.add(cradleRing);

    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.12, 0.92, 16), cradleMat);
      post.position.set(Math.cos(a) * 1.95, 0.82, Math.sin(a) * 1.95);
      post.rotation.z = Math.cos(a) * 0.24;
      post.rotation.x = -Math.sin(a) * 0.24;
      post.castShadow = true;
      this.hangarTurntable.add(post);

      const clampPad = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.14, 0.24), cradleAccentMat);
      clampPad.position.set(Math.cos(a) * 1.54, 1.24, Math.sin(a) * 1.54);
      clampPad.rotation.y = -a;
      this.hangarTurntable.add(clampPad);
    }

    // Upward inspection spotlight underneath the engine bells
    const nozzleInspectLight = new THREE.PointLight(0x38bdf8, 4.5, 6.5, 1.5);
    nozzleInspectLight.position.set(0, 0.48, 0.9);
    this.hangarTurntable.add(nozzleInspectLight);

    this.hangarGroup.add(this.hangarTurntable);

    // Orange & White Cleanroom Robotic Arm
    this.leftArm = buildRoboticArm(0xf97316);
    this.leftArm.root.position.set(-4.2, 0, 0.45);
    this.leftArm.root.rotation.y = Math.PI / 2;
    this.hangarGroup.add(this.leftArm.root);

    this.rebuildHangarSpacecraft();
  }

  public rebuildHangarSpacecraft(animateArm = false): void {
    if (this.hangarCraftRig) {
      this.hangarTurntable.remove(this.hangarCraftRig.root);
    }
    this.hangarCraftRig = buildCarrierRocketSpaceship(this.currentConfig, this.spacecraftAssets, {
      showBoosters: true,
      openInspectBay: true,
    });
    this.hangarCraftRig.root.scale.setScalar(0.68);
    this.hangarCraftRig.root.position.y = 1.15;
    this.hangarTurntable.add(this.hangarCraftRig.root);

    if (animateArm) {
      this.armReachTimer = 0.85;
      this.hangarSnapTimer = 0.32;
    }

    const world = WORLDS[this.targetWorldId];
    const engine =
      ENGINE_OPTIONS.find((e) => e.id === this.currentConfig.engineId) || ENGINE_OPTIONS[3];
    const fuel =
      FUEL_OPTIONS.find((f) => f.id === this.currentConfig.fuelId) || FUEL_OPTIONS[2];
    const power =
      POWER_SOURCES.find((p) => p.id === this.currentConfig.powerSource) || POWER_SOURCES[0];

    this.wallDisplay.update({
      craftName: engine.name,
      massKg: this.currentStats.totalMassKg,
      massLimitKg: this.currentStats.massLimitKg,
      costM: this.currentStats.totalCostM,
      budgetLimitM: this.currentStats.budgetLimitM,
      netPowerW: this.currentStats.netPowerW,
      fuelKg: this.currentStats.fuelMassKg,
      requiredFuelKg: this.currentStats.requiredFuelKg,
      thrustKn: this.currentStats.thrustKn,
      requiredThrustKn: this.currentStats.requiredThrustKn,
      fuelLabel: fuel.name,
      powerLabel: power.name,
      worldName: world.name,
      twr: this.currentStats.launchTwr,
    });
  }

  private buildLaunchPadScene(): void {
    // Realistic Late-Afternoon Earth Coastal Sky Dome with Diagonal Cirrus Streaks fading cleanly to Deep Space
    this.padSkyMat = new THREE.ShaderMaterial({
      uniforms: {
        uSpaceMix: { value: 0.0 },
        uTime: { value: 0.0 },
      },
      vertexShader: `
        varying vec3 vLocalDir;
        void main() {
          vLocalDir = normalize(position);
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform float uSpaceMix;
        uniform float uTime;
        varying vec3 vLocalDir;

        float hash21(vec2 p) {
          p = fract(p * vec2(123.34, 456.21));
          p += dot(p, p + 45.32);
          return fract(p.x * p.y);
        }

        float noise2(vec2 p) {
          vec2 i = floor(p);
          vec2 f = fract(p);
          vec2 u = f * f * (3.0 - 2.0 * f);
          return mix(
            mix(hash21(i + vec2(0.0, 0.0)), hash21(i + vec2(1.0, 0.0)), u.x),
            mix(hash21(i + vec2(0.0, 1.0)), hash21(i + vec2(1.0, 1.0)), u.x),
            u.y
          );
        }

        void main() {
          float h = clamp(vLocalDir.y, -0.15, 1.0);
          // Warm golden-hour coastal mist near horizon transitioning to cerulean azure zenith
          vec3 horizonBase = vec3(0.66, 0.71, 0.74);
          float sunAzimuth = clamp(0.5 - vLocalDir.x * 0.45 - vLocalDir.z * 0.35, 0.0, 1.0);
          vec3 horizonWarm = mix(horizonBase, vec3(0.84, 0.71, 0.56), pow(sunAzimuth, 1.8) * 0.65);
          vec3 horizon = mix(horizonWarm, vec3(0.006, 0.01, 0.022), uSpaceMix);
          vec3 mid = mix(vec3(0.24, 0.45, 0.69), vec3(0.004, 0.008, 0.018), uSpaceMix);
          vec3 zenith = mix(vec3(0.09, 0.24, 0.48), vec3(0.003, 0.006, 0.014), uSpaceMix);

          vec3 col = h < 0.24
            ? mix(horizon, mid, smoothstep(-0.04, 0.24, h))
            : mix(mid, zenith, smoothstep(0.24, 0.92, h));

          // Procedural wispy diagonal cirrus streaks across coastal sky
          vec2 skyUv = vec2(
            vLocalDir.x * 3.8 + vLocalDir.y * 5.2 + uTime * 0.003,
            vLocalDir.z * 3.8 - vLocalDir.y * 2.4
          );
          float w1 = noise2(skyUv * 2.4);
          float w2 = noise2(skyUv * 5.8 + vec2(w1 * 1.4, -w1 * 0.8));
          float streak = smoothstep(0.52, 0.88, w1 * 0.58 + w2 * 0.42);
          float bandMask = smoothstep(0.02, 0.14, h) * (1.0 - smoothstep(0.32, 0.82, h));
          float skyVis = 1.0 - smoothstep(0.05, 0.55, uSpaceMix);
          vec3 cirrusCol = mix(vec3(0.88, 0.90, 0.94), vec3(0.96, 0.89, 0.82), pow(sunAzimuth, 1.4) * 0.45);
          col = mix(col, cirrusCol, streak * bandMask * skyVis * 0.42);

          gl_FragColor = vec4(col, 1.0);
        }
      `,
      side: THREE.BackSide,
      transparent: false,
      depthTest: true,
      depthWrite: false,
    });
    this.padSky = new THREE.Mesh(new THREE.SphereGeometry(380000, 32, 24), this.padSkyMat);
    this.launchGroup.add(this.padSky);

    this.launchFog = new THREE.FogExp2(0x9fb4c7, 0.0014);

    // True Scientific 0.0055% Scale Earth Globe (high segment density so orbital decay graze kisses visual globe!)
    this.launchEarthHorizon = new THREE.Group();
    const orbitEarth = new THREE.Mesh(
      new THREE.SphereGeometry(0.99999, 192, 128),
      this.createEarthGlobeMaterial(new THREE.Vector3(18, 30, 20).normalize(), 0.56)
    );
    // Align Florida & Eastern North America / Atlantic Ocean directly underneath coastal pad & downrange corridor
    orbitEarth.rotation.set(-1.073, -0.165, 0);
    this.launchEarthHorizon.add(orbitEarth);

    if (this.earthPBR.cloudsMap) {
      const orbitClouds = new THREE.Mesh(
        new THREE.SphereGeometry(1.0022, 128, 84),
        new THREE.MeshStandardMaterial({
          map: this.earthPBR.cloudsMap,
          alphaMap: this.earthPBR.cloudsMap,
          transparent: true,
          opacity: 0.76,
          depthWrite: false,
          polygonOffset: true,
          polygonOffsetFactor: -1,
        })
      );
      orbitClouds.rotation.set(-1.073, -0.165, 0);
      this.launchEarthHorizon.add(orbitClouds);
    }
    this.launchEarthHorizon.add(createAtmosphereMesh(1.018, 0x38bdf8, 0.55, 3.0));

    // High-Precision Curved Coastal Launch Cap (blends into Earth globe cleanly)
    const CAP_THETA = 0.048;
    const capGeo = new THREE.SphereGeometry(1.0, 96, 48, 0, Math.PI * 2, 0, CAP_THETA);
    const capPos = capGeo.attributes.position as THREE.BufferAttribute;
    const capUv = capGeo.attributes.uv as THREE.BufferAttribute;
    const capSpan = Math.sin(CAP_THETA);
    for (let i = 0; i < capPos.count; i++) {
      const vx = capPos.getX(i);
      const vz = capPos.getZ(i);
      capUv.setXY(i, (vx / capSpan) * 0.5 + 0.5, (vz / capSpan) * 0.5 + 0.5);
    }
    capUv.needsUpdate = true;

    const coastalCap = new THREE.Mesh(
      capGeo,
      new THREE.MeshStandardMaterial({
        map: this.earthLaunchSurfacePBR.map,
        normalMap: this.earthLaunchSurfacePBR.normalMap,
        roughnessMap: this.earthLaunchSurfacePBR.roughnessMap,
        roughness: 0.85,
        polygonOffset: true,
        polygonOffsetFactor: -2,
      })
    );
    coastalCap.receiveShadow = true;
    this.launchEarthHorizon.add(coastalCap);

    this.launchEarthHorizon.position.set(0, -this.launchEarthRadius, 0);
    this.launchEarthHorizon.scale.setScalar(this.launchEarthRadius);
    this.launchGroup.add(this.launchEarthHorizon);

    // Calm Foreground Coastal Lagoon / Boca Chica Tidal Flats Reflection
    const lagoonWater = new THREE.Mesh(
      new THREE.PlaneGeometry(360, 140),
      new THREE.MeshStandardMaterial({
        color: 0x16384c,
        roughness: 0.09,
        metalness: 0.68,
      })
    );
    lagoonWater.rotation.x = -Math.PI / 2;
    lagoonWater.position.set(0, -0.08, 84);
    lagoonWater.receiveShadow = true;
    this.launchGroup.add(lagoonWater);

    // Golden-Hour Sun / Rocket Flame Reflection Column Shimmering Across the Lagoon Water
    const reflGeo = new THREE.PlaneGeometry(3.4, 28);
    const reflMat = new THREE.MeshBasicMaterial({
      color: 0xfbbf24,
      transparent: true,
      opacity: 0.36,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    this.launchLagoonReflection = new THREE.Mesh(reflGeo, reflMat);
    this.launchLagoonReflection.rotation.x = -Math.PI / 2;
    this.launchLagoonReflection.position.set(1.2, -0.055, 25);
    this.launchGroup.add(this.launchLagoonReflection);

    // Gulf of Mexico Coastal Shelf
    const atlanticWater = new THREE.Mesh(
      new THREE.PlaneGeometry(320, 420),
      new THREE.MeshStandardMaterial({
        color: 0x0c5f8a,
        roughness: 0.16,
        metalness: 0.35,
        transparent: true,
        opacity: 0.9,
      })
    );
    atlanticWater.rotation.x = -Math.PI / 2;
    atlanticWater.position.set(215, -0.02, 0);
    atlanticWater.receiveShadow = true;
    this.launchGroup.add(atlanticWater);

    // Overhead Volumetric Cumulus Clouds Floating Through Launch Ascent Corridor
    for (let i = 0; i < 18; i++) {
      const cloudMat = new THREE.SpriteMaterial({
        map: this.smokeTexture,
        color: 0xf8fafc,
        transparent: true,
        opacity: 0.48,
        depthWrite: false,
      });
      const sprite = new THREE.Sprite(cloudMat);
      const bx = (Math.random() - 0.5) * 110;
      const by = 28 + Math.random() * 44;
      const bz = -40 + Math.random() * 65;
      const cScale = 12 + Math.random() * 16;
      sprite.position.set(bx, by, bz);
      sprite.scale.set(cScale * 1.75, cScale * 0.85, 1);
      this.launchGroup.add(sprite);
      this.launchCloudSprites.push({
        sprite,
        baseX: bx,
        baseY: by,
        baseZ: bz,
        speed: 0.45 + Math.random() * 0.6,
      });
    }

    // "South Texas Launch Site with SN15" 3D GLB Launch Complex surrounding the spacecraft at (0, 0, 0)
    this.launchTower = buildShuttleLaunchTower();
    this.launchTower.root.position.set(0, 0, 0);
    this.launchGroup.add(this.launchTower.root);

    // Visible Target Planet ahead in space for forward deployment sequence
    this.launchTargetPlanet = new THREE.Mesh(
      new THREE.SphereGeometry(7.2, 48, 36),
      new THREE.MeshStandardMaterial({
        map: this.moonPBR.map,
        normalMap: this.moonPBR.normalMap ?? null,
        roughness: 0.78,
      })
    );
    this.launchTargetPlanet.position.set(0, 74, 95);
    this.launchTargetPlanet.visible = false;
    this.launchGroup.add(this.launchTargetPlanet);

    // Subtle deep-space velocity star streaks during forward planetary cruise
    const streakCount = 260;
    const streakPositions = new Float32Array(streakCount * 3);
    for (let i = 0; i < streakCount; i++) {
      streakPositions[i * 3] = (Math.random() - 0.5) * 44;
      streakPositions[i * 3 + 1] = 28 + Math.random() * 75;
      streakPositions[i * 3 + 2] = -25 + Math.random() * 120;
    }
    const streakGeo = new THREE.BufferGeometry();
    streakGeo.setAttribute('position', new THREE.BufferAttribute(streakPositions, 3));
    this.launchStarStreaks = new THREE.Points(
      streakGeo,
      new THREE.PointsMaterial({ color: 0xe2e8f0, size: 0.22, transparent: true, opacity: 0.85 })
    );
    this.launchStarStreaks.visible = false;
    this.launchGroup.add(this.launchStarStreaks);

    this.shuttleRig = buildCarrierRocketSpaceship(this.currentConfig, this.spacecraftAssets, {
      showBoosters: true,
      openInspectBay: false,
    });
    this.shuttleRig.root.scale.setScalar(0.95);
    this.shuttleRig.root.position.set(0, 0.85, 0);
    this.launchGroup.add(this.shuttleRig.root);

    // Calibrated Engine Flame PointLight
    this.launchEngineLight = new THREE.PointLight(0xff9a3c, 0, 34, 1.5);
    this.launchEngineLight.position.set(0, 0.5, 0.4);
    this.launchGroup.add(this.launchEngineLight);

    // Failed Launch Trajectory Warning Arc
    const failArcPts: THREE.Vector3[] = [];
    for (let i = 0; i <= 60; i++) failArcPts.push(new THREE.Vector3());
    this.launchFailedTrail = new THREE.Line(
      new THREE.BufferGeometry().setFromPoints(failArcPts),
      new THREE.LineDashedMaterial({ color: 0xf43f5e, dashSize: 0.9, gapSize: 0.5 })
    );
    this.launchFailedTrail.visible = false;
    this.launchGroup.add(this.launchFailedTrail);

    // Dashed Trajectory Guide Connecting Separated Small Spaceship Ahead Toward Target Planet (Sketch 5)
    const sepDashPts: THREE.Vector3[] = [];
    for (let i = 0; i <= 24; i++) sepDashPts.push(new THREE.Vector3());
    this.launchSepDashLine = new THREE.Line(
      new THREE.BufferGeometry().setFromPoints(sepDashPts),
      new THREE.LineDashedMaterial({
        color: 0x38bdf8,
        dashSize: 0.95,
        gapSize: 0.65,
        transparent: true,
        opacity: 0,
      })
    );
    this.launchSepDashLine.visible = false;
    this.launchGroup.add(this.launchSepDashLine);

    // 3D Impact Explosion & Shattering Debris System (for underpowered engine planetary crash!)
    this.launchExplosionGroup = new THREE.Group();
    this.launchExplosionGroup.visible = false;

    this.launchFireball = new THREE.Mesh(
      new THREE.SphereGeometry(1.0, 28, 22),
      new THREE.MeshBasicMaterial({
        color: 0xf97316,
        transparent: true,
        opacity: 0.92,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      })
    );
    this.launchExplosionGroup.add(this.launchFireball);

    const innerFlash = new THREE.Mesh(
      new THREE.SphereGeometry(0.55, 20, 16),
      new THREE.MeshBasicMaterial({ color: 0xfef08a, transparent: true, opacity: 0.95 })
    );
    this.launchFireball.add(innerFlash);

    this.launchShockwave = new THREE.Mesh(
      new THREE.TorusGeometry(1.4, 0.14, 12, 40),
      new THREE.MeshBasicMaterial({
        color: 0xfbbf24,
        transparent: true,
        opacity: 0.85,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      })
    );
    this.launchShockwave.rotation.x = Math.PI / 2;
    this.launchExplosionGroup.add(this.launchShockwave);

    const shardMats = [
      new THREE.MeshStandardMaterial({ color: 0xe2e8f0, roughness: 0.42, metalness: 0.25 }),
      new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.45, metalness: 0.78 }),
      new THREE.MeshStandardMaterial({ color: 0xf59e0b, roughness: 0.3, metalness: 0.85 }),
      new THREE.MeshBasicMaterial({ color: 0xf97316 }),
    ];
    for (let i = 0; i < 28; i++) {
      const geo =
        i % 3 === 0
          ? new THREE.BoxGeometry(0.95, 0.28, 0.65)
          : i % 3 === 1
          ? new THREE.CylinderGeometry(0.18, 0.3, 0.62, 10)
          : new THREE.TetrahedronGeometry(0.46, 0);
      const mesh = new THREE.Mesh(geo, shardMats[i % shardMats.length]);
      mesh.castShadow = true;
      this.launchExplosionGroup.add(mesh);
      this.launchDebris.push({
        mesh,
        vel: new THREE.Vector3(),
        rotVel: new THREE.Vector3(),
      });
    }
    this.launchGroup.add(this.launchExplosionGroup);

    // Volumetric Soft Billboard Flame-Trench Steam & Smoke Plume Pool (110 puffs for twin billowing cumulus clouds!)
    for (let i = 0; i < 110; i++) {
      const warmTint = i % 3 === 0 ? 0xf5e3cf : i % 3 === 1 ? 0xebdccb : 0xfaf6f0;
      const sMat = new THREE.SpriteMaterial({
        map: this.smokeTexture,
        color: warmTint,
        transparent: true,
        opacity: 0.72,
        depthWrite: false,
      });
      const sprite = new THREE.Sprite(sMat);
      sprite.visible = false;
      this.launchGroup.add(sprite);
      this.smokePool.push({
        sprite,
        vel: new THREE.Vector3(),
        age: 0,
        active: false,
        baseScale: 2.2,
        maxAge: 3.4,
      });
    }
  }

  private rebuildLaunchStack(): void {
    if (this.shuttleRig) {
      this.launchGroup.remove(this.shuttleRig.root);
    }
    this.shuttleRig = buildCarrierRocketSpaceship(this.currentConfig, this.spacecraftAssets, {
      showBoosters: true,
      openInspectBay: false,
    });
    this.shuttleRig.root.scale.setScalar(0.95);
    this.shuttleRig.root.position.set(0, 0.85, 0);
    this.launchGroup.add(this.shuttleRig.root);

    // Enforce Exact Scientific Rocket-to-Earth Scale Ratio: Rocket = 0.0055% of Earth Diameter
    this.shuttleRig.root.updateMatrixWorld(true);
    const rocketBox = new THREE.Box3().setFromObject(this.shuttleRig.root);
    this.launchRocketHeight = Math.max(7.8, rocketBox.max.y - rocketBox.min.y);
    this.launchRocketMinY = Math.min(-0.25, rocketBox.min.y - this.shuttleRig.root.position.y);
    this.launchRocketMaxY = Math.max(7.8, rocketBox.max.y - this.shuttleRig.root.position.y);
    this.launchRocketSrbOffsetX = this.shuttleRig.srbOffsetX * this.shuttleRig.root.scale.x;
    const earthDiameter = this.launchRocketHeight / 0.000055;
    this.launchEarthRadius = earthDiameter * 0.5;

    if (this.launchEarthHorizon) {
      this.launchEarthHorizon.scale.setScalar(this.launchEarthRadius);
      this.launchEarthHorizon.position.set(0, -this.launchEarthRadius, 0);
    }
  }

  private buildJourneyScene(): void {
    const earthDep = new THREE.Mesh(
      new THREE.SphereGeometry(5.4, 64, 48),
      this.createEarthGlobeMaterial(new THREE.Vector3(18, 30, 20).normalize(), 0.56)
    );
    const earthPos = this.journeyOriginPlanetPos;
    earthDep.position.copy(earthPos);
    earthDep.rotation.set(0.22, -1.15, THREE.MathUtils.degToRad(23.4));
    earthDep.add(createAtmosphereMesh(5.68, 0x38bdf8, 0.46, 3.2));
    this.journeyGroup.add(earthDep);

    if (this.earthPBR.cloudsMap) {
      const jClouds = new THREE.Mesh(
        new THREE.SphereGeometry(5.5, 56, 42),
        new THREE.MeshStandardMaterial({
          map: this.earthPBR.cloudsMap,
          alphaMap: this.earthPBR.cloudsMap,
          transparent: true,
          opacity: 0.82,
          depthWrite: false,
        })
      );
      earthDep.add(jClouds);
    }

    // Dashed Earth Departure Parking Orbit Ring (r = 8.2 around Earth)
    const earthOrbitR = 8.2;
    const earthOrbitPts: THREE.Vector3[] = [];
    for (let i = 0; i < 96; i++) {
      const a = (i / 96) * Math.PI * 2;
      earthOrbitPts.push(new THREE.Vector3(Math.cos(a) * earthOrbitR, 0, Math.sin(a) * earthOrbitR));
    }
    const earthOrbitLoop = new THREE.LineLoop(
      new THREE.BufferGeometry().setFromPoints(earthOrbitPts),
      new THREE.LineDashedMaterial({
        color: 0x38bdf8,
        dashSize: 0.85,
        gapSize: 0.55,
        transparent: true,
        opacity: 0.55,
      })
    );
    earthOrbitLoop.computeLineDistances();
    earthOrbitLoop.position.copy(earthPos);
    this.journeyGroup.add(earthOrbitLoop);

    this.journeyTargetPlanet = new THREE.Mesh(
      new THREE.SphereGeometry(4.8, 56, 40),
      new THREE.MeshStandardMaterial({
        map: this.marsPBR.map,
        normalMap: this.marsPBR.normalMap,
        roughness: 0.8,
      })
    );
    this.journeyTargetPlanet.position.set(6.5, 0, -34.0);
    this.journeyGroup.add(this.journeyTargetPlanet);

    // Dashed target "yörünge" orbit ring waiting around destination planet (r = 8.8)
    const targetOrbitR = 8.8;
    const targetOrbitPts: THREE.Vector3[] = [];
    for (let i = 0; i < 96; i++) {
      const a = (i / 96) * Math.PI * 2;
      targetOrbitPts.push(new THREE.Vector3(Math.cos(a) * targetOrbitR, 0, Math.sin(a) * targetOrbitR));
    }
    const targetOrbitLoop = new THREE.LineLoop(
      new THREE.BufferGeometry().setFromPoints(targetOrbitPts),
      new THREE.LineDashedMaterial({ color: 0x22d3ee, dashSize: 0.9, gapSize: 0.55 })
    );
    targetOrbitLoop.computeLineDistances();
    targetOrbitLoop.position.copy(this.journeyTargetPlanet.position);
    this.journeyGroup.add(targetOrbitLoop);

    // True C1-continuous Keplerian Hohmann Transfer Curve:
    // Departs tangentially from Earth's parking orbit (depAngle = -0.38 rad),
    // sweeps in a wide elliptical arc across deep space (apex around x = -8.8),
    // and arrives 100% tangentially onto Target Planet's orbit ring at entryAngle = 1.12 * PI!
    const depAngle = -0.38;
    const p0 = new THREE.Vector3(
      earthPos.x + Math.cos(depAngle) * earthOrbitR,
      0,
      earthPos.z + Math.sin(depAngle) * earthOrbitR
    );
    const tDep = new THREE.Vector3(Math.sin(depAngle), 0, -Math.cos(depAngle)).normalize();

    const pCenter = this.journeyTargetPlanet.position;
    const entryAngle = Math.PI * 1.12;
    const p3 = new THREE.Vector3(
      pCenter.x + Math.cos(entryAngle) * targetOrbitR,
      0,
      pCenter.z + Math.sin(entryAngle) * targetOrbitR
    );
    // Tangent of target circular orbit at theta = entryAngle for increasing theta: (-sin(theta), 0, cos(theta))
    const tEntry = new THREE.Vector3(-Math.sin(entryAngle), 0, Math.cos(entryAngle)).normalize();

    const handleLen1 = 22.5;
    const handleLen2 = 22.5;
    const p1 = p0.clone().addScaledVector(tDep, handleLen1);
    const p2 = p3.clone().addScaledVector(tEntry, -handleLen2);

    const hohmannBezier = new THREE.CubicBezierCurve3(p0, p1, p2, p3);
    const bezierSamples = hohmannBezier.getPoints(64);
    this.journeyCurve = new THREE.CatmullRomCurve3(bezierSamples);

    const curvePts = this.journeyCurve.getPoints(160);
    const dashLine = new THREE.Line(
      new THREE.BufferGeometry().setFromPoints(curvePts),
      new THREE.LineDashedMaterial({
        color: 0x38bdf8,
        dashSize: 1.1,
        gapSize: 0.65,
      })
    );
    dashLine.computeLineDistances();
    this.journeyGroup.add(dashLine);

    // Receding Carrier Rocket in Earth Departure Orbit (keeps Stage 3 -> Stage 4 separation continuous!)
    this.journeyGroup.add(this.journeyCarrierGroup);

    // Deployed NASA Satellite from Stage 3 separation + Ion Transfer Plume
    this.journeyCraft = new THREE.Group();
    this.journeySatGroup = new THREE.Group();

    this.journeySatFlame = new THREE.Mesh(
      new THREE.ConeGeometry(0.18, 1.05, 16),
      new THREE.MeshBasicMaterial({
        color: 0x38bdf8,
        transparent: true,
        opacity: 0.78,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      })
    );
    this.journeySatFlame.rotation.x = -Math.PI / 2;
    this.journeySatFlame.position.z = -0.6;
    this.journeyCraft.add(this.journeySatFlame);
    this.journeyCraft.add(this.journeySatGroup);
    this.journeyGroup.add(this.journeyCraft);

    this.rebuildJourneySatellite();
  }

  private rebuildJourneySatellite(): void {
    if (!this.journeySatGroup) return;
    if (this.journeySatRig) {
      this.journeySatGroup.remove(this.journeySatRig.root);
    }
    this.journeySatRig = buildDropSpaceship(this.spacecraftAssets, this.currentConfig);
    this.journeySatRig.root.scale.setScalar(0.62);
    this.journeySatRig.root.rotation.order = 'ZYX';
    this.journeySatRig.root.rotation.set(Math.PI / 2, 0, Math.PI);
    this.journeySatRig.legsGroup.visible = false;
    this.journeySatRig.flameGroup.visible = false;
    this.journeySatGroup.add(this.journeySatRig.root);

    if (this.journeyCarrierRig) {
      this.journeyCarrierGroup.remove(this.journeyCarrierRig.root);
    }
    this.journeyCarrierRig = buildCarrierRocketSpaceship(this.currentConfig, this.spacecraftAssets, {
      showBoosters: false,
      openInspectBay: false,
    });
    this.journeyCarrierRig.root.scale.setScalar(0.88);
    this.journeyCarrierRig.payloadMount.visible = false;
    this.journeyCarrierRig.mainFlames.visible = false;
    this.journeyCarrierRig.srbFlames.visible = false;
    this.journeyCarrierGroup.add(this.journeyCarrierRig.root);
  }


  private getVisualOrbitRadius(worldId: WorldId): number {
    const world = WORLDS[worldId];
    const altRatio = world.orbitAltitudeKm / Math.max(1, world.meanRadiusKm);
    return ORBIT_PLANET_RADIUS + THREE.MathUtils.clamp(0.75 + Math.sqrt(altRatio) * 3.1, 1.35, 3.3);
  }

  private refreshOrbitRingGeometry(orbitRadius: number): void {
    if (!this.orbitRingLine) return;
    const pos = this.orbitRingLine.geometry.attributes.position as THREE.BufferAttribute;
    const count = pos.count;
    for (let i = 0; i < count; i++) {
      const a = (i / count) * Math.PI * 2;
      pos.setXYZ(i, Math.cos(a) * orbitRadius, 0, Math.sin(a) * orbitRadius);
    }
    pos.needsUpdate = true;
    this.orbitRingLine.computeLineDistances();
  }

  private buildOrbitInsertionScene(): void {
    this.orbitPlanetMesh = new THREE.Mesh(
      new THREE.SphereGeometry(ORBIT_PLANET_RADIUS, 64, 48),
      new THREE.MeshStandardMaterial({
        map: this.moonPBR.map,
        normalMap: this.moonPBR.normalMap,
        roughnessMap: this.moonPBR.roughnessMap,
        roughness: 0.8,
      })
    );
    this.orbitGroup.add(this.orbitPlanetMesh);

    this.orbitAtmoMesh = createAtmosphereMesh(4.56, 0x38bdf8, 0.48, 3.0);
    this.orbitGroup.add(this.orbitAtmoMesh);

    // 3D Holographic Planetary Coordinate Grid & Dynamic Altitude Projection Rings
    this.orbitHoloGridGroup = new THREE.Group();
    const wireSphereGeo = new THREE.WireframeGeometry(
      new THREE.SphereGeometry(ORBIT_PLANET_RADIUS + 0.06, 24, 16)
    );
    const wireSphere = new THREE.LineSegments(
      wireSphereGeo,
      new THREE.LineBasicMaterial({
        color: 0x22d3ee,
        transparent: true,
        opacity: 0.14,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      })
    );
    this.orbitHoloGridGroup.add(wireSphere);

    // Polar & Equatorial Holographic Reference Rings
    [0, Math.PI / 2].forEach((rotX, idx) => {
      const holoRing = new THREE.Mesh(
        new THREE.RingGeometry(ORBIT_PLANET_RADIUS + 0.42 + idx * 0.38, ORBIT_PLANET_RADIUS + 0.45 + idx * 0.38, 64),
        new THREE.MeshBasicMaterial({
          color: idx === 0 ? 0x38bdf8 : 0x10b981,
          side: THREE.DoubleSide,
          transparent: true,
          opacity: 0.24,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
        })
      );
      holoRing.rotation.x = rotX;
      this.orbitHoloGridGroup.add(holoRing);
    });
    this.orbitGroup.add(this.orbitHoloGridGroup);

    // Dashed Circular Orbit Ring matching target world's physical altitude-to-radius ratio
    const orbitRadius = this.getVisualOrbitRadius(this.targetWorldId);
    const ringPts: THREE.Vector3[] = [];
    for (let i = 0; i < 128; i++) {
      const a = (i / 128) * Math.PI * 2;
      ringPts.push(new THREE.Vector3(Math.cos(a) * orbitRadius, 0, Math.sin(a) * orbitRadius));
    }
    this.orbitRingLine = new THREE.LineLoop(
      new THREE.BufferGeometry().setFromPoints(ringPts),
      new THREE.LineDashedMaterial({
        color: 0x38bdf8,
        dashSize: 0.72,
        gapSize: 0.38,
        transparent: true,
        opacity: 0.9,
      })
    );
    this.orbitRingLine.computeLineDistances();
    this.orbitGroup.add(this.orbitRingLine);

    // Selected Landing Site Laser Beacon on the Planet Surface
    this.landingBeaconGroup = new THREE.Group();
    const beaconRing = new THREE.Mesh(
      new THREE.RingGeometry(0.24, 0.42, 32),
      new THREE.MeshBasicMaterial({ color: 0x10b981, side: THREE.DoubleSide, transparent: true, opacity: 0.95 })
    );
    this.landingBeaconGroup.add(beaconRing);

    const beaconPin = new THREE.Mesh(
      new THREE.CylinderGeometry(0.04, 0.04, 1.15, 12),
      new THREE.MeshBasicMaterial({ color: 0x34d399, transparent: true, opacity: 0.9 })
    );
    beaconPin.rotation.x = Math.PI / 2;
    beaconPin.position.z = 0.58;
    this.landingBeaconGroup.add(beaconPin);

    const beaconTip = new THREE.Mesh(
      new THREE.SphereGeometry(0.12, 16, 12),
      new THREE.MeshBasicMaterial({ color: 0x6ee7b7 })
    );
    beaconTip.position.z = 1.16;
    this.landingBeaconGroup.add(beaconTip);
    this.orbitGroup.add(this.landingBeaconGroup);

    this.orbitGroup.add(this.candidatePinsGroup);

    // Predicted Spiral De-Orbit Descent Path Line (121 vertices)
    const arcPts: THREE.Vector3[] = [];
    for (let i = 0; i <= 120; i++) arcPts.push(new THREE.Vector3());
    this.orbitDescentLine = new THREE.Line(
      new THREE.BufferGeometry().setFromPoints(arcPts),
      new THREE.LineDashedMaterial({ color: 0xf59e0b, dashSize: 0.4, gapSize: 0.28 })
    );
    this.orbitDescentLine.visible = false;
    this.orbitGroup.add(this.orbitDescentLine);

    // Realistically Scaled Orbiting SpaceX Starship (1:5.53 aspect ratio, legs stowed in orbit)
    this.orbitCraft = new THREE.Group();
    this.orbitCraftRig = buildDropSpaceship(this.spacecraftAssets, this.currentConfig);
    this.orbitCraftRig.root.scale.setScalar(0.135);
    this.orbitCraftRig.root.position.set(0, -0.45, 0);
    this.orbitCraftRig.legsGroup.visible = false;
    this.orbitCraftRig.flameGroup.visible = false;
    this.orbitCraft.add(this.orbitCraftRig.root);

    this.orbitReticleGroup = new THREE.Group();
    this.orbitReticleMat = new THREE.MeshBasicMaterial({
      color: 0x22d3ee,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.88,
      depthWrite: false,
    });
    const reticleRing = new THREE.Mesh(new THREE.RingGeometry(0.50, 0.57, 36), this.orbitReticleMat);
    this.orbitReticleGroup.add(reticleRing);
    for (let t = 0; t < 4; t++) {
      const tick = new THREE.Mesh(new THREE.PlaneGeometry(0.16, 0.03), this.orbitReticleMat);
      const ang = (t * Math.PI) / 2;
      tick.position.set(Math.cos(ang) * 0.65, Math.sin(ang) * 0.65, 0);
      tick.rotation.z = ang;
      this.orbitReticleGroup.add(tick);
    }
    this.orbitCraft.add(this.orbitReticleGroup);

    this.orbitCraftFlame = new THREE.Mesh(
      new THREE.ConeGeometry(0.068, 0.46, 14),
      new THREE.MeshBasicMaterial({
        color: 0x38bdf8,
        transparent: true,
        opacity: 0.9,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      })
    );
    this.orbitCraftFlame.rotation.x = Math.PI;
    this.orbitCraftFlame.position.set(0, -0.44, 0);
    this.orbitCraftFlame.visible = false;
    this.orbitCraft.add(this.orbitCraftFlame);

    // Ionized Atmospheric Re-Entry Plasma Sheath around windward TPS heatshield
    this.orbitPlasmaMesh = new THREE.Mesh(
      new THREE.SphereGeometry(0.28, 20, 16, 0, Math.PI * 2, 0, Math.PI * 0.65),
      new THREE.MeshBasicMaterial({
        color: 0xf97316,
        transparent: true,
        opacity: 0.72,
        side: THREE.DoubleSide,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      })
    );
    this.orbitPlasmaMesh.scale.set(0.68, 1.65, 0.78);
    this.orbitPlasmaMesh.position.set(0, 0.02, -0.05);
    this.orbitPlasmaMesh.visible = false;
    this.orbitCraft.add(this.orbitPlasmaMesh);

    this.orbitGroup.add(this.orbitCraft);

    this.refreshOrbitSiteMarkers();
  }

  private refreshOrbitSiteMarkers(): void {
    while (this.candidatePinsGroup.children.length > 0) {
      this.candidatePinsGroup.remove(this.candidatePinsGroup.children[0]);
    }
    const sites = LANDING_SITES[this.targetWorldId];
    const R = 4.34;
    for (const site of sites) {
      const rad = THREE.MathUtils.degToRad(site.angleDeg);
      const pin = new THREE.Mesh(
        new THREE.SphereGeometry(0.16, 14, 12),
        new THREE.MeshBasicMaterial({ color: 0xfbbf24 })
      );
      pin.position.set(Math.cos(rad) * R, 0, Math.sin(rad) * R);
      this.candidatePinsGroup.add(pin);
    }
    this.updateSelectedSiteBeacon();
  }

  private updateSelectedSiteBeacon(): void {
    const rad = THREE.MathUtils.degToRad(this.selectedSiteAngleDeg);
    const R = 4.35;
    const bx = Math.cos(rad) * R;
    const bz = Math.sin(rad) * R;
    this.landingBeaconGroup.position.set(bx, 0, bz);
    this.landingBeaconGroup.lookAt(bx * 2, 0, bz * 2);
  }

  private getTerrainHeightAt(worldId: WorldId, x: number, z: number): number {
    if (worldId === 'earth') return 0.18;

    const centerDist = Math.sqrt(x * x + z * z);
    const padBlend = THREE.MathUtils.smoothstep(centerDist, 4.0, 9.2);
    const craterDelta = getCraterDisplacement(worldId, x, z) * padBlend;

    if (worldId === 'asteroid') {
      const r2 = x * x + z * z;
      return (
        -(r2 / 140) +
        (fbm3(x * 0.08, 0.5, z * 0.08, 4, 901) - 0.5) * 1.4 * padBlend +
        craterDelta
      );
    }

    const R = 110;
    const r2 = x * x + z * z;
    const curvature = -(r2 / (2 * R));

    const nx = x * 0.055;
    const nz = z * 0.055;
    let h = fbm3(nx, 0.5, nz, 5, worldId === 'moon' ? 21 : worldId === 'mars' ? 51 : 81);

    if (worldId === 'moon') {
      h = (h - 0.45) * 3.4 * padBlend;
    } else if (worldId === 'jupiter') {
      const ridge = Math.abs(Math.sin(x * 0.14 + h * 3.2)) * 1.35;
      h = ((h - 0.5) * 1.6 + ridge) * padBlend;
    } else {
      const colonyBlend =
        worldId === 'colony' ? THREE.MathUtils.smoothstep(centerDist, 9.0, 18.0) : padBlend;
      h = (h - 0.45) * 4.0 * colonyBlend;
    }

    return curvature + h + craterDelta;
  }

  private createPlanetaryTerrain(worldId: WorldId): THREE.Mesh {
    const geo = new THREE.PlaneGeometry(240, 240, 160, 160);
    geo.rotateX(-Math.PI / 2);

    const pos = geo.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      const z = pos.getZ(i);
      pos.setY(i, this.getTerrainHeightAt(worldId, x, z));
    }
    geo.computeVertexNormals();

    const uv = geo.attributes.uv as THREE.BufferAttribute;
    for (let i = 0; i < uv.count; i++) {
      uv.setXY(i, uv.getX(i) * 4.5, uv.getY(i) * 4.5);
    }

    const pbr =
      worldId === 'moon'
        ? this.moonPBR
        : worldId === 'mars'
        ? this.marsPBR
        : worldId === 'jupiter'
        ? this.europaPBR
        : worldId === 'asteroid'
        ? this.asteroidPBR
        : this.proximaPBR;

    const mat = new THREE.MeshStandardMaterial({
      map: pbr.map,
      normalMap: pbr.normalMap ?? null,
      normalScale: new THREE.Vector2(1.4, 1.4),
      roughnessMap: pbr.roughnessMap ?? null,
      roughness: worldId === 'jupiter' ? 0.35 : 0.88,
      metalness: worldId === 'asteroid' ? 0.32 : worldId === 'jupiter' ? 0.12 : 0.04,
    });

    const mesh = new THREE.Mesh(geo, mat);
    mesh.receiveShadow = true;
    return mesh;
  }

  private buildFinalVisualScene(): void {
    for (let i = 0; i < 28; i++) {
      const sMat = new THREE.SpriteMaterial({
        map: this.smokeTexture,
        color: 0xe2e8f0,
        transparent: true,
        opacity: 0.65,
        depthWrite: false,
      });
      const sprite = new THREE.Sprite(sMat);
      sprite.visible = false;
      this.finalGroup.add(sprite);
      this.surfaceDustPool.push({
        sprite,
        vel: new THREE.Vector3(),
        age: 0,
        active: false,
        baseScale: 1.1,
      });
    }
    this.rebuildFinalVisual();
  }

  private spawnSurfaceDust(x: number, y: number, z: number, spread = 2.6): void {
    const puff = this.surfaceDustPool.find((p) => !p.active);
    if (!puff) return;
    puff.active = true;
    puff.age = 0;
    puff.baseScale = 0.9 + Math.random() * 0.9;
    puff.sprite.visible = true;
    puff.sprite.position.set(
      x + (Math.random() - 0.5) * 1.4,
      y + 0.35,
      z + (Math.random() - 0.5) * 1.4
    );
    puff.sprite.scale.setScalar(puff.baseScale);
    puff.sprite.material.opacity = 0.62;
    puff.vel.set(
      (Math.random() - 0.5) * spread,
      0.35 + Math.random() * 0.65,
      (Math.random() - 0.5) * spread
    );
  }

  private rebuildFinalVisual(): void {
    const dustSprites = new Set(this.surfaceDustPool.map((d) => d.sprite));
    for (let i = this.finalGroup.children.length - 1; i >= 0; i--) {
      const child = this.finalGroup.children[i];
      if (!dustSprites.has(child as THREE.Sprite)) {
        this.finalGroup.remove(child);
      }
    }
    this.surfaceDustPool.forEach((d) => {
      d.active = false;
      d.sprite.visible = false;
    });
    this.finalRadarDish = null;
    this.finalCloudsMesh = null;
    this.l1ProbeGroup = null;
    this.l1SunCoronaSprite = null;
    this.l1BroadcastRings = [];

    const worldId = this.targetWorldId;
    if (worldId === 'l1') {
      // Scenario 2: Sun–Earth L1 Lagrange Point Halo Station-Keeping & Early Warning Broadcast 3D Scene
      const sunGroup = new THREE.Group();
      sunGroup.position.set(-14.5, 3.2, -16.5);
      const sunSphere = new THREE.Mesh(
        new THREE.SphereGeometry(5.6, 48, 36),
        new THREE.MeshBasicMaterial({ map: this.sunPBR.map, color: 0xffedd5 })
      );
      sunGroup.add(sunSphere);

      const corona = new THREE.Sprite(
        new THREE.SpriteMaterial({
          map: this.glowTexture,
          color: 0xf97316,
          transparent: true,
          opacity: 0.85,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
        })
      );
      corona.scale.setScalar(26);
      this.l1SunCoronaSprite = corona;
      sunGroup.add(corona);
      this.finalGroup.add(sunGroup);

      // Distant Blue Earth in the anti-sunward (+X/+Z) direction receiving L1 telemetry
      const earthGroup = new THREE.Group();
      earthGroup.position.set(13.5, -1.2, 11.5);
      const earthMesh = new THREE.Mesh(
        new THREE.SphereGeometry(2.6, 48, 36),
        new THREE.MeshStandardMaterial({
          map: this.earthPBR.map,
          normalMap: this.earthPBR.normalMap ?? null,
          roughnessMap: this.earthPBR.roughnessMap ?? null,
          roughness: 0.65,
        })
      );
      earthGroup.add(earthMesh);
      earthGroup.add(createAtmosphereMesh(2.76, 0x38bdf8, 0.55, 3.2));
      this.finalGroup.add(earthGroup);

      // L1 Lissajous Halo Orbit Reference Ring
      const haloRing = new THREE.Mesh(
        new THREE.RingGeometry(6.8, 6.92, 96),
        new THREE.MeshBasicMaterial({
          color: 0xfbbf24,
          side: THREE.DoubleSide,
          transparent: true,
          opacity: 0.25,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
        })
      );
      haloRing.rotation.x = Math.PI * 0.44;
      haloRing.position.set(0, 1.8, 0);
      this.finalGroup.add(haloRing);

      // L1 Observation Probe at origin with MinXSS Spectrometers & RTG
      const probeRig = buildHangarSpacecraft(this.currentConfig, this.spacecraftAssets);
      probeRig.root.scale.setScalar(0.95);
      probeRig.root.position.set(0, 0.6, 0);
      this.l1ProbeGroup = probeRig.root;
      this.finalGroup.add(probeRig.root);

      // Ka-band Early Warning Broadcast Pulse Rings aimed toward Earth
      for (let r = 0; r < 4; r++) {
        const pulseRing = new THREE.Mesh(
          new THREE.RingGeometry(0.45, 0.56, 36),
          new THREE.MeshBasicMaterial({
            color: 0x22d3ee,
            side: THREE.DoubleSide,
            transparent: true,
            opacity: 0,
            blending: THREE.AdditiveBlending,
            depthWrite: false,
          })
        );
        pulseRing.visible = false;
        this.l1BroadcastRings.push(pulseRing);
        this.finalGroup.add(pulseRing);
      }

      this.surfacePhase = 'rover_active';
      this.cameraFocusTarget = new THREE.Vector3(0, 1.8, 0);
      this.cameraFocusPos = new THREE.Vector3(4.8, 3.6, 8.2);
      return;
    }

    const dustTint =
      worldId === 'mars' || worldId === 'colony'
        ? 0xfdba74
        : worldId === 'jupiter'
        ? 0xe0f2fe
        : 0xcbd5e1;
    this.surfaceDustPool.forEach((d) => d.sprite.material.color.setHex(dustTint));

    this.surfaceTerrainMesh = null;
    this.surfaceObstacles = generateWorldObstacles(worldId);

    if (worldId === 'earth') {
      const earth = new THREE.Mesh(
        new THREE.SphereGeometry(24, 72, 56),
        new THREE.MeshStandardMaterial({
          map: this.earthPBR.map,
          normalMap: this.earthPBR.normalMap,
          normalScale: new THREE.Vector2(1.2, 1.2),
          roughnessMap: this.earthPBR.roughnessMap,
          roughness: 0.72,
        })
      );
      earth.position.set(0, -25.2, -3);
      this.finalGroup.add(earth);

      if (this.earthPBR.cloudsMap) {
        const clouds = new THREE.Mesh(
          new THREE.SphereGeometry(24.28, 64, 48),
          new THREE.MeshStandardMaterial({
            map: this.earthPBR.cloudsMap,
            transparent: true,
            opacity: 0.85,
            depthWrite: false,
          })
        );
        clouds.position.copy(earth.position);
        this.finalCloudsMesh = clouds;
        this.finalGroup.add(clouds);
      }

      const atmo = createAtmosphereMesh(24.95, 0x38bdf8, 0.48, 3.4);
      atmo.position.copy(earth.position);
      this.finalGroup.add(atmo);

      const deck = new THREE.Mesh(
        new THREE.CylinderGeometry(16, 17, 0.36, 48),
        new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.58, metalness: 0.65 })
      );
      deck.position.y = 0;
      deck.receiveShadow = true;
      this.finalGroup.add(deck);
      this.surfaceTerrainMesh = deck;

      const padCircle = new THREE.Mesh(
        new THREE.RingGeometry(3.5, 3.9, 48),
        new THREE.MeshBasicMaterial({ color: 0xd97706, side: THREE.DoubleSide })
      );
      padCircle.rotation.x = -Math.PI / 2;
      padCircle.position.y = 0.19;
      this.finalGroup.add(padCircle);
    } else {
      const terrain = this.createPlanetaryTerrain(worldId);
      this.finalGroup.add(terrain);
      this.surfaceTerrainMesh = terrain;

      if (worldId === 'moon') {
        const distantEarth = new THREE.Mesh(
          new THREE.SphereGeometry(2.8, 40, 32),
          new THREE.MeshStandardMaterial({
            map: this.earthPBR.map,
            roughnessMap: this.earthPBR.roughnessMap,
            roughness: 0.72,
          })
        );
        distantEarth.position.set(-15, 15, -48);
        distantEarth.add(createAtmosphereMesh(2.94, 0x38bdf8, 0.45, 3.2));
        this.finalGroup.add(distantEarth);
      }

      if (worldId === 'jupiter') {
        const giantJupiter = new THREE.Mesh(
          new THREE.SphereGeometry(17.5, 64, 48),
          new THREE.MeshStandardMaterial({
            map: this.jupiterPBR.map,
            normalMap: this.jupiterPBR.normalMap,
            roughness: 0.72,
          })
        );
        giantJupiter.position.set(-14, 17, -44);
        giantJupiter.add(createAtmosphereMesh(18.15, 0xfbbf24, 0.36, 3.0));
        this.finalGroup.add(giantJupiter);
      }

      if (worldId === 'colony') {
        const colony = buildColonyStructures(this.spacecraftAssets.solar);
        colony.root.position.set(-8.5, 0, -5.5);
        this.finalRadarDish = colony.radarDish;
        this.finalGroup.add(colony.root);
      }
    }

    this.buildSurfaceObstacleMeshes(worldId);

    // Persistent Regolith Wheel Track InstancedMesh (up to 380 tire tread imprints)
    const trackGeo = new THREE.PlaneGeometry(0.16, 0.28);
    trackGeo.rotateX(-Math.PI / 2);
    const trackMat = new THREE.MeshBasicMaterial({
      color: worldId === 'mars' || worldId === 'colony' ? 0x431407 : worldId === 'jupiter' ? 0x38bdf8 : 0x1e293b,
      transparent: true,
      opacity: 0.46,
      depthWrite: false,
      polygonOffset: true,
      polygonOffsetFactor: -1,
    });
    this.wheelTrackMesh = new THREE.InstancedMesh(trackGeo, trackMat, 380);
    this.wheelTrackMesh.count = 0;
    this.wheelTrackCount = 0;
    this.finalGroup.add(this.wheelTrackMesh);

    // ChemCam Pulsed Laser Spectrometer Beam + Spark Glow
    const laserPts = [new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, 1, 1)];
    this.chemCamBeamLine = new THREE.Line(
      new THREE.BufferGeometry().setFromPoints(laserPts),
      new THREE.LineBasicMaterial({
        color: 0xf43f5e,
        transparent: true,
        opacity: 0.95,
      })
    );
    this.chemCamBeamLine.visible = false;
    this.finalGroup.add(this.chemCamBeamLine);

    this.chemCamSparkSprite = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: this.glowTexture,
        color: 0xfb7185,
        transparent: true,
        opacity: 0.95,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      })
    );
    this.chemCamSparkSprite.scale.setScalar(0.85);
    this.chemCamSparkSprite.visible = false;
    this.finalGroup.add(this.chemCamSparkSprite);

    const navPts: THREE.Vector3[] = [];
    for (let i = 0; i < 160; i++) navPts.push(new THREE.Vector3());
    this.roverNavLine = new THREE.Line(
      new THREE.BufferGeometry().setFromPoints(navPts),
      new THREE.LineDashedMaterial({ color: 0x22d3ee, dashSize: 0.65, gapSize: 0.35 })
    );
    this.roverNavLine.visible = false;
    this.finalGroup.add(this.roverNavLine);

    this.roverTargetBeacon = new THREE.Group();
    const targetRing = new THREE.Mesh(
      new THREE.RingGeometry(0.42, 0.66, 32),
      new THREE.MeshBasicMaterial({ color: 0x10b981, side: THREE.DoubleSide, transparent: true, opacity: 0.92 })
    );
    targetRing.rotation.x = -Math.PI / 2;
    this.roverTargetBeacon.add(targetRing);

    const targetPin = new THREE.Mesh(
      new THREE.CylinderGeometry(0.04, 0.04, 1.3, 12),
      new THREE.MeshBasicMaterial({ color: 0x34d399, transparent: true, opacity: 0.85 })
    );
    targetPin.position.y = 0.65;
    this.roverTargetBeacon.add(targetPin);

    const targetOrb = new THREE.Mesh(
      new THREE.SphereGeometry(0.14, 16, 12),
      new THREE.MeshBasicMaterial({ color: 0x6ee7b7 })
    );
    targetOrb.position.y = 1.32;
    this.roverTargetBeacon.add(targetOrb);
    this.roverTargetBeacon.visible = false;
    this.finalGroup.add(this.roverTargetBeacon);

    this.landingVehicle = buildDropSpaceship(this.spacecraftAssets, this.currentConfig);
    this.finalGroup.add(this.landingVehicle.root);

    // Starship Raptor Plume Thermal Ground Scorch Decal
    const scorchCanvas = document.createElement('canvas');
    scorchCanvas.width = 256;
    scorchCanvas.height = 256;
    const sCtx = scorchCanvas.getContext('2d');
    if (sCtx) {
      const grad = sCtx.createRadialGradient(128, 128, 6, 128, 128, 124);
      grad.addColorStop(0.0, 'rgba(251, 146, 60, 0.85)');
      grad.addColorStop(0.22, 'rgba(15, 23, 42, 0.92)');
      grad.addColorStop(0.58, 'rgba(2, 6, 23, 0.68)');
      grad.addColorStop(1.0, 'rgba(2, 6, 23, 0.0)');
      sCtx.fillStyle = grad;
      sCtx.fillRect(0, 0, 256, 256);
    }
    const scorchTex = new THREE.CanvasTexture(scorchCanvas);
    scorchTex.colorSpace = THREE.SRGBColorSpace;
    const scorchGeo = new THREE.PlaneGeometry(5.6, 5.6);
    scorchGeo.rotateX(-Math.PI / 2);
    this.landerScorchMesh = new THREE.Mesh(
      scorchGeo,
      new THREE.MeshBasicMaterial({
        map: scorchTex,
        transparent: true,
        opacity: 0,
        depthWrite: false,
        polygonOffset: true,
        polygonOffsetFactor: -2,
      })
    );
    const padCenterY = this.getTerrainHeightAt(worldId, 0, 0);
    this.landerScorchMesh.position.set(0, padCenterY + 0.03, 0);
    this.finalGroup.add(this.landerScorchMesh);

    this.roverVehicle = buildRoverVehicle(this.spacecraftAssets);
    this.roverVehicle.headlightGroup.visible = this.roverHeadlightsOn;
    this.finalGroup.add(this.roverVehicle.root);

    this.collectedSamples = [];
    this.lastSpectroReadout = null;
    this.chemCamScanTimer = 0;
    this.chemCamActiveTarget = null;
    this.pendingScanObstacleId = null;
    this.autonomousMissionActive = false;
    this.roverBattery = 100.0;
    this.roverMaxBattery = 100.0;
    this.roverTotalDistanceM = 0.0;
    this.spectrometerSummary = 'Analiz bekleniyor...';
    this.systemLog = 'Sistem aktif. Yüzeye tıklayın veya Görev Başlatın.';

    this.resetSurfaceSequence();
    this.pushScienceTelemetry(true);
  }

  private buildSurfaceObstacleMeshes(worldId: WorldId): void {
    const pbr =
      worldId === 'moon'
        ? this.moonPBR
        : worldId === 'mars'
        ? this.marsPBR
        : worldId === 'jupiter'
        ? this.europaPBR
        : worldId === 'asteroid'
        ? this.asteroidPBR
        : this.proximaPBR;

    const rockMat = new THREE.MeshStandardMaterial({
      map: pbr.map,
      normalMap: pbr.normalMap ?? null,
      roughness: worldId === 'jupiter' ? 0.34 : 0.88,
      metalness: worldId === 'asteroid' ? 0.35 : 0.06,
    });

    const iceMat = new THREE.MeshPhysicalMaterial({
      color: 0xbfe7ff,
      roughness: 0.16,
      metalness: 0.12,
      clearcoat: 0.85,
      transparent: true,
      opacity: 0.9,
    });

    const looseRockMat = new THREE.MeshStandardMaterial({
      map: pbr.map,
      color: 0xf59e0b,
      roughness: 0.55,
      metalness: 0.32,
      emissive: 0x78350f,
      emissiveIntensity: 0.18,
    });

    const deckPropMat = new THREE.MeshStandardMaterial({
      color: 0x334155,
      roughness: 0.42,
      metalness: 0.72,
    });

    const hazardAmberMat = new THREE.MeshBasicMaterial({ color: 0xf59e0b });

    const rockGeo = new THREE.IcosahedronGeometry(0.92, 2);
    const rPos = rockGeo.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < rPos.count; i++) {
      const vx = rPos.getX(i);
      const vy = rPos.getY(i);
      const vz = rPos.getZ(i);
      const d = 0.76 + fbm3(vx * 2.6, vy * 2.6, vz * 2.6, 3, 44) * 0.46;
      rPos.setXYZ(i, vx * d, vy * d, vz * d);
    }
    rockGeo.computeVertexNormals();

    for (const obs of this.surfaceObstacles) {
      if (obs.kind === 'lander' || obs.kind === 'colony') continue;

      const gy = this.getTerrainHeightAt(worldId, obs.x, obs.z);

      if (obs.kind === 'pit') {
        const pitGroup = new THREE.Group();
        const pitSpec = getWorldCraters(worldId).find(
          (c) => c.isDeepPit && Math.hypot(c.x - obs.x, c.z - obs.z) < 0.5
        );
        const rimR = pitSpec ? pitSpec.radius : obs.radius;
        for (let k = 0; k < 6; k++) {
          const a = (k / 6) * Math.PI * 2;
          const rx = obs.x + Math.cos(a) * rimR;
          const rz = obs.z + Math.sin(a) * rimR;
          const ry = this.getTerrainHeightAt(worldId, rx, rz);
          const rimRock = new THREE.Mesh(rockGeo, rockMat);
          rimRock.position.set(rx, ry + 0.12, rz);
          rimRock.scale.set(0.38, 0.28, 0.38);
          rimRock.rotation.y = a;
          rimRock.castShadow = true;
          pitGroup.add(rimRock);

          if (k % 2 === 0) {
            const beacon = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.06, 0.55, 8), hazardAmberMat);
            beacon.position.set(rx, ry + 0.36, rz);
            pitGroup.add(beacon);
          }
        }
        this.finalGroup.add(pitGroup);
        obs.mesh = pitGroup;
      } else if (obs.kind === 'deck_prop') {
        const box = new THREE.Mesh(new THREE.BoxGeometry(obs.radius * 1.45, obs.height, obs.radius * 1.45), deckPropMat);
        box.position.set(obs.x, gy + obs.height * 0.5, obs.z);
        box.castShadow = true;
        box.receiveShadow = true;
        const stripe = new THREE.Mesh(new THREE.BoxGeometry(obs.radius * 1.48, 0.1, obs.radius * 1.48), hazardAmberMat);
        stripe.position.y = obs.height * 0.32;
        box.add(stripe);
        this.finalGroup.add(box);
        obs.mesh = box;
      } else if (obs.kind === 'ice_spire') {
        const spire = new THREE.Mesh(new THREE.ConeGeometry(obs.radius * 0.85, obs.height, 6), iceMat);
        spire.position.set(obs.x, gy + obs.height * 0.44, obs.z);
        spire.rotation.y = obs.id * 0.9;
        spire.castShadow = true;
        this.finalGroup.add(spire);
        obs.mesh = spire;
      } else if (obs.kind === 'loose_rock') {
        const rock = new THREE.Mesh(rockGeo, looseRockMat);
        rock.position.set(obs.x, gy + obs.radius * 0.58, obs.z);
        rock.scale.setScalar(obs.radius * 1.05);
        rock.rotation.set(obs.id * 0.4, obs.id * 1.2, 0);
        rock.castShadow = true;
        rock.receiveShadow = true;
        this.finalGroup.add(rock);
        obs.mesh = rock;
      } else {
        const rock = new THREE.Mesh(rockGeo, rockMat);
        rock.position.set(obs.x, gy + obs.radius * 0.42, obs.z);
        rock.scale.set(obs.radius * 1.05, obs.height * 0.82, obs.radius * 0.96);
        rock.rotation.set(obs.id * 0.3, obs.id * 1.3, 0);
        rock.castShadow = true;
        rock.receiveShadow = true;
        this.finalGroup.add(rock);
        obs.mesh = rock;
      }

      if (obs.isScienceTarget) {
        const sciGroup = new THREE.Group();
        sciGroup.position.set(obs.x, gy + 0.08, obs.z);
        const sciRing = new THREE.Mesh(
          new THREE.RingGeometry(obs.radius + 0.18, obs.radius + 0.34, 28),
          new THREE.MeshBasicMaterial({
            color: 0x22d3ee,
            side: THREE.DoubleSide,
            transparent: true,
            opacity: 0.85,
          })
        );
        sciRing.rotation.x = -Math.PI / 2;
        sciGroup.add(sciRing);

        const sciDiamond = new THREE.Mesh(
          new THREE.OctahedronGeometry(0.16, 0),
          new THREE.MeshBasicMaterial({ color: 0x38bdf8 })
        );
        sciDiamond.position.y = obs.height + 0.55;
        sciGroup.add(sciDiamond);

        this.finalGroup.add(sciGroup);
        obs.beaconGroup = sciGroup;
      }
    }
  }

  private stampRoverWheelTracks(): void {
    if (!this.wheelTrackMesh) return;
    const dist = Math.hypot(
      this.roverPos.x - this.lastWheelTrackPos.x,
      this.roverPos.z - this.lastWheelTrackPos.y
    );
    if (dist < 0.28) return;
    this.lastWheelTrackPos.set(this.roverPos.x, this.roverPos.z);

    const cosH = Math.cos(this.roverHeading);
    const sinH = Math.sin(this.roverHeading);
    const lateralOffsets = [-0.25, 0.25];

    for (const lat of lateralOffsets) {
      const idx = this.wheelTrackCount % 380;
      const wx = this.roverPos.x + cosH * lat - sinH * 0.12;
      const wz = this.roverPos.z - sinH * lat - cosH * 0.12;
      const wy = this.getTerrainHeightAt(this.targetWorldId, wx, wz) + 0.025;

      _v1.set(wx, wy, wz);
      _euler.set(0, this.roverHeading, 0);
      _quat.setFromEuler(_euler);
      _scale.set(1, 1, 1);
      _mat4.compose(_v1, _quat, _scale);
      this.wheelTrackMesh.setMatrixAt(idx, _mat4);
      this.wheelTrackCount++;
    }
    this.wheelTrackMesh.count = Math.min(380, this.wheelTrackCount);
    this.wheelTrackMesh.instanceMatrix.needsUpdate = true;
  }

  public setOrbitTimeWarp(warp: OrbitTimeWarp): void {
    this.orbitTimeWarp = warp;
    this.pushOrbitTelemetry(true);
  }

  public setManualThrottle(pct: number | null): void {
    this.manualThrottlePct = pct === null ? null : THREE.MathUtils.clamp(pct, 0, 140);
  }

  public setSurfaceCameraMode(mode: SurfaceCameraMode): void {
    this.surfaceCameraMode = mode;
    this.userOrbiting = false;
    this.callbacks.onCameraModeChange?.(mode);
  }

  public toggleRoverHeadlights(): boolean {
    this.roverHeadlightsOn = !this.roverHeadlightsOn;
    if (this.roverVehicle) {
      this.roverVehicle.headlightGroup.visible = this.roverHeadlightsOn;
    }
    return this.roverHeadlightsOn;
  }

  private getNearestScannableObstacle(maxRangeUnits = 6.5): SurfaceObstacle | null {
    let best: SurfaceObstacle | null = null;
    let bestScore = Infinity;
    for (const obs of this.surfaceObstacles) {
      if (obs.kind === 'lander' || obs.kind === 'colony' || obs.kind === 'pit') continue;
      const d = Math.hypot(obs.x - this.roverPos.x, obs.z - this.roverPos.z);
      if (d > maxRangeUnits) continue;
      // Prioritize unscanned primary science targets, then unscanned rocks, then closest rock
      const priorityPenalty = obs.scanned ? 18 : obs.isScienceTarget ? -6 : 0;
      const score = d + priorityPenalty;
      if (score < bestScore) {
        bestScore = score;
        best = obs;
      }
    }
    return best;
  }

  private generateOxideBreakdown(obs: SurfaceObstacle): string {
    const seed = (obs.id * 97 + this.targetWorldId.charCodeAt(0) * 31) % 100;
    const n1 = (seed % 17) * 0.45;
    const n2 = ((seed * 3) % 13) * 0.42;
    const n3 = ((seed * 7) % 11) * 0.38;

    if (this.targetWorldId === 'mars' || this.targetWorldId === 'colony') {
      const sio2 = (41.2 + n1).toFixed(1);
      const fe2o3 = (18.4 + n2).toFixed(1);
      const al2o3 = (11.6 + n3).toFixed(1);
      const rem = Math.max(4, 100 - parseFloat(sio2) - parseFloat(fe2o3) - parseFloat(al2o3)).toFixed(1);
      return `%${sio2} SiO₂, %${fe2o3} Fe₂O₃, %${al2o3} Al₂O₃, %${rem} Diğer`;
    }
    if (this.targetWorldId === 'jupiter') {
      const h2o = (64.0 + n1).toFixed(1);
      const mgso4 = (19.2 + n2).toFixed(1);
      const na2co3 = (8.4 + n3 * 0.6).toFixed(1);
      const rem = Math.max(2, 100 - parseFloat(h2o) - parseFloat(mgso4) - parseFloat(na2co3)).toFixed(1);
      return `%${h2o} H₂O Buz, %${mgso4} MgSO₄, %${na2co3} Na₂CO₃, %${rem} Diğer`;
    }
    // Lunar / Asteroid / Earth anorthositic-basaltic breakdown matching user's project
    const compSiO2 = (40.5 + n1).toFixed(1);
    const compAl2O3 = (20.8 + n2).toFixed(1);
    const compCaO = (11.2 + n3).toFixed(1);
    const remainder = Math.max(
      4,
      100 - parseFloat(compSiO2) - parseFloat(compAl2O3) - parseFloat(compCaO)
    ).toFixed(1);
    return `%${compSiO2} SiO₂, %${compAl2O3} Al₂O₃, %${compCaO} CaO, %${remainder} Diğer`;
  }

  public startAutonomousRoverMission(): void {
    if (this.surfacePhase !== 'rover_active') {
      this.skipToRoverActive();
    }
    // If all primary targets were already scanned, reset them so a fresh mission can run
    const unscannedPrimary = this.surfaceObstacles.filter((o) => o.isScienceTarget && !o.scanned);
    if (unscannedPrimary.length === 0) {
      for (const o of this.surfaceObstacles) {
        if (o.isScienceTarget) o.scanned = false;
      }
      this.collectedSamples = [];
    }

    this.autonomousMissionActive = true;
    this.roverDriveInput.autoRoam = false;
    this.roverBattery = this.roverMaxBattery;
    const remainingCount = this.surfaceObstacles.filter((o) => o.isScienceTarget && !o.scanned).length;
    this.systemLog = `Görev Başladı: ${remainingCount} Örnek Otonom Toplanacak.`;
    this.planNextAutonomousTarget();
    this.pushScienceTelemetry(true);
  }

  public resetRoverState(): void {
    this.autonomousMissionActive = false;
    this.pendingScanObstacleId = null;
    this.chemCamActiveTarget = null;
    this.chemCamScanTimer = 0;
    if (this.chemCamBeamLine) this.chemCamBeamLine.visible = false;
    if (this.chemCamSparkSprite) this.chemCamSparkSprite.visible = false;
    this.roverDriveInput = { forward: 0, turn: 0, autoRoam: false };
    this.clearRoverNavigation();
    this.roverBattery = this.roverMaxBattery;
    this.roverTotalDistanceM = 0;

    if (this.surfacePhase === 'rover_active' && this.roverVehicle) {
      const startY = this.getTerrainHeightAt(this.targetWorldId, 0, 4.2);
      this.roverPos.set(0, startY, 4.2);
      this.roverHeading = 0;
      this.roverVehicle.root.visible = true;
      this.roverVehicle.root.scale.setScalar(1.0);
      this.roverVehicle.root.position.copy(this.roverPos);
      this.roverVehicle.root.rotation.set(0, 0, 0);
    }
    this.systemLog = 'Sistem Sıfırlandı. Serbest sürüş aktif.';
    this.pushScienceTelemetry(true);
  }

  private planNextAutonomousTarget(): void {
    if (!this.autonomousMissionActive) return;
    const remaining = this.surfaceObstacles.filter((o) => o.isScienceTarget && !o.scanned);
    if (remaining.length === 0) {
      this.autonomousMissionActive = false;
      this.systemLog = 'GÖREV BAŞARIYLA TAMAMLANDI!';
      this.pushScienceTelemetry(true);
      return;
    }

    // Pick closest unscanned primary science target
    let closest = remaining[0];
    let minDist = Infinity;
    for (const t of remaining) {
      const d = Math.hypot(t.x - this.roverPos.x, t.z - this.roverPos.z);
      if (d < minDist) {
        minDist = d;
        closest = t;
      }
    }

    this.pendingScanObstacleId = closest.id;
    const angle = Math.atan2(this.roverPos.x - closest.x, this.roverPos.z - closest.z);
    const stopR = closest.radius + ROVER_COLLISION_RADIUS + 0.85;
    this.plotShortestRoverRoute(
      closest.x + Math.sin(angle) * stopR,
      closest.z + Math.cos(angle) * stopR
    );
    this.systemLog = `Otonom Rota: ${closest.label} (${(minDist * SURFACE_METERS_PER_UNIT).toFixed(1)} m)`;
    this.pushScienceTelemetry(true);
  }

  public triggerChemCamScan(obstacleId?: number): void {
    if (this.surfacePhase !== 'rover_active') return;
    let target: SurfaceObstacle | null = null;
    if (obstacleId !== undefined) {
      target = this.surfaceObstacles.find((o) => o.id === obstacleId) ?? null;
    } else {
      target = this.getNearestScannableObstacle(6.8);
    }
    if (!target) {
      this.currentObstacleNotice = 'No rock specimen within 13 m ChemCam range';
      this.systemLog = 'Menzilde (13 m) analiz edilecek kaya bulunamadı.';
      this.obstacleNoticeTimer = 2.2;
      this.pushRoverNavTelemetry(true);
      this.pushScienceTelemetry(true);
      return;
    }
    const dist = Math.hypot(target.x - this.roverPos.x, target.z - this.roverPos.z);
    if (dist > 6.8) {
      this.pendingScanObstacleId = target.id;
      const angle = Math.atan2(this.roverPos.x - target.x, this.roverPos.z - target.z);
      const stopR = target.radius + ROVER_COLLISION_RADIUS + 0.9;
      this.plotShortestRoverRoute(
        target.x + Math.sin(angle) * stopR,
        target.z + Math.cos(angle) * stopR
      );
      this.currentObstacleNotice = `Driving to ${target.label} for ChemCam Scan...`;
      this.systemLog = `Rota Onaylandı: ${target.label} hedefine ilerleniyor...`;
      this.obstacleNoticeTimer = 2.4;
      this.pushRoverNavTelemetry(true);
      this.pushScienceTelemetry(true);
      return;
    }

    this.chemCamActiveTarget = target;
    this.chemCamScanTimer = 1.15;
    this.pendingScanObstacleId = null;
    this.systemLog = `Örnek Analiz Ediliyor: ${target.label}...`;
    missionAudio.playLaserPulse();
    this.pushScienceTelemetry(true);
  }

  private pushScienceTelemetry(force = false): void {
    if (!this.callbacks.onScienceUpdate) return;
    const now = performance.now();
    if (!force && now - this.lastScienceUiPush < 95) return;
    this.lastScienceUiPush = now;

    const totalTargets = this.surfaceObstacles.filter((o) => o.isScienceTarget).length;
    const primaryCollected = this.surfaceObstacles.filter((o) => o.isScienceTarget && o.scanned).length;
    const nearTarget = this.getNearestScannableObstacle(6.5);

    const isMoving =
      this.roverDriveInput.forward !== 0 ||
      this.roverDriveInput.turn !== 0 ||
      this.roverDriveInput.autoRoam ||
      this.roverWaypointIdx < this.roverPathWaypoints.length;

    const roverStatus: ScienceMissionState['roverStatus'] =
      this.roverBattery <= 0.05
        ? 'GÜÇ TÜKENDİ!'
        : this.chemCamScanTimer > 0
        ? 'ANALİZ YAPILIYOR'
        : isMoving
        ? 'HAREKET HALİNDE'
        : 'BEKLİYOR / ŞARJ OLUYOR';

    const radarTargets = this.surfaceObstacles
      .filter((o) => o.kind !== 'lander' && o.kind !== 'colony' && o.kind !== 'pit')
      .map((o) => ({
        id: o.id,
        x: o.x,
        z: o.z,
        scanned: Boolean(o.scanned),
        isPrimary: Boolean(o.isScienceTarget),
      }));

    const radarCraters = getWorldCraters(this.targetWorldId).map((c) => ({
      x: c.x,
      z: c.z,
      radius: c.radius,
      depth: c.depth,
    }));

    const radarRoute: { x: number; z: number }[] = [];
    if (this.roverWaypointIdx < this.roverPathWaypoints.length) {
      radarRoute.push({ x: this.roverPos.x, z: this.roverPos.z });
      for (let i = this.roverWaypointIdx; i < this.roverPathWaypoints.length; i++) {
        radarRoute.push({
          x: this.roverPathWaypoints[i].x,
          z: this.roverPathWaypoints[i].y,
        });
      }
    }

    this.callbacks.onScienceUpdate({
      totalTargets,
      collectedCount: primaryCollected,
      samples: [...this.collectedSamples],
      activeScanLabel: this.chemCamActiveTarget
        ? this.chemCamActiveTarget.label
        : nearTarget
        ? `${nearTarget.label} (${(Math.hypot(nearTarget.x - this.roverPos.x, nearTarget.z - this.roverPos.z) * SURFACE_METERS_PER_UNIT).toFixed(1)} m)`
        : null,
      scanningProgress:
        this.chemCamScanTimer > 0
          ? Math.round(THREE.MathUtils.clamp(1 - this.chemCamScanTimer / 1.15, 0, 1) * 100)
          : 0,
      missionComplete: totalTargets > 0 && primaryCollected >= totalTargets,
      lastSpectroReadout: this.lastSpectroReadout,
      autonomousMissionActive: this.autonomousMissionActive,
      roverStatus,
      batteryPct: Number(Math.max(0, this.roverBattery).toFixed(1)),
      maxBattery: this.roverMaxBattery,
      totalDistanceM: Number(this.roverTotalDistanceM.toFixed(1)),
      sensorTempC: Number(this.sensorTempC.toFixed(1)),
      sensorRadUsv: Number(this.sensorRadUsv.toFixed(1)),
      sensorSlopeDeg: Number(this.sensorSlopeDeg.toFixed(1)),
      sensorIrReflectance: Number(this.sensorIrReflectance.toFixed(2)),
      sensorCameraStatus: this.sensorCameraStatus,
      spectrometerSummary: this.spectrometerSummary,
      systemLog: this.systemLog,
      roverX: this.roverPos.x,
      roverZ: this.roverPos.z,
      roverHeading: this.roverHeading,
      maxMapRadius: this.targetWorldId === 'earth' ? 16 : 45,
      radarTargets,
      radarCraters,
      radarRoute,
    });
  }

  public replaySurfaceSequence(): void {
    this.resetSurfaceSequence();
  }

  public skipToRoverActive(): void {
    if (!this.landingVehicle || !this.roverVehicle) return;
    const groundY = this.getTerrainHeightAt(this.targetWorldId, 0, 0);
    this.userOrbiting = false;
    this.landerY = groundY;
    this.landerVelY = 0;
    this.landerCompression = 0.06;
    this.landerCompressionVel = 0;
    this.landerFlameFade = 0;
    this.landerScorchIntensity = 0.85;
    if (this.landerScorchMesh) {
      (this.landerScorchMesh.material as THREE.MeshBasicMaterial).opacity = 0.85;
    }
    this.rampAngle = 1.90;
    this.landingVehicle.root.position.set(0, groundY, 0);
    this.landingVehicle.bodyGroup.position.y = -this.landerCompression;
    this.landingVehicle.bodyGroup.rotation.set(0, 0, 0);
    this.landingVehicle.legsGroup.rotation.set(0, 0, 0);
    this.landingVehicle.legsGroup.visible = true;
    this.landingVehicle.fwdFlaps.forEach((f) => (f.rotation.z = 0));
    this.landingVehicle.aftFlaps.forEach((f) => (f.rotation.z = 0));
    for (const leg of this.landingVehicle.legRigs) {
      leg.upperPivot.position.y = 0.68 - this.landerCompression;
      leg.upperPivot.rotation.z = 0.56 + this.landerCompression * 0.65;
      leg.lowerPivot.rotation.z = 0.56 + this.landerCompression * 0.65;
    }
    this.landingVehicle.flameGroup.visible = false;
    this.landingVehicle.rampPivot.rotation.x = this.rampAngle;
    this.landingVehicle.bayLight.intensity = 2.5;

    this.roverPos.set(0, this.getTerrainHeightAt(this.targetWorldId, 0, 4.2), 4.2);
    this.roverHeading = 0;
    this.lastWheelTrackPos.set(this.roverPos.x, this.roverPos.z);
    this.roverVehicle.root.visible = true;
    this.roverVehicle.root.scale.setScalar(1.0);
    this.roverVehicle.root.position.copy(this.roverPos);
    this.roverVehicle.root.rotation.set(0, 0, 0);
    this.clearRoverNavigation();

    this.surfacePhase = 'rover_active';
    this.surfaceTimer = 0;
    this.callbacks.onSurfacePhaseChange('rover_active');
    const gSurf = WORLDS[this.targetWorldId].surfaceGravity;
    this.callbacks.onSurfaceTelemetry?.({
      altitudeM: 0,
      verticalSpeedMs: 0,
      surfaceGravityMs2: gSurf,
      maneuverLabel: 'LANDED & SECURED',
      fuelPct: Math.round(this.landerFuelPct),
      manualThrottlePct: this.manualThrottlePct,
      pitchDeg: 0,
      mach: 0,
      dynamicPressureKpa: 0,
      gLoad: Number((gSurf / 9.80665).toFixed(2)),
    });
    this.cameraFocusTarget = new THREE.Vector3(0, groundY + 1.8, 2.4);
    this.cameraFocusPos = new THREE.Vector3(6.8, groundY + 4.2, 12.6);
    this.pushScienceTelemetry();
  }

  private resetSurfaceSequence(): void {
    if (!this.landingVehicle || !this.roverVehicle) return;
    const world = WORLDS[this.targetWorldId];
    const hasAtmo = world.hasAtmosphere;
    const groundY = this.getTerrainHeightAt(this.targetWorldId, 0, 0);
    this.userOrbiting = false;
    this.surfacePhase = 'descending';
    this.surfaceTimer = 0;
    this.landerY = groundY + 75.0; // 150 m approach altitude (1u = 2.0m)
    this.landerVelY = -9.5; // -19.0 m/s initial descent rate
    this.landerCompression = 0;
    this.landerCompressionVel = 0;
    this.landerFlameFade = 1;
    this.landerScorchIntensity = 0;
    if (this.landerScorchMesh) {
      (this.landerScorchMesh.material as THREE.MeshBasicMaterial).opacity = 0;
    }
    this.landerFuelPct = 100;
    this.flipBurnIgnited = !hasAtmo;
    this.rampAngle = 0;
    this.roverHeading = 0;
    this.roverBumpTimer = 0;
    this.currentObstacleNotice = null;
    this.roverDriveInput = { forward: 0, turn: 0, autoRoam: false };
    this.clearRoverNavigation();

    const initialPitch = hasAtmo ? 1.28 : 0.24; // 73° Belly-Flop on atmospheric worlds vs. 14° HLS Powered Descent on airless worlds
    this.landingVehicle.root.position.set(0, this.landerY, 0);
    this.landingVehicle.bodyGroup.position.y = 0;
    this.landingVehicle.bodyGroup.rotation.set(initialPitch, 0, 0);
    this.landingVehicle.legsGroup.rotation.set(initialPitch, 0, 0);
    this.landingVehicle.legsGroup.visible = false;
    this.landingVehicle.fwdFlaps.forEach((f) => (f.rotation.z = 0));
    this.landingVehicle.aftFlaps.forEach((f) => (f.rotation.z = 0));
    for (const leg of this.landingVehicle.legRigs) {
      leg.upperPivot.position.y = 0.68;
      leg.upperPivot.rotation.z = 0.56;
      leg.lowerPivot.rotation.z = 0.56;
    }
    this.landingVehicle.flameGroup.visible = !hasAtmo;
    this.landingVehicle.rampPivot.rotation.x = 0;
    this.landingVehicle.bayLight.intensity = 0;

    this.roverPos.set(0, this.landerY + 0.48, -0.05);
    this.lastWheelTrackPos.set(0, -0.05);
    this.roverVehicle.root.visible = false; // Enclosed behind closed Starship cargo door during descent
    this.roverVehicle.root.scale.setScalar(1.0);
    this.roverVehicle.root.position.copy(this.roverPos);
    this.roverVehicle.root.rotation.set(0, 0, 0);

    // Immediately lock camera onto the high-altitude SpaceX Starship on Frame 0 so it is never out of view
    this.controls.target.set(0, this.landerY + 2.4, 0);
    this.camera.position.set(14.5, this.landerY + 4.8, 24.5);
    this.controls.update();
    this.cameraFocusTarget = null;
    this.cameraFocusPos = null;

    this.callbacks.onSurfacePhaseChange('descending');
    this.callbacks.onSurfaceTelemetry?.({
      altitudeM: Math.round(75 * SURFACE_METERS_PER_UNIT),
      verticalSpeedMs: Number((9.5 * SURFACE_METERS_PER_UNIT).toFixed(1)),
      surfaceGravityMs2: world.surfaceGravity,
      maneuverLabel: hasAtmo ? 'BELLY FLOP SKYDIVE' : 'HLS POWERED DESCENT',
      fuelPct: 100,
      manualThrottlePct: this.manualThrottlePct,
      pitchDeg: Math.round(THREE.MathUtils.radToDeg(initialPitch)),
      mach: hasAtmo ? 0.08 : 0,
      dynamicPressureKpa: hasAtmo ? 0.42 : 0,
      gLoad: Number(((world.surfaceGravity * (hasAtmo ? 1.0 : 1.65)) / 9.80665).toFixed(2)),
    });
  }

  public clearRoverNavigation(): void {
    this.roverPathWaypoints = [];
    this.roverWaypointIdx = 0;
    if (this.roverNavLine) this.roverNavLine.visible = false;
    if (this.roverTargetBeacon) this.roverTargetBeacon.visible = false;
    this.pushRoverNavTelemetry(true);
  }

  private pushRoverNavTelemetry(force = false): void {
    if (!this.callbacks.onRoverNavUpdate) return;
    const now = performance.now();
    if (!force && now - this.lastRoverNavPush < 90) return;
    this.lastRoverNavPush = now;

    const active = this.roverWaypointIdx < this.roverPathWaypoints.length;
    let dist = 0;
    let targetX: number | null = null;
    let targetZ: number | null = null;
    if (active) {
      let prevX = this.roverPos.x;
      let prevZ = this.roverPos.z;
      for (let i = this.roverWaypointIdx; i < this.roverPathWaypoints.length; i++) {
        const wp = this.roverPathWaypoints[i];
        dist += Math.hypot(wp.x - prevX, wp.y - prevZ);
        prevX = wp.x;
        prevZ = wp.y;
      }
      const last = this.roverPathWaypoints[this.roverPathWaypoints.length - 1];
      targetX = last.x;
      targetZ = last.y;
    }

    this.callbacks.onRoverNavUpdate({
      active,
      targetX,
      targetZ,
      distanceM: Number((dist * SURFACE_METERS_PER_UNIT).toFixed(1)),
      obstacleNotice: this.currentObstacleNotice,
    });
  }

  private updateRoverNavLineMesh(): void {
    if (!this.roverNavLine || this.roverWaypointIdx >= this.roverPathWaypoints.length) {
      if (this.roverNavLine) this.roverNavLine.visible = false;
      return;
    }

    const pts: THREE.Vector3[] = [];
    let prevX = this.roverPos.x;
    let prevZ = this.roverPos.z;
    for (let i = this.roverWaypointIdx; i < this.roverPathWaypoints.length; i++) {
      const wp = this.roverPathWaypoints[i];
      const segDist = Math.hypot(wp.x - prevX, wp.y - prevZ);
      const steps = Math.max(1, Math.ceil(segDist / 0.65));
      for (let s = i === this.roverWaypointIdx ? 0 : 1; s <= steps; s++) {
        const t = s / steps;
        const px = prevX + (wp.x - prevX) * t;
        const pz = prevZ + (wp.y - prevZ) * t;
        pts.push(new THREE.Vector3(px, this.getTerrainHeightAt(this.targetWorldId, px, pz) + 0.14, pz));
      }
      prevX = wp.x;
      prevZ = wp.y;
    }

    const maxVerts = 160;
    const linePos = this.roverNavLine.geometry.attributes.position as THREE.BufferAttribute;
    const count = Math.min(maxVerts, pts.length);
    for (let i = 0; i < maxVerts; i++) {
      const src = pts[Math.min(i, Math.max(0, count - 1))] || this.roverPos;
      linePos.setXYZ(i, src.x, src.y, src.z);
    }
    linePos.needsUpdate = true;
    this.roverNavLine.geometry.setDrawRange(0, count);
    this.roverNavLine.computeLineDistances();
    this.roverNavLine.visible = count >= 2;
  }

  private plotShortestRoverRoute(goalX: number, goalZ: number): void {
    const maxR = this.targetWorldId === 'earth' ? 14.0 : 45.0;
    const path = findShortestObstacleFreePath(
      this.roverPos.x,
      this.roverPos.z,
      goalX,
      goalZ,
      this.surfaceObstacles,
      maxR
    );
    if (path.length < 2) return;

    this.roverDriveInput.autoRoam = false;
    this.roverPathWaypoints = path;
    this.roverWaypointIdx = 1;

    const finalWp = path[path.length - 1];
    const gy = this.getTerrainHeightAt(this.targetWorldId, finalWp.x, finalWp.y);
    this.roverTargetBeacon.position.set(finalWp.x, gy + 0.12, finalWp.y);
    this.roverTargetBeacon.visible = true;
    this.updateRoverNavLineMesh();
    this.pushRoverNavTelemetry(true);
  }

  public setRoverDriveInput(input: { forward?: number; turn?: number; autoRoam?: boolean }): void {
    if (input.forward !== undefined) this.roverDriveInput.forward = input.forward;
    if (input.turn !== undefined) this.roverDriveInput.turn = input.turn;
    if (input.autoRoam !== undefined) this.roverDriveInput.autoRoam = input.autoRoam;
  }



  public setStage(stage: SceneStage): void {
    this.activeStage = stage;
    this.startGroup.visible = stage === 'start_menu' || stage === 'scenario_select';
    this.solarGroup.visible = stage === 'planet_select';
    this.hangarGroup.visible = stage === 'hangar';
    this.launchGroup.visible = stage === 'launch_pad';
    this.journeyGroup.visible = stage === 'journey';
    this.orbitGroup.visible = stage === 'orbit_insertion';
    this.finalGroup.visible = stage === 'final_visual';
    if (this.sunVisualGroup) {
      this.sunVisualGroup.visible =
        (stage === 'orbit_insertion' || stage === 'final_visual') && this.targetWorldId !== 'l1';
    }

    const world = WORLDS[this.targetWorldId];
    const pbr = this.getWorldPBR(this.targetWorldId);

    this.camera.fov = stage === 'journey' ? 56 : 45;
    if (stage !== 'launch_pad') {
      this.camera.near = 0.1;
      this.camera.far = 750;
      this.camera.up.set(0, 1, 0);
      this.camera.updateProjectionMatrix();
      this.scene.fog = null;
      this.skyBackdrop.scale.setScalar(1);
      this.starField.scale.setScalar(1);
      this.starField.visible = true;
    }

    if (stage === 'start_menu' || stage === 'scenario_select') {
      this.controls.enabled = true;
      this.controls.minDistance = 1.9;
      this.controls.maxDistance = 11.5;
      this.cameraFocusTarget = new THREE.Vector3(0.32, 1.08, -0.45);
      this.cameraFocusPos = new THREE.Vector3(0.18, 1.32, 3.45);
    } else if (stage === 'planet_select') {
      this.controls.enabled = true;
      this.controls.minDistance = 8;
      this.controls.maxDistance = 135;
      this.cameraFocusTarget = new THREE.Vector3(0, 0, 0);
      this.cameraFocusPos = new THREE.Vector3(0, 26, 50);
    } else if (stage === 'hangar') {
      this.controls.enabled = true;
      this.controls.minDistance = 4.2;
      this.controls.maxDistance = 18;
      this.cameraFocusTarget = new THREE.Vector3(0, 2.75, 0);
      this.cameraFocusPos = new THREE.Vector3(5.2, 2.8, 7.6);
    } else if (stage === 'launch_pad') {
      this.controls.enabled = false;
      this.cameraFocusTarget = null;
      this.cameraFocusPos = null;
      this.camera.near = 0.45;
      this.camera.far = 480000;
      this.camera.up.set(0, 1, 0);
      this.camera.updateProjectionMatrix();
      this.scene.fog = this.launchFog;
      this.skyBackdrop.scale.setScalar(1200);
      this.starField.scale.setScalar(950);
      this.starField.visible = false;

      const pMat = this.launchTargetPlanet.material as THREE.MeshStandardMaterial;
      pMat.map = pbr.map;
      pMat.normalMap = pbr.normalMap ?? null;
      pMat.color.setHex(0xffffff);
      pMat.needsUpdate = true;
      this.rebuildLaunchStack();
      this.resetLaunchState();
      this.camera.position.set(5.2, 3.6, 33.5);
      this.camera.lookAt(1.5, 5.8, 0);
    } else if (stage === 'journey') {
      this.controls.enabled = false;
      this.journeyProgress = 0;
      this.journeyFuelExhausted = false;
      this.journeyLostTimer = 0;
      this.journeyFailTriggered = false;
      this.lastJourneyFuelPct = 100;
      this.callbacks.onJourneyFuelUpdate?.(100);
      this.rebuildJourneySatellite();

      const p0 = this.journeyCurve.getPointAt(0);
      const t0 = this.journeyCurve.getTangentAt(0).normalize();
      this.journeyCraft.up.set(0, 1, 0);
      this.journeyCraft.position.copy(p0);
      this.journeyCraft.lookAt(_v1.copy(p0).add(t0));
      this.journeySatGroup.scale.setScalar(0.76);
      this.journeySatGroup.rotation.set(0, 0, 0);
      this.journeySatFlame.visible = true;
      this.journeySatFlame.scale.set(0.55, 0.75, 0.55);

      this.journeyCarrierGroup.visible = true;
      this.journeyCarrierGroup.scale.setScalar(0.92);
      this.journeyCarrierGroup.rotation.set(-Math.PI / 2, 0, 0);
      this.journeyCarrierGroup.position.set(p0.x - 2.6, p0.y - 0.55, p0.z + 3.8);

      // Start with the exact same horizon-level 3/4 orbital chase camera angle as the end of Launch!
      const rx = -t0.z;
      const rz = t0.x;
      this.journeyCamOffset.set(rx * 10.8 - t0.x * 5.4, 4.2, rz * 10.8 - t0.z * 5.4);
      this.journeyLookOffset.set(t0.x * 3.8, 0.35, t0.z * 3.8);
      this.camera.up.set(0, 1, 0);
      this.camera.position.copy(p0).add(this.journeyCamOffset);
      this.journeyCamLook.copy(p0).add(this.journeyLookOffset);
      this.camera.lookAt(this.journeyCamLook);

      // Keep target planet visual scale well inside the 8.8 capture orbit ring
      const targetScale = THREE.MathUtils.clamp(
        0.78 + Math.log10(Math.max(0.2, world.earthRadiusRatio)) * 0.22,
        0.65,
        1.05
      );
      this.journeyTargetPlanet.scale.setScalar(targetScale);

      const mat = this.journeyTargetPlanet.material as THREE.MeshStandardMaterial;
      mat.map = pbr.map;
      mat.normalMap = pbr.normalMap ?? null;
      mat.roughnessMap = pbr.roughnessMap ?? null;
      mat.color.setHex(0xffffff);
      mat.needsUpdate = true;

      this.callbacks.onJourneyTransitUpdate?.(evaluateHohmannTransitState(this.targetWorldId, 0));
    } else if (stage === 'orbit_insertion') {
      this.userOrbiting = false;
      this.controls.enabled = true;
      this.controls.minDistance = 9;
      this.controls.maxDistance = 32;
      this.orbitPhase = 'orbiting';
      this.orbitCraftAngle = 0;
      this.orbitDescentT = 0;
      this.orbitTouchdownTimer = -1;
      this.orbitCraftFlame.visible = false;
      this.orbitPlasmaMesh.visible = false;
      this.orbitDescentLine.visible = false;
      if (this.orbitCraftRig) {
        this.orbitCraftRig.legsGroup.visible = false;
        this.orbitCraftRig.flameGroup.visible = false;
      }

      const defaultSite = LANDING_SITES[this.targetWorldId][0];
      this.selectedSiteAngleDeg = defaultSite.angleDeg;

      const mat = this.orbitPlanetMesh.material as THREE.MeshStandardMaterial;
      mat.map = pbr.map;
      mat.normalMap = pbr.normalMap ?? null;
      mat.roughnessMap = pbr.roughnessMap ?? null;
      mat.color.setHex(0xffffff);
      mat.emissive.setHex(this.targetWorldId === 'l1' ? 0xf59e0b : 0x000000);
      mat.emissiveMap = this.targetWorldId === 'l1' ? pbr.map : null;
      mat.emissiveIntensity = this.targetWorldId === 'l1' ? 0.65 : 0;
      mat.needsUpdate = true;

      this.orbitAtmoMesh.visible =
        world.hasAtmosphere || world.id === 'jupiter' || world.id === 'l1';
      const atmoUniforms = (this.orbitAtmoMesh.material as THREE.ShaderMaterial).uniforms;
      if (atmoUniforms?.uColor) {
        atmoUniforms.uColor.value.set(world.accentColor);
      }

      this.refreshOrbitRingGeometry(this.getVisualOrbitRadius(this.targetWorldId));
      this.refreshOrbitSiteMarkers();
      this.pushOrbitTelemetry(true);
      this.cameraFocusTarget = new THREE.Vector3(0, 0, 0);
      this.cameraFocusPos = new THREE.Vector3(0, 14.5, 17.5);
    } else if (stage === 'final_visual') {
      this.userOrbiting = false;
      this.controls.enabled = true;
      this.controls.minDistance = 3.5;
      this.controls.maxDistance = 95;
      this.rebuildFinalVisual();
    }
  }

  public updateCommanderConfig(config: CommanderConfig): void {
    this.currentCommanderConfig = { ...config };
    const flagTex = this.flagTextures[this.currentCommanderConfig.flagId];
    if (this.astronautRig) {
      updateCommanderAstronautMaterials(
        this.astronautRig,
        this.currentCommanderConfig,
        flagTex
      );
    }
    if (this.lunarFlagClothMat) {
      this.lunarFlagClothMat.map = flagTex;
      this.lunarFlagClothMat.needsUpdate = true;
    }
    if (this.setEaglePanelFlagTex) {
      this.setEaglePanelFlagTex(
        this.eaglePanelFlagTextures[this.currentCommanderConfig.flagId]
      );
    }
  }

  public resetStartCamera(): void {
    this.userOrbiting = false;
    this.astronautTurntable.rotation.y = 0;
    this.cameraFocusTarget = new THREE.Vector3(0.32, 1.08, -0.45);
    this.cameraFocusPos = new THREE.Vector3(0.18, 1.32, 3.45);
  }


  public selectLandingSiteAngle(angleDeg: number): void {
    this.selectedSiteAngleDeg = ((angleDeg % 360) + 360) % 360;
    this.updateSelectedSiteBeacon();
    this.pushOrbitTelemetry(true);
  }

  public armDeorbitDescent(): void {
    if (this.orbitPhase === 'descending') return;
    this.orbitPhase = 'armed';
    this.pushOrbitTelemetry(true);
  }

  public cancelDeorbitArm(): void {
    if (this.orbitPhase === 'armed') {
      this.orbitPhase = 'orbiting';
      this.pushOrbitTelemetry(true);
    }
  }

  private pushOrbitTelemetry(force = false): void {
    const now = performance.now();
    if (!force && now - this.lastOrbitUiPush < 70) return;
    this.lastOrbitUiPush = now;

    const world = WORLDS[this.targetWorldId];
    const craftDeg = ((THREE.MathUtils.radToDeg(this.orbitCraftAngle) % 360) + 360) % 360;
    let diff = Math.abs(craftDeg - this.selectedSiteAngleDeg);
    if (diff > 180) diff = 360 - diff;
    const alignmentPct = Math.round(Math.max(0, 1 - diff / 180) * 100);

    const descentFrac = this.orbitPhase === 'descending' ? Math.min(1, this.orbitDescentT) : 0;
    const currentAltKm = Math.round(world.orbitAltitudeKm * (1 - descentFrac));
    const rCurrentKm = world.meanRadiusKm + Math.max(0, currentAltKm);
    const vCurrentKms =
      this.orbitPhase === 'descending'
        ? computeVisVivaSpeedKms(
            world.muKm3s2,
            rCurrentKm,
            (world.meanRadiusKm + world.orbitAltitudeKm + world.meanRadiusKm) * 0.5
          )
        : world.orbitMetrics.orbitalVelocityKms;

    const heatCurve = Math.sin(Math.pow(descentFrac, 0.85) * Math.PI);
    const tpsTempC =
      this.orbitPhase === 'descending'
        ? Math.round(20 + heatCurve * (world.hasAtmosphere ? 1420 : 280))
        : 20;
    const accelG =
      this.orbitPhase === 'descending'
        ? Number(((world.hasAtmosphere ? 3.4 : 1.75) * heatCurve + 0.35).toFixed(2))
        : 0;

    this.callbacks.onOrbitStateUpdate({
      craftAngleDeg: Math.round(craftDeg),
      siteAngleDeg: Math.round(this.selectedSiteAngleDeg),
      alignmentPct,
      altitudeKm: currentAltKm,
      orbitalVelocityKms: Number(vCurrentKms.toFixed(3)),
      orbitalPeriodMin: world.orbitMetrics.orbitalPeriodMin,
      deorbitBurnMs: world.orbitMetrics.deorbitBurnMs,
      phase: this.orbitPhase,
      timeWarp: this.orbitTimeWarp,
      tpsTempC,
      accelG,
    });
  }



  public setJourneySpeed(speed: JourneyWarpSpeed): void {
    this.journeySpeedMultiplier = speed;
  }

  public focusWorld(worldId: WorldId): void {
    this.targetWorldId = worldId;
    const mesh = this.worldMeshes.get(worldId);
    if (mesh && this.activeStage === 'planet_select') {
      mesh.getWorldPosition(_v1);
      const sciR = Math.max(0.45, getScientificBodySceneRadius(worldId, this.solarScaleMode));
      this.cameraFocusTarget = _v1.clone();
      this.cameraFocusPos = _v1.clone().add(new THREE.Vector3(sciR * 2.8, sciR * 2.2, sciR * 4.6));
    }
    this.pushSolarTelemetry(true);
    this.rebuildHangarSpacecraft(false);
    if (this.activeStage === 'orbit_insertion') {
      this.setStage('orbit_insertion');
    } else if (this.activeStage === 'final_visual') {
      this.rebuildFinalVisual();
    }
  }

  public updateHangarConfig(config: HangarConfig, stats: CraftStats): void {
    this.currentConfig = { ...config };
    this.currentStats = stats;
    this.rebuildHangarSpacecraft(true);
    this.rebuildLaunchStack();
    this.rebuildJourneySatellite();
    this.rebuildOrbitCraft();
    if (this.activeStage === 'final_visual') {
      this.rebuildFinalVisual();
    }
  }

  public updateCraftConfig(config: HangarConfig, stats: CraftStats): void {
    this.updateHangarConfig(config, stats);
  }

  private rebuildOrbitCraft(): void {
    if (!this.orbitCraft) return;
    if (this.orbitCraftRig) {
      this.orbitCraft.remove(this.orbitCraftRig.root);
    }
    this.orbitCraftRig = buildDropSpaceship(this.spacecraftAssets, this.currentConfig);
    this.orbitCraftRig.root.scale.setScalar(0.135);
    this.orbitCraftRig.root.position.set(0, -0.45, 0);
    this.orbitCraftRig.legsGroup.visible = false;
    this.orbitCraftRig.flameGroup.visible = false;
    this.orbitCraft.add(this.orbitCraftRig.root);
  }


  public setTurntablePaused(paused: boolean): void {
    this.turntablePaused = paused;
  }

  public startCountdown(): void {
    this.resetLaunchState();
    this.launchPhase = 'countdown';
    this.countdownAccum = 0;
    this.lastCountdownInt = 5;
    missionAudio.playCountdownBeep(false);
    this.pushLaunchTelemetry(true);
  }

  public resetLaunchState(): void {
    this.launchPhase = 'pad';
    this.countdownAccum = 0;
    this.lastCountdownInt = 5;
    this.shuttleY = 0;
    this.shuttleZ = 0;
    this.shuttleVelY = 0;
    this.shuttleVelZ = 0;
    this.launchStageTime = 0;
    this.launchPitchRad = 0;
    this.launchSimAltitudeKm = 0;
    this.launchSimVelocityKmh = 0;
    this.launchAccelG = 1.0;
    this.launchFuelPct = 100;

    this.srbSepDist = 0;
    this.srbSepDrop = 0;
    this.srbSepRot = 0;
    this.bayDoorAngle = 0;
    this.satSepDist = 0;
    this.launchCrashTimer = 0;
    this.launchFailTriggered = false;
    this.launchCamOffset.set(5.2, 2.75, 33.5);
    this.launchLookOffset.set(1.5, 4.95, 0);
    this.camera.up.set(0, 1, 0);

    this.padSkyMat.uniforms.uSpaceMix.value = 0;
    if (this.launchFog) {
      this.launchFog.density = 0.0014;
      if (this.activeStage === 'launch_pad') this.scene.fog = this.launchFog;
    }
    this.starField.visible = false;
    this.launchEarthHorizon.visible = true;
    this.launchEarthHorizon.scale.setScalar(this.launchEarthRadius);
    this.launchEarthHorizon.position.set(0, -this.launchEarthRadius, 0);
    this.launchTargetPlanet.visible = false;
    this.launchStarStreaks.visible = false;
    this.launchFailedTrail.visible = false;
    this.launchSepDashLine.visible = false;
    this.launchExplosionGroup.visible = false;
    this.launchTower.swingArm.rotation.y = 0;
    if (this.launchLagoonReflection) {
      (this.launchLagoonReflection.material as THREE.MeshBasicMaterial).opacity = 0.34;
    }

    this.shuttleRig.root.visible = true;
    this.shuttleRig.root.position.set(0, 0.85, 0);
    this.shuttleRig.root.rotation.set(0, 0, 0);
    this.shuttleRig.root.quaternion.identity();
    this.shuttleRig.srbLeft.visible = true;
    this.shuttleRig.srbLeft.position.set(-this.shuttleRig.srbOffsetX, 0.1, -0.12);
    this.shuttleRig.srbLeft.rotation.set(0, 0, 0);
    this.shuttleRig.srbRight.visible = true;
    this.shuttleRig.srbRight.position.set(this.shuttleRig.srbOffsetX, 0.1, -0.12);
    this.shuttleRig.srbRight.rotation.set(0, 0, 0);
    this.shuttleRig.bayDoorLeft.rotation.y = 0;
    this.shuttleRig.bayDoorRight.rotation.y = 0;
    this.shuttleRig.payloadMount.position.set(0, this.shuttleRig.payloadRestY, 0.84);
    this.shuttleRig.payloadMount.rotation.set(0, 0, 0);
    this.shuttleRig.srbFlames.visible = false;
    this.shuttleRig.mainFlames.visible = false;
    this.shuttleRig.craftFlame.visible = false;
    this.shuttleRig.craftFlame.scale.setScalar(1);
    this.launchEngineLight.intensity = 0;

    this.smokePool.forEach((p) => {
      p.active = false;
      p.sprite.visible = false;
    });
    this.pushLaunchTelemetry(true);
  }

  private getLaunchStageLabel(): string {
    switch (this.launchPhase) {
      case 'pad':
        return 'PRE-LAUNCH PAD HOLD · CARRIER SPACESHIP';
      case 'countdown':
        return 'TERMINAL COUNTDOWN (T-5..0)';
      case 'liftoff':
        return this.currentStats.enginePasses
          ? 'LIFTOFF & MAX-Q PITCHOVER'
          : 'LIFTOFF STRUGGLE · INSUFFICIENT THRUST';
      case 'srb_sep':
        return 'BECO · SRB BOOSTER SEPARATION (45 km)';
      case 'tank_sep':
        return 'CARRIER FORWARD CRUISE TOWARD TARGET PLANET';
      case 'satellite_sep':
        return 'IN-FLIGHT DEPLOYMENT · DROP-SPACESHIP LAUNCHING';
      case 'failed_arc':
        return 'SHALLOW SUBORBITAL DECAY · FALLING AROUND EARTH';
      case 'failed_crash':
        return 'EARTH IMPACT & VEHICLE SHATTERED — MISSION FAILED';
    }
  }

  private pushLaunchTelemetry(force = false): void {
    const now = performance.now();
    if (!force && now - this.lastTelemetryPush < 70) return;
    this.lastTelemetryPush = now;
    this.callbacks.onLaunchTelemetry({
      phase: this.launchPhase,
      countdownValue: Math.max(0, Math.ceil(5 - this.countdownAccum)),
      altitudeKm: Math.round(this.launchSimAltitudeKm),
      velocityKmh: Math.round(this.launchSimVelocityKmh),
      accelG: Number(this.launchAccelG.toFixed(1)),
      fuelPct: Math.round(this.launchFuelPct),
      stageLabel: this.getLaunchStageLabel(),
      sepVelocityMs: this.launchPhase === 'satellite_sep' && this.satSepDist > 0.05 ? 1.2 : 0,
    });
  }

  private evalFailArcPoint(arcT: number, out: THREE.Vector3): void {
    const clampedT = Math.max(0, arcT);
    const theta = THREE.MathUtils.lerp(this.launchFailStartTheta, this.launchFailEndTheta, clampedT);
    let h = 0;
    if (clampedT <= 0.28) {
      const u = clampedT / 0.28;
      h = THREE.MathUtils.lerp(
        this.launchFailStartAlt,
        this.launchFailPeakAlt,
        Math.sin(u * Math.PI * 0.5)
      );
    } else if (clampedT <= 1.0) {
      const v = (clampedT - 0.28) / 0.72;
      h = this.launchFailPeakAlt * Math.pow(Math.max(0, Math.cos(v * Math.PI * 0.5)), 1.22);
    } else {
      h = -3.5 * (clampedT - 1.0);
    }
    const r = this.launchEarthRadius + h;
    out.set(0, -this.launchEarthRadius + r * Math.cos(theta), r * Math.sin(theta));
  }

  private spawnSmoke(deluge = false): void {
    const puff = this.smokePool.find((p) => !p.active);
    if (!puff) return;
    puff.active = true;
    puff.age = 0;
    const side = Math.random() < 0.38 ? -1 : 1; // Larger rolling steam plume toward the right water tower side as in LC-39A photo
    if (deluge) {
      puff.maxAge = 3.2 + Math.random() * 1.4;
      puff.baseScale = 3.2 + Math.random() * 2.6;
      puff.sprite.visible = true;
      puff.sprite.position.set(
        side * (1.8 + Math.random() * 2.5),
        0.9 + Math.random() * 1.2,
        -1.5 - Math.random() * 4.5
      );
      puff.sprite.scale.setScalar(puff.baseScale);
      puff.sprite.material.opacity = 0.84;
      puff.vel.set(
        side * (4.8 + Math.random() * 7.8),
        1.1 + Math.random() * 2.8,
        -0.6 - Math.random() * 2.2
      );
    } else {
      puff.maxAge = 2.4;
      puff.baseScale = 2.0 + Math.random() * 1.6;
      puff.sprite.visible = true;
      puff.sprite.position.set(
        side * (1.2 + Math.random() * 1.8),
        Math.max(0.5, this.shuttleY * 0.22 + 0.5),
        -1.0 - Math.random() * 2.4
      );
      puff.sprite.scale.setScalar(puff.baseScale);
      puff.sprite.material.opacity = 0.74;
      puff.vel.set(
        side * (3.0 + Math.random() * 4.5),
        0.9 + Math.random() * 1.6,
        (Math.random() - 0.5) * 3.0
      );
    }
  }



  private bindEvents(): void {
    window.addEventListener('resize', this.handleResize);
    this.renderer.domElement.addEventListener('pointermove', this.handlePointerMove);
    this.renderer.domElement.addEventListener('pointerdown', this.handlePointerDown);
    this.renderer.domElement.addEventListener('pointerup', this.handlePointerUp);
  }

  private handleResize = (): void => {
    if (this.disposed) return;
    const width = this.container.clientWidth || window.innerWidth;
    const height = this.container.clientHeight || window.innerHeight;
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height);
    if (this.composer) {
      this.composer.setSize(width, height);
      this.bloomPass?.setSize(width, height);
    }
  };

  private updateNDC(e: PointerEvent): void {
    const rect = this.renderer.domElement.getBoundingClientRect();
    this.pointerNDC.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    this.pointerNDC.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
  }

  private handlePointerMove = (e: PointerEvent): void => {
    const now = performance.now();
    if (now - this.lastHoverCheck < 50) return;
    this.lastHoverCheck = now;

    this.updateNDC(e);
    this.raycaster.setFromCamera(this.pointerNDC, this.camera);

    if (this.activeStage === 'planet_select') {
      const hits = this.raycaster.intersectObjects(this.clickableProxies, false);
      const hitId = hits.length > 0 ? (hits[0].object.userData.worldId as WorldId) : null;
      if (hitId !== this.hoveredWorldId) {
        this.hoveredWorldId = hitId;
        this.renderer.domElement.style.cursor = hitId ? 'pointer' : 'grab';
        this.callbacks.onWorldHover(hitId);
      }
    } else if (this.activeStage === 'orbit_insertion') {
      const hits = this.raycaster.intersectObject(this.orbitPlanetMesh, false);
      this.renderer.domElement.style.cursor = hits.length > 0 ? 'crosshair' : 'grab';
    } else if (
      this.activeStage === 'final_visual' &&
      this.surfacePhase === 'rover_active' &&
      this.surfaceTerrainMesh
    ) {
      const hits = this.raycaster.intersectObject(this.surfaceTerrainMesh, false);
      this.renderer.domElement.style.cursor = hits.length > 0 ? 'crosshair' : 'grab';
    } else if (this.activeStage === 'start_menu' || this.activeStage === 'hangar') {
      this.renderer.domElement.style.cursor = 'grab';
    } else {
      this.renderer.domElement.style.cursor = 'default';
    }
  };

  private handlePointerDown = (e: PointerEvent): void => {
    this.pointerDownPos.set(e.clientX, e.clientY);
  };

  private handlePointerUp = (e: PointerEvent): void => {
    if (Math.hypot(e.clientX - this.pointerDownPos.x, e.clientY - this.pointerDownPos.y) > 6) return;

    this.updateNDC(e);
    this.raycaster.setFromCamera(this.pointerNDC, this.camera);

    if (this.activeStage === 'planet_select') {
      const hits = this.raycaster.intersectObjects(this.clickableProxies, false);
      if (hits.length > 0) {
        const wId = hits[0].object.userData.worldId as WorldId;
        missionAudio.playClick();
        this.focusWorld(wId);
        this.callbacks.onWorldSelect(wId);
      } else {
        this.callbacks.onWorldDeselect?.();
      }
    } else if (this.activeStage === 'orbit_insertion' && this.orbitPhase !== 'descending') {
      const hits = this.raycaster.intersectObject(this.orbitPlanetMesh, false);
      if (hits.length > 0) {
        const pt = hits[0].point;
        const deg = ((THREE.MathUtils.radToDeg(Math.atan2(pt.z, pt.x)) % 360) + 360) % 360;
        missionAudio.playSnap();
        this.selectLandingSiteAngle(deg);
      }
    } else if (
      this.activeStage === 'final_visual' &&
      this.surfacePhase === 'rover_active' &&
      this.surfaceTerrainMesh
    ) {
      const hits = this.raycaster.intersectObject(this.surfaceTerrainMesh, false);
      if (hits.length > 0) {
        const pt = hits[0].point;
        missionAudio.playClick();

        if (this.autonomousMissionActive) {
          this.autonomousMissionActive = false;
          this.systemLog = 'Görev İptal Edildi. Manuel Kontrol.';
        }

        const clickedObs = this.surfaceObstacles.find(
          (o) =>
            o.kind !== 'lander' &&
            o.kind !== 'colony' &&
            o.kind !== 'pit' &&
            Math.hypot(pt.x - o.x, pt.z - o.z) <= o.radius + 1.15
        );
        if (clickedObs) {
          this.triggerChemCamScan(clickedObs.id);
        } else {
          this.pendingScanObstacleId = null;
          this.plotShortestRoverRoute(pt.x, pt.z);
          this.systemLog = 'Rota Onaylandı. İlerliyor.';
          this.pushScienceTelemetry(true);
        }
      }
    }
  };

  private tick = (): void => {
    if (this.disposed) return;

    const dt = Math.min(0.05, this.clock.getDelta());
    const elapsed = this.clock.elapsedTime;
    this.starField.rotation.y += dt * 0.003;

    if (this.activeStage === 'start_menu' || this.activeStage === 'scenario_select') {
      this.updateStartMenu(dt, elapsed);
    } else if (this.activeStage === 'planet_select') {
      this.updateSolarSystem(dt, elapsed);
    } else if (this.activeStage === 'hangar') {
      this.updateHangar(dt, elapsed);
    } else if (this.activeStage === 'launch_pad') {
      this.updateLaunchPad(dt, elapsed);
    } else if (this.activeStage === 'journey') {
      this.updateJourney(dt, elapsed);
    } else if (this.activeStage === 'orbit_insertion') {
      this.updateOrbitInsertion(dt, elapsed);
    } else if (this.activeStage === 'final_visual') {
      this.updateFinalVisual(dt, elapsed);
    }

    if (this.composer && !this.isSoftwareGl) {
      this.composer.render();
    } else {
      this.renderer.render(this.scene, this.camera);
    }

    if (this.isSoftwareGl) {
      this.afterDraw(this.tick);
    } else {
      this.frameId = requestAnimationFrame(this.tick);
    }
  };

  private afterDraw(cb: () => void): void {
    const gl = this.renderer.getContext() as WebGL2RenderingContext;
    const sync = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
    gl.flush();
    const poll = () => {
      if (this.disposed) return;
      const state = sync && gl.getSyncParameter(sync, gl.SYNC_STATUS);
      if (state === gl.UNSIGNALED) {
        this.frameId = window.setTimeout(poll, 5);
      } else {
        if (sync) gl.deleteSync(sync);
        this.frameId = window.setTimeout(cb, 80);
      }
    };
    this.frameId = window.setTimeout(poll, 5);
  }

  private updateStartMenu(dt: number, elapsed: number): void {
    if (this.currentCommanderConfig.autoRotate && !this.userOrbiting) {
      this.astronautTurntable.rotation.y += dt * 0.34;
    }

    if (this.astronautRig && !this.astronautRig.isGlbLoaded) {
      // Subtle zero-g breathing and visor scan idle motion for procedural fallback
      this.astronautRig.upperBodyGroup.position.y = 1.12 + Math.sin(elapsed * 1.8) * 0.012;
      this.astronautRig.headGroup.rotation.y = Math.sin(elapsed * 0.9) * 0.08;
      this.astronautRig.headGroup.rotation.x = Math.sin(elapsed * 1.3) * 0.03;
      this.astronautRig.leftArmGroup.rotation.z = Math.sin(elapsed * 1.5) * 0.025;
      this.astronautRig.rightArmGroup.rotation.z = -Math.sin(elapsed * 1.5) * 0.025;
    }

    if (!this.userOrbiting && this.cameraFocusTarget && this.cameraFocusPos) {
      this.controls.target.lerp(this.cameraFocusTarget, 0.08);
      this.camera.position.lerp(this.cameraFocusPos, 0.08);
      if (this.camera.position.distanceTo(this.cameraFocusPos) < 0.08) {
        this.cameraFocusTarget = null;
        this.cameraFocusPos = null;
      }
    }
    this.controls.update();
  }

  private updateSolarSystem(dt: number, elapsed: number): void {
    this.solarSimDays += dt * this.solarTimeSpeedDaysPerSec;
    this.sunCore.rotation.y += dt * 0.06;
    if (this.earthCloudsMesh) {
      this.earthCloudsMesh.rotation.y += dt * 0.08;
    }

    for (const entry of this.planetEntries) {
      if (entry.elements && !entry.parentMesh) {
        // NASA mission-viz OrbitalPropagator.js Newton-Raphson Keplerian propagation
        const state = propagateKeplerian3D(
          entry.elements,
          this.solarSimDays,
          this.solarScaleMode
        );
        entry.mesh.position.set(state.sceneX, state.sceneY, state.sceneZ);
        entry.instantRadiusAU = state.radiusAU;
        entry.instantRadiusKm = state.radiusKm;
        entry.instantVelocityKms = state.orbitalVelocityKms;
        entry.trueAnomalyDeg = Number(
          (((THREE.MathUtils.radToDeg(state.trueAnomalyRad) % 360) + 360) % 360).toFixed(1)
        );
      } else {
        entry.angle += entry.orbitSpeed * dt * 0.22;
        const parentScale = this.solarScaleMode === 'true_astronomical_1to1' ? 0.32 : 1.0;
        const r = entry.orbitRadius * parentScale;
        entry.mesh.position.set(
          Math.cos(entry.angle) * r,
          Math.sin(entry.angle * 2) * 0.18 * parentScale,
          Math.sin(entry.angle) * r
        );
        if (entry.id === 'moon') {
          entry.instantRadiusAU = 0.00257;
          entry.instantRadiusKm = 384400;
          entry.instantVelocityKms = 1.022;
          entry.trueAnomalyDeg = ((THREE.MathUtils.radToDeg(entry.angle) % 360) + 360) % 360;
        }
      }

      // Axial rotation calibrated by sidereal rotation period
      const rotPeriodHours = entry.elements?.rotationPeriodHours ?? 24;
      const rotDir = rotPeriodHours < 0 ? -1 : 1;
      const rotSpeed = THREE.MathUtils.clamp(24 / Math.max(8, Math.abs(rotPeriodHours)), 0.15, 2.4);
      if (entry.spinGroup) {
        entry.spinGroup.rotation.y += dt * 0.28 * rotSpeed * rotDir;
      } else {
        entry.mesh.rotation.y += dt * 0.28 * rotSpeed * rotDir;
      }

      if (entry.ringHighlight && entry.glowSprite) {
        const isSel = entry.worldId === this.targetWorldId;
        const isHov = entry.worldId === this.hoveredWorldId;
        const ringMat = entry.ringHighlight.material as THREE.MeshBasicMaterial;
        const spriteMat = entry.glowSprite.material as THREE.SpriteMaterial;
        ringMat.opacity = THREE.MathUtils.damp(ringMat.opacity, isSel ? 0.68 : isHov ? 0.42 : 0, 8, dt);
        spriteMat.opacity = THREE.MathUtils.damp(spriteMat.opacity, isSel ? 0.36 : isHov ? 0.2 : 0, 8, dt);
        entry.ringHighlight.rotation.z = elapsed * 0.55;
      }
    }

    for (let i = 0; i < this.asteroidBeltData.length; i++) {
      const d = this.asteroidBeltData[i];
      d.angle += d.speed * dt;
      const sceneR = auToSceneRadius(d.radiusAU, this.solarScaleMode);
      _v1.set(
        Math.cos(d.angle) * sceneR,
        d.y + Math.sin(elapsed * 0.7 + i) * 0.12,
        Math.sin(d.angle) * sceneR * 0.96
      );
      _euler.set(elapsed * 0.35 + i, elapsed * 0.25, 0);
      _quat.setFromEuler(_euler);
      _scale.setScalar(d.scale);
      _mat4.compose(_v1, _quat, _scale);
      this.asteroidBelt.setMatrixAt(i, _mat4);
    }
    this.asteroidBelt.instanceMatrix.needsUpdate = true;

    this.pushSolarTelemetry(false);

    if (!this.userOrbiting && this.cameraFocusTarget && this.cameraFocusPos) {
      this.controls.target.lerp(this.cameraFocusTarget, 0.08);
      this.camera.position.lerp(this.cameraFocusPos, 0.06);
      if (this.camera.position.distanceTo(this.cameraFocusPos) < 0.25) {
        this.cameraFocusTarget = null;
        this.cameraFocusPos = null;
      }
    }
    this.controls.update();

    const width = this.container.clientWidth || window.innerWidth;
    const height = this.container.clientHeight || window.innerHeight;
    const labels: ProjectedLabel[] = [];
    for (const entry of this.planetEntries) {
      entry.mesh.getWorldPosition(_v1);
      const sciR = getScientificBodySceneRadius(entry.id, this.solarScaleMode);
      _v1.y += Math.max(0.6, sciR + 0.55);
      _v1.project(this.camera);
      const visible = _v1.z < 1 && _v1.z > -1;
      labels.push({
        id: entry.id,
        text: entry.label,
        x: ((_v1.x + 1) / 2) * width,
        y: (-(_v1.y - 1) / 2) * height,
        visible,
        selected: entry.worldId === this.targetWorldId,
        hovered: entry.worldId === this.hoveredWorldId,
      });
    }
    this.callbacks.onLabelsUpdate(labels);
  }


  private updateHangar(dt: number, elapsed: number): void {
    if (!this.turntablePaused) {
      this.hangarTurntable.rotation.y += dt * 0.22;
    }

    if (this.armReachTimer > 0) {
      this.armReachTimer = Math.max(0, this.armReachTimer - dt);
    }
    const reach = this.armReachTimer > 0 ? Math.sin((this.armReachTimer / 0.85) * Math.PI) : 0;
    this.leftArm.shoulder.rotation.z = -0.38 - reach * 0.28 + Math.sin(elapsed * 1.4) * 0.04;
    this.leftArm.elbow.rotation.z = 0.85 + reach * 0.3;

    if (this.hangarSnapTimer > 0) {
      this.hangarSnapTimer = Math.max(0, this.hangarSnapTimer - dt);
    }

    if (this.hangarCraftRig) {
      this.hangarCraftRig.dishGroup.rotation.y = Math.sin(elapsed * 0.85) * 0.28;
      const snapScale =
        this.hangarSnapTimer > 0
          ? 1 + Math.sin((this.hangarSnapTimer / 0.32) * Math.PI) * 0.04
          : 1;
      this.hangarCraftRig.root.scale.setScalar(0.78 * snapScale);
    }

    if (!this.userOrbiting && this.cameraFocusTarget && this.cameraFocusPos) {
      this.controls.target.lerp(this.cameraFocusTarget, 0.08);
      this.camera.position.lerp(this.cameraFocusPos, 0.08);
      if (this.camera.position.distanceTo(this.cameraFocusPos) < 0.15) {
        this.cameraFocusTarget = null;
        this.cameraFocusPos = null;
      }
    }
    this.controls.update();
  }

  private triggerLaunchEarthExplosion(impactPos: THREE.Vector3, surfaceNormal: THREE.Vector3): void {
    this.launchPhase = 'failed_crash';
    this.launchCrashTimer = 0;
    this.launchFailImpactPos.copy(impactPos);

    this.shuttleRig.root.visible = false;
    this.shuttleRig.mainFlames.visible = false;
    this.shuttleRig.srbFlames.visible = false;
    this.launchFailedTrail.visible = false;

    this.launchExplosionGroup.position.copy(impactPos);
    this.launchExplosionGroup.visible = true;
    this.launchFireball.scale.setScalar(2.0);
    (this.launchFireball.material as THREE.MeshBasicMaterial).opacity = 0.98;
    this.launchShockwave.scale.setScalar(1.05);
    this.launchShockwave.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), surfaceNormal);
    (this.launchShockwave.material as THREE.MeshBasicMaterial).opacity = 0.94;

    for (const d of this.launchDebris) {
      d.mesh.position.set(
        (Math.random() - 0.5) * 0.5,
        0.4 + Math.random() * 0.4,
        (Math.random() - 0.5) * 0.5
      );
      d.mesh.rotation.set(Math.random() * 6, Math.random() * 6, Math.random() * 6);
      const speed = 5.5 + Math.random() * 11.5;
      d.vel.set(
        (Math.random() - 0.5) * speed * 1.4,
        surfaceNormal.y * (5.5 + Math.random() * 9.5) + Math.random() * 3,
        surfaceNormal.z * (5.5 + Math.random() * 9.5) + (Math.random() - 0.5) * 8.0
      );
      d.rotVel.set(
        (Math.random() - 0.5) * 12,
        (Math.random() - 0.5) * 12,
        (Math.random() - 0.5) * 12
      );
    }

    this.launchEngineLight.position.copy(impactPos).addScaledVector(surfaceNormal, 1.5);
    this.launchEngineLight.intensity = 18;
    missionAudio.playIgnition();
    this.pushLaunchTelemetry(true);
  }

  private updateLaunchPad(dt: number, elapsed: number): void {
    // Drift overhead coastal clouds & keep sky dome centered on active camera
    for (const c of this.launchCloudSprites) {
      c.sprite.position.x = c.baseX + Math.sin(elapsed * 0.08 * c.speed + c.baseZ) * 8;
    }
    this.padSky.position.copy(this.camera.position);
    this.padSkyMat.uniforms.uTime.value = elapsed;

    // Smoothly attenuate atmospheric fog as rocket climbs into orbital vacuum
    const spaceMix = this.padSkyMat.uniforms.uSpaceMix.value;
    if (this.launchFog) {
      this.launchFog.density = 0.0014 * Math.max(0, 1 - spaceMix * 1.6);
      this.scene.fog = this.launchFog.density > 0.00002 ? this.launchFog : null;
    }

    // Adjust camera near plane smoothly with altitude & reveal stars once entering upper atmosphere/space
    this.camera.near = Math.max(0.45, Math.min(8.0, 0.45 + Math.max(0, this.shuttleY) * 0.002));
    this.camera.updateProjectionMatrix();
    this.starField.visible = spaceMix > 0.35;

    const earthCenter = _v3.set(0, -this.launchEarthRadius, 0);

    for (const p of this.smokePool) {
      if (!p.active) continue;
      p.age += dt;
      p.sprite.position.addScaledVector(p.vel, dt);
      p.vel.multiplyScalar(Math.max(0.88, 1 - dt * 0.45));
      p.sprite.scale.setScalar(p.baseScale + p.age * 4.6);
      p.sprite.material.opacity = Math.max(0, 0.78 * (1 - p.age / p.maxAge));
      if (p.age > p.maxAge) {
        p.active = false;
        p.sprite.visible = false;
      }
    }

    if (this.launchPhase === 'countdown') {
      this.countdownAccum += dt;
      const rem = Math.max(0, 5 - this.countdownAccum);
      const nextInt = Math.ceil(rem);
      if (nextInt < this.lastCountdownInt && nextInt >= 0) {
        this.lastCountdownInt = nextInt;
        missionAudio.playCountdownBeep(nextInt === 0);
      }
      if (rem <= 1.2) {
        this.launchTower.swingArm.rotation.y = THREE.MathUtils.damp(
          this.launchTower.swingArm.rotation.y,
          -1.15,
          6,
          dt
        );
      }
      if (rem <= 0.95) {
        // Water deluge & flame-trench pre-ignition steam plumes rolling out across berm
        this.spawnSmoke(true);
        if (Math.random() < 0.75) this.spawnSmoke(true);
      }
      if (rem <= 0) {
        this.launchPhase = 'liftoff';
        this.launchStageTime = 0;
        this.shuttleRig.srbFlames.visible = true;
        this.shuttleRig.mainFlames.visible = true;
        missionAudio.playIgnition();
      }
      this.pushLaunchTelemetry();
    } else if (this.launchPhase === 'liftoff') {
      // Phase 1: Liftoff & Max-Q Ascent through Earth's coastal cloud deck
      this.launchStageTime += dt;
      const passesEngine = this.currentStats.enginePasses;
      const thrustRatio = Math.min(
        1.35,
        this.currentStats.thrustKn / Math.max(1, this.currentStats.requiredThrustKn)
      );
      const accelScale = passesEngine ? 7.2 * (0.9 + thrustRatio * 0.25) : 10.5 + thrustRatio * 6.5;
      this.shuttleVelY += accelScale * dt;
      this.shuttleY += this.shuttleVelY * dt;
      if (passesEngine) {
        this.shuttleVelZ += 1.6 * dt;
        this.shuttleZ += this.shuttleVelZ * dt;
      } else {
        // Underpowered launch pitches downrange over the coastal launch area into a short near-pad arc
        this.shuttleVelZ += 12.5 * dt;
        this.shuttleZ += this.shuttleVelZ * dt;
      }

      const duration = passesEngine ? 4.2 : 1.9;
      const tNorm = Math.min(1, this.launchStageTime / duration);
      this.launchSimAltitudeKm = tNorm * (passesEngine ? 45 : 12);
      this.launchSimVelocityKmh = Math.pow(tNorm, 1.35) * (passesEngine ? 4850 : 2150);
      this.launchAccelG = passesEngine ? 1.4 + tNorm * 1.4 : 0.82 + Math.sin(elapsed * 18) * 0.08;
      this.launchFuelPct = Math.max(58, 100 - tNorm * 42);
      this.launchPitchRad = THREE.MathUtils.smoothstep(tNorm, 0.25, 1.0) * (passesEngine ? 0.16 : 0.88);

      const jitterX = !passesEngine ? Math.sin(elapsed * 20) * 0.08 : 0;
      this.shuttleRig.root.position.set(jitterX, 0.85 + this.shuttleY, this.shuttleZ);
      this.shuttleRig.root.rotation.x = this.launchPitchRad;

      const flameScale = passesEngine ? 1.0 : 0.52 + Math.random() * 0.22;
      this.shuttleRig.srbFlames.scale.set(
        flameScale,
        flameScale * (0.9 + Math.sin(elapsed * 42) * 0.14),
        flameScale
      );
      this.shuttleRig.mainFlames.scale.set(
        flameScale,
        flameScale * (0.9 + Math.sin(elapsed * 48) * 0.12),
        flameScale
      );

      this.launchEngineLight.position.set(0, this.shuttleY + 0.6, this.shuttleZ);
      this.launchEngineLight.intensity = (passesEngine ? 7.8 : 4.8) + Math.sin(elapsed * 45) * 1.4;
      if (this.launchLagoonReflection) {
        const reflMat = this.launchLagoonReflection.material as THREE.MeshBasicMaterial;
        reflMat.opacity = Math.max(0.18, 0.68 - this.shuttleY * 0.012);
      }

      if (this.shuttleY < 28) {
        this.spawnSmoke(true);
        if (this.shuttleY < 14) this.spawnSmoke(true);
      }

      this.padSkyMat.uniforms.uSpaceMix.value = Math.min(
        passesEngine ? 0.42 : 0.28,
        tNorm * (passesEngine ? 0.42 : 0.28)
      );

      // Safety check: if underpowered rocket ever descends onto Earth mid-liftoff, explode instantly on contact
      if (this.launchStageTime > 0.6 && this.shuttleVelY < 0) {
        const liftoffHit = this.checkRocketEarthImpact(this.shuttleRig.root, earthCenter);
        if (liftoffHit.collided) {
          this.triggerLaunchEarthExplosion(liftoffHit.contactPoint, liftoffHit.surfaceNormal);
        }
      }

      this.pushLaunchTelemetry();

      if (tNorm >= 1) {
        if (!passesEngine) {
          // Thrust insufficient! Short curved arc near the launch site & coast at normal physical fall speed
          this.launchPhase = 'failed_arc';
          this.launchStageTime = 0;
          const rx = this.shuttleRig.root.position.y - earthCenter.y;
          const rz = this.shuttleRig.root.position.z - earthCenter.z;
          const r0 = Math.hypot(rx, rz);
          this.launchFailStartTheta = Math.atan2(rz, rx);
          this.launchFailStartAlt = Math.max(16, r0 - this.launchEarthRadius);
          this.launchFailPeakAlt = this.launchFailStartAlt + 22;
          const deltaTheta = 0.0022 + (1 - Math.min(1, thrustRatio)) * 0.0008;
          this.launchFailEndTheta = this.launchFailStartTheta + deltaTheta;
          this.launchFailDuration = 2.4;
          this.launchFailPrevPos.copy(this.shuttleRig.root.position);

          // Plot curved trajectory trail hugging Earth's curvature right to impact near launch zone
          const linePos = this.launchFailedTrail.geometry.attributes.position as THREE.BufferAttribute;
          for (let i = 0; i <= 60; i++) {
            this.evalFailArcPoint(i / 60, _v1);
            linePos.setXYZ(i, _v1.x, _v1.y, _v1.z);
          }
          linePos.needsUpdate = true;
          this.launchFailedTrail.computeLineDistances();
          this.launchFailedTrail.visible = true;
          this.pushLaunchTelemetry(true);
        } else {
          this.launchPhase = 'srb_sep';
          this.launchStageTime = 0;
          this.shuttleRig.srbFlames.visible = false;
          missionAudio.playSnap();
          this.pushLaunchTelemetry(true);
        }
      }
    } else if (this.launchPhase === 'failed_arc') {
      // Short Near-Pad Curved Fall (~2.4s) with sub-stepped exact contact detection so rocket explodes on first touch
      const subSteps = 4;
      const subDt = dt / subSteps;
      let impacted = false;

      for (let s = 0; s < subSteps; s++) {
        this.launchStageTime += subDt;
        const arcT = this.launchStageTime / this.launchFailDuration;

        this.evalFailArcPoint(arcT, _v1);
        this.evalFailArcPoint(arcT + 0.008, _v2);

        const jitterX = Math.sin((elapsed - (subSteps - 1 - s) * subDt) * 14) * 0.05;
        this.shuttleRig.root.position.set(jitterX, _v1.y, _v1.z);
        this.shuttleY = _v1.y - 0.85;
        this.shuttleZ = _v1.z;

        // Align rocket nose smoothly along instantaneous curved velocity tangent
        _v4.copy(_v2).sub(_v1).normalize();
        this.shuttleRig.root.quaternion.setFromUnitVectors(_upAxis, _v4);
        this.shuttleRig.root.rotateY((elapsed - (subSteps - 1 - s) * subDt) * 0.65);

        const hullCheck = this.checkRocketEarthImpact(this.shuttleRig.root, earthCenter);
        if (hullCheck.collided) {
          this.shuttleY = this.shuttleRig.root.position.y - 0.85;
          this.shuttleZ = this.shuttleRig.root.position.z;
          this.triggerLaunchEarthExplosion(hullCheck.contactPoint, hullCheck.surfaceNormal);
          impacted = true;
          break;
        }
      }

      if (!impacted) {
        const arcT = this.launchStageTime / this.launchFailDuration;
        const flicker = arcT < 0.35 ? 0.38 + Math.random() * 0.24 : 0.14 + Math.random() * 0.1;
        this.shuttleRig.mainFlames.scale.set(flicker, flicker, flicker);
        this.shuttleRig.srbFlames.scale.set(flicker * 0.65, flicker * 0.65, flicker * 0.65);

        const altitudeUnits = Math.max(
          0,
          this.shuttleRig.root.position.distanceTo(earthCenter) - this.launchEarthRadius
        );
        this.padSkyMat.uniforms.uSpaceMix.value = THREE.MathUtils.clamp(altitudeUnits / 360, 0.08, 0.88);
        this.launchSimAltitudeKm = Math.max(0, Math.round(altitudeUnits * 0.085));
        const speedUnitsPerSec = this.shuttleRig.root.position.distanceTo(this.launchFailPrevPos) / Math.max(0.001, dt);
        this.launchFailPrevPos.copy(this.shuttleRig.root.position);
        this.launchSimVelocityKmh = Math.round(3200 + speedUnitsPerSec * 4.2);
        this.launchAccelG = Number(Math.max(0.15, 0.55 - arcT * 0.35).toFixed(1));
        this.launchFuelPct = Math.max(12, Math.round(58 - arcT * 46));
        this.launchEngineLight.position.copy(this.shuttleRig.root.position);
        this.pushLaunchTelemetry();
      }
    } else if (this.launchPhase === 'failed_crash') {
      // Explosion & shattered wreckage bouncing strictly on TOP of solid Earth sphere
      this.launchCrashTimer += dt;
      const t = this.launchCrashTimer;
      const fireScale = 2.0 + Math.min(14.5, t * 10.5);
      this.launchFireball.scale.setScalar(fireScale);
      (this.launchFireball.material as THREE.MeshBasicMaterial).opacity = Math.max(
        0,
        0.98 - t * 0.44
      );

      const waveScale = 1.1 + t * 18.0;
      this.launchShockwave.scale.setScalar(waveScale);
      (this.launchShockwave.material as THREE.MeshBasicMaterial).opacity = Math.max(
        0,
        0.92 - t * 0.52
      );

      this.launchEngineLight.intensity = Math.max(0, 18 - t * 9.0);

      const expPos = this.launchExplosionGroup.position;
      for (const d of this.launchDebris) {
        _v1.copy(expPos).add(d.mesh.position).sub(earthCenter).normalize();
        d.vel.addScaledVector(_v1, -9.81 * dt);

        _v2.copy(expPos).add(d.mesh.position).addScaledVector(d.vel, dt);
        const bounced = this.resolveSolidSphereCollision(
          _v2,
          d.vel,
          earthCenter,
          this.launchEarthRadius,
          0.35,
          0.42
        );
        if (bounced) {
          d.vel.multiplyScalar(0.84);
        }
        d.mesh.position.copy(_v2).sub(expPos);
        d.mesh.rotation.x += d.rotVel.x * dt;
        d.mesh.rotation.y += d.rotVel.y * dt;
        d.mesh.rotation.z += d.rotVel.z * dt;
      }

      if (t >= 1.35 && !this.launchFailTriggered) {
        this.launchFailTriggered = true;
        this.callbacks.onMissionFailed?.({
          reason: 'underpowered_engine',
          title: 'MISSION FAILED',
          subtitle: 'EARTH IMPACT — ROCKET EXPLODED ON CONTACT',
          detail: `Selected engine produced ${this.currentStats.thrustKn.toLocaleString()} kN, below the NASA required ${this.currentStats.requiredThrustKn.toLocaleString()} kN (TWR ${this.currentStats.launchTwr.toFixed(
            2
          )}× < 1.25×). The rocket entered a shallow suborbital arc around Earth, lost altitude, and exploded upon touching the surface.`,
        });
      }
    } else if (this.launchPhase === 'srb_sep') {
      // Sketch 2: Climb high above Earth's curved horizon while SRBs separate
      this.launchStageTime += dt;
      const tNorm = Math.min(1, this.launchStageTime / 3.4);

      this.shuttleVelY += 175 * dt;
      this.shuttleVelZ += 48 * dt;
      this.shuttleY += this.shuttleVelY * dt;
      this.shuttleZ += this.shuttleVelZ * dt;
      this.launchSimAltitudeKm = 45 + tNorm * 70;
      this.launchSimVelocityKmh = 4850 + Math.pow(tNorm, 1.15) * (27800 - 4850);
      this.launchAccelG = 1.6 + tNorm * 1.4;
      this.launchFuelPct = Math.max(24, 58 - tNorm * 34);
      this.launchPitchRad = THREE.MathUtils.lerp(0.16, 0.34, tNorm);

      // Twin SRBs separate laterally and tumble downward
      const baseSrbX = this.shuttleRig.srbOffsetX;
      this.srbSepDist += dt * 1.45;
      this.srbSepDrop += dt * (2.6 + this.launchStageTime * 2.4);
      this.srbSepRot += dt * 0.62;
      this.shuttleRig.srbLeft.position.set(
        -baseSrbX - this.srbSepDist,
        0.1 - this.srbSepDrop,
        -0.12
      );
      this.shuttleRig.srbLeft.rotation.z = this.srbSepRot;
      this.shuttleRig.srbRight.position.set(
        baseSrbX + this.srbSepDist,
        0.1 - this.srbSepDrop,
        -0.12
      );
      this.shuttleRig.srbRight.rotation.z = -this.srbSepRot;

      this.shuttleRig.root.position.set(0, 0.85 + this.shuttleY, this.shuttleZ);
      this.shuttleRig.root.rotation.x = this.launchPitchRad;
      this.shuttleRig.mainFlames.scale.set(1, 0.92 + Math.sin(elapsed * 48) * 0.14, 1);

      this.launchEngineLight.position.set(0, this.shuttleY + 0.6, this.shuttleZ);
      this.launchEngineLight.intensity = 4.2 + Math.sin(elapsed * 45) * 0.9;

      this.padSkyMat.uniforms.uSpaceMix.value = Math.min(1, 0.42 + tNorm * 0.58);
      this.launchTargetPlanet.visible = false;
      this.launchSepDashLine.visible = false;
      this.launchStarStreaks.visible = tNorm > 0.35;
      this.launchStarStreaks.position.set(0, this.shuttleY - 30, this.shuttleZ - 20);

      this.pushLaunchTelemetry();

      if (tNorm >= 1) {
        this.launchPhase = 'tank_sep';
        this.launchStageTime = 0;
        missionAudio.playSnap();
        this.pushLaunchTelemetry(true);
      }
    } else if (this.launchPhase === 'tank_sep') {
      // Sketch 3: Above curved Earth horizon, pitch & roll so dorsal bay faces straight UP (+Y) toward overhead camera
      this.launchStageTime += dt;
      const tNorm = Math.min(1, this.launchStageTime / 2.6);

      this.shuttleY += dt * 48;
      this.shuttleZ += dt * 65;
      this.launchSimAltitudeKm = 115 + tNorm * 45;
      this.launchSimVelocityKmh = 27800 + tNorm * 3400;
      this.launchAccelG = 1.9;
      this.launchFuelPct = Math.max(10, 24 - tNorm * 14);
      this.launchPitchRad = THREE.MathUtils.lerp(
        0.34,
        Math.PI / 2,
        THREE.MathUtils.smoothstep(tNorm, 0.0, 0.92)
      );
      const rollRad = THREE.MathUtils.smoothstep(tNorm, 0.06, 0.82) * Math.PI;

      this.shuttleRig.root.position.set(0, 0.85 + this.shuttleY, this.shuttleZ);
      this.shuttleRig.root.quaternion
        .setFromAxisAngle(_xAxis, this.launchPitchRad)
        .multiply(_quat.setFromAxisAngle(_upAxis, rollRad));
      this.shuttleRig.mainFlames.visible = true;
      this.shuttleRig.mainFlames.scale.set(1, 0.95 + Math.sin(elapsed * 52) * 0.14, 1);

      this.padSkyMat.uniforms.uSpaceMix.value = 1;
      this.launchTargetPlanet.visible = true;
      this.launchTargetPlanet.scale.setScalar(0.55);
      this.launchTargetPlanet.position.set(0, 0.85 + this.shuttleY + 10.5, this.shuttleZ + 42.0);
      this.launchTargetPlanet.rotation.y += dt * 0.16;
      this.launchSepDashLine.visible = false;
      this.launchStarStreaks.visible = true;
      this.launchStarStreaks.position.set(0, this.shuttleY - 30, this.shuttleZ - 20);

      this.pushLaunchTelemetry();

      if (tNorm >= 1) {
        this.launchPhase = 'satellite_sep';
        this.launchStageTime = 0;
        missionAudio.playSnap();
        this.pushLaunchTelemetry(true);
      }
    } else if (this.launchPhase === 'satellite_sep') {
      // Sketch 4 (0..0.48: pure overhead top-down close-up of carrier dorsal bay) -> Sketch 5 (0.48..1.0: pure overhead top-down two-shot + dashed line to target planet)
      this.launchStageTime += dt;
      const tNorm = Math.min(1, this.launchStageTime / 5.4);
      const coastFactor = 1 - 0.35 * THREE.MathUtils.smoothstep(tNorm, 0.15, 0.9);
      this.shuttleY += dt * 18 * coastFactor;
      this.shuttleZ += dt * 55 * coastFactor;
      // Keep carrier horizontal (nose along +Z, open dorsal bay facing straight UP along +Y toward overhead camera)
      this.launchPitchRad = Math.PI / 2;

      // Ensure SRBs remain hidden after booster separation so Orbiter separates cleanly from its External Tank
      this.shuttleRig.srbLeft.visible = false;
      this.shuttleRig.srbRight.visible = false;

      // NASA Space Shuttle Orbiter separates from the External Tank struts forward (+Z world) & screen-right (+X local = -X world)
      const undockT = THREE.MathUtils.smoothstep(tNorm, 0.08, 0.52);
      const accelRaw = THREE.MathUtils.clamp((tNorm - 0.38) / 0.62, 0, 1);
      const boostT = accelRaw * accelRaw * (1.25 - 0.25 * accelRaw);
      const dorsalLift = THREE.MathUtils.smoothstep(tNorm, 0.08, 0.48) * 0.45;
      const curveRight = THREE.MathUtils.smoothstep(tNorm, 0.12, 0.78) * 1.95;
      this.satSepDist = undockT * 1.5 + boostT * 3.1;

      this.shuttleRig.payloadMount.position.set(
        curveRight,
        this.shuttleRig.payloadRestY + this.satSepDist,
        0.84 + dorsalLift
      );
      // Yaw smoothly in the dorsal plane (around local Z = World +Y) during separation then align toward Target Planet
      const exitCurveSin = Math.sin(THREE.MathUtils.clamp((tNorm - 0.12) / 0.64, 0, 1) * Math.PI);
      this.shuttleRig.payloadMount.rotation.set(0, 0, -exitCurveSin * 0.24);

      // Smooth ion plume ignition ramp
      const igniteT = THREE.MathUtils.smoothstep(tNorm, 0.24, 0.50);
      if (igniteT > 0.01) {
        this.shuttleRig.craftFlame.visible = true;
        const pScale = 0.06 + igniteT * 1.05;
        this.shuttleRig.craftFlame.scale.set(
          pScale,
          pScale * (0.9 + Math.sin(elapsed * 42) * 0.14),
          pScale
        );
      } else {
        this.shuttleRig.craftFlame.visible = false;
      }

      // Smooth carrier MECO throttle down
      const mecoFade = 1 - THREE.MathUtils.smoothstep(tNorm, 0.0, 0.22);
      if (mecoFade > 0.02) {
        this.shuttleRig.mainFlames.visible = true;
        const mf = 0.85 * mecoFade;
        this.shuttleRig.mainFlames.scale.set(mf, mf * (0.88 + Math.sin(elapsed * 40) * 0.1), mf);
      } else {
        this.shuttleRig.mainFlames.visible = false;
      }

      this.launchSimAltitudeKm = Math.min(185, 160 + tNorm * 25);
      this.launchSimVelocityKmh = Math.round(31200 + this.satSepDist * 650);
      this.launchAccelG = Number((0.4 + igniteT * 1.2).toFixed(1));

      this.shuttleRig.root.position.set(0, 0.85 + this.shuttleY, this.shuttleZ);
      this.shuttleRig.root.quaternion
        .setFromAxisAngle(_xAxis, this.launchPitchRad)
        .multiply(_quat.setFromAxisAngle(_upAxis, Math.PI));

      const sketch5T = THREE.MathUtils.smoothstep(tNorm, 0.44, 0.90);
      this.launchTargetPlanet.visible = tNorm > 0.42;
      this.launchTargetPlanet.scale.setScalar(THREE.MathUtils.lerp(0.22, 0.18, sketch5T));
      this.launchTargetPlanet.position.set(
        -2.45,
        0.85 + this.shuttleY + 1.5,
        this.shuttleZ + 14.2
      );
      this.launchTargetPlanet.rotation.y += dt * 0.18;

      // Dashed trajectory line from separated small ship straight ahead to Target Planet (Sketch 5)
      const dashAlpha = THREE.MathUtils.smoothstep(tNorm, 0.48, 0.78);
      if (dashAlpha > 0.01) {
        this.launchSepDashLine.visible = true;
        (this.launchSepDashLine.material as THREE.LineDashedMaterial).opacity = dashAlpha * 0.88;
        this.shuttleRig.payloadMount.getWorldPosition(_v1);
        _v2.copy(this.launchTargetPlanet.position);
        const posAttr = this.launchSepDashLine.geometry.attributes.position as THREE.BufferAttribute;
        for (let i = 0; i <= 24; i++) {
          const u = THREE.MathUtils.lerp(0.14, 0.78, i / 24);
          posAttr.setXYZ(
            i,
            THREE.MathUtils.lerp(_v1.x, _v2.x, u),
            THREE.MathUtils.lerp(_v1.y, _v2.y, u),
            THREE.MathUtils.lerp(_v1.z, _v2.z, u)
          );
        }
        posAttr.needsUpdate = true;
        this.launchSepDashLine.computeLineDistances();
      } else {
        this.launchSepDashLine.visible = false;
      }

      this.launchStarStreaks.visible = true;
      this.launchStarStreaks.position.set(0, this.shuttleY - 30, this.shuttleZ - 20);

      this.resolveRocketHullPlanetCollision(this.shuttleRig.root, earthCenter, this.launchEarthRadius, 1.4);
      this.resolveRocketHullPlanetCollision(
        this.shuttleRig.root,
        this.launchTargetPlanet.position,
        1.5,
        1.2
      );

      this.pushLaunchTelemetry();

      if (tNorm >= 1) {
        missionAudio.playSuccess();
        this.callbacks.onLaunchComplete();
        return;
      }
    }

    // Dynamic Camera Framing (frames lagoon/shore/towers/full rocket on pad, and medium-close view of rocket + Earth curvature during fall!)
    if (this.launchPhase === 'failed_arc') {
      const arcT = Math.min(1, this.launchStageTime / this.launchFailDuration);
      this.evalFailArcPoint(arcT, _v4);
      this.evalFailArcPoint(arcT + 0.008, _v5);
      // Local spherical Earth frame around earthCenter so curving horizon stays naturally upright
      const localUp = _v6.copy(_v4).sub(earthCenter).normalize();
      const localFwd = _v5.sub(_v4).normalize();
      const localRight = _v2.crossVectors(localUp, localFwd).normalize(); // +X side matches pad/liftoff camera

      // Closer medium-range tracking offset (tightens smoothly as rocket nears Earth surface)
      const rightDist = THREE.MathUtils.lerp(11.2, 9.2, arcT);
      const upDist = THREE.MathUtils.lerp(4.0, 3.5, arcT);
      const backDist = THREE.MathUtils.lerp(-9.8, -8.2, arcT);

      this.camera.up.lerp(localUp, 1 - Math.exp(-6 * dt)).normalize();
      const camDest = _v1
        .copy(_v4)
        .addScaledVector(localRight, rightDist)
        .addScaledVector(localUp, upDist)
        .addScaledVector(localFwd, backDist);
      this.camera.position.x = THREE.MathUtils.damp(this.camera.position.x, camDest.x, 6.2, dt);
      this.camera.position.y = THREE.MathUtils.damp(this.camera.position.y, camDest.y, 6.2, dt);
      this.camera.position.z = THREE.MathUtils.damp(this.camera.position.z, camDest.z, 6.2, dt);
      const lookDest = _v4.addScaledVector(localFwd, 2.2).addScaledVector(localUp, -1.5);
      this.camera.lookAt(lookDest);
    } else if (this.launchPhase === 'failed_crash') {
      const shake = Math.max(0, 0.65 - this.launchCrashTimer * 0.35);
      const localUp = _v6.copy(this.launchFailImpactPos).sub(earthCenter).normalize();
      const localFwd = _v5.set(0, -localUp.z, localUp.y).normalize();
      const localRight = _v4.crossVectors(localUp, localFwd).normalize();
      this.camera.up.lerp(localUp, 1 - Math.exp(-8 * dt)).normalize();
      _v2.copy(this.launchFailImpactPos);
      _v1
        .copy(_v2)
        .addScaledVector(localRight, 10.2 + Math.sin(elapsed * 48) * shake)
        .addScaledVector(localUp, 5.2 + Math.cos(elapsed * 52) * shake)
        .addScaledVector(localFwd, -9.2);
      this.camera.position.lerp(_v1, 0.16);
      this.camera.lookAt(_v2);
    } else if (this.launchPhase === 'tank_sep' || this.launchPhase === 'satellite_sep') {
      // Horizon-level 3/4 orbital chase camera (camera.up = (0, 1, 0)) that frames the curved blue Earth below,
      // the separating carrier booster to the lower-left, and the spacecraft accelerating toward the target planet,
      // matching the initial camera angle of Stage 4 (Journey) with zero jump cut!
      this.camera.up.lerp(_upAxis, 1 - Math.exp(-8.0 * dt)).normalize();

      if (this.launchPhase === 'tank_sep') {
        const tankT = THREE.MathUtils.smoothstep(Math.min(1, this.launchStageTime / 2.6), 0.05, 0.96);
        _v4.set(
          THREE.MathUtils.lerp(5.2, 8.8, tankT),
          THREE.MathUtils.lerp(4.2, 4.6, tankT),
          THREE.MathUtils.lerp(18.0, -5.2, tankT)
        );
        _v6.set(
          THREE.MathUtils.lerp(0.4, 0.2, tankT),
          THREE.MathUtils.lerp(2.2, 1.2, tankT),
          THREE.MathUtils.lerp(5.0, 6.5, tankT)
        );
        this.launchCamOffset.x = THREE.MathUtils.damp(this.launchCamOffset.x, _v4.x, 5.2, dt);
        this.launchCamOffset.y = THREE.MathUtils.damp(this.launchCamOffset.y, _v4.y, 5.2, dt);
        this.launchCamOffset.z = THREE.MathUtils.damp(this.launchCamOffset.z, _v4.z, 5.2, dt);
        this.launchLookOffset.x = THREE.MathUtils.damp(this.launchLookOffset.x, _v6.x, 5.8, dt);
        this.launchLookOffset.y = THREE.MathUtils.damp(this.launchLookOffset.y, _v6.y, 5.8, dt);
        this.launchLookOffset.z = THREE.MathUtils.damp(this.launchLookOffset.z, _v6.z, 5.8, dt);
      } else {
        const sepT = Math.min(1, this.launchStageTime / 5.4);
        const chaseT = THREE.MathUtils.smoothstep(sepT, 0.0, 0.85);
        _v4.set(
          THREE.MathUtils.lerp(8.8, 10.4, chaseT),
          THREE.MathUtils.lerp(4.6, 4.2, chaseT),
          THREE.MathUtils.lerp(-5.2, -3.4, chaseT)
        );
        _v6.set(
          THREE.MathUtils.lerp(0.2, -0.8, chaseT),
          THREE.MathUtils.lerp(1.2, 1.35, chaseT),
          THREE.MathUtils.lerp(6.5, 8.8, chaseT)
        );
        this.launchCamOffset.x = THREE.MathUtils.damp(this.launchCamOffset.x, _v4.x, 6.5, dt);
        this.launchCamOffset.y = THREE.MathUtils.damp(this.launchCamOffset.y, _v4.y, 6.5, dt);
        this.launchCamOffset.z = THREE.MathUtils.damp(this.launchCamOffset.z, _v4.z, 6.5, dt);
        this.launchLookOffset.x = THREE.MathUtils.damp(this.launchLookOffset.x, _v6.x, 6.5, dt);
        this.launchLookOffset.y = THREE.MathUtils.damp(this.launchLookOffset.y, _v6.y, 6.5, dt);
        this.launchLookOffset.z = THREE.MathUtils.damp(this.launchLookOffset.z, _v6.z, 6.5, dt);
      }
      this.camera.position.copy(this.shuttleRig.root.position).add(this.launchCamOffset);
      this.camera.lookAt(_v2.copy(this.shuttleRig.root.position).add(this.launchLookOffset));
    } else {
      this.camera.up.set(0, 1, 0);
      const isFailingLiftoff = this.launchPhase === 'liftoff' && !this.currentStats.enginePasses;
      const isSrbClimb = this.launchPhase === 'srb_sep';
      const srbNorm = isSrbClimb ? Math.min(1, this.launchStageTime / 3.4) : 0;
      const pull = isSrbClimb ? 4.5 + srbNorm * 5.0 : Math.min(5.0, this.shuttleY * 0.08);
      const offX = isFailingLiftoff
        ? 5.2 + Math.min(5.2, this.shuttleY * 0.22)
        : isSrbClimb
        ? THREE.MathUtils.lerp(5.2, 3.8, srbNorm)
        : 5.2 + Math.min(4.0, this.shuttleY * 0.05);
      const offY = isSrbClimb
        ? 4.55 + THREE.MathUtils.lerp(-1.2, 3.8, THREE.MathUtils.smoothstep(srbNorm, 0.0, 0.9))
        : 2.75;
      const offZ = isFailingLiftoff
        ? Math.max(14.5, 33.5 - this.shuttleY * 0.65)
        : 33.5 + pull;
      _v4.set(offX, offY, offZ);
      _v6.set(
        isSrbClimb ? 0.4 : 1.5,
        isSrbClimb ? 4.55 - THREE.MathUtils.lerp(0.0, 2.2, srbNorm) : 4.95,
        0
      );
      this.launchCamOffset.x = THREE.MathUtils.damp(this.launchCamOffset.x, _v4.x, 5.5, dt);
      this.launchCamOffset.y = THREE.MathUtils.damp(this.launchCamOffset.y, _v4.y, 5.5, dt);
      this.launchCamOffset.z = THREE.MathUtils.damp(this.launchCamOffset.z, _v4.z, 5.5, dt);
      this.launchLookOffset.x = THREE.MathUtils.damp(this.launchLookOffset.x, _v6.x, 5.5, dt);
      this.launchLookOffset.y = THREE.MathUtils.damp(this.launchLookOffset.y, _v6.y, 5.5, dt);
      this.launchLookOffset.z = THREE.MathUtils.damp(this.launchLookOffset.z, _v6.z, 5.5, dt);
      this.camera.position.copy(this.shuttleRig.root.position).add(this.launchCamOffset);
      this.camera.lookAt(_v2.copy(this.shuttleRig.root.position).add(this.launchLookOffset));
    }
  }

  private updateJourney(dt: number, elapsed: number): void {
    const baseRate =
      this.journeySpeedMultiplier === 10000
        ? 0.45
        : this.journeySpeedMultiplier === 2000
        ? 0.19
        : this.journeySpeedMultiplier === 1000
        ? 0.095
        : 0.024;

    const world = WORLDS[this.targetWorldId];
    const transitBefore = evaluateHohmannTransitState(this.targetWorldId, this.journeyProgress);
    const meanV = Math.max(
      0.5,
      (world.hohmannSummary.vDepartureKms + world.hohmannSummary.vArrivalKms) * 0.5
    );
    // Kepler's 2nd Law & Vis-Viva velocity modulation: faster near periapsis, slower near apoapsis
    const keplerRateFactor = THREE.MathUtils.clamp(
      transitBefore.instantVelocityKms / meanV,
      0.72,
      1.38
    );
    const rate = baseRate * keplerRateFactor;

    const pCenter = this.journeyTargetPlanet.position;
    this.journeyTargetPlanet.rotation.y += dt * 0.25;

    // Insufficient Fuel Simulation: Burns out mid-transit -> Craft drifts lost into empty deep space -> MISSION FAILED!
    if (this.journeyFuelExhausted) {
      this.journeyLostTimer += dt;
      const driftScale =
        this.journeySpeedMultiplier === 10000
          ? 2.2
          : this.journeySpeedMultiplier === 2000
          ? 1.55
          : 1.0;

      this.journeyCraft.position.addScaledVector(this.journeyLostVel, dt * driftScale);
      // Solid planet boundaries: out-of-fuel spacecraft can never clip through Origin Earth or Destination Planet!
      this.resolveSolidSphereCollision(
        this.journeyCraft.position,
        this.journeyLostVel,
        this.journeyOriginPlanetPos,
        5.6,
        1.75,
        0.35
      );
      this.resolveSolidSphereCollision(
        this.journeyCraft.position,
        this.journeyLostVel,
        pCenter,
        5.2,
        1.75,
        0.35
      );

      this.journeyCraft.rotation.x += dt * 0.42;
      this.journeyCraft.rotation.y += dt * 0.65;
      this.journeyCraft.rotation.z += dt * 0.28;
      this.journeySatFlame.visible = false;

      // Pure top-down overhead view lingers directly above the unpowered spacecraft drifting in deep space
      this.camera.up.set(0, 0, -1);
      _v1.set(
        this.journeyCraft.position.x,
        this.journeyCraft.position.y + 18.5 + this.journeyLostTimer * 1.8,
        this.journeyCraft.position.z + 1.2
      );
      this.camera.position.lerp(_v1, 0.08);
      this.camera.lookAt(this.journeyCraft.position);

      if (this.journeyLostTimer >= 3.1 && !this.journeyFailTriggered) {
        this.journeyFailTriggered = true;
        this.callbacks.onMissionFailed?.({
          reason: 'out_of_fuel',
          title: 'MISSION FAILED',
          subtitle: 'PROPELLANT DEPLETED — VEHICLE LOST IN DEEP SPACE',
          detail: `Your spacecraft carried ${this.currentStats.fuelMassKg.toLocaleString()} kg of cryo propellant, short of the NASA Tsiolkovsky required ${this.currentStats.requiredFuelKg.toLocaleString()} kg for ${world.name} (${world.transferDeltaVKms} km/s Δv). Fuel exhausted mid-transit and the vehicle drifted off-course into deep space.`,
        });
      }
      return;
    }

    this.journeyProgress = Math.min(1, this.journeyProgress + dt * rate);
    this.callbacks.onJourneyProgress(Math.round(this.journeyProgress * 100));

    const transitState = evaluateHohmannTransitState(this.targetWorldId, this.journeyProgress);
    const now = performance.now();
    if (now - this.lastJourneyTransitPush > 60 || this.journeyProgress >= 1) {
      this.lastJourneyTransitPush = now;
      this.callbacks.onJourneyTransitUpdate?.(transitState);
    }

    // Track live remaining propellant (%)
    const fuelPasses = this.currentStats.fuelPasses;
    const burnoutT = this.currentStats.fuelRatio <= 0.8 ? 0.44 : 0.6;
    if (!fuelPasses) {
      const remPct = Math.max(0, Math.round((1 - this.journeyProgress / burnoutT) * 100));
      if (remPct !== this.lastJourneyFuelPct) {
        this.lastJourneyFuelPct = remPct;
        this.callbacks.onJourneyFuelUpdate?.(remPct);
      }

      if (this.journeyProgress >= burnoutT) {
        // Trigger deep-space fuel depletion right mid-transfer!
        this.journeyFuelExhausted = true;
        this.journeyLostTimer = 0;
        this.journeySatFlame.visible = false;
        this.callbacks.onJourneyFuelUpdate?.(0);
        missionAudio.playSnap();

        const curveT = Math.min(0.95, this.journeyProgress / 0.72);
        const tangent = this.journeyCurve.getTangentAt(curveT).normalize();
        // Deflect slightly in the horizontal orbital plane away from target planet
        this.journeyLostVel.copy(tangent).multiplyScalar(7.5).add(new THREE.Vector3(-2.4, 0, -1.5));
        return;
      }
    } else {
      const reserveFloor = Math.max(12, Math.round((1 - 0.88 / this.currentStats.fuelRatio) * 100));
      const remPct = Math.round(THREE.MathUtils.lerp(100, reserveFloor, this.journeyProgress));
      if (remPct !== this.lastJourneyFuelPct) {
        this.lastJourneyFuelPct = remPct;
        this.callbacks.onJourneyFuelUpdate?.(remPct);
      }
    }

    const CAPTURE_T = 0.72;
    const ENTRY_ANGLE = Math.PI * 1.12;
    const ORBIT_SWEEP = 2.35;
    const ORBIT_R = 8.8;

    // 1. Continuous Carrier Booster Recession in Earth Departure Orbit (0% -> 32%)
    const p0 = this.journeyCurve.getPointAt(0);
    if (this.journeyProgress < 0.32) {
      this.journeyCarrierGroup.visible = true;
      const sepEase = THREE.MathUtils.smoothstep(this.journeyProgress, 0.0, 0.30);
      const shrinkT = THREE.MathUtils.smoothstep(this.journeyProgress, 0.14, 0.32);
      this.journeyCarrierGroup.rotation.set(-Math.PI / 2, -0.25, 0);
      this.journeyCarrierGroup.position.set(
        p0.x - 2.6 - sepEase * 1.8,
        p0.y - 0.55 - sepEase * 0.45,
        p0.z + 3.8 + sepEase * 4.8
      );
      this.journeyCarrierGroup.scale.setScalar(THREE.MathUtils.lerp(0.92, 0.68, shrinkT));
    } else {
      this.journeyCarrierGroup.visible = false;
    }

    // Smooth scale-up from separation scale (0.76) to deep-space cruise scale (0.88)
    const satCruiseScale = THREE.MathUtils.lerp(
      0.76,
      0.88,
      THREE.MathUtils.smoothstep(this.journeyProgress, 0.0, 0.12)
    );
    this.journeySatGroup.scale.setScalar(satCruiseScale);
    // Keep spacecraft strictly aligned with its prograde orbital tangent (zero self-spin)
    this.journeySatGroup.rotation.set(0, 0, 0);

    // 2. Elliptical Hohmann Trajectory & C1-Tangent Orbit Capture Orientation
    this.journeyCraft.up.set(0, 1, 0);
    if (this.journeyProgress <= CAPTURE_T) {
      const curveT = this.journeyProgress / CAPTURE_T;
      const pt = this.journeyCurve.getPointAt(curveT);
      this.journeyCraft.position.copy(pt);
      _v7.copy(this.journeyCurve.getTangentAt(Math.min(1, curveT))).normalize();

      // Look strictly along the instantaneous tangent vector _v7 (which is C1-continuous with the orbit ring at curveT = 1)
      _v3.copy(pt).addScaledVector(_v7, 4.0);
      const prevQ = _quat.copy(this.journeyCraft.quaternion);
      this.journeyCraft.lookAt(_v3);
      this.journeyTargetQuat.copy(this.journeyCraft.quaternion);
      this.journeyCraft.quaternion.copy(prevQ).slerp(this.journeyTargetQuat, 1 - Math.exp(-12 * dt));

      // TLI/TMI departure burn (0 -> 0.22) and orbital approach thruster burn (0.64 -> 0.72)
      const isDepartureBurn = this.journeyProgress < 0.24;
      const isPreCaptureBurn = this.journeyProgress >= 0.64;
      if (isDepartureBurn || isPreCaptureBurn) {
        const flameRamp = isDepartureBurn
          ? THREE.MathUtils.smoothstep(this.journeyProgress, 0.0, 0.08) *
            (1 - THREE.MathUtils.smoothstep(this.journeyProgress, 0.16, 0.24))
          : THREE.MathUtils.smoothstep(this.journeyProgress, 0.64, 0.72);
        const f = (0.38 + flameRamp * 0.72) * (0.86 + Math.sin(elapsed * 30) * 0.14);
        this.journeySatFlame.visible = f > 0.08;
        this.journeySatFlame.scale.set(0.45 + flameRamp * 0.55, f, 0.45 + flameRamp * 0.55);
      } else {
        this.journeySatFlame.visible = false;
      }
    } else {
      const orbitT = (this.journeyProgress - CAPTURE_T) / (1 - CAPTURE_T);
      const theta = ENTRY_ANGLE + ORBIT_SWEEP * orbitT;
      const sx = pCenter.x + Math.cos(theta) * ORBIT_R;
      const sz = pCenter.z + Math.sin(theta) * ORBIT_R;
      this.journeyCraft.position.set(sx, pCenter.y, sz);
      // Exact unit tangent to circular orbit for increasing theta: (-sin(theta), 0, cos(theta))
      _v7.set(-Math.sin(theta), 0, Math.cos(theta)).normalize();

      _v3.copy(this.journeyCraft.position).addScaledVector(_v7, 4.0);
      const prevQ = _quat.copy(this.journeyCraft.quaternion);
      this.journeyCraft.lookAt(_v3);
      this.journeyTargetQuat.copy(this.journeyCraft.quaternion);
      this.journeyCraft.quaternion.copy(prevQ).slerp(this.journeyTargetQuat, 1 - Math.exp(-14 * dt));

      const fade = 1 - THREE.MathUtils.smoothstep(orbitT, 0.12, 0.55);
      if (fade > 0.02) {
        this.journeySatFlame.visible = true;
        const pulse = 0.88 + Math.sin(elapsed * 34) * 0.12;
        this.journeySatFlame.scale.set(fade * 1.05, fade * pulse * 1.1, fade * 1.05);
      } else {
        this.journeySatFlame.visible = false;
      }
    }

    // 3. Continuous 3/4 Orbital Chase Camera (horizon-level camera.up = (0, 1, 0) from Earth departure to Target Orbit)
    const chaseToReveal = THREE.MathUtils.smoothstep(this.journeyProgress, 0.48, 0.88);
    this.camera.up.set(0, 1, 0);

    // Unit forward tangent T = _v7 and horizontal starboard side vector R = (-T.z, 0, T.x)
    const tx = _v7.x;
    const tz = _v7.z;
    const rx = -tz;
    const rz = tx;

    const sideDist = THREE.MathUtils.lerp(10.8, 14.5, chaseToReveal);
    const backDist = THREE.MathUtils.lerp(5.4, 7.2, chaseToReveal);
    const sideHeight = THREE.MathUtils.lerp(4.2, 6.8, chaseToReveal);

    _v1.set(
      rx * sideDist - tx * backDist,
      sideHeight,
      rz * sideDist - tz * backDist
    );

    // Look ahead along the curved Hohmann trajectory, blending smoothly toward the target planet on approach
    _v5.set(tx * 3.8, 0.35, tz * 3.8);
    _v6.copy(pCenter).sub(this.journeyCraft.position).multiplyScalar(0.45);
    _v2.copy(_v5).lerp(_v6, chaseToReveal);

    this.journeyCamOffset.x = THREE.MathUtils.damp(this.journeyCamOffset.x, _v1.x, 6.5, dt);
    this.journeyCamOffset.y = THREE.MathUtils.damp(this.journeyCamOffset.y, _v1.y, 6.5, dt);
    this.journeyCamOffset.z = THREE.MathUtils.damp(this.journeyCamOffset.z, _v1.z, 6.5, dt);
    this.journeyLookOffset.x = THREE.MathUtils.damp(this.journeyLookOffset.x, _v2.x, 6.5, dt);
    this.journeyLookOffset.y = THREE.MathUtils.damp(this.journeyLookOffset.y, _v2.y, 6.5, dt);
    this.journeyLookOffset.z = THREE.MathUtils.damp(this.journeyLookOffset.z, _v2.z, 6.5, dt);

    this.camera.position.copy(this.journeyCraft.position).add(this.journeyCamOffset);
    this.journeyCamLook.copy(this.journeyCraft.position).add(this.journeyLookOffset);
    this.camera.lookAt(this.journeyCamLook);

    // Solid-planet collision barrier for Journey transit craft (well inside the 8.2 / 8.8 orbit rings)
    this.resolveSolidSphereCollision(
      this.journeyCraft.position,
      null,
      this.journeyOriginPlanetPos,
      5.4,
      1.5,
      0
    );
    const scaledTargetR = 4.8 * this.journeyTargetPlanet.scale.x;
    this.resolveSolidSphereCollision(
      this.journeyCraft.position,
      null,
      pCenter,
      scaledTargetR,
      1.5,
      0
    );

    if (this.journeyProgress >= 1) {
      this.callbacks.onJourneyComplete();
    }
  }

  private resolveSolidSphereCollision(
    pos: THREE.Vector3,
    vel: THREE.Vector3 | null,
    center: THREE.Vector3,
    solidRadius: number,
    objectRadius: number,
    restitution = 0.25
  ): boolean {
    const minDist = solidRadius + objectRadius;
    const dx = pos.x - center.x;
    const dy = pos.y - center.y;
    const dz = pos.z - center.z;
    const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
    if (dist < minDist) {
      const inv = dist > 0.0001 ? 1 / dist : 0;
      const nx = dist > 0.0001 ? dx * inv : 0;
      const ny = dist > 0.0001 ? dy * inv : 1;
      const nz = dist > 0.0001 ? dz * inv : 0;

      pos.set(center.x + nx * minDist, center.y + ny * minDist, center.z + nz * minDist);

      if (vel) {
        const vn = vel.x * nx + vel.y * ny + vel.z * nz;
        if (vn < 0) {
          const impulse = -(1 + restitution) * vn;
          vel.x += nx * impulse;
          vel.y += ny * impulse;
          vel.z += nz * impulse;
        }
      }
      return true;
    }
    return false;
  }

  private resolveRocketHullPlanetCollision(
    root: THREE.Object3D,
    center: THREE.Vector3,
    solidRadius: number,
    hullRadius = 1.28
  ): { collided: boolean; contactPoint: THREE.Vector3; surfaceNormal: THREE.Vector3 } {
    root.updateMatrixWorld();
    const axis = new THREE.Vector3(0, 1, 0).applyQuaternion(root.quaternion).normalize();
    const sampleOffsets = [-0.45, 1.9, 4.3, 6.6, 8.5];
    const minR = solidRadius + hullRadius;

    let maxPen = 0;
    const bestNormal = new THREE.Vector3(0, 1, 0);
    const sampleWorld = new THREE.Vector3();

    for (const off of sampleOffsets) {
      sampleWorld.copy(root.position).addScaledVector(axis, off);
      const diffX = sampleWorld.x - center.x;
      const diffY = sampleWorld.y - center.y;
      const diffZ = sampleWorld.z - center.z;
      const d = Math.sqrt(diffX * diffX + diffY * diffY + diffZ * diffZ);
      const pen = minR - d;
      if (pen > maxPen) {
        maxPen = pen;
        if (d > 0.0001) {
          bestNormal.set(diffX / d, diffY / d, diffZ / d);
        }
      }
    }

    if (maxPen > 0) {
      root.position.addScaledVector(bestNormal, maxPen);
      const contactPoint = center.clone().addScaledVector(bestNormal, solidRadius);
      return { collided: true, contactPoint, surfaceNormal: bestNormal };
    }

    const fallbackNormal = root.position.clone().sub(center).normalize();
    return {
      collided: false,
      contactPoint: center.clone().addScaledVector(fallbackNormal, solidRadius),
      surfaceNormal: fallbackNormal,
    };
  }

  private checkRocketEarthImpact(
    root: THREE.Object3D,
    earthCenter: THREE.Vector3
  ): { collided: boolean; contactPoint: THREE.Vector3; surfaceNormal: THREE.Vector3 } {
    root.updateMatrixWorld();
    const axis = new THREE.Vector3(0, 1, 0).applyQuaternion(root.quaternion).normalize();
    const rightAxis = new THREE.Vector3(1, 0, 0).applyQuaternion(root.quaternion).normalize();
    const top = this.launchRocketMaxY;
    const bot = this.launchRocketMinY;
    const srbX = this.launchRocketSrbOffsetX;

    // Exact hull contact spheres matching carrier rocket nose tip, fairing, tank, nozzles, and twin boosters
    const hullSamples: { lx: number; ly: number; r: number }[] = [
      { lx: 0, ly: top - 0.14, r: 0.14 },
      { lx: 0, ly: top - 0.8, r: 0.48 },
      { lx: 0, ly: top * 0.72, r: 0.82 },
      { lx: 0, ly: top * 0.44, r: 0.92 },
      { lx: 0, ly: top * 0.16, r: 0.92 },
      { lx: 0, ly: bot + 0.32, r: 0.32 },
      { lx: -srbX, ly: 0.35, r: 0.32 },
      { lx: -srbX, ly: 5.0, r: 0.28 },
      { lx: srbX, ly: 0.35, r: 0.32 },
      { lx: srbX, ly: 5.0, r: 0.28 },
    ];

    let maxPen = 0;
    const bestNormal = new THREE.Vector3(0, 1, 0);
    const bestContact = new THREE.Vector3();
    const sampleWorld = new THREE.Vector3();

    for (const s of hullSamples) {
      sampleWorld
        .copy(root.position)
        .addScaledVector(axis, s.ly)
        .addScaledVector(rightAxis, s.lx);

      // 1. Exact curved Earth sphere surface (coastalCap sits at radius = this.launchEarthRadius)
      const dx = sampleWorld.x - earthCenter.x;
      const dy = sampleWorld.y - earthCenter.y;
      const dz = sampleWorld.z - earthCenter.z;
      const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
      const spherePen = this.launchEarthRadius + s.r - dist;
      if (spherePen > maxPen) {
        maxPen = spherePen;
        if (dist > 0.0001) {
          bestNormal.set(dx / dist, dy / dist, dz / dist);
        }
        bestContact.copy(earthCenter).addScaledVector(bestNormal, this.launchEarthRadius);
      }

      // 2. Coastal lagoon water plane (y = -0.08 across z in [14, 154], x in [-180, 180])
      if (sampleWorld.z >= 14 && sampleWorld.z <= 154 && Math.abs(sampleWorld.x) <= 180) {
        const lagoonPen = -0.08 + s.r - sampleWorld.y;
        if (lagoonPen > maxPen) {
          maxPen = lagoonPen;
          bestNormal.set(0, 1, 0);
          bestContact.set(sampleWorld.x, -0.08, sampleWorld.z);
        }
      }
    }

    if (maxPen > 0) {
      root.position.addScaledVector(bestNormal, maxPen);
      return { collided: true, contactPoint: bestContact, surfaceNormal: bestNormal };
    }

    const fallbackNormal = root.position.clone().sub(earthCenter).normalize();
    return {
      collided: false,
      contactPoint: earthCenter.clone().addScaledVector(fallbackNormal, this.launchEarthRadius),
      surfaceNormal: fallbackNormal,
    };
  }


  private updateOrbitInsertion(dt: number, elapsed: number): void {
    this.orbitPlanetMesh.rotation.y += dt * 0.06;
    if (this.orbitHoloGridGroup) {
      this.orbitHoloGridGroup.rotation.y = this.orbitPlanetMesh.rotation.y;
    }
    const world = WORLDS[this.targetWorldId];
    const orbitRadius = this.getVisualOrbitRadius(this.targetWorldId);
    // Keep spacecraft center at >= ORBIT_PLANET_RADIUS + 0.58 so its -0.45 lower hull and landing gear
    // hover cleanly above the planetary surface (never clipping inside the planet sphere!)
    const planetSurfaceR = ORBIT_PLANET_RADIUS + 0.58;
    const siteRad = THREE.MathUtils.degToRad(this.selectedSiteAngleDeg);

    // Calm, physically scaled Keplerian orbital angular rate (21..42s per full revolution)
    const omegaOrbit = THREE.MathUtils.clamp(
      22 / Math.max(45, world.orbitMetrics.orbitalPeriodMin),
      0.15,
      0.30
    );

    const pulse = 1 + Math.sin(elapsed * 5.0) * 0.15;
    this.landingBeaconGroup.scale.setScalar(pulse);

    // Update orbital tracking reticle tint & billboard orientation toward camera
    if (this.orbitReticleGroup && this.orbitReticleMat) {
      const reticleHex =
        this.orbitPhase === 'descending'
          ? 0xf59e0b
          : this.orbitPhase === 'armed'
          ? 0x10b981
          : 0x22d3ee;
      this.orbitReticleMat.color.setHex(reticleHex);
      this.orbitReticleMat.opacity = 0.78 + Math.sin(elapsed * 4.0) * 0.14;
      this.orbitCraft.getWorldQuaternion(_quat);
      this.orbitReticleGroup.quaternion.copy(_quat).invert().multiply(this.camera.quaternion);
    }

    if (this.orbitPhase === 'orbiting' || this.orbitPhase === 'armed') {
      this.orbitPlasmaMesh.visible = false;
      this.orbitCraftAngle =
        (this.orbitCraftAngle + dt * omegaOrbit * this.orbitTimeWarp) % (Math.PI * 2);

      this.orbitCraft.position.set(
        Math.cos(this.orbitCraftAngle) * orbitRadius,
        0,
        Math.sin(this.orbitCraftAngle) * orbitRadius
      );

      _v1.set(-Math.sin(this.orbitCraftAngle), 0, Math.cos(this.orbitCraftAngle)).normalize();
      this.orbitCraft.quaternion.setFromUnitVectors(_upAxis, _v1);

      if (this.orbitPhase === 'armed') {
        // Compute forward angular arc from current spacecraft position to the selected landing site
        let angularDiff = siteRad - this.orbitCraftAngle;
        while (angularDiff <= 0) angularDiff += Math.PI * 2;

        // Trigger Hohmann de-orbit retro-burn in the natural upstream transfer sector (80°..235° ahead of site)
        // without ever adding an extra +2π full loop!
        if (angularDiff >= Math.PI * 0.44 && angularDiff <= Math.PI * 1.30) {
          this.orbitPhase = 'descending';
          this.orbitDescentT = 0;
          this.orbitTouchdownTimer = -1;
          this.orbitDescentStartAngle = this.orbitCraftAngle;
          this.orbitDescentSweep = angularDiff;

          this.orbitCraftFlame.visible = true;
          this.orbitDescentLine.visible = true;

          const linePos = this.orbitDescentLine.geometry.attributes.position as THREE.BufferAttribute;
          for (let i = 0; i <= 120; i++) {
            const t = i / 120;
            const easedR = THREE.MathUtils.smoothstep(t, 0, 1);
            const r = Math.max(planetSurfaceR, THREE.MathUtils.lerp(orbitRadius, planetSurfaceR, easedR));
            const theta = this.orbitDescentStartAngle + this.orbitDescentSweep * t;
            linePos.setXYZ(i, Math.cos(theta) * r, 0, Math.sin(theta) * r);
          }
          linePos.needsUpdate = true;
          this.orbitDescentLine.computeLineDistances();

          missionAudio.playIgnition();
          this.pushOrbitTelemetry(true);
        }
      }
      this.pushOrbitTelemetry();
    } else if (this.orbitPhase === 'descending') {
      if (this.orbitTouchdownTimer < 0) {
        // Continuity with orbital angular speed at t=0, followed by progressive retro-braking deceleration (~11-12s duration)
        const brakingFactor = THREE.MathUtils.lerp(1.0, 0.44, this.orbitDescentT);
        const baseDescentRate = THREE.MathUtils.clamp(
          (omegaOrbit * 1.12) / Math.max(1.4, this.orbitDescentSweep),
          0.072,
          0.11
        );
        this.orbitDescentT = Math.min(
          1,
          this.orbitDescentT + dt * baseDescentRate * brakingFactor * this.orbitTimeWarp
        );
        const t = this.orbitDescentT;
        const easedR = THREE.MathUtils.smoothstep(t, 0, 1);
        const pitchProgress = THREE.MathUtils.smoothstep(t, 0.18, 0.86);

        const minSafeR = planetSurfaceR + 0.14 * (1 - pitchProgress);
        const r = Math.max(minSafeR, THREE.MathUtils.lerp(orbitRadius, planetSurfaceR, easedR));
        const theta = this.orbitDescentStartAngle + this.orbitDescentSweep * t;
        this.orbitCraftAngle = ((theta % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);

        this.orbitCraft.position.set(Math.cos(theta) * r, 0, Math.sin(theta) * r);

        _v1.set(-Math.sin(theta), 0, Math.cos(theta)).normalize();
        _v2.set(Math.cos(theta), 0, Math.sin(theta)).normalize();
        _v3.copy(_v1).lerp(_v2, pitchProgress).normalize();
        this.orbitCraft.quaternion.setFromUnitVectors(_upAxis, _v3);

        this.orbitCraftFlame.visible = true;
        this.orbitCraftFlame.scale.set(1, 0.78 + Math.sin(elapsed * 42) * 0.18, 1);
        if (this.orbitCraftRig) {
          this.orbitCraftRig.legsGroup.visible = t > 0.58;
          this.orbitCraftRig.flameGroup.visible = true;
          this.orbitCraftRig.flameGroup.scale.set(1, 0.8 + Math.sin(elapsed * 42) * 0.18, 1);
        }

        // Ionized atmospheric re-entry plasma sheath on atmospheric worlds
        const showPlasma = world.hasAtmosphere && t > 0.14 && t < 0.92;
        this.orbitPlasmaMesh.visible = showPlasma;
        if (showPlasma) {
          const plasmaMat = this.orbitPlasmaMesh.material as THREE.MeshBasicMaterial;
          const pIntensity = Math.sin(((t - 0.14) / 0.78) * Math.PI);
          plasmaMat.opacity = THREE.MathUtils.clamp(
            pIntensity * (0.68 + Math.sin(elapsed * 32) * 0.16),
            0.05,
            0.88
          );
          plasmaMat.color.setHex(pIntensity > 0.65 ? 0xfb7185 : 0xf97316);
        }

        this.pushOrbitTelemetry();

        if (this.orbitDescentT >= 1) {
          this.orbitTouchdownTimer = 0;
          this.orbitCraftFlame.visible = false;
          if (this.orbitCraftRig) {
            this.orbitCraftRig.legsGroup.visible = true;
            this.orbitCraftRig.flameGroup.visible = false;
          }
          this.orbitPlasmaMesh.visible = false;
          this.orbitCraft.position.set(
            Math.cos(siteRad) * planetSurfaceR,
            0,
            Math.sin(siteRad) * planetSurfaceR
          );
          _v2.set(Math.cos(siteRad), 0, Math.sin(siteRad)).normalize();
          this.orbitCraft.quaternion.setFromUnitVectors(_upAxis, _v2);
          missionAudio.playSuccess();
        }
      } else {
        this.orbitTouchdownTimer += dt;
        if (this.orbitTouchdownTimer >= 1.15) {
          this.callbacks.onOrbitDescentComplete();
          return;
        }
      }
    }

    if (!this.userOrbiting && this.cameraFocusTarget && this.cameraFocusPos) {
      this.controls.target.lerp(this.cameraFocusTarget, 0.08);
      this.camera.position.lerp(this.cameraFocusPos, 0.08);
      if (this.camera.position.distanceTo(this.cameraFocusPos) < 0.25) {
        this.cameraFocusTarget = null;
        this.cameraFocusPos = null;
      }
    }
    this.controls.update();
  }

  private updateFinalVisual(dt: number, elapsed: number): void {
    if (this.targetWorldId === 'l1') {
      if (this.l1ProbeGroup) {
        this.l1ProbeGroup.rotation.y = Math.sin(elapsed * 0.45) * 0.35 - 0.65;
        this.l1ProbeGroup.position.y = 0.6 + Math.sin(elapsed * 1.1) * 0.14;
      }
      if (this.l1SunCoronaSprite) {
        const flareScale = 26 + this.l1FlareIntensity * 22 + Math.sin(elapsed * 6.5) * 2.2;
        this.l1SunCoronaSprite.scale.setScalar(flareScale);
        this.l1SunCoronaSprite.material.color.setHex(
          this.l1FlareIntensity > 0.35 ? 0xf43f5e : 0xf97316
        );
      }
      for (let i = 0; i < this.l1BroadcastRings.length; i++) {
        const ring = this.l1BroadcastRings[i];
        if (!this.l1IsBroadcasting) {
          ring.visible = false;
          continue;
        }
        ring.visible = true;
        const phase = (elapsed * 0.85 + i * 0.25) % 1;
        ring.position.set(phase * 13.0, 2.1 - phase * 3.1, phase * 11.0);
        ring.lookAt(13.5, -1.2, 11.5);
        ring.scale.setScalar(0.6 + phase * 3.2);
        (ring.material as THREE.MeshBasicMaterial).opacity = (1 - phase) * 0.85;
      }
      if (!this.userOrbiting && this.cameraFocusTarget && this.cameraFocusPos) {
        this.controls.target.lerp(this.cameraFocusTarget, 0.08);
        this.camera.position.lerp(this.cameraFocusPos, 0.08);
        if (this.camera.position.distanceTo(this.cameraFocusPos) < 0.25) {
          this.cameraFocusTarget = null;
          this.cameraFocusPos = null;
        }
      }
      this.controls.update();
      return;
    }

    for (const p of this.surfaceDustPool) {
      if (!p.active) continue;
      p.age += dt;
      p.sprite.position.addScaledVector(p.vel, dt);
      p.sprite.scale.setScalar(p.baseScale + p.age * 1.9);
      p.sprite.material.opacity = Math.max(0, 0.56 - p.age * 0.38);
      if (p.age > 1.45) {
        p.active = false;
        p.sprite.visible = false;
      }
    }

    if (this.finalRadarDish) {
      this.finalRadarDish.rotation.y = Math.sin(elapsed * 0.7) * 0.85;
    }
    if (this.finalCloudsMesh) {
      this.finalCloudsMesh.rotation.y += dt * 0.02;
    }

    // Pulse Science Target Beacons
    for (const obs of this.surfaceObstacles) {
      if (obs.beaconGroup) {
        const diamond = obs.beaconGroup.children[1] as THREE.Mesh | undefined;
        const ring = obs.beaconGroup.children[0] as THREE.Mesh | undefined;
        if (diamond) {
          diamond.rotation.y = elapsed * 2.2;
          diamond.position.y = obs.height + 0.55 + Math.sin(elapsed * 3.4 + obs.id) * 0.1;
          (diamond.material as THREE.MeshBasicMaterial).color.setHex(
            obs.scanned ? 0x10b981 : 0x38bdf8
          );
        }
        if (ring) {
          (ring.material as THREE.MeshBasicMaterial).color.setHex(
            obs.scanned ? 0x10b981 : 0x22d3ee
          );
        }
      }
    }

    if (!this.landingVehicle || !this.roverVehicle) return;

    const worldId = this.targetWorldId;
    const world = WORLDS[worldId];
    const groundY = this.getTerrainHeightAt(worldId, 0, 0);
    const bayFloorY = groundY + 0.48 - this.landerCompression;

    if (this.surfacePhase === 'descending') {
      const distToGround = Math.max(0, this.landerY - groundY);
      const gSurface = world.surfaceGravity;
      const hasAtmo = world.hasAtmosphere;

      let pitchRad = 0;
      let maneuverLabel = 'VERTICAL TERMINAL FLARE';
      let flapDeflection = 0;

      if (hasAtmo) {
        // Atmospheric World: SpaceX Starship Belly-Flop (150 m -> 68 m), Flip-and-Burn (68 m -> 32 m), & Terminal Hover Flare (< 32 m)
        if (distToGround > 34) {
          pitchRad = 1.28 + Math.sin(elapsed * 2.6) * 0.04;
          maneuverLabel = 'BELLY FLOP SKYDIVE';
        } else if (distToGround > 16) {
          if (!this.flipBurnIgnited) {
            this.flipBurnIgnited = true;
            missionAudio.playIgnition();
          }
          const flipT = THREE.MathUtils.smoothstep(34 - distToGround, 0, 18);
          pitchRad = THREE.MathUtils.lerp(1.28, 0, flipT);
          maneuverLabel = 'FLIP & BURN MANEUVER';
        } else {
          if (!this.flipBurnIgnited) {
            this.flipBurnIgnited = true;
            missionAudio.playIgnition();
          }
          pitchRad = 0;
          maneuverLabel = distToGround < 6 ? 'TOUCHDOWN HOVER FLARE' : 'VERTICAL RETRO-DESCENT';
        }
        flapDeflection = distToGround > 16 ? Math.sin(elapsed * 5.5) * 0.26 + 0.22 : 0.04;
      } else {
        // Airless World (Moon, Europa, 16 Psyche): Continuous HLS Powered Retro-Propulsive Descent (no aerodynamic Belly-Flop)
        if (!this.flipBurnIgnited) {
          this.flipBurnIgnited = true;
          missionAudio.playIgnition();
        }
        if (distToGround > 24) {
          const hlsT = THREE.MathUtils.clamp((distToGround - 24) / 51, 0, 1);
          pitchRad = THREE.MathUtils.lerp(0.05, 0.24, hlsT);
          maneuverLabel = 'HLS POWERED DESCENT';
        } else if (distToGround > 8) {
          pitchRad = THREE.MathUtils.lerp(0, 0.05, (distToGround - 8) / 16);
          maneuverLabel = 'TERMINAL RETRO-BURN';
        } else {
          pitchRad = 0;
          maneuverLabel = 'VACUUM TOUCHDOWN FLARE';
        }
        flapDeflection = 0; // Aero-flaps locked neutral in vacuum
      }

      this.landingVehicle.bodyGroup.rotation.x = pitchRad;
      this.landingVehicle.legsGroup.rotation.x = pitchRad;
      this.landingVehicle.legsGroup.visible = distToGround < 26;

      this.landingVehicle.fwdFlaps.forEach((f, idx) => {
        const side = idx === 0 ? -1 : 1;
        f.rotation.z = side * flapDeflection;
      });
      this.landingVehicle.aftFlaps.forEach((f, idx) => {
        const side = idx === 0 ? -1 : 1;
        f.rotation.z = side * (flapDeflection * 1.15);
      });

      let throttleRatio = 0;
      if (this.manualThrottlePct !== null) {
        // Manual Pilot Throttle Mode (0% .. 140%)
        const t01 = this.manualThrottlePct / 100;
        const hoverAcc = Math.max(2.6, gSurface * 0.45);
        const netAcc = (t01 - 0.72) * hoverAcc * 2.9 - this.landerVelY * 0.22;
        this.landerVelY = THREE.MathUtils.clamp(this.landerVelY + netAcc * dt, -13.5, 3.0);
        this.landerY = Math.min(
          groundY + 80,
          Math.max(groundY, this.landerY + this.landerVelY * dt)
        );
        throttleRatio = t01 * 1.25;
      } else {
        // Autopilot Two-Regime Powered Retro-Braking
        const targetVel =
          distToGround > 10
            ? -THREE.MathUtils.clamp(distToGround * 0.16 + 1.8, 2.0, 9.8)
            : -Math.max(0.24, Math.pow(distToGround / 10, 0.78) * 3.4);
        const accelResponse = THREE.MathUtils.clamp(2.4 + gSurface * 0.22, 2.2, 5.2);
        this.landerVelY = THREE.MathUtils.damp(this.landerVelY, targetVel, accelResponse, dt);
        this.landerY = Math.max(groundY, this.landerY + this.landerVelY * dt);

        const flareBoost = distToGround < 12 ? 0.22 : 0;
        if (hasAtmo) {
          throttleRatio =
            distToGround <= 34
              ? THREE.MathUtils.clamp(0.55 + gSurface / 14 + flareBoost, 0.55, 1.42)
              : 0;
        } else {
          // Continuous retro-propulsion on airless worlds
          throttleRatio = THREE.MathUtils.clamp(0.48 + gSurface / 14 + flareBoost, 0.48, 1.38);
        }
      }

      const enginesFiring = throttleRatio > 0.05;
      this.landerFuelPct = Math.max(
        0,
        this.landerFuelPct - dt * (enginesFiring ? 1.8 * throttleRatio : 0.08)
      );

      this.landingVehicle.root.position.set(0, this.landerY, 0);
      this.landingVehicle.bodyGroup.position.y = 0;
      this.landingVehicle.flameGroup.visible = enginesFiring;
      if (enginesFiring) {
        this.landingVehicle.flameGroup.scale.set(
          throttleRatio,
          (0.8 + Math.sin(elapsed * 42) * 0.16) * throttleRatio,
          throttleRatio
        );
      }

      this.roverPos.set(0, this.landerY + 0.48, -0.05);
      this.roverVehicle.root.visible = false;
      this.roverVehicle.root.position.copy(this.roverPos);

      if (enginesFiring && distToGround < 22) {
        const scorchRate = THREE.MathUtils.clamp((22 - distToGround) / 18, 0.15, 1.0);
        this.landerScorchIntensity = Math.min(
          0.88,
          this.landerScorchIntensity + dt * 0.48 * scorchRate * throttleRatio
        );
        if (this.landerScorchMesh) {
          (this.landerScorchMesh.material as THREE.MeshBasicMaterial).opacity =
            this.landerScorchIntensity;
        }
      }

      if (enginesFiring && distToGround < 9.5 && Math.random() < (distToGround < 4 ? 0.85 : 0.48)) {
        this.spawnSurfaceDust(0, groundY, 0, 3.6);
      }

      const speedMs = Math.abs(this.landerVelY) * SURFACE_METERS_PER_UNIT;
      const soundSpeedMs =
        worldId === 'earth' ? 340 : worldId === 'mars' ? 240 : worldId === 'colony' ? 315 : 0;
      const mach =
        hasAtmo && soundSpeedMs > 0 ? Number((speedMs / soundSpeedMs).toFixed(2)) : 0;
      const rho0 =
        worldId === 'earth' ? 1.225 : worldId === 'mars' ? 0.020 : worldId === 'colony' ? 1.45 : 0;
      const dynamicPressureKpa = hasAtmo
        ? Number(((0.5 * rho0 * speedMs * speedMs * 0.045) * (0.4 + distToGround / 75)).toFixed(2))
        : 0;
      const gLoad = Number(
        ((gSurface + (enginesFiring ? throttleRatio * gSurface * 1.35 : 0)) / 9.80665).toFixed(2)
      );

      const now = performance.now();
      if (this.callbacks.onSurfaceTelemetry && now - this.lastSurfacePush >= 80) {
        this.lastSurfacePush = now;
        this.callbacks.onSurfaceTelemetry({
          altitudeM: Math.round(distToGround * SURFACE_METERS_PER_UNIT),
          verticalSpeedMs: Number(speedMs.toFixed(1)),
          surfaceGravityMs2: gSurface,
          maneuverLabel,
          fuelPct: Math.round(this.landerFuelPct),
          manualThrottlePct: this.manualThrottlePct,
          pitchDeg: Math.round(THREE.MathUtils.radToDeg(pitchRad)),
          mach,
          dynamicPressureKpa,
          gLoad,
        });
      }

      if (this.landerY <= groundY + 0.008) {
        this.landerY = groundY;
        this.landerCompression = 0;
        this.landerCompressionVel = THREE.MathUtils.clamp(
          Math.abs(this.landerVelY) * 0.9,
          0.45,
          1.35
        );
        this.landerFlameFade = 1;
        this.landingVehicle.root.position.set(0, groundY, 0);
        this.landingVehicle.bodyGroup.rotation.set(0, 0, 0);
        this.landingVehicle.legsGroup.rotation.set(0, 0, 0);
        this.landingVehicle.legsGroup.visible = true;
        this.landingVehicle.fwdFlaps.forEach((f) => (f.rotation.z = 0));
        this.landingVehicle.aftFlaps.forEach((f) => (f.rotation.z = 0));
        this.roverPos.set(0, groundY + 0.48, -0.05);
        this.roverVehicle.root.visible = false;
        this.roverVehicle.root.position.copy(this.roverPos);
        missionAudio.playSnap();
        this.surfacePhase = 'landed';
        this.surfaceTimer = 0;
        this.callbacks.onSurfacePhaseChange('landed');
        this.callbacks.onSurfaceTelemetry?.({
          altitudeM: 0,
          verticalSpeedMs: 0,
          surfaceGravityMs2: gSurface,
          maneuverLabel: 'TOUCHDOWN CONFIRMED',
          fuelPct: Math.round(this.landerFuelPct),
          manualThrottlePct: this.manualThrottlePct,
          pitchDeg: 0,
          mach: 0,
          dynamicPressureKpa: 0,
          gLoad: Number((gSurface / 9.80665).toFixed(2)),
        });
        this.cameraFocusTarget = new THREE.Vector3(0, groundY + 2.5, 0.8);
        this.cameraFocusPos = new THREE.Vector3(7.2, groundY + 3.8, 14.8);
      }
    } else if (this.surfacePhase === 'landed') {
      this.surfaceTimer += dt;

      // Damped shock-absorber spring compression across all 4 landing legs
      const springForce = -78 * this.landerCompression - 14 * this.landerCompressionVel;
      this.landerCompressionVel += springForce * dt;
      this.landerCompression = THREE.MathUtils.clamp(
        this.landerCompression + this.landerCompressionVel * dt,
        0,
        0.22
      );
      this.landingVehicle.bodyGroup.position.y = -this.landerCompression;
      this.roverPos.set(0, groundY + 0.48 - this.landerCompression, -0.05);
      this.roverVehicle.root.visible = false;
      this.roverVehicle.root.position.copy(this.roverPos);

      for (const leg of this.landingVehicle.legRigs) {
        leg.upperPivot.position.y = 0.68 - this.landerCompression;
        leg.upperPivot.rotation.z = 0.56 + this.landerCompression * 0.65;
        leg.lowerPivot.rotation.z = 0.56 + this.landerCompression * 0.65;
      }

      // Smoothly spool down retro-thruster exhaust plume instead of cutting abruptly
      if (this.landerFlameFade > 0) {
        this.landerFlameFade = Math.max(0, this.landerFlameFade - dt * 2.8);
        if (this.landerFlameFade <= 0.01) {
          this.landingVehicle.flameGroup.visible = false;
        } else {
          this.landingVehicle.flameGroup.scale.setScalar(this.landerFlameFade);
        }
      }

      if (this.surfaceTimer >= 1.35) {
        this.surfacePhase = 'ramp_deploy';
        this.surfaceTimer = 0;
        this.roverPos.set(0, bayFloorY, -0.05);
        this.roverVehicle.root.position.copy(this.roverPos);
        this.roverVehicle.root.scale.setScalar(1.0);
        this.roverVehicle.root.visible = true; // Reveal stowed rover inside bay as ramp opens
        missionAudio.playSnap();
        this.callbacks.onSurfacePhaseChange('ramp_deploy');
      }
    } else if (this.surfacePhase === 'ramp_deploy') {
      this.roverVehicle.root.visible = true;
      this.roverPos.set(0, bayFloorY, -0.05);
      this.roverVehicle.root.position.copy(this.roverPos);
      this.rampAngle = Math.min(1.90, this.rampAngle + dt * 1.15);
      this.landingVehicle.rampPivot.rotation.x = this.rampAngle;
      this.landingVehicle.bayLight.intensity = Math.min(2.8, this.landingVehicle.bayLight.intensity + dt * 3.0);

      if (this.rampAngle >= 1.895) {
        this.surfacePhase = 'rover_exit';
        this.surfaceTimer = 0;
        this.callbacks.onSurfacePhaseChange('rover_exit');
      }
    } else if (this.surfacePhase === 'rover_exit') {
      this.roverVehicle.root.visible = true;
      this.roverVehicle.root.scale.setScalar(1.0);
      const speed = 1.35;
      this.roverPos.z += speed * dt;

      if (this.roverPos.z < 0.58) {
        this.roverPos.y = bayFloorY;
        this.roverVehicle.root.rotation.x = 0;
      } else if (this.roverPos.z <= 1.98) {
        const rampT = (this.roverPos.z - 0.58) / (1.98 - 0.58);
        const endGroundY = this.getTerrainHeightAt(worldId, 0, 1.98);
        this.roverPos.y = THREE.MathUtils.lerp(bayFloorY, endGroundY, rampT);
        this.roverVehicle.root.rotation.x = 0.32;
      } else {
        this.roverPos.y = this.getTerrainHeightAt(worldId, this.roverPos.x, this.roverPos.z);
        this.roverVehicle.root.rotation.x = THREE.MathUtils.damp(this.roverVehicle.root.rotation.x, 0, 8, dt);
        this.stampRoverWheelTracks();
      }

      this.roverVehicle.root.position.copy(this.roverPos);
      const wheelSpin = (speed * dt) / 0.12;
      for (const w of this.roverVehicle.wheels) {
        w.rotation.x += wheelSpin;
      }
      this.roverVehicle.mastHead.rotation.y = Math.sin(elapsed * 1.6) * 0.45;

      if (this.roverPos.z >= 4.2) {
        this.roverVehicle.root.scale.setScalar(1.0);
        this.surfacePhase = 'rover_active';
        this.surfaceTimer = 0;
        missionAudio.playSuccess();
        this.callbacks.onSurfacePhaseChange('rover_active');
        this.cameraFocusTarget = new THREE.Vector3(0, groundY + 1.8, 2.4);
        this.cameraFocusPos = new THREE.Vector3(6.8, groundY + 4.2, 12.6);
        this.pushScienceTelemetry();
      }
    } else if (this.surfacePhase === 'rover_active') {
      if (this.roverBumpTimer > 0) this.roverBumpTimer = Math.max(0, this.roverBumpTimer - dt);
      if (this.obstacleNoticeTimer > 0) {
        this.obstacleNoticeTimer = Math.max(0, this.obstacleNoticeTimer - dt);
        if (this.obstacleNoticeTimer <= 0) {
          this.currentObstacleNotice = null;
          this.pushRoverNavTelemetry(true);
        }
      }

      // Active ChemCam Laser Spectroscopy Scan update
      if (this.chemCamScanTimer > 0 && this.chemCamActiveTarget) {
        this.chemCamScanTimer = Math.max(0, this.chemCamScanTimer - dt);
        const target = this.chemCamActiveTarget;
        const targetY =
          this.getTerrainHeightAt(worldId, target.x, target.z) + target.height * 0.55;

        this.roverVehicle.mastHead.getWorldPosition(_v1);
        _v2.set(target.x, targetY, target.z);

        if (this.chemCamBeamLine) {
          const beamPos = this.chemCamBeamLine.geometry.attributes.position as THREE.BufferAttribute;
          beamPos.setXYZ(0, _v1.x, _v1.y, _v1.z);
          beamPos.setXYZ(1, _v2.x, _v2.y, _v2.z);
          beamPos.needsUpdate = true;
          this.chemCamBeamLine.visible = Math.sin(elapsed * 55) > -0.35;
        }
        if (this.chemCamSparkSprite) {
          this.chemCamSparkSprite.position.copy(_v2);
          this.chemCamSparkSprite.scale.setScalar(0.55 + Math.sin(elapsed * 48) * 0.25);
          this.chemCamSparkSprite.visible = true;
        }
        if (Math.random() < 0.35) {
          this.spawnSurfaceDust(target.x, targetY - 0.2, target.z, 0.9);
        }

        if (this.chemCamScanTimer > 0) {
          // Animate IDD Robotic Arm turret during active rock analysis
          this.roverVehicle.armJoint.rotation.y = Math.sin(elapsed * 8.0) * 0.35;
          this.roverVehicle.armHead.rotation.x = 0.32 + Math.sin(elapsed * 12.0) * 0.16;
        }

        if (this.chemCamScanTimer <= 0) {
          if (this.chemCamBeamLine) this.chemCamBeamLine.visible = false;
          if (this.chemCamSparkSprite) this.chemCamSparkSprite.visible = false;

          target.scanned = true;
          const mineral = target.mineralComposition ?? 'Silicate Regolith Breccia (SiO₂ · MgO)';
          const oxideBreakdown = this.generateOxideBreakdown(target);
          this.spectrometerSummary = oxideBreakdown;
          this.lastSpectroReadout = `${target.label}: ${mineral} (${oxideBreakdown})`;
          if (!this.collectedSamples.some((s) => s.id === target.id)) {
            this.collectedSamples.push({
              id: target.id,
              label: target.label,
              mineralComposition: mineral,
              oxideBreakdown,
              timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
            });
          }
          this.chemCamActiveTarget = null;
          missionAudio.playSuccess();
          this.currentObstacleNotice = `Sample Logged: ${target.label}`;
          this.systemLog = `Örnek Toplandı! ${target.label} analizi tamamlandı.`;
          this.obstacleNoticeTimer = 2.6;
          this.pushRoverNavTelemetry(true);

          if (this.autonomousMissionActive) {
            this.planNextAutonomousTarget();
          }
        }
        this.pushScienceTelemetry(true);
      } else {
        if (this.chemCamBeamLine) this.chemCamBeamLine.visible = false;
        if (this.chemCamSparkSprite) this.chemCamSparkSprite.visible = false;
      }

      if (this.roverTargetBeacon.visible) {
        const pulse = 1 + Math.sin(elapsed * 4.5) * 0.12;
        this.roverTargetBeacon.scale.setScalar(pulse);
      }

      let fwd = this.roverDriveInput.forward;
      let turn = this.roverDriveInput.turn;

      if (fwd !== 0 || turn !== 0) {
        if (this.roverPathWaypoints.length > 0) {
          this.autonomousMissionActive = false;
          this.pendingScanObstacleId = null;
          this.clearRoverNavigation();
        }
      } else if (this.roverWaypointIdx < this.roverPathWaypoints.length) {
        const wp = this.roverPathWaypoints[this.roverWaypointIdx];
        const dx = wp.x - this.roverPos.x;
        const dz = wp.y - this.roverPos.z;
        const distToWp = Math.hypot(dx, dz);
        const isLast = this.roverWaypointIdx === this.roverPathWaypoints.length - 1;

        if (distToWp < (isLast ? 0.36 : 0.48)) {
          this.roverWaypointIdx++;
          if (this.roverWaypointIdx >= this.roverPathWaypoints.length) {
            this.clearRoverNavigation();
            if (this.pendingScanObstacleId !== null) {
              const scanId = this.pendingScanObstacleId;
              this.pendingScanObstacleId = null;
              this.triggerChemCamScan(scanId);
            } else {
              missionAudio.playSuccess();
              this.currentObstacleNotice = 'Destination Reached';
              this.systemLog = 'Hedefe Ulaşıldı.';
              this.obstacleNoticeTimer = 2.0;
              this.pushRoverNavTelemetry(true);
            }
          } else {
            this.updateRoverNavLineMesh();
          }
        } else {
          const desiredHeading = Math.atan2(dx, dz);
          let angleErr = desiredHeading - this.roverHeading;
          while (angleErr > Math.PI) angleErr -= Math.PI * 2;
          while (angleErr < -Math.PI) angleErr += Math.PI * 2;

          this.roverHeading += Math.max(-1, Math.min(1, angleErr * 2.6)) * dt * 2.8;
          fwd = Math.abs(angleErr) > 1.1 ? 0.35 : 1.05;
        }
      } else if (this.roverDriveInput.autoRoam) {
        fwd = 0.65;
        turn = Math.sin(elapsed * 0.45) * 0.42;
      }

      // Compute real-time Terrain Slope (EĞİM) in degrees
      const hX1 = this.getTerrainHeightAt(worldId, this.roverPos.x + 0.15, this.roverPos.z);
      const hX2 = this.getTerrainHeightAt(worldId, this.roverPos.x - 0.15, this.roverPos.z);
      const hZ1 = this.getTerrainHeightAt(worldId, this.roverPos.x, this.roverPos.z + 0.15);
      const hZ2 = this.getTerrainHeightAt(worldId, this.roverPos.x, this.roverPos.z - 0.15);
      const dHx = (hX1 - hX2) / 0.3;
      const dHz = (hZ1 - hZ2) / 0.3;
      this.sensorSlopeDeg = Math.atan(Math.sqrt(dHx * dHx + dHz * dHz)) * (180 / Math.PI);

      // Periodic 500ms Sensor Suite update (Temperature, Radiation, IR Reflectance, Camera Status)
      const nowMs = performance.now();
      if (nowMs - this.lastSensorUpdateTime > 500) {
        this.lastSensorUpdateTime = nowMs;
        const baseWorldTemp =
          worldId === 'earth'
            ? 18
            : worldId === 'mars'
            ? -58
            : worldId === 'jupiter'
            ? -162
            : worldId === 'colony'
            ? -28
            : -45;
        let elevTempOffset = 0;
        if (this.roverPos.y < -0.6) elevTempOffset = -95; // Deep crater shadow cold trap
        else if (this.roverPos.y > 0.4) elevTempOffset = 22; // Sunlit crater rim
        this.sensorTempC = baseWorldTemp + elevTempOffset + (Math.random() * 3.6 - 1.8);

        const baseRad =
          worldId === 'jupiter'
            ? 420
            : worldId === 'mars'
            ? 34
            : worldId === 'earth'
            ? 0.2
            : 55;
        this.sensorRadUsv =
          baseRad + (this.roverPos.y > 0.5 ? 14 : 0) + Math.random() * (worldId === 'earth' ? 0.08 : 8.5);

        const baseIr = worldId === 'jupiter' ? 0.92 : 0.85;
        this.sensorIrReflectance =
          baseIr + (this.roverPos.y < -0.6 ? -0.14 : 0) + (Math.random() * 0.04 - 0.02);
      }

      // If battery is depleted, halt movement until MMRTG nuclear source recharges buffer
      if (this.roverBattery <= 0.05) {
        fwd = 0;
        turn = 0;
        this.systemLog = 'DURUM: GÜÇ TÜKENDİ! MMRTG nükleer reaktör şarj ediyor...';
      }

      if (turn !== 0) {
        this.roverHeading += turn * dt * 1.35;
      }

      if (fwd !== 0) {
        const moveSpeed = fwd * 2.15;
        let nextX = this.roverPos.x + Math.sin(this.roverHeading) * moveSpeed * dt;
        let nextZ = this.roverPos.z + Math.cos(this.roverHeading) * moveSpeed * dt;

        const maxDist = worldId === 'earth' ? 14.0 : 45.0;
        const rFromCenter = Math.hypot(nextX, nextZ);
        if (rFromCenter > maxDist) {
          const clampScale = maxDist / rFromCenter;
          nextX *= clampScale;
          nextZ *= clampScale;
          if (this.roverDriveInput.autoRoam) {
            this.roverHeading += dt * 1.6;
          }
        }

        let hitNotice: string | null = null;
        for (let iter = 0; iter < 2; iter++) {
          for (let i = 0; i < this.surfaceObstacles.length; i++) {
            const obs = this.surfaceObstacles[i];
            const dx = nextX - obs.x;
            const dz = nextZ - obs.z;
            const dist = Math.hypot(dx, dz);
            const minD = ROVER_COLLISION_RADIUS + obs.radius;

            if (dist < minD) {
              const nx = dist > 0.001 ? dx / dist : Math.sin(this.roverHeading);
              const nz = dist > 0.001 ? dz / dist : Math.cos(this.roverHeading);
              const overlap = minD - dist;

              if (obs.movable) {
                const rockPushX = obs.x - nx * (overlap * 0.88);
                const rockPushZ = obs.z - nz * (overlap * 0.88);
                const safeRockPos = clampToFreeSurfacePoint(
                  rockPushX,
                  rockPushZ,
                  this.surfaceObstacles.filter((other) => other.id !== obs.id),
                  maxDist - 0.5,
                  obs.radius
                );
                obs.x = safeRockPos.x;
                obs.z = safeRockPos.z;
                if (obs.mesh) {
                  const rockY = this.getTerrainHeightAt(worldId, obs.x, obs.z);
                  obs.mesh.position.set(obs.x, rockY + obs.radius * 0.58, obs.z);
                  obs.mesh.rotation.x += nz * overlap * 0.8;
                  obs.mesh.rotation.z -= nx * overlap * 0.8;
                  if (obs.beaconGroup) {
                    obs.beaconGroup.position.set(obs.x, rockY + 0.08, obs.z);
                  }
                }
                nextX = obs.x + nx * (minD + 0.01);
                nextZ = obs.z + nz * (minD + 0.01);
                hitNotice = `Pushing: ${obs.label}`;
              } else {
                nextX = obs.x + nx * (minD + 0.015);
                nextZ = obs.z + nz * (minD + 0.015);
                hitNotice = `Blocked by ${obs.label}`;
                if (this.roverDriveInput.autoRoam) {
                  this.roverHeading += dt * 1.9;
                }
              }

              if (elapsed - this.lastBumpAudioTime > 0.45) {
                this.lastBumpAudioTime = elapsed;
                this.roverBumpTimer = 0.22;
                missionAudio.playSnap();
              }
            }
          }
        }

        if (hitNotice) {
          this.currentObstacleNotice = hitNotice;
          this.obstacleNoticeTimer = 1.6;
        }

        const stepDistUnits = Math.hypot(nextX - this.roverPos.x, nextZ - this.roverPos.z);
        this.roverTotalDistanceM += stepDistUnits * SURFACE_METERS_PER_UNIT;
        this.roverBattery = Math.max(
          0,
          this.roverBattery - stepDistUnits * 1.35 * (1 + this.sensorSlopeDeg * 0.025)
        );

        this.roverPos.x = nextX;
        this.roverPos.z = nextZ;
        this.stampRoverWheelTracks();

        if (this.roverWaypointIdx < this.roverPathWaypoints.length) {
          this.updateRoverNavLineMesh();
          this.pushRoverNavTelemetry();
        }

        const wheelSpin = (moveSpeed * dt) / 0.14;
        for (const w of this.roverVehicle.wheels) {
          w.rotation.x += wheelSpin;
        }

        // Curiosity 5-DOF Robotic Arm active scanning motion while driving
        this.roverVehicle.armJoint.rotation.y = Math.sin(elapsed * 3.0) * 0.48;
        this.roverVehicle.armHead.rotation.x = Math.sin(elapsed * 5.0) * 0.28;
      } else {
        // Stationary: MMRTG Nuclear Radioisotope Power Source recharges buffer battery + Arm returns smoothly to stow
        if (this.roverBattery < this.roverMaxBattery) {
          this.roverBattery = Math.min(this.roverMaxBattery, this.roverBattery + dt * 3.6);
        }
        if (this.chemCamScanTimer <= 0) {
          this.roverVehicle.armJoint.rotation.y *= 0.92;
          this.roverVehicle.armHead.rotation.x *= 0.92;
        }
      }

      // Update Camera Sensor status string
      const nearestSci = this.getNearestScannableObstacle(5.0);
      if (nearestSci && !nearestSci.scanned) {
        this.sensorCameraStatus = 'Hedef Yakında (Odaklanıldı)';
      } else if (fwd !== 0 || turn !== 0) {
        this.sensorCameraStatus = 'Navigasyon (Aktif Tarama)';
      } else {
        this.sensorCameraStatus = 'Geniş Açı (Bekleme)';
      }

      this.pushScienceTelemetry();

      // 3D Longitudinal Pitch + Lateral Roll & 6-Wheel Independent Rocker-Bogie Terrain Conformance
      const sinH = Math.sin(this.roverHeading);
      const cosH = Math.cos(this.roverHeading);
      const frontY = this.getTerrainHeightAt(
        worldId,
        this.roverPos.x + sinH * 0.25,
        this.roverPos.z + cosH * 0.25
      );
      const rearY = this.getTerrainHeightAt(
        worldId,
        this.roverPos.x - sinH * 0.25,
        this.roverPos.z - cosH * 0.25
      );
      const leftY = this.getTerrainHeightAt(
        worldId,
        this.roverPos.x - cosH * 0.24,
        this.roverPos.z + sinH * 0.24
      );
      const rightY = this.getTerrainHeightAt(
        worldId,
        this.roverPos.x + cosH * 0.24,
        this.roverPos.z - sinH * 0.24
      );

      const ry = (frontY + rearY + leftY + rightY) * 0.25;
      const bumpLift =
        this.roverBumpTimer > 0 ? Math.sin((this.roverBumpTimer / 0.22) * Math.PI) * 0.04 : 0;
      this.roverPos.y = THREE.MathUtils.damp(this.roverPos.y, ry + bumpLift, 14, dt);
      this.roverVehicle.root.position.copy(this.roverPos);

      const pitch = Math.atan2(rearY - frontY, 0.50) + (this.roverBumpTimer > 0 ? -0.06 : 0);
      const roll = Math.atan2(leftY - rightY, 0.48);

      this.roverVehicle.root.rotation.order = 'YXZ';
      this.roverVehicle.root.rotation.y = this.roverHeading;
      this.roverVehicle.root.rotation.x = THREE.MathUtils.damp(
        this.roverVehicle.root.rotation.x,
        pitch,
        10,
        dt
      );
      this.roverVehicle.root.rotation.z = THREE.MathUtils.damp(
        this.roverVehicle.root.rotation.z,
        roll,
        10,
        dt
      );

      // Articulate each of the 6 Curiosity wheels vertically to conform to local crater slope
      const roverScale = 0.22;
      const sinPitch = Math.sin(this.roverVehicle.root.rotation.x);
      const sinRoll = Math.sin(this.roverVehicle.root.rotation.z);
      for (let i = 0; i < this.roverVehicle.wheels.length; i++) {
        const wMesh = this.roverVehicle.wheels[i];
        const hub = CURIOSITY_WHEEL_HUBS[i];
        if (!wMesh || !hub) continue;
        const lx = hub[0] * roverScale;
        const lz = hub[2] * roverScale;
        const wx = this.roverPos.x + lx * cosH + lz * sinH;
        const wz = this.roverPos.z - lx * sinH + lz * cosH;
        const wheelGroundY = this.getTerrainHeightAt(worldId, wx, wz);
        const chassisYAtWheel = this.roverPos.y - lz * sinPitch - lx * sinRoll;
        const localDeltaY = THREE.MathUtils.clamp(
          (wheelGroundY - chassisYAtWheel) / roverScale,
          -0.18,
          0.18
        );
        wMesh.position.y = THREE.MathUtils.damp(wMesh.position.y, hub[1] + localDeltaY, 16, dt);
      }

      this.roverVehicle.mastHead.rotation.y =
        this.surfaceCameraMode === 'rover_cam'
          ? 0
          : fwd !== 0
          ? Math.sin(elapsed * 2.0) * 0.75
          : Math.sin(elapsed * 0.6) * 0.3;
    }

    // Multi-Angle Camera System: Chase (OrbitControls), StarshipHullCam, LandingPadCam, or RoverNavCam
    this.controls.enabled = this.surfaceCameraMode === 'chase';
    if (this.surfaceCameraMode === 'starship_cam') {
      // Mounted near Starship upper dorsal hull looking down along the stainless steel barrel & flaps toward the pad
      const bodyPitch = this.landingVehicle.bodyGroup.rotation.x;
      const camLocal = _v1.set(1.85, 5.8, 2.65);
      camLocal.applyAxisAngle(new THREE.Vector3(1, 0, 0), bodyPitch);
      camLocal.y += this.landerY;

      const lookLocal = _v2.set(0, -1.2, 0);
      lookLocal.applyAxisAngle(new THREE.Vector3(1, 0, 0), bodyPitch);
      lookLocal.y += Math.max(groundY, this.landerY);

      this.camera.position.lerp(camLocal, 1 - Math.exp(-16 * dt));
      this.controls.target.lerp(lookLocal, 1 - Math.exp(-18 * dt));
      this.camera.lookAt(this.controls.target);
    } else if (this.surfaceCameraMode === 'pad_cam') {
      // Low-angle ground camera stationed near the landing pad edge looking up at Starship or across at the Rover
      _v1.set(9.2, groundY + 1.25, 11.8);
      if (this.surfacePhase === 'descending' || this.surfacePhase === 'landed' || this.surfacePhase === 'ramp_deploy') {
        _v2.set(0, this.landerY + 2.6, 0);
      } else {
        _v2.set(this.roverPos.x, this.roverPos.y + 0.55, this.roverPos.z);
      }
      this.camera.position.lerp(_v1, 1 - Math.exp(-12 * dt));
      this.controls.target.lerp(_v2, 1 - Math.exp(-14 * dt));
      this.camera.lookAt(this.controls.target);
    } else if (this.surfaceCameraMode === 'rover_cam') {
      // First-Person Stereo NavCam mounted on the Perseverance Rover mastHead
      const sinH = Math.sin(this.roverHeading);
      const cosH = Math.cos(this.roverHeading);
      _v1.set(
        this.roverPos.x + sinH * 0.28,
        this.roverPos.y + 0.92,
        this.roverPos.z + cosH * 0.28
      );
      const lookX = this.roverPos.x + sinH * 6.5;
      const lookZ = this.roverPos.z + cosH * 6.5;
      const lookY = this.getTerrainHeightAt(worldId, lookX, lookZ) + 0.45;
      _v2.set(lookX, lookY, lookZ);
      this.camera.position.copy(_v1);
      this.controls.target.copy(_v2);
      this.camera.lookAt(_v2);
    } else {
      // 'chase' mode: OrbitControls with automatic descent tracking or 360° Cinematic Auto-Showcase
      if (this.autoShowcaseOrbit && !this.userOrbiting) {
        const orbitAngle = elapsed * 0.34;
        if (this.surfacePhase === 'rover_active' || this.surfacePhase === 'rover_exit') {
          const radius = 5.4 + Math.sin(elapsed * 0.55) * 1.1;
          const height = 1.85 + Math.cos(elapsed * 0.45) * 0.55;
          _v1.set(this.roverPos.x, this.roverPos.y + 0.45, this.roverPos.z);
          _v2.set(
            this.roverPos.x + Math.cos(orbitAngle) * radius,
            Math.max(groundY + 0.85, this.roverPos.y + height),
            this.roverPos.z + Math.sin(orbitAngle) * radius
          );
        } else {
          const radius = 14.5;
          _v1.set(0, this.landerY + 2.5, 0);
          _v2.set(
            Math.cos(orbitAngle) * radius,
            Math.max(groundY + 3.2, this.landerY + 3.8),
            Math.sin(orbitAngle) * radius
          );
        }
        this.controls.target.lerp(_v1, 1 - Math.exp(-8 * dt));
        this.camera.position.lerp(_v2, 1 - Math.exp(-5 * dt));
      } else if (this.surfacePhase === 'descending' && !this.userOrbiting) {
        const distToGround = Math.max(0, this.landerY - groundY);
        const altFrac = THREE.MathUtils.clamp(distToGround / 75.0, 0, 1);
        const desiredTargetY = this.landerY + THREE.MathUtils.lerp(2.7, 2.4, altFrac);
        const desiredPosX = THREE.MathUtils.lerp(7.2, 14.5, altFrac);
        const desiredPosY = Math.max(
          groundY + 3.8,
          this.landerY + THREE.MathUtils.lerp(3.8, 4.8, altFrac)
        );
        const desiredPosZ = THREE.MathUtils.lerp(14.8, 24.5, altFrac);
        const targetAlpha = 1 - Math.exp(-18.0 * dt);
        const posAlpha = 1 - Math.exp(-10.0 * dt);
        _v1.set(0, desiredTargetY, 0);
        _v2.set(desiredPosX, desiredPosY, desiredPosZ);
        this.controls.target.lerp(_v1, targetAlpha);
        this.camera.position.lerp(_v2, posAlpha);
        this.cameraFocusTarget = null;
        this.cameraFocusPos = null;
      } else if (!this.userOrbiting && this.cameraFocusTarget && this.cameraFocusPos) {
        this.controls.target.lerp(this.cameraFocusTarget, 0.08);
        this.camera.position.lerp(this.cameraFocusPos, 0.08);
        if (this.camera.position.distanceTo(this.cameraFocusPos) < 0.25) {
          this.cameraFocusTarget = null;
          this.cameraFocusPos = null;
        }
      }
      this.controls.update();
    }
  }

  public dispose(): void {
    this.disposed = true;
    cancelAnimationFrame(this.frameId);
    clearTimeout(this.frameId);

    window.removeEventListener('resize', this.handleResize);
    this.renderer.domElement.removeEventListener('pointermove', this.handlePointerMove);
    this.renderer.domElement.removeEventListener('pointerdown', this.handlePointerDown);
    this.renderer.domElement.removeEventListener('pointerup', this.handlePointerUp);

    this.controls.dispose();
    this.composer?.dispose();

    this.earthPBR.dispose();
    this.moonPBR.dispose();
    this.marsPBR.dispose();
    this.jupiterPBR.dispose();
    this.europaPBR.dispose();
    this.asteroidPBR.dispose();
    this.proximaPBR.dispose();
    this.milkyWayTexture.dispose();
    this.glowTexture.dispose();
    this.smokeTexture.dispose();
    this.spacecraftAssets.kapton.dispose();
    this.spacecraftAssets.solar.dispose();
    this.spacecraftAssets.shuttleWhite.dispose();
    this.spacecraftAssets.shuttleBlack.dispose();
    this.spacecraftAssets.etFoam.dispose();

    this.scene.traverse((obj) => {
      if (obj instanceof THREE.Mesh || obj instanceof THREE.Line || obj instanceof THREE.Sprite) {
        if ('geometry' in obj && obj.geometry) obj.geometry.dispose();
        if (Array.isArray(obj.material)) obj.material.forEach((m) => m.dispose());
        else obj.material.dispose();
      }
    });

    this.renderer.dispose();
    if (this.renderer.domElement.parentNode === this.container) {
      this.container.removeChild(this.renderer.domElement);
    }
  }
}
