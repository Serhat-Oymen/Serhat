import * as THREE from 'three';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import {
  CommanderConfig,
  CRAFT_CLASSES,
  ENGINE_OPTIONS,
  FUEL_OPTIONS,
  HangarConfig,
  SHIELD_TIERS,
  SUIT_PALETTE_OPTIONS,
  VISOR_OPTIONS,
} from '../data/missionData';
import { PBRTextureSet } from './proceduralTextures';

interface NasaShuttleGlbCache {
  orbiterTemplate: THREE.Group;
  externalTankTemplate: THREE.Group;
  srbTemplate: THREE.Group;
}

let nasaGlbCache: NasaShuttleGlbCache | null = null;
let nasaGlbLoading = false;
const nasaGlbCallbacks: Array<(cache: NasaShuttleGlbCache) => void> = [];

function normalizeGlbMaterials(root: THREE.Object3D, isOrbiter = false): void {
  root.traverse((obj) => {
    const mesh = obj as THREE.Mesh;
    if (!mesh.isMesh) return;
    mesh.castShadow = true;
    mesh.receiveShadow = true;

    const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    mats.forEach((m) => {
      const std = m as THREE.MeshStandardMaterial;
      if (!std) return;
      if (std.map) {
        std.map.colorSpace = THREE.SRGBColorSpace;
      }
      if (isOrbiter) {
        if (std.name === 'belly') {
          std.color.setHex(0x1e293b);
          std.roughness = 0.52;
          std.metalness = 0.22;
        } else if (std.name === 'shut-glass') {
          std.color.setHex(0x0f172a);
          std.roughness = 0.12;
          std.metalness = 0.58;
        }
      }
      std.needsUpdate = true;
    });
  });
}

function reset3DSRootRotation(scene: THREE.Object3D): void {
  scene.traverse((child) => {
    if (child.name === '<3DSRoot>') {
      child.rotation.set(0, 0, 0);
      child.quaternion.identity();
      child.updateMatrix();
    }
  });
}

function onNasaShuttleGlbsReady(cb: (cache: NasaShuttleGlbCache) => void): void {
  if (nasaGlbCache) {
    cb(nasaGlbCache);
    return;
  }
  nasaGlbCallbacks.push(cb);
  if (nasaGlbLoading) return;
  nasaGlbLoading = true;

  const loader = new GLTFLoader();
  Promise.all([
    loader.loadAsync('/assets/models/space-shuttle-d.glb'),
    loader.loadAsync('/assets/models/space-shuttle-d-door-prt.glb'),
    loader.loadAsync('/assets/models/space-shuttle-d-door-stb.glb'),
    loader.loadAsync('/assets/models/space-shuttle-d-eng.glb'),
    loader.loadAsync('/assets/models/external-tank.glb'),
    loader.loadAsync('/assets/models/solid-rocket-booster.glb'),
  ])
    .then(([shuttleGltf, doorPrtGltf, doorStbGltf, engGltf, etGltf, srbGltf]) => {
      normalizeGlbMaterials(shuttleGltf.scene, true);
      normalizeGlbMaterials(doorPrtGltf.scene, true);
      normalizeGlbMaterials(doorStbGltf.scene, true);

      reset3DSRootRotation(engGltf.scene);
      normalizeGlbMaterials(engGltf.scene, true);

      reset3DSRootRotation(etGltf.scene);
      normalizeGlbMaterials(etGltf.scene, false);

      reset3DSRootRotation(srbGltf.scene);
      normalizeGlbMaterials(srbGltf.scene, false);

      // Assemble complete NASA Space Shuttle Orbiter template in native coordinates (+X nose, +-Y wings, +Z dorsal tail)
      const orbiterNative = new THREE.Group();
      orbiterNative.add(shuttleGltf.scene);
      orbiterNative.add(doorPrtGltf.scene);
      orbiterNative.add(doorStbGltf.scene);

      // Mount the 3 RS-25 SSME main engine bells at the aft fuselage bulkhead
      const ssmeOffsets: Array<[number, number, number]> = [
        [-535, 0, 35],
        [-535, -62, -52],
        [-535, 62, -52],
      ];
      ssmeOffsets.forEach(([ex, ey, ez]) => {
        const engClone = engGltf.scene.clone(true);
        engClone.position.set(ex, ey, ez);
        orbiterNative.add(engClone);
      });

      // Rotate +90 deg around Z so +X (Nose) -> +Y (App Up/Forward), +-Y (Wings) -> +-X, +Z (Dorsal Tail/Cockpit) -> +Z
      orbiterNative.rotation.z = Math.PI / 2;
      orbiterNative.scale.setScalar(0.0041);
      orbiterNative.position.set(0, 3.05, 0);

      const orbiterTemplate = new THREE.Group();
      orbiterTemplate.add(orbiterNative);

      // External Tank template (+X nose -> +Y Up, +Z shuttle attachment struts -> +Z Front)
      const etNative = new THREE.Group();
      etNative.add(etGltf.scene);
      etNative.rotation.z = Math.PI / 2;
      const externalTankTemplate = new THREE.Group();
      externalTankTemplate.add(etNative);

      // Solid Rocket Booster template (+X nose -> +Y Up)
      const srbNative = new THREE.Group();
      srbNative.add(srbGltf.scene);
      srbNative.rotation.z = Math.PI / 2;
      const srbTemplate = new THREE.Group();
      srbTemplate.add(srbNative);

      nasaGlbCache = {
        orbiterTemplate,
        externalTankTemplate,
        srbTemplate,
      };

      while (nasaGlbCallbacks.length > 0) {
        const next = nasaGlbCallbacks.shift();
        next?.(nasaGlbCache);
      }
    })
    .catch((err) => {
      console.error('Failed to load NASA Space Shuttle GLB models:', err);
    });
}

export interface SpacecraftPBRAssets {
  kapton: PBRTextureSet;
  solar: PBRTextureSet;
  shuttleWhite: PBRTextureSet;
  shuttleBlack: PBRTextureSet;
  etFoam: PBRTextureSet;
  glow: THREE.Texture;
}

export interface HangarSpacecraftRig {
  root: THREE.Group;
  dishGroup: THREE.Group;
}

export interface CarrierRocketRig {
  root: THREE.Group;
  coreGroup: THREE.Group;
  srbLeft: THREE.Group;
  srbRight: THREE.Group;
  bayDoorLeft: THREE.Group;
  bayDoorRight: THREE.Group;
  payloadMount: THREE.Group;
  payloadRestY: number;
  srbOffsetX: number;
  srbFlames: THREE.Group;
  mainFlames: THREE.Group;
  craftFlame: THREE.Group;
  dishGroup: THREE.Group;
}

/**
 * Photorealistic Fresnel Atmospheric Rim Shader for Planets & Radiation Shields
 */
export function createAtmosphereMesh(
  radius: number,
  colorHex: number,
  intensity = 0.72,
  power = 3.2
): THREE.Mesh {
  const mat = new THREE.ShaderMaterial({
    uniforms: {
      uColor: { value: new THREE.Color(colorHex) },
      uIntensity: { value: intensity },
      uPower: { value: power },
    },
    vertexShader: `
      varying vec3 vNormalWorld;
      varying vec3 vViewDir;
      void main() {
        vec4 worldPos = modelMatrix * vec4(position, 1.0);
        vNormalWorld = normalize(mat3(modelMatrix) * normal);
        vViewDir = normalize(cameraPosition - worldPos.xyz);
        gl_Position = projectionMatrix * viewMatrix * worldPos;
      }
    `,
    fragmentShader: `
      uniform vec3 uColor;
      uniform float uIntensity;
      uniform float uPower;
      varying vec3 vNormalWorld;
      varying vec3 vViewDir;
      void main() {
        float ndotv = max(0.0, dot(normalize(vNormalWorld), normalize(vViewDir)));
        float fresnel = pow(1.0 - ndotv, uPower);
        gl_FragColor = vec4(uColor * uIntensity * 0.78, fresnel * uIntensity * 0.78);
      }
    `,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    side: THREE.FrontSide,
  });

  const mesh = new THREE.Mesh(new THREE.SphereGeometry(radius, 48, 36), mat);
  mesh.renderOrder = 4;
  return mesh;
}

/**
 * IMG_6714 Photorealistic Spacecraft Bus:
 * - Crinkled gold Kapton MLI thermal blanket (normal + roughness mapped)
 * - White thermal radiator panels with recessed louvers, bolt studs & telemetry beacons
 * - Precision carbon-composite parabolic dish with tripod sub-reflector & gold feed horn
 * - Clearcoated triple-junction GaAs solar wings with articulated yokes (or Nuclear RTG)
 * - Sleek Fresnel physical radiation shield envelope (Thin / Medium / Thick)
 */
export function buildHangarSpacecraft(
  config: HangarConfig,
  assets: SpacecraftPBRAssets
): HangarSpacecraftRig {
  const root = new THREE.Group();
  const craftSpec = CRAFT_CLASSES.find((c) => c.id === config.craftClass) || CRAFT_CLASSES[1];

  const goldFoilMat = new THREE.MeshPhysicalMaterial({
    map: assets.kapton.map,
    normalMap: assets.kapton.normalMap,
    normalScale: new THREE.Vector2(1.45, 1.45),
    roughnessMap: assets.kapton.roughnessMap,
    color: 0xf6c453,
    roughness: 0.28,
    metalness: 0.9,
    clearcoat: 0.2,
    clearcoatRoughness: 0.24,
  });

  const whitePanelMat = new THREE.MeshPhysicalMaterial({
    color: 0xe6ecf4,
    roughness: 0.36,
    metalness: 0.1,
    clearcoat: 0.2,
    clearcoatRoughness: 0.28,
  });

  const brushedTitaniumMat = new THREE.MeshStandardMaterial({
    color: 0x334155,
    roughness: 0.32,
    metalness: 0.88,
  });

  const darkCarbonMat = new THREE.MeshStandardMaterial({
    color: 0x111827,
    roughness: 0.45,
    metalness: 0.65,
  });

  const solarMat = new THREE.MeshPhysicalMaterial({
    map: assets.solar.map,
    roughnessMap: assets.solar.roughnessMap,
    color: 0xdbeafe,
    roughness: 0.18,
    metalness: 0.55,
    clearcoat: 1.0,
    clearcoatRoughness: 0.06,
  });

  const nozzleMat = new THREE.MeshStandardMaterial({
    color: 0x7c2d12,
    roughness: 0.34,
    metalness: 0.86,
  });

  const scaleFactor =
    config.craftClass === 'heavy' ? 1.18 : config.craftClass === 'light' ? 0.86 : 1.0;

  // 1. Machined Launch Adapter Skirt & Gimbaled Main Engine Bells
  const adapterBase = new THREE.Mesh(
    new THREE.CylinderGeometry(0.76 * scaleFactor, 0.94 * scaleFactor, 0.52, 36),
    brushedTitaniumMat
  );
  adapterBase.position.y = 0.26;
  adapterBase.castShadow = true;
  adapterBase.receiveShadow = true;
  root.add(adapterBase);

  const adapterFlange = new THREE.Mesh(
    new THREE.TorusGeometry(0.92 * scaleFactor, 0.045, 14, 48),
    darkCarbonMat
  );
  adapterFlange.rotation.x = Math.PI / 2;
  adapterFlange.position.y = 0.04;
  root.add(adapterFlange);

  // Bell nozzle lathe profile
  const bellProfile = [
    new THREE.Vector2(0.08, 0.22),
    new THREE.Vector2(0.06, 0.12),
    new THREE.Vector2(0.14, -0.02),
    new THREE.Vector2(0.22, -0.22),
    new THREE.Vector2(0.24, -0.32),
  ];
  const bellGeo = new THREE.LatheGeometry(bellProfile, 28);
  const nozzleCount = config.craftClass === 'heavy' ? 3 : config.craftClass === 'light' ? 1 : 2;
  for (let i = 0; i < nozzleCount; i++) {
    const a = (i / nozzleCount) * Math.PI * 2;
    const offset = nozzleCount === 1 ? 0 : 0.3 * scaleFactor;
    const bell = new THREE.Mesh(bellGeo, nozzleMat);
    bell.position.set(Math.cos(a) * offset, 0.12, Math.sin(a) * offset);
    bell.castShadow = true;
    root.add(bell);
  }

  // 2. Octagonal Crinkled Gold Kapton MLI Spacecraft Bus
  const radius = 0.96 * scaleFactor;
  const bodyHeight =
    2.08 * (config.craftClass === 'heavy' ? 1.12 : config.craftClass === 'light' ? 0.9 : 1.0);
  const coreMesh = new THREE.Mesh(
    new THREE.CylinderGeometry(radius, radius * 1.03, bodyHeight, 8, 4),
    goldFoilMat
  );
  coreMesh.position.y = 0.52 + bodyHeight / 2;
  coreMesh.castShadow = true;
  coreMesh.receiveShadow = true;
  root.add(coreMesh);

  // Machined Aluminum Structural Bulkhead Collars + Corner Gussets
  const topCollar = new THREE.Mesh(
    new THREE.CylinderGeometry(radius * 1.05, radius * 1.05, 0.13, 32),
    brushedTitaniumMat
  );
  topCollar.position.y = 0.52 + bodyHeight;
  topCollar.castShadow = true;
  root.add(topCollar);

  const botCollar = new THREE.Mesh(
    new THREE.CylinderGeometry(radius * 1.06, radius * 1.06, 0.14, 32),
    brushedTitaniumMat
  );
  botCollar.position.y = 0.52;
  botCollar.castShadow = true;
  root.add(botCollar);

  // Upper avionics bay instrumentation deck
  const upperDeck = new THREE.Mesh(
    new THREE.CylinderGeometry(radius * 0.88, radius * 0.96, 0.24, 32),
    darkCarbonMat
  );
  upperDeck.position.y = 0.52 + bodyHeight + 0.15;
  root.add(upperDeck);

  // 4-axis RCS Attitude Thruster Quads
  for (let i = 0; i < 4; i++) {
    const a = (i * Math.PI) / 2 + Math.PI / 4;
    const rcsPod = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.14, 0.18), brushedTitaniumMat);
    rcsPod.position.set(
      Math.cos(a) * (radius + 0.08),
      0.52 + bodyHeight - 0.18,
      Math.sin(a) * (radius + 0.08)
    );
    rcsPod.rotation.y = -a;
    root.add(rcsPod);
  }

  // 3. White Thermal Radiator / Avionics Louver Panels (IMG_6714)
  for (let i = 0; i < 4; i++) {
    const angle = (i * Math.PI) / 2;
    const panelGroup = new THREE.Group();
    const dist = radius * 0.95;
    panelGroup.position.set(
      Math.sin(angle) * dist,
      0.52 + bodyHeight / 2,
      Math.cos(angle) * dist
    );
    panelGroup.rotation.y = angle;

    const panel = new THREE.Mesh(
      new THREE.BoxGeometry(0.82 * scaleFactor, bodyHeight * 0.68, 0.07),
      whitePanelMat
    );
    panel.castShadow = true;
    panel.receiveShadow = true;
    panelGroup.add(panel);

    // Recessed radiator louvers
    for (let l = -2; l <= 2; l++) {
      const louver = new THREE.Mesh(
        new THREE.BoxGeometry(0.62 * scaleFactor, 0.04, 0.085),
        brushedTitaniumMat
      );
      louver.position.y = l * 0.2;
      panelGroup.add(louver);
    }

    // Precision gold Kapton foil patch / star-tracker port
    const port = new THREE.Mesh(
      new THREE.CylinderGeometry(0.08, 0.09, 0.1, 16),
      darkCarbonMat
    );
    port.rotation.x = Math.PI / 2;
    port.position.set(0.22 * scaleFactor, bodyHeight * 0.24, 0.04);
    panelGroup.add(port);

    root.add(panelGroup);
  }

  // 4. Wide White Carbon-Composite Parabolic High-Gain Dish + Gimbal Tripod + Copper Feed Horn
  const dishGroup = new THREE.Group();
  dishGroup.position.y = 0.52 + bodyHeight + 0.24;

  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
    const strut = new THREE.Mesh(
      new THREE.CylinderGeometry(0.032, 0.042, 0.52, 12),
      brushedTitaniumMat
    );
    strut.position.set(
      Math.cos(a) * 0.4 * scaleFactor,
      0.22,
      Math.sin(a) * 0.4 * scaleFactor
    );
    strut.rotation.z = Math.cos(a) * 0.38;
    strut.rotation.x = -Math.sin(a) * 0.38;
    dishGroup.add(strut);
  }

  const dishPoints = [
    new THREE.Vector2(0, 0),
    new THREE.Vector2(0.32, 0.03),
    new THREE.Vector2(0.72, 0.13),
    new THREE.Vector2(1.12, 0.34),
    new THREE.Vector2(1.36, 0.54),
    new THREE.Vector2(1.32, 0.57),
    new THREE.Vector2(0.72, 0.18),
    new THREE.Vector2(0, 0.06),
  ];
  const dishMesh = new THREE.Mesh(new THREE.LatheGeometry(dishPoints, 48), whitePanelMat);
  dishMesh.scale.setScalar(scaleFactor);
  dishMesh.position.y = 0.36;
  dishMesh.castShadow = true;
  dishMesh.receiveShadow = true;
  dishGroup.add(dishMesh);

  // Sub-reflector tripod & gold coaxial waveguide feed horn
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * Math.PI * 2;
    const feedStrut = new THREE.Mesh(
      new THREE.CylinderGeometry(0.016, 0.018, 0.72 * scaleFactor, 8),
      darkCarbonMat
    );
    feedStrut.position.set(
      Math.cos(a) * 0.32 * scaleFactor,
      0.36 + 0.42 * scaleFactor,
      Math.sin(a) * 0.32 * scaleFactor
    );
    feedStrut.rotation.z = Math.cos(a) * 0.46;
    feedStrut.rotation.x = -Math.sin(a) * 0.46;
    dishGroup.add(feedStrut);
  }

  const feedHorn = new THREE.Mesh(
    new THREE.CylinderGeometry(0.05, 0.09, 0.42, 20),
    goldFoilMat
  );
  feedHorn.position.y = 0.36 + 0.32 * scaleFactor;
  dishGroup.add(feedHorn);

  const subReflector = new THREE.Mesh(
    new THREE.CylinderGeometry(0.16 * scaleFactor, 0.04, 0.08, 24),
    whitePanelMat
  );
  subReflector.position.y = 0.36 + 0.68 * scaleFactor;
  dishGroup.add(subReflector);

  root.add(dishGroup);

  // 5. Power Array: Clearcoated GaAs Photovoltaic Wings OR Nuclear / Stirling RTG
  const wingY = 0.52 + bodyHeight * 0.54;
  if (config.powerSource !== 'solar_array') {
    const isStirling = config.powerSource === 'stirling_rtg';
    [-1, 1].forEach((dir) => {
      const rtgDrum = new THREE.Mesh(
        new THREE.CylinderGeometry(isStirling ? 0.28 : 0.24, isStirling ? 0.31 : 0.27, isStirling ? 1.58 : 1.4, 24),
        darkCarbonMat
      );
      rtgDrum.rotation.z = dir * (Math.PI / 2.35);
      rtgDrum.position.set(dir * (radius + 0.68), wingY, 0);
      rtgDrum.castShadow = true;
      root.add(rtgDrum);

      const cap = new THREE.Mesh(new THREE.SphereGeometry(isStirling ? 0.27 : 0.24, 20, 14), goldFoilMat);
      cap.position.set(dir * (radius + (isStirling ? 1.38 : 1.28)), wingY - 0.16, 0);
      root.add(cap);

      for (let f = 0; f < 6; f++) {
        const fin = new THREE.Mesh(
          new THREE.BoxGeometry(isStirling ? 1.26 : 1.12, 0.035, 0.52),
          new THREE.MeshStandardMaterial({
            color: isStirling ? 0x10b981 : 0x0ea5e9,
            emissive: isStirling ? 0x047857 : 0x0369a1,
            emissiveIntensity: 0.28,
            roughness: 0.32,
            metalness: 0.78,
          })
        );
        fin.position.set(dir * (radius + 0.72), wingY, 0);
        fin.rotation.x = (f * Math.PI) / 6;
        root.add(fin);
      }
    });
  } else {
    const buildSolarWing = (angleY: number, segments: number) => {
      const wingHolder = new THREE.Group();
      wingHolder.position.y = wingY;
      wingHolder.rotation.y = angleY;

      // Deployment mast boom & gimbal yoke
      const yoke = new THREE.Mesh(
        new THREE.CylinderGeometry(0.045, 0.055, 0.5, 16),
        brushedTitaniumMat
      );
      yoke.rotation.z = Math.PI / 2;
      yoke.position.x = radius + 0.24;
      wingHolder.add(yoke);

      const spine = new THREE.Mesh(
        new THREE.CylinderGeometry(0.024, 0.024, segments * 0.94, 12),
        brushedTitaniumMat
      );
      spine.rotation.z = Math.PI / 2;
      spine.position.set(radius + 0.48 + (segments * 0.94) / 2, -0.025, 0);
      wingHolder.add(spine);

      for (let s = 0; s < segments; s++) {
        const segX = radius + 0.48 + s * 0.94 + 0.45;
        const panel = new THREE.Mesh(new THREE.BoxGeometry(0.88, 0.036, 0.96), solarMat);
        panel.position.x = segX;
        panel.castShadow = true;
        panel.receiveShadow = true;
        wingHolder.add(panel);

        const frame = new THREE.Mesh(new THREE.BoxGeometry(0.92, 0.022, 1.0), brushedTitaniumMat);
        frame.position.set(segX, -0.016, 0);
        wingHolder.add(frame);

        if (s > 0) {
          const hinge = new THREE.Mesh(
            new THREE.CylinderGeometry(0.025, 0.025, 0.88, 10),
            goldFoilMat
          );
          hinge.rotation.x = Math.PI / 2;
          hinge.position.set(segX - 0.47, 0, 0);
          wingHolder.add(hinge);
        }
      }
      root.add(wingHolder);
    };

    const segs = craftSpec.solarPanels >= 6 ? 3 : 2;
    buildSolarWing(0, segs);
    buildSolarWing(Math.PI, segs);
    if (craftSpec.solarPanels >= 4) {
      buildSolarWing(Math.PI * 0.46, 2);
    }
    if (craftSpec.solarPanels >= 6) {
      buildSolarWing(-Math.PI * 0.54, 2);
    }
  }

  // 6. L1 Observation Probe: MinXSS X-Ray Spectrometer Array & Fresnel Radiation Shield Envelope
  if (config.craftClass === 'l1_probe') {
    const minxssCount = config.minxssTier === 'minxss_3' ? 3 : config.minxssTier === 'minxss_2' ? 2 : 1;
    const minxssMat = new THREE.MeshStandardMaterial({
      color: config.minxssTier === 'minxss_3' ? 0x22d3ee : config.minxssTier === 'minxss_2' ? 0x38bdf8 : 0xfbbf24,
      emissive: config.minxssTier === 'minxss_3' ? 0x0891b2 : 0x0284c7,
      emissiveIntensity: 0.45,
      roughness: 0.2,
      metalness: 0.85,
    });
    for (let m = 0; m < minxssCount; m++) {
      const mx = (m - (minxssCount - 1) * 0.5) * 0.28;
      const sensorTube = new THREE.Mesh(
        new THREE.CylinderGeometry(0.08, 0.09, 0.62, 16),
        minxssMat
      );
      sensorTube.rotation.x = Math.PI / 2;
      sensorTube.position.set(mx, 0.52 + bodyHeight * 0.78, radius + 0.32);
      root.add(sensorTube);
    }

    const shieldSpec = SHIELD_TIERS.find((s) => s.id === config.shieldTier) || SHIELD_TIERS[1];
    const shieldColorHex =
      config.shieldTier === 'thick'
        ? 0x10b981
        : config.shieldTier === 'medium'
        ? 0x38bdf8
        : 0xf59e0b;
    const shieldDome = createAtmosphereMesh(
      radius * 1.65,
      shieldColorHex,
      shieldSpec.shellOpacity * 2.2,
      2.6
    );
    shieldDome.position.y = 0.52 + bodyHeight * 0.55;
    root.add(shieldDome);
  }

  return { root, dishGroup };
}

