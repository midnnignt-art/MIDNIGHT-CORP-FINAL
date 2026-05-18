import React, { useRef, useMemo, useEffect } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { BrandSelection } from '../pages/ConjunctionPortal';

interface SceneProps {
  selectedBrand: BrandSelection;
  hoveredBrand: BrandSelection;
  onSelect: (brand: BrandSelection) => void;
  onHover: (brand: BrandSelection) => void;
}

// ─── Responsive Orthographic Camera ───────────────────────────────────────
const ResponsiveCamera: React.FC<{ selectedBrand: BrandSelection }> = ({ selectedBrand }) => {
  const { camera, size } = useThree();

  // Configurar frustum y zoom inicial al cambiar tamaño
  useEffect(() => {
    if (!camera || !(camera as any).isOrthographicCamera) return;
    const orth = camera as THREE.OrthographicCamera;
    const aspect = size.width / size.height;
    orth.left   = -aspect * 5;
    orth.right  =  aspect * 5;
    orth.top    =  5;
    orth.bottom = -5;
    if (selectedBrand === null) {
      orth.zoom = Math.min(size.width, size.height) / 7.5;
      orth.position.set(0, 0, 10);
      orth.lookAt(0, 0, 0);
    }
    orth.updateProjectionMatrix();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [size.width, size.height]);

  // Animar zoom + posición al cambiar selectedBrand
  useEffect(() => {
    if (!camera || !(camera as any).isOrthographicCamera) return;
    const orth = camera as THREE.OrthographicCamera;
    const baseZoom = Math.min(size.width, size.height) / 7.5;
    const isSelected = selectedBrand !== null;

    let raf: number;
    const start = performance.now();
    const duration = 1800;
    const startZoom = orth.zoom;
    const targetZoom = isSelected ? baseZoom * 5 : baseZoom;
    const startX = orth.position.x;
    const targetX = selectedBrand === 'midnight' ? -2.6 : selectedBrand === 'solstice' ? 2.3 : 0;

    function step() {
      const elapsed = performance.now() - start;
      const tNorm = Math.min(1, elapsed / duration);
      // cubic-bezier(0.25, 1, 0.5, 1) ≈ easeOutQuart-ish
      const ease = 1 - Math.pow(1 - tNorm, 4);
      orth.zoom = startZoom + (targetZoom - startZoom) * ease;
      orth.position.x = startX + (targetX - startX) * ease;
      orth.position.y = 0;
      orth.position.z = 10;
      orth.lookAt(orth.position.x, 0, 0);
      orth.updateProjectionMatrix();
      if (tNorm < 1) raf = requestAnimationFrame(step);
    }
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [selectedBrand, camera, size.width, size.height]);

  return null;
};

// ─── Estrella central (axis gravitacional) ────────────────────────────────
const CentralStar: React.FC = () => {
  const ref = useRef<THREE.Mesh>(null!);
  const glowRef = useRef<THREE.Mesh>(null!);
  useFrame((state) => {
    const t = state.clock.elapsedTime;
    if (ref.current) {
      const s = 1 + Math.sin(t * 1.5) * 0.12;
      ref.current.scale.setScalar(s);
    }
    if (glowRef.current) {
      const op = 0.35 + Math.sin(t * 1.5) * 0.10;
      (glowRef.current.material as THREE.MeshBasicMaterial).opacity = op;
    }
  });
  return (
    <group position={[0, 0, 0.5]}>
      <mesh ref={ref}>
        <sphereGeometry args={[0.10, 16, 16]} />
        <meshBasicMaterial color="#FFF8DC" />
      </mesh>
      <mesh ref={glowRef} scale={3}>
        <sphereGeometry args={[0.10, 16, 16]} />
        <meshBasicMaterial color="#FFE4B5" transparent opacity={0.35} blending={THREE.AdditiveBlending} depthWrite={false} />
      </mesh>
    </group>
  );
};

// ─── EL SOL (Solstice) — derecha, grande, ardiente con flares dinámicos ──
interface BodyProps {
  isSelected: boolean;
  isOtherActive: boolean;
  hovered: boolean;
  onClick: () => void;
  onHover: (h: boolean) => void;
}

const SolstaceSun: React.FC<BodyProps> = ({ isSelected, isOtherActive, hovered, onClick, onHover }) => {
  const groupRef   = useRef<THREE.Group>(null!);
  const coreRef    = useRef<THREE.Mesh>(null!);
  const coronaRef  = useRef<THREE.Mesh>(null!);
  const halo1Ref   = useRef<THREE.Mesh>(null!);
  const halo2Ref   = useRef<THREE.Mesh>(null!);
  const flaresRef  = useRef<THREE.Points>(null!);
  const flaresLongRef = useRef<THREE.Points>(null!);

  // Flares en órbita cercana (esfera)
  const flareData = useMemo(() => {
    const count = 200;
    const pos = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      const r = 1.50 + Math.random() * 0.28;
      const phi = Math.acos(2 * Math.random() - 1);
      const theta = Math.random() * Math.PI * 2;
      pos[i * 3]     = r * Math.sin(phi) * Math.cos(theta);
      pos[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
      pos[i * 3 + 2] = r * Math.cos(phi);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const m = new THREE.PointsMaterial({
      size: 0.045,
      sizeAttenuation: true,
      color: new THREE.Color('#FFB48C'),
      transparent: true,
      opacity: 0.9,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    return { geometry: g, material: m };
  }, []);

  // Flares lejanos elongados — efecto de tongues
  const flareLongData = useMemo(() => {
    const count = 80;
    const pos = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      const r = 1.9 + Math.random() * 0.8;
      const phi = Math.acos(2 * Math.random() - 1);
      const theta = Math.random() * Math.PI * 2;
      pos[i * 3]     = r * Math.sin(phi) * Math.cos(theta);
      pos[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
      pos[i * 3 + 2] = r * Math.cos(phi) * 0.4; // aplanado
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const m = new THREE.PointsMaterial({
      size: 0.08,
      sizeAttenuation: true,
      color: new THREE.Color('#FF7A00'),
      transparent: true,
      opacity: 0.6,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    return { geometry: g, material: m };
  }, []);

  useFrame((state) => {
    const t = state.clock.elapsedTime;

    // Magnetic scale — cubic-bezier(0.25, 1, 0.5, 1) feel
    // Target: 1.35 on hover, 0.85 si el otro está activo, 1.0 default
    if (groupRef.current) {
      const targetScale = isSelected ? 1.35 : hovered ? 1.35 : isOtherActive ? 0.85 : 1.0;
      const lerpFactor = 0.10;
      const current = groupRef.current.scale.x;
      const next = current + (targetScale - current) * lerpFactor;
      groupRef.current.scale.setScalar(next);
    }

    if (coreRef.current) {
      coreRef.current.rotation.y = t * 0.18;
      coreRef.current.rotation.x = t * 0.08;
      const mat = coreRef.current.material as THREE.MeshStandardMaterial;
      const intensity = isSelected || hovered ? 3.0 : isOtherActive ? 0.8 : 1.7;
      mat.emissiveIntensity = intensity + Math.sin(t * 1.5) * 0.18;
    }
    if (coronaRef.current) {
      const base = isSelected || hovered ? 0.50 : isOtherActive ? 0.12 : 0.28;
      (coronaRef.current.material as THREE.MeshBasicMaterial).opacity = base + Math.sin(t * 1.6) * 0.06;
      coronaRef.current.rotation.z = t * 0.05;
    }
    if (halo1Ref.current) {
      (halo1Ref.current.material as THREE.MeshBasicMaterial).opacity =
        isSelected || hovered ? 0.20 : isOtherActive ? 0.04 : 0.10;
    }
    if (halo2Ref.current) {
      (halo2Ref.current.material as THREE.MeshBasicMaterial).opacity =
        isSelected || hovered ? 0.12 : isOtherActive ? 0.02 : 0.05;
    }
    if (flaresRef.current) {
      flaresRef.current.rotation.y = t * 0.22;
      flaresRef.current.rotation.x = Math.sin(t * 0.3) * 0.12;
      (flaresRef.current.material as THREE.PointsMaterial).opacity =
        isSelected || hovered ? 1.0 : isOtherActive ? 0.3 : 0.85;
    }
    if (flaresLongRef.current) {
      flaresLongRef.current.rotation.z = t * 0.12;
      flaresLongRef.current.rotation.y = -t * 0.08;
      (flaresLongRef.current.material as THREE.PointsMaterial).opacity =
        isSelected || hovered ? 0.85 : isOtherActive ? 0.15 : 0.55;
    }
  });

  return (
    <group ref={groupRef} position={[2.6, 0, 0]}>
      <mesh
        ref={coreRef}
        onClick={(e) => { e.stopPropagation(); onClick(); }}
        onPointerOver={(e) => { e.stopPropagation(); onHover(true); document.body.style.cursor = 'pointer'; }}
        onPointerOut={() => { onHover(false); document.body.style.cursor = 'auto'; }}
      >
        <sphereGeometry args={[1.30, 64, 64]} />
        <meshStandardMaterial
          color="#3a0a00"
          emissive="#E6392F"
          emissiveIntensity={1.7}
          roughness={0.42}
          metalness={0.05}
        />
      </mesh>
      <mesh ref={coronaRef} scale={1.75}>
        <sphereGeometry args={[1.30, 48, 48]} />
        <meshBasicMaterial color="#FF7A00" transparent opacity={0.32} side={THREE.BackSide} blending={THREE.AdditiveBlending} depthWrite={false} />
      </mesh>
      <mesh ref={halo1Ref} scale={2.6}>
        <sphereGeometry args={[1.30, 32, 32]} />
        <meshBasicMaterial color="#FFB48C" transparent opacity={0.12} side={THREE.BackSide} blending={THREE.AdditiveBlending} depthWrite={false} />
      </mesh>
      <mesh ref={halo2Ref} scale={4}>
        <sphereGeometry args={[1.30, 24, 24]} />
        <meshBasicMaterial color="#FFB48C" transparent opacity={0.05} side={THREE.BackSide} blending={THREE.AdditiveBlending} depthWrite={false} />
      </mesh>
      <points ref={flaresRef} geometry={flareData.geometry} material={flareData.material} />
      <points ref={flaresLongRef} geometry={flareLongData.geometry} material={flareLongData.material} />
    </group>
  );
};

// ─── LA LUNA (Midnight) — izquierda, pequeña, con cráteres ────────────────
const MidnightMoon: React.FC<BodyProps> = ({ isSelected, isOtherActive, hovered, onClick, onHover }) => {
  const groupRef   = useRef<THREE.Group>(null!);
  const moonRef    = useRef<THREE.Mesh>(null!);
  const haloRef    = useRef<THREE.Mesh>(null!);
  const haloFarRef = useRef<THREE.Mesh>(null!);

  // Cráteres pre-calculados (posiciones en superficie esférica)
  const craters = useMemo(() => {
    const list: Array<{ pos: [number, number, number]; size: number }> = [];
    const seed = [0.7, 1.4, 2.8, 3.6, 4.2, 5.1, 0.3, 2.0];
    for (let i = 0; i < 7; i++) {
      const theta = seed[i] * 1.13;
      const phi = (seed[(i + 3) % 8] || 1) * 0.7;
      const r = 0.55; // radio del moon
      const x = r * Math.sin(phi) * Math.cos(theta);
      const y = r * Math.sin(phi) * Math.sin(theta);
      const z = r * Math.cos(phi);
      const size = 0.07 + (i % 3) * 0.03;
      list.push({ pos: [x, y, z], size });
    }
    return list;
  }, []);

  useFrame((state) => {
    const t = state.clock.elapsedTime;

    if (groupRef.current) {
      const targetScale = isSelected ? 1.35 : hovered ? 1.35 : isOtherActive ? 0.85 : 1.0;
      const current = groupRef.current.scale.x;
      const next = current + (targetScale - current) * 0.10;
      groupRef.current.scale.setScalar(next);
    }

    if (moonRef.current) {
      // Rotación lenta — los craters giran con la luna porque son children
      const targetRotY = t * 0.12;
      moonRef.current.rotation.y = targetRotY;
      const mat = moonRef.current.material as THREE.MeshStandardMaterial;
      const intensity = isSelected || hovered ? 1.4 : isOtherActive ? 0.15 : 0.5;
      mat.emissiveIntensity = intensity + Math.sin(t * 0.9) * 0.08;
    }
    if (haloRef.current) {
      (haloRef.current.material as THREE.MeshBasicMaterial).opacity =
        isSelected || hovered ? 0.32 : isOtherActive ? 0.05 : 0.14;
    }
    if (haloFarRef.current) {
      (haloFarRef.current.material as THREE.MeshBasicMaterial).opacity =
        isSelected || hovered ? 0.12 : isOtherActive ? 0.02 : 0.04;
    }
  });

  return (
    <group ref={groupRef} position={[-2.8, 0, 0]}>
      {/* Cuerpo lunar — agrupa moon + craters para que roten juntos */}
      <group>
        <mesh
          ref={moonRef}
          onClick={(e) => { e.stopPropagation(); onClick(); }}
          onPointerOver={(e) => { e.stopPropagation(); onHover(true); document.body.style.cursor = 'pointer'; }}
          onPointerOut={() => { onHover(false); document.body.style.cursor = 'auto'; }}
        >
          <sphereGeometry args={[0.55, 64, 64]} />
          <meshStandardMaterial
            color="#1a0f2e"
            emissive="#490F7C"
            emissiveIntensity={0.5}
            roughness={0.92}
            metalness={0.10}
          />
          {/* Cráteres — pequeñas esferas oscuras incrustadas en la superficie */}
          {craters.map((c, i) => (
            <mesh key={i} position={c.pos}>
              <sphereGeometry args={[c.size, 16, 16]} />
              <meshStandardMaterial
                color="#0a0414"
                emissive="#1a0a2e"
                emissiveIntensity={0.2}
                roughness={1.0}
                metalness={0}
              />
            </mesh>
          ))}
        </mesh>
      </group>

      <mesh ref={haloRef} scale={1.55}>
        <sphereGeometry args={[0.55, 32, 32]} />
        <meshBasicMaterial color="#b026ff" transparent opacity={0.16} side={THREE.BackSide} blending={THREE.AdditiveBlending} depthWrite={false} />
      </mesh>
      <mesh ref={haloFarRef} scale={2.4}>
        <sphereGeometry args={[0.55, 24, 24]} />
        <meshBasicMaterial color="#490F7C" transparent opacity={0.05} side={THREE.BackSide} blending={THREE.AdditiveBlending} depthWrite={false} />
      </mesh>
    </group>
  );
};

// ─── Star field con depth ─────────────────────────────────────────────────
const StarField: React.FC = () => {
  const starsRef = useRef<THREE.Points>(null!);

  const data = useMemo(() => {
    const count = 1000;
    const pos = new Float32Array(count * 3);
    const colors = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      const r = 25 + Math.random() * 40;
      const phi = Math.acos(2 * Math.random() - 1);
      const theta = Math.random() * Math.PI * 2;
      pos[i * 3]     = r * Math.sin(phi) * Math.cos(theta);
      pos[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
      pos[i * 3 + 2] = r * Math.cos(phi) - 25;
      // Tint random: cream, purple, or amber
      const tint = Math.random();
      if (tint < 0.7) { colors[i*3] = 0.98; colors[i*3+1] = 0.95; colors[i*3+2] = 0.84; }
      else if (tint < 0.85) { colors[i*3] = 0.69; colors[i*3+1] = 0.15; colors[i*3+2] = 1.0; }
      else { colors[i*3] = 1.0; colors[i*3+1] = 0.70; colors[i*3+2] = 0.55; }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    const m = new THREE.PointsMaterial({
      size: 0.10,
      sizeAttenuation: true,
      vertexColors: true,
      transparent: true,
      opacity: 0.85,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    return { geometry: g, material: m };
  }, []);

  useFrame((state) => {
    if (starsRef.current) {
      starsRef.current.rotation.y = state.clock.elapsedTime * 0.005;
    }
  });

  return <points ref={starsRef} geometry={data.geometry} material={data.material} />;
};

// ─── Scene Root ────────────────────────────────────────────────────────────
export const ConjunctionScene: React.FC<SceneProps> = ({ selectedBrand, hoveredBrand, onSelect, onHover }) => {
  return (
    <Canvas
      orthographic
      camera={{ position: [0, 0, 10], zoom: 100, near: 0.1, far: 1000 }}
      style={{
        width: '100%', height: '100%',
        display: 'block', position: 'absolute', top: 0, left: 0,
      }}
      gl={{ antialias: true, alpha: true, toneMapping: THREE.ACESFilmicToneMapping, toneMappingExposure: 1.18 }}
      onCreated={({ gl }) => { gl.setClearColor(0x000000, 0); }}
    >
      <ambientLight intensity={0.10} />
      {/* El sol propio emite luz naranja que cae sobre la luna */}
      <pointLight position={[2.6, 0, 1]} intensity={2.2} color="#FF7A00" distance={14} decay={1.5} />
      {/* Rim light frío sobre el moon */}
      <directionalLight position={[-5, 3, 4]} intensity={0.35} color="#b026ff" />

      <ResponsiveCamera selectedBrand={selectedBrand} />

      <StarField />
      <CentralStar />

      <MidnightMoon
        isSelected={selectedBrand === 'midnight'}
        isOtherActive={hoveredBrand === 'solstice' || selectedBrand === 'solstice'}
        hovered={hoveredBrand === 'midnight' && !selectedBrand}
        onClick={() => onSelect('midnight')}
        onHover={(h) => onHover(h ? 'midnight' : null)}
      />

      <SolstaceSun
        isSelected={selectedBrand === 'solstice'}
        isOtherActive={hoveredBrand === 'midnight' || selectedBrand === 'midnight'}
        hovered={hoveredBrand === 'solstice' && !selectedBrand}
        onClick={() => onSelect('solstice')}
        onHover={(h) => onHover(h ? 'solstice' : null)}
      />
    </Canvas>
  );
};
