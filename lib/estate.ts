// খতিয়ান + ওয়ারিশ + দলিল মিলিয়ে পূর্ণ হিসাব (একাধিক পুরুষ/মুনাসাখা সহ)
import { Frac, apportion, sum } from './fraction'
import { computeShares, Counts, Gender, MALE_RELS, REL_LABEL, Rel } from './faraid'
import { toShotok, UnitValue } from './units'

export type Status = 'alive' | 'later' | 'pre'

export type HeirNode = {
  id: string
  name: string
  rel: Rel
  /** alive = জীবিত, later = মূল মালিকের পরে মৃত (তার ওয়ারিশ যোগ করতে হবে), pre = মালিকের আগে মৃত সন্তান (MFLO ধারা ৪) */
  status: Status
  heirs: HeirNode[]
}

export type Dag = { id: string; no: string; area: string; landClass: string }

export type Deed = {
  id: string
  no: string
  date: string
  type: 'sale' | 'purchase'
  party: string
  counterparty: string
  dagId: string
  area: string
  /** নির্ভুল পরিমাণ (সমান ভাগে ভাগ করলে দশমিক অসীম হতে পারে) — থাকলে area এর বদলে এটি */
  areaFrac?: Frac
  /** অপর পক্ষ ওয়ারিশ তালিকার বাইরের কেউ */
  external?: boolean
}

export type CaseInput = {
  record: {
    district: string
    upazila: string
    mouza: string
    jl: string
    recordType: string
    khatianNo: string
    ownerShare: string // খতিয়ানে মালিকের অংশ, যেমন 1 বা .500
  }
  unit: UnitValue
  dags: Dag[]
  owner: { name: string; gender: Gender; deathDate: string; heirs: HeirNode[] }
  deeds: Deed[]
  precision: 3 | 4
}

export type BreakRow = {
  level: number
  deceased: string
  heir: string
  rel: string
  basis: string
  /** ঐ মৃত ব্যক্তির সম্পত্তিতে অংশ */
  share: Frac
  /** মূল মালিকের সম্পত্তিতে ক্রমযোজিত অংশ */
  cumShare: Frac
  status: Status | 'excluded'
}

export type FinalRow = {
  name: string
  relations: string[]
  share: Frac // মূল মালিকের সম্পত্তিতে উত্তরাধিকার অংশ
  khatianShare: Frac // খতিয়ানের মোট (১.০০০) এর মধ্যে অংশ
  inherited: Record<string, Frac> // dagId → শতক
  bought: Record<string, Frac>
  sold: Record<string, Frac>
  final: Record<string, Frac>
  finalTotal: Frac
  parts: bigint // ১০০০ (বা ১০০০০) ভাগে মালিকের সম্পত্তিতে অংশ
  khatianParts: bigint
}

export type Issue = { level: 'error' | 'warn' | 'info'; text: string }

export type CaseResult = {
  rows: FinalRow[]
  breakdown: BreakRow[]
  estateNotes: { deceased: string; notes: string[] }[]
  issues: Issue[]
  dagTotals: Record<string, { area: Frac; ownerPart: Frac; ownerAfterDeeds: Frac }>
  totalOwnerLand: Frac
  unassigned: Frac
  scale: bigint
  deeds: Deed[]
}

const norm = (s: string) => s.trim().replace(/\s+/g, ' ')
const genderOf = (r: Rel): Gender => (MALE_RELS.has(r) ? 'male' : 'female')

type Land = Record<string, Frac>
const scaleLand = (l: Land, k: Frac): Land => Object.fromEntries(Object.entries(l).map(([d, v]) => [d, v.mul(k)]))
const addLand = (a: Land, b: Land): Land => {
  const o: Land = { ...a }
  for (const [d, v] of Object.entries(b)) o[d] = (o[d] || Frac.zero).add(v)
  return o
}

