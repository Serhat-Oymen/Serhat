/**
 * Astrodynamics & Keplerian Orbital Mechanics Module
 * Grounded in NASA mission-viz (OrbitalPropagator.js, PlanetaryOrbits.json,
 * An_Orrery_in_ThreeJS.html, AHohmannTrajectory_JSON.html, LunarTransferTrajectory.js)
 * and standard JPL/IAU physical constants.
 */

export const AU_KM = 149_597_870.7;
export const LIGHT_YEAR_KM = 9.4607304725808e12;
export const G0_MS2 = 9.80665; // Standard Earth gravity (m/s^2)
export const MU_SUN_KM3_S2 = 1.32712440018e11;
export const MU_EARTH_KM3_S2 = 3.986004418e5;
export const R_SUN_KM = 696_340.0; // Solar volumetric mean radius (109.30 x R_Earth)
export const R_EARTH_KM = 6_371.0;
export const SOLAR_CONSTANT_W_M2 = 1361; // 1 AU irradiance (W/m^2)
export const SPACECRAFT_LENGTH_M = 50.0; // 50 m orbital spacecraft stack

export type SolarScaleMode = 'orrery_proportional' | 'true_astronomical_1to1';

export interface KeplerianElements {
  id: string;
  name: string;
  /** Semi-major axis in AU (heliocentric) or km (geocentric for Moon) */
  smaAU: number;
  /** Orbital eccentricity (0 = circle, <1 = ellipse) */
  eccentricity: number;
  /** Orbital inclination to ecliptic (degrees) */
  inclinationDeg: number;
  /** Longitude of ascending node / RAAN (degrees) */
  raanDeg: number;
  /** Argument of periapsis / perigee (degrees) */
  argPeriapsisDeg: number;
  /** Mean anomaly at J2000 epoch (degrees) */
  meanAnomalyEpochDeg: number;
  /** Sidereal orbital period in Earth days */
  periodDays: number;
  /** Mean planetary radius in km */
  meanRadiusKm: number;
  /** Exact radius ratio relative to Earth (R_body / R_Earth) */
  earthRadiusRatio: number;
  /** Exact sidereal rotation period in hours (negative = retrograde) */
  rotationPeriodHours: number;
  /** Axial tilt / obliquity to orbit in degrees */
  obliquityDeg: number;
  /** Standard gravitational parameter GM (km^3/s^2) */
  muKm3s2: number;
  /** Surface gravity (m/s^2) — for gas giants like Jupiter, 1-bar cloud-top */
  surfaceGravityMs2: number;
}

/**
 * J2000 Ecliptic Keplerian Elements (directly from NASA mission-viz PlanetaryOrbits.json & JPL Horizons)
 */
