"use client";

/**
 * FlowSteps — alur pakai dalam 3 langkah bernomor.
 */
import { motion } from "motion/react";
import { container, listItem } from "@/design-system/motion/presets";
import { useVm3ReducedMotion, withReducedMotion } from "@/hooks/useVm3ReducedMotion";

const STEPS = [
  {
    num: "01",
    title: "Registrasi",
    desc: "Daftarkan PO dan model ke sistem sekali di awal.",
  },
  {
    num: "02",
    title: "Scan",
    desc: "Operator scan barcode di tiap stasiun — data masuk real-time.",
  },
  {
    num: "03",
    title: "Monitor",
    desc: "Pantau UPH per subline dari dashboard, kapan pun.",
  },
] as const;

export function FlowSteps() {
  const reduced = useVm3ReducedMotion();
  const groupVariants = withReducedMotion(container(0.15), reduced);
  const itemVariants = withReducedMotion(listItem, reduced);

  return (
    <section id="alur" className="scroll-mt-24 border-y border-outline-variant bg-surface-container-lowest">
      <div className="mx-auto max-w-6xl px-4 py-16 md:px-6 md:py-24">
        <motion.div variants={groupVariants} initial="hidden" whileInView="show" viewport={{ once: true, margin: "-80px" }}>
          <motion.h2
            variants={itemVariants}
            className="text-balance text-3xl font-medium tracking-normal md:text-4xl"
          >
            Dari registrasi ke insight dalam 3 langkah
          </motion.h2>
          <ol className="mt-12 grid gap-8 sm:grid-cols-3 sm:gap-6">
            {STEPS.map((s, i) => (
              <motion.li key={s.num} variants={itemVariants} className="relative">
                <span
                  className="flex size-11 items-center justify-center rounded-full bg-primary-container text-sm font-medium tabular-nums text-on-primary-container"
                  aria-hidden
                >
                  {s.num}
                </span>
                <h3 className="mt-4 text-lg font-medium">{s.title}</h3>
                <p className="mt-2 max-w-xs text-sm text-pretty text-on-surface-variant">{s.desc}</p>
                {i < STEPS.length - 1 && (
                  <span
                    className="material-symbols-rounded absolute left-full top-0 hidden -translate-x-1 text-on-surface-variant/40 sm:block"
                    aria-hidden
                  >
                    arrow_forward
                  </span>
                )}
              </motion.li>
            ))}
          </ol>
        </motion.div>
      </div>
    </section>
  );
}
