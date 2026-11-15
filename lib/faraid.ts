// হানাফি ফারায়েজ (বাংলাদেশে প্রযোজ্য মুসলিম উত্তরাধিকার আইন) — নির্ভুল ভগ্নাংশে
import { Frac, sum } from './fraction'

export type Gender = 'male' | 'female'

export type Rel =
  | 'husband'
  | 'wife'
  | 'father'
  | 'mother'
  | 'pgf'
  | 'pgm'
  | 'mgm'
  | 'son'
  | 'daughter'
  | 'fbro'
  | 'fsis'
  | 'cbro'
  | 'csis'
  | 'ubro'
  | 'usis'
  | 'fnephew'
  | 'cnephew'
  | 'funcle'
  | 'cuncle'
  | 'fcousin'
  | 'ccousin'

export const REL_LABEL: Record<Rel, string> = {
  husband: 'স্বামী',
  wife: 'স্ত্রী',
  father: 'পিতা',
  mother: 'মাতা',
  pgf: 'দাদা (পিতার পিতা)',
  pgm: 'দাদী (পিতার মাতা)',
  mgm: 'নানী (মাতার মাতা)',
  son: 'পুত্র',
  daughter: 'কন্যা',
  fbro: 'আপন ভাই',
  fsis: 'আপন বোন',
  cbro: 'বৈমাত্রেয় ভাই (একই পিতা)',
  csis: 'বৈমাত্রেয় বোন (একই পিতা)',
  ubro: 'বৈপিত্রেয় ভাই (একই মাতা)',
  usis: 'বৈপিত্রেয় বোন (একই মাতা)',
  fnephew: 'আপন ভাইয়ের পুত্র',
  cnephew: 'বৈমাত্রেয় ভাইয়ের পুত্র',
  funcle: 'আপন চাচা',
  cuncle: 'বৈমাত্রেয় চাচা',
  fcousin: 'আপন চাচার পুত্র',
  ccousin: 'বৈমাত্রেয় চাচার পুত্র',
}

export const ALL_RELS = Object.keys(REL_LABEL) as Rel[]

/** পুরুষ ওয়ারিশ কিনা (২:১ ভাগের জন্য) */
export const MALE_RELS = new Set<Rel>([
  'husband', 'father', 'pgf', 'son', 'fbro', 'cbro', 'ubro',
  'fnephew', 'cnephew', 'funcle', 'cuncle', 'fcousin', 'ccousin',
])

export type Counts = Partial<Record<Rel, number>>

export type ShareResult = {
  /** প্রতিটি সম্পর্কের মোট (দলগত) অংশ */
  group: Partial<Record<Rel, Frac>>
  /** প্রতিজনের অংশ */
  each: Partial<Record<Rel, Frac>>
  /** কোন নিয়মে পেল */
  basis: Partial<Record<Rel, string>>
  /** কে কার কারণে বঞ্চিত (মাহজুব) */
  excluded: Partial<Record<Rel, string>>
  notes: string[]
  /** কেউ না পেলে অবশিষ্ট (যাভিল আরহাম / সরকার) */
  unassigned: Frac
}

const f = (n: number, d = 1) => new Frac(n, d)