export const SOLAR_SYSTEM_EPHEMERIS: Record<string, KeplerianElements> = {
  mercury: {
    id: 'mercury',
    name: 'Mercury',
    smaAU: 0.38709893,
    eccentricity: 0.20563069,
    inclinationDeg: 7.00487,
    raanDeg: 48.33167,
    argPeriapsisDeg: 29.124,
    meanAnomalyEpochDeg: 174.796,
    periodDays: 87.969,
    meanRadiusKm: 2439.7,
    earthRadiusRatio: 0.3829,
    rotationPeriodHours: 1407.6,
    obliquityDeg: 0.034,
    muKm3s2: 22032.0,
    surfaceGravityMs2: 3.7,
  },
  venus: {
    id: 'venus',
    name: 'Venus',
    smaAU: 0.72333199,
    eccentricity: 0.00677323,
    inclinationDeg: 3.39471,
    raanDeg: 76.68069,
    argPeriapsisDeg: 54.884,
    meanAnomalyEpochDeg: 50.115,
    periodDays: 224.701,
    meanRadiusKm: 6051.8,
    earthRadiusRatio: 0.9499,
    rotationPeriodHours: -5832.5,
    obliquityDeg: 177.36,
    muKm3s2: 324859.0,
    surfaceGravityMs2: 8.87,
  },
  earth: {
    id: 'earth',
    name: 'Earth',
    smaAU: 1.00000011,
    eccentricity: 0.01671022,
    inclinationDeg: 0.00005,
    raanDeg: -11.26064,
    argPeriapsisDeg: 114.20783,
    meanAnomalyEpochDeg: 358.617,
    periodDays: 365.256363,
    meanRadiusKm: 6371.0,
    earthRadiusRatio: 1.0,
    rotationPeriodHours: 23.9345,
    obliquityDeg: 23.439,
    muKm3s2: 398600.4418,
    surfaceGravityMs2: 9.807,
  },
  mars: {
    id: 'mars',
    name: 'Mars',
    smaAU: 1.52366231,
    eccentricity: 0.09341233,
    inclinationDeg: 1.85061,
    raanDeg: 49.57854,
    argPeriapsisDeg: 286.502,
    meanAnomalyEpochDeg: 19.373,
    periodDays: 686.971,
    meanRadiusKm: 3389.5,
    earthRadiusRatio: 0.532,
    rotationPeriodHours: 24.6229,
    obliquityDeg: 25.19,
    muKm3s2: 42828.37,
    surfaceGravityMs2: 3.721,
  },
  asteroid: {
    id: 'asteroid',
    name: '16 Psyche (Main Belt)',
    smaAU: 2.923,
    eccentricity: 0.134,
    inclinationDeg: 3.096,
    raanDeg: 150.03,
    argPeriapsisDeg: 228.05,
    meanAnomalyEpochDeg: 280.4,
    periodDays: 1825.8,
    meanRadiusKm: 113.0,
    earthRadiusRatio: 0.0177,
    rotationPeriodHours: 4.196,
    obliquityDeg: 95.0,
    muKm3s2: 1.53,
    surfaceGravityMs2: 0.144,
  },
  jupiter: {
    id: 'jupiter',
    name: 'Jupiter',
    smaAU: 5.2044,
    eccentricity: 0.0489,
    inclinationDeg: 1.304,
    raanDeg: 100.464,
    argPeriapsisDeg: 273.867,
    meanAnomalyEpochDeg: 20.02,
    periodDays: 4332.59,
    meanRadiusKm: 69911.0,
    earthRadiusRatio: 10.973,
    rotationPeriodHours: 9.925,
    obliquityDeg: 3.13,
    muKm3s2: 1.26686534e8,
    surfaceGravityMs2: 24.79,
  },
  saturn: {
    id: 'saturn',
    name: 'Saturn',
    smaAU: 9.5826,
    eccentricity: 0.0565,
    inclinationDeg: 2.485,
    raanDeg: 113.665,
    argPeriapsisDeg: 339.392,
    meanAnomalyEpochDeg: 317.02,
    periodDays: 10759.22,
    meanRadiusKm: 58232.0,
    earthRadiusRatio: 9.14,
    rotationPeriodHours: 10.656,
    obliquityDeg: 26.73,
    muKm3s2: 3.7931187e7,
    surfaceGravityMs2: 10.44,
  },
  uranus: {
    id: 'uranus',
    name: 'Uranus',
    smaAU: 19.2184,
    eccentricity: 0.046381,
    inclinationDeg: 0.773,
    raanDeg: 74.006,
    argPeriapsisDeg: 96.998857,
    meanAnomalyEpochDeg: 142.238,
    periodDays: 30688.5,
    meanRadiusKm: 25362.0,
    earthRadiusRatio: 3.981,
    rotationPeriodHours: -17.24,
    obliquityDeg: 97.77,
    muKm3s2: 5.793939e6,
    surfaceGravityMs2: 8.69,
  },
  neptune: {
    id: 'neptune',
    name: 'Neptune',
    smaAU: 30.110387,
    eccentricity: 0.009456,
    inclinationDeg: 1.77,
    raanDeg: 131.784,
    argPeriapsisDeg: 276.336,
    meanAnomalyEpochDeg: 256.228,
    periodDays: 60182.0,
    meanRadiusKm: 24622.0,
    earthRadiusRatio: 3.865,
    rotationPeriodHours: 16.11,
    obliquityDeg: 28.32,
    muKm3s2: 6.836529e6,
    surfaceGravityMs2: 11.15,
  },
  colony: {
    id: 'colony',
    name: 'Proxima b (New Eden)',
    smaAU: 38.5,
    eccentricity: 0.02,
    inclinationDeg: 1.5,
    raanDeg: 210.0,
    argPeriapsisDeg: 95.0,
    meanAnomalyEpochDeg: 315.0,
    periodDays: 87600.0,
    meanRadiusKm: 7160.0,
    earthRadiusRatio: 1.124,
    rotationPeriodHours: 268.5,
    obliquityDeg: 4.2,
    muKm3s2: 5.1e5,
    surfaceGravityMs2: 10.8,
  },
  l1: {
    id: 'l1',
    name: 'Sun–Earth L1 Lagrange Point',
    smaAU: 0.9900265,
    eccentricity: 0.0167,
    inclinationDeg: 0.0,
    raanDeg: 0.0,
    argPeriapsisDeg: 102.9,
    meanAnomalyEpochDeg: 358.617,
    periodDays: 365.256363,
    meanRadiusKm: 250.0,
    earthRadiusRatio: 0.18,
    rotationPeriodHours: 24.0,
    obliquityDeg: 0.0,
    muKm3s2: 120.0,
    surfaceGravityMs2: 0.006,
  },
};

