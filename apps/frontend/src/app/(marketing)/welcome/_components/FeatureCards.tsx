"use client";

/**
 * FeatureCards — 3 fitur inti dengan entrance stagger (preset VM3).
 */
import { motion } from "motion/react";
import { Card } from "@/components/vm3/Card";
import { container, listItem } from "@/design-system/motion/presets";
import { useVm3ReducedMotion, withReducedMotion } from "@/hooks/useVm3ReducedMotion";

const FEATURES = [
  {
    icon: "monitoring",
    title: "Real-time UPH",
    desc: "Unit per hour tiap subline ter-update otomatis begitu unit discan — tanpa rekap manual.",
  },
  {
    icon: "qr_code_scanner",
    title: "Scan PO",
    desc: "Satu gerakan scan memvalidasi PO, model, dan stasiun kerja langsung di lantai produksi.",
  },
  {
    icon: "database",
    title: "Master Data",
    desc: "Kelola line, subline, model, dan stasiun dalam satu tempat — konsisten untuk seluruh lini.",
  },
] as const;

export function FeatureCards() {
  const reduced = useVm3ReducedMotion();
  const groupVariants = withReducedMotion(container(0.1), reduced);
  const itemVariants = withReducedMotion(listItem, reduced);

  return (
    <section id="fitur" className="scroll-mt-24">
      <div className="mx-auto max-w-6xl px-4 py-16 md:px-6 md:py-24">
        <motion.div variants={groupVariants} initial="hidden" whileInView="show" viewport={{ once: true, margin: "-80px" }}>
          <motion.h2
            variants={itemVariants}
            className="text-balance text-3xl font-medium tracking-normal md:text-4xl"
          >
            Semua yang dibutuhkan lini produksi
          </motion.h2>
          <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 lg:gap-6">
            {FEATURES.map((f) => (
              <motion.div key={f.title} variants={itemVariants}>
                <Card variant="filled" className="h-full p-6">
                  <span
                    className="material-symbols-rounded flex size-12 items-center justify-center rounded-full bg-primary-container text-2xl text-on-primary-container"
                    aria-hidden
                  >
                    {f.icon}
                  </span>
                  <h3 className="mt-4 text-lg font-medium">{f.title}</h3>
                  <p className="mt-2 text-sm text-pretty text-on-surface-variant">{f.desc}</p>
                </Card>
              </motion.div>
            ))}
          </div>
        </motion.div>
      </div>
    </section>
  );
}
