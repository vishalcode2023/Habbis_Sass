/**
 * Generates a unique EAN-13 style barcode.
 *
 * Format: 890 (India prefix) + 9-digit payload + 1 check digit
 * The 9-digit payload = timestamp (ms) last 7 digits + 2 random digits.
 * Collision probability is negligible for inventory scale.
 */
const generateBarcode = () => {
  const prefix = "890"; // India GS1 prefix
  // 9 fully random digits — avoids timestamp collisions during bulk inserts
  // (all products map() at the same millisecond, same timestamp = same barcode)
  const random = Math.floor(100000000 + Math.random() * 900000000).toString(); // 9 digits
  const body = prefix + random; // 12 digits

  const checkDigit = computeEAN13Check(body);
  return body + checkDigit;
};

/**
 * Computes EAN-13 check digit from first 12 digits
 */
const computeEAN13Check = (digits) => {
  let sum = 0;
  for (let i = 0; i < 12; i++) {
    sum += parseInt(digits[i]) * (i % 2 === 0 ? 1 : 3);
  }
  return ((10 - (sum % 10)) % 10).toString();
};

/**
 * Validates an EAN-13 barcode string
 */
const validateBarcode = (barcode) => {
  if (!/^\d{13}$/.test(barcode)) return false;
  const check = computeEAN13Check(barcode.slice(0, 12));
  return check === barcode[12];
};

module.exports = { generateBarcode, validateBarcode };