export function computeShares(gender: Gender, raw: Counts): ShareResult {
  const c = (r: Rel) => Math.max(0, Math.floor(raw[r] || 0))
  const has = (r: Rel) => c(r) > 0

  const fixed: Partial<Record<Rel, Frac>> = {}
  const basis: Partial<Record<Rel, string>> = {}
  const excluded: Partial<Record<Rel, string>> = {}
  const notes: string[] = []

  const exclude = (r: Rel, why: string) => {
    if (has(r)) excluded[r] = why
  }

  // লিঙ্গ অনুযায়ী অসম্ভব সম্পর্ক
  if (gender === 'male' && has('husband')) exclude('husband', 'মৃত ব্যক্তি পুরুষ — স্বামী ওয়ারিশ হতে পারেন না')
  if (gender === 'female' && has('wife')) exclude('wife', 'মৃত ব্যক্তি মহিলা — স্ত্রী ওয়ারিশ হতে পারেন না')
  const husband = gender === 'female' && has('husband')
  const wives = gender === 'male' ? c('wife') : 0
  if (wives > 4) notes.push('৪ জনের বেশি স্ত্রী দেওয়া হয়েছে — যাচাই করুন।')

  const sons = c('son')
  const daughters = c('daughter')
  const hasChild = sons + daughters > 0
  const father = has('father')
  const gf = !father && has('pgf')
  if (father) exclude('pgf', 'পিতা জীবিত থাকায় দাদা বঞ্চিত')
  const fatherLike = father || gf
  const mother = has('mother')
  const siblingsTotal = c('fbro') + c('fsis') + c('cbro') + c('csis') + c('ubro') + c('usis')

  // ---- স্বামী/স্ত্রী ----
  if (husband) {
    fixed.husband = hasChild ? f(1, 4) : f(1, 2)
    basis.husband = hasChild ? 'সন্তান থাকায় ১/৪' : 'সন্তান না থাকায় ১/২'
  }
  if (wives > 0) {
    fixed.wife = hasChild ? f(1, 8) : f(1, 4)
    basis.wife = (hasChild ? 'সন্তান থাকায় ১/৮' : 'সন্তান না থাকায় ১/৪') + (wives > 1 ? ` — ${wives} জন স্ত্রী সমানভাবে ভাগ করবেন` : '')
  }
  const spouse = husband || wives > 0

  // ---- পিতা / দাদা ----
  const fl: Rel = father ? 'father' : 'pgf'
  if (fatherLike) {
    if (sons > 0) {
      fixed[fl] = f(1, 6)
      basis[fl] = 'পুত্র থাকায় নির্দিষ্ট ১/৬'
    } else if (daughters > 0) {
      fixed[fl] = f(1, 6)
      basis[fl] = 'কন্যা থাকায় ১/৬ + অবশিষ্ট (আসাবা)'
    } else {
      basis[fl] = 'সন্তান না থাকায় অবশিষ্টভোগী (আসাবা)'
    }
  }

  // ---- মাতা ----
  let umariyya = false
  if (mother) {
    if (hasChild || siblingsTotal >= 2) {
      fixed.mother = f(1, 6)
      basis.mother = hasChild ? 'সন্তান থাকায় ১/৬' : 'দুই বা ততোধিক ভাই-বোন থাকায় ১/৬'
    } else if (spouse && father) {
      umariyya = true // উমারিয়্যাতাইন — স্বামী/স্ত্রীর অংশ বাদে বাকির ১/৩
      const sp = husband ? f(1, 2) : f(1, 4)
      fixed.mother = Frac.one.sub(sp).mul(f(1, 3))
      basis.mother = 'উমারিয়্যাতাইন: স্বামী/স্ত্রীর অংশ বাদে অবশিষ্টের ১/৩'
    } else {
      fixed.mother = f(1, 3)
      basis.mother = 'সন্তান ও একাধিক ভাই-বোন না থাকায় ১/৩'
    }
  }

  // ---- দাদী / নানী ----
  if (mother) {
    exclude('pgm', 'মাতা জীবিত থাকায় দাদী বঞ্চিত')
    exclude('mgm', 'মাতা জীবিত থাকায় নানী বঞ্চিত')
  } else {
    if (father) exclude('pgm', 'পিতা জীবিত থাকায় দাদী বঞ্চিত')
    const gms: Rel[] = []
    if (has('pgm') && !father) gms.push('pgm')
    if (has('mgm')) gms.push('mgm')
    gms.forEach((r) => {
      fixed[r] = f(1, 6 * gms.length)
      basis[r] = gms.length > 1 ? 'দাদী-নানী মিলে ১/৬ সমান ভাগ' : 'মাতা না থাকায় ১/৬'
    })
  }

  // ---- কন্যা ----
  if (daughters > 0 && sons === 0) {
    fixed.daughter = daughters === 1 ? f(1, 2) : f(2, 3)
    basis.daughter = daughters === 1 ? 'একমাত্র কন্যা, পুত্র নেই — ১/২' : 'একাধিক কন্যা, পুত্র নেই — মিলে ২/৩'
  }

  // ---- বৈপিত্রেয় ভাই-বোন ----
  const uterine = c('ubro') + c('usis')
  const uExcl = hasChild ? 'সন্তান থাকায় বঞ্চিত' : fatherLike ? `${father ? 'পিতা' : 'দাদা'} থাকায় বঞ্চিত` : ''
  if (uExcl) {
    exclude('ubro', uExcl)
    exclude('usis', uExcl)
  } else if (uterine > 0) {
    const tot = uterine === 1 ? f(1, 6) : f(1, 3)
    if (has('ubro')) {
      fixed.ubro = tot.mul(f(c('ubro'), uterine))
      basis.ubro = uterine === 1 ? '১/৬' : 'বৈপিত্রেয় ভাই-বোন মিলে ১/৩ (নারী-পুরুষ সমান)'
    }
    if (has('usis')) {
      fixed.usis = tot.mul(f(c('usis'), uterine))
      basis.usis = uterine === 1 ? '১/৬' : 'বৈপিত্রেয় ভাই-বোন মিলে ১/৩ (নারী-পুরুষ সমান)'
    }
  }

  // ---- আপন ও বৈমাত্রেয় ভাই-বোন ----
  const sibBlock = sons > 0 ? 'পুত্র থাকায় বঞ্চিত' : father ? 'পিতা থাকায় বঞ্চিত' : gf ? 'দাদা থাকায় বঞ্চিত (ইমাম আবু হানিফার মত)' : ''
  let fsisResidualWithDaughters = false
  if (sibBlock) {
    ;(['fbro', 'fsis', 'cbro', 'csis', 'fnephew', 'cnephew', 'funcle', 'cuncle', 'fcousin', 'ccousin'] as Rel[]).forEach((r) =>
      exclude(r, sibBlock),
    )
  } else {
    if (has('fsis') && !has('fbro')) {
      if (daughters > 0) {
        fsisResidualWithDaughters = true
        basis.fsis = 'কন্যার সাথে অবশিষ্টভোগী (আসাবা মা‘আল গাইর)'
      } else {
        fixed.fsis = c('fsis') === 1 ? f(1, 2) : f(2, 3)
        basis.fsis = c('fsis') === 1 ? 'একমাত্র আপন বোন — ১/২' : 'একাধিক আপন বোন — মিলে ২/৩'
      }
    }
    // বৈমাত্রেয় বোন
    if (has('csis') && !has('cbro')) {
      if (has('fbro')) exclude('csis', 'আপন ভাই থাকায় বঞ্চিত')
      else if (fsisResidualWithDaughters) exclude('csis', 'আপন বোন কন্যার সাথে আসাবা হওয়ায় বঞ্চিত')
      else if (c('fsis') >= 2) exclude('csis', 'দুই বা ততোধিক আপন বোন ২/৩ নেওয়ায় বঞ্চিত')
      else if (c('fsis') === 1) {
        fixed.csis = f(1, 6)
        basis.csis = 'একজন আপন বোনের সাথে ১/৬ (২/৩ পূরণ)'
      } else if (daughters > 0) basis.csis = 'কন্যার সাথে অবশিষ্টভোগী (আসাবা মা‘আল গাইর)'
      else {
        fixed.csis = c('csis') === 1 ? f(1, 2) : f(2, 3)
        basis.csis = c('csis') === 1 ? 'একমাত্র বৈমাত্রেয় বোন — ১/২' : 'একাধিক বৈমাত্রেয় বোন — মিলে ২/৩'
      }
    }
  }

  // ---- আসাবা (অবশিষ্টভোগী) ক্রম ----
  type Tier = { rels: Rel[]; why: string }
  const tiers: Tier[] = []
  if (sons > 0) tiers.push({ rels: ['son', 'daughter'], why: 'পুত্র-কন্যা ২:১ অনুপাতে অবশিষ্ট' })
  if (fatherLike) tiers.push({ rels: [fl], why: '' })
  if (!sibBlock) {
    if (has('fbro')) tiers.push({ rels: ['fbro', 'fsis'], why: 'আপন ভাই-বোন ২:১ অনুপাতে অবশিষ্ট' })
    if (fsisResidualWithDaughters) tiers.push({ rels: ['fsis'], why: '' })
    if (has('cbro')) tiers.push({ rels: ['cbro', 'csis'], why: 'বৈমাত্রেয় ভাই-বোন ২:১ অনুপাতে অবশিষ্ট' })
    if (has('csis') && !has('cbro') && !excluded.csis && !fixed.csis && daughters > 0) tiers.push({ rels: ['csis'], why: '' })
    ;(['fnephew', 'cnephew', 'funcle', 'cuncle', 'fcousin', 'ccousin'] as Rel[]).forEach((r) => {
      if (has(r)) tiers.push({ rels: [r], why: 'নিকটতম পুরুষ আসাবা হিসেবে অবশিষ্ট' })
    })
  }
  const residuary = tiers[0]
  // পরবর্তী স্তরের সবাই বঞ্চিত
  tiers.slice(1).forEach((t) => {
    t.rels.forEach((r) => {
      if (!fixed[r] && !excluded[r]) {
        const by = residuary.rels.map((x) => REL_LABEL[x]).join('/')
        exclude(r, `নিকটতর আসাবা (${by}) থাকায় বঞ্চিত`)
        delete basis[r]
      }
    })
  })

  // ---- অংশ যোগ করে আউল/রদ্দ/অবশিষ্ট ----
  const fixedRels = (Object.keys(fixed) as Rel[]).filter((r) => !excluded[r])
  const fixedTotal = sum(fixedRels.map((r) => fixed[r]!))
  const group: Partial<Record<Rel, Frac>> = {}
  let unassigned = Frac.zero

  if (fixedTotal.cmp(Frac.one) > 0) {
    // আউল — সব নির্দিষ্ট অংশ আনুপাতিক হারে কমবে
    notes.push(`আউল প্রযোজ্য: নির্দিষ্ট অংশের যোগফল ${fixedTotal.toString()} > ১, তাই সবার অংশ আনুপাতিক হারে কমানো হয়েছে।`)
    fixedRels.forEach((r) => (group[r] = fixed[r]!.div(fixedTotal)))
    if (residuary) {
      residuary.rels.forEach((r) => {
        if (has(r) && !fixed[r]) {
          group[r] = Frac.zero
          basis[r] = (basis[r] || '') + ' — আউলের কারণে কিছু অবশিষ্ট নেই'
        }
      })
    }
  } else {
    fixedRels.forEach((r) => (group[r] = fixed[r]!))
    const rest = Frac.one.sub(fixedTotal)
    if (residuary) {
      const rels = residuary.rels.filter((r) => has(r) && !excluded[r])
      const weight = (r: Rel) => (rels.length > 1 ? (MALE_RELS.has(r) ? 2 : 1) : 1) * c(r)
      const W = rels.reduce((a, r) => a + weight(r), 0)
      rels.forEach((r) => {
        const part = rest.mul(f(weight(r), W))
        group[r] = (group[r] || Frac.zero).add(part)
        if (residuary.why) basis[r] = residuary.why
      })
      if (rest.isZero()) notes.push('নির্দিষ্ট অংশেই সম্পত্তি শেষ — আসাবার জন্য কিছু অবশিষ্ট নেই।')
    } else if (rest.isPos()) {
      // রদ্দ — স্বামী/স্ত্রী ছাড়া অন্য অংশীদারদের মধ্যে আনুপাতিক হারে ফেরত
      const raddRels = fixedRels.filter((r) => r !== 'husband' && r !== 'wife')
      if (raddRels.length > 0) {
        const raddBase = sum(raddRels.map((r) => fixed[r]!))
        raddRels.forEach((r) => {
          group[r] = group[r]!.add(rest.mul(fixed[r]!.div(raddBase)))
          basis[r] = (basis[r] || '') + ' + রদ্দ'
        })
        notes.push(`রদ্দ প্রযোজ্য: অবশিষ্ট ${rest.toString()} অংশ স্বামী/স্ত্রী ছাড়া অন্য অংশীদারদের মধ্যে আনুপাতিক হারে ফেরত দেওয়া হয়েছে।`)
      } else if (spouse) {
        const sr: Rel = husband ? 'husband' : 'wife'
        group[sr] = Frac.one
        basis[sr] = (basis[sr] || '') + ' + রদ্দ (অন্য কোনো ওয়ারিশ নেই)'
        notes.push('অন্য কোনো ওয়ারিশ না থাকায় অবশিষ্ট অংশ স্বামী/স্ত্রীকে রদ্দ হিসেবে দেওয়া হয়েছে (পরবর্তী হানাফি ফতোয়া মত)। যাভিল আরহাম (মামা, খালা, ফুফু, নাতনী ইত্যাদি) থাকলে তারা আগে পাবেন — আইনজীবীর পরামর্শ নিন।')
      } else {
        unassigned = rest
      }
    }
  }

  if (!fixedRels.length && !residuary) {
    unassigned = Frac.one
  }
  if (unassigned.isPos())
    notes.push('কোনো অংশীদার বা আসাবা নেই — সম্পত্তি যাভিল আরহাম (দূরবর্তী আত্মীয়) বা সরকারের কাছে যাবে। এই অংশ বণ্টন হয়নি।')
  if (umariyya) notes.push('উমারিয়্যাতাইন মাসআলা: স্বামী/স্ত্রী, পিতা ও মাতা — মাতা অবশিষ্টের ১/৩ পেয়েছেন।')

  const each: Partial<Record<Rel, Frac>> = {}
  ;(Object.keys(group) as Rel[]).forEach((r) => {
    if (c(r) > 0) each[r] = group[r]!.div(c(r))
  })
  // পুত্র-কন্যা/ভাই-বোন ২:১ — উপরের weight দিয়ে group আলাদা ভাবে এসেছে, each = group / সংখ্যা ঠিক আছে

  return { group, each, basis, excluded, notes, unassigned }
}
