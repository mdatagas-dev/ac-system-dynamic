#!/usr/bin/env node

const fs = require("fs");
const path = require("path");
const dotenv = require("dotenv");
const { assertSafeDatabaseUrl } = require("./database-redesign-preflight");

const BACKFILL_CONFIRMATION = "WRITE_TEST_PHASE3_BACKFILL";
const BUSINESS_TIME_ZONE = "Asia/Jakarta";

const COMPONENTS = {
  ac: [
    ["sn", true],
    ["sn_odu", false],
    ["sn_carton", false],
    ["pcb_idu", false],
    ["pcb_odu", false],
    ["sn_box", false],
    ["sn_motor", false],
    ["sn_accessories", false],
  ],
  wm: [
    ["sn", true],
    ["sn_drum", true],
    ["sn_pump", false],
  ],
};

const ROUTES = [
  ["LINE IDU ASSY INPUT", "idu-assembly-input", "assembly", 10],
  ["LINE IDU ASSY OUTPUT", "idu-assembly-output", "assembly", 20],
  ["LINE ODU ASSY INPUT", "odu-assembly-input", "assembly", 30],
  ["LINE ODU ASSY OUTPUT", "odu-assembly-output", "assembly", 40],
  ["LINE IDU TESTING INPUT", "idu-testing-input", "testing", 50],
  ["LINE IDU TESTING OUTPUT", "idu-testing-output", "testing", 60],
  ["LINE ODU TESTING INPUT", "odu-testing-input", "testing", 70],
  ["LINE ODU TESTING OUTPUT", "odu-testing-output", "testing", 80],
  ["LINE IDU PACKING INPUT", "idu-packing-input", "packing", 90],
  ["LINE IDU PACKING OUTPUT", "idu-packing-output", "packing", 100],
  ["LINE ODU PACKING INPUT", "odu-packing-input", "packing", 110],
  ["LINE ODU PACKING OUTPUT", "odu-packing-output", "packing", 120],
  ["LINE WM ASSY INPUT", "wm-assembly-input", "assembly", 110],
  ["LINE WM ASSY OUTPUT", "wm-assembly-output", "assembly", 120],
  ["LINE WM PACKING INPUT", "wm-packing-input", "packing", 130],
  ["LINE WM PACKING OUTPUT", "wm-packing-output", "packing", 140],
];

const ROUTE_BY_NAME = new Map(
  ROUTES.map(([name, code, processCode, sequence]) => [
    name,
    { code, name, processCode, sequence },
  ]),
);

function normalizeText(value) {
  if (value === undefined || value === null) return null;
  const normalized = String(value).trim().toUpperCase();
  return normalized || null;
}

function categoryKey(value) {
  const key = String(value || "").trim().toLowerCase();
  const normalized = { ai: "ac", an: "ac", washing: "wm" }[key] || key;
  if (!COMPONENTS[normalized]) {
    throw new Error(`Unsupported product category ${JSON.stringify(value)}`);
  }
  return normalized;
}

function assertBackfillWriteAllowed(databaseUrl, confirmation) {
  assertSafeDatabaseUrl(databaseUrl);
  if (confirmation !== BACKFILL_CONFIRMATION) {
    throw new Error(`Backfill write confirmation must be ${BACKFILL_CONFIRMATION}`);
  }
}

function normalizedQuantityInput(input) {
  const normalized = new Map();
  for (const [order, quantity] of Object.entries(input || {})) {
    const orderNumber = normalizeText(order);
    if (!orderNumber) throw new Error("Approved quantity contains a blank order number");
    if (normalized.has(orderNumber)) {
      throw new Error(`Approved quantity contains duplicate order ${orderNumber}`);
    }
    normalized.set(orderNumber, quantity);
  }
  return normalized;
}

function assertPositiveInteger(value, orderNumber) {
  if (!Number.isInteger(value) || value <= 0) {
    throw new Error(`Order quantity for ${orderNumber} must be a positive integer`);
  }
}

function buildQuantityAssignments(orders, approvedInput) {
  const approved = normalizedQuantityInput(approvedInput);
  return orders.map((order) => {
    const orderNumber = normalizeText(order.order_number);
    if (!orderNumber) throw new Error(`Production Order ${order.id} has a blank order number`);
    const supplied = approved.get(orderNumber);
    const existing = order.order_quantity;
    if (existing != null) assertPositiveInteger(existing, orderNumber);
    if (supplied != null) assertPositiveInteger(supplied, orderNumber);
    if (existing != null && supplied != null && existing !== supplied) {
      throw new Error(`Approved quantity for ${orderNumber} conflicts with the stored value`);
    }
    const orderQuantity = existing ?? supplied;
    if (orderQuantity == null) {
      throw new Error(`Missing approved order quantity for ${orderNumber}`);
    }
    return { id: order.id, order_number: orderNumber, order_quantity: orderQuantity };
  });
}

