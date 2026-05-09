const XLSX = require("xlsx");
const path = require("path");

// ─── Style Helpers ────────────────────────────────────────────────────────────

const S = {
  title: {
    font: { bold: true, sz: 14, color: { rgb: "FFFFFF" }, name: "Calibri" },
    fill: { fgColor: { rgb: "1B3A6B" } },
    alignment: { horizontal: "center", vertical: "center" },
  },
  section: {
    font: { bold: true, sz: 11, color: { rgb: "FFFFFF" }, name: "Calibri" },
    fill: { fgColor: { rgb: "1A5276" } },
    alignment: { horizontal: "center", vertical: "center" },
  },
  hdrRed: {
    font: { bold: true, sz: 10, color: { rgb: "FFFFFF" }, name: "Calibri" },
    fill: { fgColor: { rgb: "C0392B" } },
    alignment: { horizontal: "center", vertical: "center", wrapText: true },
    border: bdr("AAAAAA"),
  },
  hdrBlue: {
    font: { bold: true, sz: 10, color: { rgb: "FFFFFF" }, name: "Calibri" },
    fill: { fgColor: { rgb: "1F618D" } },
    alignment: { horizontal: "center", vertical: "center", wrapText: true },
    border: bdr("AAAAAA"),
  },
  hdrGreen: {
    font: { bold: true, sz: 10, color: { rgb: "FFFFFF" }, name: "Calibri" },
    fill: { fgColor: { rgb: "1E8449" } },
    alignment: { horizontal: "center", vertical: "center", wrapText: true },
    border: bdr("AAAAAA"),
  },
  hdrOrange: {
    font: { bold: true, sz: 10, color: { rgb: "FFFFFF" }, name: "Calibri" },
    fill: { fgColor: { rgb: "BA4A00" } },
    alignment: { horizontal: "center", vertical: "center", wrapText: true },
    border: bdr("AAAAAA"),
  },
  hdrPurple: {
    font: { bold: true, sz: 10, color: { rgb: "FFFFFF" }, name: "Calibri" },
    fill: { fgColor: { rgb: "6C3483" } },
    alignment: { horizontal: "center", vertical: "center", wrapText: true },
    border: bdr("AAAAAA"),
  },
  hdrTeal: {
    font: { bold: true, sz: 10, color: { rgb: "FFFFFF" }, name: "Calibri" },
    fill: { fgColor: { rgb: "117A65" } },
    alignment: { horizontal: "center", vertical: "center", wrapText: true },
    border: bdr("AAAAAA"),
  },
  data: {
    font: { sz: 10, name: "Calibri" },
    alignment: { vertical: "center" },
    border: bdr("CCCCCC"),
  },
  dataAlt: {
    font: { sz: 10, name: "Calibri" },
    fill: { fgColor: { rgb: "EBF5FB" } },
    alignment: { vertical: "center" },
    border: bdr("CCCCCC"),
  },
  num: {
    font: { sz: 10, name: "Calibri" },
    alignment: { horizontal: "right", vertical: "center" },
    border: bdr("CCCCCC"),
    numFmt: "#,##0.00",
  },
  numAlt: {
    font: { sz: 10, name: "Calibri" },
    fill: { fgColor: { rgb: "EBF5FB" } },
    alignment: { horizontal: "right", vertical: "center" },
    border: bdr("CCCCCC"),
    numFmt: "#,##0.00",
  },
  numInt: {
    font: { sz: 10, name: "Calibri" },
    alignment: { horizontal: "right", vertical: "center" },
    border: bdr("CCCCCC"),
    numFmt: "#,##0",
  },
  numIntAlt: {
    font: { sz: 10, name: "Calibri" },
    fill: { fgColor: { rgb: "EBF5FB" } },
    alignment: { horizontal: "right", vertical: "center" },
    border: bdr("CCCCCC"),
    numFmt: "#,##0",
  },
  total: {
    font: { bold: true, sz: 11, color: { rgb: "FFFFFF" }, name: "Calibri" },
    fill: { fgColor: { rgb: "1B3A6B" } },
    alignment: { horizontal: "right", vertical: "center" },
    border: bdr("AAAAAA"),
    numFmt: "#,##0.00",
  },
  totalLabel: {
    font: { bold: true, sz: 11, color: { rgb: "FFFFFF" }, name: "Calibri" },
    fill: { fgColor: { rgb: "1B3A6B" } },
    alignment: { horizontal: "left", vertical: "center" },
    border: bdr("AAAAAA"),
  },
  formula: {
    font: { sz: 10, name: "Calibri" },
    fill: { fgColor: { rgb: "FDFEFE" } },
    alignment: { horizontal: "right", vertical: "center" },
    border: bdr("CCCCCC"),
    numFmt: "#,##0.00",
  },
  warn: {
    font: { bold: true, sz: 10, color: { rgb: "922B21" }, name: "Calibri" },
    fill: { fgColor: { rgb: "FADBD8" } },
    alignment: { horizontal: "center", vertical: "center" },
    border: bdr("CCCCCC"),
  },
  ok: {
    font: { sz: 10, color: { rgb: "1E8449" }, name: "Calibri" },
    fill: { fgColor: { rgb: "D5F5E3" } },
    alignment: { horizontal: "center", vertical: "center" },
    border: bdr("CCCCCC"),
  },
  date: {
    font: { sz: 10, name: "Calibri" },
    alignment: { horizontal: "center", vertical: "center" },
    border: bdr("CCCCCC"),
    numFmt: "dd-mmm-yyyy",
  },
  hint: {
    font: { italic: true, sz: 8, color: { rgb: "777777" }, name: "Calibri" },
    fill: { fgColor: { rgb: "FDFEFE" } },
    alignment: { horizontal: "center", vertical: "center", wrapText: true },
    border: bdr("CCCCCC"),
  },
};

