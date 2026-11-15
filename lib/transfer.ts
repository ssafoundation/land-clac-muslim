import type { Deed } from './estate'
import { Frac } from './fraction'

export const OUT = '__out__'

/**
 * একটি দলিল/হস্তান্তর: একজন বিক্রেতা → এক বা একাধিক ক্রেতা।
 * যেমন: ১ বোন তার পুরো অংশ ৪ ভাইয়ের মধ্যে ২ ভাইয়ের কাছে বিক্রি করেছেন।
 */
export type Transfer = {
  id: string
  from: string // বিক্রেতা: মৃত ব্যক্তি/ওয়ারিশের নাম, অথবা OUT
  fromOut: string // বাইরের বিক্রেতার নাম
  buyers: string[] // ক্রেতা ওয়ারিশ/মৃত ব্যক্তির নাম
  outBuyer: string // বাইরের ক্রেতা (ঐচ্ছিক)
  full: boolean // বিক্রেতার পুরো অংশ বিক্রি
  amount: string // মোট পরিমাণ (full হলে লাগবে না)
  split: 'equal' | 'custom'
  custom: Record<string, string> // ক্রেতাভিত্তিক পরিমাণ (split = custom)
  deedNo: string
}

export const OUT_BUYER_KEY = '__outbuyer__'

export const newTransfer = (id: string): Transfer => ({
  id, from: '', fromOut: '', buyers: [], outBuyer: '', full: false, amount: '', split: 'equal', custom: {}, deedNo: '',
})

/** পুরোনো সেভ করা ডেটা (from → to) নতুন কাঠামোয় আনা */
export function normalizeTransfer(t: any): Transfer {
  const base = newTransfer(t.id || Math.random().toString(36).slice(2))
  const o: Transfer = { ...base, ...t, custom: t.custom || {}, buyers: Array.isArray(t.buyers) ? t.buyers : [] }
  if (!Array.isArray(t.buyers) && t.to) {
    if (t.to === OUT) o.outBuyer = t.toOut || 'বাইরের ক্রেতা'
    else o.buyers = [t.to]
  }
  return o
}

/** ক্রেতাদের তালিকা (বাইরের ক্রেতা থাকলে বিশেষ key দিয়ে) */
export const buyerKeys = (t: Transfer) => [...t.buyers, ...(t.outBuyer.trim() ? [OUT_BUYER_KEY] : [])]

/** মোট পরিমাণ ও ক্রেতাভিত্তিক ভাগ — fullAmount = বিক্রেতার পুরো অংশ (হিসাব করে পাওয়া) */
export function splitTransfer(t: Transfer, fullAmount?: Frac): { total: Frac; per: Record<string, Frac> } {
  const keys = buyerKeys(t)
  const per: Record<string, Frac> = {}
  if (t.split === 'custom' && !t.full) {
    let total = Frac.zero
    keys.forEach((k) => {
      per[k] = Frac.fromDecimal(t.custom[k] || '0')
      total = total.add(per[k])
    })
    return { total, per }
  }
  const total = t.full ? fullAmount || Frac.zero : Frac.fromDecimal(t.amount || '0')
  keys.forEach((k) => (per[k] = keys.length ? total.div(keys.length) : Frac.zero))
  return { total, per }
}

export function transfersToDeeds(ts: Transfer[], fullAmounts: Record<string, Frac> = {}): Deed[] {
  const deeds: Deed[] = []
  ts.forEach((t) => {
    if (!t.from) return
    const keys = buyerKeys(t)
    if (!keys.length) return
    if (t.full && !fullAmounts[t.id]) return // প্রথম ধাপে পুরো অংশ এখনও জানা নেই
    const { total, per } = splitTransfer(t, fullAmounts[t.id])
    if (!total.isPos()) return
    const base = { no: t.deedNo, date: '', dagId: 'total', area: '' }
    const sellerOut = t.from === OUT
    if (!sellerOut) {
      // বাইরের ক্রেতার কাছে যে অংশ গেছে সেটুকুই "বাইরে বিক্রি"
      const outPart = per[OUT_BUYER_KEY]
      if (outPart?.isPos()) deeds.push({ ...base, id: t.id + 'so', type: 'sale', party: t.from, counterparty: t.outBuyer, areaFrac: outPart, external: true })
      const inPart = outPart ? total.sub(outPart) : total
      if (inPart.isPos()) deeds.push({ ...base, id: t.id + 's', type: 'sale', party: t.from, counterparty: t.buyers.join(', '), areaFrac: inPart })
    }
    t.buyers.forEach((b) => {
      if (b === t.from) return
      deeds.push({ ...base, id: t.id + 'p' + b, type: 'purchase', party: b, counterparty: sellerOut ? t.fromOut : t.from, areaFrac: per[b], external: sellerOut })
    })
  })
  return deeds
}
