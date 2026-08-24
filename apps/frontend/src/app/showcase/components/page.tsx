"use client";

/**
 * VM3 Components Showcase — semua komponen × varian × state.
 */
import { useState } from "react";
import { Button } from "@/components/vm3/Button";
import { IconButton } from "@/components/vm3/IconButton";
import { Fab } from "@/components/vm3/Fab";
import { SegmentedButton } from "@/components/vm3/SegmentedButton";
import { TextField } from "@/components/vm3/TextField";
import { TextArea } from "@/components/vm3/TextArea";
import { SearchField } from "@/components/vm3/SearchField";
import { Checkbox } from "@/components/vm3/Checkbox";
import { Radio } from "@/components/vm3/Radio";
import { Switch } from "@/components/vm3/Switch";
import { Slider } from "@/components/vm3/Slider";
import { Select } from "@/components/vm3/Select";
import { Combobox } from "@/components/vm3/Combobox";
import { DatePicker } from "@/components/vm3/DatePicker";
import { Card } from "@/components/vm3/Card";
import { List, ListItem } from "@/components/vm3/List";
import { Chip } from "@/components/vm3/Chip";
import { Badge } from "@/components/vm3/Badge";
import { Dialog } from "@/components/vm3/Dialog";
import { BottomSheet } from "@/components/vm3/BottomSheet";
import { Menu } from "@/components/vm3/Menu";
import { Popover, Tooltip } from "@/components/vm3/PopoverTooltip";
import { SnackbarProvider, useSnackbar } from "@/components/vm3/Snackbar";
import { AppBar, NavigationBar, NavigationRail, NavigationDrawer, Tabs, NavItem, RailItem } from "@/components/vm3/Navigation";
import { LinearProgress, CircularProgress, LoadingIndicator } from "@/components/vm3/Progress";
import { VirtualList } from "@/components/vm3/VirtualList";
import { useTheme } from "@/design-system/themes/ThemeProvider";

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mb-12">
      <h2 className="mb-4 text-2xl font-semibold">{title}</h2>
      <div className="flex flex-wrap items-center gap-4">{children}</div>
    </section>
  );
}

function ThemeToggle() {
  const { mode, toggleMode } = useTheme();
  return (
    <Button variant="tonal" icon={mode === "dark" ? "light_mode" : "dark_mode"} onClick={toggleMode}>
      {mode === "dark" ? "Light" : "Dark"}
    </Button>
  );
}

function DialogDemo() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button onClick={() => setOpen(true)}>Buka Dialog</Button>
      <Dialog
        open={open}
        onOpenChange={setOpen}
        title="Konfirmasi"
        description="Aksi ini tidak dapat dibatalkan. Lanjutkan?"
        actions={
          <>
            <Button variant="text" onClick={() => setOpen(false)}>Batal</Button>
            <Button onClick={() => setOpen(false)}>Lanjut</Button>
          </>
        }
      />
    </>
  );
}

function SheetDemo() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button onClick={() => setOpen(true)}>Buka Bottom Sheet</Button>
      <BottomSheet open={open} onOpenChange={setOpen} title="Detail">
        <p className="py-4">Konten sheet — pilihan aksi atau detail singkat.</p>
        <Button variant="text" onClick={() => setOpen(false)}>Tutup</Button>
      </BottomSheet>
    </>
  );
}

function SnackbarDemo() {
  const { show } = useSnackbar();
  return (
    <Button
      onClick={() => show("Data berhasil disimpan", { actionLabel: "Urungkan", onAction: () => show("Dibatalkan") })}
    >
      Tampilkan Snackbar
    </Button>
  );
}

