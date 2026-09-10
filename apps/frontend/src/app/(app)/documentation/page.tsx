"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { Card } from "@/components/vm3/Card";
import { useAuth } from "@/lib/auth";

const workflow = [
  ["01", "Master Data", "Siapkan kategori, model, line, dan BOM sebelum produksi."],
  ["02", "Regist Scan", "Buat registrasi dengan model, order number, PO, line, shift, plan, dan referensi material."],
  ["03", "Scan Produksi", "Operator membuka registrasi lalu mencatat scan sesuai subline yang dipilih."],
  ["04", "Data & Export", "Pantau hasil scan di Data Scan dan gunakan export untuk kebutuhan laporan."],
];

const validations = [
  ["BOM", "Satu BOM universal berlaku untuk IDU dan ODU; field wajib dan prefix material harus sesuai."],
  ["Kualitas data", "Panjang dan kemiripan nilai scan dibandingkan dengan referensi registrasi."],
  ["Urutan", "INPUT harus lebih dulu daripada OUTPUT. Packing mengikuti ASSY yang terdaftar."],
  ["Duplikasi", "Scan material yang sama pada satu registrasi tidak dapat dicatat dua kali."],
  ["Plan", "Registrasi berhenti menerima scan setelah target plan tercapai."],
];

const apiGroups = [
  {
    title: "Autentikasi",
    items: [
      ["POST", "/auth/login", "Login dan membuat session cookie."],
      ["GET", "/auth/me", "Membaca user dari session aktif."],
      ["POST", "/auth/logout", "Menghapus session aktif."],
    ],
  },
  {
    title: "Master data",
    items: [
      ["GET", "/model", "Daftar model."],
      ["POST · PUT · DELETE", "/model/post · /model/edit/:id · /model/delete/:id", "Kelola model (superuser)."],
      ["GET", "/line", "Daftar line untuk pilihan operator."],
      ["POST · DELETE", "/line/post · /line/:id", "Kelola line (superuser)."],
      ["GET", "/bomlist", "Daftar BOM dan metadata field."],
      ["POST · PUT · DELETE", "/bomlist/post · /bomlist/edit/:id · /bomlist/delete/:id", "Kelola BOM (superuser)."],
      ["GET", "/product-categories", "Daftar kategori produk."],
      ["POST · PUT · DELETE", "/product-categories/post · /product-categories/edit/:id · /product-categories/delete/:id", "Kelola kategori produk (superuser)."],
      ["GET", "/users", "Daftar akun user."],
      ["POST · PUT · DELETE", "/users/regist · /users/update/:id · /users/delete/:id", "Kelola akun user (superuser)."],
      ["GET", "/pin", "Daftar PIN harian."],
      ["POST · DELETE", "/pin/post · /pin/delete/:id", "Kelola PIN harian (superuser)."],
      ["POST", "/pin/compare", "Validasi PIN untuk operasi terlindungi."],
      ["GET", "/uph", "Daftar data UPH."],
      ["POST · PUT · DELETE", "/uph/post · /uph/edit/:id · /uph/delete/:id", "Kelola UPH (superuser)."],
    ],
  },
  {
    title: "Registrasi dan scan",
    items: [
      ["GET", "/registscan", "Daftar registrasi sesuai scope user."],
      ["GET", "/registscan/checkregist", "Registrasi yang masih memiliki sisa plan."],
      ["POST · PUT · DELETE", "/registscan/post · /registscan/edit/:id · /registscan/delete/:id", "Buat, ubah, atau hapus registrasi."],
      ["GET", "/rdps/scan", "Detail registrasi, BOM, referensi, dan jumlah scan."],
      ["POST", "/rdps/post", "Simpan satu hasil scan."],
      ["POST", "/rdps/import", "Import 1–5000 hasil scan."],
      ["PUT · DELETE", "/rdps/edit/:id · /rdps/delete/:id", "Ubah atau hapus hasil scan dengan PIN."],
      ["GET", "/rdps/history", "Riwayat scan per registrasi."],
      ["GET", "/rdps/history.xlsx", "Export riwayat satu registrasi."],
    ],
  },
  {
    title: "Dashboard dan export",
    items: [
      ["GET", "/rdps/dashboard", "Ringkasan produksi."],
      ["GET", "/rdps/total-po-scan", "Ringkasan scan per PO/order."],
      ["GET", "/rdps/data-export", "Data scan untuk tabel export."],
      ["GET", "/rdps/data-export.xlsx", "Export data scan ke Excel."],
      ["GET", "/rdps/export-odf-po-all.xlsx", "Export seluruh scan berdasarkan filter PO/order."],
      ["GET", "/rdps/export-odf-po-all", "Export seluruh scan dalam format data."],
      ["GET", "/rdps/export-odf-po-detail/", "Export detail scan berdasarkan filter."],
    ],
  },
];