function bdr(rgb) {
  return {
    top: { style: "thin", color: { rgb } },
    bottom: { style: "thin", color: { rgb } },
    left: { style: "thin", color: { rgb } },
    right: { style: "thin", color: { rgb } },
  };
}

function col(n) {
  let s = "";
  for (let a = n; a > 0; ) {
    const r = (a - 1) % 26;
    s = String.fromCharCode(65 + r) + s;
    a = Math.floor((a - 1) / 26);
  }
  return s;
}

function setC(ws, c, r, v, s, t) {
  const ref = `${col(c)}${r}`;
  const type =
    t || (v instanceof Date ? "d" : typeof v === "number" ? "n" : "s");
  ws[ref] = { v, t: type, ...(s ? { s } : {}) };
}

function mergeRow(ws, r, c1, c2) {
  if (!ws["!merges"]) ws["!merges"] = [];
  ws["!merges"].push({
    s: { r: r - 1, c: c1 - 1 },
    e: { r: r - 1, c: c2 - 1 },
  });
}

function setRef(ws, maxC, maxR) {
  ws["!ref"] = `A1:${col(maxC)}${maxR}`;
}

// ─── Current Month Info ───────────────────────────────────────────────────────

const NOW = new Date();
const MONTH_NAME = NOW.toLocaleString("en-IN", { month: "long" });
const YEAR = NOW.getFullYear();
const FY = NOW.getMonth() >= 3 ? `${YEAR}-${YEAR + 1}` : `${YEAR - 1}-${YEAR}`;

// ─── Sample Data ──────────────────────────────────────────────────────────────

const PRODUCTS = [
  {
    name: "Cotton Saree - Red",
    cat: "Sarees",
    sub: "Cotton",
    sku: "SAR-001",
    hsn: "5007",
    unit: "MTR",
    qty: 50,
    minQty: 10,
    pp: 250,
    sp: 450,
    wp: 380,
    gst: 5,
    sup: "Textiles India Pvt",
  },
  {
    name: "Silk Saree - Golden",
    cat: "Sarees",
    sub: "Silk",
    sku: "SAR-002",
    hsn: "5007",
    unit: "MTR",
    qty: 8,
    minQty: 10,
    pp: 1200,
    sp: 2200,
    wp: 1800,
    gst: 12,
    sup: "Silk Palace",
  },
  {
    name: "Georgette Fabric - Blue",
    cat: "Fabrics",
    sub: "Georgette",
    sku: "FAB-001",
    hsn: "5407",
    unit: "MTR",
    qty: 100,
    minQty: 20,
    pp: 80,
    sp: 150,
    wp: 120,
    gst: 5,
    sup: "Fabric World",
  },
  {
    name: "Cotton Kurta Piece",
    cat: "Dress Material",
    sub: "Cotton",
    sku: "DM-001",
    hsn: "5208",
    unit: "CUT",
    qty: 60,
    minQty: 10,
    pp: 180,
    sp: 350,
    wp: 280,
    gst: 5,
    sup: "Textiles India Pvt",
  },
  {
    name: "Linen Shirt Fabric",
    cat: "Fabrics",
    sub: "Linen",
    sku: "FAB-002",
    hsn: "5309",
    unit: "MTR",
    qty: 5,
    minQty: 15,
    pp: 220,
    sp: 420,
    wp: 360,
    gst: 12,
    sup: "Linen House",
  },
  {
    name: "Polyester Saree - Green",
    cat: "Sarees",
    sub: "Polyester",
    sku: "SAR-003",
    hsn: "5407",
    unit: "PCS",
    qty: 35,
    minQty: 8,
    pp: 350,
    sp: 650,
    wp: 550,
    gst: 5,
    sup: "Fabric World",
  },
  {
    name: "Woolen Shawl",
    cat: "Shawls",
    sub: "Wool",
    sku: "SHW-001",
    hsn: "6117",
    unit: "PCS",
    qty: 25,
    minQty: 5,
    pp: 500,
    sp: 950,
    wp: 800,
    gst: 12,
    sup: "Kashmir Woolen Co",
  },
  {
    name: "Denim Fabric",
    cat: "Fabrics",
    sub: "Denim",
    sku: "FAB-003",
    hsn: "5209",
    unit: "MTR",
    qty: 200,
    minQty: 30,
    pp: 120,
    sp: 220,
    wp: 180,
    gst: 12,
    sup: "Denim Direct",
  },
  {
    name: "Chiffon Dupatta - Pink",
    cat: "Dupattas",
    sub: "Chiffon",
    sku: "DUP-001",
    hsn: "6214",
    unit: "PCS",
    qty: 40,
    minQty: 10,
    pp: 90,
    sp: 180,
    wp: 150,
    gst: 5,
    sup: "Silk Palace",
  },
  {
    name: "Embroidered Blouse Piece",
    cat: "Dress Material",
    sub: "Silk",
    sku: "DM-002",
    hsn: "5007",
    unit: "CUT",
    qty: 3,
    minQty: 5,
    pp: 450,
    sp: 900,
    wp: 750,
    gst: 12,
    sup: "Textiles India Pvt",
  },
];