function NavDemo() {
  const [active, setActive] = useState("home");
  const [drawerOpen, setDrawerOpen] = useState(false);
  const items = [
    { id: "home", label: "Beranda", icon: "home" },
    { id: "scan", label: "Scan", icon: "qr_code_scanner" },
    { id: "history", label: "Riwayat", icon: "history" },
  ];
  return (
    <div className="w-full">
      <AppBar
        title="VM3"
        leading={<IconButton icon="menu" label="Menu" onClick={() => setDrawerOpen(true)} />}
        actions={<ThemeToggle />}
      />
      <Tabs
        tabs={items.map((i) => ({ value: i.id, label: i.label }))}
        value={active}
        onChange={setActive}
      />
      <div className="my-4 h-32 rounded bg-surface-container p-4">
        Konten tab: {active}
      </div>
      <NavigationBar>
        {items.map((i) => (
          <NavItem key={i.id} icon={i.icon} label={i.label} active={active === i.id} onClick={() => setActive(i.id)} />
        ))}
      </NavigationBar>
      <div className="hidden md:block">
        <NavigationRail>
          {items.map((i) => (
            <RailItem key={i.id} icon={i.icon} label={i.label} active={active === i.id} onClick={() => setActive(i.id)} />
          ))}
        </NavigationRail>
      </div>
      <NavigationDrawer open={drawerOpen} onOpenChange={setDrawerOpen}>
        <List>
          {items.map((i) => (
            <ListItem key={i.id} leadingIcon={i.icon} primary={i.label} onClick={() => { setActive(i.id); setDrawerOpen(false); }} />
          ))}
        </List>
      </NavigationDrawer>
    </div>
  );
}

const BIG_LIST = Array.from({ length: 1000 }, (_, i) => `Item virtual #${i + 1}`);