/**
 * Precision Cleanroom Articulated Robotic Arm with Hydraulic Conduits
 */
export function buildRoboticArm(accentColor: number): {
  root: THREE.Group;
  shoulder: THREE.Group;
  elbow: THREE.Group;
  wrist: THREE.Group;
} {
  const root = new THREE.Group();

  const whiteMat = new THREE.MeshPhysicalMaterial({
    color: 0xeef2f7,
    roughness: 0.26,
    metalness: 0.2,
    clearcoat: 0.45,
  });
  const accentMat = new THREE.MeshPhysicalMaterial({
    color: accentColor,
    roughness: 0.24,
    metalness: 0.45,
    clearcoat: 0.55,
  });
  const jointMat = new THREE.MeshStandardMaterial({
    color: 0x1e293b,
    roughness: 0.34,
    metalness: 0.88,
  });
  const hoseMat = new THREE.MeshStandardMaterial({
    color: 0x090d16,
    roughness: 0.62,
    metalness: 0.2,
  });

  const base = new THREE.Mesh(new THREE.CylinderGeometry(0.62, 0.76, 0.42, 32), jointMat);
  base.position.y = 0.21;
  base.castShadow = true;
  base.receiveShadow = true;
  root.add(base);

  const collar = new THREE.Mesh(new THREE.CylinderGeometry(0.48, 0.55, 0.24, 32), accentMat);
  collar.position.y = 0.52;
  collar.castShadow = true;
  root.add(collar);

  const shoulder = new THREE.Group();
  shoulder.position.y = 0.74;
  root.add(shoulder);

  const shoulderDrum = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.28, 0.52, 24), jointMat);
  shoulderDrum.rotation.x = Math.PI / 2;
  shoulder.add(shoulderDrum);

  const lowerBoom = new THREE.Mesh(new THREE.CapsuleGeometry(0.17, 1.65, 10, 20), accentMat);
  lowerBoom.position.y = 0.92;
  lowerBoom.castShadow = true;
  shoulder.add(lowerBoom);

  // Flexible hydraulic conduit along lower boom
  const conduitCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(-0.18, 0.1, 0.14),
    new THREE.Vector3(-0.28, 0.9, 0.18),
    new THREE.Vector3(-0.18, 1.75, 0.12),
  ]);
  const conduit = new THREE.Mesh(new THREE.TubeGeometry(conduitCurve, 16, 0.032, 8, false), hoseMat);
  shoulder.add(conduit);

  const elbow = new THREE.Group();
  elbow.position.y = 1.85;
  shoulder.add(elbow);

  const elbowDrum = new THREE.Mesh(new THREE.CylinderGeometry(0.23, 0.23, 0.44, 24), jointMat);
  elbowDrum.rotation.x = Math.PI / 2;
  elbow.add(elbowDrum);

  const upperBoom = new THREE.Mesh(new THREE.CapsuleGeometry(0.13, 1.35, 10, 20), whiteMat);
  upperBoom.position.y = 0.78;
  upperBoom.castShadow = true;
  elbow.add(upperBoom);

  const wrist = new THREE.Group();
  wrist.position.y = 1.56;
  elbow.add(wrist);

  const wristHousing = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.16, 0.2, 20), jointMat);
  wrist.add(wristHousing);

  [-0.12, 0.12].forEach((fz) => {
    const finger = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.07, 0.06), jointMat);
    finger.position.set(0.14, 0.12, fz);
    wrist.add(finger);
  });

  return { root, shoulder, elbow, wrist };
}

/**
 * IMG_6712 Photorealistic Space Shuttle Launch Stack:
 * - Lathe-sculpted rust-orange External Tank with SOFI foam texture, intertank ribs & steel LOX feedline
 * - Twin segmented Solid Rocket Boosters with field joints, hold-down skirts & nozzles
 * - Sculpted white & black ceramic-tiled Orbiter with tinted cockpit windshield, double-delta wings,
 *   RCC leading edges, OMS pods & 3 ribbed SSME bell nozzles
 * - Multi-layer shock-diamond exhaust plumes
 */
export interface ShuttleLaunchRig {
  root: THREE.Group;
  etGroup: THREE.Group;
  srbLeft: THREE.Group;
  srbRight: THREE.Group;
  orbiter: THREE.Group;
  bayDoorLeft: THREE.Group;
  bayDoorRight: THREE.Group;
  payloadMount: THREE.Group;
  srbFlames: THREE.Group;
  mainFlames: THREE.Group;
  satFlame: THREE.Mesh;
}

/**
 * NASA LC-39A Multi-Stage Shuttle / Heavy Launch Stack:
 * - Separable rust-orange External Tank (MECO separation at ~115 km)
 * - Twin separable Solid Rocket Boosters (BECO separation at ~45 km)
 * - Detailed Orbiter with hinged Payload Bay Doors & stowed player NASA Satellite
 * - Calibrated Mach-diamond exhaust plumes (zero white-out glare)
 */
export function buildShuttleLaunchStack(
  assets: SpacecraftPBRAssets,
  config: HangarConfig
): ShuttleLaunchRig {
  const root = new THREE.Group();

  const etMat = new THREE.MeshStandardMaterial({
    map: assets.etFoam.map,
    normalMap: assets.etFoam.normalMap,
    normalScale: new THREE.Vector2(1.1, 1.1),
    roughness: 0.78,
    metalness: 0.08,
  });

  const whiteTileMat = new THREE.MeshPhysicalMaterial({
    map: assets.shuttleWhite.map,
    normalMap: assets.shuttleWhite.normalMap,
    normalScale: new THREE.Vector2(0.75, 0.75),
    color: 0xe8edf4,
    roughness: 0.44,
    metalness: 0.08,
    clearcoat: 0.16,
  });

  const blackTileMat = new THREE.MeshStandardMaterial({
    map: assets.shuttleBlack.map,
    normalMap: assets.shuttleBlack.normalMap,
    normalScale: new THREE.Vector2(0.85, 0.85),
    roughness: 0.62,
    metalness: 0.22,
  });

  const srbWhiteMat = new THREE.MeshStandardMaterial({
    color: 0xe2e8f0,
    roughness: 0.48,
    metalness: 0.16,
  });

  const nozzleMat = new THREE.MeshStandardMaterial({
    color: 0x334155,
    roughness: 0.34,
    metalness: 0.88,
  });

  const goldBayMat = new THREE.MeshStandardMaterial({
    map: assets.kapton.map,
    normalMap: assets.kapton.normalMap,
    color: 0xd9a03b,
    roughness: 0.32,
    metalness: 0.86,
  });

  const glassMat = new THREE.MeshPhysicalMaterial({
    color: 0x020617,
    roughness: 0.1,
    metalness: 0.3,
    clearcoat: 0.8,
    clearcoatRoughness: 0.06,
  });

  // 1. Separable Sculpted Ogive External Tank (ET)
  const etGroup = new THREE.Group();
  const etProfile = [
    new THREE.Vector2(0.0, 0.0),
    new THREE.Vector2(0.45, 0.15),
    new THREE.Vector2(0.66, 0.55),
    new THREE.Vector2(0.66, 5.2),
    new THREE.Vector2(0.54, 6.0),
    new THREE.Vector2(0.28, 6.65),
    new THREE.Vector2(0.03, 7.05),
    new THREE.Vector2(0.0, 7.1),
  ];
  const etMesh = new THREE.Mesh(new THREE.LatheGeometry(etProfile, 40), etMat);
  etMesh.position.set(0, 0.65, -0.38);
  etMesh.castShadow = true;
  etMesh.receiveShadow = true;
  etGroup.add(etMesh);

  const loxCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0.42, 6.1, 0.1),
    new THREE.Vector3(0.45, 3.8, 0.26),
    new THREE.Vector3(0.32, 1.3, 0.28),
  ]);
  const loxPipe = new THREE.Mesh(
    new THREE.TubeGeometry(loxCurve, 20, 0.045, 10, false),
    srbWhiteMat
  );
  etGroup.add(loxPipe);
  root.add(etGroup);

  const createPlume = (
    target: THREE.Group,
    x: number,
    y: number,
    z: number,
    radius: number,
    length: number,
    cyanTint = false
  ) => {
    const outer = new THREE.Mesh(
      new THREE.ConeGeometry(radius, length, 24),
      new THREE.MeshBasicMaterial({
        color: cyanTint ? 0x38bdf8 : 0xf97316,
        transparent: true,
        opacity: cyanTint ? 0.38 : 0.52,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      })
    );
    outer.rotation.x = Math.PI;
    outer.position.set(x, y - length / 2, z);
    target.add(outer);

    const mid = new THREE.Mesh(
      new THREE.ConeGeometry(radius * 0.6, length * 0.78, 20),
      new THREE.MeshBasicMaterial({
        color: cyanTint ? 0x93c5fd : 0xfbbf24,
        transparent: true,
        opacity: 0.62,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      })
    );
    mid.rotation.x = Math.PI;
    mid.position.set(x, y - (length * 0.78) / 2, z);
    target.add(mid);

    const core = new THREE.Mesh(
      new THREE.ConeGeometry(radius * 0.32, length * 0.48, 16),
      new THREE.MeshBasicMaterial({
        color: cyanTint ? 0xe0f2fe : 0xfef3c7,
        transparent: true,
        opacity: 0.76,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      })
    );
    core.rotation.x = Math.PI;
    core.position.set(x, y - (length * 0.48) / 2, z);
    target.add(core);
  };

  // 2. Twin Separable Solid Rocket Boosters (SRBs)
  const buildSrb = (dir: -1 | 1) => {
    const srbGroup = new THREE.Group();
    srbGroup.position.set(dir * 1.04, 0, -0.38);

    const cyl = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.33, 4.75, 28), srbWhiteMat);
    cyl.position.y = 2.82;
    cyl.castShadow = true;
    cyl.receiveShadow = true;
    srbGroup.add(cyl);

    const frustum = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.32, 0.72, 28), srbWhiteMat);
    frustum.position.y = 5.55;
    srbGroup.add(frustum);

    const tip = new THREE.Mesh(new THREE.SphereGeometry(0.14, 20, 14), blackTileMat);
    tip.position.y = 5.9;
    srbGroup.add(tip);

    [1.1, 2.2, 3.3, 4.4, 4.9].forEach((jy, idx) => {
      const band = new THREE.Mesh(
        new THREE.CylinderGeometry(0.336, 0.336, idx === 4 ? 0.14 : 0.06, 28),
        blackTileMat
      );
      band.position.y = jy;
      srbGroup.add(band);
    });

    const skirt = new THREE.Mesh(new THREE.CylinderGeometry(0.33, 0.44, 0.48, 28), srbWhiteMat);
    skirt.position.y = 0.24;
    srbGroup.add(skirt);

    const srbBell = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.28, 0.32, 24), nozzleMat);
    srbBell.position.y = -0.04;
    srbGroup.add(srbBell);

    root.add(srbGroup);
    return srbGroup;
  };

  const srbLeft = buildSrb(-1);
  const srbRight = buildSrb(1);

  const srbFlames = new THREE.Group();
  srbFlames.visible = false;
  createPlume(srbFlames, -1.04, -0.15, -0.38, 0.46, 3.2, false);
  createPlume(srbFlames, 1.04, -0.15, -0.38, 0.46, 3.2, false);
  root.add(srbFlames);

  // 3. Detailed Space Shuttle Orbiter with Openable Payload Bay & Stowed NASA Satellite
  const orbiter = new THREE.Group();
  orbiter.position.set(0, 2.32, 0.58);

  // Aft engine compartment (y: -1.52 .. -0.68)
  const aftBody = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.47, 0.86, 28), whiteTileMat);
  aftBody.position.y = -1.1;
  aftBody.castShadow = true;
  orbiter.add(aftBody);

  // Forward crew compartment (y: 0.82 .. 1.52)
  const fwdBody = new THREE.Mesh(new THREE.CylinderGeometry(0.43, 0.45, 0.72, 28), whiteTileMat);
  fwdBody.position.y = 1.18;
  fwdBody.castShadow = true;
  orbiter.add(fwdBody);

  // Payload bay open lower cradle (back 220° arc, leaves +Z dorsal face openable!)
  const baySaddle = new THREE.Mesh(
    new THREE.CylinderGeometry(0.45, 0.45, 1.5, 28, 1, false, Math.PI * 0.38, Math.PI * 1.24),
    whiteTileMat
  );
  baySaddle.position.y = 0.06;
  baySaddle.castShadow = true;
  orbiter.add(baySaddle);

  const bayLiner = new THREE.Mesh(
    new THREE.CylinderGeometry(0.41, 0.41, 1.46, 24, 1, true, Math.PI * 0.42, Math.PI * 1.16),
    goldBayMat
  );
  bayLiner.material.side = THREE.BackSide;
  bayLiner.position.y = 0.06;
  orbiter.add(bayLiner);

  // Hinged Left & Right Payload Bay Doors (swing open in LEO before Satellite Separation!)
  const bayDoorLeft = new THREE.Group();
  bayDoorLeft.position.set(-0.42, 0.06, 0.14);
  const doorLeftMesh = new THREE.Mesh(
    new THREE.CylinderGeometry(0.455, 0.455, 1.48, 18, 1, false, -Math.PI * 0.38, Math.PI * 0.38),
    whiteTileMat
  );
  doorLeftMesh.position.set(0.42, 0, -0.14);
  bayDoorLeft.add(doorLeftMesh);
  orbiter.add(bayDoorLeft);

  const bayDoorRight = new THREE.Group();
  bayDoorRight.position.set(0.42, 0.06, 0.14);
  const doorRightMesh = new THREE.Mesh(
    new THREE.CylinderGeometry(0.455, 0.455, 1.48, 18, 1, false, 0, Math.PI * 0.38),
    whiteTileMat
  );
  doorRightMesh.position.set(-0.42, 0, -0.14);
  bayDoorRight.add(doorRightMesh);
  orbiter.add(bayDoorRight);

  // Player's Custom NASA Satellite Stowed Inside Payload Bay (Separates at ~185 km LEO!)
  const payloadMount = new THREE.Group();
  payloadMount.position.set(0, 0.02, 0.06);
  const satRig = buildHangarSpacecraft(config, assets);
  satRig.root.scale.setScalar(0.19);
  payloadMount.add(satRig.root);

  const satFlame = new THREE.Mesh(
    new THREE.ConeGeometry(0.1, 0.65, 14),
    new THREE.MeshBasicMaterial({
      color: 0x38bdf8,
      transparent: true,
      opacity: 0.72,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    })
  );
  satFlame.rotation.x = Math.PI;
  satFlame.position.y = -0.35;
  satFlame.visible = false;
  payloadMount.add(satFlame);
  orbiter.add(payloadMount);

  // Dark HRSI belly thermal tile heatshield
  const bellyShield = new THREE.Mesh(
    new THREE.CylinderGeometry(0.455, 0.48, 3.0, 24, 1, false, Math.PI * 0.72, Math.PI * 0.56),
    blackTileMat
  );
  orbiter.add(bellyShield);

  // Ogive cockpit nose
  const noseProfile = [
    new THREE.Vector2(0.43, 0.0),
    new THREE.Vector2(0.38, 0.4),
    new THREE.Vector2(0.24, 0.85),
    new THREE.Vector2(0.11, 1.15),
    new THREE.Vector2(0.0, 1.24),
  ];
  const noseMesh = new THREE.Mesh(new THREE.LatheGeometry(noseProfile, 28), whiteTileMat);
  noseMesh.position.y = 1.52;
  noseMesh.castShadow = true;
  orbiter.add(noseMesh);

  const rccNose = new THREE.Mesh(new THREE.SphereGeometry(0.14, 20, 14), blackTileMat);
  rccNose.position.y = 2.66;
  rccNose.scale.set(1, 1.4, 1);
  orbiter.add(rccNose);

  // Multi-pane tinted cockpit windows
  const windshield = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.18, 0.24), glassMat);
  windshield.position.set(0, 1.88, 0.24);
  windshield.rotation.x = -0.46;
  orbiter.add(windshield);

  // Double-Delta Wings
  const wingShape = new THREE.Shape();
  wingShape.moveTo(0, -1.42);
  wingShape.lineTo(1.56, -1.42);
  wingShape.lineTo(1.56, -1.28);
  wingShape.lineTo(0.45, -0.05);
  wingShape.lineTo(0.26, 0.72);
  wingShape.lineTo(0, 0.72);
  wingShape.closePath();

  const wingGeo = new THREE.ExtrudeGeometry(wingShape, {
    depth: 0.08,
    bevelEnabled: true,
    bevelThickness: 0.025,
    bevelSize: 0.025,
    bevelSegments: 2,
  });

  const rightWing = new THREE.Mesh(wingGeo, whiteTileMat);
  rightWing.position.set(0.22, 0, -0.14);
  rightWing.castShadow = true;
  orbiter.add(rightWing);

  const leftWing = new THREE.Mesh(wingGeo, whiteTileMat);
  leftWing.scale.x = -1;
  leftWing.position.set(-0.22, 0, -0.14);
  leftWing.castShadow = true;
  orbiter.add(leftWing);

  [-1, 1].forEach((dir) => {
    const trim = new THREE.Mesh(new THREE.BoxGeometry(0.08, 1.75, 0.14), blackTileMat);
    trim.position.set(dir * 1.06, -0.66, -0.08);
    trim.rotation.z = dir * 0.74;
    orbiter.add(trim);

    const oms = new THREE.Mesh(new THREE.CapsuleGeometry(0.13, 0.55, 8, 16), whiteTileMat);
    oms.position.set(dir * 0.34, -1.12, 0.22);
    orbiter.add(oms);
  });

  const tailShape = new THREE.Shape();
  tailShape.moveTo(0, 0);
  tailShape.lineTo(0.92, 0);
  tailShape.lineTo(0.36, 1.02);
  tailShape.lineTo(0, 1.02);
  tailShape.closePath();
  const tailMesh = new THREE.Mesh(
    new THREE.ExtrudeGeometry(tailShape, {
      depth: 0.07,
      bevelEnabled: true,
      bevelThickness: 0.015,
      bevelSize: 0.015,
      bevelSegments: 2,
    }),
    whiteTileMat
  );
  tailMesh.rotation.y = Math.PI / 2;
  tailMesh.rotation.z = Math.PI / 2;
  tailMesh.position.set(-0.035, -1.5, 0.28);
  tailMesh.castShadow = true;
  orbiter.add(tailMesh);

  [
    [0, 0.17],
    [-0.19, -0.09],
    [0.19, -0.09],
  ].forEach(([nx, nz]) => {
    const ssme = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.18, 0.38, 20), nozzleMat);
    ssme.position.set(nx, -1.66, nz);
    orbiter.add(ssme);
  });

  // Main SSME plumes attached to orbiter aft
  const mainFlames = new THREE.Group();
  mainFlames.visible = false;
  createPlume(mainFlames, 0, -1.85, 0, 0.42, 2.7, true);
  orbiter.add(mainFlames);

  root.add(orbiter);

  return {
    root,
    etGroup,
    srbLeft,
    srbRight,
    orbiter,
    bayDoorLeft,
    bayDoorRight,
    payloadMount,
    srbFlames,
    mainFlames,
    satFlame,
  };
}