export function computeCase(input: CaseInput): CaseResult {
  const issues: Issue[] = []
  const breakdown: BreakRow[] = []
  const estateNotes: CaseResult['estateNotes'] = []
  const finals = new Map<string, { name: string; relations: Set<string>; share: Frac; land: Land }>()
  const scale = input.precision === 4 ? 10000n : 1000n
  let unassigned = Frac.zero

  const r = input.record
  // ---- প্রাথমিক যাচাই ----
  if (!norm(input.owner.name)) issues.push({ level: 'error', text: 'মৃত ব্যক্তির নাম দেওয়া হয়নি।' })
  if (!input.owner.deathDate)
    issues.push({ level: 'info', text: 'মৃত্যুর তারিখ দেওয়া হয়নি — ১৫/০৭/১৯৬১-এর আগে মৃত্যু হলে পূর্বমৃত সন্তানের সন্তানরা (MFLO ধারা ৪) পাবে না।' })

  const ownerShare = r.ownerShare.trim() ? Frac.fromDecimal(r.ownerShare) : Frac.one
  if (ownerShare.cmp(Frac.one) > 0 || !ownerShare.isPos())
    issues.push({ level: 'error', text: 'খতিয়ানে মালিকের অংশ ০ থেকে ১ এর মধ্যে হতে হবে (যেমন ১.০০০, .৫০০, .৩৩৩)।' })

  const dagTotals: CaseResult['dagTotals'] = {}
  const ownerLand: Land = {}
  input.dags.forEach((d, i) => {
    const area = toShotok(d.area, input.unit)
    if (!area.isPos()) issues.push({ level: 'error', text: 'মোট সম্পত্তির পরিমাণ দেওয়া হয়নি।' })
    const part = area.mul(ownerShare)
    ownerLand[d.id] = part
    dagTotals[d.id] = { area, ownerPart: part, ownerAfterDeeds: part }
  })

  // ---- দলিল ----
  const deedFor = (name: string) => input.deeds.filter((x) => norm(x.party) === norm(name) && norm(name))
  const deedLand = (name: string) => {
    const bought: Land = {}
    const sold: Land = {}
    for (const d of deedFor(name)) {
      if (!dagTotals[d.dagId]) continue
      const a = d.areaFrac ?? toShotok(d.area, input.unit)
      const tgt = d.type === 'sale' ? sold : bought
      tgt[d.dagId] = (tgt[d.dagId] || Frac.zero).add(a)
    }
    return { bought, sold }
  }
  input.deeds.forEach((d, i) => {
    if (!d.dagId || !dagTotals[d.dagId]) issues.push({ level: 'error', text: `দলিল ${d.no || i + 1}: কোন দাগের জমি তা নির্বাচন করা হয়নি।` })
    if (!norm(d.party)) issues.push({ level: 'error', text: `ক্রয়/বিক্রয় ${i + 1}: ক্রেতা/বিক্রেতা নির্বাচন করা হয়নি।` })
  })

  // মালিক জীবদ্দশায় বিক্রি/ক্রয় করলে এস্টেট বদলাবে
  const od = deedLand(input.owner.name)
  let rootEstate = addLand(ownerLand, od.bought)
  for (const [dag, v] of Object.entries(od.sold)) {
    rootEstate[dag] = (rootEstate[dag] || Frac.zero).sub(v)
    if (rootEstate[dag].cmp(Frac.zero) < 0)
      issues.push({ level: 'error', text: `${input.owner.name}: দাগে বিক্রিত জমি মালিকের অংশের চেয়ে বেশি।` })
  }
  for (const id of Object.keys(dagTotals)) dagTotals[id].ownerAfterDeeds = rootEstate[id] || Frac.zero

  const addFinal = (name: string, relDesc: string, share: Frac, land: Land) => {
    const key = norm(name) || '(নাম নেই)'
    const cur = finals.get(key) || { name: key, relations: new Set<string>(), share: Frac.zero, land: {} }
    cur.relations.add(relDesc)
    cur.share = cur.share.add(share)
    cur.land = addLand(cur.land, land)
    finals.set(key, cur)
  }

  // ---- পুনরাবৃত্ত বণ্টন ----
  const distribute = (
    deceased: string,
    gender: Gender,
    heirs: HeirNode[],
    estate: Land,
    cum: Frac,
    level: number,
    seen: Set<string>,
  ) => {
    if (level > 8) {
      issues.push({ level: 'error', text: 'অনেক বেশি স্তরের মৃত্যু — হিসাব থামানো হয়েছে।' })
      return
    }
    // নাম যাচাই
    const names = new Set<string>()
    heirs.forEach((h) => {
      if (!norm(h.name)) issues.push({ level: 'warn', text: `${deceased}-এর একজন ওয়ারিশের (${REL_LABEL[h.rel]}) নাম দেওয়া হয়নি।` })
      else if (names.has(norm(h.name))) issues.push({ level: 'warn', text: `${deceased}-এর ওয়ারিশ তালিকায় "${h.name}" দুইবার আছে।` })
      names.add(norm(h.name))
      if (h.status === 'pre' && h.rel !== 'son' && h.rel !== 'daughter')
        issues.push({ level: 'error', text: `"${h.name}" — শুধু পূর্বমৃত পুত্র/কন্যার সন্তানরা ধারা ৪ অনুযায়ী পায়। অন্য পূর্বমৃত আত্মীয় ওয়ারিশ নন, তাকে বাদ দিন।` })
    })

    const valid = heirs.filter((h) => {
      if (h.status !== 'pre') return true
      if (h.rel !== 'son' && h.rel !== 'daughter') return false
      if (h.heirs.length === 0) {
        issues.push({ level: 'warn', text: `পূর্বমৃত ${REL_LABEL[h.rel]} "${h.name}"-এর কোনো সন্তান দেওয়া হয়নি — তাই তিনি হিসাব থেকে বাদ। সন্তান থাকলে যোগ করুন।` })
        return false
      }
      return true
    })

    const counts: Counts = {}
    valid.forEach((h) => (counts[h.rel] = (counts[h.rel] || 0) + 1))
    const res = computeShares(gender, counts)
    if (res.notes.length) estateNotes.push({ deceased, notes: res.notes })
    if (res.unassigned.isPos()) {
      unassigned = unassigned.add(cum.mul(res.unassigned))
      issues.push({ level: 'error', text: `${deceased}-এর সম্পত্তির ${res.unassigned.toString()} অংশ কোনো ওয়ারিশ পায়নি — অন্য ওয়ারিশ বাদ পড়েছে কিনা দেখুন।` })
    }
    if (valid.length === 0) issues.push({ level: 'error', text: `${deceased}-এর কোনো ওয়ারিশ দেওয়া হয়নি।` })

    heirs.forEach((h) => {
      const v = valid.includes(h)
      const ex = res.excluded[h.rel]
      const share = v && !ex ? res.each[h.rel] || Frac.zero : Frac.zero
      const c2 = cum.mul(share)
      breakdown.push({
        level,
        deceased,
        heir: h.name || '(নাম নেই)',
        rel: REL_LABEL[h.rel] + (h.status === 'pre' ? ' (পূর্বমৃত)' : h.status === 'later' ? ' (পরে মৃত)' : ''),
        basis: !v ? 'হিসাব থেকে বাদ' : ex || res.basis[h.rel] || '',
        share,
        cumShare: c2,
        status: ex || !v ? 'excluded' : h.status,
      })
      if (!share.isPos()) return
      const land = scaleLand(estate, share)
      const relDesc = `${deceased}-এর ${REL_LABEL[h.rel]}`

      if (h.status === 'alive') {
        addFinal(h.name, relDesc, c2, land)
      } else if (h.status === 'later') {
        const key = norm(h.name)
        if (seen.has(key)) {
          issues.push({ level: 'error', text: `"${h.name}" নিজের ওয়ারিশ তালিকায় আবার এসেছেন — চক্র।` })
          return
        }
        if (h.heirs.length === 0) {
          issues.push({ level: 'error', text: `"${h.name}" মৃত দেখানো হয়েছে কিন্তু তার ওয়ারিশ দেওয়া হয়নি — তার অংশ অমীমাংসিত রাখা হলো।` })
          addFinal(`${h.name} (মৃত — ওয়ারিশ দিন)`, relDesc, c2, land)
          return
        }
        const dl = deedLand(h.name)
        let est = addLand(land, dl.bought)
        for (const [dag, s] of Object.entries(dl.sold)) est[dag] = (est[dag] || Frac.zero).sub(s)
        distribute(h.name, genderOf(h.rel), h.heirs, est, c2, level + 1, new Set([...seen, key]))
      } else {
        // MFLO ১৯৬১ ধারা ৪ — পূর্বমৃত সন্তানের অংশ তার সন্তানরা পাবে (পুত্র:কন্যা = ২:১)
        const kids = h.heirs.filter((k) => k.rel === 'son' || k.rel === 'daughter')
        if (kids.length !== h.heirs.length)
          issues.push({ level: 'warn', text: `পূর্বমৃত "${h.name}"-এর তালিকায় শুধু পুত্র/কন্যা দিন — অন্যদের বাদ দেওয়া হয়েছে।` })
        const W = kids.reduce((a, k) => a + (k.rel === 'son' ? 2 : 1), 0)
        kids.forEach((k) => {
          const ks = new Frac(k.rel === 'son' ? 2 : 1, W)
          const kc = c2.mul(ks)
          breakdown.push({
            level: level + 1,
            deceased: `${h.name} (পূর্বমৃত — ধারা ৪)`,
            heir: k.name || '(নাম নেই)',
            rel: REL_LABEL[k.rel] + (k.status === 'later' ? ' (পরে মৃত)' : ''),
            basis: 'পূর্বমৃত পিতা/মাতার অংশ, পুত্র:কন্যা ২:১',
            share: ks,
            cumShare: kc,
            status: k.status,
          })
          const kl = scaleLand(land, ks)
          if (k.status === 'later' && k.heirs.length) {
            const dl = deedLand(k.name)
            let est = addLand(kl, dl.bought)
            for (const [dag, s] of Object.entries(dl.sold)) est[dag] = (est[dag] || Frac.zero).sub(s)
            distribute(k.name, genderOf(k.rel), k.heirs, est, kc, level + 2, new Set([...seen, norm(k.name)]))
          } else {
            if (k.status === 'later') issues.push({ level: 'error', text: `"${k.name}" মৃত কিন্তু ওয়ারিশ দেওয়া হয়নি।` })
            addFinal(k.name, `${h.name}-এর ${REL_LABEL[k.rel]} (ধারা ৪)`, kc, kl)
          }
        })
      }
    })
  }

  distribute(norm(input.owner.name) || 'মৃত ব্যক্তি', input.owner.gender, input.owner.heirs, rootEstate, Frac.one, 0, new Set([norm(input.owner.name)]))

  // ---- চূড়ান্ত টেবিল ----
  // যে ওয়ারিশ উত্তরাধিকারে কিছু পাননি (বঞ্চিত) কিন্তু জমি কিনেছেন — তাকেও টেবিলে আনতে হবে
  const aliveRel = new Map<string, string>()
  const walk = (dec: string, hs: HeirNode[], pre = false) =>
    hs.forEach((h) => {
      if (h.status === 'alive' && norm(h.name) && !aliveRel.has(norm(h.name)))
        aliveRel.set(norm(h.name), `${dec}-এর ${REL_LABEL[h.rel]}${pre ? ' (ধারা ৪)' : ''}`)
      walk(norm(h.name), h.heirs, h.status === 'pre')
    })
  walk(norm(input.owner.name) || 'মৃত ব্যক্তি', input.owner.heirs)
  input.deeds.forEach((d) => {
    const k = norm(d.party)
    if (k && !finals.has(k) && aliveRel.has(k)) addFinal(k, aliveRel.get(k)!, Frac.zero, {})
  })

  const list = [...finals.values()]
  const totalOwnerLand = sum(Object.values(ownerLand))
  const totalKhatian = sum(Object.values(dagTotals).map((d) => d.area))
  const rows: FinalRow[] = list.map((p) => {
    const dl = deedLand(p.name)
    const final: Land = {}
    for (const id of Object.keys(dagTotals)) {
      const v = (p.land[id] || Frac.zero).add(dl.bought[id] || Frac.zero).sub(dl.sold[id] || Frac.zero)
      final[id] = v
      if (v.cmp(Frac.zero) < 0) {
        const dn = input.dags.find((d) => d.id === id)?.no || ''
        issues.push({ level: 'error', text: `"${p.name}"${dn ? ` দাগ ${dn}-এ` : ""} তার প্রাপ্য অংশের চেয়ে বেশি জমি বিক্রি করেছেন।` })
      }
    }
    const finalTotal = sum(Object.values(final))
    return {
      name: p.name,
      relations: [...p.relations],
      share: p.share,
      khatianShare: totalKhatian.isPos() ? finalTotal.div(totalKhatian) : Frac.zero,
      inherited: p.land,
      bought: dl.bought,
      sold: dl.sold,
      final,
      finalTotal,
      parts: 0n,
      khatianParts: 0n,
    }
  })
  // ক্রেতা (যারা ওয়ারিশ নয় কিন্তু দলিলে কিনেছে)
  const known = new Set([...rows.map((x) => norm(x.name)), norm(input.owner.name)])
  const collectLater = (hs: HeirNode[]) => hs.forEach((h) => { known.add(norm(h.name)); collectLater(h.heirs) })
  collectLater(input.owner.heirs)
  input.deeds.forEach((d) => {
    if (norm(d.party) && !known.has(norm(d.party)))
      issues.push({ level: 'warn', text: `ক্রয়/বিক্রয়ে "${d.party}" নামটি ওয়ারিশ তালিকায় নেই — নামের বানান মিলিয়ে দিন।` })
  })

  const parts = apportion(rows.map((x) => x.share), scale)
  const kparts = apportion(rows.map((x) => x.khatianShare), scale)
  rows.forEach((x, i) => {
    x.parts = parts[i]
    x.khatianParts = kparts[i]
  })

  const totalShare = sum(rows.map((x) => x.share)).add(unassigned)
  if (rows.length && totalShare.cmp(Frac.one) !== 0)
    issues.push({ level: 'warn', text: `মোট বণ্টিত অংশ ${totalShare.toString()} — ১ এর সমান হয়নি; অমীমাংসিত অংশ দেখুন।` })

  return { rows, breakdown, estateNotes, issues, dagTotals, totalOwnerLand, unassigned, scale, deeds: input.deeds }
}
