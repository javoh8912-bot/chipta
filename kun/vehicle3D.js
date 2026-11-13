/**
 * Vehicle3D - Interactive 3D WebGL Vehicle & Seat Selector (Train, Bus, Airplane)
 * Powered by Three.js
 */
window.Vehicle3D = (function () {
  let container, canvas, renderer, scene, camera, lights = {};
  let currentTicket = null;
  let activeCar = 1;
  let selectedSeats = [];
  let activeMode = "train";
  let isOverview = false;
  let callbacks = { onSeatSelect: null, onCarChange: null };

  // Camera coordinates & animation targets (spherical coordinates)
  const CM = { th: -0.3, ph: 0.95, r: 85, tg: new THREE.Vector3(0, 1.8, 0) };
  const G = { th: -0.3, ph: 0.70, r: 14, tg: new THREE.Vector3(0, 1.8, 0) };

  // 3D Objects & Materials
  let envGroup = null;
  let vehicleGroup = null;
  let seatsGroup = new THREE.Group();
  let seatMeshes = [];
  let wagonRoofs = [];
  let wagonGroups = [];
  let busRoof = null;
  let planeRoof = null;
  let planeHull = null;
  let leftSideGroup = null;
  let rightSideGroup = null;
  let planeBelly = null;
  let planeInteriorMaterials = [];
  let routeLabel = null;
  let emissiveMaterials = [];
  let spinningObjects = [];

  // Pointer drag & raycaster
  const raycaster = new THREE.Raycaster();
  const mouse = new THREE.Vector2();
  let pointerDown = null;
  let hoveredSeat = null;
  let isInitialized = false;

  const isNightDeparture = departure => {
    const hour = Number(String(departure || "").split(":")[0]);
    return hour < 6 || hour >= 18;
  };

  const M = (color, opts) => new THREE.MeshStandardMaterial(Object.assign({
    color: color,
    roughness: 0.55,
    metalness: 0.15
  }, opts || {}));

  const B = (parent, l, h, w, material, x, y, z) => {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(l, h, w), material);
    mesh.position.set(x, y, z || 0);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    parent.add(mesh);
    return mesh;
  };

  function createTextSprite(text, bgColor = "#102a5c", textColor = "#ffffff", w = 6) {
    const canvas = document.createElement("canvas");
    canvas.width = 512;
    canvas.height = 192;
    const ctx = canvas.getContext("2d");
    ctx.fillStyle = bgColor;
    if (ctx.roundRect) {
      ctx.beginPath();
      ctx.roundRect(8, 12, 496, 168, 28);
      ctx.fill();
    } else {
      ctx.fillRect(8, 12, 496, 168);
    }
    ctx.fillStyle = textColor;
    const lines = text.split("\n").flatMap(line => {
      if (!line.includes(" ➔ ")) return [line];
      const [from, to] = line.split(" ➔ ");
      return [from, `→ ${to}`];
    });
    const lineHeight = lines.length > 1 ? 46 : 80;
    let fontSize = lines.length > 2 ? 40 : lines.length > 1 ? 48 : 64;
    ctx.font = `bold ${fontSize}px Arial, sans-serif`;
    while (fontSize > 30 && lines.some(line => ctx.measureText(line).width > 460)) {
      fontSize -= 2;
      ctx.font = `bold ${fontSize}px Arial, sans-serif`;
    }
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    lines.forEach((line, index) => ctx.fillText(line, 256, canvas.height / 2 + (index - (lines.length - 1) / 2) * lineHeight));

    const texture = new THREE.CanvasTexture(canvas);
    const spriteMaterial = new THREE.SpriteMaterial({ map: texture, depthTest: false });
    const sprite = new THREE.Sprite(spriteMaterial);
    sprite.scale.set(w, w * 0.375, 1);
    return sprite;
  }

  // Train Wagon spacing
  const WX = k => -18 + 15 * k;

  /* ==================== ENVIRONMENT BUILDERS ==================== */

  function buildEnvironment(mode, dark) {
    if (envGroup) scene.remove(envGroup);
    envGroup = new THREE.Group();
    scene.add(envGroup);
    emissiveMaterials = [];

    const skyColor = dark ? 0x0a1022 : 0xbfe0ff;
    scene.background = new THREE.Color(skyColor);
    scene.fog = new THREE.Fog(skyColor, 75, 280);

    lights.hemisphere.intensity = dark ? 0.35 : 0.85;
    lights.directional.intensity = dark ? 0.4 : 0.95;
    lights.directional.color.setHex(dark ? 0x9fbaff : 0xffffff);

    if (mode === "train") {
      // Ground ballast
      const ground = new THREE.Mesh(
        new THREE.PlaneGeometry(600, 400),
        M(dark ? 0x141a24 : 0xb2c2a3, { roughness: 1 })
      );
      ground.rotation.x = -Math.PI / 2;
      ground.position.y = -0.05;
      ground.receiveShadow = true;
      envGroup.add(ground);

      // Railway ballast gravel bed
      B(envGroup, 160, 0.22, 6.4, M(dark ? 0x242830 : 0x5a554f, { roughness: 0.95 }), 0, 0.1, 0);

      // Dual steel rails
      for (const z of [-1.25, 1.25]) {
        B(envGroup, 160, 0.1, 0.14, M(0xa8b0bc, { metalness: 0.85, roughness: 0.2 }), 0, 0.26, z);
      }

      // Concrete/wooden sleepers
      const sleeperCount = 100;
      const sleeperGeom = new THREE.BoxGeometry(0.36, 0.09, 3.8);
      const sleeperMat = M(dark ? 0x3a3028 : 0x544033, { roughness: 0.9 });
      const instancedSleepers = new THREE.InstancedMesh(sleeperGeom, sleeperMat, sleeperCount);
      const dummy = new THREE.Object3D();
      for (let i = 0; i < sleeperCount; i++) {
        dummy.position.set(-75 + i * 1.5, 0.21, 0);
        dummy.updateMatrix();
        instancedSleepers.setMatrixAt(i, dummy.matrix);
      }
      instancedSleepers.receiveShadow = true;
      envGroup.add(instancedSleepers);

      // Station Platform
      B(envGroup, 110, 0.75, 6, M(dark ? 0x222a36 : 0xbfb9ad), 0, 0.38, -5.8);
      // Yellow warning line
      B(envGroup, 110, 0.02, 0.22, M(0xffd600, { roughness: 0.4 }), 0, 0.77, -3.4);

      // Platform Lampposts
      for (let i = 0; i < 9; i++) {
        const x = -36 + i * 9.5;
        B(envGroup, 0.14, 3.4, 0.14, M(0x37474f), x, 2.4, -7.4);
        const lampMat = M(0xffdf80, {
          emissive: 0xffdf80,
          emissiveIntensity: dark ? 2.5 : 0.2
        });
        emissiveMaterials.push(lampMat);
        const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.26, 12, 8), lampMat);
        bulb.position.set(x, 4.1, -7.4);
        envGroup.add(bulb);
      }

      // Platform Roof canopy
      B(envGroup, 75, 0.18, 5.5, M(0x2d3748), 0, 5.0, -6.0);

      // Background Pine Trees
      const treeCount = 28;
      const treeGeom = new THREE.ConeGeometry(1.6, 5.5, 7);
      const treeMat = M(dark ? 0x162c1e : 0x2d6a38, { roughness: 0.9 });
      const instancedTrees = new THREE.InstancedMesh(treeGeom, treeMat, treeCount);
      let seed = 42;
      for (let i = 0; i < treeCount; i++) {
        seed = (seed * 9301 + 49297) % 233280;
        dummy.position.set(-60 + i * 4.3 + (seed % 30) / 10, 2.7, -18 - (seed % 120) / 10);
        dummy.scale.setScalar(0.75 + (seed % 8) / 10);
        dummy.updateMatrix();
        instancedTrees.setMatrixAt(i, dummy.matrix);
      }
      instancedTrees.castShadow = true;
      envGroup.add(instancedTrees);

      // Distant mountain silhouette
      for (let i = 0; i < 6; i++) {
        const m = new THREE.Mesh(
          new THREE.ConeGeometry(30, 32 + i * 4, 5),
          M(dark ? 0x1b253b : 0x8694a8, { roughness: 1 })
        );
        m.position.set(-60 + i * 36, 16, -95);
        envGroup.add(m);
      }
    } else if (mode === "bus") {
      // Highway road
      const ground = new THREE.Mesh(
        new THREE.PlaneGeometry(600, 400),
        M(dark ? 0x111622 : 0x9fb392, { roughness: 1 })
      );
      ground.rotation.x = -Math.PI / 2;
      ground.position.y = -0.05;
      ground.receiveShadow = true;
      envGroup.add(ground);

      // Asphalt roadway (4 lanes)
      B(envGroup, 140, 0.2, 11, M(dark ? 0x181c24 : 0x2e333d, { roughness: 0.95 }), 0, 0.1, 0);

      // Road markings: dashed center line
      for (let i = -16; i <= 16; i++) {
        B(envGroup, 2.4, 0.02, 0.25, M(0xffffff, { roughness: 0.5 }), i * 4.2, 0.22, 0);
      }
      // Road markings: solid edge lines
      B(envGroup, 140, 0.02, 0.2, M(0xffd600, { roughness: 0.5 }), 0, 0.22, -4.8);
      B(envGroup, 140, 0.02, 0.2, M(0xffffff, { roughness: 0.5 }), 0, 0.22, 4.8);

      // Roadside guardrails
      for (const z of [-5.6, 5.6]) {
        B(envGroup, 140, 0.25, 0.12, M(0x8a95a5, { metalness: 0.7, roughness: 0.3 }), 0, 0.65, z);
        for (let i = -14; i <= 14; i++) {
          B(envGroup, 0.1, 0.65, 0.1, M(0x5a6370), i * 5, 0.35, z);
        }
      }

      // Highway Light Poles
      for (let i = -5; i <= 5; i++) {
        const x = i * 14;
        B(envGroup, 0.16, 4.8, 0.16, M(0x424e5e), x, 2.5, -6.8);
        B(envGroup, 1.8, 0.12, 0.12, M(0x424e5e), x + 0.8, 4.8, -6.8);
        const lampMat = M(0xffecb3, {
          emissive: 0xffecb3,
          emissiveIntensity: dark ? 2.5 : 0.3
        });
        emissiveMaterials.push(lampMat);
        const bulb = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.12, 0.35), lampMat);
        bulb.position.set(x + 1.2, 4.75, -6.8);
        envGroup.add(bulb);
      }

      // Highway road sign
      const signBoard = B(envGroup, 4.2, 1.8, 0.1, M(0x157347), 16, 4.2, -6.6);
      B(envGroup, 0.15, 3.8, 0.15, M(0x555e6b), 14.5, 2.0, -6.6);
      B(envGroup, 0.15, 3.8, 0.15, M(0x555e6b), 17.5, 2.0, -6.6);
      const signSprite = createTextSprite("SAMARQAND ➔", "#157347", "#ffffff", 4.0);
      signSprite.position.set(16, 4.2, -6.5);
      envGroup.add(signSprite);

      // Trees along road
      for (let i = 0; i < 18; i++) {
        const tree = new THREE.Mesh(new THREE.ConeGeometry(1.8, 5, 8), M(dark ? 0x162c1e : 0x2d6a38));
        tree.position.set(-45 + i * 5.2, 2.5, 12 + (i % 3) * 2);
        envGroup.add(tree);
      }
    } else if (mode === "flight") {
      // Airport Runway tarmac
      const ground = new THREE.Mesh(
        new THREE.PlaneGeometry(600, 400),
        M(dark ? 0x0f1520 : 0x8a9985, { roughness: 1 })
      );
      ground.rotation.x = -Math.PI / 2;
      ground.position.y = -0.05;
      ground.receiveShadow = true;
      envGroup.add(ground);

      // Main Concrete Runway
      B(envGroup, 160, 0.2, 16, M(dark ? 0x1a212c : 0x323a48, { roughness: 0.95 }), 0, 0.1, 0);

      // Runway threshold "piano keys" (stripes at start)
      for (let i = -5; i <= 5; i++) {
        B(envGroup, 7.5, 0.02, 0.65, M(0xffffff, { roughness: 0.5 }), -65, 0.22, i * 1.35);
      }

      // Runway centerline dashed markings
      for (let i = -14; i <= 14; i++) {
        B(envGroup, 3.2, 0.02, 0.45, M(0xffffff, { roughness: 0.5 }), i * 5.2, 0.22, 0);
      }

      // Runway edge lights (Blue taxiway / Amber runway lights)
      for (let i = -10; i <= 10; i++) {
        for (const z of [-8.2, 8.2]) {
          const x = i * 7.5;
          B(envGroup, 0.1, 0.25, 0.1, M(0x22262d), x, 0.32, z);
          const lightColor = Math.abs(i) % 2 === 0 ? 0x00d2ff : 0xffb703;
          const lightMat = M(lightColor, {
            emissive: lightColor,
            emissiveIntensity: dark ? 3.0 : 0.4
          });
          emissiveMaterials.push(lightMat);
          const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.14, 8, 8), lightMat);
          bulb.position.set(x, 0.46, z);
          envGroup.add(bulb);
        }
      }

      // Airport Control Tower in distance
      const towerBase = B(envGroup, 3.5, 12, 3.5, M(dark ? 0x222a38 : 0x7a889b), 35, 6, -35);
      const towerCab = B(envGroup, 5.5, 3.2, 5.5, M(0x1d3557), 35, 13, -35);
      const cabGlass = B(envGroup, 5.6, 1.4, 5.6, M(0x90e0ef, {
        transparent: true,
        opacity: 0.6,
        emissive: 0x90e0ef,
        emissiveIntensity: dark ? 1.0 : 0.2
      }), 35, 13.2, -35);
      // Beacon light on top of tower
      const beaconMat = M(0xff0044, { emissive: 0xff0044, emissiveIntensity: dark ? 3.5 : 1 });
      emissiveMaterials.push(beaconMat);
      const beacon = new THREE.Mesh(new THREE.SphereGeometry(0.35, 8, 8), beaconMat);
      beacon.position.set(35, 15, -35);
      envGroup.add(beacon);
    }
  }

  /* ==================== 1. POYEZD (TRAIN) 3D BUILDER ==================== */

  function buildTrain(ticket) {
    const trainGroup = new THREE.Group();
    trainGroup.position.y = 0.28;
    wagonRoofs = [];
    wagonGroups = [];
    routeLabel = null;

    const trainColor = ticket.train.includes("Afrosiyob") ? 0xd32f2f
      : ticket.train.includes("Sharq") ? 0x1565c0
      : ticket.train.includes("Nasaf") ? 0x2e7d32
      : 0x475569;

    const bodyMat = M(trainColor);
    const whiteMat = M(0xf1f5f9);
    const glassMat = M(0xa8d5e5, {
      transparent: true,
      opacity: 0.35,
      roughness: 0.1,
      metalness: 0.8
    });
    const wheelMat = M(0x1e242d, { metalness: 0.7 });
    const steelMat = M(0x475569);

    function createBogie(parent, x) {
      B(parent, 2.5, 0.24, 2.6, steelMat, x, 0.68, 0);
      const wheelGeom = new THREE.CylinderGeometry(0.44, 0.44, 0.18, 18).rotateX(Math.PI / 2);
      for (const a of [-0.75, 0.75]) {
        for (const z of [-1.22, 1.22]) {
          const wheel = new THREE.Mesh(wheelGeom, wheelMat);
          wheel.position.set(x + a, 0.44, z);
          wheel.castShadow = true;
          parent.add(wheel);
        }
      }
    }

    // 1. Locomotive (Bosh qism)
    const loco = new THREE.Group();
    loco.position.x = -32;

    // Cabin body
    B(loco, 6.2, 2.6, 3.2, bodyMat, 0, 2.4, 0);
    B(loco, 6.3, 0.24, 3.25, whiteMat, 0, 1.6, 0);

    // Aerodynamic nose cone
    const noseGeom = new THREE.CylinderGeometry(1.6, 1.6, 2.8, 28);
    const nose = new THREE.Mesh(noseGeom, bodyMat);
    nose.position.set(-3.2, 2.4, 0);
    nose.castShadow = true;
    loco.add(nose);

    // Windshield
    const windshieldGeom = new THREE.CylinderGeometry(1.62, 1.62, 0.9, 28, 1, false, Math.PI, Math.PI);
    const windshield = new THREE.Mesh(windshieldGeom, M(0x0f172a, { roughness: 0.15 }));
    windshield.position.set(-3.2, 3.0, 0);
    loco.add(windshield);

    // Roof & Pantograph
    B(loco, 6.0, 0.2, 3.0, M(0x334155), 0, 3.8, 0);
    B(loco, 0.8, 0.45, 1.2, steelMat, 1.8, 4.1, 0);
    B(loco, 0.08, 0.7, 1.0, steelMat, 1.8, 4.6, 0);

    // Headlights
    for (const z of [-0.65, 0.65]) {
      const hlMat = M(0xfff3b0, { emissive: 0xfff3b0, emissiveIntensity: 2.5 });
      emissiveMaterials.push(hlMat);
      const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.22, 12, 8), hlMat);
      lamp.position.set(-4.6, 1.75, z);
      loco.add(lamp);
    }
    const centerHlMat = M(0xffffff, { emissive: 0xffffff, emissiveIntensity: 3 });
    emissiveMaterials.push(centerHlMat);
    const centerLamp = new THREE.Mesh(new THREE.SphereGeometry(0.18, 12, 8), centerHlMat);
    centerLamp.position.set(-4.6, 2.9, 0);
    loco.add(centerLamp);

    // Bogies for locomotive
    createBogie(loco, -1.8);
    createBogie(loco, 2.0);

    // Locomotive train number label
    const locoLabel = createTextSprite(ticket.train, "#0f172a", "#ffffff", 7.5);
    locoLabel.position.set(0, 5.8, 0);
    loco.add(locoLabel);
    trainGroup.add(loco);

    // 2. Wagons (3 Carriages)
    const roofGeom = new THREE.CylinderGeometry(1.65, 1.65, 12.4, 24).rotateZ(Math.PI / 2);

    for (let k = 0; k < 3; k++) {
      const wagon = new THREE.Group();
      wagon.position.x = WX(k);
      wagonGroups.push(wagon);

      // Wagon floor & lower chassis
      B(wagon, 12.4, 0.18, 3.2, M(0x475569), 0, 1.15, 0);
      B(wagon, 12.4, 0.04, 0.7, whiteMat, 0, 1.25, 0);

      // Walls
      for (const s of [-1, 1]) {
        B(wagon, 12.4, 0.85, 0.12, bodyMat, 0, 1.6, s * 1.54);
        B(wagon, 12.4, 0.45, 0.12, bodyMat, 0, 3.25, s * 1.54);

        // Windows
        const glass = new THREE.Mesh(new THREE.BoxGeometry(12.4, 0.95, 0.06), glassMat);
        glass.position.set(0, 2.5, s * 1.54);
        wagon.add(glass);

        // Window mullions / pillars
        for (let p = -5.5; p <= 5.5; p += 1.2) {
          B(wagon, 0.22, 0.95, 0.14, bodyMat, p, 2.5, s * 1.54);
        }
      }

      // End walls & doors
      B(wagon, 0.14, 2.4, 3.2, bodyMat, -6.15, 2.3, 0);
      B(wagon, 0.14, 2.4, 3.2, bodyMat, 6.15, 2.3, 0);

      // Gangway bellows connection
      if (k > 0) {
        B(wagon, 1.4, 2.3, 2.4, M(0x1e293b, { roughness: 0.9 }), -6.85, 2.3, 0);
      }

      // Roof (removable/hidable when wagon is active)
      const roof = new THREE.Mesh(roofGeom, bodyMat);
      roof.position.y = 3.5;
      roof.scale.y = 0.32;
      roof.castShadow = true;
      wagon.add(roof);
      wagonRoofs[k] = roof;

      // Wagon Bogies
      createBogie(wagon, -4.2);
      createBogie(wagon, 4.2);

      // Wagon Label Sprite
      const wagonLabel = createTextSprite(`${k + 1}-vagon\n${ticket.from} ➔ ${ticket.to}`, "#1e3a8a", "#ffffff", 6.2);
      wagonLabel.position.set(0, 5.2, 0);
      wagon.add(wagonLabel);

      trainGroup.add(wagon);
    }

    trainGroup.add(seatsGroup);
    return trainGroup;
  }

  /* ==================== 2. AVTOBUS (BUS) 3D BUILDER ==================== */

  function buildBus(ticket) {
    const busGroup = new THREE.Group();
    busGroup.position.y = 0.28;
    wagonRoofs = [];
    wagonGroups = [];

    const coachColor = 0x1e40af; // Sapphire Tour Bus Blue
    const bodyMat = M(coachColor);
    const whiteMat = M(0xf8fafc);
    const darkTrim = M(0x0f172a, { roughness: 0.4 });
    const glassMat = M(0x93c5fd, {
      transparent: true,
      opacity: 0.4,
      roughness: 0.1,
      metalness: 0.6
    });
    const wheelMat = M(0x1c1917, { metalness: 0.5 });
    const rimMat = M(0xd1d5db, { metalness: 0.85, roughness: 0.25 });

    const L = 16.0; // Bus Length
    const H = 3.3;  // Bus Height
    const W = 3.2;  // Bus Width

    // Main Chassis & Floor
    B(busGroup, L, 0.2, W, M(0x334155), 0, 1.05, 0);
    // Interior floor carpet
    B(busGroup, L - 0.4, 0.05, W - 0.2, M(0x475569), 0, 1.16, 0);

    // Front Windshield & Destination marquee
    // Lower front bumper & grille
    B(busGroup, 0.6, 1.2, W, bodyMat, -L / 2 + 0.3, 1.6, 0);
    B(busGroup, 0.1, 0.5, 2.2, darkTrim, -L / 2 - 0.02, 1.45, 0); // Grille
    // Headlights
    for (const z of [-1.15, 1.15]) {
      const hlMat = M(0xfffbeb, { emissive: 0xfffbeb, emissiveIntensity: 2.5 });
      emissiveMaterials.push(hlMat);
      const hl = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.3, 0.55), hlMat);
      hl.position.set(-L / 2 - 0.02, 1.6, z);
      busGroup.add(hl);
    }

    // Curved front windshield
    const windshield = new THREE.Mesh(new THREE.BoxGeometry(0.1, 1.4, W - 0.1), glassMat);
    windshield.position.set(-L / 2 + 0.25, 2.9, 0);
    windshield.rotation.z = -0.12;
    busGroup.add(windshield);

    // Destination LED board above windshield
    const destSprite = createTextSprite(`${ticket.from} ➔ ${ticket.to}`, "#0b1329", "#38bdf8", 5.8);
    destSprite.position.set(-L / 2 + 0.1, 3.85, 0);
    busGroup.add(destSprite);

    // Aerodynamic Side Mirrors
    for (const s of [-1, 1]) {
      B(busGroup, 0.35, 0.08, 0.45, darkTrim, -L / 2 + 0.6, 3.1, s * (W / 2 + 0.25));
      B(busGroup, 0.1, 0.65, 0.22, darkTrim, -L / 2 + 0.8, 3.0, s * (W / 2 + 0.45));
    }

    // Side Walls & Panoramic Windows
    for (const s of [-1, 1]) {
      // Lower side body
      B(busGroup, L, 0.8, 0.1, bodyMat, 0, 1.55, s * (W / 2 - 0.05));
      // Side livery stripe
      B(busGroup, L, 0.12, 0.12, whiteMat, 0, 1.6, s * (W / 2));

      // Side window glass
      const sideGlass = new THREE.Mesh(new THREE.BoxGeometry(L - 1.2, 1.35, 0.05), glassMat);
      sideGlass.position.set(0.3, 2.65, s * (W / 2 - 0.05));
      busGroup.add(sideGlass);

      // Window pillars
      for (let p = -6.5; p <= 7.0; p += 1.8) {
        B(busGroup, 0.14, 1.35, 0.11, darkTrim, p, 2.65, s * (W / 2 - 0.05));
      }

      // Upper roof trim
      B(busGroup, L, 0.3, 0.1, bodyMat, 0, 3.48, s * (W / 2 - 0.05));
    }

    // Rear End
    B(busGroup, 0.2, H - 0.4, W, bodyMat, L / 2 - 0.1, 2.4, 0);
    // Taillights
    for (const z of [-1.1, 1.1]) {
      const tlMat = M(0xef4444, { emissive: 0xef4444, emissiveIntensity: 2.0 });
      emissiveMaterials.push(tlMat);
      const tl = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.5, 0.3), tlMat);
      tl.position.set(L / 2 + 0.02, 1.8, z);
      busGroup.add(tl);
    }

    // Wheels (Front & Rear)
    function createBusWheel(x, z) {
      const wheelGeom = new THREE.CylinderGeometry(0.55, 0.55, 0.32, 22).rotateX(Math.PI / 2);
      const wheel = new THREE.Mesh(wheelGeom, wheelMat);
      wheel.position.set(x, 0.55, z);
      wheel.castShadow = true;
      // Chrome Rim
      const rimGeom = new THREE.CylinderGeometry(0.35, 0.35, 0.34, 16).rotateX(Math.PI / 2);
      const rim = new THREE.Mesh(rimGeom, rimMat);
      wheel.add(rim);
      busGroup.add(wheel);
    }
    createBusWheel(-5.2, -W / 2);
    createBusWheel(-5.2, W / 2);
    createBusWheel(4.8, -W / 2);
    createBusWheel(4.8, W / 2);

    // Removable Roof (lifts or hides when interior is open)
    const roofGeom = new THREE.BoxGeometry(L, 0.25, W);
    busRoof = new THREE.Mesh(roofGeom, bodyMat);
    busRoof.position.set(0, 3.75, 0);
    busRoof.castShadow = true;
    // Dual AC Units on Roof
    B(busRoof, 2.8, 0.35, 1.8, whiteMat, -2.5, 0.25, 0);
    B(busRoof, 2.8, 0.35, 1.8, whiteMat, 3.2, 0.25, 0);
    busGroup.add(busRoof);

    // Driver's area in front
    const driverSeat = B(busGroup, 0.6, 0.7, 0.6, M(0x1e293b), -L / 2 + 1.2, 1.6, -0.85);
    // Steering column & wheel
    B(busGroup, 0.1, 0.8, 0.1, M(0x334155), -L / 2 + 0.9, 1.8, -0.85);
    const steeringWheel = new THREE.Mesh(
      new THREE.TorusGeometry(0.24, 0.04, 8, 18),
      M(0x0f172a)
    );
    steeringWheel.position.set(-L / 2 + 0.95, 2.2, -0.85);
    steeringWheel.rotation.y = Math.PI / 2;
    steeringWheel.rotation.x = -0.4;
    busGroup.add(steeringWheel);

    // Top Vehicle Badge Sprite
    routeLabel = createTextSprite(`${ticket.from} ➔ ${ticket.to}`, "#157347", "#ffffff", 5.8);
    routeLabel.position.set(0, 4.5, 0);
    busGroup.add(routeLabel);

    busGroup.add(seatsGroup);
    return busGroup;
  }

  /* ==================== 3. SAMOLYOT (AIRPLANE) 3D BUILDER ==================== */

  function buildAirplane(ticket) {
    const planeGroup = new THREE.Group();
    planeGroup.position.y = 0.28;
    wagonRoofs = [];
    wagonGroups = [];
    spinningObjects = [];
    planeInteriorMaterials = [];
    routeLabel = null;

    // Livery Colors (Uzbekistan Airways style: Clean White + Cyan Blue + Emerald Green)
    const whiteMat = M(0xf8fafc, { roughness: 0.35, metalness: 0.2 });
    const whiteMatDouble = M(0xf8fafc, { roughness: 0.35, metalness: 0.2, side: THREE.DoubleSide });
    const blueMat = M(0x0284c7, { roughness: 0.35, metalness: 0.2 });
    const greenMat = M(0x10b981, { roughness: 0.35, metalness: 0.2 });
    const glassMat = M(0x0f172a, { roughness: 0.15, metalness: 0.8 });
    const engineMat = M(0x334155, { metalness: 0.8, roughness: 0.25 });
    const chromeMat = M(0xe2e8f0, { metalness: 0.95, roughness: 0.1 });
    const tireMat = M(0x18181b);

    const R = 1.7;           // Fuselage Radius
    const bodyLength = 17.6; // Main cylindrical passenger cabin length

    // 1. Lower Fuselage Belly (Pastki qorin qismi - har doim butun va pol ostini to'liq qoplaydi)
    const bellyGeom = new THREE.CylinderGeometry(R, R, bodyLength, 32, 1, true, Math.PI, Math.PI);
    bellyGeom.rotateZ(Math.PI / 2);
    planeBelly = new THREE.Mesh(bellyGeom, whiteMatDouble);
    planeBelly.position.set(0, 2.2, 0);
    planeBelly.castShadow = true;
    planeBelly.receiveShadow = true;
    planeGroup.add(planeBelly);
    planeHull = planeBelly;

    // Cabin Floor (Yo'lovchilar saloni poli)
    B(planeGroup, bodyLength - 0.2, 0.1, R * 1.85, M(0x3b4252), 0, 1.7, 0);

    // 2. Dynamic Adaptive Cabin Sides (Chap va O'ng qobiqlar - pol sathidan shift tepasigacha to'liq korpus)
    // Left Shell (Chap devor + chap shift + derazalar + chiziqlar, Z < 0)
    leftSideGroup = new THREE.Group();
    const leftWallGeom = new THREE.CylinderGeometry(R, R, bodyLength, 32, 1, true, Math.PI / 2 + 0.33, Math.PI / 2 - 0.05);
    leftWallGeom.rotateZ(Math.PI / 2);
    const leftWallMesh = new THREE.Mesh(leftWallGeom, whiteMatDouble);
    leftWallMesh.position.set(0, 2.2, 0);
    leftWallMesh.castShadow = true;
    leftSideGroup.add(leftWallMesh);

    // Left cheatline stripes (Loyiha korpusi chiziqlari)
    B(leftSideGroup, bodyLength - 0.4, 0.18, 0.05, blueMat, 0, 2.1, -(R + 0.02));
    B(leftSideGroup, bodyLength - 0.4, 0.08, 0.05, greenMat, 0, 1.95, -(R + 0.02));

    // Left passenger cabin windows
    for (let p = -5.5; p <= 5.5; p += 1.2) {
      const win = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.18, 0.06, 16).rotateX(Math.PI / 2), glassMat);
      win.position.set(p, 2.35, -(R + 0.02));
      leftSideGroup.add(win);
    }
    planeGroup.add(leftSideGroup);

    // Right Shell (O'ng devor + o'ng shift + derazalar + chiziqlar, Z > 0)
    rightSideGroup = new THREE.Group();
    const rightWallGeom = new THREE.CylinderGeometry(R, R, bodyLength, 32, 1, true, -0.28, Math.PI / 2 - 0.05);
    rightWallGeom.rotateZ(Math.PI / 2);
    const rightWallMesh = new THREE.Mesh(rightWallGeom, whiteMatDouble);
    rightWallMesh.position.set(0, 2.2, 0);
    rightWallMesh.castShadow = true;
    rightSideGroup.add(rightWallMesh);

    // Right cheatline stripes
    B(rightSideGroup, bodyLength - 0.4, 0.18, 0.05, blueMat, 0, 2.1, (R + 0.02));
    B(rightSideGroup, bodyLength - 0.4, 0.08, 0.05, greenMat, 0, 1.95, (R + 0.02));

    // Right passenger cabin windows
    for (let p = -5.5; p <= 5.5; p += 1.2) {
      const win = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.18, 0.06, 16).rotateX(Math.PI / 2), glassMat);
      win.position.set(p, 2.35, (R + 0.02));
      rightSideGroup.add(win);
    }
    planeGroup.add(rightSideGroup);

    // 3. Cabin Roof Top Cap (Markaziy shift qopqog'i: y = 3.8 dan 3.9 gacha)
    // Umumiy ko'rinishda yopiladi, ichki ko'rinishda ochilib o'rindiqlar to'liq ko'rinadi
    const roofGeom = new THREE.CylinderGeometry(R, R, bodyLength, 32, 1, true, Math.PI / 2 - 0.35, 0.70);
    roofGeom.rotateZ(Math.PI / 2);
    planeRoof = new THREE.Mesh(roofGeom, whiteMatDouble);
    planeRoof.position.set(0, 2.2, 0);
    planeRoof.castShadow = true;
    planeGroup.add(planeRoof);

    // 4. Aerodynamic Nose Cone (Kokpit / Samolyot burni)
    const noseGeom = new THREE.ConeGeometry(R, 3.8, 32);
    noseGeom.rotateZ(Math.PI / 2);
    const nose = new THREE.Mesh(noseGeom, whiteMat);
    nose.position.set(-bodyLength / 2 - 1.9, 2.2, 0);
    nose.castShadow = true;
    planeGroup.add(nose);

    // Cockpit Windshield (Flight Deck - burun konusi ustki yuzasida chiroyli kabina oynasi)
    const cockpitGlass = new THREE.Mesh(
      new THREE.BoxGeometry(0.85, 0.45, 1.3),
      glassMat
    );
    cockpitGlass.position.set(-bodyLength / 2 - 0.9, 3.25, 0);
    cockpitGlass.rotation.z = -0.32;
    planeGroup.add(cockpitGlass);

    // Cockpit bulkhead wall (o'rindiqlarni to'smaydigan qulay to'siq devor)
    B(planeGroup, 0.1, 0.8, R * 1.7, M(0x334155), -bodyLength / 2 + 0.2, 2.1, 0);

    // 5. Tapered Tail Cone (Dum qismi)
    const tailConeGeom = new THREE.ConeGeometry(R, 4.0, 32);
    tailConeGeom.rotateZ(-Math.PI / 2);
    const tailCone = new THREE.Mesh(tailConeGeom, whiteMat);
    tailCone.position.set(bodyLength / 2 + 2.0, 2.2, 0);
    tailCone.castShadow = true;
    planeGroup.add(tailCone);

    // Rear bulkhead wall
    B(planeGroup, 0.1, 0.8, R * 1.7, M(0x334155), bodyLength / 2 - 0.2, 2.1, 0);

    // 6. Swept Airliner Wings (Qanotlar - salonni kesib o'tmaydigan, to'g'ri tashqariga yo'nalgan)
    function createWing(zSign) {
      const wingShape = new THREE.Shape();
      wingShape.moveTo(0, 0);
      wingShape.lineTo(3.2, 8.6);
      wingShape.lineTo(4.6, 8.6);
      wingShape.lineTo(3.8, 0);
      wingShape.closePath();

      const extrudeSettings = { depth: 0.18, bevelEnabled: true, bevelSegments: 2, steps: 1, bevelSize: 0.04, bevelThickness: 0.04 };
      const wingGeom = new THREE.ExtrudeGeometry(wingShape, extrudeSettings);
      wingGeom.rotateX(Math.PI / 2);

      const wing = new THREE.Mesh(wingGeom, whiteMatDouble);
      wing.position.set(-1.0, 1.58, zSign * 1.6);
      if (zSign < 0) {
        wing.scale.z = -1;
      }
      wing.castShadow = true;
      wing.receiveShadow = true;
      planeGroup.add(wing);

      // Angled Winglet (Qanot uchidagi qanotcha)
      const wingletMat = blueMat;
      const winglet = B(planeGroup, 1.4, 0.55, 0.08, wingletMat, 2.9, 1.85, zSign * 10.2);

      // Wingtip Navigation Light (Aviatsiya standarti: chap = qizil, o'ng = yashil)
      const navLightColor = zSign > 0 ? 0x10b981 : 0xef4444;
      const navMat = M(navLightColor, { emissive: navLightColor, emissiveIntensity: 3 });
      emissiveMaterials.push(navMat);
      const navBulb = new THREE.Mesh(new THREE.SphereGeometry(0.12, 8, 8), navMat);
      navBulb.position.set(2.9, 2.15, zSign * 10.2);
      planeGroup.add(navBulb);
    }
    createWing(1);  // O'ng qanot (Starboard)
    createWing(-1); // Chap qanot (Port)

    // 7. Turbofan Jet Engines under wings (Reaktiv dvigatellar)
    function createJetEngine(z) {
      const engineGroup = new THREE.Group();
      engineGroup.position.set(0.6, 0.95, z);

      // Pylon mount
      B(engineGroup, 1.6, 0.7, 0.2, engineMat, 0, 0.6, 0);

      // Engine Nacelle (cylindrical casing)
      const nacelleGeom = new THREE.CylinderGeometry(0.72, 0.68, 3.2, 24).rotateZ(Math.PI / 2);
      const nacelle = new THREE.Mesh(nacelleGeom, whiteMat);
      nacelle.castShadow = true;
      engineGroup.add(nacelle);

      // Chrome Intake Lip
      const intakeGeom = new THREE.TorusGeometry(0.72, 0.08, 12, 24);
      intakeGeom.rotateY(Math.PI / 2);
      const intakeLip = new THREE.Mesh(intakeGeom, chromeMat);
      intakeLip.position.x = -1.6;
      engineGroup.add(intakeLip);

      // Spinner cone & turbine blades
      const spinner = new THREE.Mesh(new THREE.ConeGeometry(0.24, 0.6, 16).rotateZ(-Math.PI / 2), chromeMat);
      spinner.position.x = -1.3;
      engineGroup.add(spinner);
      spinningObjects.push(spinner);

      // Exhaust cone
      const exhaust = new THREE.Mesh(new THREE.CylinderGeometry(0.48, 0.4, 0.6, 20).rotateZ(Math.PI / 2), engineMat);
      exhaust.position.x = 1.8;
      engineGroup.add(exhaust);

      planeGroup.add(engineGroup);
    }
    createJetEngine(4.8);
    createJetEngine(-4.8);

    // 8. Tail Assembly (Empennage - Dum barqarorlashtirgichlari)
    // Vertical Stabilizer (Fin)
    const finShape = new THREE.Shape();
    finShape.moveTo(0, 0);
    finShape.lineTo(2.4, 4.4);
    finShape.lineTo(3.6, 4.4);
    finShape.lineTo(2.2, 0);
    finShape.closePath();
    const finGeom = new THREE.ExtrudeGeometry(finShape, { depth: 0.18, bevelEnabled: true, bevelSize: 0.03, bevelThickness: 0.03 });
    const fin = new THREE.Mesh(finGeom, blueMat);
    fin.position.set(bodyLength / 2 - 0.5, 3.2, -0.09);
    fin.castShadow = true;
    planeGroup.add(fin);

    // Horizontal Stabilizers (Tailplanes)
    function createHorizontalTail(zSign) {
      const hTailShape = new THREE.Shape();
      hTailShape.moveTo(0, 0);
      hTailShape.lineTo(1.4, 2.6);
      hTailShape.lineTo(2.2, 2.6);
      hTailShape.lineTo(1.8, 0);
      hTailShape.closePath();

      const hTailGeom = new THREE.ExtrudeGeometry(hTailShape, { depth: 0.1, bevelEnabled: false });
      hTailGeom.rotateX(Math.PI / 2);
      const hTailMesh = new THREE.Mesh(hTailGeom, whiteMatDouble);
      hTailMesh.position.set(bodyLength / 2 + 0.4, 2.7, zSign * 0.4);
      if (zSign < 0) {
        hTailMesh.scale.z = -1;
      }
      hTailMesh.castShadow = true;
      planeGroup.add(hTailMesh);
    }
    createHorizontalTail(1);
    createHorizontalTail(-1);

    // 9. Landing Gear (Shassi g'ildiraklari - polni teshib chiqmaydigan mutanosib ustun)
    function createGear(x, z, h) {
      const pylonH = Math.min(h, 1.25);
      B(planeGroup, 0.14, pylonH, 0.14, chromeMat, x, 0.38 + pylonH / 2, z);
      const wheelGeom = new THREE.CylinderGeometry(0.38, 0.38, 0.24, 18).rotateX(Math.PI / 2);
      for (const offset of [-0.2, 0.2]) {
        const wheel = new THREE.Mesh(wheelGeom, tireMat);
        wheel.position.set(x, 0.38, z + offset);
        planeGroup.add(wheel);
      }
    }
    createGear(-bodyLength / 2 + 1.2, 0, 1.2);   // Nose Gear (pol ostida qoladi, uchi chiqmaydi)
    createGear(0.8, -2.6, 1.2);                 // Left Main Gear
    createGear(0.8, 2.6, 1.2);                  // Right Main Gear

    // Aircraft Label Sprite
    routeLabel = createTextSprite(`${ticket.train}\n${ticket.from} ➔ ${ticket.to}`, "#0284c7", "#ffffff", 6.8);
    routeLabel.position.set(0, 5.2, 0);
    planeGroup.add(routeLabel);

    planeGroup.add(seatsGroup);
    return planeGroup;
  }

  function updatePlaneVisibility() {
    if (!leftSideGroup || !rightSideGroup || !planeRoof) return;
    if (isOverview) {
      planeRoof.visible = true;
      leftSideGroup.visible = true;
      rightSideGroup.visible = true;
      return;
    }

    // Interior rejimida markaziy tom qopqog'i ochiq
    planeRoof.visible = false;

    // Kamera qaysi tomondan qarayotganini aniqlaymiz:
    const relZ = camera ? (camera.position.z - CM.tg.z) : 0;
    const isTopDown = CM.ph < 0.62; // Foydalanuvchi tik yuqoridan (tepadan) qarayotgan bo'lsa

    if (isTopDown) {
      // Tik tepadan qaralganda barcha o'rindiqlar kaftdek to'liq va ravshan ko'rinadi
      leftSideGroup.visible = false;
      rightSideGroup.visible = false;
    } else if (relZ >= 0) {
      // Foydalanuvchi o'ng tomondan qarayapti:
      // O'ng tomon ochiladi (ichki o'rindiqlar to'liq ko'rinadi va tanlanadi),
      // Chap tomon esa poldan to shift tepasigacha TO'LIQ ko'rinib turadi (samolyotning barcha qismlari butun)!
      rightSideGroup.visible = false;
      leftSideGroup.visible = true;
    } else {
      // Foydalanuvchi chap tomondan qarayapti:
      // Chap tomon ochiladi, o'ng tomon esa poldan to shift tepasigacha TO'LIQ ko'rinib turadi!
      leftSideGroup.visible = false;
      rightSideGroup.visible = true;
    }
  }

  function setPlaneCutaway(enabled) {
    updatePlaneVisibility();
  }

  /* ==================== 3D PASSENGER SEATS ==================== */

  function renderSeats(ticket, carNum, selectedSeatList) {
    seatsGroup.clear();
    seatMeshes = [];

    const mode = ticket.mode || "train";
    const bookedSeats = ticket.seats || [];

    // Base coordinates & spacing depending on vehicle
    let startX = -4.8, stepX = 1.08;
    let seatY = 1.6;
    let zOffsets = [-0.95, 0.95];

    if (mode === "train") {
      startX = WX(carNum - 1) - 4.6;
      stepX = 1.05;
      seatY = 1.6;
      zOffsets = [-0.92, 0.92];
    } else if (mode === "bus") {
      startX = -5.2;
      stepX = 1.15;
      seatY = 1.55;
      zOffsets = [-0.95, 0.95];
    } else if (mode === "flight") {
      startX = -4.6;
      stepX = 1.05;
      seatY = 2.05;
      zOffsets = [-0.85, 0.85];
    }

    // Geometry parts for ergonomic passenger seat
    const seatBaseGeom = new THREE.BoxGeometry(0.55, 0.12, 0.48);
    const seatBackGeom = new THREE.BoxGeometry(0.12, 0.72, 0.48);
    const headrestGeom = new THREE.BoxGeometry(0.1, 0.22, 0.38);
    const armrestGeom = new THREE.BoxGeometry(0.42, 0.08, 0.08);
    const pedestalGeom = new THREE.BoxGeometry(0.16, 0.45, 0.22);
    const pedestalMat = M(0x27272a, { metalness: 0.6 });

    for (let row = 0; row < 10; row++) {
      for (let col = 0; col < 2; col++) {
        const seatNum = row * 2 + col + 1; // 1 to 20
        const isBooked = bookedSeats.find(s => Number(s.car) === carNum && Number(s.seat) === seatNum);
        const isSelected = selectedSeatList.some(seat => Number(seat.car) === carNum && Number(seat.seat) === seatNum);

        let seatColor = 0x9aa5b1; // Free = clean silver/gray
        let emissiveColor = 0x000000;
        let emissiveIntensity = 0;

        if (isSelected) {
          seatColor = 0xffd600; // Gold glowing selected
          emissiveColor = 0xffb703;
          emissiveIntensity = 0.85;
        } else if (isBooked) {
          if (isBooked.gender === "ayol") {
            seatColor = 0xe53935; // Female = Red/Pink
          } else {
            seatColor = 0x2f6bff; // Male = Blue
          }
          emissiveColor = 0x111111;
        }

        const seatMat = M(seatColor, {
          roughness: 0.65,
          emissive: emissiveColor,
          emissiveIntensity: emissiveIntensity
        });

        const posX = startX + row * stepX;
        const posZ = zOffsets[col];

        // Seat base & back
        const seatBase = new THREE.Mesh(seatBaseGeom, seatMat);
        seatBase.position.set(posX, seatY, posZ);
        seatBase.castShadow = true;
        seatBase.userData = { seat: seatNum, car: carNum, isBooked: Boolean(isBooked), bookedGender: isBooked?.gender };
        seatsGroup.add(seatBase);
        seatMeshes.push(seatBase);

        const seatBack = new THREE.Mesh(seatBackGeom, seatMat);
        seatBack.position.set(posX - 0.22, seatY + 0.38, posZ);
        seatBack.castShadow = true;
        seatBack.userData = seatBase.userData;
        seatsGroup.add(seatBack);
        seatMeshes.push(seatBack);

        const headrest = new THREE.Mesh(headrestGeom, seatMat);
        headrest.position.set(posX - 0.22, seatY + 0.82, posZ);
        headrest.userData = seatBase.userData;
        seatsGroup.add(headrest);
        seatMeshes.push(headrest);

        // Armrest & pedestal
        const armrest = new THREE.Mesh(armrestGeom, pedestalMat);
        armrest.position.set(posX, seatY + 0.32, posZ + (col === 0 ? 0.26 : -0.26));
        seatsGroup.add(armrest);

        const pedestal = new THREE.Mesh(pedestalGeom, pedestalMat);
        pedestal.position.set(posX, seatY - 0.26, posZ);
        seatsGroup.add(pedestal);
      }
    }
  }

  /* ==================== 3D SCENE INITIALIZATION ==================== */

  function init(containerEl, onSeatCallback, onCarCallback) {
    callbacks.onSeatSelect = onSeatCallback;
    callbacks.onCarChange = onCarCallback;
    container = containerEl;

    if (!container) return;

    if (!container.querySelector("#v3dCanvas")) {
      container.innerHTML = `
        <div class="vehicle-3d-wrapper">
          <div class="vehicle-3d-header">
            <div class="vehicle-3d-badge">
              <span class="v-icon" id="v3dIcon">🚆</span>
              <div>
                <strong id="v3dTitle">3D Transport ko'rinishi</strong>
                <span id="v3dSubtitle">O'rindiqni bevosita 3D model ichidan tanlang</span>
              </div>
            </div>
            <div class="vehicle-3d-actions">
              <button type="button" class="btn-3d-action" id="v3dOverviewBtn" title="Umumiy ko'rinishga qaytish">🌐 Umumiy ko'rinish</button>
              <button type="button" class="btn-3d-action active" id="v3dInteriorBtn" title="Salon ichki ko'rinishi">💺 Ichki ko'rinish</button>
            </div>
          </div>

          <div class="vehicle-3d-canvas-box" id="v3dCanvasBox">
            <canvas id="v3dCanvas"></canvas>
            <div class="v3d-zoom-controls">
              <button type="button" id="v3dZoomIn" title="Kattalashtirish">+</button>
              <button type="button" id="v3dZoomOut" title="Kichiklashtirish">−</button>
              <button type="button" id="v3dResetCam" title="Kamerani boshlang'ich holatga qaytarish">↺</button>
            </div>
            <div class="v3d-badge-tag" id="v3dBadgeTag">3D INTERAKTIV</div>
            <div id="v3dHint" class="v3d-hint">💡 O'rindiq ustiga bosing — uni band qilish uchun</div>
          </div>

          <div class="v3d-toolbar">
            <div class="v3d-car-selector" id="v3dCarSelector"></div>
            <div class="v3d-gender-selector">
              <span class="v3d-toolbar-label">Jinsingiz:</span>
              <button type="button" class="v3d-gender-btn active" id="v3dGenderMale" data-gender="erkak">
                <i class="v-dot male"></i> Erkak
              </button>
              <button type="button" class="v3d-gender-btn" id="v3dGenderFemale" data-gender="ayol">
                <i class="v-dot female"></i> Ayol
              </button>
            </div>
          </div>

          <div class="v3d-legend">
            <span><i style="background:#9aa5b1"></i> Bo'sh joy</span>
            <span><i style="background:#2f6bff"></i> Erkak band qilgan</span>
            <span><i style="background:#e53935"></i> Ayol band qilgan</span>
            <span><i style="background:#ffd600"></i> Siz tanlagan joy</span>
          </div>
        </div>
      `;

      canvas = document.querySelector("#v3dCanvas");
      renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true, alpha: false });
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
      renderer.shadowMap.enabled = true;
      renderer.shadowMap.type = THREE.PCFSoftShadowMap;

      scene = new THREE.Scene();
      camera = new THREE.PerspectiveCamera(45, 1, 0.1, 600);

      // Lighting
      lights.hemisphere = new THREE.HemisphereLight(0xffffff, 0x556677, 0.85);
      lights.directional = new THREE.DirectionalLight(0xffffff, 0.95);
      lights.directional.position.set(38, 55, 30);
      lights.directional.target.position.set(0, 0, 0);
      lights.directional.castShadow = true;
      lights.directional.shadow.mapSize.set(1024, 1024);
      lights.directional.shadow.camera.left = -60;
      lights.directional.shadow.camera.right = 60;
      lights.directional.shadow.camera.top = 35;
      lights.directional.shadow.camera.bottom = -35;
      lights.directional.shadow.camera.near = 1;
      lights.directional.shadow.camera.far = 160;

      scene.add(lights.hemisphere, lights.directional, lights.directional.target);

      setupEventListeners();
      requestAnimationFrame(renderLoop);
      isInitialized = true;
    }
  }

  function setupEventListeners() {
    window.addEventListener("resize", onResize);

    // Pointer rotation & drag
    canvas.addEventListener("pointerdown", e => {
      pointerDown = { x: e.clientX, y: e.clientY, dist: 0 };
      canvas.setPointerCapture(e.pointerId);
    });

    canvas.addEventListener("pointermove", e => {
      // Raycasting for hover tooltip
      const rect = canvas.getBoundingClientRect();
      mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

      if (!pointerDown) {
        raycaster.setFromCamera(mouse, camera);
        const hits = raycaster.intersectObjects(seatMeshes, false);
        const hintEl = document.querySelector("#v3dHint");
        if (hits.length > 0 && hintEl) {
          const u = hits[0].object.userData;
          hoveredSeat = u.seat;
          canvas.style.cursor = "pointer";
          const statusText = u.isBooked ? `(band — ${u.bookedGender === "ayol" ? "ayol" : "erkak"})` : `(bo'sh)`;
          hintEl.textContent = `💺 ${seatLocationLabel(u.car)}${u.seat}-o'rindiq ${statusText}`;
        } else {
          hoveredSeat = null;
          canvas.style.cursor = "grab";
        }
        return;
      }

      // Drag rotating
      const dx = e.clientX - pointerDown.x;
      const dy = e.clientY - pointerDown.y;
      pointerDown.dist += Math.abs(dx) + Math.abs(dy);
      pointerDown.x = e.clientX;
      pointerDown.y = e.clientY;

      G.th -= dx * 0.006;
      G.ph = Math.min(Math.PI - 0.08, Math.max(0.08, G.ph - dy * 0.006));
      isOverview = false;
      document.querySelector("#v3dOverviewBtn")?.classList.remove("active");
    });

    canvas.addEventListener("pointerup", e => {
      if (pointerDown && pointerDown.dist < 6) {
        handlePointerClick(e);
      }
      pointerDown = null;
    });

    canvas.addEventListener("wheel", e => {
      e.preventDefault();
      G.r = Math.min(130, Math.max(6, G.r + e.deltaY * 0.04));
    }, { passive: false });

    // Buttons
    document.querySelector("#v3dZoomIn")?.addEventListener("click", () => {
      G.r = Math.max(6, G.r * 0.8);
    });
    document.querySelector("#v3dZoomOut")?.addEventListener("click", () => {
      G.r = Math.min(130, G.r * 1.25);
    });
    document.querySelector("#v3dResetCam")?.addEventListener("click", () => {
      flyTo(currentTicket, activeCar, false);
    });
    document.querySelector("#v3dOverviewBtn")?.addEventListener("click", () => {
      setOverviewMode(true);
    });
    document.querySelector("#v3dInteriorBtn")?.addEventListener("click", () => {
      setOverviewMode(false);
    });

    // Gender buttons
    const maleBtn = document.querySelector("#v3dGenderMale");
    const femaleBtn = document.querySelector("#v3dGenderFemale");
    maleBtn?.addEventListener("click", () => {
      maleBtn.classList.add("active");
      femaleBtn.classList.remove("active");
      localStorage.setItem("gender", "erkak");
    });
    femaleBtn?.addEventListener("click", () => {
      femaleBtn.classList.add("active");
      maleBtn.classList.remove("active");
      localStorage.setItem("gender", "ayol");
    });

    // Restore saved gender
    const savedGender = localStorage.getItem("gender") || "erkak";
    if (savedGender === "ayol") {
      femaleBtn?.click();
    }
  }

  function handlePointerClick(e) {
    const rect = canvas.getBoundingClientRect();
    mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

    raycaster.setFromCamera(mouse, camera);
    const hits = raycaster.intersectObjects(seatMeshes, false);
    if (!hits.length) return;

    const u = hits[0].object.userData;
    const hintEl = document.querySelector("#v3dHint");

    if (u.isBooked) {
      if (hintEl) {
        hintEl.textContent = `❌ ${u.seat}-o'rindiq allaqachon band qilingan! Boshqa joy tanlang.`;
      }
      return;
    }

    // Toggle selection
    const selectedIndex = selectedSeats.findIndex(seat => seat.car === activeCar && seat.seat === u.seat);
    if (selectedIndex === -1) selectedSeats.push({ car: activeCar, seat: u.seat });
    else selectedSeats.splice(selectedIndex, 1);
    renderSeats(currentTicket, activeCar, selectedSeats);

    if (hintEl) {
      hintEl.textContent = `${selectedIndex === -1 ? "✅" : "↩"} ${seatLocationLabel(u.car)}${u.seat}-o'rindiq ${selectedIndex === -1 ? "tanlandi" : "bekor qilindi"}.`;
    }

    if (typeof callbacks.onSeatSelect === "function") {
      callbacks.onSeatSelect({ car: activeCar, seat: u.seat, seats: selectedSeats.map(seat => ({ ...seat })) });
    }
  }

  function seatLocationLabel(car) {
    if (activeMode === "train") return `${car}-vagon, `;
    return activeMode === "bus" ? "Avtobus, " : "Salon, ";
  }

  function setOverviewMode(enable) {
    isOverview = enable;
    const ovBtn = document.querySelector("#v3dOverviewBtn");
    const inBtn = document.querySelector("#v3dInteriorBtn");
    ovBtn?.classList.toggle("active", enable);
    inBtn?.classList.toggle("active", !enable);

    // Roof visibility
    if (activeMode === "train") {
      wagonRoofs.forEach((r, k) => {
        if (r) r.visible = enable ? true : k !== (activeCar - 1);
      });
    } else if (activeMode === "bus" && busRoof) {
      busRoof.visible = enable;
    } else if (activeMode === "flight") {
      updatePlaneVisibility();
    }

    const sm = window.innerWidth < 600;
    if (enable) {
      G.tg.set(0, 2.0, 0);
      G.r = sm ? 90 : 65;
      G.ph = 0.95;
    } else {
      flyTo(currentTicket, activeCar, false);
    }
  }

  function onResize() {
    if (!canvas || !renderer || !camera) return;
    const box = canvas.parentElement;
    if (!box) return;
    const w = box.clientWidth;
    const h = box.clientHeight;
    if (!w || !h) return;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }

  /* ==================== FLY-IN CINEMATIC TRANSITION ==================== */

  function flyTo(ticket, carNum, triggerCinematicFlyIn = true) {
    currentTicket = ticket;
    activeCar = carNum;
    activeMode = ticket.mode || "train";
    const sm = window.innerWidth < 600;

    isOverview = false;
    document.querySelector("#v3dOverviewBtn")?.classList.remove("active");
    document.querySelector("#v3dInteriorBtn")?.classList.add("active");

    // Calculate focal center for vehicle or active carriage
    let targetX = 0, targetY = 1.8, targetZ = 0;
    let focusR = sm ? 17 : 12.5;

    if (activeMode === "train") {
      targetX = WX(carNum - 1);
      targetY = 1.7;
      focusR = sm ? 18 : 13;
    } else if (activeMode === "bus") {
      targetX = 0;
      targetY = 1.7;
      focusR = sm ? 17 : 12;
    } else if (activeMode === "flight") {
      targetX = 0;
      targetY = 2.2;
      focusR = sm ? 18 : 13;
    }

    if (triggerCinematicFlyIn) {
      // Start high up in the sky for smooth swooping fly-in transition
      CM.th = -0.32;
      CM.ph = 0.98;
      CM.r = sm ? 100 : 80;
      CM.tg.set(0, 2.0, 0);
    }

    // Set goal destination
    G.tg.set(targetX, targetY, targetZ);
    G.r = focusR;
    G.ph = 0.68;
    G.th = -0.22;
    if (routeLabel) routeLabel.position.x = activeMode === "train" ? targetX : 0;

    // Open roof of the active carriage / cabin
    if (activeMode === "train") {
      wagonRoofs.forEach((r, k) => {
        if (r) r.visible = k !== (carNum - 1);
      });
    } else if (activeMode === "bus" && busRoof) {
      busRoof.visible = false;
    } else if (activeMode === "flight") {
      updatePlaneVisibility();
    }

    renderSeats(ticket, activeCar, selectedSeats);
  }

  /* ==================== DISPLAY & MOUNT VEHICLE ==================== */

  function show(ticket, selectedSeatList, onSeatCallback, onCarCallback) {
    const el = document.querySelector("#trainModel");
    if (!el) return;
    el.classList.remove("hidden");
    init(el, onSeatCallback, onCarCallback);

    currentTicket = ticket;
    activeMode = ticket.mode || "train";
    selectedSeats = Array.isArray(selectedSeatList) ? selectedSeatList.map(seat => ({ ...seat })) : [];
    activeCar = selectedSeats[0] ? selectedSeats[0].car : 1;

    const dark = isNightDeparture(ticket.departure);
    buildEnvironment(activeMode, dark);

    if (vehicleGroup) scene.remove(vehicleGroup);
    if (activeMode === "train") {
      vehicleGroup = buildTrain(ticket);
    } else if (activeMode === "bus") {
      vehicleGroup = buildBus(ticket);
    } else {
      vehicleGroup = buildAirplane(ticket);
    }
    scene.add(vehicleGroup);

    // Update Header badges & labels
    const iconEl = document.querySelector("#v3dIcon");
    const titleEl = document.querySelector("#v3dTitle");
    const subtitleEl = document.querySelector("#v3dSubtitle");
    const badgeTag = document.querySelector("#v3dBadgeTag");

    const vehicleMeta = {
      train: { icon: "🚆", name: "3D Poyezd", desc: "Vagon va o'rindiqni bevosita 3D salon ichidan tanlang" },
      bus: { icon: "🚌", name: "3D Avtobus", desc: "Sayohat avtobusi salonidan o'rindiqni tanlang" },
      flight: { icon: "✈️", name: "3D Samolyot", desc: "Reaktiv layner salonidan o'rindiqni tanlang" }
    }[activeMode] || { icon: "🚆", name: "3D Transport", desc: "O'rindiqni tanlang" };

    if (iconEl) iconEl.textContent = vehicleMeta.icon;
    if (titleEl) titleEl.textContent = `${ticket.train} — ${vehicleMeta.name}`;
    if (subtitleEl) subtitleEl.textContent = `${vehicleMeta.desc} · ${ticket.from} → ${ticket.to}`;
    if (badgeTag) badgeTag.textContent = `${vehicleMeta.icon} ${vehicleMeta.name.toLocaleUpperCase()}`;

    // Render Car/Wagon Buttons
    renderCarSelector();

    // Trigger smooth fly-in animation
    flyTo(ticket, activeCar, true);

    // Force canvas resize calculations
    onResize();
    requestAnimationFrame(onResize);
    setTimeout(onResize, 50);
    setTimeout(onResize, 150);
    setTimeout(onResize, 350);
  }

  function renderCarSelector() {
    const selectorEl = document.querySelector("#v3dCarSelector");
    if (!selectorEl || !currentTicket) return;

    const carCount = activeMode === "train" ? 3 : 1;
    const bookedSeats = currentTicket.seats || [];

    selectorEl.innerHTML = Array.from({ length: carCount }, (_, idx) => {
      const c = idx + 1;
      const countInCar = bookedSeats.filter(s => Number(s.car) === c).length;
      const freeSeats = Math.max(0, 20 - countInCar);
      const label = activeMode === "train" ? `${c}-vagon` : activeMode === "bus" ? "Avtobus saloni" : "Samolyot saloni";
      return `
        <button type="button" class="v3d-car-btn ${c === activeCar ? "active" : ""}" data-car="${c}">
          <span>${label}</span>
          <small>${freeSeats} ta bo'sh joy</small>
        </button>
      `;
    }).join("");

    selectorEl.querySelectorAll("[data-car]").forEach(btn => {
      btn.addEventListener("click", () => {
        const c = Number(btn.dataset.car);
        activeCar = c;
        renderCarSelector();
        flyTo(currentTicket, activeCar, false);
        if (typeof callbacks.onCarChange === "function") {
          callbacks.onCarChange(activeCar);
        }
      });
    });
  }

  function selectSeat(seatNum) {
    const selectedIndex = selectedSeats.findIndex(seat => seat.car === activeCar && seat.seat === seatNum);
    if (selectedIndex === -1) selectedSeats.push({ car: activeCar, seat: seatNum });
    else selectedSeats.splice(selectedIndex, 1);
    if (currentTicket) renderSeats(currentTicket, activeCar, selectedSeats);
    if (typeof callbacks.onSeatSelect === "function") {
      callbacks.onSeatSelect({ car: activeCar, seat: seatNum, seats: selectedSeats.map(seat => ({ ...seat })) });
    }
  }

  /* ==================== ANIMATION RENDER LOOP ==================== */

  function renderLoop() {
    requestAnimationFrame(renderLoop);
    if (!renderer || !scene || !camera || !canvas) return;

    // Check dynamic parent container resize
    const box = canvas.parentElement;
    if (box) {
      const w = box.clientWidth;
      const h = box.clientHeight;
      if (w > 0 && h > 0) {
        const pr = Math.min(window.devicePixelRatio || 1, 2);
        if (canvas.width !== Math.floor(w * pr) || canvas.height !== Math.floor(h * pr)) {
          renderer.setSize(w, h, false);
          camera.aspect = w / h;
          camera.updateProjectionMatrix();
        }
      }
    }

    // Spin jet engine blades if aircraft mode
    if (spinningObjects.length > 0) {
      spinningObjects.forEach(obj => {
        obj.rotation.x += 0.15;
      });
    }

    // Slow auto-rotation when in overview mode
    if (isOverview) {
      G.th += 0.002;
    }

    // Smooth camera damping / lerp
    for (const k of ["th", "ph", "r"]) {
      CM[k] += (G[k] - CM[k]) * 0.08;
    }
    CM.tg.lerp(G.tg, 0.08);

    // Compute spherical position
    camera.position.set(
      CM.tg.x + CM.r * Math.sin(CM.ph) * Math.sin(CM.th),
      CM.tg.y + CM.r * Math.cos(CM.ph),
      CM.tg.z + CM.r * Math.sin(CM.ph) * Math.cos(CM.th)
    );
    camera.lookAt(CM.tg);

    // Dynamic adaptive cutaway for aircraft interior: user qaysi tomondan qarasa, o'sha tomondan o'rindiqlar to'siqsiz ko'rinadi
    if (activeMode === "flight") {
      updatePlaneVisibility();
    }

    renderer.render(scene, camera);
  }

  return {
    init: init,
    show: show,
    flyTo: flyTo,
    selectSeat: selectSeat,
    setOverviewMode: setOverviewMode
  };
})();