/**
 * Large Heavy-Lift Rocket-Style Carrier Spaceship for Stage 2 (Hangar) & Stage 3 (Launch Pad -> In-Flight Deployment)
 * - Houses the Smaller Space-Capable Drop-Spaceship inside its upper clamshell payload bay!
 * - Visibly reflects Craft Class (Light / Standard / Heavy), Power Source (Solar / Nuclear RTG), and Radiation Shield Shell.
 */
export function buildCarrierRocketSpaceship(
  config: HangarConfig,
  assets: SpacecraftPBRAssets,
  options: { showBoosters?: boolean; openInspectBay?: boolean } = {}
): CarrierRocketRig {
  const { showBoosters = true } = options;
  const root = new THREE.Group();
  const coreGroup = new THREE.Group();
  root.add(coreGroup);

  const engineSpec = ENGINE_OPTIONS.find((e) => e.id === config.engineId) || ENGINE_OPTIONS[3];
  const fuelSpec = FUEL_OPTIONS.find((f) => f.id === config.fuelId) || FUEL_OPTIONS[2];

  const scaleW = fuelSpec.tankScaleR;
  const scaleH = fuelSpec.tankScaleY;
  const etScaleY = THREE.MathUtils.lerp(0.86, 1.08, (scaleH - 0.58) / (1.36 - 0.58));
  const etCenterZ = -0.32;

  const blackTileMat = new THREE.MeshStandardMaterial({
    map: assets.shuttleBlack.map,
    normalMap: assets.shuttleBlack.normalMap,
    normalScale: new THREE.Vector2(0.85, 0.85),
    color: 0x1e293b,
    roughness: 0.56,
    metalness: 0.34,
  });

  const titaniumMat = new THREE.MeshStandardMaterial({
    color: 0x475569,
    roughness: 0.34,
    metalness: 0.86,
  });

  const goldBayMat = new THREE.MeshPhysicalMaterial({
    map: assets.kapton.map,
    normalMap: assets.kapton.normalMap,
    color: 0xe6b44d,
    roughness: 0.28,
    metalness: 0.9,
    clearcoat: 0.2,
  });

  const nozzleMat = new THREE.MeshStandardMaterial({
    color: 0x334155,
    roughness: 0.32,
    metalness: 0.88,
  });

  const copperBellMat = new THREE.MeshStandardMaterial({
    color: 0x9a3412,
    roughness: 0.3,
    metalness: 0.86,
  });

  const silverBellMat = new THREE.MeshStandardMaterial({
    color: 0x94a3b8,
    roughness: 0.25,
    metalness: 0.92,
  });

  const warningCrimsonMat = new THREE.MeshStandardMaterial({
    color: 0xe11d48,
    roughness: 0.42,
    metalness: 0.25,
  });

  const createPlume = (
    target: THREE.Group,
    x: number,
    y: number,
    z: number,
    radius: number,
    length: number,
    cyanTint = false
  ) => {
    const outer = new THREE.Mesh(
      new THREE.ConeGeometry(radius, length, 24),
      new THREE.MeshBasicMaterial({
        color: cyanTint ? 0x38bdf8 : 0xf97316,
        transparent: true,
        opacity: cyanTint ? 0.38 : 0.52,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      })
    );
    outer.rotation.x = Math.PI;
    outer.position.set(x, y - length / 2, z);
    target.add(outer);

    const mid = new THREE.Mesh(
      new THREE.ConeGeometry(radius * 0.58, length * 0.78, 20),
      new THREE.MeshBasicMaterial({
        color: cyanTint ? 0x93c5fd : 0xfbbf24,
        transparent: true,
        opacity: 0.62,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      })
    );
    mid.rotation.x = Math.PI;
    mid.position.set(x, y - (length * 0.78) / 2, z);
    target.add(mid);

    const core = new THREE.Mesh(
      new THREE.ConeGeometry(radius * 0.3, length * 0.48, 16),
      new THREE.MeshBasicMaterial({
        color: cyanTint ? 0xe0f2fe : 0xfef3c7,
        transparent: true,
        opacity: 0.76,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      })
    );
    core.rotation.x = Math.PI;
    core.position.set(x, y - (length * 0.48) / 2, z);
    target.add(core);
  };

  // 1. Engine-Specific Aft Propulsion Mount under NASA External Tank (5 distinct selectable engine configurations)
  const tankRadius = 0.57 * scaleW;
  const engineMountGroup = new THREE.Group();
  engineMountGroup.position.set(0, 0.48, etCenterZ);
  coreGroup.add(engineMountGroup);

  const skirtRadiusBottom =
    engineSpec.id === 'f1b_penta'
      ? tankRadius * 1.42
      : engineSpec.id === 'rs25_quad'
      ? tankRadius * 1.2
      : engineSpec.id === 'j2x_twin'
      ? tankRadius * 1.12
      : engineSpec.id === 'merlin_trio'
      ? tankRadius * 1.02
      : tankRadius * 0.72;
  const skirtHeight =
    engineSpec.id === 'f1b_penta' ? 0.58 : engineSpec.id === 'rl10_single' ? 0.34 : 0.44;
  const skirtMat =
    engineSpec.id === 'rs25_quad'
      ? goldBayMat
      : engineSpec.id === 'f1b_penta'
      ? titaniumMat
      : engineSpec.id === 'j2x_twin'
      ? silverBellMat
      : blackTileMat;

  const skirt = new THREE.Mesh(
    new THREE.CylinderGeometry(tankRadius * 0.92, skirtRadiusBottom, skirtHeight, 32),
    skirtMat
  );
  skirt.position.y = skirtHeight * 0.35;
  skirt.castShadow = true;
  skirt.receiveShadow = true;
  engineMountGroup.add(skirt);

  const buildDetailedBell = (
    bx: number,
    bz: number,
    topR: number,
    botR: number,
    len: number,
    ribbed: boolean,
    mat: THREE.Material = nozzleMat,
    tiltX = 0,
    tiltZ = 0
  ) => {
    const bell = new THREE.Mesh(new THREE.CylinderGeometry(topR, botR, len, 24), mat);
    bell.position.set(bx, -len * 0.42, bz);
    bell.rotation.set(tiltX, 0, tiltZ);
    bell.castShadow = true;
    engineMountGroup.add(bell);

    if (ribbed) {
      const band = new THREE.Mesh(
        new THREE.TorusGeometry((topR + botR) * 0.53, 0.022, 10, 24),
        engineSpec.id === 'f1b_penta' ? goldBayMat : silverBellMat
      );
      band.rotation.x = Math.PI / 2 + tiltX;
      band.position.set(bx, -len * 0.48, bz);
      engineMountGroup.add(band);
    }
  };

  if (engineSpec.id === 'rl10_single') {
    buildDetailedBell(0, 0, 0.13, 0.25, 0.68, true, silverBellMat);
  } else if (engineSpec.id === 'merlin_trio') {
    for (let i = 0; i < 3; i++) {
      const a = (i / 3) * Math.PI * 2 + Math.PI / 6;
      buildDetailedBell(
        Math.cos(a) * 0.26 * scaleW,
        Math.sin(a) * 0.26 * scaleW,
        0.11,
        0.2,
        0.54,
        false,
        copperBellMat
      );
    }
  } else if (engineSpec.id === 'j2x_twin') {
    [-1, 1].forEach((dir) => {
      buildDetailedBell(dir * 0.32 * scaleW, 0, 0.16, 0.3, 0.64, true, nozzleMat, 0, -dir * 0.08);
    });
  } else if (engineSpec.id === 'rs25_quad') {
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
      buildDetailedBell(
        Math.cos(a) * 0.36 * scaleW,
        Math.sin(a) * 0.36 * scaleW,
        0.14,
        0.26,
        0.6,
        true,
        nozzleMat
      );
    }
  } else {
    buildDetailedBell(0, 0, 0.2, 0.36, 0.74, true, copperBellMat);
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * Math.PI * 2;
      buildDetailedBell(
        Math.cos(a) * 0.5 * scaleW,
        Math.sin(a) * 0.5 * scaleW,
        0.16,
        0.29,
        0.68,
        true,
        copperBellMat
      );
    }
    const thrustCollar = new THREE.Mesh(
      new THREE.TorusGeometry(skirtRadiusBottom * 0.96, 0.048, 12, 36),
      new THREE.MeshBasicMaterial({ color: 0xf59e0b })
    );
    thrustCollar.rotation.x = Math.PI / 2;
    thrustCollar.position.y = 0.04;
    engineMountGroup.add(thrustCollar);
  }

  // 2. Official NASA External Tank GLB (external-tank.glb) with Fuel Tank Option scaling & accents
  const etContainer = new THREE.Group();
  etContainer.position.set(0, 0.52 + 3.85 * etScaleY, etCenterZ);
  etContainer.scale.set(0.0041 * scaleW, 0.0041 * etScaleY, 0.0041 * scaleW);
  coreGroup.add(etContainer);

  // Fuel-specific structural ring accents on External Tank
  if (fuelSpec.id === 'fuel_critical') {
    const redBand = new THREE.Mesh(
      new THREE.CylinderGeometry(tankRadius * 1.02, tankRadius * 1.02, 0.18, 32),
      warningCrimsonMat
    );
    redBand.position.set(0, 2.4 * etScaleY, etCenterZ);
    coreGroup.add(redBand);
  } else if (fuelSpec.id === 'fuel_excess') {
    [2.2, 4.8].forEach((by) => {
      const goldBand = new THREE.Mesh(
        new THREE.CylinderGeometry(tankRadius * 1.015, tankRadius * 1.015, 0.16, 36),
        goldBayMat
      );
      goldBand.position.set(0, by * etScaleY, etCenterZ);
      coreGroup.add(goldBand);
    });
  }

  // 3. Bay Door Placeholders & Dish Group (kept for rig compatibility; NASA Orbiter separates directly from External Tank)
  const bayDoorLeft = new THREE.Group();
  const bayDoorRight = new THREE.Group();
  coreGroup.add(bayDoorLeft);
  coreGroup.add(bayDoorRight);
  const dishGroup = new THREE.Group();
  coreGroup.add(dishGroup);

  // 4. Mounted NASA Space Shuttle Orbiter (space-shuttle-d.glb) on External Tank Dorsal (+Z) Struts
  const payloadRestY = 0.42;
  const payloadMount = new THREE.Group();
  payloadMount.position.set(0, payloadRestY, 0.84);

  const innerDropShip = buildDropSpaceship(assets, config);
  innerDropShip.root.scale.setScalar(0.78);
  innerDropShip.legsGroup.visible = false;
  innerDropShip.flameGroup.visible = false;
  payloadMount.add(innerDropShip.root);

  // Orbital Maneuvering / SSME Plume on the Space Shuttle Orbiter during separation
  const craftFlame = new THREE.Group();
  craftFlame.visible = false;
  createPlume(craftFlame, 0, 0.36, 0.11, 0.24, 1.85, true);
  createPlume(craftFlame, -0.2, 0.36, -0.16, 0.2, 1.55, true);
  createPlume(craftFlame, 0.2, 0.36, -0.16, 0.2, 1.55, true);
  payloadMount.add(craftFlame);

  root.add(payloadMount);

  // 5. Main Core Exhaust Plumes (scales visually with engine thrust)
  const mainFlames = new THREE.Group();
  mainFlames.visible = false;
  const plumeRadius = 0.28 + (engineSpec.thrustKn / 3550) * 0.36;
  const plumeLen = 1.65 + (engineSpec.thrustKn / 3550) * 1.85;
  createPlume(mainFlames, 0, -0.25, etCenterZ, plumeRadius * scaleW, plumeLen, true);
  coreGroup.add(mainFlames);

  // 6. Twin Separable NASA Solid Rocket Boosters (solid-rocket-booster.glb)
  const srbOffsetX = tankRadius + 0.52;
  const buildSrb = (dir: -1 | 1) => {
    const srbGroup = new THREE.Group();
    srbGroup.position.set(dir * srbOffsetX, 0.1, -0.12);
    srbGroup.visible = showBoosters;
    root.add(srbGroup);
    return srbGroup;
  };

  const srbLeft = buildSrb(-1);
  const srbRight = buildSrb(1);

  const srbFlames = new THREE.Group();
  srbFlames.visible = false;
  createPlume(srbFlames, -srbOffsetX, -0.05, etCenterZ, 0.38, 2.8, false);
  createPlume(srbFlames, srbOffsetX, -0.05, etCenterZ, 0.38, 2.8, false);
  root.add(srbFlames);

  // Populate NASA External Tank and Twin SRBs from GLB cache
  onNasaShuttleGlbsReady((cache) => {
    const etClone = cache.externalTankTemplate.clone(true);
    if (fuelSpec.id !== 'fuel_nominal') {
      etClone.traverse((child) => {
        const mesh = child as THREE.Mesh;
        if (mesh.isMesh && mesh.material) {
          const mat = (mesh.material as THREE.MeshStandardMaterial).clone();
          if (fuelSpec.id === 'fuel_critical') {
            mat.color.setHex(0x64748b);
            mat.roughness = 0.55;
            mat.metalness = 0.35;
          } else if (fuelSpec.id === 'fuel_short') {
            mat.color.setHex(0xfbbf24);
            mat.roughness = 0.42;
            mat.metalness = 0.28;
          } else if (fuelSpec.id === 'fuel_excess') {
            mat.color.setHex(0xea580c);
            mat.roughness = 0.62;
          }
          mesh.material = mat;
        }
      });
    }
    etContainer.add(etClone);

    [-1, 1].forEach((dir) => {
      const targetSrb = dir === -1 ? srbLeft : srbRight;
      const srbClone = cache.srbTemplate.clone(true);
      srbClone.scale.setScalar(0.0041);
      srbClone.position.set(0, 3.55, etCenterZ + 0.12);
      targetSrb.add(srbClone);
    });
  });

  return {
    root,
    coreGroup,
    srbLeft,
    srbRight,
    bayDoorLeft,
    bayDoorRight,
    payloadMount,
    payloadRestY,
    srbOffsetX,
    srbFlames,
    mainFlames,
    craftFlame,
    dishGroup,
  };
}

let southTexasGlbScene: THREE.Group | null = null;
let mobileLauncherGlbScene: THREE.Group | null = null;
let launchSiteGlbLoading = false;
const launchSiteCallbacks: Array<(site: THREE.Group, mlp: THREE.Group | null) => void> = [];

