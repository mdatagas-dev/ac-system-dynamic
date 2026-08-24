"use client";

/**
 * LoginScene — SpaceX-inspired cinematic background:
 * starfield pekat + horizon Earth glow + vignette.
 * Menggantikan es/box lama agar terasa seperti video hero SpaceX:
 * fullscreen, lambat, kontras tinggi, teks putih di atas hitam.
 * frameloop demand throttle 24fps + reduced-motion → statis.
 */
import { useMemo, useRef, useEffect } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { useReducedMotion } from "motion/react";
import { BufferGeometry, Float32BufferAttribute, Points, AdditiveBlending } from "three";
import { SceneCanvas } from "./SceneCanvas";
import { usePointerTarget } from "./vm3-scene";

/** PRNG deterministik — murni */
function mulberry32(seed: number): () => number {
  let s = seed | 0;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function DemandThrottle({ fps = 24 }: { fps?: number }) {
  const invalidate = useThree((s) => s.invalidate);
  const frameloop = useThree((s) => s.frameloop);
  const reduced = useReducedMotion();
  useEffect(() => {
    if (frameloop !== "demand" || reduced) return;
    const id = setInterval(() => invalidate(), 1000 / fps);
    return () => clearInterval(id);
  }, [frameloop, reduced, fps, invalidate]);
  return null;
}

/** Starfield SpaceX — 700 bintang, sebar kubus, kedip halus */
function StarField() {
  const pointsRef = useRef<Points>(null);
  const geo = useMemo(() => {
    const rand = mulberry32(0x53a11ce5);
    const count = 720;
    const pos = new Float32Array(count * 3);
    const op = new Float32Array(count);
    for (let i = 0; i < count; i++) {
      // sebar luas: x 16, y 9, z kedalaman 8 (di belakang horizon)
      pos[i * 3] = rand() * 18 - 9;
      pos[i * 3 + 1] = rand() * 10 - 2.5; // bias ke atas, horizon di bawah
      pos[i * 3 + 2] = rand() * -8 - 1.5;
      op[i] = 0.25 + rand() * 0.75;
    }
    const g = new BufferGeometry();
    g.setAttribute("position", new Float32BufferAttribute(pos, 3));
    g.setAttribute("alpha", new Float32BufferAttribute(op, 1));
    return g;
  }, []);

  useFrame(({ clock }) => {
    const p = pointsRef.current;
    if (!p) return;
    // slow drift — rotasi sangat lambat + twinkle via opacity mod
    p.rotation.y = clock.elapsedTime * 0.008;
    p.rotation.x = Math.sin(clock.elapsedTime * 0.03) * 0.015;
  });

  return (
    <points ref={pointsRef} geometry={geo} frustumCulled={false}>
      <pointsMaterial
        size={0.035}
        sizeAttenuation
        transparent
        opacity={0.9}
        blending={AdditiveBlending}
        depthWrite={false}
        color="#ffffff"
      />
    </points>
  );
}

/** Horizon Earth glow — lengkung biru samudra di bawah, seperti limb Bumi di video SpaceX */
function EarthHorizon() {
  return (
    <group position={[0, -4.2, -3.5]}>
      {/* halo besar */}
      <mesh>
        <circleGeometry args={[7.5, 64]} />
        {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
        <shaderMaterial
          transparent
          depthWrite={false}
          blending={AdditiveBlending}
          uniforms={{}}
          vertexShader={`varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }`}
          fragmentShader={`
            varying vec2 vUv;
            void main(){
              vec2 c = vUv - 0.5;
              float d = length(c);
              float rim = 1.0 - smoothstep(0.35, 0.5, d);
              float glow = 0.55 * pow(rim, 1.6);
              // biru SpaceX earth limb: campur cyan + deep blue
              vec3 col = mix(vec3(0.04,0.12,0.22), vec3(0.18,0.45,0.78), pow(rim,0.9));
              // vignette center lebih terang
              float center = 1.0 - smoothstep(0.0, 0.45, length(c*vec2(1.2,0.8)));
              gl_FragColor = vec4(col, glow * (0.7 + 0.3*center));
            }
          `}
        />
      </mesh>
      {/* core tipis terang */}
      <mesh position={[0, 0.15, 0.02]}>
        <ringGeometry args={[5.2, 5.45, 64]} />
        <meshBasicMaterial color="#7fb8ff" transparent opacity={0.22} depthWrite={false} blending={AdditiveBlending} />
      </mesh>
    </group>
  );
}

/** Vignette + flare halus */
function Vignette() {
  return (
    <mesh position={[0, 0, 2]}>
      <planeGeometry args={[18, 12]} />
      <shaderMaterial
        transparent
        depthWrite={false}
        uniforms={{}}
        vertexShader={`varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }`}
        fragmentShader={`
          varying vec2 vUv;
          void main(){
            vec2 uv = vUv;
            float v = 1.0 - smoothstep(0.35, 1.05, length((uv-0.5)*vec2(1.1,1.0)));
            float top = smoothstep(0.0, 0.55, uv.y);
            // vignette + sedikit gradasi atas lebih gelap
            gl_FragColor = vec4(0.0,0.0,0.0, (1.0 - v)*0.55 + (1.0-top)*0.12);
          }
        `}
      />
    </mesh>
  );
}

function GentleParallax() {
  const pointer = usePointerTarget();
  useFrame((state, delta) => {
    const cam = state.camera;
    const k = Math.min(1, delta * 1.35);
    cam.position.x += (pointer.current.x * 0.22 - cam.position.x) * k;
    cam.position.y += (pointer.current.y * 0.14 - cam.position.y) * k;
    cam.lookAt(0, 0, 0);
  });
  return null;
}

export default function LoginScene() {
  return (
    <SceneCanvas loop="demand" cameraPosition={[0, 0.4, 6.5]} fov={44}>
      <DemandThrottle fps={24} />
      <color attach="background" args={["#000000"]} />
      <StarField />
      <EarthHorizon />
      <Vignette />
      <GentleParallax />
    </SceneCanvas>
  );
}
