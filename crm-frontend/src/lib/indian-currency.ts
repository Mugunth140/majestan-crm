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

const trimZeros = (n: number): string =>
  String(Math.round(n * 100) / 100);

export function formatIndianCurrencyShort(num: number | null | undefined): string {
  if (num === null || num === undefined || isNaN(num) || num === 0) return "";
  if (num >= 10000000) return `₹${trimZeros(num / 10000000)} Cr`;
  if (num >= 100000) return `₹${trimZeros(num / 100000)} L`;
  if (num >= 1000) return `₹${trimZeros(num / 1000)}k`;
  return `₹${num.toLocaleString("en-IN")}`;
}