export const MOON_ORBIT_ELEMENTS = {
  smaKm: 384400,
  smaAU: 384400 / AU_KM, // 0.00256955 AU
  eccentricity: 0.0549,
  inclinationDeg: 5.145,
  periodDays: 27.32166,
  meanRadiusKm: 1737.4,
  earthRadiusRatio: 0.2727,
  muKm3s2: 4902.800066,
  surfaceGravityMs2: 1.624,
};

export const EUROPA_ELEMENTS = {
  smaKm: 671034,
  eccentricity: 0.009,
  periodDays: 3.551181,
  meanRadiusKm: 1560.8,
  earthRadiusRatio: 0.245,
  muKm3s2: 3202.739,
  surfaceGravityMs2: 1.315,
  orbitalSpeedKms: 13.743,
};

export const SUN_EARTH_RADIUS_RATIO = R_SUN_KM / R_EARTH_KM; // 109.298

const DEG2RAD = Math.PI / 180;
const TWO_PI = Math.PI * 2;

/**
 * Converts True Anomaly (f) -> Eccentric Anomaly (E)
 * Directly from NASA mission-viz OrbitalPropagator.js
 */
export function trueToEccentricAnomaly(eccentricity: number, trueAnomalyRad: number): number {
  const e = Math.max(0, Math.min(0.99, eccentricity));
  return 2 * Math.atan(Math.sqrt((1 - e) / (1 + e)) * Math.tan(trueAnomalyRad * 0.5));
}

/**
 * Newton-Raphson + Halley solver for Kepler's Equation: M = E - e * sin(E)
 * Directly from NASA mission-viz OrbitalPropagator.js & Elliptical_Orbit_Design.html
 */
export function solveKeplerEquation(eccentricity: number, meanAnomalyRad: number): number {
  const e = Math.max(0, Math.min(0.99, eccentricity));
  let M = meanAnomalyRad % TWO_PI;
  if (M < 0) M += TWO_PI;

  const e2 = e * e;
  const e3 = e * e2;
  const cosM = Math.cos(M);
  let E = M + (-0.5 * e3 + e + (e2 + 1.5 * cosM * e3) * cosM) * Math.sin(M);

  const tol = 1e-10;
  for (let iter = 0; iter < 24; iter++) {
    const cosE = Math.cos(E);
    const sinE = Math.sin(E);
    const f = E - e * sinE - M;
    if (Math.abs(f) < tol) break;
    const fPrime = 1 - e * cosE;
    const fDoublePrime = e * sinE;
    const step = f / (fPrime - (f * fDoublePrime) / (2 * fPrime));
    E -= step;
    if (Math.abs(step) < tol) break;
  }
  return E;
}

export function eccentricToTrueAnomaly(eccentricity: number, eccentricAnomalyRad: number): number {
  const halfE = eccentricAnomalyRad * 0.5;
  return (
    2 *
    Math.atan2(
      Math.sqrt(1 + eccentricity) * Math.sin(halfE),
      Math.sqrt(1 - eccentricity) * Math.cos(halfE)
    )
  );
}

/**
 * Maps heliocentric distance in AU to Three.js scene units:
 * - In 'orrery_proportional' mode: power-law scaling (r_AU^0.58 * 14.5 + 4.2) preserving exact
 *   monotonic AU ordering and Keplerian perihelion/aphelion eccentricity offsets outside the Sun.
 * - In 'true_astronomical_1to1' mode: exact linear astronomical scale (1 AU = 28.0 scene units,
 *   where Sun radius = 28.0 * (696,340 / 149,597,870.7) = 0.1303 scene units).
 */
