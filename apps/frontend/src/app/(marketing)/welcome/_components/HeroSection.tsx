"use client";

/**
 * HeroSection — headline outcome + CTA + canvas scene "Data Flow".
 * Scene dimuat client-only (WebGL), konten penting tetap HTML murni.
 */
import dynamic from "next/dynamic";
import Link from "next/link";
import { motion } from "motion/react";
import { container, listItem } from "@/design-system/motion/presets";
import { useVm3ReducedMotion, withReducedMotion } from "@/hooks/useVm3ReducedMotion";

const LandingScene = dynamic(() => import("@/components/three/LandingScene"), {
  ssr: false,
  loading: () => null,
});

export function HeroSection() {
  const reduced = useVm3ReducedMotion();
  const groupVariants = withReducedMotion(container(0.12, 0.1), reduced);
  const itemVariants = withReducedMotion(listItem, reduced);

  return (
    <section className="relative overflow-hidden">
      <div className="mx-auto grid max-w-6xl items-center gap-10 px-4 pb-16 pt-12 md:px-6 lg:grid-cols-[1.05fr_1fr] lg:pb-24 lg:pt-20">
        <motion.div variants={groupVariants} initial="hidden" animate="show">
          <motion.p variants={itemVariants} className="text-sm font-medium text-primary">
            Monitoring Produksi
          </motion.p>
          <motion.h1
            variants={itemVariants}
            className="mt-3 text-balance text-4xl font-medium leading-tight md:text-5xl"
          >
            Setiap unit terhitung. Setiap scan tercatat.
          </motion.h1>
          <motion.p
            variants={itemVariants}
            className="mt-4 max-w-md text-pretty text-base text-on-surface-variant md:text-lg"
          >
            Pantau UPH lini produksi secara real-time — dari scan PO sampai dashboard per
            subline, tanpa pencatatan manual.
          </motion.p>
          <motion.div variants={itemVariants} className="mt-8 flex flex-wrap items-center gap-x-5 gap-y-3">
            <Link
              href="/login"
              className="inline-flex h-12 items-center rounded-full bg-primary px-7 text-sm font-medium text-on-primary transition-colors hover:bg-primary/90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
            >
              Masuk ke Sistem
            </Link>
            <p className="flex items-center gap-2 text-sm text-on-surface-variant">
              <span className="material-symbols-rounded text-lg text-primary" aria-hidden>
                trending_up
              </span>
              <span className="tabular-nums">12 subline aktif · 8.4k unit/bulan</span>
            </p>
          </motion.div>
        </motion.div>

        {/* Panel scene — dekoratif, aria-hidden di dalam SceneCanvas */}
        <div className="relative h-64 overflow-hidden rounded-xl border border-outline-variant bg-surface-container-low sm:h-80 lg:h-[420px]">
          <LandingScene />
          <p className="pointer-events-none absolute bottom-3 left-4 z-10 text-xs font-medium text-on-surface-variant">
            scan → data → insight
          </p>
        </div>
      </div>
    </section>
  );
}