const PURCHASES = [
  {
    date: "01-May-2025",
    inv: "INV-2025-001",
    sup: "Textiles India Pvt",
    item: "Cotton Saree - Red",
    hsn: "5007",
    qty: 20,
    unit: "MTR",
    rate: 250,
    taxable: 5000,
    gst: 5,
    cgst: 125.0,
    sgst: 125.0,
    igst: 0,
    total: 5250.0,
  },
  {
    date: "03-May-2025",
    inv: "INV-2025-002",
    sup: "Silk Palace",
    item: "Silk Saree - Golden",
    hsn: "5007",
    qty: 5,
    unit: "MTR",
    rate: 1200,
    taxable: 6000,
    gst: 12,
    cgst: 360.0,
    sgst: 360.0,
    igst: 0,
    total: 6720.0,
  },
  {
    date: "05-May-2025",
    inv: "INV-2025-003",
    sup: "Fabric World",
    item: "Georgette Fabric - Blue",
    hsn: "5407",
    qty: 50,
    unit: "MTR",
    rate: 80,
    taxable: 4000,
    gst: 5,
    cgst: 100.0,
    sgst: 100.0,
    igst: 0,
    total: 4200.0,
  },
  {
    date: "07-May-2025",
    inv: "INV-2025-004",
    sup: "Linen House",
    item: "Linen Shirt Fabric",
    hsn: "5309",
    qty: 30,
    unit: "MTR",
    rate: 220,
    taxable: 6600,
    gst: 12,
    cgst: 396.0,
    sgst: 396.0,
    igst: 0,
    total: 7392.0,
  },
  {
    date: "10-May-2025",
    inv: "INV-2025-005",
    sup: "Denim Direct",
    item: "Denim Fabric",
    hsn: "5209",
    qty: 100,
    unit: "MTR",
    rate: 120,
    taxable: 12000,
    gst: 12,
    cgst: 720.0,
    sgst: 720.0,
    igst: 0,
    total: 13440.0,
  },
  {
    date: "12-May-2025",
    inv: "INV-2025-006",
    sup: "Kashmir Woolen Co",
    item: "Woolen Shawl",
    hsn: "6117",
    qty: 10,
    unit: "PCS",
    rate: 500,
    taxable: 5000,
    gst: 12,
    cgst: 300.0,
    sgst: 300.0,
    igst: 0,
    total: 5600.0,
  },
];

const SALES = [
  {
    date: "02-May-2025",
    inv: "SALE-001",
    cust: "Ravi Textiles",
    item: "Cotton Saree - Red",
    hsn: "5007",
    qty: 5,
    unit: "MTR",
    rate: 450,
    taxable: 2250,
    gst: 5,
    cgst: 56.25,
    sgst: 56.25,
    igst: 0,
    total: 2362.5,
  },
  {
    date: "04-May-2025",
    inv: "SALE-002",
    cust: "Meera Fashion",
    item: "Silk Saree - Golden",
    hsn: "5007",
    qty: 2,
    unit: "MTR",
    rate: 2200,
    taxable: 4400,
    gst: 12,
    cgst: 264.0,
    sgst: 264.0,
    igst: 0,
    total: 4928.0,
  },
  {
    date: "06-May-2025",
    inv: "SALE-003",
    cust: "Lakshmi Stores",
    item: "Georgette Fabric - Blue",
    hsn: "5407",
    qty: 20,
    unit: "MTR",
    rate: 150,
    taxable: 3000,
    gst: 5,
    cgst: 75.0,
    sgst: 75.0,
    igst: 0,
    total: 3150.0,
  },
  {
    date: "08-May-2025",
    inv: "SALE-004",
    cust: "Krishna Garments",
    item: "Denim Fabric",
    hsn: "5209",
    qty: 30,
    unit: "MTR",
    rate: 220,
    taxable: 6600,
    gst: 12,
    cgst: 396.0,
    sgst: 396.0,
    igst: 0,
    total: 7392.0,
  },
  {
    date: "09-May-2025",
    inv: "SALE-005",
    cust: "Priya Boutique",
    item: "Woolen Shawl",
    hsn: "6117",
    qty: 4,
    unit: "PCS",
    rate: 950,
    taxable: 3800,
    gst: 12,
    cgst: 228.0,
    sgst: 228.0,
    igst: 0,
    total: 4256.0,
  },
  {
    date: "10-May-2025",
    inv: "SALE-006",
    cust: "Style Junction",
    item: "Chiffon Dupatta - Pink",
    hsn: "6214",
    qty: 10,
    unit: "PCS",
    rate: 180,
    taxable: 1800,
    gst: 5,
    cgst: 45.0,
    sgst: 45.0,
    igst: 0,
    total: 1890.0,
  },
];

// ─── SHEET 1: Product Import Template ────────────────────────────────────────

