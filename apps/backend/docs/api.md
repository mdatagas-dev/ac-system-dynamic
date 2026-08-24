# API Reference — Backend AC

Base URL: `http://localhost:3010` (produksi: sesuai `PORT`).

**Auth**: semua endpoint kecuali `POST /login` dan `POST /login/refresh_token` butuh header `Authorization: Bearer <token>`.

Konvensi response:
- Sukses: `200/201` + JSON sesuai endpoint
- Validasi gagal: `400` `{ error: "..." }`
- Tidak ditemukan / token rusak: `401` / `404`
- Error server: `500` `{ error: "Internal Server Error" }`

---

## Auth

### POST /login
Body: `{ username, password }`
- `400` — username/password kosong
- `401` — `{ error: "Username Not Found" }` / `{ error: "Wrong Password" }`
- `200` — `{ message, accessToken, refreshToken }`

### POST /login/refresh_token
Body: `{ refreshToken }`
- `200` — `{ accessToken }`
- `401` — `{ message: "Refresh token invalid" }`

---

## Users — `/users`

### GET /users
Query: `keyword`, `limit` (default 10), `page` (default 1)
→ `{ data: [{ id, username, email, roleuser, departement, section, ... }], total, currentPages, totalPages }`

### POST /users/regist
Body: `{ username, password, email, roleuser, departement, section }`
- `400` — `username`/`password` wajib; username sudah terdaftar
- `201` — `{ message: "Registration successful", user }`

> **Keamanan**: hanya `hash` (bcrypt) yang disimpan — password plaintext TIDAK pernah ditulis ke DB.

### PUT /users/update/:id
Body: `{ username, password?, email, roleuser, departement, section }` (password opsional — kosong = tetap)
- `400` — username dipakai user lain
- `201` — `{ message: "Updated success", result }`

### DELETE /users/delete/:id
- `200` — `{ message: "delete successful", result }`

---

## Model — `/model`

### GET /model
Query: `keyword`, `limit`, `page` → `{ data, total, currentPages, totalPages }`

### POST /model/post
Body: `{ brand, model, pk, linkimage }`
- `409` — `{ error: "Double Model" }`
- `200` — `{ message: "Data berhasil ditambah", data }`

### PUT /model/edit/:id
Body: `{ brand, model, linkimage }` — **tidak ada kolom `inch`** (sudah dihapus dari DB)

### DELETE /model/delete/:id

---

## Line — `/line`

### GET /line → `{ message, data: [{ id, line }] }`
### POST /line/post
Body: `{ line }` (diterima lowercase, disimpan UPPERCASE) — `400` bila duplikat
### DELETE /line/:id

---

## PIN Harian — `/pin`

### GET /pin → `{ message, data: [{ id, date, pin }] }` (urut tanggal desc)
### POST /pin/post
Body: `{ date: "YYYY-MM-DD", pin }`
- `409` — tanggal sudah tersedia
- `200` — `{ message: "Simpan data berhasil", result }`

### POST /pin/compare
Body: `{ pin }` (dibandingkan dengan PIN hari ini UTC)
- `200` — `true`
- `404` — PIN hari ini belum dibuat
- `400` — `{ error: "Pin tidak sesuai" }`

### DELETE /pin/delete/:id

---

## BOM List — `/bomlist`

### GET /bomlist
Query: `keyword`, `limit`, `page` → `{ data, total, currentPages, totalPages }` (urut timestamp desc)

### POST /bomlist/post
Body: `{ model, order_number, sn, sn_carton, pcb_idu, sn_box, sn_motor, sn_accessories }`

### PUT /bomlist/edit/:id
Body: sama seperti post

### DELETE /bomlist/delete/:id

---

## UPH — `/uph`

### GET /uph → `{ message, data }` (urut uph desc)
### POST /uph/post
Body: `{ model (uuid), line (uuid), uph }` — FK ke tabel model & line
### PUT /uph/edit/:id
### DELETE /uph/delete/:id

---

## Registrasi Batch — `/registscan`

### GET /registscan
Query: `keyword`, `limit` (default 10), `page`
- Role `superuser`: semua data
- Role lain: hanya `userid` miliknya
→ `{ data: [{ id, model, order_number, po_number, subline, plan, total (jumlah scan), timestamps }], total, currentPages, totalPages }`

### GET /registscan/checkregist
Header: `iduser`
→ registrasi yang `plan > jumlah scan` (belum selesai)

### POST /registscan/post
Body: `{ model, order_number, po_number, subline, userid, shift, plan, sn?, sn_motor?, sn_box?, pcb_idu?, sn_carton?, sn_accessories? }`

Validasi:
- 6 field wajib: `model, order_number, po_number, subline, userid, shift, plan`
- `model` dicocokkan ke BOM list setelah **5 karakter terakhir dipotong** (suffix)
- `404` — batch tidak ada di bomlist
- `201` — `{ message: "Data Added Successfully", result }`

### PUT /registscan/edit/:id
Body: sama + validasi bomlist sama seperti post

### DELETE /registscan/delete/:id
`200` — `{ message: "Deleted Successfully", result }`

---

## Scan & Dashboard — `/rdps`

### GET /rdps/scan
Header: `idregist`
→ `{ validation (registscan), total (jumlah scan), last (scan terakhir), bomlist (clean, tanpa field kosong) }`
- `404` — tidak ada `idregist` / regist tidak ditemukan

### GET /rdps/dashboard
Query: `keyword` (opsional — line/subline)
Cache Redis 60 detik (key: `dashboardUphAC:keyword=...`)
→ `{ data: [{ model, suph, total, uph: [{ time, record }] }], subline: [{ subline }] }`
- Logika shift: 07–16 shift 1, ≥16 shift 2, dini hari lanjutan shift 2
- Aman SQL injection (parameterized)

### GET /rdps/history
Header: `idregist`
Query: `page`, `limit`, `keyword`
→ `{ data: [recordscan], validation (regist), total, totalPages }`

### POST /rdps/post
Body: `{ id_regist, sn, sn_motor?, sn_box?, pcb_idu?, sn_carton?, sn_accessories? }`

Validasi dalam transaksi (detail di README):
- SN tanpa karakter `% $ # @ ! ^ *`
- `400` — `Double Scan di <subline>`, `unit terlewat scan kembali di <line>`, `Double scan <field> di satu regist`, `Akurasi scan tidak sama...`
- `201` — `{ message: "Data Added Successfully", data, unit, brand, po, odf, model }`

### PUT /rdps/edit/:id
Body: `{ id_regist, sn, sn_motor?, sn_box?, pcb_idu?, sn_carton?, sn_accessories? }`
- `400` — double scan di regist yang sama
- `200` — `{ message: "data update successful", data }`

### DELETE /rdps/delete/:id
`200` — `{ result, message: "Deleted Succesfully" }`

### GET /rdps/total-po-scan
Query: `page`, `limit` (default 10), `keyword`
→ `{ data: [{ model, order_number, po_number, subline, countsubline, index }], total, currentPages, totalPages }`

### GET /rdps/export-odf-po-all
Query: `model` (wajib), `order_number?`, `po_number?`, `subline?`
→ `{ data: [{ registTime, model, po_number, order_number, subline, scanTime, sn, sn_motor, pcb_idu, sn_box, sn_accessories, sn_carton }] }`

### GET /rdps/export-odf-po-detail
Query: `model` (wajib), `order_number?`, `po_number?`, `subline?`
→ `{ data: [{ timestamps, model, order_number, po_number, subline, countsubline }] }`