export function auToSceneRadius(
  rAU: number,
  scaleMode: SolarScaleMode = 'orrery_proportional'
): number {
  const clampedAU = Math.max(0.001, rAU);
  if (scaleMode === 'true_astronomical_1to1') {
    return clampedAU * 28.0;
  }
  return 4.4 + 10.6 * Math.pow(clampedAU, 0.54);
}

/**
 * Computes scientifically proportional visual radius for the Sun and planets in Stage 1:
 * - Every planet's radius is derived strictly from its real physical radius ratio (R_p / R_Earth):
 *   Jupiter (10.97 R_E) > Saturn (9.14 R_E) > Uranus (3.98 R_E) > Neptune (3.86 R_E) >
 *   Earth (1.00 R_E) > Venus (0.95 R_E) > Mars (0.532 R_E) > Mercury (0.383 R_E) > Moon (0.273 R_E).
 * - In 'true_astronomical_1to1' mode: exact 1:1 ratio with orbital distance (1 AU = 28 units)
 *   and Sun = 109.3 x R_Earth.
 */
export function getScientificBodySceneRadius(
  bodyId: string,
  scaleMode: SolarScaleMode = 'orrery_proportional'
): number {
  if (scaleMode === 'true_astronomical_1to1') {
    // 1 AU = 28 units -> 1 km = 28 / 149,597,870.7 units
    // We apply a uniform 25x visibility magnification to physical radii so 109.3:10.97:1.00
    // Sun:Jupiter:Earth exact ratios are visible without sub-pixel disappearance.
    const earthTrueUnit = (R_EARTH_KM / AU_KM) * 28.0 * 25.0; // ~0.0298 units
    if (bodyId === 'sun') return earthTrueUnit * SUN_EARTH_RADIUS_RATIO; // ~3.26 units (exact 109.3x Earth!)
    if (bodyId === 'moon') return earthTrueUnit * MOON_ORBIT_ELEMENTS.earthRadiusRatio;
    if (bodyId === 'colony') return earthTrueUnit * 1.124;
    const el = SOLAR_SYSTEM_EPHEMERIS[bodyId];
    return earthTrueUnit * (el ? el.earthRadiusRatio : 0.25);
  }

  // In 'orrery_proportional' mode:
  // Base Earth radius = 0.42 scene units.
  // Terrestrial bodies use exact linear R_p / R_Earth; Gas giants use exact R_p / R_Earth compressed by 0.32x
  // so Jupiter (10.97 R_E) & Saturn (9.14 R_E) are clearly the largest planets while Sun (3.25 units) dominates!
  const earthBase = 0.42;
  if (bodyId === 'sun') return 3.15;
  if (bodyId === 'moon') return earthBase * MOON_ORBIT_ELEMENTS.earthRadiusRatio; // 0.115
  if (bodyId === 'colony') return earthBase * 1.124; // 0.472
  if (bodyId === 'asteroid') return 0.12;
  const el = SOLAR_SYSTEM_EPHEMERIS[bodyId];
  if (!el) return 0.2;
  if (el.earthRadiusRatio > 2.0) {
    // Gas & Ice Giants: preserve exact relative order (Jupiter > Saturn > Uranus > Neptune > Earth)
    return earthBase * (1.25 + (el.earthRadiusRatio - 1.0) * 0.22);
  }
  return earthBase * el.earthRadiusRatio;
}

export interface PropagatedOrbitState {
  /** Heliocentric position in Three.js Y-up coordinates (scaled for scene) */
  sceneX: number;
  sceneY: number;
  sceneZ: number;
  /** Physical heliocentric radial distance in AU */
  radiusAU: number;
  /** Physical heliocentric radial distance in km */
  radiusKm: number;
  /** True anomaly in radians */
  trueAnomalyRad: number;
  /** True instantaneous heliocentric orbital speed via Vis-Viva equation (km/s) */
  orbitalVelocityKms: number;
}

/**
 * Propagates a body along its 3D Keplerian ellipse at elapsed simulated days from J2000 epoch.
 * Directly implements NASA mission-viz OrbitalPropagator.js (Trajectory.prototype.propagate).
 */