const buildProductSheet = () => {
  const ws = {};
  const COLS = [
    ["productName", "Product Name *", S.hdrRed, 28, "Full product name"],
    ["category", "Category *", S.hdrRed, 20, "Sarees / Fabrics / etc."],
    ["subCategory", "Sub Category", S.hdrBlue, 18, "Cotton / Silk / Polyester"],
    ["sku", "SKU Code", S.hdrBlue, 16, "Leave blank = auto"],
    ["hsnCode", "HSN Code", S.hdrBlue, 14, "e.g. 5007, 5208"],
    ["unitType", "Unit Type *", S.hdrRed, 12, "PCS/MTR/CUT/ROLL"],
    ["quantity", "Opening Stock *", S.hdrRed, 14, "Current qty"],
    [
      "purchasePrice",
      "Purchase Price ₹ *",
      S.hdrRed,
      16,
      "Cost price excl. GST",
    ],
    ["sellingPrice", "Selling Price ₹ *", S.hdrRed, 16, "MRP excl. GST"],
    [
      "wholesalePrice",
      "Wholesale Price ₹",
      S.hdrBlue,
      16,
      "Bulk price excl. GST",
    ],
    ["gstPercent", "GST %", S.hdrBlue, 10, "0/5/12/18/28"],
    ["supplierName", "Supplier Name", S.hdrBlue, 24, "Vendor / supplier"],
    ["minimumStock", "Min. Stock Alert", S.hdrBlue, 14, "Low stock threshold"],
  ];

  // Title
  setC(ws, 1, 1, "🧵  HABIBS TEXTILE — PRODUCT IMPORT TEMPLATE", S.title);
  mergeRow(ws, 1, 1, COLS.length);
  setC(
    ws,
    1,
    2,
    `Financial Year: ${FY}  •  Red = Required  •  Blue = Optional  •  Fill from Row 5`,
    S.hint,
  );
  mergeRow(ws, 2, 1, COLS.length);

  // Hints row
  COLS.forEach(([, , , , hint], i) => setC(ws, i + 1, 3, hint, S.hint));

  // Headers
  COLS.forEach(([, label, style], i) => setC(ws, i + 1, 4, label, style));

  // Sample rows
  const samples = PRODUCTS.map((p) => [
    p.name,
    p.cat,
    p.sub,
    p.sku,
    p.hsn,
    p.unit,
    p.qty,
    p.pp,
    p.sp,
    p.wp,
    p.gst,
    p.sup,
    p.minQty,
  ]);
  samples.forEach((row, ri) => {
    const alt = ri % 2 === 1;
    row.forEach((v, ci) => {
      const isNum = typeof v === "number";
      const s = isNum ? (alt ? S.numAlt : S.num) : alt ? S.dataAlt : S.data;
      setC(ws, ci + 1, 5 + ri, v, s);
    });
  });

  // Blank rows
  for (let r = 15; r <= 104; r++) {
    const alt = (r - 5) % 2 === 1;
    COLS.forEach((_, ci) => {
      const numCols = [6, 7, 8, 9, 10, 12];
      const isNum = numCols.includes(ci + 1);
      setC(
        ws,
        ci + 1,
        r,
        "",
        isNum ? (alt ? S.numAlt : S.num) : alt ? S.dataAlt : S.data,
      );
    });
  }

  ws["!cols"] = COLS.map(([, , , w]) => ({ wch: w }));
  ws["!rows"] = [
    { hpt: 30 },
    { hpt: 18 },
    { hpt: 30 },
    { hpt: 26 },
    ...Array(100).fill({ hpt: 20 }),
  ];
  ws["!dataValidations"] = [
    {
      sqref: "F5:F104",
      type: "list",
      formula1: '"PCS,MTR,CUT,ROLL"',
      errorTitle: "Invalid Unit",
      error: "Select PCS, MTR, CUT, or ROLL",
    },
    {
      sqref: "K5:K104",
      type: "list",
      formula1: '"0,5,12,18,28"',
      errorTitle: "Invalid GST",
      error: "GST must be 0,5,12,18 or 28",
    },
  ];
  setRef(ws, COLS.length, 104);
  return ws;
};

// ─── SHEET 2: Tally Stock Master ─────────────────────────────────────────────

const buildTallyStockMaster = () => {
  const ws = {};
  const COLS = [
    ["Name of Item", S.hdrOrange, 30],
    ["Under (Stock Group)", S.hdrOrange, 22],
    ["Units", S.hdrOrange, 12],
    ["HSN / SAC Code", S.hdrOrange, 16],
    ["GST Rate %", S.hdrOrange, 12],
    ["Tax Type", S.hdrOrange, 14],
    ["Opening Qty", S.hdrOrange, 14],
    ["Opening Rate (₹)", S.hdrOrange, 18],
    ["Opening Value (₹)", S.hdrOrange, 18],
    ["Godown", S.hdrOrange, 18],
  ];

  setC(ws, 1, 1, "HABIBS TEXTILE — TALLY PRIME STOCK MASTER IMPORT", S.title);
  mergeRow(ws, 1, 1, COLS.length);
  setC(
    ws,
    1,
    2,
    "Go to: Gateway of Tally → Import Data → Masters → Stock Items   •   Format: Excel (XLSX)",
    { ...S.hint, fill: { fgColor: { rgb: "FEF9E7" } } },
  );
  mergeRow(ws, 2, 1, COLS.length);
  setC(ws, 1, 3, `FY ${FY}  |  Generated: ${NOW.toLocaleDateString("en-IN")}`, {
    ...S.hint,
    fill: { fgColor: { rgb: "FEF9E7" } },
  });
  mergeRow(ws, 3, 1, COLS.length);

  COLS.forEach(([label, style], i) => setC(ws, i + 1, 4, label, style));

  PRODUCTS.forEach((p, ri) => {
    const alt = ri % 2 === 1;
    const openVal = +(p.qty * p.pp).toFixed(2);
    const row = [
      p.name,
      p.cat,
      p.unit === "MTR" ? "Mtr" : p.unit === "PCS" ? "Nos" : p.unit,
      p.hsn,
      p.gst,
      "GST",
      p.qty,
      p.pp,
      openVal,
      "Main Location",
    ];
    row.forEach((v, ci) => {
      const isNum = typeof v === "number";
      setC(
        ws,
        ci + 1,
        5 + ri,
        v,
        isNum ? (alt ? S.numAlt : S.num) : alt ? S.dataAlt : S.data,
      );
    });
  });

  // Total row
  const totalQty = PRODUCTS.reduce((s, p) => s + p.qty, 0);
  const totalVal = PRODUCTS.reduce((s, p) => s + p.qty * p.pp, 0);
  const tr = 5 + PRODUCTS.length;
  setC(ws, 1, tr, "TOTAL", S.totalLabel);
  mergeRow(ws, tr, 1, 6);
  setC(ws, 7, tr, totalQty, S.total);
  setC(ws, 8, tr, "", S.total);
  setC(ws, 9, tr, +totalVal.toFixed(2), S.total);
  setC(ws, 10, tr, "", S.total);

  ws["!cols"] = COLS.map(([, , w]) => ({ wch: w }));
  ws["!rows"] = [
    { hpt: 28 },
    { hpt: 20 },
    { hpt: 18 },
    { hpt: 26 },
    ...Array(PRODUCTS.length + 1).fill({ hpt: 20 }),
  ];
  setRef(ws, COLS.length, tr);
  return ws;
};

// ─── SHEET 3: Tally Purchase Vouchers ────────────────────────────────────────

