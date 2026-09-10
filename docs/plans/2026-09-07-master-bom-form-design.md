# Master BOM form design

## Decision

The Master Data BOM List form is driven by the category of the selected Model Master record. Category is not editable in the BOM form.

Canonical categories:

- `ac`
- `wm`

Legacy `ai` and `an` map to `ac` for compatibility.

## AC fields

All AC BOM fields are universal. A single BOM rule applies to both IDU and ODU
lines; the production line still determines the scan stage order.

| Scope | Field |
| --- | --- |
| Universal | Serial Number (`sn`) |
| Universal | SN Carton (`sn_carton`) |
| Universal | SN Accessories (`sn_accessories`) |
| Universal | PCB IDU (`pcb_idu`) |
| Universal | PCB ODU (`pcb_odu`) |
| Universal | SN Motor (`sn_motor`) |

`sn_odu` and `sn_box` are not offered for new BOM rules. Legacy data remains readable.

## WM fields

- Serial Number (`sn`)
- SN Drum (`sn_drum`)
- SN Pump (`sn_pump`)

## Form behavior

1. The user selects a Model from Model Master and enters an Order Number.
2. The form reads the model category and renders only its typed material fields.
3. Each material field has a BOM prefix and a required-at-registration toggle.
4. A blank prefix disables the corresponding required toggle in the submitted data.
5. Editing uses the existing BOM model/category and preserves existing legacy values without presenting legacy fields as new configuration choices.

## Data migration

Add `pcb_odu` to the typed AC BOM, registration, and scan tables. The migration is additive. Existing `sn_odu` and `sn_box` columns/tables are retained for the cutover window.