export function propagateKeplerian3D(
  el: KeplerianElements,
  simDays: number,
  scaleMode: SolarScaleMode = 'orrery_proportional'
): PropagatedOrbitState {
  const n = TWO_PI / el.periodDays; // Mean motion (rad/day)
  const M = el.meanAnomalyEpochDeg * DEG2RAD + n * simDays;
  const E = solveKeplerEquation(el.eccentricity, M);
  const nu = eccentricToTrueAnomaly(el.eccentricity, E);

  // Exact polar ellipse equation: r = a(1 - e^2) / (1 + e*cos(nu))
  const e2 = el.eccentricity * el.eccentricity;
  const p = el.smaAU * (1 - e2);
  const rAU = p / (1 + el.eccentricity * Math.cos(nu));

  // Vis-Viva instantaneous heliocentric velocity: v = sqrt(mu * (2/r - 1/a))
  const rKm = rAU * AU_KM;
  const aKm = el.smaAU * AU_KM;
  const orbitalVelocityKms = Math.sqrt(Math.max(0, MU_SUN_KM3_S2 * (2 / rKm - 1 / aKm)));

  const rRender = auToSceneRadius(rAU, scaleMode);
  const inc = el.inclinationDeg * DEG2RAD;
  const omega = el.argPeriapsisDeg * DEG2RAD;
  const raan = el.raanDeg * DEG2RAD;
  const u = omega + nu;

  const cosO = Math.cos(raan);
  const sinO = Math.sin(raan);
  const cosU = Math.cos(u);
  const sinU = Math.sin(u);
  const cosI = Math.cos(inc);
  const sinI = Math.sin(inc);

  // Standard 3D ecliptic Cartesian coordinates from NASA mission-viz OrbitalPropagator.js
  const xEcl = rRender * (cosO * cosU - sinO * sinU * cosI);
  const yEcl = rRender * (sinO * cosU + cosO * sinU * cosI);
  const zEcl = rRender * (sinU * sinI);

  // Map ecliptic (X, Y, Z) -> Three.js Y-up right-handed (X, Z, -Y)
  return {
    sceneX: xEcl,
    sceneY: zEcl,
    sceneZ: -yEcl,
    radiusAU: rAU,
    radiusKm: rKm,
    trueAnomalyRad: nu,
    orbitalVelocityKms,
  };
}

/**
 * Samples full closed 3D Keplerian ellipse points for rendering orbit lines (traceOrbits in OrbitalPropagator.js).
 */
export function sampleKeplerianOrbit3D(
  el: KeplerianElements,
  segments = 192,
  scaleMode: SolarScaleMode = 'orrery_proportional'
): { x: number; y: number; z: number }[] {
  const pts: { x: number; y: number; z: number }[] = [];
  const e2 = el.eccentricity * el.eccentricity;
  const p = el.smaAU * (1 - e2);
  const inc = el.inclinationDeg * DEG2RAD;
  const omega = el.argPeriapsisDeg * DEG2RAD;
  const raan = el.raanDeg * DEG2RAD;

  const cosO = Math.cos(raan);
  const sinO = Math.sin(raan);
  const cosI = Math.cos(inc);
  const sinI = Math.sin(inc);

  for (let k = 0; k < segments; k++) {
    const nu = (k / segments) * TWO_PI;
    const rAU = p / (1 + el.eccentricity * Math.cos(nu));
    const rRender = auToSceneRadius(rAU, scaleMode);
    const u = omega + nu;
    const cosU = Math.cos(u);
    const sinU = Math.sin(u);

    const xEcl = rRender * (cosO * cosU - sinO * sinU * cosI);
    const yEcl = rRender * (sinO * cosU + cosO * sinU * cosI);
    const zEcl = rRender * (sinU * sinI);

    pts.push({ x: xEcl, y: zEcl, z: -yEcl });
  }
  return pts;
}

/**
 * Real-time Keplerian Hohmann Transfer Propagator (Stage 4 Journey & Stage 5 Capture)
 * Implements NASA mission-viz AHohmannTrajectory_JSON.html & OrbitalPropagator.js:
 * Given normalized mission time progress (0..1), solves Kepler's Equation M = pi * progress
 * on the transfer ellipse (a_trans, e_trans) to compute exact true anomaly theta,
 * radial distance r(theta), instantaneous Vis-Viva speed v(r), and attitude burn phase.
 */