function onSouthTexasLaunchSiteReady(
  cb: (site: THREE.Group, mlp: THREE.Group | null) => void
): void {
  if (southTexasGlbScene) {
    cb(southTexasGlbScene, mobileLauncherGlbScene);
    return;
  }
  launchSiteCallbacks.push(cb);
  if (launchSiteGlbLoading) return;
  launchSiteGlbLoading = true;

  const loader = new GLTFLoader();
  Promise.all([
    loader.loadAsync('/assets/models/south-texas-launch-site-sn15.glb'),
    loader.loadAsync('/assets/models/mobile-launcher-assembled.glb').catch(() => null),
  ])
    .then(([siteGltf, mlpGltf]) => {
      siteGltf.scene.traverse((obj) => {
        const mesh = obj as THREE.Mesh;
        if (!mesh.isMesh) return;
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
        mats.forEach((m) => {
          const std = m as THREE.MeshStandardMaterial;
          if (!std) return;
          if (mesh.geometry.attributes.color) {
            std.vertexColors = true;
          }
          std.needsUpdate = true;
        });
      });
      southTexasGlbScene = siteGltf.scene;

      if (mlpGltf) {
        normalizeGlbMaterials(mlpGltf.scene, false);
        mobileLauncherGlbScene = mlpGltf.scene;
      }

      while (launchSiteCallbacks.length > 0) {
        const next = launchSiteCallbacks.shift();
        next?.(southTexasGlbScene, mobileLauncherGlbScene);
      }
    })
    .catch((err) => {
      console.error('Failed to load South Texas Launch Site with SN15 GLB:', err);
    });
}

/**
 * South Texas Launch Site with SN15 (SpaceX Starbase / Boca Chica) 3D GLB Environment & Integration Tower
 */
export function buildShuttleLaunchTower(): {
  root: THREE.Group;
  swingArm: THREE.Group;
} {
  const root = new THREE.Group();

  const steelMat = new THREE.MeshStandardMaterial({
    color: 0xcbd5e1,
    roughness: 0.44,
    metalness: 0.68,
  });
  const whiteSpireMat = new THREE.MeshPhysicalMaterial({
    color: 0xf8fafc,
    roughness: 0.28,
    metalness: 0.2,
    clearcoat: 0.3,
  });

  // Load and mount the full "South Texas Launch Site with SN15" 3D GLB surrounding the spacecraft at (0, 0, 0)
  const siteHolder = new THREE.Group();
  root.add(siteHolder);

  onSouthTexasLaunchSiteReady((siteTemplate, mlpTemplate) => {
    const siteClone = siteTemplate.clone(true);
    siteHolder.add(siteClone);

    if (mlpTemplate) {
      const mlpClone = mlpTemplate.clone(true);
      mlpClone.scale.setScalar(3.8);
      mlpClone.position.set(-1.35, 0.02, -0.35);
      siteHolder.add(mlpClone);
    }
  });

  // Articulated Crew/Umbilical Swing-Arm positioned at the tower (-2.3, 4.55, -0.35)
  const swingArm = new THREE.Group();
  swingArm.position.set(-2.32, 4.55, -0.35);
  const armBeam = new THREE.Mesh(new THREE.BoxGeometry(2.05, 0.24, 0.34), whiteSpireMat);
  armBeam.position.set(1.0, 0, 0);
  armBeam.castShadow = true;
  swingArm.add(armBeam);

  const whiteRoom = new THREE.Mesh(new THREE.BoxGeometry(0.48, 0.44, 0.48), steelMat);
  whiteRoom.position.set(1.92, 0, 0);
  swingArm.add(whiteRoom);
  root.add(swingArm);

  return { root, swingArm };
}

export function buildSatellite(type: 'iss' | 'hubble' | 'jwst'): THREE.Group {
  const group = new THREE.Group();
  const silverMat = new THREE.MeshStandardMaterial({
    color: 0xe2e8f0,
    roughness: 0.28,
    metalness: 0.82,
  });
  const goldMat = new THREE.MeshStandardMaterial({
    color: 0xfbbf24,
    roughness: 0.18,
    metalness: 0.94,
  });
  const solarMat = new THREE.MeshPhysicalMaterial({
    color: 0x1d4ed8,
    roughness: 0.18,
    metalness: 0.6,
    clearcoat: 1.0,
  });

  if (type === 'iss') {
    group.add(new THREE.Mesh(new THREE.BoxGeometry(1.15, 0.08, 0.08), silverMat));
    group.add(new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.45, 12), silverMat));
    [-0.42, -0.24, 0.24, 0.42].forEach((x) => {
      const wing = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.02, 0.62), solarMat);
      wing.position.set(x, 0, 0);
      group.add(wing);
    });
  } else if (type === 'hubble') {
    const tube = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.55, 20), silverMat);
    tube.rotation.z = Math.PI / 2;
    group.add(tube);
    [-0.25, 0.25].forEach((z) => {
      const wing = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.02, 0.35), solarMat);
      wing.position.set(0, 0, z);
      group.add(wing);
    });
  } else {
    const shield = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.03, 0.4), silverMat);
    shield.rotation.y = Math.PI / 4;
    group.add(shield);
    const mirror = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 0.04, 6), goldMat);
    mirror.rotation.x = Math.PI / 2;
    mirror.position.set(0, 0.2, 0);
    group.add(mirror);
  }
  return group;
}

/**
 * Proxima b Photorealistic Exoplanet Outpost (Geodesic Glass Biodome + Solar Farm + Radar)
 */
export function buildColonyStructures(solarPBR: PBRTextureSet): {
  root: THREE.Group;
  radarDish: THREE.Group;
} {
  const root = new THREE.Group();

  const titaniumMat = new THREE.MeshStandardMaterial({
    color: 0x334155,
    roughness: 0.36,
    metalness: 0.85,
  });

  const domeBase = new THREE.Mesh(
    new THREE.CylinderGeometry(2.5, 2.75, 0.4, 48),
    titaniumMat
  );
  domeBase.position.set(-4.2, 0.2, -1.4);
  domeBase.castShadow = true;
  domeBase.receiveShadow = true;
  root.add(domeBase);

  const domeGlass = new THREE.Mesh(
    new THREE.SphereGeometry(2.38, 40, 28, 0, Math.PI * 2, 0, Math.PI / 2),
    new THREE.MeshPhysicalMaterial({
      color: 0x38bdf8,
      emissive: 0x0284c7,
      emissiveIntensity: 0.14,
      roughness: 0.12,
      metalness: 0.08,
      clearcoat: 0.6,
      clearcoatRoughness: 0.1,
      transparent: true,
      opacity: 0.42,
      depthWrite: false,
    })
  );
  domeGlass.renderOrder = 3;
  domeGlass.position.set(-4.2, 0.36, -1.4);
  root.add(domeGlass);

  const domeWire = new THREE.LineSegments(
    new THREE.WireframeGeometry(new THREE.IcosahedronGeometry(2.4, 2)),
    new THREE.LineBasicMaterial({ color: 0x93c5fd, transparent: true, opacity: 0.42 })
  );
  domeWire.position.copy(domeGlass.position);
  root.add(domeWire);

  // Warm illuminated interior hydroponic core
  const habGlow = new THREE.Mesh(
    new THREE.CylinderGeometry(1.18, 1.32, 0.52, 24),
    new THREE.MeshStandardMaterial({
      color: 0xfef3c7,
      emissive: 0xf59e0b,
      emissiveIntensity: 0.35,
      roughness: 0.38,
    })
  );
  habGlow.position.set(-4.2, 0.54, -1.4);
  root.add(habGlow);

  // Airlock pressurized corridor
  const airlock = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.42, 1.35, 16), titaniumMat);
  airlock.rotation.z = Math.PI / 2;
  airlock.position.set(-1.6, 0.52, -1.4);
  root.add(airlock);

  // Solar tracker array
  const panelMat = new THREE.MeshPhysicalMaterial({
    map: solarPBR.map,
    roughnessMap: solarPBR.roughnessMap,
    color: 0xdbeafe,
    roughness: 0.18,
    metalness: 0.55,
    clearcoat: 1.0,
  });
  for (let i = 0; i < 4; i++) {
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.11, 0.78, 16), titaniumMat);
    post.position.set(3.2 + i * 1.22, 0.39, -1.6);
    post.castShadow = true;
    root.add(post);

    const panel = new THREE.Mesh(new THREE.BoxGeometry(1.02, 0.06, 1.42), panelMat);
    panel.position.set(3.2 + i * 1.22, 0.78, -1.6);
    panel.rotation.x = 0.44;
    panel.castShadow = true;
    root.add(panel);
  }

  // Deep Space Ka-Band Radar Tower
  const radarTower = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.34, 2.3, 20), titaniumMat);
  radarTower.position.set(-3.2, 1.15, 2.8);
  radarTower.castShadow = true;
  root.add(radarTower);

  const radarDish = new THREE.Group();
  radarDish.position.set(-3.2, 2.35, 2.8);
  const dishPoints = [
    new THREE.Vector2(0, 0),
    new THREE.Vector2(0.45, 0.08),
    new THREE.Vector2(0.92, 0.32),
    new THREE.Vector2(1.14, 0.5),
  ];
  const dish = new THREE.Mesh(
    new THREE.LatheGeometry(dishPoints, 32),
    new THREE.MeshPhysicalMaterial({
      color: 0xf8fafc,
      roughness: 0.28,
      metalness: 0.2,
      clearcoat: 0.35,
      side: THREE.DoubleSide,
    })
  );
  dish.rotation.x = -Math.PI / 3;
  radarDish.add(dish);
  root.add(radarDish);

  return { root, radarDish };
}


export interface LandingLegRig {
  upperPivot: THREE.Group;
  lowerPivot: THREE.Group;
  piston: THREE.Mesh;
}

export interface LandingVehicleRig {
  root: THREE.Group;
  bodyGroup: THREE.Group;
  flameGroup: THREE.Group;
  rampPivot: THREE.Group;
  legsGroup: THREE.Group;
  legRigs: LandingLegRig[];
  fwdFlaps: THREE.Group[];
  aftFlaps: THREE.Group[];
  bayLight: THREE.PointLight;
}

/**
 * SpaceX Starship — Planetary & Orbital Spaceship (50 m height × 9 m hull diameter, ~5.53:1 aspect ratio):
 * - Sleek mirror-brushed 304L stainless steel ring-welded cylindrical fuselage + tangent ogive nosecone
 * - Windward (-Z) black hexagonal ceramic Thermal Protection System (TPS) heatshield tiles
 * - 2 actuated forward body flaps on the nosecone shoulders + 2 large aft delta aerodynamic flaps
 * - 6-engine Raptor cluster inside the aft skirt (3 gimbaled sea-level center Raptors + 3 outer RVac bells)
 * - 4 shock-absorbing telescoping skirt landing legs + leeward (+Z) rover garage with hinged deployment ramp
 */
