"use client";

/**
 * Helper bersama untuk scene 3D VM3:
 * - useVm3ColorVar: baca token warna CSS (ikut berganti light ⇄ dark)
 * - usePointerTarget: posisi pointer ternormalisasi (-1..1) untuk parallax
 */
import { useEffect, useRef, useState } from "react";

/** Baca nilai CSS custom property token VM3, re-read saat tema berubah. */
export function useVm3ColorVar(cssVar: string, fallback: string): string {
  const [value, setValue] = useState(fallback);

  useEffect(() => {
    const read = () => {
      const v = getComputedStyle(document.documentElement)
        .getPropertyValue(cssVar)
        .trim();
      if (v) setValue(v);
    };
    read();
    const observer = new MutationObserver(read);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["data-theme"],
    });
    return () => observer.disconnect();
  }, [cssVar]);

  return value;
}

/** Ref ke posisi pointer ternormalisasi — tanpa re-render, dibaca di useFrame. */
export function usePointerTarget() {
  const ref = useRef({ x: 0, y: 0 });

  useEffect(() => {
    const onMove = (e: PointerEvent) => {
      ref.current.x = (e.clientX / window.innerWidth) * 2 - 1;
      ref.current.y = -((e.clientY / window.innerHeight) * 2 - 1);
    };
    window.addEventListener("pointermove", onMove, { passive: true });
    return () => window.removeEventListener("pointermove", onMove);
  }, []);

  return ref;
}
