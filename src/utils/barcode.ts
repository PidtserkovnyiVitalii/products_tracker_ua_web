/**
 * Barcode utilities for validating and generating internal EAN-13 / Code128 barcodes.
 */

/**
 * Calculates standard GS1 EAN-13 check digit for a 12-digit string.
 */
export function calculateEan13CheckDigit(twelveDigits: string): number {
  if (twelveDigits.length !== 12 || !/^\d{12}$/.test(twelveDigits)) {
    throw new Error('Input must be a 12-digit numeric string')
  }

  let sum = 0
  for (let i = 0; i < 12; i++) {
    const digit = parseInt(twelveDigits[i], 10)
    // 0-indexed: index 0 (1st digit) * 1, index 1 (2nd digit) * 3, etc.
    sum += i % 2 === 0 ? digit * 1 : digit * 3
  }

  const remainder = sum % 10
  return remainder === 0 ? 0 : 10 - remainder
}

/**
 * Generates an internal retail EAN-13 barcode.
 * GS1 standard assigns 200-299 prefixes for in-store / internal restricted use.
 */
export function generateInternalEan13(): string {
  // Prefix 200 + 9 random digits
  let randomNine = ''
  for (let i = 0; i < 9; i++) {
    randomNine += Math.floor(Math.random() * 10).toString()
  }
  const twelveDigits = `200${randomNine}`
  const checkDigit = calculateEan13CheckDigit(twelveDigits)
  return `${twelveDigits}${checkDigit}`
}