export function buildDropSpaceship(
  assets: SpacecraftPBRAssets,
  config?: HangarConfig
): LandingVehicleRig {
  const root = new THREE.Group();
  const bodyGroup = new THREE.Group();
  root.add(bodyGroup);

  const craftScale =
    config?.craftClass === 'heavy' ? 1.06 : config?.craftClass === 'light' ? 0.94 : 1.0;
  const hullRadius = 0.62 * craftScale; // Diameter = 1.24u (~9 m)
  const barrelBottomY = 0.42;
  const barrelHeight = 4.24; // Barrel top at y = 4.66
  const noseBaseY = barrelBottomY + barrelHeight; // 4.66
  const noseHeight = 2.20; // Nose tip at y = 6.86 -> 6.86 / 1.24 = 5.53:1 SpaceX Starship aspect ratio

  // 304L Mirror-Brushed Stainless Steel Alloy
  const stainlessSteelMat = new THREE.MeshPhysicalMaterial({
    normalMap: assets.shuttleWhite.normalMap,
    normalScale: new THREE.Vector2(0.26, 0.26),
    color: 0xdbe4f0,
    roughness: 0.17,
    metalness: 0.92,
    clearcoat: 0.48,
    clearcoatRoughness: 0.14,
  });

  // Circumferential Cryo Ring-Weld Seam Alloy
  const weldRingMat = new THREE.MeshStandardMaterial({
    color: 0x94a3b8,
    roughness: 0.28,
    metalness: 0.88,
  });

  // Windward Hexagonal Black Ceramic TPS Heatshield Tiles
  const tpsBlackTileMat = new THREE.MeshStandardMaterial({
    map: assets.shuttleBlack.map,
    normalMap: assets.shuttleBlack.normalMap,
    normalScale: new THREE.Vector2(1.15, 1.15),
    color: 0x0f172a,
    roughness: 0.50,
    metalness: 0.34,
  });

  const goldFoilMat = new THREE.MeshPhysicalMaterial({
    map: assets.kapton.map,
    normalMap: assets.kapton.normalMap,
    color: 0xffd175,
    roughness: 0.24,
    metalness: 0.94,
    clearcoat: 0.28,
  });

  const raptorNozzleMat = new THREE.MeshStandardMaterial({
    color: 0x334155,
    roughness: 0.32,
    metalness: 0.86,
  });

  const copperManifoldMat = new THREE.MeshStandardMaterial({
    color: 0x9a3412,
    roughness: 0.30,
    metalness: 0.88,
  });

  const glassMat = new THREE.MeshPhysicalMaterial({
    color: 0x020617,
    roughness: 0.06,
    metalness: 0.35,
    clearcoat: 0.92,
  });

  // 1. Main Cylindrical 304L Stainless Steel Fuselage Barrel (y: 0.42 .. 4.66)
  // Upper section above rover garage (y: 1.54 .. 4.66) is a full closed cylinder
  const upperBarrelH = 3.12;
  const upperBarrel = new THREE.Mesh(
    new THREE.CylinderGeometry(hullRadius, hullRadius, upperBarrelH, 40),
    stainlessSteelMat
  );
  upperBarrel.position.y = 1.54 + upperBarrelH / 2;
  upperBarrel.castShadow = true;
  upperBarrel.receiveShadow = true;
  bodyGroup.add(upperBarrel);

  // Lower section around the leeward (+Z) rover garage (y: 0.42 .. 1.54) wraps 260 deg around -Z and sides
  const lowerBarrelH = 1.12;
  const lowerBarrelCradle = new THREE.Mesh(
    new THREE.CylinderGeometry(
      hullRadius,
      hullRadius,
      lowerBarrelH,
      36,
      1,
      false,
      Math.PI * 0.28,
      Math.PI * 1.44
    ),
    stainlessSteelMat
  );
  lowerBarrelCradle.position.y = barrelBottomY + lowerBarrelH / 2;
  lowerBarrelCradle.castShadow = true;
  lowerBarrelCradle.receiveShadow = true;
  bodyGroup.add(lowerBarrelCradle);

  // Ring-Weld Seams along the Stainless Steel Barrel
  for (let w = 0; w <= 6; w++) {
    const wy = 1.56 + w * 0.51;
    const seamRing = new THREE.Mesh(
      new THREE.TorusGeometry(hullRadius * 1.003, 0.011, 10, 48),
      weldRingMat
    );
    seamRing.rotation.x = Math.PI / 2;
    seamRing.position.y = wy;
    bodyGroup.add(seamRing);
  }

  // Leeward (+Z) Vertical Avionics Raceway Spine & Pressurization Lines
  const raceway = new THREE.Mesh(
    new THREE.BoxGeometry(0.09 * craftScale, 2.95, 0.05),
    weldRingMat
  );
  raceway.position.set(0, 3.08, hullRadius * 0.99);
  bodyGroup.add(raceway);

  // 2. Windward (-Z) Black Hexagonal TPS Heatshield Belly on Cylindrical Barrel
  const bellyHeatshield = new THREE.Mesh(
    new THREE.CylinderGeometry(
      hullRadius * 1.012,
      hullRadius * 1.012,
      barrelHeight,
      36,
      1,
      false,
      Math.PI * 0.52,
      Math.PI * 0.96
    ),
    tpsBlackTileMat
  );
  bellyHeatshield.position.y = barrelBottomY + barrelHeight / 2;
  bellyHeatshield.castShadow = true;
  bellyHeatshield.receiveShadow = true;
  bodyGroup.add(bellyHeatshield);

  // 3. Tangent Ogive Fairing & Nosecone (y: 4.66 .. 6.86)
  const noseProfile: THREE.Vector2[] = [];
  const noseSteps = 14;
  for (let i = 0; i <= noseSteps; i++) {
    const t = i / noseSteps;
    const y = t * noseHeight;
    // Tangent ogive curve tapering smoothly from hullRadius to rounded nose tip
    const r = hullRadius * Math.pow(Math.max(0, 1 - Math.pow(t, 1.48)), 0.72);
    noseProfile.push(new THREE.Vector2(r, y));
  }

  const noseSteel = new THREE.Mesh(
    new THREE.LatheGeometry(noseProfile, 40),
    stainlessSteelMat
  );
  noseSteel.position.y = noseBaseY;
  noseSteel.castShadow = true;
  noseSteel.receiveShadow = true;
  bodyGroup.add(noseSteel);

  // Windward (-Z) Black TPS Heatshield Wrapping the Nosecone
  // In LatheGeometry, phi=0 is +X, phi=PI/2 is -Z (windward belly) -> phiStart = 0.04*PI, phiLength = 0.92*PI covers -Z half!
  const noseTpsProfile = noseProfile.map(
    (pt) => new THREE.Vector2(pt.x * 1.014, pt.y)
  );
  const noseHeatshield = new THREE.Mesh(
    new THREE.LatheGeometry(noseTpsProfile, 32, Math.PI * 0.04, Math.PI * 0.92),
    tpsBlackTileMat
  );
  noseHeatshield.position.y = noseBaseY;
  noseHeatshield.castShadow = true;
  bodyGroup.add(noseHeatshield);

  // Black Ceramic Nose Tip Cap (LOX Header Tank Dome at y = 6.76 .. 6.86)
  const noseTipCap = new THREE.Mesh(
    new THREE.SphereGeometry(0.11 * craftScale, 20, 14),
    tpsBlackTileMat
  );
  noseTipCap.position.y = noseBaseY + noseHeight - 0.05;
  bodyGroup.add(noseTipCap);

  // Leeward (+Z) Crew Cabin Panoramic Viewport Bands & Starbase Collar Trim
  const upperWindow = new THREE.Mesh(
    new THREE.CylinderGeometry(
      hullRadius * 0.77,
      hullRadius * 0.85,
      0.16,
      24,
      1,
      false,
      -Math.PI * 0.24,
      Math.PI * 0.48
    ),
    glassMat
  );
  upperWindow.position.y = noseBaseY + 0.78;
  bodyGroup.add(upperWindow);

  const lowerWindow = new THREE.Mesh(
    new THREE.CylinderGeometry(
      hullRadius * 0.89,
      hullRadius * 0.94,
      0.14,
      24,
      1,
      false,
      -Math.PI * 0.28,
      Math.PI * 0.56
    ),
    glassMat
  );
  lowerWindow.position.y = noseBaseY + 0.44;
  bodyGroup.add(lowerWindow);

  // 4. Two Forward Aerodynamic Body Flaps on Nosecone Shoulders (y: 5.05 .. 6.28 at ±X)
  const fwdFlapShape = new THREE.Shape();
  fwdFlapShape.moveTo(0, 0);
  fwdFlapShape.lineTo(0.54 * craftScale, 0.14);
  fwdFlapShape.lineTo(0.46 * craftScale, 0.72);
  fwdFlapShape.lineTo(0, 1.18);
  fwdFlapShape.closePath();

  const fwdFlapGeo = new THREE.ExtrudeGeometry(fwdFlapShape, {
    depth: 0.042,
    bevelEnabled: true,
    bevelThickness: 0.012,
    bevelSize: 0.012,
    bevelSegments: 2,
  });

  const fwdFlaps: THREE.Group[] = [];
  [-1, 1].forEach((dir) => {
    const fwdGroup = new THREE.Group();
    fwdGroup.position.set(dir * hullRadius * 0.80, noseBaseY + 0.36, -0.04);
    fwdGroup.rotation.y = dir * 0.16;

    const flapMesh = new THREE.Mesh(fwdFlapGeo, tpsBlackTileMat);
    flapMesh.scale.x = dir;
    flapMesh.castShadow = true;
    fwdGroup.add(flapMesh);

    // Stainless steel leeward skin backing
    const leewardSkin = new THREE.Mesh(
      new THREE.BoxGeometry(0.44 * craftScale, 0.85, 0.018),
      stainlessSteelMat
    );
    leewardSkin.position.set(dir * 0.24 * craftScale, 0.48, 0.046);
    leewardSkin.rotation.z = -dir * 0.22;
    fwdGroup.add(leewardSkin);

    // Aerodynamic cylindrical hinge fairing
    const hingeFairing = new THREE.Mesh(
      new THREE.CylinderGeometry(0.045, 0.058, 1.24, 14),
      tpsBlackTileMat
    );
    hingeFairing.position.set(0, 0.58, 0.02);
    fwdGroup.add(hingeFairing);

    bodyGroup.add(fwdGroup);
    fwdFlaps.push(fwdGroup);
  });

  // 5. Two Large Aft Aerodynamic Delta Flaps on Lower Barrel (y: 0.42 .. 2.48 at ±X)
  const aftFlapShape = new THREE.Shape();
  aftFlapShape.moveTo(0, 0);
  aftFlapShape.lineTo(0.76 * craftScale, -0.06);
  aftFlapShape.lineTo(0.72 * craftScale, 0.78);
  aftFlapShape.lineTo(0, 2.02);
  aftFlapShape.closePath();

  const aftFlapGeo = new THREE.ExtrudeGeometry(aftFlapShape, {
    depth: 0.055,
    bevelEnabled: true,
    bevelThickness: 0.015,
    bevelSize: 0.015,
    bevelSegments: 2,
  });

  const aftFlaps: THREE.Group[] = [];
  [-1, 1].forEach((dir) => {
    const aftGroup = new THREE.Group();
    aftGroup.position.set(dir * hullRadius * 0.95, barrelBottomY + 0.04, -0.04);
    aftGroup.rotation.y = dir * 0.14;

    const aftMesh = new THREE.Mesh(aftFlapGeo, tpsBlackTileMat);
    aftMesh.scale.x = dir;
    aftMesh.castShadow = true;
    aftMesh.receiveShadow = true;
    aftGroup.add(aftMesh);

    const aftLeewardSkin = new THREE.Mesh(
      new THREE.BoxGeometry(0.64 * craftScale, 1.38, 0.02),
      stainlessSteelMat
    );
    aftLeewardSkin.position.set(dir * 0.34 * craftScale, 0.76, 0.058);
    aftLeewardSkin.rotation.z = -dir * 0.25;
    aftGroup.add(aftLeewardSkin);

    // Top & bottom aerodynamic hinge actuator domes
    const hingeColumn = new THREE.Mesh(
      new THREE.CylinderGeometry(0.065, 0.075, 2.06, 16),
      tpsBlackTileMat
    );
    hingeColumn.position.set(0, 1.0, 0.02);
    aftGroup.add(hingeColumn);

    const actuatorDome = new THREE.Mesh(
      new THREE.SphereGeometry(0.09, 14, 12),
      stainlessSteelMat
    );
    actuatorDome.position.set(0, 2.04, 0.02);
    aftGroup.add(actuatorDome);

    bodyGroup.add(aftGroup);
    aftFlaps.push(aftGroup);
  });

  // 6. Aft Engine Skirt & 6-Engine SpaceX Raptor Cluster (3 Sea-Level Center + 3 Vacuum RVac)
  const aftSkirt = new THREE.Mesh(
    new THREE.CylinderGeometry(hullRadius * 1.01, hullRadius * 1.04, 0.28, 40),
    tpsBlackTileMat
  );
  aftSkirt.position.y = 0.28;
  aftSkirt.castShadow = true;
  bodyGroup.add(aftSkirt);

  const thrustPuck = new THREE.Mesh(
    new THREE.CylinderGeometry(hullRadius * 0.94, hullRadius * 0.94, 0.06, 32),
    weldRingMat
  );
  thrustPuck.position.y = 0.40;
  bodyGroup.add(thrustPuck);

  // Sea-Level Raptor Bell Profile (3 center gimbaled engines)
  const slBellProfile = [
    new THREE.Vector2(0.035, 0.22),
    new THREE.Vector2(0.028, 0.16),
    new THREE.Vector2(0.068, 0.06),
    new THREE.Vector2(0.095, -0.06),
    new THREE.Vector2(0.105, -0.14),
  ];
  const slBellGeo = new THREE.LatheGeometry(slBellProfile, 22);
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * Math.PI * 2 + Math.PI / 6;
    const bell = new THREE.Mesh(slBellGeo, raptorNozzleMat);
    bell.position.set(
      Math.cos(a) * 0.15 * craftScale,
      0.26,
      Math.sin(a) * 0.15 * craftScale
    );
    bell.castShadow = true;
    bodyGroup.add(bell);
  }

  // Vacuum Raptor (RVac) Large Bell Profile (3 outer skirt engines)
  const rvacBellProfile = [
    new THREE.Vector2(0.048, 0.24),
    new THREE.Vector2(0.040, 0.18),
    new THREE.Vector2(0.110, 0.06),
    new THREE.Vector2(0.155, -0.08),
    new THREE.Vector2(0.172, -0.18),
  ];
  const rvacBellGeo = new THREE.LatheGeometry(rvacBellProfile, 26);
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * Math.PI * 2 - Math.PI / 6;
    const rx = Math.cos(a) * 0.38 * craftScale;
    const rz = Math.sin(a) * 0.38 * craftScale;
    const rvac = new THREE.Mesh(rvacBellGeo, raptorNozzleMat);
    rvac.position.set(rx, 0.28, rz);
    rvac.castShadow = true;
    bodyGroup.add(rvac);

    const manifold = new THREE.Mesh(
      new THREE.TorusGeometry(0.12, 0.018, 10, 24),
      copperManifoldMat
    );
    manifold.rotation.x = Math.PI / 2;
    manifold.position.set(rx, 0.26, rz);
    bodyGroup.add(manifold);
  }

  // 7. Leeward (+Z) Lower Rover Payload Garage & Interior Lighting (y: 0.42 .. 1.54)
  const bayFloor = new THREE.Mesh(
    new THREE.CylinderGeometry(hullRadius * 0.98, hullRadius * 0.98, 0.08, 32),
    tpsBlackTileMat
  );
  bayFloor.position.y = 0.44;
  bayFloor.castShadow = true;
  bayFloor.receiveShadow = true;
  bodyGroup.add(bayFloor);

  const bayInnerLiner = new THREE.Mesh(
    new THREE.CylinderGeometry(
      hullRadius * 0.91,
      hullRadius * 0.91,
      1.04,
      28,
      1,
      true,
      Math.PI * 0.32,
      Math.PI * 1.36
    ),
    goldFoilMat
  );
  bayInnerLiner.material.side = THREE.BackSide;
  bayInnerLiner.position.y = 0.98;
  bodyGroup.add(bayInnerLiner);

  const bayCeiling = new THREE.Mesh(
    new THREE.CylinderGeometry(hullRadius * 0.96, hullRadius * 0.96, 0.06, 28),
    weldRingMat
  );
  bayCeiling.position.y = 1.52;
  bodyGroup.add(bayCeiling);

  const bayLight = new THREE.PointLight(0xfef3c7, 1.4, 5.5, 1.5);
  bayLight.position.set(0, 1.38, 0.22);
  bodyGroup.add(bayLight);

  // 8. 4 Shock-Absorbing Telescoping Skirt Landing Legs
  // Footpads sit at y = 0.03 on root so they stay flush on the surface while bodyGroup compresses
  const legsGroup = new THREE.Group();
  const legRigs: LandingLegRig[] = [];
  for (let i = 0; i < 4; i++) {
    const a = (i * Math.PI) / 2 + Math.PI / 4;
    const legHolder = new THREE.Group();
    legHolder.rotation.y = a;

    // Grounded Footpad (r = 1.06, y = 0.03)
    const footPad = new THREE.Mesh(
      new THREE.CylinderGeometry(0.14, 0.20, 0.06, 16),
      tpsBlackTileMat
    );
    footPad.position.set(1.06, 0.03, 0);
    footPad.castShadow = true;
    legHolder.add(footPad);

    // Lower shock sleeve pivoting from footpad up toward skirt mount
    const lowerPivot = new THREE.Group();
    lowerPivot.position.set(1.06, 0.06, 0);
    const sleeve = new THREE.Mesh(
      new THREE.CylinderGeometry(0.045, 0.055, 0.54, 12),
      raptorNozzleMat
    );
    sleeve.position.set(0, 0.27, 0);
    sleeve.castShadow = true;
    lowerPivot.add(sleeve);
    lowerPivot.rotation.z = 0.56;
    legHolder.add(lowerPivot);

    // Upper chrome piston sliding out from Starship skirt bracket
    const upperPivot = new THREE.Group();
    upperPivot.position.set(0.60 * craftScale, 0.68, 0);
    const piston = new THREE.Mesh(
      new THREE.CylinderGeometry(0.030, 0.034, 0.56, 12),
      stainlessSteelMat
    );
    piston.position.set(0, -0.28, 0);
    piston.castShadow = true;
    upperPivot.add(piston);
    upperPivot.rotation.z = 0.56;
    legHolder.add(upperPivot);

    // Diagonal brace strut from skirt base out toward footpad
    const brace = new THREE.Mesh(
      new THREE.CylinderGeometry(0.022, 0.026, 0.56, 10),
      tpsBlackTileMat
    );
    brace.position.set(0.82, 0.22, 0);
    brace.rotation.z = 1.18;
    legHolder.add(brace);

    legsGroup.add(legHolder);
    legRigs.push({ upperPivot, lowerPivot, piston });
  }
  root.add(legsGroup);

  // 9. Hinged Ribbed Rover Deployment Ramp (+Z Leeward Cargo Bay Lip)
  // Pivot at y = 0.48, z = 0.58 * craftScale; deployed angle 1.90 rad reaches ground at z ~ 1.98
  const rampPivot = new THREE.Group();
  rampPivot.position.set(0, 0.48, 0.58 * craftScale);

  const rampLength = 1.48;
  const rampPlate = new THREE.Mesh(
    new THREE.BoxGeometry(0.76, rampLength, 0.05),
    raptorNozzleMat
  );
  rampPlate.position.set(0, rampLength / 2, 0);
  rampPlate.castShadow = true;
  rampPlate.receiveShadow = true;
  rampPivot.add(rampPlate);

  for (let r = 0; r < 6; r++) {
    const rib = new THREE.Mesh(
      new THREE.BoxGeometry(0.68, 0.035, 0.075),
      tpsBlackTileMat
    );
    rib.position.set(0, 0.16 + r * 0.22, 0.018);
    rampPivot.add(rib);
  }

  [-0.38, 0.38].forEach((rx) => {
    const rail = new THREE.Mesh(
      new THREE.BoxGeometry(0.036, rampLength, 0.095),
      stainlessSteelMat
    );
    rail.position.set(rx, rampLength / 2, 0.025);
    rampPivot.add(rail);
  });

  bodyGroup.add(rampPivot);

  // 10. SpaceX Raptor Methalox (CH4/LOX) Mach-Diamond Plumes
  const flameGroup = new THREE.Group();
  const makeRaptorPlume = (px: number, pz: number, radius: number, len: number) => {
    // Outer violet-blue methalox shock sheath
    const outer = new THREE.Mesh(
      new THREE.ConeGeometry(radius, len, 20),
      new THREE.MeshBasicMaterial({
        color: 0x38bdf8,
        transparent: true,
        opacity: 0.46,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      })
    );
    outer.rotation.x = Math.PI;
    outer.position.set(px, 0.12 - len / 2, pz);
    flameGroup.add(outer);

    // Mid warm Mach-diamond cone
    const mid = new THREE.Mesh(
      new THREE.ConeGeometry(radius * 0.68, len * 0.78, 18),
      new THREE.MeshBasicMaterial({
        color: 0xf97316,
        transparent: true,
        opacity: 0.64,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      })
    );
    mid.rotation.x = Math.PI;
    mid.position.set(px, 0.12 - (len * 0.78) / 2, pz);
    flameGroup.add(mid);

    // Incandescent white-gold inner core
    const core = new THREE.Mesh(
      new THREE.ConeGeometry(radius * 0.36, len * 0.48, 14),
      new THREE.MeshBasicMaterial({
        color: 0xfef3c7,
        transparent: true,
        opacity: 0.88,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      })
    );
    core.rotation.x = Math.PI;
    core.position.set(px, 0.12 - (len * 0.48) / 2, pz);
    flameGroup.add(core);
  };

  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * Math.PI * 2 + Math.PI / 6;
    makeRaptorPlume(
      Math.cos(a) * 0.15 * craftScale,
      Math.sin(a) * 0.15 * craftScale,
      0.19,
      2.15
    );
  }
  makeRaptorPlume(0, 0, 0.30, 2.45);
  bodyGroup.add(flameGroup);

  return {
    root,
    bodyGroup,
    flameGroup,
    rampPivot,
    legsGroup,
    legRigs,
    fwdFlaps,
    aftFlaps,
    bayLight,
  };
}

export const buildLandingVehicle = buildDropSpaceship;

export interface RoverVehicleRig {
  root: THREE.Group;
  wheels: THREE.Mesh[];
  mastHead: THREE.Group;
  headlightGroup: THREE.Group;
  armJoint: THREE.Group;
  armHead: THREE.Group;
}

interface CachedCuriosityGlbAssets {
  bodyScene: THREE.Group;
  wheelGeometries: THREE.BufferGeometry[]; // 6 centered wheel geometries matching CURIOSITY_WHEEL_HUBS order
  wheelMaterial: THREE.Material | THREE.Material[];
}

export const CURIOSITY_WHEEL_HUBS: readonly [number, number, number][] = [
  [-1.059, 0.254, -1.163], // 0: Left Rear
  [-1.189, 0.253, -0.087], // 1: Left Mid
  [-1.059, 0.259, 1.098],  // 2: Left Front
  [1.067, 0.250, -1.160],  // 3: Right Rear
  [1.198, 0.252, -0.086],  // 4: Right Mid
  [1.067, 0.259, 1.098],   // 5: Right Front
];

let cachedCuriosityGlbPromise: Promise<CachedCuriosityGlbAssets | null> | null = null;

function splitCuriosityWheelsGeometry(
  sourceGeo: THREE.BufferGeometry,
  nodeOffset: THREE.Vector3
): THREE.BufferGeometry[] | null {
  const nonIndexed = sourceGeo.index ? sourceGeo.toNonIndexed() : sourceGeo.clone();
  const posAttr = nonIndexed.getAttribute('position');
  if (!posAttr || posAttr.count < 3) return null;

  const normAttr = nonIndexed.getAttribute('normal');
  const uvAttr = nonIndexed.getAttribute('uv');

  const bucketIndices: number[][] = [[], [], [], [], [], []];
  const triCount = Math.floor(posAttr.count / 3);

  for (let t = 0; t < triCount; t++) {
    const i0 = t * 3;
    const i1 = i0 + 1;
    const i2 = i0 + 2;

    const cx =
      (posAttr.getX(i0) + posAttr.getX(i1) + posAttr.getX(i2)) / 3 + nodeOffset.x;
    const cz =
      (posAttr.getZ(i0) + posAttr.getZ(i1) + posAttr.getZ(i2)) / 3 + nodeOffset.z;

    const sideBase = cx < 0 ? 0 : 3;
    const rowOffset = cz < -0.5 ? 0 : cz > 0.5 ? 2 : 1;
    const bucketIdx = sideBase + rowOffset;
    bucketIndices[bucketIdx].push(i0, i1, i2);
  }

  return bucketIndices.map((verts, wIdx) => {
    const [hubX, hubY, hubZ] = CURIOSITY_WHEEL_HUBS[wIdx];
    const vCount = verts.length;
    const positions = new Float32Array(vCount * 3);
    const normals = normAttr ? new Float32Array(vCount * 3) : null;
    const uvs = uvAttr ? new Float32Array(vCount * 2) : null;

    for (let k = 0; k < vCount; k++) {
      const srcIdx = verts[k];
      positions[k * 3] = posAttr.getX(srcIdx) + nodeOffset.x - hubX;
      positions[k * 3 + 1] = posAttr.getY(srcIdx) + nodeOffset.y - hubY;
      positions[k * 3 + 2] = posAttr.getZ(srcIdx) + nodeOffset.z - hubZ;

      if (normals && normAttr) {
        normals[k * 3] = normAttr.getX(srcIdx);
        normals[k * 3 + 1] = normAttr.getY(srcIdx);
        normals[k * 3 + 2] = normAttr.getZ(srcIdx);
      }
      if (uvs && uvAttr) {
        uvs[k * 2] = uvAttr.getX(srcIdx);
        uvs[k * 2 + 1] = uvAttr.getY(srcIdx);
      }
    }

    const wGeo = new THREE.BufferGeometry();
    wGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    if (normals) wGeo.setAttribute('normal', new THREE.BufferAttribute(normals, 3));
    if (uvs) wGeo.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
    wGeo.computeBoundingSphere();
    return wGeo;
  });
}

function loadOfficialCuriosityGlb(): Promise<CachedCuriosityGlbAssets | null> {
  if (cachedCuriosityGlbPromise) return cachedCuriosityGlbPromise;

  cachedCuriosityGlbPromise = new Promise((resolve) => {
    const loader = new GLTFLoader();
    loader.load(
      '/assets/models/curiosity_clean.glb',
      (gltf) => {
        const bodyScene = gltf.scene;
        let wheelGeometries: THREE.BufferGeometry[] = [];
        let wheelMaterial: THREE.Material | THREE.Material[] = new THREE.MeshStandardMaterial({
          color: 0x1a1e26,
          roughness: 0.55,
          metalness: 0.78,
        });

        const mslNode = bodyScene.children[0] ?? bodyScene;
        const nodeOffset = mslNode.position.clone();

        bodyScene.traverse((child) => {
          if ((child as THREE.Mesh).isMesh) {
            const mesh = child as THREE.Mesh;
            mesh.castShadow = true;
            mesh.receiveShadow = true;

            const mat = Array.isArray(mesh.material) ? mesh.material[0] : mesh.material;
            if (mat && 'envMapIntensity' in mat) {
              (mat as THREE.MeshStandardMaterial).envMapIntensity = 0.9;
            }

            if (mat && mat.name === 'wheels') {
              const split = splitCuriosityWheelsGeometry(mesh.geometry, nodeOffset);
              if (split && split.length === 6) {
                wheelGeometries = split;
                wheelMaterial = mesh.material;
                mesh.visible = false; // Hide static GLB wheels so the 6 centered GLB wheels spin!
              }
            }
          }
        });

        resolve({ bodyScene, wheelGeometries, wheelMaterial });
      },
      undefined,
      () => {
        resolve(null);
      }
    );
  });

  return cachedCuriosityGlbPromise;
}