export default function DocumentationPage() {
  const { user, initializing } = useAuth();
  const router = useRouter();
  const isSuperuser = user?.roleuser?.toLowerCase() === "superuser";

  useEffect(() => {
    if (!initializing && (!user || !isSuperuser)) router.replace("/regist");
  }, [initializing, user, isSuperuser, router]);

  if (initializing || !user || !isSuperuser) {
    return <div className="flex min-h-48 items-center justify-center text-sm text-on-surface-variant">Memeriksa akses…</div>;
  }

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-8">
      <header className="flex flex-col gap-3 border-b border-outline-variant pb-6">
        <div className="flex items-center gap-2 text-sm font-medium text-primary">
          <span className="material-symbols-rounded" aria-hidden>menu_book</span>
          Referensi superuser
        </div>
        <h1 className="text-3xl font-bold tracking-tight text-on-surface">Dokumentasi Sistem</h1>
        <p className="max-w-3xl text-on-surface-variant">
          Panduan singkat untuk mengelola master data, registrasi produksi, validasi scan, dan pelaporan PT GAS.
        </p>
      </header>

      <section aria-labelledby="overview-title" className="grid gap-4 sm:grid-cols-3">
        <Card variant="filled" className="p-5 sm:col-span-2">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-primary">Tujuan sistem</p>
          <h2 id="overview-title" className="text-xl font-semibold text-on-surface">Satu alur data dari BOM sampai laporan</h2>
          <p className="mt-2 text-sm leading-6 text-on-surface-variant">
            Sistem menjaga agar setiap scan terhubung ke registrasi, model, order, PO, dan subline produksi yang benar.
            Perubahan master data memengaruhi registrasi baru dan aturan scan berikutnya.
          </p>
        </Card>
        <Card variant="outlined" className="p-5">
          <p className="text-xs font-semibold uppercase tracking-wider text-on-surface-variant">Akses halaman</p>
          <p className="mt-2 text-2xl font-bold text-on-surface">Superuser</p>
          <p className="mt-1 text-sm text-on-surface-variant">Dokumentasi dan Master Data tidak tersedia untuk operator PPC.</p>
        </Card>
      </section>

      <section aria-labelledby="workflow-title">
        <div className="mb-4">
          <p className="text-sm font-medium text-primary">Alur operasional / Operating flow</p>
          <h2 id="workflow-title" className="text-2xl font-semibold text-on-surface">Dari persiapan sampai export</h2>
        </div>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {workflow.map(([number, title, description]) => (
            <Card key={number} variant="outlined" className="p-5">
              <span className="text-2xl font-bold text-primary">{number}</span>
              <h3 className="mt-4 font-semibold text-on-surface">{title}</h3>
              <p className="mt-2 text-sm leading-6 text-on-surface-variant">{description}</p>
            </Card>
          ))}
        </div>
      </section>

      <section aria-labelledby="subline-title" className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
        <Card variant="outlined" className="overflow-hidden">
          <div className="border-b border-outline-variant p-5">
            <p className="text-sm font-medium text-primary">Konvensi line</p>
            <h2 id="subline-title" className="text-xl font-semibold text-on-surface">Subline dan urutan scan</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <caption className="sr-only">Konvensi subline produksi dan aturan urutannya</caption>
              <thead className="bg-surface-container text-xs uppercase text-on-surface-variant">
                <tr>
                  <th className="p-4">Kategori</th>
                  <th className="p-4">Nama subline yang disarankan</th>
                  <th className="p-4">Aturan</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-t border-outline-variant align-top">
                  <th scope="row" className="p-4 font-semibold text-on-surface">AC</th>
                  <td className="p-4 font-mono text-xs leading-6 text-on-surface-variant">
                    LINE IDU ASSY INPUT<br />
                    LINE IDU ASSY OUTPUT<br />
                    LINE ODU ASSY INPUT<br />
                    LINE ODU ASSY OUTPUT<br />
                    LINE IDU PACKING INPUT<br />
                    LINE ODU PACKING INPUT
                  </td>
                  <td className="p-4 text-on-surface-variant">IDU dan ODU divalidasi terpisah. Tambahkan TESTING atau PACKING OUTPUT bila memang digunakan.</td>
                </tr>
                <tr className="border-t border-outline-variant align-top">
                  <th scope="row" className="p-4 font-semibold text-on-surface">WM</th>
                  <td className="p-4 font-mono text-xs leading-6 text-on-surface-variant">
                    LINE WM ASSY INPUT<br />
                    LINE WM ASSY OUTPUT<br />
                    LINE WM PACKING INPUT<br />
                    LINE WM PACKING OUTPUT
                  </td>
                  <td className="p-4 text-on-surface-variant">ASSY OUTPUT bersifat opsional bila registrasinya tidak dibuat. Jika dibuat, INPUT/OUTPUT tetap berurutan.</td>
                </tr>
              </tbody>
            </table>
          </div>
          <p className="border-t border-outline-variant bg-surface-container px-5 py-3 text-xs text-on-surface-variant">
            Gunakan nama canonical di atas. Validasi urutan mengenali kata dan urutan subline tersebut.
          </p>
        </Card>

        <Card variant="filled" className="p-5">
          <p className="text-sm font-medium text-primary">Catatan penting</p>
          <h2 className="mt-1 text-xl font-semibold text-on-surface">Line dipilih saat registrasi</h2>
          <ul className="mt-4 space-y-3 text-sm leading-6 text-on-surface-variant">
            <li className="flex gap-2"><span className="text-primary">•</span><span>Operator memilih subline dari master Line, bukan dari JWT section.</span></li>
            <li className="flex gap-2"><span className="text-primary">•</span><span>Model yang sama boleh dipakai untuk registrasi IDU dan ODU.</span></li>
            <li className="flex gap-2"><span className="text-primary">•</span><span>Setiap section sebaiknya memakai akun operator yang berbeda agar scope registrasi tetap jelas.</span></li>
          </ul>
        </Card>
      </section>

      <section aria-labelledby="validation-title">
        <div className="mb-4">
          <p className="text-sm font-medium text-primary">Kontrol data / Data controls</p>
          <h2 id="validation-title" className="text-2xl font-semibold text-on-surface">Validasi utama</h2>
        </div>
        <Card variant="outlined" className="divide-y divide-outline-variant">
          {validations.map(([title, description]) => (
            <div key={title} className="grid gap-1 p-4 sm:grid-cols-[10rem_1fr] sm:gap-4">
              <h3 className="font-semibold text-on-surface">{title}</h3>
              <p className="text-sm leading-6 text-on-surface-variant">{description}</p>
            </div>
          ))}
        </Card>
      </section>

      <section aria-labelledby="api-title">
        <div className="mb-4">
          <p className="text-sm font-medium text-primary">Referensi integrasi / Integration reference</p>
          <h2 id="api-title" className="text-2xl font-semibold text-on-surface">API endpoint</h2>
          <p className="mt-2 text-sm text-on-surface-variant">Semua endpoint selain login memerlukan session cookie. Request browser mengirim cookie secara otomatis.</p>
        </div>
        <div className="space-y-4">
          {apiGroups.map((group) => (
            <Card key={group.title} variant="outlined" className="overflow-hidden">
              <h3 className="border-b border-outline-variant bg-surface-container px-5 py-3 font-semibold text-on-surface">{group.title}</h3>
              <div className="divide-y divide-outline-variant">
                {group.items.map(([method, path, description]) => (
                  <div key={`${method}-${path}`} className="grid gap-2 p-4 md:grid-cols-[9rem_minmax(16rem,1fr)_1fr] md:items-start md:gap-4">
                    <span className="w-fit rounded bg-primary/10 px-2 py-1 text-xs font-semibold text-primary">{method}</span>
                    <code className="break-all text-xs leading-6 text-on-surface">{path}</code>
                    <p className="text-sm leading-6 text-on-surface-variant">{description}</p>
                  </div>
                ))}
              </div>
            </Card>
          ))}
        </div>
        <Card variant="filled" className="mt-4 p-4 text-sm text-on-surface-variant">
          <strong className="text-on-surface">Header khusus:</strong> <code>idregist</code> dipakai untuk konteks registrasi pada endpoint scan/history; <code>X-PIN</code> dipakai untuk operasi yang dilindungi PIN. Base URL mengikuti <code>NEXT_PUBLIC_API_URL</code>.
        </Card>
      </section>

      <section aria-labelledby="access-title" className="grid gap-6 lg:grid-cols-2">
        <Card variant="outlined" className="p-5">
          <p className="text-sm font-medium text-primary">Peran pengguna / User roles</p>
          <h2 id="access-title" className="mt-1 text-xl font-semibold text-on-surface">Akses berdasarkan tanggung jawab</h2>
          <div className="mt-4 space-y-4 text-sm">
            <div>
              <h3 className="font-semibold text-on-surface">Superuser</h3>
              <p className="mt-1 text-on-surface-variant">Mengelola Model, Line, BOM, user, PIN harian, kategori, registrasi, monitoring, dan export.</p>
            </div>
            <div>
              <h3 className="font-semibold text-on-surface">PPC / Operator</h3>
              <p className="mt-1 text-on-surface-variant">Membuat dan melihat registrasi miliknya, memilih line, lalu menjalankan scan melalui registrasi yang tersedia.</p>
            </div>
          </div>
        </Card>
        <Card variant="outlined" className="p-5">
          <p className="text-sm font-medium text-primary">Akses cepat / Quick links</p>
          <h2 className="mt-1 text-xl font-semibold text-on-surface">Halaman kerja</h2>
          <div className="mt-4 grid gap-2 text-sm">
            <Link className="rounded-md px-3 py-2 text-primary hover:bg-primary/8" href="/master">Master Data <span aria-hidden>→</span></Link>
            <Link className="rounded-md px-3 py-2 text-primary hover:bg-primary/8" href="/regist">Registrasi Scan <span aria-hidden>→</span></Link>
            <Link className="rounded-md px-3 py-2 text-primary hover:bg-primary/8" href="/po-scan">Data Scan dan Export <span aria-hidden>→</span></Link>
          </div>
        </Card>
      </section>
    </div>
  );
}