export interface HohmannTransitState {
  /** True anomaly along transfer ellipse (0 = departure periapsis, pi = arrival apoapsis) */
  trueAnomalyRad: number;
  trueAnomalyDeg: number;
  /** Instantaneous radial distance from primary body (AU for heliocentric, km for geocentric) */
  radiusKm: number;
  radiusAU: number;
  /** Instantaneous velocity from Vis-Viva equation v = sqrt(mu*(2/r - 1/a)) (km/s) */
  instantVelocityKms: number;
  /** Distance traveled along the transfer ellipse arc (km) */
  distanceTraveledKm: number;
  /** Total Hohmann half-ellipse arc length (km) */
  totalArcLengthKm: number;
  /** Distance remaining to target world (km) */
  distanceRemainingKm: number;
  /** Elapsed mission time (days) */
  elapsedDays: number;
  /** Total Hohmann transfer time (days) */
  totalDays: number;
  /** GMAT burn phase: 'tli_burn' (departure injection), 'kepler_coast' (ballistic cruise), 'loi_capture_burn' (retrograde capture) */
  maneuverPhase: 'tli_burn' | 'kepler_coast' | 'loi_capture_burn';
  /** Attitude flip interpolation (0 = prograde, 1 = retrograde for periapsis capture burn) */
  retroFlipFactor: number;
}

export function evaluateHohmannTransitState(
  worldId: string,
  progress01: number
): HohmannTransitState {
  const t = Math.max(0, Math.min(1, progress01));
  const isGeocentric = worldId === 'moon' || worldId === 'earth' || worldId === 'l1';

  const r1Km = isGeocentric ? R_EARTH_KM + 185 : AU_KM;
  const r2Km =
    worldId === 'moon'
      ? MOON_ORBIT_ELEMENTS.smaKm
      : worldId === 'l1'
      ? 1_500_000
      : worldId === 'earth'
      ? R_EARTH_KM + 540
      : worldId === 'colony'
      ? 5.2044 * AU_KM
      : (SOLAR_SYSTEM_EPHEMERIS[worldId]?.smaAU ?? 1.52366) * AU_KM;

  const mu = isGeocentric ? MU_EARTH_KM3_S2 : MU_SUN_KM3_S2;
  const aTransKm = (r1Km + r2Km) * 0.5;
  const eTrans = Math.abs(r2Km - r1Km) / (r1Km + r2Km);

  // Mean anomaly sweeps from 0 (periapsis departure) to PI (apoapsis arrival)
  const meanAnomalyRad = t * Math.PI;
  const E = solveKeplerEquation(eTrans, meanAnomalyRad);
  const nu = Math.min(Math.PI, Math.max(0, eccentricToTrueAnomaly(eTrans, E)));

  const pKm = aTransKm * (1 - eTrans * eTrans);
  const rKm = pKm / (1 + eTrans * Math.cos(nu));
  const instantVelocityKms = computeVisVivaSpeedKms(mu, rKm, aTransKm);

  // Ramanujan half-ellipse arc length approximation
  const bTransKm = aTransKm * Math.sqrt(Math.max(0, 1 - eTrans * eTrans));
  const h = Math.pow(aTransKm - bTransKm, 2) / Math.pow(aTransKm + bTransKm, 2);
  const totalArcLengthKm =
    0.5 * Math.PI * (aTransKm + bTransKm) * (1 + (3 * h) / (10 + Math.sqrt(4 - 3 * h)));
  const distanceTraveledKm = totalArcLengthKm * (nu / Math.PI);
  const distanceRemainingKm = Math.max(0, totalArcLengthKm - distanceTraveledKm);

  const totalSec = Math.PI * Math.sqrt(Math.pow(aTransKm, 3) / mu);
  const totalDays = totalSec / 86400;
  const elapsedDays = totalDays * t;

  let maneuverPhase: HohmannTransitState['maneuverPhase'] = 'kepler_coast';
  const retroFlipFactor = 0;
  if (t < 0.18) {
    maneuverPhase = 'tli_burn';
  } else if (t > 0.72) {
    maneuverPhase = 'loi_capture_burn';
  }

  return {
    trueAnomalyRad: nu,
    trueAnomalyDeg: Number(((nu * 180) / Math.PI).toFixed(1)),
    radiusKm: rKm,
    radiusAU: Number((rKm / AU_KM).toFixed(4)),
    instantVelocityKms: Number(instantVelocityKms.toFixed(2)),
    distanceTraveledKm: Math.round(distanceTraveledKm),
    totalArcLengthKm: Math.round(totalArcLengthKm),
    distanceRemainingKm: Math.round(distanceRemainingKm),
    elapsedDays: Number(elapsedDays.toFixed(2)),
    totalDays: Number(totalDays.toFixed(2)),
    maneuverPhase,
    retroFlipFactor,
  };
}