const buildTallyPurchase = () => {
  const ws = {};
  const COLS = [
    ["Date", S.hdrOrange, 14],
    ["Voucher Type", S.hdrOrange, 16],
    ["Voucher No.", S.hdrOrange, 16],
    ["Supplier Name", S.hdrOrange, 26],
    ["Stock Item", S.hdrOrange, 28],
    ["HSN Code", S.hdrOrange, 12],
    ["Qty", S.hdrOrange, 10],
    ["Unit", S.hdrOrange, 10],
    ["Rate (₹)", S.hdrOrange, 14],
    ["Taxable Amt (₹)", S.hdrOrange, 16],
    ["GST %", S.hdrOrange, 10],
    ["CGST (₹)", S.hdrOrange, 14],
    ["SGST (₹)", S.hdrOrange, 14],
    ["IGST (₹)", S.hdrOrange, 14],
    ["Total Amt (₹)", S.hdrOrange, 16],
    ["Ledger (Dr)", S.hdrOrange, 22],
  ];

  setC(
    ws,
    1,
    1,
    `HABIBS TEXTILE — TALLY PURCHASE VOUCHER REGISTER  |  ${MONTH_NAME} ${YEAR}`,
    S.title,
  );
  mergeRow(ws, 1, 1, COLS.length);
  setC(
    ws,
    1,
    2,
    "Go to: Gateway of Tally → Import Data → Vouchers → Purchase Vouchers",
    { ...S.hint, fill: { fgColor: { rgb: "FEF9E7" } } },
  );
  mergeRow(ws, 2, 1, COLS.length);

  COLS.forEach(([label, style], i) => setC(ws, i + 1, 3, label, style));

  PURCHASES.forEach((p, ri) => {
    const alt = ri % 2 === 1;
    const ds = alt ? S.dataAlt : S.data;
    const ns = alt ? S.numAlt : S.num;
    setC(ws, 1, 4 + ri, p.date, ds);
    setC(ws, 2, 4 + ri, "Purchase", ds);
    setC(ws, 3, 4 + ri, p.inv, ds);
    setC(ws, 4, 4 + ri, p.sup, ds);
    setC(ws, 5, 4 + ri, p.item, ds);
    setC(ws, 6, 4 + ri, p.hsn, ds);
    setC(ws, 7, 4 + ri, p.qty, { ...ns, numFmt: "#,##0" });
    setC(ws, 8, 4 + ri, p.unit, ds);
    setC(ws, 9, 4 + ri, p.rate, ns);
    setC(ws, 10, 4 + ri, p.taxable, ns);
    setC(ws, 11, 4 + ri, p.gst, { ...ns, numFmt: '0"%"' });
    setC(ws, 12, 4 + ri, p.cgst, ns);
    setC(ws, 13, 4 + ri, p.sgst, ns);
    setC(ws, 14, 4 + ri, p.igst, ns);
    setC(ws, 15, 4 + ri, p.total, ns);
    setC(ws, 16, 4 + ri, "Purchase Account", ds);
  });

  // Totals
  const tr = 4 + PURCHASES.length;
  const sumF = (key) => PURCHASES.reduce((s, p) => s + p[key], 0);
  setC(ws, 1, tr, "TOTAL", S.totalLabel);
  mergeRow(ws, tr, 1, 9);
  setC(ws, 10, tr, +sumF("taxable").toFixed(2), S.total);
  setC(ws, 11, tr, "", S.total);
  setC(ws, 12, tr, +sumF("cgst").toFixed(2), S.total);
  setC(ws, 13, tr, +sumF("sgst").toFixed(2), S.total);
  setC(ws, 14, tr, +sumF("igst").toFixed(2), S.total);
  setC(ws, 15, tr, +sumF("total").toFixed(2), S.total);
  setC(ws, 16, tr, "", S.total);

  ws["!cols"] = COLS.map(([, , w]) => ({ wch: w }));
  ws["!rows"] = [
    { hpt: 28 },
    { hpt: 18 },
    { hpt: 26 },
    ...Array(PURCHASES.length + 1).fill({ hpt: 20 }),
  ];
  setRef(ws, COLS.length, tr);
  return ws;
};

// ─── SHEET 4: Tally Sales Vouchers ───────────────────────────────────────────

