# Production Scanning

This context describes how PT GAS defines order-specific material rules, daily line registrations, and traceable unit scans.

## Language

**Product Model**:
A manufactured AC or washing-machine model belonging to one Product Category.
_Avoid_: Product, item

**Production Order**:
A globally unique order number for one Product Model, with an optional PO reference, total order quantity, order-specific BOM, and route.
_Avoid_: Batch, job

**BOM Requirement**:
An order-specific rule stating which Component Type is required and which serial prefix it must match.
_Avoid_: BOM field, dynamic component

**Registration**:
An operator-created record of planned work for one Production Order, production date, shift, line, and route step. Its plan is a hard ceiling for scans in that Registration.
_Avoid_: Batch, production run, session

**Registration Reference**:
A representative component value entered during Registration whose length defines the required scan length for that Registration.
_Avoid_: Accuracy reference, sample scan

**Component Type**:
A controlled kind of traceable material, such as PCB IDU, motor, drum, or pump. Serial values are unique within their Component Type.
_Avoid_: Dynamic field, attribute

**Production Unit**:
One physical finished unit, identified by a globally unique main serial and belonging to one Production Order.
_Avoid_: Scan, history row

**Unit Scan**:
A record of a Production Unit passing the route step identified by a Registration.
_Avoid_: Record, history row

**Route Step**:
One ordered stage in a Production Order's manufacturing route, derived from its Product Model's route template.
_Avoid_: Subline, parsed line name

**Plan**:
The maximum active Unit Scans permitted for one Registration. It may be edited but cannot be lower than the Registration's active scan count.
_Avoid_: Order quantity, cosmetic target

**Order Quantity**:
The maximum number of globally unique finished units authorized for a Production Order across all Registrations.
_Avoid_: Plan, daily target
