export const SUPPORTED_CURRENCIES = ["USD", "EUR", "GBP", "CAD", "AUD", "INR", "JPY", "CNY"] as const

export type SupportedCurrency = (typeof SUPPORTED_CURRENCIES)[number]

const supportedCurrencySet = new Set<string>(SUPPORTED_CURRENCIES)

export function normalizeCurrency(value: unknown): SupportedCurrency {
  if (typeof value !== "string") return "USD"
  const currency = value.trim().toUpperCase()
  return supportedCurrencySet.has(currency) ? (currency as SupportedCurrency) : "USD"
}

export function formatCurrency(
  value: unknown,
  currency: string = "USD",
  options: Intl.NumberFormatOptions = {},
) {
  const amount = typeof value === "number" ? value : Number(value || 0)
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: normalizeCurrency(currency),
    maximumFractionDigits: 0,
    ...options,
  }).format(Number.isFinite(amount) ? amount : 0)
}