/**
 * Authentic NASA Curiosity (MSL - Mars Science Laboratory - Clean) Rover:
 * - Loads official NASA 3D GLB model (`/assets/models/curiosity_clean.glb`) with separated spinning 6-wheel geometry
 * - Angled 45° rear MMRTG (Multi-Mission Radioisotope Thermoelectric Generator) plutonium nuclear power source with 8 heat-rejection fins
 * - Remote Sensing Mast (RSM) with Cyclops ChemCam Laser Telescope, asymmetric MastCam-34 / MastCam-100 & stereo NavCam ears
 * - 5-DOF Front Robotic Arm with heavy 5-tool Science Turret (PADS Rotary Percussive Drill, APXS, MAHLI, CHIMRA, DRT)
 * - 6-wheeled Black-Anodized Aluminum Rocker-Bogie suspension with curved titanium spiral spokes
 */
export function buildRoverVehicle(assets: SpacecraftPBRAssets): RoverVehicleRig {
  const root = new THREE.Group();
  // Real Curiosity is ~2.75m wheelbase x 2.2m tall; scale 0.22 fits cleanly inside Starship cargo bay & 0.76u ramp rails
  const modelGroup = new THREE.Group();
  modelGroup.scale.setScalar(0.22);
  root.add(modelGroup);

  const proceduralBodyGroup = new THREE.Group();
  modelGroup.add(proceduralBodyGroup);

  const glbMountGroup = new THREE.Group();
  modelGroup.add(glbMountGroup);

  const wheels: THREE.Mesh[] = [];

  const whiteDeckMat = new THREE.MeshPhysicalMaterial({
    color: 0xf1f5f9,
    roughness: 0.26,
    metalness: 0.18,
    clearcoat: 0.38,
  });

  const goldFoilMat = new THREE.MeshPhysicalMaterial({
    map: assets.kapton.map,
    normalMap: assets.kapton.normalMap,
    normalScale: new THREE.Vector2(1.2, 1.2),
    color: 0xfbbf24,
    roughness: 0.25,
    metalness: 0.88,
    clearcoat: 0.26,
  });

  const titaniumMat = new THREE.MeshStandardMaterial({
    color: 0x94a3b8,
    roughness: 0.32,
    metalness: 0.86,
  });

  const blackAnodizedMat = new THREE.MeshStandardMaterial({
    color: 0x161b24,
    roughness: 0.44,
    metalness: 0.82,
  });

  const wheelTireMat = new THREE.MeshStandardMaterial({
    color: 0x11151d,
    roughness: 0.56,
    metalness: 0.78,
  });

  const sensorRedMat = new THREE.MeshStandardMaterial({
    color: 0xef4444,
    emissive: 0x991b1b,
    emissiveIntensity: 0.45,
    roughness: 0.22,
    metalness: 0.5,
  });

  const lensCyanMat = new THREE.MeshBasicMaterial({ color: 0x38bdf8 });

  // 1. NASA Curiosity (MSL - Clean) Warm Electronics Box (WEB) & White Equipment Deck
  const webChassis = new THREE.Mesh(new THREE.BoxGeometry(1.38, 0.54, 1.78), whiteDeckMat);
  webChassis.position.set(0, 0.84, 0.02);
  webChassis.castShadow = true;
  webChassis.receiveShadow = true;
  proceduralBodyGroup.add(webChassis);

  const topDeck = new THREE.Mesh(new THREE.BoxGeometry(1.46, 0.07, 1.84), whiteDeckMat);
  topDeck.position.set(0, 1.13, 0.02);
  topDeck.castShadow = true;
  topDeck.receiveShadow = true;
  proceduralBodyGroup.add(topDeck);

  // Gold Kapton side thermal panels & front Hazcam bay
  [-1, 1].forEach((side) => {
    const sideGold = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.38, 1.42), goldFoilMat);
    sideGold.position.set(side * 0.7, 0.84, 0.02);
    proceduralBodyGroup.add(sideGold);
  });

  const frontAvionics = new THREE.Mesh(new THREE.BoxGeometry(1.18, 0.36, 0.24), goldFoilMat);
  frontAvionics.position.set(0, 0.82, 0.96);
  proceduralBodyGroup.add(frontAvionics);

  // 2. Angled Rear MMRTG (Multi-Mission Radioisotope Thermoelectric Generator) & 8 Heat Fins
  const mmrtgGroup = new THREE.Group();
  mmrtgGroup.position.set(-0.08, 1.04, -1.16);
  mmrtgGroup.rotation.x = -0.62; // Iconic 35-45° upward cant at rear of Curiosity
  proceduralBodyGroup.add(mmrtgGroup);

  const rtgSupport = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.24, 0.42), blackAnodizedMat);
  rtgSupport.position.set(0, -0.08, 0.14);
  mmrtgGroup.add(rtgSupport);

  const rtgCore = new THREE.Mesh(new THREE.CylinderGeometry(0.21, 0.22, 0.74, 20), whiteDeckMat);
  rtgCore.position.set(0, 0.28, -0.14);
  rtgCore.castShadow = true;
  mmrtgGroup.add(rtgCore);

  // 8 Radial Heat-Rejection Fins around the MMRTG core
  for (let f = 0; f < 8; f++) {
    const angle = (f / 8) * Math.PI * 2;
    const fin = new THREE.Mesh(new THREE.BoxGeometry(0.025, 0.68, 0.18), whiteDeckMat);
    fin.position.set(
      Math.sin(angle) * 0.25,
      0.28,
      -0.14 + Math.cos(angle) * 0.25
    );
    fin.rotation.y = angle;
    fin.castShadow = true;
    mmrtgGroup.add(fin);
  }

  const rtgCap = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.22, 0.12, 20), goldFoilMat);
  rtgCap.position.set(0, 0.68, -0.14);
  mmrtgGroup.add(rtgCap);

  // 3. Rear Deck Antennas: Hexagonal High-Gain Antenna (HGA) & Black UHF Cylinder
  const hgaPedestal = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.08, 0.22, 12), blackAnodizedMat);
  hgaPedestal.position.set(0.44, 1.26, -0.52);
  proceduralBodyGroup.add(hgaPedestal);

  const hgaHexPanel = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 0.04, 6), goldFoilMat);
  hgaHexPanel.position.set(0.44, 1.4, -0.52);
  hgaHexPanel.rotation.set(0.38, 0.2, 0);
  proceduralBodyGroup.add(hgaHexPanel);

  const uhfCylinder = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 0.34, 16), blackAnodizedMat);
  uhfCylinder.position.set(-0.46, 1.32, -0.58);
  proceduralBodyGroup.add(uhfCylinder);

  // 4. Black-Anodized Tubular Titanium 6-Wheel Rocker-Bogie Suspension
  [-1, 1].forEach((side) => {
    const xStrut = side * 0.88;

    // Main differential pivot on side of chassis
    const diffHub = new THREE.Mesh(
      new THREE.CylinderGeometry(0.09, 0.09, 0.24, 16),
      blackAnodizedMat
    );
    diffHub.rotation.z = Math.PI / 2;
    diffHub.position.set(side * 0.78, 0.92, 0.12);
    proceduralBodyGroup.add(diffHub);

    // Forward Rocker Tube (pivot -> front wheel knuckle)
    const fwdRocker = new THREE.Mesh(new THREE.CylinderGeometry(0.048, 0.048, 1.18, 12), blackAnodizedMat);
    fwdRocker.position.set(xStrut, 0.72, 0.62);
    fwdRocker.rotation.x = 1.18;
    fwdRocker.castShadow = true;
    proceduralBodyGroup.add(fwdRocker);

    // Aft Rocker Tube (pivot -> bogie hinge)
    const aftRocker = new THREE.Mesh(new THREE.CylinderGeometry(0.048, 0.048, 0.76, 12), blackAnodizedMat);
    aftRocker.position.set(xStrut, 0.76, -0.22);
    aftRocker.rotation.x = -1.12;
    aftRocker.castShadow = true;
    proceduralBodyGroup.add(aftRocker);

    // Rear Bogie Frame (connecting mid and rear wheels)
    const bogieTube = new THREE.Mesh(new THREE.CylinderGeometry(0.042, 0.042, 1.14, 12), blackAnodizedMat);
    bogieTube.position.set(xStrut, 0.54, -0.62);
    bogieTube.rotation.x = Math.PI / 2;
    bogieTube.castShadow = true;
    proceduralBodyGroup.add(bogieTube);

    // Vertical steering/drive drop struts at each wheel station
    [-1.161, -0.086, 1.098].forEach((zPos, idx) => {
      const xLeg = side * (idx === 1 ? 1.02 : 0.92);
      const dropLeg = new THREE.Mesh(new THREE.CylinderGeometry(0.038, 0.038, 0.38, 10), titaniumMat);
      dropLeg.position.set(xLeg, 0.44, zPos);
      proceduralBodyGroup.add(dropLeg);
    });
  });

  // 5. 6 Spinning Black-Anodized MSL Wheels (aligned with NASA GLB wheel hub centers)
  const procWheelGeo = new THREE.CylinderGeometry(0.243, 0.243, 0.395, 24);
  procWheelGeo.rotateZ(Math.PI / 2);

  const procInnerRimGeo = new THREE.CylinderGeometry(0.185, 0.185, 0.402, 16);
  procInnerRimGeo.rotateZ(Math.PI / 2);

  const procHubGeo = new THREE.CylinderGeometry(0.075, 0.075, 0.415, 12);
  procHubGeo.rotateZ(Math.PI / 2);

  CURIOSITY_WHEEL_HUBS.forEach(([wx, wy, wz]) => {
    const wheelMesh = new THREE.Mesh(procWheelGeo, wheelTireMat);
    wheelMesh.position.set(wx, wy, wz);
    wheelMesh.castShadow = true;
    wheelMesh.receiveShadow = true;

    const innerRim = new THREE.Mesh(procInnerRimGeo, blackAnodizedMat);
    wheelMesh.add(innerRim);

    const centerHub = new THREE.Mesh(procHubGeo, titaniumMat);
    wheelMesh.add(centerHub);

    modelGroup.add(wheelMesh);
    wheels.push(wheelMesh);
  });

  // 6. Remote Sensing Mast (RSM) & Cyclops ChemCam + MastCam + Stereo NavCam Head
  const mastPole = new THREE.Mesh(new THREE.CylinderGeometry(0.068, 0.082, 0.78, 16), whiteDeckMat);
  mastPole.position.set(-0.488, 1.52, 0.744);
  mastPole.castShadow = true;
  proceduralBodyGroup.add(mastPole);

  const mastHead = new THREE.Group();
  // Exact Remote Sensing Mast head coordinate matching NASA Curiosity GLB
  mastHead.position.set(-0.488, 1.952, 0.744);
  modelGroup.add(mastHead);

  // Cyclops ChemCam upper housing
  const chemCamHousing = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.24, 0.28), whiteDeckMat);
  chemCamHousing.position.set(0, 0.08, 0);
  chemCamHousing.castShadow = true;
  mastHead.add(chemCamHousing);

  // Iconic Circular "Cyclops" ChemCam Laser Telescope Ring & Aperture
  const cyclopsBezel = new THREE.Mesh(
    new THREE.CylinderGeometry(0.095, 0.095, 0.08, 24),
    goldFoilMat
  );
  cyclopsBezel.rotation.x = Math.PI / 2;
  cyclopsBezel.position.set(0, 0.11, 0.14);
  mastHead.add(cyclopsBezel);

  const cyclopsMirror = new THREE.Mesh(
    new THREE.CylinderGeometry(0.072, 0.072, 0.09, 24),
    blackAnodizedMat
  );
  cyclopsMirror.rotation.x = Math.PI / 2;
  cyclopsMirror.position.set(0, 0.11, 0.145);
  mastHead.add(cyclopsMirror);

  const chemCamLaserAperture = new THREE.Mesh(
    new THREE.SphereGeometry(0.028, 12, 12),
    sensorRedMat
  );
  chemCamLaserAperture.position.set(0, 0.11, 0.19);
  mastHead.add(chemCamLaserAperture);

  // Asymmetric Dual MastCam Boxes (34mm & 100mm telephoto) beneath Cyclops eye
  const mastCam34 = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.09, 0.12), blackAnodizedMat);
  mastCam34.position.set(-0.08, -0.05, 0.11);
  mastHead.add(mastCam34);

  const mastCam100 = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.11, 0.14), blackAnodizedMat);
  mastCam100.position.set(0.08, -0.05, 0.12);
  mastHead.add(mastCam100);

  [-0.08, 0.08].forEach((mx) => {
    const mLens = new THREE.Mesh(new THREE.CylinderGeometry(0.026, 0.026, 0.04, 14), lensCyanMat);
    mLens.rotation.x = Math.PI / 2;
    mLens.position.set(mx, -0.05, 0.18);
    mastHead.add(mLens);
  });

  // Stereo NavCam Lateral Bar ("Ears")
  const navCamBar = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.07, 0.09), whiteDeckMat);
  navCamBar.position.set(0, -0.02, 0.04);
  mastHead.add(navCamBar);

  [-0.26, -0.19, 0.19, 0.26].forEach((nx) => {
    const navBarrel = new THREE.Mesh(
      new THREE.CylinderGeometry(0.022, 0.022, 0.08, 12),
      blackAnodizedMat
    );
    navBarrel.rotation.x = Math.PI / 2;
    navBarrel.position.set(nx, -0.02, 0.09);
    mastHead.add(navBarrel);
  });

  // 7. Front 5-DOF Robotic Arm & 5-Tool APXS / MAHLI / PADS Rotary Drill Turret
  const armShoulderMount = new THREE.Group();
  armShoulderMount.position.set(0.38, 0.88, 0.98);
  modelGroup.add(armShoulderMount);

  const shoulderAzimuth = new THREE.Mesh(
    new THREE.CylinderGeometry(0.12, 0.14, 0.18, 16),
    blackAnodizedMat
  );
  armShoulderMount.add(shoulderAzimuth);

  const armJoint = new THREE.Group();
  armJoint.position.set(0, 0.04, 0.06);
  armShoulderMount.add(armJoint);

  const upperArmBoom = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.12, 0.68), whiteDeckMat);
  upperArmBoom.position.set(0, 0.14, 0.32);
  upperArmBoom.rotation.x = -0.32;
  upperArmBoom.castShadow = true;
  armJoint.add(upperArmBoom);

  const elbowActuator = new THREE.Mesh(
    new THREE.CylinderGeometry(0.085, 0.085, 0.18, 16),
    blackAnodizedMat
  );
  elbowActuator.rotation.z = Math.PI / 2;
  elbowActuator.position.set(0, 0.26, 0.64);
  armJoint.add(elbowActuator);

  const armHead = new THREE.Group();
  armHead.position.set(0, 0.26, 0.64);
  armJoint.add(armHead);

  const forearmBoom = new THREE.Mesh(new THREE.BoxGeometry(0.095, 0.10, 0.56), titaniumMat);
  forearmBoom.position.set(0, -0.06, 0.26);
  forearmBoom.rotation.x = 0.28;
  forearmBoom.castShadow = true;
  armHead.add(forearmBoom);

  // Heavy 5-Tool Curiosity Turret (PADS Drill, APXS, MAHLI, CHIMRA, DRT)
  const turretGroup = new THREE.Group();
  turretGroup.position.set(0, -0.14, 0.56);
  armHead.add(turretGroup);

  const turretCore = new THREE.Mesh(
    new THREE.CylinderGeometry(0.16, 0.16, 0.18, 18),
    whiteDeckMat
  );
  turretCore.castShadow = true;
  turretGroup.add(turretCore);

  // PADS Rotary Percussive Drill Assembly
  const drillHousing = new THREE.Mesh(
    new THREE.BoxGeometry(0.12, 0.14, 0.26),
    blackAnodizedMat
  );
  drillHousing.position.set(0, -0.04, 0.14);
  turretGroup.add(drillHousing);

  const drillBit = new THREE.Mesh(
    new THREE.CylinderGeometry(0.016, 0.024, 0.22, 12),
    titaniumMat
  );
  drillBit.rotation.x = Math.PI / 2;
  drillBit.position.set(0, -0.04, 0.32);
  turretGroup.add(drillBit);

  // Contact stabilizing prongs flanking the drill bit
  [-0.055, 0.055].forEach((px) => {
    const prong = new THREE.Mesh(
      new THREE.CylinderGeometry(0.012, 0.012, 0.18, 8),
      titaniumMat
    );
    prong.rotation.x = Math.PI / 2;
    prong.position.set(px, -0.04, 0.28);
    turretGroup.add(prong);
  });

  // APXS (Alpha Particle X-Ray Spectrometer) & MAHLI (Mars Hand Lens Imager)
  const apxsBarrel = new THREE.Mesh(
    new THREE.CylinderGeometry(0.045, 0.052, 0.16, 14),
    goldFoilMat
  );
  apxsBarrel.rotation.z = Math.PI / 2;
  apxsBarrel.position.set(-0.16, 0.02, 0.04);
  turretGroup.add(apxsBarrel);

  const mahliHead = new THREE.Mesh(
    new THREE.CylinderGeometry(0.042, 0.045, 0.15, 14),
    sensorRedMat
  );
  mahliHead.rotation.z = Math.PI / 2;
  mahliHead.position.set(0.16, 0.02, 0.04);
  turretGroup.add(mahliHead);

  // 8. Front LED Hazcam Illumination Lamps + Toggleable Volumetric Cones & PointLight (OFF by default)
  const headlightGroup = new THREE.Group();
  headlightGroup.visible = false;
  const beamMat = new THREE.MeshBasicMaterial({
    color: 0xfef08a,
    transparent: true,
    opacity: 0.22,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
  [-0.42, 0.42].forEach((hx) => {
    const lamp = new THREE.Mesh(
      new THREE.SphereGeometry(0.055, 10, 10),
      new THREE.MeshBasicMaterial({ color: 0xfef08a })
    );
    lamp.position.set(hx, 0.92, 1.02);
    headlightGroup.add(lamp);

    const coneGeo = new THREE.ConeGeometry(0.95, 5.8, 18, 1, true);
    coneGeo.rotateX(-Math.PI / 2);
    const beamCone = new THREE.Mesh(coneGeo, beamMat);
    beamCone.position.set(hx * 1.15, 0.48, 3.85);
    beamCone.rotation.x = 0.09;
    headlightGroup.add(beamCone);
  });

  const headPointLight = new THREE.PointLight(0xfef9c3, 3.4, 10.5, 1.4);
  headPointLight.position.set(0, 1.25, 2.8);
  headlightGroup.add(headPointLight);
  modelGroup.add(headlightGroup);

  // 9. Asynchronously mount official NASA Curiosity (MSL - Clean) GLB & swap spinning GLB wheel geometries
  loadOfficialCuriosityGlb().then((cached) => {
    if (!cached) return;
    const glbClone = cached.bodyScene.clone(true);
    glbMountGroup.add(glbClone);
    proceduralBodyGroup.visible = false;

    if (cached.wheelGeometries.length === 6) {
      for (let i = 0; i < 6; i++) {
        const wMesh = wheels[i];
        if (!wMesh) continue;
        wMesh.clear();
        wMesh.geometry = cached.wheelGeometries[i];
        wMesh.material = cached.wheelMaterial;
      }
    }
  });

  return { root, wheels, mastHead, headlightGroup, armJoint, armHead };
}




export interface GlbSuitShaderUniforms {
  uVisorColor: { value: THREE.Color };
  uVisorEmissive: { value: THREE.Color };
  uVisorRoughness: { value: number };
  uVisorMetalness: { value: number };
  uTrimPrimary: { value: THREE.Color };
  uTrimSecondary: { value: THREE.Color };
  uTrimAccent: { value: THREE.Color };
  uUseTrimPalette: { value: number };
}

export interface CommanderAstronautRig {
  root: THREE.Group;
  upperBodyGroup: THREE.Group;
  headGroup: THREE.Group;
  leftArmGroup: THREE.Group;
  rightArmGroup: THREE.Group;
  visorMat: THREE.MeshPhysicalMaterial;
  suitPrimaryMat: THREE.MeshPhysicalMaterial;
  suitSecondaryMat: THREE.MeshPhysicalMaterial;
  suitAccentMat: THREE.MeshStandardMaterial;
  suitJointMat: THREE.MeshStandardMaterial;
  flagPatchMat: THREE.MeshStandardMaterial;
  glbShaderUniforms: GlbSuitShaderUniforms;
  latestConfig: CommanderConfig;
  isGlbLoaded: boolean;
}

export function updateCommanderAstronautMaterials(
  rig: CommanderAstronautRig,
  config: CommanderConfig,
  flagTexture?: THREE.Texture
): void {
  rig.latestConfig = { ...config };
  const visorSpec = VISOR_OPTIONS.find((v) => v.id === config.visorId) || VISOR_OPTIONS[0];
  const suitSpec =
    SUIT_PALETTE_OPTIONS.find((s) => s.id === config.suitPaletteId) || SUIT_PALETTE_OPTIONS[0];

  rig.visorMat.color.set(visorSpec.colorHex);
  rig.visorMat.emissive.set(visorSpec.emissiveHex);
  rig.visorMat.metalness = visorSpec.metalness;
  rig.visorMat.roughness = visorSpec.roughness;
  rig.visorMat.needsUpdate = true;

  rig.suitPrimaryMat.color.set(suitSpec.primaryHex);
  rig.suitPrimaryMat.needsUpdate = true;

  rig.suitSecondaryMat.color.set(suitSpec.secondaryHex);
  rig.suitSecondaryMat.needsUpdate = true;

  rig.suitAccentMat.color.set(suitSpec.accentHex);
  rig.suitAccentMat.emissive.set(suitSpec.accentHex);
  rig.suitAccentMat.emissiveIntensity = 0.22;
  rig.suitAccentMat.needsUpdate = true;

  rig.suitJointMat.color.set(suitSpec.jointHex);
  rig.suitJointMat.needsUpdate = true;

  // Update real NASA GLB shader uniforms for 100% full-helmet visor glass & limited Commander trim stripes
  const u = rig.glbShaderUniforms;
  u.uVisorColor.value.set(visorSpec.colorHex);
  u.uVisorEmissive.value.set(visorSpec.emissiveHex);
  u.uVisorRoughness.value = Math.max(0.06, visorSpec.roughness);
  u.uVisorMetalness.value = Math.min(0.95, visorSpec.metalness);

  u.uTrimPrimary.value.set(suitSpec.primaryHex);
  u.uTrimSecondary.value.set(suitSpec.secondaryHex);
  u.uTrimAccent.value.set(suitSpec.accentHex);
  u.uUseTrimPalette.value = config.suitPaletteId === 'nasa_white' ? 0.0 : 1.0;

  if (flagTexture) {
    rig.flagPatchMat.map = flagTexture;
    rig.flagPatchMat.needsUpdate = true;
  }
}

/**
 * Attaches a custom PBR shader hook onto NeilArmstrong.glb materials so:
 * 1) 100% of the curved helmet visor glass (defined by StingrayPBS2's 2048x2048 metalness & gold mask)
 *    is recognized and painted edge-to-edge with the selected Visor color and mirror finish.
 * 2) Suit palette colors are restricted to clean, limited NASA Commander trim stripes on the upper arms,
 *    thighs, helmet crown, and backpack cap while multiplying by fabric luminance so zero suit details,
 *    seams, badges, or chest valves are ever covered up.
 */
function attachGlbSuitAndVisorShader(
  mat: THREE.MeshStandardMaterial,
  sharedUniforms: GlbSuitShaderUniforms,
  isHelmetAndBackpackMesh: boolean
): void {
  mat.color.setHex(0xffffff);
  mat.emissive.setHex(0x000000);
  mat.emissiveIntensity = 1.0;
  // Preserve 1.0 factor so #include <metalnessmap_fragment> samples raw 0..1 texelMetalness.b
  mat.metalness = 1.0;
  mat.roughness = 1.0;

  mat.onBeforeCompile = (shader) => {
    shader.uniforms.uVisorColor = sharedUniforms.uVisorColor;
    shader.uniforms.uVisorEmissive = sharedUniforms.uVisorEmissive;
    shader.uniforms.uVisorRoughness = sharedUniforms.uVisorRoughness;
    shader.uniforms.uVisorMetalness = sharedUniforms.uVisorMetalness;
    shader.uniforms.uTrimPrimary = sharedUniforms.uTrimPrimary;
    shader.uniforms.uTrimSecondary = sharedUniforms.uTrimSecondary;
    shader.uniforms.uTrimAccent = sharedUniforms.uTrimAccent;
    shader.uniforms.uUseTrimPalette = sharedUniforms.uUseTrimPalette;
    shader.uniforms.uIsHelmetMesh = { value: isHelmetAndBackpackMesh ? 1.0 : 0.0 };

    shader.vertexShader =
      `varying vec3 vSuitLocalPos;\n` +
      shader.vertexShader.replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>\nvSuitLocalPos = vec3( position );`
      );

    shader.fragmentShader =
      `
      varying vec3 vSuitLocalPos;
      uniform vec3 uVisorColor;
      uniform vec3 uVisorEmissive;
      uniform float uVisorRoughness;
      uniform float uVisorMetalness;
      uniform vec3 uTrimPrimary;
      uniform vec3 uTrimSecondary;
      uniform vec3 uTrimAccent;
      uniform float uUseTrimPalette;
      uniform float uIsHelmetMesh;
      ` +
      shader.fragmentShader
        .replace(
          '#include <metalnessmap_fragment>',
          `
          #include <metalnessmap_fragment>
          float rawVisorMetal = metalnessFactor;
          float goldDelta = diffuseColor.r - diffuseColor.b;
          float visorMask = 0.0;
          if (uIsHelmetMesh > 0.5 && vSuitLocalPos.y > 1.51 && vSuitLocalPos.z > 0.03) {
            float byMetal = smoothstep(0.24, 0.48, rawVisorMetal);
            float byGold = smoothstep(0.15, 0.28, goldDelta) * step(0.08, vSuitLocalPos.z);
            visorMask = clamp(max(byMetal, byGold), 0.0, 1.0);
          }

          // Base non-visor spacesuit fabric PBR calibration
          float fabricMetalness = 0.08;
          float fabricRoughness = clamp(roughnessFactor * 1.25, 0.55, 0.86);

          // Limited Commander Trim Bands (only on clean white fabric, never covering suit details)
          if (uUseTrimPalette > 0.5 && visorMask < 0.05) {
            float trimWeight = 0.0;
            vec3 trimTarget = uTrimPrimary;

            // 1. Upper-Arm Commander Stripes (below shoulder flag patch)
            if (abs(vSuitLocalPos.x) > 0.22 && vSuitLocalPos.y > 1.205 && vSuitLocalPos.y < 1.295) {
              float armBand = smoothstep(1.208, 1.216, vSuitLocalPos.y) * (1.0 - smoothstep(1.268, 1.276, vSuitLocalPos.y));
              float armAccent = smoothstep(1.276, 1.281, vSuitLocalPos.y) * (1.0 - smoothstep(1.290, 1.295, vSuitLocalPos.y));
              if (armAccent > armBand) {
                trimWeight = armAccent;
                trimTarget = uTrimAccent;
              } else {
                trimWeight = armBand;
                trimTarget = uTrimPrimary;
              }
            }

            // 2. Thigh / Knee Commander Stripes
            if (vSuitLocalPos.y > 0.515 && vSuitLocalPos.y < 0.615) {
              float legBand = smoothstep(0.518, 0.526, vSuitLocalPos.y) * (1.0 - smoothstep(0.580, 0.588, vSuitLocalPos.y));
              float legAccent = smoothstep(0.588, 0.593, vSuitLocalPos.y) * (1.0 - smoothstep(0.608, 0.614, vSuitLocalPos.y));
              if (legAccent > legBand) {
                trimWeight = max(trimWeight, legAccent);
                trimTarget = uTrimAccent;
              } else if (legBand > trimWeight) {
                trimWeight = legBand;
                trimTarget = uTrimPrimary;
              }
            }

            // 3. Helmet Crown Stripe & PLSS Backpack Upper Trim Band
            if (uIsHelmetMesh > 0.5) {
              if (vSuitLocalPos.y > 1.76 && vSuitLocalPos.z < 0.165) {
                float crownStripe = 1.0 - smoothstep(0.018, 0.026, abs(vSuitLocalPos.x - 0.007));
                if (crownStripe > trimWeight) {
                  trimWeight = crownStripe;
                  trimTarget = uTrimAccent;
                }
              }
              if (vSuitLocalPos.z < -0.115 && vSuitLocalPos.y > 1.415 && vSuitLocalPos.y < 1.515) {
                float plssBand = smoothstep(1.438, 1.446, vSuitLocalPos.y) * (1.0 - smoothstep(1.505, 1.513, vSuitLocalPos.y));
                float plssAccent = smoothstep(1.418, 1.423, vSuitLocalPos.y) * (1.0 - smoothstep(1.433, 1.438, vSuitLocalPos.y));
                if (plssAccent > plssBand && plssAccent > trimWeight) {
                  trimWeight = plssAccent;
                  trimTarget = uTrimAccent;
                } else if (plssBand > trimWeight) {
                  trimWeight = plssBand;
                  trimTarget = uTrimSecondary;
                }
              }
            }

            if (trimWeight > 0.001) {
              float fabricLum = dot(diffuseColor.rgb, vec3(0.299, 0.587, 0.114));
              float fabricSat = max(diffuseColor.r, max(diffuseColor.g, diffuseColor.b)) - min(diffuseColor.r, min(diffuseColor.g, diffuseColor.b));
              // Preserve dark seams, shadows, straps, and colored connectors
              float detailGuard = smoothstep(0.42, 0.60, fabricLum) * (1.0 - smoothstep(0.14, 0.26, fabricSat));
              float finalTrim = trimWeight * detailGuard * 0.82;
              vec3 shadedTrim = trimTarget * clamp(fabricLum * 1.22, 0.38, 1.08);
              diffuseColor.rgb = mix(diffuseColor.rgb, shadedTrim, finalTrim);
            }
          }

          // Apply Full-Helmet Visor Glass Color & Mirror Finish across 100% of visor opening
          if (visorMask > 0.001) {
            float visorLum = dot(diffuseColor.rgb, vec3(0.299, 0.587, 0.114));
            float visorShade = clamp(visorLum * 1.32, 0.68, 1.14);
            diffuseColor.rgb = mix(diffuseColor.rgb, uVisorColor * visorShade, visorMask);
          }

          metalnessFactor = mix(fabricMetalness, uVisorMetalness, visorMask);
          roughnessFactor = mix(fabricRoughness, uVisorRoughness, visorMask);
          `
        )
        .replace(
          '#include <emissivemap_fragment>',
          `
          #include <emissivemap_fragment>
          if (visorMask > 0.001) {
            totalEmissiveRadiance += uVisorEmissive * visorMask * 0.32;
          }
          `
        );
  };
  mat.needsUpdate = true;
}

/**
 * Conforms a curved 3D stitched shoulder flag patch cleanly outside the outer sleeve
 * of the real NASA NeilArmstrong.glb spacesuit so it never sinks into fabric folds.
 */
function buildConformedGlbShoulderPatch(
  targetRoot: THREE.Object3D,
  side: 1 | -1,
  flagMat: THREE.Material,
  borderMat: THREE.Material
): THREE.Group {
  const group = new THREE.Group();
  const raycaster = new THREE.Raycaster();
  const origin = new THREE.Vector3();
  const dir = new THREE.Vector3(-side, 0, 0);

  const centerY = 1.368;
  const centerZ = side === 1 ? -0.018 : -0.015;

  // Sample the outermost sleeve peak across the patch area so no wrinkle ever clips through
  let maxAbsX = side === 1 ? 0.395 : 0.348;
  for (let sy = -0.035; sy <= 0.035; sy += 0.0175) {
    for (let sz = -0.045; sz <= 0.045; sz += 0.0225) {
      origin.set(side * 0.65, centerY + sy, centerZ + sz);
      raycaster.set(origin, dir);
      const hits = raycaster.intersectObject(targetRoot, true);
      if (hits.length > 0) {
        const absHitX = Math.abs(hits[0].point.x);
        if (absHitX > maxAbsX) {
          maxAbsX = absHitX;
        }
      }
    }
  }

  const makeCurvedSleeveBadge = (
    widthZ: number,
    heightY: number,
    outwardClearance: number,
    mat: THREE.Material
  ) => {
    const segZ = 18;
    const segY = 12;
    const geo = new THREE.PlaneGeometry(widthZ, heightY, segZ, segY);
    const pos = geo.attributes.position as THREE.BufferAttribute;

    for (let i = 0; i < pos.count; i++) {
      const localX = pos.getX(i);
      const localY = pos.getY(i);
      const wz = centerZ + (side === 1 ? -localX : localX);
      const wy = centerY + localY;

      // Smooth cylindrical sleeve wrap + natural shoulder slope, positioned outside all sleeve creases
      const archDrop = (1 - Math.cos(localX * 9.5)) * 0.085;
      const shoulderTilt = -localY * 0.14;
      const wx =
        side * (maxAbsX + outwardClearance + shoulderTilt - archDrop);

      pos.setXYZ(i, wx, wy, wz);
    }
    pos.needsUpdate = true;
    geo.computeVertexNormals();
    const mesh = new THREE.Mesh(geo, mat);
    mesh.castShadow = true;
    return mesh;
  };

  // Embroidered frame backing + Flag cloth layer cleanly proud of sleeve surface
  group.add(makeCurvedSleeveBadge(0.108, 0.074, 0.009, borderMat));
  group.add(makeCurvedSleeveBadge(0.098, 0.065, 0.0115, flagMat));
  return group;
}

export function buildCommanderAstronautRig(
  config: CommanderConfig,
  assets: SpacecraftPBRAssets,
  flagTexture?: THREE.Texture
): CommanderAstronautRig {
  const root = new THREE.Group();
  const fallbackGroup = new THREE.Group();
  root.add(fallbackGroup);

  const upperBodyGroup = new THREE.Group();
  const headGroup = new THREE.Group();
  const leftArmGroup = new THREE.Group();
  const rightArmGroup = new THREE.Group();

  const visorMat = new THREE.MeshPhysicalMaterial({
    color: 0xf59e0b,
    emissive: 0x78350f,
    emissiveIntensity: 0.25,
    metalness: 0.96,
    roughness: 0.08,
    clearcoat: 1.0,
    clearcoatRoughness: 0.04,
    reflectivity: 1.0,
  });

  const suitPrimaryMat = new THREE.MeshPhysicalMaterial({
    map: assets.shuttleWhite.map,
    normalMap: assets.shuttleWhite.normalMap,
    normalScale: new THREE.Vector2(0.45, 0.45),
    roughnessMap: assets.shuttleWhite.roughnessMap,
    color: 0xf1f5f9,
    roughness: 0.44,
    metalness: 0.14,
    clearcoat: 0.25,
    clearcoatRoughness: 0.3,
  });

  const suitSecondaryMat = new THREE.MeshPhysicalMaterial({
    color: 0xcbd5e1,
    roughness: 0.34,
    metalness: 0.48,
    clearcoat: 0.35,
    clearcoatRoughness: 0.22,
  });

  const suitAccentMat = new THREE.MeshStandardMaterial({
    color: 0x0284c7,
    emissive: 0x0284c7,
    emissiveIntensity: 0.22,
    roughness: 0.28,
    metalness: 0.62,
  });

  const suitJointMat = new THREE.MeshStandardMaterial({
    color: 0x334155,
    roughness: 0.58,
    metalness: 0.42,
  });

  const flagPatchMat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    map: flagTexture ?? null,
    roughness: 0.42,
    metalness: 0.08,
    polygonOffset: true,
    polygonOffsetFactor: -1,
    polygonOffsetUnits: -1,
  });

  const goldFoilMat = new THREE.MeshPhysicalMaterial({
    map: assets.kapton.map,
    normalMap: assets.kapton.normalMap,
    normalScale: new THREE.Vector2(1.2, 1.2),
    roughnessMap: assets.kapton.roughnessMap,
    color: 0xf6c453,
    roughness: 0.28,
    metalness: 0.9,
    clearcoat: 0.2,
  });

  const darkMetalMat = new THREE.MeshStandardMaterial({
    color: 0x0f172a,
    roughness: 0.35,
    metalness: 0.85,
  });

  const ledCyanMat = new THREE.MeshBasicMaterial({ color: 0x38bdf8 });
  const ledAmberMat = new THREE.MeshBasicMaterial({ color: 0xfbbf24 });

  // ==========================================================================
  // 1. LOWER BODY: Planetary Boots, Lower Greaves, Knee Pads & Thighs (y: 0 -> 1.02)
  // ==========================================================================
  [-1, 1].forEach((side) => {
    const legX = side * 0.21;

    // Heavy Magnetic Boot Sole + Armored Toe Cap
    const bootSole = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.06, 0.36), darkMetalMat);
    bootSole.position.set(legX, 0.03, 0.04);
    bootSole.castShadow = true;
    bootSole.receiveShadow = true;
    fallbackGroup.add(bootSole);

    const bootUpper = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.14, 0.31), suitSecondaryMat);
    bootUpper.position.set(legX, 0.12, 0.025);
    bootUpper.castShadow = true;
    fallbackGroup.add(bootUpper);

    const bootAccent = new THREE.Mesh(new THREE.BoxGeometry(0.206, 0.028, 0.18), suitAccentMat);
    bootAccent.position.set(legX, 0.08, 0.06);
    fallbackGroup.add(bootAccent);

    // Ankle Bellows Joint
    const ankleJoint = new THREE.Mesh(
      new THREE.CylinderGeometry(0.095, 0.105, 0.1, 20),
      suitJointMat
    );
    ankleJoint.position.set(legX, 0.22, 0);
    fallbackGroup.add(ankleJoint);

    // Lower Leg / Shin Greave
    const shin = new THREE.Mesh(new THREE.CapsuleGeometry(0.105, 0.26, 8, 20), suitPrimaryMat);
    shin.position.set(legX, 0.42, 0);
    shin.castShadow = true;
    shin.receiveShadow = true;
    fallbackGroup.add(shin);

    // Shin Armor Guard Plate
    const shinGuard = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.24, 0.06), suitSecondaryMat);
    shinGuard.position.set(legX, 0.41, 0.09);
    fallbackGroup.add(shinGuard);

    // Articulated Knee Pad & Joint
    const kneeJoint = new THREE.Mesh(new THREE.SphereGeometry(0.108, 20, 16), suitJointMat);
    kneeJoint.position.set(legX, 0.61, 0);
    fallbackGroup.add(kneeJoint);

    const kneeArmor = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.13, 0.08), suitAccentMat);
    kneeArmor.position.set(legX, 0.61, 0.085);
    fallbackGroup.add(kneeArmor);

    // Upper Thigh + Side Cargo Utility Pouch
    const thigh = new THREE.Mesh(new THREE.CapsuleGeometry(0.122, 0.28, 8, 20), suitPrimaryMat);
    thigh.position.set(legX, 0.82, 0);
    thigh.castShadow = true;
    thigh.receiveShadow = true;
    fallbackGroup.add(thigh);

    const thighStripe = new THREE.Mesh(
      new THREE.CylinderGeometry(0.126, 0.124, 0.055, 24),
      suitAccentMat
    );
    thighStripe.position.set(legX, 0.82, 0);
    fallbackGroup.add(thighStripe);

    const utilityPouch = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.16, 0.12), suitSecondaryMat);
    utilityPouch.position.set(legX + side * 0.12, 0.83, 0.01);
    fallbackGroup.add(utilityPouch);
  });

  // ==========================================================================
  // 2. PELVIS & WAIST BEARING GIMBAL (y: 0.98 -> 1.12)
  // ==========================================================================
  const pelvis = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.26, 0.18, 28), suitSecondaryMat);
  pelvis.position.set(0, 1.03, 0);
  pelvis.castShadow = true;
  fallbackGroup.add(pelvis);

  const waistRing = new THREE.Mesh(new THREE.TorusGeometry(0.275, 0.032, 16, 36), darkMetalMat);
  waistRing.rotation.x = Math.PI / 2;
  waistRing.position.set(0, 1.12, 0);
  fallbackGroup.add(waistRing);

  // ==========================================================================
  // 3. UPPER BODY GROUP: Hard Upper Torso (HUT), Chest DCM & PLSS Backpack
  // ==========================================================================
  upperBodyGroup.position.set(0, 1.12, 0);
  fallbackGroup.add(upperBodyGroup);

  // Sculpted Torso Core
  const torsoCore = new THREE.Mesh(
    new THREE.CylinderGeometry(0.32, 0.26, 0.56, 32),
    suitPrimaryMat
  );
  torsoCore.scale.set(1.08, 1.0, 0.82);
  torsoCore.position.set(0, 0.28, 0);
  torsoCore.castShadow = true;
  torsoCore.receiveShadow = true;
  upperBodyGroup.add(torsoCore);

  // Armored Chest Breastplate
  const chestArmor = new THREE.Mesh(new THREE.BoxGeometry(0.52, 0.36, 0.24), suitSecondaryMat);
  chestArmor.position.set(0, 0.34, 0.09);
  chestArmor.castShadow = true;
  upperBodyGroup.add(chestArmor);

  // Diagonal Accent Chevrons on Chest Armor
  [-1, 1].forEach((side) => {
    const chevron = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.036, 0.03), suitAccentMat);
    chevron.position.set(side * 0.16, 0.45, 0.21);
    chevron.rotation.z = -side * 0.26;
    upperBodyGroup.add(chevron);
  });

  // Chest Display & Control Module (DCM) with Illuminated Telemetry Strips
  const dcmBox = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.2, 0.09), darkMetalMat);
  dcmBox.position.set(0, 0.31, 0.23);
  dcmBox.castShadow = true;
  upperBodyGroup.add(dcmBox);

  const dcmBezel = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.08, 0.02), suitAccentMat);
  dcmBezel.position.set(0, 0.35, 0.272);
  upperBodyGroup.add(dcmBezel);

  const dcmScreen = new THREE.Mesh(new THREE.PlaneGeometry(0.18, 0.045), ledCyanMat);
  dcmScreen.position.set(0, 0.35, 0.284);
  upperBodyGroup.add(dcmScreen);

  [-0.06, 0, 0.06].forEach((bx, idx) => {
    const btn = new THREE.Mesh(
      new THREE.CylinderGeometry(0.016, 0.016, 0.02, 12),
      idx === 1 ? ledAmberMat : ledCyanMat
    );
    btn.rotation.x = Math.PI / 2;
    btn.position.set(bx, 0.26, 0.275);
    upperBodyGroup.add(btn);
  });

  // PLSS (Portable Life Support System) Backpack on Rear Torso
  const plssGroup = new THREE.Group();
  plssGroup.position.set(0, 0.32, -0.26);
  upperBodyGroup.add(plssGroup);

  const plssHousing = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.56, 0.22), suitPrimaryMat);
  plssHousing.castShadow = true;
  plssHousing.receiveShadow = true;
  plssGroup.add(plssHousing);

  const plssArmorCap = new THREE.Mesh(new THREE.BoxGeometry(0.48, 0.16, 0.24), suitSecondaryMat);
  plssArmorCap.position.set(0, 0.21, 0);
  plssGroup.add(plssArmorCap);

  const plssFoilPanel = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.26, 0.04), goldFoilMat);
  plssFoilPanel.position.set(0, -0.06, -0.11);
  plssGroup.add(plssFoilPanel);

  // Dual Cryo Oxygen Cylinders inside PLSS
  [-0.14, 0.14].forEach((tx) => {
    const oxyTank = new THREE.Mesh(
      new THREE.CylinderGeometry(0.065, 0.065, 0.46, 20),
      suitSecondaryMat
    );
    oxyTank.position.set(tx, -0.02, -0.09);
    plssGroup.add(oxyTank);

    const tankBand = new THREE.Mesh(
      new THREE.CylinderGeometry(0.07, 0.07, 0.045, 20),
      suitAccentMat
    );
    tankBand.position.set(tx, 0.1, -0.09);
    plssGroup.add(tankBand);
  });

  // PLSS Top Comm Mast & Amber Strobe Beacon
  const commMast = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.016, 0.24, 12), darkMetalMat);
  commMast.position.set(0.18, 0.38, -0.04);
  plssGroup.add(commMast);

  const beaconTip = new THREE.Mesh(new THREE.SphereGeometry(0.024, 12, 12), ledAmberMat);
  beaconTip.position.set(0.18, 0.51, -0.04);
  plssGroup.add(beaconTip);

  // ==========================================================================
  // 4. ARTICULATED ARMS, SHOULDER PAULDRONS, ARM FLAG PATCHES & GLOVES
  // ==========================================================================
  const buildArm = (side: -1 | 1, armContainer: THREE.Group) => {
    armContainer.position.set(side * 0.38, 0.48, 0);
    upperBodyGroup.add(armContainer);

    // Layered Shoulder Pauldron + Accent Trim
    const pauldron = new THREE.Mesh(
      new THREE.SphereGeometry(0.145, 24, 18, 0, Math.PI * 2, 0, Math.PI * 0.65),
      suitSecondaryMat
    );
    pauldron.rotation.z = -side * 0.35;
    pauldron.position.set(side * 0.03, 0.02, 0);
    pauldron.castShadow = true;
    armContainer.add(pauldron);

    const shoulderBand = new THREE.Mesh(
      new THREE.TorusGeometry(0.125, 0.022, 12, 28),
      suitAccentMat
    );
    shoulderBand.rotation.y = Math.PI / 2;
    shoulderBand.rotation.x = 0.25;
    shoulderBand.position.set(side * 0.04, -0.02, 0);
    armContainer.add(shoulderBand);

    // Upper Arm
    const upperArm = new THREE.Mesh(
      new THREE.CapsuleGeometry(0.088, 0.22, 8, 18),
      suitPrimaryMat
    );
    upperArm.position.set(side * 0.06, -0.16, 0);
    upperArm.rotation.z = side * 0.12;
    upperArm.castShadow = true;
    armContainer.add(upperArm);

    // Upper-Arm / Shoulder Mission Flag Emblem Patch (Turkish Flag or US Flag)
    const patchGroup = new THREE.Group();
    patchGroup.position.set(side * 0.146, -0.11, 0.018);
    patchGroup.rotation.y = side * (Math.PI / 2 - 0.16);
    patchGroup.rotation.z = -side * 0.12;

    const patchFrame = new THREE.Mesh(
      new THREE.BoxGeometry(0.116, 0.08, 0.012),
      darkMetalMat
    );
    patchGroup.add(patchFrame);

    const patchFlag = new THREE.Mesh(
      new THREE.PlaneGeometry(0.104, 0.069),
      flagPatchMat
    );
    patchFlag.position.z = 0.007;
    patchGroup.add(patchFlag);
    armContainer.add(patchGroup);

    // Elbow Bellows Joint
    const elbow = new THREE.Mesh(new THREE.SphereGeometry(0.086, 18, 16), suitJointMat);
    elbow.position.set(side * 0.09, -0.32, 0.02);
    armContainer.add(elbow);

    // Forearm + Wrist Telemetry Pad (on left arm)
    const forearm = new THREE.Mesh(
      new THREE.CylinderGeometry(0.082, 0.072, 0.26, 20),
      suitSecondaryMat
    );
    forearm.position.set(side * 0.1, -0.46, 0.08);
    forearm.rotation.x = -0.35;
    forearm.castShadow = true;
    armContainer.add(forearm);

    if (side === -1) {
      const wristPad = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.12, 0.04), darkMetalMat);
      wristPad.position.set(side * 0.1, -0.45, 0.15);
      wristPad.rotation.x = -0.35;
      armContainer.add(wristPad);

      const wristScreen = new THREE.Mesh(new THREE.PlaneGeometry(0.065, 0.085), ledCyanMat);
      wristScreen.position.set(side * 0.1, -0.45, 0.172);
      wristScreen.rotation.x = -0.35;
      armContainer.add(wristScreen);
    }

    // Wrist Seal Ring + Space Glove
    const wristRing = new THREE.Mesh(new THREE.TorusGeometry(0.074, 0.016, 12, 24), suitAccentMat);
    wristRing.rotation.x = Math.PI / 2 - 0.35;
    wristRing.position.set(side * 0.1, -0.58, 0.125);
    armContainer.add(wristRing);

    const glove = new THREE.Mesh(new THREE.SphereGeometry(0.082, 18, 16), suitJointMat);
    glove.scale.set(0.9, 1.18, 0.78);
    glove.position.set(side * 0.1, -0.66, 0.155);
    glove.castShadow = true;
    armContainer.add(glove);
  };

  buildArm(-1, leftArmGroup);
  buildArm(1, rightArmGroup);

  // ==========================================================================
  // 5. HELMET & SPHERICAL REFLECTIVE VISOR ASSEMBLY (headGroup)
  // ==========================================================================
  const neckRing = new THREE.Mesh(new THREE.TorusGeometry(0.185, 0.028, 16, 36), darkMetalMat);
  neckRing.rotation.x = Math.PI / 2;
  neckRing.position.set(0, 0.58, 0.02);
  upperBodyGroup.add(neckRing);

  headGroup.position.set(0, 0.78, 0.02);
  upperBodyGroup.add(headGroup);

  // Outer Helmet Shell
  const helmetShell = new THREE.Mesh(new THREE.SphereGeometry(0.245, 36, 28), suitPrimaryMat);
  helmetShell.scale.set(0.96, 1.04, 1.02);
  helmetShell.castShadow = true;
  helmetShell.receiveShadow = true;
  headGroup.add(helmetShell);

  // Helmet Crown Armor Ridge + Accent Crest
  const helmetCrest = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.06, 0.32), suitSecondaryMat);
  helmetCrest.position.set(0, 0.21, -0.02);
  headGroup.add(helmetCrest);

  const crestStripe = new THREE.Mesh(new THREE.BoxGeometry(0.045, 0.025, 0.28), suitAccentMat);
  crestStripe.position.set(0, 0.235, -0.01);
  headGroup.add(crestStripe);

  // Large Curved Panoramic Reflective Visor Shield
  const visorGeo = new THREE.SphereGeometry(
    0.236,
    36,
    28,
    -Math.PI * 0.38,
    Math.PI * 0.76,
    Math.PI * 0.2,
    Math.PI * 0.56
  );
  const visorMesh = new THREE.Mesh(visorGeo, visorMat);
  visorMesh.rotation.y = Math.PI * 0.5;
  visorMesh.position.set(0, 0.01, 0.032);
  visorMesh.castShadow = true;
  headGroup.add(visorMesh);

  // Chin Guard / Vocoder Grill
  const chinGuard = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.075, 0.16), suitSecondaryMat);
  chinGuard.position.set(0, -0.15, 0.14);
  headGroup.add(chinGuard);

  // Dual Tactical Side Helmet Lamps
  [-1, 1].forEach((side) => {
    const earPod = new THREE.Mesh(
      new THREE.CylinderGeometry(0.048, 0.048, 0.06, 16),
      suitSecondaryMat
    );
    earPod.rotation.z = Math.PI / 2;
    earPod.position.set(side * 0.23, 0.01, 0.0);
    headGroup.add(earPod);

    const lampHousing = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.04, 0.09), darkMetalMat);
    lampHousing.position.set(side * 0.24, 0.06, 0.06);
    headGroup.add(lampHousing);

    const lampLens = new THREE.Mesh(new THREE.CircleGeometry(0.015, 12), ledCyanMat);
    lampLens.position.set(side * 0.24, 0.06, 0.106);
    headGroup.add(lampLens);
  });

  const glbShaderUniforms: GlbSuitShaderUniforms = {
    uVisorColor: { value: new THREE.Color(0xf59e0b) },
    uVisorEmissive: { value: new THREE.Color(0x78350f) },
    uVisorRoughness: { value: 0.08 },
    uVisorMetalness: { value: 0.95 },
    uTrimPrimary: { value: new THREE.Color(0xf8fafc) },
    uTrimSecondary: { value: new THREE.Color(0xcbd5e1) },
    uTrimAccent: { value: new THREE.Color(0x0284c7) },
    uUseTrimPalette: { value: 0.0 },
  };

  const rig: CommanderAstronautRig = {
    root,
    upperBodyGroup,
    headGroup,
    leftArmGroup,
    rightArmGroup,
    visorMat,
    suitPrimaryMat,
    suitSecondaryMat,
    suitAccentMat,
    suitJointMat,
    flagPatchMat,
    glbShaderUniforms,
    latestConfig: { ...config },
    isGlbLoaded: false,
  };

  updateCommanderAstronautMaterials(rig, config, flagTexture);

  // Load Official Smithsonian / NASA 3D Laser-Scanned Apollo 11 Neil Armstrong Spacesuit (.glb)
  const loader = new GLTFLoader();
  loader.load(
    '/assets/NeilArmstrong.glb',
    (gltf) => {
      const nasaSuit = gltf.scene;
      nasaSuit.updateMatrixWorld(true);

      nasaSuit.traverse((child) => {
        if (child instanceof THREE.Mesh) {
          child.castShadow = true;
          child.receiveShadow = true;
          const mats = Array.isArray(child.material) ? child.material : [child.material];
          for (const m of mats) {
            if (m instanceof THREE.MeshStandardMaterial) {
              if (m.name === 'StingrayPBS1') {
                // Front chest with NASA badge, Apollo 11 patch, red/blue valves & zippers:
                // Keep 100% original photographic texture untouched so zero details are covered up!
                m.color.setHex(0xffffff);
                m.emissive.setHex(0x000000);
                m.metalness = 0.14;
                m.roughness = 0.72;
                m.needsUpdate = true;
              } else {
                // StingrayPBS2 (Helmet + Visor Glass + Backpack) and StingrayPBS3/4 (Arms & Legs):
                // Paint 100% of the helmet visor glass via its 2048x2048 mask and limit suit palette
                // coloring to clean NASA Commander trim stripes while preserving all suit details.
                attachGlbSuitAndVisorShader(
                  m,
                  rig.glbShaderUniforms,
                  m.name === 'StingrayPBS2'
                );
              }
            }
          }
        }
      });

      // Conform Turkish / US Flag patches onto both upper arms with Accent-colored border frames
      const leftSleevePatch = buildConformedGlbShoulderPatch(
        nasaSuit,
        1,
        flagPatchMat,
        suitAccentMat
      );
      const rightSleevePatch = buildConformedGlbShoulderPatch(
        nasaSuit,
        -1,
        flagPatchMat,
        suitAccentMat
      );
      nasaSuit.add(leftSleevePatch, rightSleevePatch);

      // Subtle 3D Neck Collar Accent Ring
      const neckAccentRing = new THREE.Mesh(
        new THREE.TorusGeometry(0.158, 0.011, 14, 36),
        suitAccentMat
      );
      neckAccentRing.rotation.x = Math.PI / 2 + 0.12;
      neckAccentRing.position.set(0.006, 1.565, 0.032);
      nasaSuit.add(neckAccentRing);

      // Replace procedural fallback with the real 3D NASA Apollo 11 spacesuit
      fallbackGroup.visible = false;
      rig.isGlbLoaded = true;
      root.add(nasaSuit);

      updateCommanderAstronautMaterials(
        rig,
        rig.latestConfig,
        rig.flagPatchMat.map ?? undefined
      );
    },
    undefined,
    () => {
      // Keep procedural fallback visible if GLB fails to load
    }
  );

  return rig;
}

let sharedDracoLoader: DRACOLoader | null = null;
function getSharedDracoLoader(): DRACOLoader {
  if (!sharedDracoLoader) {
    sharedDracoLoader = new DRACOLoader();
    sharedDracoLoader.setDecoderPath('/assets/draco/');
  }
  return sharedDracoLoader;
}

/**
 * Official NASA 3D Apollo 11 Lunar Module ("Eagle") Loaded via GLTFLoader + DRACOLoader
 * (/assets/ApolloLunarModule.glb) with its original bright yellow/white materials and
 * dynamic Turkish / US flag switching on its right descent stage panel (pPlane2).
 */
export function buildApolloLunarModuleBackdrop(
  _assets: SpacecraftPBRAssets,
  initialPanelFlagTex?: THREE.Texture,
  onReadyFlagSetter?: (setter: (tex: THREE.Texture) => void) => void
): THREE.Group {
  const eagle = new THREE.Group();
  const panelFlagMats: THREE.MeshStandardMaterial[] = [];
  let latestTex: THREE.Texture | undefined = initialPanelFlagTex;

  const applyPanelFlag = (tex: THREE.Texture) => {
    latestTex = tex;
    for (const m of panelFlagMats) {
      m.map = tex;
      m.needsUpdate = true;
    }
  };

  if (onReadyFlagSetter) {
    onReadyFlagSetter(applyPanelFlag);
  }

  const loader = new GLTFLoader();
  loader.setDRACOLoader(getSharedDracoLoader());
  loader.load(
    '/assets/ApolloLunarModule.glb',
    (gltf) => {
      const nasaLander = gltf.scene;
      nasaLander.traverse((child) => {
        if (child instanceof THREE.Mesh) {
          child.castShadow = true;
          child.receiveShadow = true;

          // Locate right front descent stage flag panel (pPlane2 / blinn12SG.001)
          const isRightFlagPanel =
            child.name === 'pPlane2' ||
            (child.material instanceof THREE.MeshStandardMaterial &&
              child.material.name === 'blinn12SG.001');

          if (isRightFlagPanel && child.material instanceof THREE.MeshStandardMaterial) {
            const clonedMat = child.material.clone();
            clonedMat.color.setHex(0xffffff);
            clonedMat.metalness = 0.0;
            clonedMat.roughness = 0.41;
            if (latestTex) {
              clonedMat.map = latestTex;
            }
            clonedMat.needsUpdate = true;
            child.material = clonedMat;
            panelFlagMats.push(clonedMat);
          }
        }
      });

      // Align footpads (minY = 0.102) flush with lunar ground and scale to scene proportions
      nasaLander.scale.setScalar(0.62);
      nasaLander.position.set(0, -0.06, 0);
      eagle.add(nasaLander);
    }
  );

  return eagle;
}

