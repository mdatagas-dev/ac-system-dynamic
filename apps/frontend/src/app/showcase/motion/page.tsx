"use client";

/**
 * VM3 Motion + Spatial Showcase.
 * Demonstrasi: presets enter/exit, stagger, depth surface, respons dinamis.
 */
import { useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import {
  fade,
  slideUp,
  scaleSmall,
  container,
  listItem,
  slideDown,
} from "@/design-system/motion/presets";
import { Surface } from "@/design-system/spatial/Surface";
import { depthLevels, type DepthLevel } from "@/design-system/spatial/depth";
import { useVm3ReducedMotion, withReducedMotion } from "@/hooks/useVm3ReducedMotion";

function Demo({
  label,
  preset,
  children,
}: {
  label: string;
  preset: typeof fade;
  children: React.ReactNode;
}) {
  const [show, setShow] = useState(true);
  const reduced = useVm3ReducedMotion();
  return (
    <div className="rounded-lg border border-outline-variant p-4">
      <div className="mb-3 flex items-center justify-between">
        <span className="font-medium">{label}</span>
        <button
          onClick={() => setShow((s) => !s)}
          className="rounded bg-primary px-3 py-1 text-sm text-on-primary"
        >
          {show ? "Keluar" : "Masuk"}
        </button>
      </div>
      <AnimatePresence mode="wait">
        {show && (
          <motion.div
            key="demo"
            variants={withReducedMotion(preset, reduced)}
            initial="initial"
            animate="animate"
            exit="exit"
            className="flex h-24 items-center justify-center rounded bg-secondary-container"
          >
            {children}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default function MotionShowcase() {
  const [items, setItems] = useState([1, 2, 3, 4, 5]);
  const reduced = useVm3ReducedMotion();

  return (
    <main className="mx-auto max-w-5xl p-6">
      <h1 className="mb-2 text-4xl font-bold">VM3 Motion + Spatial</h1>
      <p className="mb-10 text-on-surface-variant">
        Presets menjawab: dari mana? ke mana? apa yang berubah? Reduced motion
        otomatis dinonaktifkan.
      </p>

      <section className="mb-12">
        <h2 className="mb-4 text-2xl font-semibold">Motion Presets</h2>
        <div className="grid gap-4 md:grid-cols-2">
          <Demo label="fade" preset={fade}>fade</Demo>
          <Demo label="slideUp" preset={slideUp}>slideUp</Demo>
          <Demo label="slideDown" preset={slideDown}>slideDown</Demo>
          <Demo label="scaleSmall" preset={scaleSmall}>scaleSmall</Demo>
        </div>
      </section>

      <section className="mb-12">
        <h2 className="mb-4 text-2xl font-semibold">Stagger List</h2>
        <div className="mb-4 flex gap-2">
          <button
            onClick={() => setItems((v) => [...v, v.length + 1])}
            className="rounded bg-primary px-3 py-1 text-sm text-on-primary"
          >
            + Tambah
          </button>
          <button
            onClick={() => setItems((v) => v.slice(0, -1))}
            className="rounded bg-surface-container-high px-3 py-1 text-sm"
          >
            − Hapus
          </button>
        </div>
        <motion.ul
          variants={withReducedMotion(container(0.06), reduced)}
          initial="hidden"
          animate="show"
          className="space-y-2"
        >
          <AnimatePresence>
            {items.map((n) => (
              <motion.li
                key={n}
                variants={withReducedMotion(listItem, reduced)}
                layout
                exit={{ opacity: 0, y: -8, transition: { duration: 0.15 } }}
                className="rounded bg-surface-container p-3"
              >
                Item #{n}
              </motion.li>
            ))}
          </AnimatePresence>
        </motion.ul>
      </section>

      <section>
        <h2 className="mb-4 text-2xl font-semibold">Spatial Depth — Surface</h2>
        <p className="mb-6 text-on-surface-variant">
          Base → Raised → Floating → Overlay → Modal. Kartu interaktif naik saat
          hover, turun saat ditekan.
        </p>
        <div className="grid grid-cols-2 gap-6 md:grid-cols-5">
          {depthLevels.map((level) => (
            <Surface key={level} depth={level} className="p-4 text-center">
              <div className="font-medium">{level}</div>
              <div className="mt-1 text-xs text-on-surface-variant">elevation {depthElevation(level)}</div>
            </Surface>
          ))}
        </div>
        <div className="mt-10">
          <Surface depth="floating" interactive className="p-6">
            <div className="font-medium">Interactive Surface — hover &amp; press</div>
            <div className="mt-1 text-sm text-on-surface-variant">
              Hover menaikkan satu level kedalaman, tekan menurunkannya. Transisi
              elevasi pakai motion token.
            </div>
          </Surface>
        </div>
      </section>
    </main>
  );
}

function depthElevation(level: DepthLevel): string {
  switch (level) {
    case "base": return "0";
    case "raised": return "1";
    case "floating": return "3";
    case "overlay": return "4";
    case "modal": return "5";
  }
}