const buildTallySales = () => {
  const ws = {};
  const COLS = [
    ["Date", S.hdrGreen, 14],
    ["Voucher Type", S.hdrGreen, 16],
    ["Voucher No.", S.hdrGreen, 16],
    ["Customer Name", S.hdrGreen, 26],
    ["Stock Item", S.hdrGreen, 28],
    ["HSN Code", S.hdrGreen, 12],
    ["Qty", S.hdrGreen, 10],
    ["Unit", S.hdrGreen, 10],
    ["Rate (₹)", S.hdrGreen, 14],
    ["Taxable Amt (₹)", S.hdrGreen, 16],
    ["GST %", S.hdrGreen, 10],
    ["CGST (₹)", S.hdrGreen, 14],
    ["SGST (₹)", S.hdrGreen, 14],
    ["IGST (₹)", S.hdrGreen, 14],
    ["Total Amt (₹)", S.hdrGreen, 16],
    ["Ledger (Cr)", S.hdrGreen, 22],
  ];

  setC(
    ws,
    1,
    1,
    `HABIBS TEXTILE — TALLY SALES VOUCHER REGISTER  |  ${MONTH_NAME} ${YEAR}`,
    S.title,
  );
  mergeRow(ws, 1, 1, COLS.length);
  setC(
    ws,
    1,
    2,
    "Go to: Gateway of Tally → Import Data → Vouchers → Sales Vouchers",
    { ...S.hint, fill: { fgColor: { rgb: "EAFAF1" } } },
  );
  mergeRow(ws, 2, 1, COLS.length);

  COLS.forEach(([label, style], i) => setC(ws, i + 1, 3, label, style));

  SALES.forEach((p, ri) => {
    const alt = ri % 2 === 1;
    const ds = alt ? S.dataAlt : S.data;
    const ns = alt ? S.numAlt : S.num;
    setC(ws, 1, 4 + ri, p.date, ds);
    setC(ws, 2, 4 + ri, "Sales", ds);
    setC(ws, 3, 4 + ri, p.inv, ds);
    setC(ws, 4, 4 + ri, p.cust, ds);
    setC(ws, 5, 4 + ri, p.item, ds);
    setC(ws, 6, 4 + ri, p.hsn, ds);
    setC(ws, 7, 4 + ri, p.qty, { ...ns, numFmt: "#,##0" });
    setC(ws, 8, 4 + ri, p.unit, ds);
    setC(ws, 9, 4 + ri, p.rate, ns);
    setC(ws, 10, 4 + ri, p.taxable, ns);
    setC(ws, 11, 4 + ri, p.gst, { ...ns, numFmt: '0"%"' });
    setC(ws, 12, 4 + ri, p.cgst, ns);
    setC(ws, 13, 4 + ri, p.sgst, ns);
    setC(ws, 14, 4 + ri, p.igst, ns);
    setC(ws, 15, 4 + ri, p.total, ns);
    setC(ws, 16, 4 + ri, "Sales Account", ds);
  });

  const tr = 4 + SALES.length;
  const sumF = (key) => SALES.reduce((s, p) => s + p[key], 0);
  setC(ws, 1, tr, "TOTAL", S.totalLabel);
  mergeRow(ws, tr, 1, 9);
  setC(ws, 10, tr, +sumF("taxable").toFixed(2), S.total);
  setC(ws, 11, tr, "", S.total);
  setC(ws, 12, tr, +sumF("cgst").toFixed(2), S.total);
  setC(ws, 13, tr, +sumF("sgst").toFixed(2), S.total);
  setC(ws, 14, tr, +sumF("igst").toFixed(2), S.total);
  setC(ws, 15, tr, +sumF("total").toFixed(2), S.total);
  setC(ws, 16, tr, "", S.total);

  ws["!cols"] = COLS.map(([, , w]) => ({ wch: w }));
  ws["!rows"] = [
    { hpt: 28 },
    { hpt: 18 },
    { hpt: 26 },
    ...Array(SALES.length + 1).fill({ hpt: 20 }),
  ];
  setRef(ws, COLS.length, tr);
  return ws;
};

// ─── SHEET 5: Monthly Audit Report (IT Dept) ─────────────────────────────────