export default function ComponentsShowcase() {
  const [segValue, setSegValue] = useState("day");
  const [checkbox, setCheckbox] = useState(true);
  const [radio, setRadio] = useState("a");
  const [switchOn, setSwitchOn] = useState(true);
  const [slider, setSlider] = useState(40);
  const [text, setText] = useState("");
  const [search, setSearch] = useState("");
  const [select, setSelect] = useState<string | null>(null);
  const [combo, setCombo] = useState("");
  const [date, setDate] = useState<string | null>(null);
  const [chipSel, setChipSel] = useState(true);

  return (
    <SnackbarProvider>
      <main className="mx-auto max-w-6xl p-6 pb-32">
      <h1 className="mb-2 text-4xl font-bold">VM3 Components</h1>
      <p className="mb-10 text-on-surface-variant">
        Semua komponen × varian × state. Tanpa nilai visual hardcode — semua dari token.
      </p>

      <Section title="Button — 5 varian">
        <Button variant="elevated">Elevated</Button>
        <Button>Filled</Button>
        <Button variant="tonal">Tonal</Button>
        <Button variant="outlined">Outlined</Button>
        <Button variant="text">Text</Button>
        <Button icon="add">Dengan ikon</Button>
        <Button disabled>Disabled</Button>
        <Button loading>Loading</Button>
      </Section>

      <Section title="IconButton + FAB + SegmentedButton">
        <IconButton icon="favorite" label="Suka" />
        <IconButton icon="favorite" label="Suka" variant="outlined" />
        <IconButton icon="favorite" label="Suka" variant="filled" />
        <IconButton icon="favorite" label="Suka" variant="tonal" />
        <Fab icon="add" label="Tambah" />
        <Fab icon="edit" small />
        <SegmentedButton
          segments={[
            { value: "day", label: "Hari" },
            { value: "week", label: "Minggu" },
            { value: "month", label: "Bulan" },
          ]}
          value={segValue}
          onChange={(v) => setSegValue(v as string)}
        />
      </Section>

      <Section title="Inputs">
        <div className="grid w-full gap-6 md:grid-cols-2">
          <TextField label="Nama" value={text} onChange={(e) => setText(e.target.value)} />
          <TextField label="Email" variant="outlined" errorText={text === "" ? undefined : ""} helper="Format: nama@domain.com" />
          <TextField label="Password" variant="outlined" type="password" icon="lock" />
          <TextField label="Dengan error" variant="outlined" error errorText="Field wajib diisi" />
          <TextArea label="Catatan" rows={3} />
          <SearchField value={search} onChange={setSearch} placeholder="Cari data…" />
        </div>
      </Section>

      <Section title="Selection">
        <Checkbox label="Checkbox" checked={checkbox} onChange={(e) => setCheckbox(e.target.checked)} />
        <div className="flex flex-col">
          <Radio name="demo" label="Opsi A" checked={radio === "a"} onChange={() => setRadio("a")} />
          <Radio name="demo" label="Opsi B" checked={radio === "b"} onChange={() => setRadio("b")} />
        </div>
        <Switch checked={switchOn} onChange={(e) => setSwitchOn(e.target.checked)} />
        <div className="w-64">
          <Slider value={slider} onChange={(e) => setSlider(Number(e.target.value))} min={0} max={100} />
          <div className="text-center text-sm text-on-surface-variant">{slider}%</div>
        </div>
      </Section>

      <Section title="Select, Combobox, DatePicker">
        <div className="w-64">
          <Select
            options={[
              { value: "1", label: "Shift 1" },
              { value: "2", label: "Shift 2" },
            ]}
            value={select}
            onChange={setSelect}
            placeholder="Pilih shift"
          />
        </div>
        <div className="w-64">
          <Combobox
            options={["LINE 1", "LINE 2", "LINE 3", "LINE PACKING A", "LINE PACKING B"]}
            value={combo}
            onChange={setCombo}
            placeholder="Cari line…"
          />
        </div>
        <DatePicker value={date} onChange={setDate} label="Pilih tanggal" />
      </Section>

      <Section title="Card, List, Chip, Badge">
        <Card className="w-56 p-4">
          <div className="font-semibold">Elevated</div>
          <p className="text-sm text-on-surface-variant">Konten kartu</p>
        </Card>
        <Card variant="filled" className="w-56 p-4">
          <div className="font-semibold">Filled</div>
        </Card>
        <Card variant="outlined" interactive className="w-56 p-4">
          <div className="font-semibold">Outlined interactive</div>
        </Card>
        <div className="flex flex-col gap-2">
          <Chip variant="assist" icon="info">Assist</Chip>
          <Chip variant="filter" selected={chipSel} onCheckedChange={setChipSel}>Filter {chipSel ? "✓" : ""}</Chip>
          <Chip variant="input" trailingIcon="close">Input chip</Chip>
          <Chip variant="suggestion">Suggestion</Chip>
        </div>
        <span className="relative inline-flex">
          <IconButton icon="notifications" label="Notifikasi" />
          <span className="absolute -right-1 -top-1"><Badge count={12} /></span>
        </span>
        <Badge dot />
      </Section>

      <Section title="Overlays">
        <DialogDemo />
        <SheetDemo />
        <Menu
          trigger={<Button variant="outlined">Menu</Button>}
          items={[
            { label: "Edit", icon: "edit", onSelect: () => alert("Edit") },
            { label: "Hapus", icon: "delete", onSelect: () => alert("Hapus") },
            { label: "Nonaktif", icon: "block", disabled: true },
          ]}
        />
        <Popover trigger={<Button variant="outlined">Popover</Button>}>
          <div className="text-sm">Konten popover singkat.</div>
        </Popover>
        <Tooltip label="Tooltip VM3">
          <IconButton icon="help" label="Bantuan" />
        </Tooltip>
        <SnackbarDemo />
      </Section>

      <Section title="Progress & Loading">
        <div className="w-full max-w-md">
          <LinearProgress value={65} />
        </div>
        <div className="w-full max-w-md">
          <LinearProgress />
        </div>
        <CircularProgress value={65} />
        <CircularProgress />
        <LoadingIndicator text="Memuat data…" />
      </Section>

      <Section title="Navigation">
        <NavDemo />
      </Section>

      <Section title="VirtualList — 1000 item">
        <div className="h-64 w-full max-w-xl rounded border border-outline-variant">
          <VirtualList
            items={BIG_LIST}
            getKey={(item) => item}
            renderItem={(item) => (
              <div className="flex h-full items-center border-b border-outline-variant px-4">
                {item}
              </div>
            )}
          />
        </div>
      </Section>
      </main>
    </SnackbarProvider>
  );
}
