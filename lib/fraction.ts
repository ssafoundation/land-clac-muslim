// সঠিক ভগ্নাংশ হিসাব (BigInt) — দশমিকের গোলমাল ছাড়া নির্ভুল হিস্যা
function bgcd(a: bigint, b: bigint): bigint {
  a = a < 0n ? -a : a
  b = b < 0n ? -b : b
  while (b !== 0n) {
    const t = a % b
    a = b
    b = t
  }
  return a
}

export class Frac {
  readonly n: bigint
  readonly d: bigint

  constructor(n: bigint | number, d: bigint | number = 1n) {
    let nn = BigInt(n)
    let dd = BigInt(d)
    if (dd === 0n) throw new Error('শূন্য দিয়ে ভাগ')
    if (dd < 0n) {
      nn = -nn
      dd = -dd
    }
    const g = bgcd(nn, dd) || 1n
    this.n = nn / g
    this.d = dd / g
  }

  static zero = new Frac(0)
  static one = new Frac(1)

  /** দশমিক সংখ্যা (যেমন 33.25 বা "0.333") থেকে নির্ভুল ভগ্নাংশ */
  static fromDecimal(v: number | string): Frac {
    const s = String(v).trim()
    if (!s || isNaN(Number(s))) return Frac.zero
    if (/e/i.test(s)) return Frac.fromDecimal(Number(s).toFixed(10))
    const neg = s.startsWith('-')
    const [ip, fp = ''] = s.replace('-', '').split('.')
    const d = 10n ** BigInt(fp.length)
    const n = BigInt(ip || '0') * d + BigInt(fp || '0')
    return new Frac(neg ? -n : n, d)
  }

  add(o: Frac) {
    return new Frac(this.n * o.d + o.n * this.d, this.d * o.d)
  }
  sub(o: Frac) {
    return new Frac(this.n * o.d - o.n * this.d, this.d * o.d)
  }
  mul(o: Frac | number) {
    const f = o instanceof Frac ? o : new Frac(o)
    return new Frac(this.n * f.n, this.d * f.d)
  }
  div(o: Frac | number) {
    const f = o instanceof Frac ? o : new Frac(o)
    return new Frac(this.n * f.d, this.d * f.n)
  }
  cmp(o: Frac) {
    const x = this.n * o.d - o.n * this.d
    return x === 0n ? 0 : x > 0n ? 1 : -1
  }
  isZero() {
    return this.n === 0n
  }
  isPos() {
    return this.n > 0n
  }
  toNumber() {
    return Number(this.n) / Number(this.d)
  }
  toString() {
    return this.d === 1n ? `${this.n}` : `${this.n}/${this.d}`
  }

  /** scale দিয়ে গুণ করে নিচের দিকে পূর্ণসংখ্যা ও ভাগশেষ (largest remainder-এর জন্য) */
  floorScaled(scale: bigint): { q: bigint; rem: Frac } {
    const num = this.n * scale
    let q = num / this.d
    if (num < 0n && num % this.d !== 0n) q -= 1n
    return { q, rem: new Frac(num - q * this.d, this.d) }
  }
}

export const sum = (xs: Frac[]) => xs.reduce((a, b) => a.add(b), Frac.zero)

/**
 * Largest-remainder পদ্ধতিতে গোল করা: প্রতিটি মান scale ভাগে পূর্ণসংখ্যা হবে
 * এবং সবগুলোর যোগফল মোটের গোল করা মানের সমান থাকবে (যেমন মোট ১০০০ ভাগ)।
 */
export function apportion(values: Frac[], scale: bigint): bigint[] {
  const total = sum(values)
  const target = total.floorScaled(scale)
  const targetQ = target.q + (target.rem.mul(2).cmp(Frac.one) >= 0 ? 1n : 0n)
  const parts = values.map((v, i) => ({ i, ...v.floorScaled(scale) }))
  let left = targetQ - parts.reduce((a, p) => a + p.q, 0n)
  const order = [...parts].sort((a, b) => b.rem.cmp(a.rem) || a.i - b.i)
  const out = parts.map((p) => p.q)
  for (let k = 0; left > 0n && k < order.length; k++, left--) out[order[k].i] += 1n
  return out
}