function canonicalRoute(subline) {
  const name = normalizeText(subline);
  const route = ROUTE_BY_NAME.get(name);
  if (!route) throw new Error(`Unknown canonical route stage ${JSON.stringify(subline)}`);
  return { ...route };
}

function componentRows(category, bomSpec = {}, registrationSpec = {}) {
  return COMPONENTS[categoryKey(category)].map(([code, defaultRequired]) => {
    const prefix = normalizeText(bomSpec[`${code}_prefix`]);
    const referenceValue = normalizeText(registrationSpec[code]);
    return {
      code,
      prefix,
      isRequired: Boolean(bomSpec[`${code}_required`] ?? defaultRequired),
      referenceValue,
      expectedLength: referenceValue?.length ?? null,
    };
  });
}

function productionDate(timestamp) {
  if (!timestamp) throw new Error("Registration timestamp is required");
  const date = new Intl.DateTimeFormat("en-CA", {
    timeZone: BUSINESS_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(timestamp));
  return new Date(`${date}T00:00:00.000Z`);
}

function uniqueByNormalized(rows, field, label) {
  const result = new Map();
  for (const row of rows) {
    const key = normalizeText(row[field]);
    if (!key) continue;
    if (result.has(key)) throw new Error(`Ambiguous ${label} ${key}`);
    result.set(key, row);
  }
  return result;
}

async function loadSource(prisma) {
  const [orders, models, lines, componentTypes, processes, registrations] =
    await Promise.all([
      prisma.bomlist.findMany({ include: { ac_spec: true, wm_spec: true } }),
      prisma.model.findMany(),
      prisma.line.findMany(),
      prisma.component_types.findMany(),
      prisma.processes.findMany(),
      prisma.registscan.findMany({ include: { ac_spec: true, wm_spec: true } }),
    ]);
  return { orders, models, lines, componentTypes, processes, registrations };
}

async function targetCounts(db) {
  const delegates = [
    "model_bom_templates",
    "bomlist_components",
    "model_route_steps",
    "bomlist_route_steps",
    "registscan_components",
  ];
  return Object.fromEntries(
    await Promise.all(
      delegates.map(async (name) => [name, await db[name].count()]),
    ),
  );
}

async function backfillPhase3(prisma, approvedQuantities) {
  const source = await loadSource(prisma);
  const quantities = new Map(
    buildQuantityAssignments(source.orders, approvedQuantities).map((row) => [
      row.id,
      row,
    ]),
  );
  const models = uniqueByNormalized(source.models, "model", "Product Model");
  const lines = uniqueByNormalized(source.lines, "line", "physical line");
  const componentTypes = new Map(source.componentTypes.map((row) => [row.code, row]));
  const processes = new Map(source.processes.map((row) => [row.code, row]));
  const orders = uniqueByNormalized(source.orders, "order_number", "Production Order");

  for (const order of source.orders) {
    const model = models.get(normalizeText(order.model));
    if (!model) throw new Error(`Product Model not found for order ${order.order_number}`);
    categoryKey(order.product_category);
  }
  for (const registration of source.registrations) {
    const order = orders.get(normalizeText(registration.order_number));
    if (!order) throw new Error(`Production Order not found for Registration ${registration.id}`);
    if (!lines.has(normalizeText(registration.subline))) {
      throw new Error(`Physical line not found for Registration stage ${registration.subline}`);
    }
    canonicalRoute(registration.subline);
  }

  return prisma.$transaction(async (tx) => {
    const report = {
      before: await targetCounts(tx),
      orders: 0,
      modelTemplates: 0,
      orderComponents: 0,
      modelRouteSteps: 0,
      orderRouteSteps: 0,
      registrations: 0,
      registrationComponents: 0,
    };

    for (const order of source.orders) {
      const normalizedOrder = quantities.get(order.id);
      const model = models.get(normalizeText(order.model));
      const category = categoryKey(order.product_category);
      const bomSpec = category === "ac" ? order.ac_spec : order.wm_spec;
      if (!bomSpec) throw new Error(`Missing ${category.toUpperCase()} BOM spec for ${normalizedOrder.order_number}`);

      await tx.bomlist.update({
        where: { id: order.id },
        data: {
          order_number: normalizedOrder.order_number,
          model_id: model.id,
          order_quantity: normalizedOrder.order_quantity,
        },
      });
      report.orders += 1;

      for (const rule of componentRows(category, bomSpec)) {
        const componentType = componentTypes.get(rule.code);
        if (!componentType) throw new Error(`Component Type ${rule.code} is missing`);
        await tx.model_bom_templates.upsert({
          where: {
            model_id_component_type_id: {
              model_id: model.id,
              component_type_id: componentType.id,
            },
          },
          create: {
            model_id: model.id,
            component_type_id: componentType.id,
            prefix: null,
            is_required: COMPONENTS[category].find(([code]) => code === rule.code)[1],
          },
          update: {},
        });
        report.modelTemplates += 1;
        await tx.bomlist_components.upsert({
          where: {
            bomlist_id_component_type_id: {
              bomlist_id: order.id,
              component_type_id: componentType.id,
            },
          },
          create: {
            bomlist_id: order.id,
            component_type_id: componentType.id,
            prefix: rule.prefix,
            is_required: rule.isRequired,
          },
          update: { prefix: rule.prefix, is_required: rule.isRequired },
        });
        report.orderComponents += 1;
      }

      const registrations = source.registrations.filter(
        (registration) => normalizeText(registration.order_number) === normalizedOrder.order_number,
      );
      const routes = new Map(
        registrations.map((registration) => {
          const route = canonicalRoute(registration.subline);
          return [route.code, route];
        }),
      );
      const orderSteps = new Map();
      for (const route of [...routes.values()].sort((a, b) => a.sequence - b.sequence)) {
        const process = processes.get(route.processCode);
        if (!process) throw new Error(`Process ${route.processCode} is missing`);
        const template = await tx.model_route_steps.upsert({
          where: { model_id_code: { model_id: model.id, code: route.code } },
          create: {
            model_id: model.id,
            process_id: process.id,
            code: route.code,
            name: route.name,
            sequence: route.sequence,
          },
          update: {},
        });
        report.modelRouteSteps += 1;
        const orderStep = await tx.bomlist_route_steps.upsert({
          where: { bomlist_id_code: { bomlist_id: order.id, code: route.code } },
          create: {
            bomlist_id: order.id,
            process_id: process.id,
            template_step_id: template.id,
            code: route.code,
            name: route.name,
            sequence: route.sequence,
          },
          update: {},
        });
        orderSteps.set(route.code, orderStep);
        report.orderRouteSteps += 1;
      }

      for (const registration of registrations) {
        const route = canonicalRoute(registration.subline);
        const line = lines.get(normalizeText(registration.subline));
        await tx.registscan.update({
          where: { id: registration.id },
          data: {
            order_number: normalizedOrder.order_number,
            bomlist_id: order.id,
            line_id: line.id,
            route_step_id: orderSteps.get(route.code).id,
            production_date: productionDate(registration.timestamps),
          },
        });
        report.registrations += 1;

        const registrationSpec =
          category === "ac" ? registration.ac_spec : registration.wm_spec;
        if (!registrationSpec) {
          throw new Error(`Missing ${category.toUpperCase()} spec for Registration ${registration.id}`);
        }
        for (const rule of componentRows(category, bomSpec, registrationSpec)) {
          const componentType = componentTypes.get(rule.code);
          await tx.registscan_components.upsert({
            where: {
              id_regist_component_type_id: {
                id_regist: registration.id,
                component_type_id: componentType.id,
              },
            },
            create: {
              id_regist: registration.id,
              component_type_id: componentType.id,
              reference_value: rule.referenceValue,
              expected_length: rule.expectedLength,
              is_required: rule.isRequired,
              prefix_snapshot: rule.prefix,
            },
            update: {
              reference_value: rule.referenceValue,
              expected_length: rule.expectedLength,
              is_required: rule.isRequired,
              prefix_snapshot: rule.prefix,
            },
          });
          report.registrationComponents += 1;
        }
      }
    }
    report.after = await targetCounts(tx);
    return report;
  }, { timeout: 120_000 });
}

function loadApprovedQuantities(filename) {
  if (!filename) throw new Error("BACKFILL_ORDER_QUANTITIES_FILE is required");
  return JSON.parse(fs.readFileSync(path.resolve(filename), "utf8"));
}

async function main() {
  dotenv.config({ path: path.resolve(__dirname, "../.env") });
  dotenv.config({ path: path.resolve(__dirname, "../.env.test"), override: true });
  assertBackfillWriteAllowed(
    process.env.DATABASE_URL,
    process.env.ALLOW_TEST_PHASE3_BACKFILL,
  );
  const approvedQuantities = loadApprovedQuantities(
    process.env.BACKFILL_ORDER_QUANTITIES_FILE,
  );
  const prisma = require("../lib/prisma");
  try {
    const report = await backfillPhase3(prisma, approvedQuantities);
    process.stdout.write(`${JSON.stringify(report)}\n`);
  } finally {
    await prisma.$disconnect();
  }
}

if (require.main === module) {
  main().catch((error) => {
    process.stderr.write(`Phase 3 backfill failed: ${error.message}\n`);
    process.exitCode = 1;
  });
}

module.exports = {
  BACKFILL_CONFIRMATION,
  assertBackfillWriteAllowed,
  backfillPhase3,
  buildQuantityAssignments,
  canonicalRoute,
  componentRows,
  normalizeText,
  productionDate,
};
