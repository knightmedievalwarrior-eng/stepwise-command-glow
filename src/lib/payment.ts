/**
 * Upgrade plan + Thai PromptPay QR payload (EMVCo merchant-presented QR).
 * Scanning pays the owner directly; the app cannot confirm the transfer itself.
 */

export const PLAN = {
  name: "แพ็กเกจมาตรฐาน",
  /** Placeholder price until the owner confirms the real one. */
  price: 299,
  period: "เดือน",
};

/**
 * Owner's PromptPay phone (10 digits) or national/tax ID (13 digits).
 * Empty = show a sample QR that cannot be paid.
 */
export const PROMPTPAY_ID = "";

function field(id: string, value: string) {
  return id + String(value.length).padStart(2, "0") + value;
}

function crc16(data: string): string {
  let crc = 0xffff;
  for (let i = 0; i < data.length; i++) {
    crc ^= data.charCodeAt(i) << 8;
    for (let b = 0; b < 8; b++) crc = crc & 0x8000 ? ((crc << 1) ^ 0x1021) & 0xffff : (crc << 1) & 0xffff;
  }
  return crc.toString(16).toUpperCase().padStart(4, "0");
}

/** Builds the PromptPay QR text for a phone number or 13-digit ID, with an optional amount in baht. */
export function promptPayPayload(target: string, amount?: number): string {
  const digits = target.replace(/\D/g, "");
  const account =
    digits.length >= 13
      ? field("02", digits)
      : field("01", ("0000000000000" + digits.replace(/^0/, "66")).slice(-13));
  const hasAmount = typeof amount === "number" && amount > 0;
  const body =
    field("00", "01") +
    field("01", hasAmount ? "12" : "11") +
    field("29", field("00", "A000000677010111") + account) +
    field("58", "TH") +
    field("53", "764") +
    (hasAmount ? field("54", amount.toFixed(2)) : "") +
    "6304";
  return body + crc16(body);
}
