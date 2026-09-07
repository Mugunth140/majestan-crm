export function parseIndianCurrency(input: string | number | null | undefined): number {
  if (input === null || input === undefined) return 0;
  if (typeof input === "number") return Number.isFinite(input) ? input : 0;
  const cleanInput = input.toString().toLowerCase().replace(/,/g, "").trim();
  if (!cleanInput) return 0;
  let multiplier = 1;
  let numericStr = cleanInput;
  if (/cr(ore)?s?$/.test(cleanInput)) {
    multiplier = 10000000;
    numericStr = cleanInput.replace(/cr(ore)?s?$/, "");
  } else if (/l(akh)?s?$/.test(cleanInput) || /lacs?$/.test(cleanInput)) {
    multiplier = 100000;
    numericStr = cleanInput.replace(/l(akh)?s?|lacs?$/, "");
  } else if (/k$/.test(cleanInput) || /thousands?$/.test(cleanInput)) {
    multiplier = 1000;
    numericStr = cleanInput.replace(/k|thousands?$/, "");
  }
  const val = parseFloat(numericStr);
  return isNaN(val) ? 0 : val * multiplier;
}

const ONES = ["", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine", "Ten", "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen", "Seventeen", "Eighteen", "Nineteen"];
const TENS = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];

function twoDigits(n: number): string {
  if (n < 20) return ONES[n];
  const t = Math.floor(n / 10);
  const r = n % 10;
  return r ? `${TENS[t]} ${ONES[r]}` : TENS[t];
}

function threeDigits(n: number): string {
  const h = Math.floor(n / 100);
  const r = n % 100;
  const parts: string[] = [];
  if (h) parts.push(`${ONES[h]} Hundred`);
  if (r) parts.push(twoDigits(r));
  return parts.join(" ");
}

export function numberToIndianWords(num: number | null | undefined): string {
  if (num === null || num === undefined || isNaN(num)) return "";
  num = Math.floor(Math.abs(num));
  if (num === 0) return "";
  const arab = Math.floor(num / 1000000000);
  const crore = Math.floor((num % 1000000000) / 10000000);
  const lakh = Math.floor((num % 10000000) / 100000);
  const thousand = Math.floor((num % 100000) / 1000);
  const rest = num % 1000;
  const parts: string[] = [];
  if (arab) parts.push(`${threeDigits(arab)} Arab${arab > 1 ? "s" : ""}`);
  if (crore) parts.push(`${threeDigits(crore)} Crore${crore > 1 ? "s" : ""}`);
  if (lakh) parts.push(`${twoDigits(lakh)} Lakh${lakh > 1 ? "s" : ""}`);
  if (thousand) parts.push(`${twoDigits(thousand)} Thousand`);
  if (rest) parts.push(threeDigits(rest));
  return parts.join(" ");
}

export function formatIndianCurrencyWords(num: number | null | undefined): string {
  const words = numberToIndianWords(num);
  return words ? `${words} Rupees` : "";
}

const trimZeros = (n: number): string =>
  String(Math.round(n * 100) / 100);

export function formatIndianCurrencyShort(num: number | null | undefined): string {
  if (num === null || num === undefined || isNaN(num) || num === 0) return "";
  if (num >= 10000000) return `₹${trimZeros(num / 10000000)} Cr`;
  if (num >= 100000) return `₹${trimZeros(num / 100000)} L`;
  if (num >= 1000) return `₹${trimZeros(num / 1000)}k`;
  return `₹${num.toLocaleString("en-IN")}`;
}