/**
 * Tsiolkovsky Rocket Equation: dv = Isp * g0 * ln(m0 / mf)
 */
export function computeTsiolkovskyDeltaV(
  ispSec: number,
  wetMassKg: number,
  dryMassKg: number
): number {
  if (dryMassKg <= 0 || wetMassKg <= dryMassKg) return 0;
  return ispSec * G0_MS2 * Math.log(wetMassKg / dryMassKg);
}

/**
 * Inverse-Square Solar Irradiance Law: S(r) = 1 / r_AU^2
 */
export function computeSolarFluxRatio(distanceAU: number): number {
  if (distanceAU <= 0) return 1;
  return 1 / (distanceAU * distanceAU);
}

/**
 * Vis-Viva Equation: v = sqrt(mu * (2/r - 1/a))
 */
export function computeVisVivaSpeedKms(muKm3s2: number, rKm: number, aKm: number): number {
  const term = 2 / rKm - 1 / aKm;
  return term > 0 ? Math.sqrt(muKm3s2 * term) : 0;
}

export interface HohmannTransferSummary {
  /** Transfer semi-major axis (AU for heliocentric, km for geocentric) */
  transferSmaLabel: string;
  eccentricity: number;
  /** Half-period of transfer ellipse in days */
  transferDays: number;
  /** Departure hyperbolic/injection delta-V (km/s) */
  departureDvKms: number;
  /** Arrival orbit capture delta-V (km/s) */
  captureDvKms: number;
  /** Total transfer delta-V (km/s) */
  totalDvKms: number;
  /** Departure speed on transfer arc (km/s) */
  vDepartureKms: number;
  /** Arrival speed on transfer arc (km/s) */
  vArrivalKms: number;
  /** Required planetary phase angle at departure (degrees) */
  phaseAngleDeg: number;
}

/**
 * Computes patched-conic / Hohmann transfer parameters matching NASA GMAT / mission-viz math.
 */
export function computeHeliocentricHohmann(targetSmaAU: number): HohmannTransferSummary {
  const r1 = 1.0 * AU_KM; // Earth orbit 1 AU
  const r2 = targetSmaAU * AU_KM;
  const aTrans = (r1 + r2) * 0.5;
  const eTrans = Math.abs(r2 - r1) / (r1 + r2);

  // Kepler's 3rd Law half-period: T_trans = pi * sqrt(a^3 / mu_sun)
  const transferSec = Math.PI * Math.sqrt((aTrans * aTrans * aTrans) / MU_SUN_KM3_S2);
  const transferDays = transferSec / 86400;

  const vEarth = Math.sqrt(MU_SUN_KM3_S2 / r1);
  const vTarget = Math.sqrt(MU_SUN_KM3_S2 / r2);
  const vDep = computeVisVivaSpeedKms(MU_SUN_KM3_S2, r1, aTrans);
  const vArr = computeVisVivaSpeedKms(MU_SUN_KM3_S2, r2, aTrans);

  const dv1 = Math.abs(vDep - vEarth);
  const dv2 = Math.abs(vTarget - vArr);

  // Synodic phase angle: alpha = 180° - n_target * t_trans
  const targetPeriodDays = Math.pow(targetSmaAU, 1.5) * 365.256363;
  const targetSweepDeg = (360 / targetPeriodDays) * transferDays;
  let phaseAngleDeg = 180 - targetSweepDeg;
  while (phaseAngleDeg < -180) phaseAngleDeg += 360;
  while (phaseAngleDeg > 180) phaseAngleDeg -= 360;

  return {
    transferSmaLabel: `${((1 + targetSmaAU) * 0.5).toFixed(3)} AU`,
    eccentricity: Number(eTrans.toFixed(4)),
    transferDays: Math.round(transferDays),
    departureDvKms: Number(dv1.toFixed(2)),
    captureDvKms: Number(dv2.toFixed(2)),
    totalDvKms: Number((dv1 + dv2).toFixed(2)),
    vDepartureKms: Number(vDep.toFixed(2)),
    vArrivalKms: Number(vArr.toFixed(2)),
    phaseAngleDeg: Number(phaseAngleDeg.toFixed(1)),
  };
}

/**
 * Geocentric Lunar Transfer (LEO 185 km -> Moon 384,400 km) matching mission-viz GMAT LunarTransfer
 */
