import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { ConvexGeometry } from 'three/examples/jsm/geometries/ConvexGeometry.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';

type Props = { moving?: boolean; reducedMotion?: boolean };
type P = [number, number, number];

/** Convex hull of a point cloud -> crisp faceted armor panel. */
const hull = (pts: P[]) => new ConvexGeometry(pts.map(([x, y, z]) => new THREE.Vector3(x, y, z)));
/** Give only z>0 points; returns the left/right symmetric cloud. */
const mirror = (pts: P[]): P[] =>
  pts.flatMap(([x, y, z]) => (z === 0 ? [[x, y, z] as P] : [[x, y, z] as P, [x, y, -z] as P]));
const side = (pts: P[], s: number): P[] => pts.map(([x, y, z]) => [x, y, z * s] as P);

export default function VehicleScene({ moving = false, reducedMotion = false }: Props) {
  const host = useRef<HTMLDivElement>(null);
  const motion = useRef({ moving, reducedMotion });
  useEffect(() => { motion.current = { moving, reducedMotion }; }, [moving, reducedMotion]);

  useEffect(() => {
    const root = host.current;
    if (!root) return;
    let renderer: THREE.WebGLRenderer;
    try { renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true, powerPreference: 'low-power' }); }
    catch { root.classList.add('webgl-unavailable'); return; }

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(32, 1, 0.1, 60);
    camera.position.set(5.2, 2.5, 6.4); camera.lookAt(0, 0.62, 0);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.7));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.12;
    renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.setClearColor(0x000000, 0); renderer.domElement.setAttribute('aria-hidden', 'true'); root.appendChild(renderer.domElement);

    // Environment reflections (makes metal and clearcoat read as real).
    const pmrem = new THREE.PMREMGenerator(renderer);
    const envMap = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    scene.environment = envMap;

    // Lights
    scene.add(new THREE.HemisphereLight(0xb8d4ee, 0x0a1118, 0.8));
    scene.add(new THREE.AmbientLight(0x7f98b0, 0.2));
    const key = new THREE.DirectionalLight(0xdcecff, 3.0); key.position.set(-4, 7, 5); key.castShadow = true;
    key.shadow.mapSize.set(1024, 1024); key.shadow.camera.left = -4.5; key.shadow.camera.right = 4.5; key.shadow.camera.top = 4.5; key.shadow.camera.bottom = -4.5; key.shadow.bias = -0.0003; key.shadow.camera.updateProjectionMatrix(); scene.add(key);
    const rim = new THREE.PointLight(0x168bff, 20, 9); rim.position.set(2.5, 1.9, -3); scene.add(rim);
    const cyan = new THREE.PointLight(0x42c9ff, 14, 7); cyan.position.set(-3.2, 2.0, 3.8); scene.add(cyan);
    const frontFill = new THREE.PointLight(0xd4e8f8, 9, 8); frontFill.position.set(4.5, 3.0, 6); scene.add(frontFill);
    const underGlow = new THREE.PointLight(0x2aa8ff, 6, 3.4); underGlow.position.set(0, 0.16, 0); scene.add(underGlow);

    // Floor
    const floor = new THREE.Mesh(new THREE.CircleGeometry(3.0, 64), new THREE.MeshBasicMaterial({ color: 0x168bff, transparent: true, opacity: 0.04, side: THREE.DoubleSide }));
    floor.rotation.x = -Math.PI / 2; floor.position.y = -0.025; scene.add(floor);
    const glowDisc = new THREE.Mesh(new THREE.CircleGeometry(1.9, 48), new THREE.MeshBasicMaterial({ color: 0x1a8cff, transparent: true, opacity: 0.13, blending: THREE.AdditiveBlending, depthWrite: false }));
    glowDisc.rotation.x = -Math.PI / 2; glowDisc.position.y = 0.004; scene.add(glowDisc);
    const shadowFloor = new THREE.Mesh(new THREE.PlaneGeometry(20, 20), new THREE.ShadowMaterial({ color: 0x02060b, opacity: 0.55 }));
    shadowFloor.rotation.x = -Math.PI / 2; shadowFloor.position.y = -0.01; shadowFloor.receiveShadow = true; scene.add(shadowFloor);

    const vehicle = new THREE.Group(); scene.add(vehicle);
    const suspension = new THREE.Group(); vehicle.add(suspension);

    // ---- Materials ----
    const paint = (color: number, rough = 0.3) =>
      new THREE.MeshPhysicalMaterial({ color, metalness: 0.8, roughness: rough, clearcoat: 1, clearcoatRoughness: 0.08, envMapIntensity: 1.2 });
    const metal = (color: number, metalness: number, roughness: number, env = 1, extra: THREE.MeshStandardMaterialParameters = {}) =>
      new THREE.MeshStandardMaterial({ color, metalness, roughness, envMapIntensity: env, ...extra });
    const body     = paint(0x0b0e12, 0.20);
    const bodyDark = paint(0x050709, 0.24);                // darker armor
    const carbon = metal(0x07090c, 0.35, 0.42, 0.8);       // carbon / matte black parts
    const gunmetal = metal(0x56606b, 1, 0.3, 1.2);         // trim, pillars, brake discs
    const darkChrome = metal(0x05080c, 1, 0.12, 1.6);
    const glass = metal(0x010306, 0.95, 0.04, 1.6, { emissive: 0x03101a, emissiveIntensity: 0.8 });
    const rubber = metal(0x06080b, 0.1, 0.9, 0.25, { side: THREE.DoubleSide });
    const cyanMat = new THREE.MeshStandardMaterial({ color: 0x8be6ff, emissive: 0x1a9bff, emissiveIntensity: 2.8, metalness: 0.2, roughness: 0.25 });
    const redMat = new THREE.MeshStandardMaterial({ color: 0x7f2330, emissive: 0xe84c59, emissiveIntensity: 1.6 });
    const hubMat = metal(0x0a1018, 1, 0.15, 1.4, { emissive: 0x0a4a9a, emissiveIntensity: 0.7 });
    const edgeMat = new THREE.LineBasicMaterial({ color: 0x6a8299, transparent: true, opacity: 0.22 });

    const add = (geo: THREE.BufferGeometry, mat: THREE.Material, edges = false, cast = true) => {
      const mesh = new THREE.Mesh(geo, mat); mesh.castShadow = cast; mesh.receiveShadow = true; suspension.add(mesh);
      if (edges) mesh.add(new THREE.LineSegments(new THREE.EdgesGeometry(geo, 18), edgeMat));
      return mesh;
    };
    const box = (w: number, h: number, d: number, mat: THREE.Material, x: number, y: number, z: number, rx = 0, ry = 0, rz = 0) => {
      const m = add(new THREE.BoxGeometry(w, h, d), mat, false, false); m.position.set(x, y, z); m.rotation.set(rx, ry, rz); return m;
    };
    const strut = (a: P, b: P, r: number, mat: THREE.Material) => {
      const va = new THREE.Vector3(...a); const vb = new THREE.Vector3(...b);
      const m = add(new THREE.CylinderGeometry(r, r, va.distanceTo(vb), 6), mat, false, false);
      m.position.copy(va).add(vb).multiplyScalar(0.5);
      m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), vb.clone().sub(va).normalize());
      return m;
    };

    // ---- Chassis & main tub (car faces +X) ----
    add(hull(mirror([[-1.5, 0.26, 0.6], [1.5, 0.26, 0.6], [1.5, 0.5, 0.5], [-1.5, 0.5, 0.5]])), carbon);
    add(hull(mirror([
      [-1.55, 0.36, 0.58], [-1.55, 0.8, 0.5], [-0.6, 0.92, 0.68], [0.6, 0.9, 0.68], [1.1, 0.78, 0.58],
      [1.6, 0.5, 0.38], [1.6, 0.4, 0.36], [0.4, 0.34, 0.66], [-1.0, 0.34, 0.64],
    ])), body, true);

    // Long hood plate with panel gap + vents
    add(hull(mirror([[0.55, 0.935, 0.34], [1.1, 0.81, 0.3], [1.55, 0.56, 0.22], [0.55, 0.87, 0.34], [1.1, 0.74, 0.3], [1.55, 0.5, 0.22]])), bodyDark, true);
    for (const z of [-0.14, 0.14]) box(0.38, 0.012, 0.045, carbon, 0.95, 0.865, z, 0, 0, -0.24);

    // Canopy: low fighter-style glass, dark roof, gunmetal frame
    add(hull(mirror([[-0.95, 0.93, 0.5], [-0.5, 1.2, 0.3], [0.2, 1.24, 0.3], [0.8, 0.87, 0.5]])), glass);
    add(hull(mirror([[-0.5, 1.195, 0.31], [0.21, 1.235, 0.31], [-0.4, 1.265, 0.24], [0.12, 1.285, 0.24]])), bodyDark, true);
    box(0.26, 0.03, 0.14, carbon, -0.2, 1.292, 0);
    for (const s of [-1, 1]) {
      strut([0.8, 0.87, 0.5 * s], [0.2, 1.24, 0.3 * s], 0.02, gunmetal);
      strut([-0.95, 0.93, 0.5 * s], [-0.5, 1.2, 0.3 * s], 0.026, gunmetal);
      strut([-0.5, 1.2, 0.3 * s], [0.2, 1.24, 0.3 * s], 0.014, gunmetal);
      strut([-0.95, 0.93, 0.5 * s], [0.8, 0.87, 0.5 * s], 0.014, gunmetal);
      strut([-0.15, 1.22, 0.3 * s], [0.1, 0.9, 0.5 * s], 0.01, gunmetal);
      // wing mirrors
      strut([0.5, 0.95, 0.56 * s], [0.5, 1.0, 0.72 * s], 0.012, carbon);
      box(0.13, 0.05, 0.09, bodyDark, 0.5, 1.01, 0.75 * s);
    }
    strut([0.2, 1.24, 0.3], [0.2, 1.24, -0.3], 0.014, gunmetal);
    strut([-0.5, 1.2, 0.3], [-0.5, 1.2, -0.3], 0.014, gunmetal);

    // Tail fins (Batmobile signature) + diffuser
    add(hull(mirror([[-1.45, 0.84, 0.3], [-1.45, 0.84, 0.34], [-1.65, 1.22, 0.3], [-1.65, 1.22, 0.34], [-0.95, 0.94, 0.3], [-0.95, 0.94, 0.34]])), bodyDark, true);
    add(hull(mirror([[-1.5, 0.3, 0.5], [-1.78, 0.28, 0.4], [-1.78, 0.34, 0.38], [-1.5, 0.4, 0.52]])), carbon);

    // Nose: splitter blade, canards, dark intake slits
    add(hull(mirror([[1.35, 0.32, 0.85], [1.82, 0.32, 0.55], [1.82, 0.37, 0.5], [1.35, 0.39, 0.85]])), carbon);
    add(hull(mirror([[1.45, 0.4, 0.96], [1.62, 0.42, 1.04], [1.62, 0.46, 1.0], [1.45, 0.48, 0.94]])), carbon);
    box(0.05, 0.1, 0.56, carbon, 1.605, 0.46, 0);
    for (let i = -2; i <= 2; i++) box(0.02, 0.07, 0.012, gunmetal, 1.63, 0.46, i * 0.1);

    // Fender pods: sharp low front, flared heavy rear
    const frontFender: P[] = [
      [0.35, 0.78, 0.6], [0.35, 0.78, 1.06], [0.45, 1.06, 0.7], [0.45, 1.06, 1.0],
      [1.25, 0.9, 0.66], [1.3, 0.86, 0.98], [1.62, 0.62, 0.62], [1.5, 0.6, 0.94],
    ];
    const rearFender: P[] = [
      [-1.6, 0.74, 0.6], [-1.6, 0.74, 1.06], [-1.5, 1.08, 0.68], [-1.45, 1.1, 1.0],
      [-0.5, 1.12, 0.72], [-0.5, 1.1, 1.02], [-0.35, 0.78, 0.6], [-0.35, 0.78, 1.06],
    ];
    for (const s of [-1, 1]) {
      add(hull(side(frontFender, s)), body, true);
      add(hull(side(rearFender, s)), bodyDark, true);

      // Side skirt, intake + gill slits, subtle LED lines
      box(1.2, 0.12, 0.06, carbon, 0, 0.42, s * 0.68);
      box(0.5, 0.17, 0.04, carbon, -0.28, 0.66, s * 0.7);
      for (let i = 0; i < 4; i++) box(0.012, 0.15, 0.045, gunmetal, -0.46 + i * 0.1, 0.66, s * 0.705);
      box(0.9, 0.012, 0.012, gunmetal, 0.05, 0.52, s * 0.715);
      box(0.5, 0.016, 0.016, cyanMat, -0.15, 0.36, s * 0.7);

      // Slim headlight blades
      box(0.03, 0.035, 0.3, cyanMat, 1.61, 0.46, s * 0.24);
      box(0.5, 0.03, 0.03, cyanMat, 1.05, 0.8, s * 0.995, 0, 0, -0.2);

      // Suspension arms
      for (const x of [-1.0, 1.0]) {
        strut([x, 0.5, s * 0.55], [x, 0.46, s * 0.72], 0.03, carbon);
        strut([x, 0.64, s * 0.55], [x, 0.52, s * 0.74], 0.022, carbon);
      }
    }

    // Rear: twin turbines + slim light bar
    box(0.02, 0.03, 1.0, redMat, -1.56, 0.78, 0);
    for (const z of [-0.22, 0.22]) {
      const ring = new THREE.Mesh(new THREE.TorusGeometry(0.13, 0.025, 8, 28), darkChrome); ring.rotation.y = Math.PI / 2; ring.position.set(-1.57, 0.6, z); suspension.add(ring);
      const core = new THREE.Mesh(new THREE.CylinderGeometry(0.115, 0.115, 0.02, 24), cyanMat); core.rotation.z = Math.PI / 2; core.position.set(-1.55, 0.6, z); suspension.add(core);
    }

    // ---- Wheels: lathe tire, multi-spoke dark rim, brake disc, fixed caliper ----
    const tireProfile = ([[0.3, -0.15], [0.38, -0.17], [0.44, -0.158], [0.458, -0.1], [0.462, 0], [0.458, 0.1], [0.44, 0.158], [0.38, 0.17], [0.3, 0.15]] as [number, number][])
      .map(([r, y]) => new THREE.Vector2(r, y));
    const wheels: THREE.Group[] = [];
    for (const x of [-1.0, 1.0]) for (const z of [-0.85, 0.85]) {
      const s = Math.sign(z);
      const wheel = new THREE.Group(); wheel.position.set(x, 0.46, z); suspension.add(wheel); wheels.push(wheel);
      const part = (geo: THREE.BufferGeometry, mat: THREE.Material, cast = false) => { const m = new THREE.Mesh(geo, mat); m.castShadow = cast; wheel.add(m); return m; };
      const axisZ = (m: THREE.Mesh) => { m.rotation.x = Math.PI / 2; return m; };

      axisZ(part(new THREE.LatheGeometry(tireProfile, 40), rubber, true));
      axisZ(part(new THREE.CylinderGeometry(0.31, 0.31, 0.3, 32), darkChrome));
      const disc = axisZ(part(new THREE.CylinderGeometry(0.26, 0.26, 0.025, 32), gunmetal)); disc.position.z = s * 0.07;
      const lip = part(new THREE.TorusGeometry(0.315, 0.022, 8, 40), gunmetal); lip.position.z = s * 0.15;
      const glow = part(new THREE.TorusGeometry(0.28, 0.006, 6, 40), cyanMat); glow.position.z = s * 0.152;
      for (let i = 0; i < 10; i++) {
        const a = (Math.PI * 2 * i) / 10;
        const spoke = part(new THREE.BoxGeometry(0.22, 0.032, 0.02), darkChrome);
        spoke.position.set(Math.cos(a) * 0.18, Math.sin(a) * 0.18, s * 0.152); spoke.rotation.z = a + 0.25;
      }
      const hex = axisZ(part(new THREE.CylinderGeometry(0.07, 0.07, 0.03, 6), hubMat)); hex.position.z = s * 0.158;
      for (let i = 0; i < 24; i++) {
        const a = (Math.PI * 2 * i) / 24;
        const tread = part(new THREE.BoxGeometry(0.02, 0.12, 0.2), rubber);
        tread.position.set(Math.cos(a) * 0.462, Math.sin(a) * 0.462, 0); tread.rotation.z = a;
      }
      box(0.16, 0.1, 0.07, cyanMat, x, 0.46 + 0.2, z + s * 0.05);   // brake caliper (does not spin)
    }

    // ---- Resize / interaction / loop ----
    let width = 0; let height = 0;
    const resize = () => { const bounds = root.getBoundingClientRect(); width = Math.max(bounds.width, 1); height = Math.max(bounds.height, 1); camera.aspect = width / height; camera.updateProjectionMatrix(); renderer.setSize(width, height, false); };
    const observer = new ResizeObserver(resize); observer.observe(root); resize();
    const pointer = { x: 0, targetX: 0, down: false, lastX: 0 };
    const onPointer = (event: PointerEvent) => { const b = root.getBoundingClientRect(); if (pointer.down) { vehicle.rotation.y += (event.clientX - pointer.lastX) * 0.006; pointer.lastX = event.clientX; } else pointer.targetX = ((event.clientX - b.left) / b.width - 0.5) * 0.12; };
    const onPointerDown = (event: PointerEvent) => { pointer.down = true; pointer.lastX = event.clientX; root.setPointerCapture(event.pointerId); };
    const onPointerUp = () => { pointer.down = false; };
    root.addEventListener('pointermove', onPointer); root.addEventListener('pointerdown', onPointerDown); root.addEventListener('pointerup', onPointerUp); root.addEventListener('pointercancel', onPointerUp);
    let frame = 0; const clock = new THREE.Clock();
    const animate = () => {
      frame = requestAnimationFrame(animate);
      const elapsed = clock.getElapsedTime(); const { moving: isMoving, reducedMotion: reduce } = motion.current;
      const factor = reduce ? 0 : 1;
      vehicle.rotation.y = elapsed * 0.13 * factor;
      pointer.x += (pointer.targetX - pointer.x) * 0.035;
      vehicle.rotation.y += pointer.x * factor;
      suspension.position.y = 0.02 + Math.sin(elapsed * 1.45) * 0.014 * factor;
      suspension.rotation.z = Math.sin(elapsed * 0.8) * 0.004 * factor;
      cyanMat.emissiveIntensity = 2.6 + Math.sin(elapsed * 2.2) * 0.3 * factor;
      if (isMoving || pointer.down) for (const wheel of wheels) wheel.rotation.z -= isMoving ? 0.11 : 0.055;
      renderer.render(scene, camera);
    };
    animate();

    return () => {
      cancelAnimationFrame(frame); observer.disconnect();
      root.removeEventListener('pointermove', onPointer); root.removeEventListener('pointerdown', onPointerDown); root.removeEventListener('pointerup', onPointerUp); root.removeEventListener('pointercancel', onPointerUp);
      scene.traverse(node => {
        if (node instanceof THREE.Mesh || node instanceof THREE.LineSegments) {
          node.geometry.dispose();
          const material = node.material as THREE.Material | THREE.Material[];
          if (Array.isArray(material)) material.forEach(item => item.dispose()); else material.dispose();
        }
      });
      envMap.dispose(); pmrem.dispose(); renderer.dispose(); renderer.domElement.remove();
    };
  }, []);

  return <div className="vehicle-scene" ref={host} aria-label="Animated three-dimensional robotic rover" role="img"><div className="scene-fallback"><span>3D VIEW UNAVAILABLE</span><small>Enable WebGL to view the rover</small></div></div>;
}