const buildMonthlyAudit = () => {
  const ws = {};
  let r = 1;

  // ── Header ──
  setC(
    ws,
    1,
    r,
    `HABIBS TEXTILE — MONTHLY IT AUDIT REPORT  |  ${MONTH_NAME.toUpperCase()} ${YEAR}`,
    S.title,
  );
  mergeRow(ws, r, 1, 10);
  r++;
  setC(
    ws,
    1,
    r,
    `Financial Year: ${FY}  |  Prepared by: IT / Accounts Department  |  Date: ${NOW.toLocaleDateString("en-IN")}`,
    S.hint,
  );
  mergeRow(ws, r, 1, 10);
  r += 2;

  // ── Section A: Business Summary ──
  setC(ws, 1, r, "A.  BUSINESS SUMMARY — SNAPSHOT", S.section);
  mergeRow(ws, r, 1, 10);
  r++;

  const purchaseTaxable = PURCHASES.reduce((s, p) => s + p.taxable, 0);
  const purchaseTax = PURCHASES.reduce(
    (s, p) => s + p.cgst + p.sgst + p.igst,
    0,
  );
  const purchaseTotal = PURCHASES.reduce((s, p) => s + p.total, 0);
  const saleTaxable = SALES.reduce((s, p) => s + p.taxable, 0);
  const saleTax = SALES.reduce((s, p) => s + p.cgst + p.sgst + p.igst, 0);
  const saleTotal = SALES.reduce((s, p) => s + p.total, 0);
  const grossProfit = saleTaxable - purchaseTaxable;
  const gpPct = ((grossProfit / saleTaxable) * 100).toFixed(1);
  const stockValue = PRODUCTS.reduce((s, p) => s + p.qty * p.pp, 0);
  const lowStock = PRODUCTS.filter((p) => p.qty <= p.minQty);

  const summaryRows = [
    ["Total Purchase Invoices (Month)", PURCHASES.length, "invoices", null],
    ["Total Purchase Value (incl. GST)", purchaseTotal, "₹", "num"],
    ["Total Sales Invoices (Month)", SALES.length, "invoices", null],
    ["Total Sales Value (incl. GST)", saleTotal, "₹", "num"],
    ["Gross Profit (Taxable basis)", grossProfit, "₹", "num"],
    ["Gross Profit %", gpPct, "%", null],
    ["Closing Stock Value (Purchase cost)", stockValue, "₹", "num"],
    ["Total SKUs in System", PRODUCTS.length, "items", null],
    [
      "Low Stock Alerts",
      lowStock.length,
      "items",
      lowStock.length > 0 ? "warn" : "ok",
    ],
  ];

  summaryRows.forEach(([label, val, unit, type], i) => {
    const alt = i % 2 === 1;
    setC(ws, 1, r, `A${i + 1}.`, alt ? S.dataAlt : S.data);
    setC(
      ws,
      2,
      r,
      label,
      alt
        ? { ...S.dataAlt, font: { bold: true, sz: 10, name: "Calibri" } }
        : { ...S.data, font: { bold: true, sz: 10, name: "Calibri" } },
    );
    mergeRow(ws, r, 2, 6);
    setC(
      ws,
      7,
      r,
      typeof val === "number" ? val : parseFloat(val),
      type === "num" ? (alt ? S.numAlt : S.num) : alt ? S.dataAlt : S.data,
    );
    setC(
      ws,
      8,
      r,
      unit,
      type === "warn"
        ? S.warn
        : type === "ok"
          ? S.ok
          : alt
            ? S.dataAlt
            : S.data,
    );
    mergeRow(ws, r, 8, 10);
    r++;
  });
  r++;

  // ── Section B: Stock Status ──
  setC(ws, 1, r, "B.  CURRENT STOCK STATUS", S.section);
  mergeRow(ws, r, 1, 10);
  r++;

  const stockHdrs = [
    "#",
    "SKU",
    "Product Name",
    "Category",
    "Unit",
    "Current Qty",
    "Min Qty",
    "Purchase Rate ₹",
    "Stock Value ₹",
    "Status",
  ];
  const stockHdrStyles = [
    S.hdrPurple,
    S.hdrPurple,
    S.hdrPurple,
    S.hdrPurple,
    S.hdrPurple,
    S.hdrPurple,
    S.hdrPurple,
    S.hdrPurple,
    S.hdrPurple,
    S.hdrPurple,
  ];
  stockHdrs.forEach((h, i) => setC(ws, i + 1, r, h, stockHdrStyles[i]));
  r++;

  PRODUCTS.forEach((p, i) => {
    const alt = i % 2 === 1;
    const isLow = p.qty <= p.minQty;
    const ds = alt ? S.dataAlt : S.data;
    const ns = alt ? S.numAlt : S.num;
    setC(ws, 1, r, i + 1, { ...ns, numFmt: "#,##0" });
    setC(ws, 2, r, p.sku, ds);
    setC(ws, 3, r, p.name, ds);
    setC(ws, 4, r, p.cat, ds);
    setC(ws, 5, r, p.unit, ds);
    setC(ws, 6, r, p.qty, isLow ? S.warn : { ...ns, numFmt: "#,##0" });
    setC(ws, 7, r, p.minQty, { ...ns, numFmt: "#,##0" });
    setC(ws, 8, r, p.pp, ns);
    setC(ws, 9, r, +(p.qty * p.pp).toFixed(2), ns);
    setC(ws, 10, r, isLow ? "⚠ LOW STOCK" : "✓ OK", isLow ? S.warn : S.ok);
    r++;
  });

  // Stock totals
  setC(ws, 1, r, "TOTAL STOCK VALUE", S.totalLabel);
  mergeRow(ws, r, 1, 8);
  setC(ws, 9, r, +stockValue.toFixed(2), S.total);
  setC(ws, 10, r, "", S.total);
  r += 2;

  // ── Section C: Purchase Summary by Supplier ──
  setC(ws, 1, r, "C.  PURCHASE SUMMARY BY SUPPLIER", S.section);
  mergeRow(ws, r, 1, 10);
  r++;

  const supHdrs = [
    "Supplier Name",
    "Invoices",
    "Taxable Amt ₹",
    "CGST ₹",
    "SGST ₹",
    "IGST ₹",
    "Total Amt ₹",
  ];
  supHdrs.forEach((h, i) => setC(ws, i + 1, r, h, S.hdrOrange));
  r++;

  const supMap = {};
  PURCHASES.forEach((p) => {
    if (!supMap[p.sup])
      supMap[p.sup] = {
        count: 0,
        taxable: 0,
        cgst: 0,
        sgst: 0,
        igst: 0,
        total: 0,
      };
    supMap[p.sup].count++;
    supMap[p.sup].taxable += p.taxable;
    supMap[p.sup].cgst += p.cgst;
    supMap[p.sup].sgst += p.sgst;
    supMap[p.sup].igst += p.igst;
    supMap[p.sup].total += p.total;
  });

  Object.entries(supMap).forEach(([name, d], i) => {
    const alt = i % 2 === 1;
    const ns = alt ? S.numAlt : S.num;
    const ds = alt ? S.dataAlt : S.data;
    setC(ws, 1, r, name, ds);
    setC(ws, 2, r, d.count, { ...ns, numFmt: "#,##0" });
    setC(ws, 3, r, +d.taxable.toFixed(2), ns);
    setC(ws, 4, r, +d.cgst.toFixed(2), ns);
    setC(ws, 5, r, +d.sgst.toFixed(2), ns);
    setC(ws, 6, r, +d.igst.toFixed(2), ns);
    setC(ws, 7, r, +d.total.toFixed(2), ns);
    r++;
  });

  setC(ws, 1, r, "TOTAL", S.totalLabel);
  mergeRow(ws, r, 1, 2);
  setC(ws, 3, r, +purchaseTaxable.toFixed(2), S.total);
  setC(
    ws,
    4,
    r,
    +PURCHASES.reduce((s, p) => s + p.cgst, 0).toFixed(2),
    S.total,
  );
  setC(
    ws,
    5,
    r,
    +PURCHASES.reduce((s, p) => s + p.sgst, 0).toFixed(2),
    S.total,
  );
  setC(ws, 6, r, 0, S.total);
  setC(ws, 7, r, +purchaseTotal.toFixed(2), S.total);
  r += 2;

  // ── Section D: GST Summary ──
  setC(ws, 1, r, "D.  GST SUMMARY (FOR GSTR-3B FILING)", S.section);
  mergeRow(ws, r, 1, 10);
  r++;

  const gstHdrs = [
    "Description",
    "Taxable Value ₹",
    "CGST ₹",
    "SGST ₹",
    "IGST ₹",
    "Total GST ₹",
  ];
  gstHdrs.forEach((h, i) => setC(ws, i + 1, r, h, S.hdrTeal));
  r++;

  const gstRows = [
    [
      "Output GST (Sales)",
      saleTaxable,
      SALES.reduce((s, p) => s + p.cgst, 0),
      SALES.reduce((s, p) => s + p.sgst, 0),
      0,
      saleTax,
    ],
    [
      "Input GST (Purchases)",
      purchaseTaxable,
      PURCHASES.reduce((s, p) => s + p.cgst, 0),
      PURCHASES.reduce((s, p) => s + p.sgst, 0),
      0,
      purchaseTax,
    ],
    [
      "Net GST Payable",
      saleTaxable - purchaseTaxable,
      saleTax / 2 - purchaseTax / 2,
      saleTax / 2 - purchaseTax / 2,
      0,
      saleTax - purchaseTax,
    ],
  ];

  gstRows.forEach((row, i) => {
    const alt = i % 2 === 1;
    const ns = alt ? S.numAlt : S.num;
    const ds = alt ? S.dataAlt : S.data;
    setC(ws, 1, r, row[0], i === 2 ? S.totalLabel : ds);
    row
      .slice(1)
      .forEach((v, ci) =>
        setC(ws, ci + 2, r, +v.toFixed(2), i === 2 ? S.total : ns),
      );
    r++;
  });
  r += 2;

  // ── Section E: Low Stock Alerts ──
  setC(ws, 1, r, "E.  LOW STOCK ALERTS — ACTION REQUIRED", S.section);
  mergeRow(ws, r, 1, 10);
  r++;

  if (lowStock.length === 0) {
    setC(
      ws,
      1,
      r,
      "✅  All products are adequately stocked. No action required.",
      S.ok,
    );
    mergeRow(ws, r, 1, 10);
    r++;
  } else {
    const lsHdrs = [
      "SKU",
      "Product Name",
      "Category",
      "Supplier",
      "Current Qty",
      "Min Qty",
      "Shortfall",
      "Reorder Now?",
    ];
    lsHdrs.forEach((h, i) => setC(ws, i + 1, r, h, S.hdrRed));
    r++;
    lowStock.forEach((p, i) => {
      const alt = i % 2 === 1;
      const shortfall = Math.max(0, p.minQty - p.qty);
      setC(ws, 1, r, p.sku, alt ? S.dataAlt : S.data);
      setC(ws, 2, r, p.name, alt ? S.dataAlt : S.data);
      setC(ws, 3, r, p.cat, alt ? S.dataAlt : S.data);
      setC(ws, 4, r, p.sup, alt ? S.dataAlt : S.data);
      setC(ws, 5, r, p.qty, S.warn);
      setC(ws, 6, r, p.minQty, alt ? S.numAlt : S.num);
      setC(ws, 7, r, shortfall, S.warn);
      setC(ws, 8, r, "YES — URGENT", S.warn);
      r++;
    });
  }
  r++;

  // ── Section F: Audit Checklist ──
  setC(ws, 1, r, "F.  MONTHLY IT AUDIT CHECKLIST", S.section);
  mergeRow(ws, r, 1, 10);
  r++;

  const checklist = [
    [
      "1",
      "Verify all purchase invoices entered in system match physical invoices",
    ],
    ["2", "Confirm stock quantities match physical count (stocktaking)"],
    ["3", "Verify all barcode scans are mapped correctly to SKUs"],
    ["4", "Check for duplicate invoice numbers in the system"],
    ["5", "Review low stock items and initiate purchase orders"],
    ["6", "Validate GST amounts (CGST + SGST = Total GST for intra-state)"],
    ["7", "Ensure all product images are uploaded and correctly tagged"],
    ["8", "Check user access logs — any unauthorized login attempts?"],
    ["9", "Verify API response times — flag if >2s average"],
    ["10", "Backup database and confirm backup integrity"],
    ["11", "Review Excel import logs for any failed rows"],
    ["12", "Generate GSTR-1 and GSTR-3B from this report for CA/Accountant"],
  ];

  const checkHdrs = [
    "#",
    "Audit Task",
    "Completed (Y/N)",
    "Remarks",
    "Verified By",
    "Date",
  ];
  checkHdrs.forEach((h, i) => setC(ws, i + 1, r, h, S.hdrPurple));
  r++;

  checklist.forEach(([no, task], i) => {
    const alt = i % 2 === 1;
    const ds = alt ? S.dataAlt : S.data;
    setC(ws, 1, r, no, ds);
    setC(ws, 2, r, task, ds);
    mergeRow(ws, r, 2, 3);
    setC(ws, 4, r, "", ds);
    setC(ws, 5, r, "", ds);
    setC(ws, 6, r, "", ds);
    r++;
  });

  // Footer
  r++;
  setC(
    ws,
    1,
    r,
    `Report generated by: HABIBS Textile Inventory System  |  ${NOW.toLocaleString("en-IN")}  |  Confidential — IT Department Only`,
    { ...S.hint, fill: { fgColor: { rgb: "D6EAF8" } } },
  );
  mergeRow(ws, r, 1, 10);

  ws["!cols"] = [
    { wch: 6 },
    { wch: 28 },
    { wch: 18 },
    { wch: 16 },
    { wch: 14 },
    { wch: 16 },
    { wch: 14 },
    { wch: 16 },
    { wch: 16 },
    { wch: 18 },
  ];
  ws["!rows"] = Array(r).fill({ hpt: 20 });
  ws["!rows"][0] = { hpt: 30 };
  setRef(ws, 10, r);
  return ws;
};

// ─── Assemble Workbook ────────────────────────────────────────────────────────

const wb = XLSX.utils.book_new();
wb.Props = {
  Title: "HABIBS Textile — Complete Accounting & Audit Report",
  Author: "HABIBS Textile IT Dept",
  CreatedDate: new Date(),
};

XLSX.utils.book_append_sheet(wb, buildProductSheet(), "📦 Product Import");
XLSX.utils.book_append_sheet(
  wb,
  buildTallyStockMaster(),
  "📋 Tally Stock Master",
);
XLSX.utils.book_append_sheet(wb, buildTallyPurchase(), "🛒 Tally Purchases");
XLSX.utils.book_append_sheet(wb, buildTallySales(), "💰 Tally Sales");
XLSX.utils.book_append_sheet(wb, buildMonthlyAudit(), "📊 Monthly Audit");

const outPath = path.join(__dirname, "HABIBS_Complete_Report.xlsx");
XLSX.writeFile(wb, outPath, { bookSST: false, cellStyles: true });
console.log("✅ Complete report generated:", outPath);
