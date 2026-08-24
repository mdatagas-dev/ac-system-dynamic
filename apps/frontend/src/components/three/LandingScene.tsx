"use client";

/**
 * LandingScene "Data Flow" — metafora produk AC System:
 * partikel unit mengalir kiri→kanan melewati scan-gate, lalu bar UPH naik di kanan.
 * Warna 100% dari token VM3 (--vm3-color-primary), aman di light & dark.
 * 1 instanced mesh partikel + 1 instanced mesh bar, tanpa shadow/asset — murah digambar.
 * Posisi partikel analitik dari waktu (tanpa mutasi state) — ramah React Compiler.
 */
import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import type { InstancedMesh, Mesh } from "three";
import { Object3D } from "three";
import { SceneCanvas } from "./SceneCanvas";
import { useVm3ColorVar, usePointerTarget } from "./vm3-scene";

const PARTICLE_COUNT = 900;
const BAR_COUNT = 12;

const dummy = new Object3D();

/** PRNG deterministik — murni, aman dipanggil saat render. */
function mulberry32(seed: number): () => number {
  let s = seed | 0;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Aliran partikel unit — wrap horizontal analitik, bob vertikal sinus. */
function ParticleStream({ color }: { color: string }) {
  const meshRef = useRef<InstancedMesh>(null);

  const seeds = useMemo(() => {
    const rand = mulberry32(20260823);
    return Array.from({ length: PARTICLE_COUNT }, (_, i) => ({
      x0: rand() * 14 - 7,
      y: rand() * 3 - 1.5,
      z: rand() * 3 - 1.8,
      speed: 0.35 + rand() * 0.6,
      phase: rand() * Math.PI * 2,
      amp: 0.05 + rand() * 0.15,
      scale: 0.6 + ((i * 37) % 10) / 12,
    }));
  }, []);

  useFrame((state) => {
    const mesh = meshRef.current;
    if (!mesh) return;
    const t = state.clock.elapsedTime;
    for (let i = 0; i < PARTICLE_COUNT; i++) {
      const s = seeds[i];
      const x = ((((s.x0 + s.speed * t) % 14) + 14) % 14) - 7;
      dummy.position.set(x, s.y + Math.sin(t * 1.2 + s.phase) * s.amp, s.z);
      dummy.scale.setScalar(s.scale);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
    }
    mesh.instanceMatrix.needsUpdate = true;
  });

  return (
    <instancedMesh ref={meshRef} args={[undefined, undefined, PARTICLE_COUNT]} frustumCulled={false}>
      <sphereGeometry args={[0.032, 6, 4]} />
      <meshBasicMaterial color={color} transparent opacity={0.85} />
    </instancedMesh>
  );
}

/** Scan-gate: dua ring wireframe berputar pelan — unit "discan" saat lewat. */
function ScanGate({ color }: { color: string }) {
  const ringA = useRef<Mesh>(null);
  const ringB = useRef<Mesh>(null);

  useFrame((state) => {
    const t = state.clock.elapsedTime;
    if (ringA.current) ringA.current.rotation.z = t * 0.5;
    if (ringB.current) ringB.current.rotation.z = -t * 0.3;
  });

  return (
    <group position={[0, 0, 0]} rotation={[0, Math.PI / 2 - 0.32, 0]}>
      <mesh ref={ringA}>
        <torusGeometry args={[1.15, 0.02, 8, 64]} />
        <meshBasicMaterial color={color} transparent opacity={0.9} />
      </mesh>
      <mesh ref={ringB}>
        <torusGeometry args={[0.82, 0.012, 8, 48]} />
        <meshBasicMaterial color={color} transparent opacity={0.45} />
      </mesh>
    </group>
  );
}

/** Bar UPH naik-turun, cluster di-anchor ke tepi kanan viewport — responsif, tak pernah terpotong. */
function UphBars({ color }: { color: string }) {
  const meshRef = useRef<InstancedMesh>(null);

  useFrame((state) => {
    const mesh = meshRef.current;
    if (!mesh) return;
    const t = state.clock.elapsedTime;
    const rightX = state.viewport.width / 2 - 0.45;
    for (let i = 0; i < BAR_COUNT; i++) {
      const h = 0.35 + Math.abs(Math.sin(t * 0.8 + i * 0.55)) * 1.7;
      dummy.position.set(rightX - (BAR_COUNT - 1 - i) * 0.22, -1.55 + h / 2, 0);
      dummy.scale.set(1, h, 1);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
    }
    mesh.instanceMatrix.needsUpdate = true;
  });

  return (
    <instancedMesh ref={meshRef} args={[undefined, undefined, BAR_COUNT]} frustumCulled={false}>
      <boxGeometry args={[0.16, 1, 0.16]} />
      <meshBasicMaterial color={color} transparent opacity={0.55} />
    </instancedMesh>
  );
}

/** Kamera drift lambat + parallax pointer halus. */
function CameraRig() {
  const pointer = usePointerTarget();

  useFrame((state, delta) => {
    const cam = state.camera;
    const t = state.clock.elapsedTime;
    const k = Math.min(1, delta * 2.5);
    const targetX = Math.sin(t * 0.07) * 0.3 + pointer.current.x * 0.35;
    const targetY = 0.35 + Math.cos(t * 0.05) * 0.12 + pointer.current.y * 0.22;
    cam.position.x += (targetX - cam.position.x) * k;
    cam.position.y += (targetY - cam.position.y) * k;
    cam.lookAt(0.5, -0.1, 0);
  });

  return null;
}

export default function LandingScene() {
  const primary = useVm3ColorVar("--vm3-color-primary", "#495d92");

  return (
    <SceneCanvas cameraPosition={[0, 0.35, 7]} fov={44}>
      <ParticleStream color={primary} />
      <ScanGate color={primary} />
      <UphBars color={primary} />
      <CameraRig />
    </SceneCanvas>
  );
}
