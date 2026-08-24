import type { Metadata } from "next";
import Link from "next/link";
import { HeroSection } from "./_components/HeroSection";
import { FeatureCards } from "./_components/FeatureCards";
import { FlowSteps } from "./_components/FlowSteps";

export const metadata: Metadata = {
  title: "Monitoring Produksi Real-Time",
  description:
    "Pantau UPH lini produksi secara real-time — dari scan PO sampai dashboard per subline, tanpa pencatatan manual.",
};

const PROOF = [
  { value: "8.4k", label: "unit tercatat / bulan" },
  { value: "99.9%", label: "akurasi hitung" },
  { value: "12", label: "subline aktif" },
  { value: "99.95%", label: "uptime sistem" },
] as const;

export default function WelcomePage() {
  return (
    <div className="min-h-dvh bg-surface text-on-surface">
      {/* Nav */}
      <header className="sticky top-0 z-20 border-b border-outline-variant bg-surface-container-lowest/80 backdrop-blur-sm">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 md:px-6">
          <Link href="/welcome" className="flex items-center gap-2 font-semibold">
            <span className="material-symbols-rounded text-2xl text-primary" aria-hidden>
              ac_unit
            </span>
            AC System
          </Link>
          <nav aria-label="Navigasi utama" className="hidden items-center gap-6 text-sm text-on-surface-variant md:flex">
            <a href="#fitur" className="transition-colors hover:text-on-surface">
              Fitur
            </a>
            <a href="#alur" className="transition-colors hover:text-on-surface">
              Alur
            </a>
          </nav>
          <Link
            href="/login"
            className="inline-flex h-10 items-center gap-1 rounded-full bg-primary px-5 text-sm font-medium text-on-primary transition-colors hover:bg-primary/90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
          >
            Masuk
            <span className="material-symbols-rounded text-base" aria-hidden>
              arrow_forward
            </span>
          </Link>
        </div>
      </header>

      <main id="konten-utama">
        <HeroSection />

        {/* Social proof */}
        <section aria-label="Angka sistem" className="border-y border-outline-variant bg-surface-container-low">
          <dl className="mx-auto grid max-w-6xl grid-cols-2 gap-x-6 gap-y-8 px-4 py-10 md:grid-cols-4 md:px-6">
            {PROOF.map((p) => (
              <div key={p.label} className="flex flex-col">
                <dd className="order-1 text-3xl font-medium tabular-nums">{p.value}</dd>
                <dt className="order-2 mt-1 text-sm text-on-surface-variant">{p.label}</dt>
              </div>
            ))}
          </dl>
        </section>

        <FeatureCards />
        <FlowSteps />

        {/* CTA akhir */}
        <section className="mx-auto max-w-6xl px-4 py-16 md:px-6 md:py-24">
          <div className="rounded-xl bg-primary-container px-6 py-12 text-center md:py-16">
            <h2 className="text-balance text-3xl font-medium text-on-primary-container md:text-4xl">
              Siap menghitung setiap unit?
            </h2>
            <p className="mx-auto mt-3 max-w-md text-pretty text-on-primary-container/80">
              Bergabung ke sistem dan lihat lini Anda terpantau dalam hitungan menit.
            </p>
            <Link
              href="/login"
              className="mt-8 inline-flex h-12 items-center rounded-full bg-primary px-7 text-sm font-medium text-on-primary transition-colors hover:bg-primary/90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
            >
              Masuk ke Sistem
            </Link>
          </div>
        </section>
      </main>

      <footer className="border-t border-outline-variant">
        <div className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-10 sm:flex-row sm:items-center sm:justify-between md:px-6">
          <div className="flex items-center gap-2">
            <span className="material-symbols-rounded text-xl text-primary" aria-hidden>
              ac_unit
            </span>
            <span className="font-semibold">AC System</span>
          </div>
          <nav aria-label="Tautan footer" className="flex items-center gap-6 text-sm text-on-surface-variant">
            <a href="#fitur" className="transition-colors hover:text-on-surface">
              Fitur
            </a>
            <a href="#alur" className="transition-colors hover:text-on-surface">
              Alur
            </a>
            <Link href="/login" className="transition-colors hover:text-on-surface">
              Masuk
            </Link>
          </nav>
        </div>
        <div className="mx-auto max-w-6xl px-4 pb-8 text-xs text-on-surface-variant md:px-6">
          © 2026 AC System · Sistem internal monitoring produksi
        </div>
      </footer>
    </div>
  );
}
