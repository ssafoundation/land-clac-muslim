import { Frac } from './fraction'

// ভূমি মন্ত্রণালয়/প্রচলিত সরকারি মান (শতক ভিত্তিক)। কাঠা/বিঘা অঞ্চলভেদে ভিন্ন হতে পারে।
export const UNITS = [
  { value: 'shotok', label: 'শতক (ডেসিমাল)', perShotok: new Frac(1) },
  { value: 'acre', label: 'একর', perShotok: new Frac(100) },
  { value: 'katha', label: 'কাঠা (১.৬৫ শতক)', perShotok: new Frac(165, 100) },
  { value: 'bigha', label: 'বিঘা (৩৩ শতক)', perShotok: new Frac(33) },
  { value: 'sqft', label: 'বর্গফুট', perShotok: new Frac(10, 4356) },
  { value: 'taka', label: 'টাকা', perShotok: new Frac(1) },
] as const

export type UnitValue = (typeof UNITS)[number]['value']

export function toShotok(v: string, unit: UnitValue): Frac {
  const u = UNITS.find((x) => x.value === unit) || UNITS[0]
  return Frac.fromDecimal(v).mul(u.perShotok)
}

const BN = '০১২৩৪৫৬৭৮৯'
export const bn = (s: string | number | bigint) => String(s).replace(/[0-9]/g, (d) => BN[+d])

/** ভগ্নাংশকে নির্দিষ্ট দশমিক ঘরে (গোল করে) বাংলা অঙ্কে */
export function fmtDec(x: Frac, places = 4): string {
  const scale = 10n ** BigInt(places)
  const { q, rem } = x.floorScaled(scale)
  const r = q + (rem.mul(2).cmp(Frac.one) >= 0 ? 1n : 0n)
  return bn(fixedFromScaled(r, places))
}

export function fixedFromScaled(r: bigint, places: number): string {
  const neg = r < 0n
  let s = (neg ? -r : r).toString().padStart(places + 1, '0')
  s = places > 0 ? `${s.slice(0, -places)}.${s.slice(-places)}` : s
  return (neg ? '-' : '') + s
}

export const fmtFrac = (x: Frac) => bn(x.toString())