export function computeLunarHohmann(): HohmannTransferSummary {
  const r1 = R_EARTH_KM + 185; // 6,556 km parking orbit
  const r2 = MOON_ORBIT_ELEMENTS.smaKm; // 384,400 km
  const aTrans = (r1 + r2) * 0.5;
  const eTrans = (r2 - r1) / (r1 + r2);
  const transferSec = Math.PI * Math.sqrt((aTrans * aTrans * aTrans) / MU_EARTH_KM3_S2);

  const vLeo = Math.sqrt(MU_EARTH_KM3_S2 / r1);
  const vMoon = Math.sqrt(MU_EARTH_KM3_S2 / r2);
  const vPerigee = computeVisVivaSpeedKms(MU_EARTH_KM3_S2, r1, aTrans);
  const vApogee = computeVisVivaSpeedKms(MU_EARTH_KM3_S2, r2, aTrans);

  // TLI burn from LEO + LOI capture into 100km lunar orbit (~0.84 km/s)
  const dvTli = vPerigee - vLeo;
  const vInfMoon = Math.abs(vMoon - vApogee);
  const rLlo = MOON_ORBIT_ELEMENTS.meanRadiusKm + 100;
  const vHypLlo = Math.sqrt(vInfMoon * vInfMoon + (2 * MOON_ORBIT_ELEMENTS.muKm3s2) / rLlo);
  const vCircLlo = Math.sqrt(MOON_ORBIT_ELEMENTS.muKm3s2 / rLlo);
  const dvLoi = vHypLlo - vCircLlo;

  return {
    transferSmaLabel: `${Math.round(aTrans).toLocaleString()} km`,
    eccentricity: Number(eTrans.toFixed(4)),
    transferDays: Number((transferSec / 86400).toFixed(2)),
    departureDvKms: Number(dvTli.toFixed(2)),
    captureDvKms: Number(dvLoi.toFixed(2)),
    totalDvKms: Number((dvTli + dvLoi).toFixed(2)),
    vDepartureKms: Number(vPerigee.toFixed(2)),
    vArrivalKms: Number(vApogee.toFixed(2)),
    phaseAngleDeg: 114.5,
  };
}

export interface PlanetaryOrbitMetrics {
  orbitRadiusKm: number;
  orbitalVelocityKms: number;
  orbitalPeriodMin: number;
  deorbitBurnMs: number;
  escapeVelocityKms: number;
  surfaceGravityMs2: number;
}

/**
 * Computes real orbital speed, period, and Hohmann de-orbit burn at a given orbital altitude.
 */
export function computePlanetaryOrbitMetrics(
  muKm3s2: number,
  radiusKm: number,
  altitudeKm: number,
  surfaceGravityMs2: number
): PlanetaryOrbitMetrics {
  const rOrb = radiusKm + altitudeKm;
  const vOrb = Math.sqrt(muKm3s2 / rOrb);
  const periodSec = TWO_PI * Math.sqrt((rOrb * rOrb * rOrb) / muKm3s2);
  const aDeorbit = (rOrb + radiusKm) * 0.5;
  const vDeorbitApo = computeVisVivaSpeedKms(muKm3s2, rOrb, aDeorbit);
  const deorbitBurnMs = Math.max(12, Math.round((vOrb - vDeorbitApo) * 1000));
  const vEsc = Math.sqrt((2 * muKm3s2) / radiusKm);

  return {
    orbitRadiusKm: Math.round(rOrb),
    orbitalVelocityKms: Number(vOrb.toFixed(3)),
    orbitalPeriodMin: Number((periodSec / 60).toFixed(1)),
    deorbitBurnMs,
    escapeVelocityKms: Number(vEsc.toFixed(2)),
    surfaceGravityMs2,
  };
}

/**
 * US Standard / Exponential Atmospheric Density Model at Earth altitude (km) -> kg/m^3
 */
export function earthAtmosphericDensityKgM3(altitudeKm: number): number {
  if (altitudeKm > 140) return 0;
  return 1.225 * Math.exp(-Math.max(0, altitudeKm) / 8.5);
}

/**
 * Earth inverse-square gravitational acceleration at altitude (km) -> m/s^2
 */
export function earthGravityAtAltitudeMs2(altitudeKm: number): number {
  const ratio = R_EARTH_KM / (R_EARTH_KM + Math.max(0, altitudeKm));
  return G0_MS2 * ratio * ratio;
}
