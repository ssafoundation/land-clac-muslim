'use client'

import { useEffect, useMemo, useState } from 'react'
import { CaseInput, computeCase, HeirNode } from '@/lib/estate'
import { Frac } from '@/lib/fraction'
import { buyerKeys, normalizeTransfer, OUT, Transfer, transfersToDeeds } from '@/lib/transfer'
import { Gender } from '@/lib/faraid'
import { UNITS, UnitValue } from '@/lib/units'
import { HeirEditor } from './heir-editor'
import { TransferEditor } from './transfer-editor'
import { ResultsTable } from './results-table'

const STORAGE_KEY = 'jomir-hisab-simple-v3'

type SimpleCase = {
  transfers: Transfer[]
  total: string
  unit: UnitValue
  precision: 3 | 4
  owner: { name: string; gender: Gender; deathDate: string; heirs: HeirNode[] }
}

const EMPTY: SimpleCase = {
  transfers: [],
  total: '',
  unit: 'shotok',
  precision: 3,
  owner: { name: '', gender: 'male', deathDate: '', heirs: [] },
}

// নমুনা: বাবা মারা গেছেন — স্ত্রী, ৪ ছেলে, ১ মেয়ে। মেয়ে তার পুরো অংশ ৪ ভাইয়ের মধ্যে ২ ভাইয়ের কাছে বিক্রি করেছেন।
// বাবা জীবদ্দশায় ১ ছেলের কাছে ৫ শতক বিক্রি করেছিলেন।
const SAMPLE: SimpleCase = {
  transfers: [
    { id: 't1', from: 'ফাতেমা খাতুন', fromOut: '', buyers: ['আব্দুর রহিম', 'আব্দুল জলিল'], outBuyer: '', full: true, amount: '', split: 'equal', custom: {}, deedNo: '৪৫৬৭/২০১০' },
    { id: 't2', from: 'আব্দুল করিম', fromOut: '', buyers: ['আব্দুল হাকিম'], outBuyer: '', full: false, amount: '5', split: 'equal', custom: {}, deedNo: '১২৩৪/১৯৯০' },
  ],
  total: '50',
  unit: 'shotok',
  precision: 3,
  owner: {
    name: 'আব্দুল করিম',
    gender: 'male',
    deathDate: '1995-05-10',
    heirs: [
      { id: 'h1', name: 'রহিমা বেগম', rel: 'wife', status: 'alive', heirs: [] },
      { id: 'h2', name: 'আব্দুর রহিম', rel: 'son', status: 'alive', heirs: [] },
      { id: 'h3', name: 'আব্দুল জলিল', rel: 'son', status: 'alive', heirs: [] },
      { id: 'h4', name: 'আব্দুল হাকিম', rel: 'son', status: 'alive', heirs: [] },
      { id: 'h5', name: 'আব্দুল মালেক', rel: 'son', status: 'alive', heirs: [] },
      { id: 'h6', name: 'ফাতেমা খাতুন', rel: 'daughter', status: 'alive', heirs: [] },
    ],
  },
}

const inputCls =
  'w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 bg-white'

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="block text-sm font-medium text-slate-700 mb-1.5">{label}</span>
      {children}
    </label>
  )
}

function holderNames(hs: HeirNode[], out: string[] = []) {
  hs.forEach((h) => {
    if (h.name.trim() && h.status !== 'pre' && !out.includes(h.name.trim())) out.push(h.name.trim())
    holderNames(h.heirs, out)
  })
  return out
}

export function CalculatorForm() {
  const [data, setData] = useState<SimpleCase>(EMPTY)
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    try {
      const s = localStorage.getItem(STORAGE_KEY)
      if (s) {
        const d = JSON.parse(s)
        setData({ ...EMPTY, ...d, transfers: (d.transfers || []).map(normalizeTransfer) })
      }
    } catch {}
    setLoaded(true)
  }, [])
  useEffect(() => {
    if (!loaded) return
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
    } catch {}
  }, [data, loaded])

  const setOwner = (patch: Partial<SimpleCase['owner']>) => setData((d) => ({ ...d, owner: { ...d.owner, ...patch } }))

  // ইঞ্জিনে পুরো সম্পত্তিকে একটি অংশ হিসেবে পাঠানো হয় (একক যাই হোক, পরিমাণ একই এককে ফেরত আসে)
  const makeInput = (deeds: CaseInput['deeds']): CaseInput => ({
    record: { district: '', upazila: '', mouza: '', jl: '', recordType: '', khatianNo: '', ownerShare: '1' },
    unit: 'shotok',
    precision: data.precision,
    dags: [{ id: 'total', no: '', area: data.total, landClass: '' }],
    owner: data.owner,
    deeds,
  })

  // দুই ধাপ: (১) "পুরো অংশ" বাদে বাকি লেনদেন দিয়ে হিসাব → বিক্রেতার অংশ জানা যায়, (২) সেই পরিমাণ বসিয়ে চূড়ান্ত হিসাব
  const { result, fullAmounts, fullIssues } = useMemo(() => {
    const first = computeCase(makeInput(transfersToDeeds(data.transfers)))
    const fullAmounts: Record<string, Frac> = {}
    const fullIssues: string[] = []
    const used = new Set<string>()
    data.transfers.forEach((t, i) => {
      if (!t.full || !t.from || t.from === OUT) return
      const row = first.rows.find((r) => r.name === t.from.trim())
      if (!row) {
        fullIssues.push(`দলিল ${i + 1}: "${t.from}" এর জীবিত অংশ পাওয়া যায়নি (তিনি মৃত হলে তার ওয়ারিশরা বিক্রেতা হবেন) — নির্দিষ্ট পরিমাণ দিন।`)
        return
      }
      if (used.has(t.from)) {
        fullIssues.push(`দলিল ${i + 1}: "${t.from}" এর পুরো অংশ আগের দলিলেই বিক্রি হয়েছে।`)
        return
      }
      used.add(t.from)
      if (row.finalTotal.isPos()) fullAmounts[t.id] = row.finalTotal
      else fullIssues.push(`দলিল ${i + 1}: "${t.from}" এর বিক্রি করার মতো কোনো অংশ নেই।`)
    })
    const result = computeCase(makeInput(transfersToDeeds(data.transfers, fullAmounts)))
    return { result, fullAmounts, fullIssues }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data])

  const names = useMemo(() => holderNames(data.owner.heirs), [data.owner.heirs])
  const transferIssues = [
    ...data.transfers.flatMap((t, i) => {
      const n = i + 1
      const out: string[] = []
      if (!t.from) out.push(`দলিল ${n}: বিক্রেতা বাছাই করুন।`)
      if (!buyerKeys(t).length) out.push(`দলিল ${n}: অন্তত একজন ক্রেতা বাছাই করুন।`)
      if (t.from === OUT && !t.buyers.length) out.push(`দলিল ${n}: বিক্রেতা ও ক্রেতা দুজনই বাইরের — ওয়ারিশদের হিসাবে লাগবে না।`)
      if (!t.full && t.split === 'equal' && !(Number(t.amount) > 0)) out.push(`দলিল ${n}: পরিমাণ দিন।`)
      if (!t.full && t.split === 'custom' && !buyerKeys(t).some((k) => Number(t.custom[k]) > 0)) out.push(`দলিল ${n}: ক্রেতাদের পরিমাণ দিন।`)
      return out
    }),
    ...fullIssues,
  ]
  const unitLabel = UNITS.find((u) => u.value === data.unit)?.label.split(' ')[0] || ''

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <section className="bg-white rounded-2xl shadow-sm border border-slate-200 p-5 md:p-6 print:hidden">
        <div className="flex flex-wrap items-start justify-between gap-2 mb-5">
          <h2 className="text-lg md:text-xl font-semibold text-slate-800">মৃত ব্যক্তি ও সম্পত্তি</h2>
          <div className="flex gap-2">
            <button type="button" onClick={() => setData(SAMPLE)} className="text-sm rounded-lg border border-slate-300 bg-white px-3 py-1.5 hover:bg-slate-50">
              নমুনা দেখুন
            </button>
            <button
              type="button"
              onClick={() => confirm('সব তথ্য মুছে নতুন করে শুরু করবেন?') && setData(EMPTY)}
              className="text-sm rounded-lg border border-rose-200 text-rose-700 bg-white px-3 py-1.5 hover:bg-rose-50"
            >
              নতুন হিসাব
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Field label="মৃত ব্যক্তির নাম">
            <input className={inputCls} value={data.owner.name} onChange={(e) => setOwner({ name: e.target.value })} />
          </Field>
          <Field label="লিঙ্গ">
            <select className={inputCls} value={data.owner.gender} onChange={(e) => setOwner({ gender: e.target.value as Gender })}>
              <option value="male">পুরুষ</option>
              <option value="female">মহিলা</option>
            </select>
          </Field>
          <Field label="মোট সম্পত্তির পরিমাণ">
            <input className={inputCls} inputMode="decimal" placeholder="যেমন 50" value={data.total} onChange={(e) => setData((d) => ({ ...d, total: e.target.value }))} />
          </Field>
          <Field label="একক">
            <select className={inputCls} value={data.unit} onChange={(e) => setData((d) => ({ ...d, unit: e.target.value as UnitValue }))}>
              {UNITS.map((u) => <option key={u.value} value={u.value}>{u.label}</option>)}
            </select>
          </Field>
        </div>
      </section>

      <section className="bg-white rounded-2xl shadow-sm border border-slate-200 p-5 md:p-6 print:hidden">
        <h2 className="text-lg md:text-xl font-semibold text-slate-800">ওয়ারিশগণ</h2>
        <p className="text-sm text-slate-500 mt-1 mb-4">
          ওয়ারিশ সনদ দেখে প্রত্যেককে আলাদা নামে দিন। কেউ পরে মারা গেলে “পরে মারা গেছেন” দিয়ে তার ওয়ারিশও দিন। মৃত ব্যক্তির আগে মারা যাওয়া ছেলে/মেয়ের সন্তান থাকলে “আগে মারা গেছেন” দিয়ে সন্তানদের দিন।
        </p>
        <HeirEditor heirs={data.owner.heirs} onChange={(h) => setOwner({ heirs: h })} gender={data.owner.gender} deceasedName={data.owner.name} />
      </section>

      <section className="bg-white rounded-2xl shadow-sm border border-slate-200 p-5 md:p-6 print:hidden">
        <h2 className="text-lg md:text-xl font-semibold text-slate-800">ক্রয় / বিক্রয়</h2>
        <p className="text-sm text-slate-500 mt-1 mb-4">
          প্রতিটি দলিলের জন্য একটি করে দিন: কে বিক্রি করেছেন, কে কে কিনেছেন। যেমন — বোন তার পুরো অংশ ২ ভাইয়ের কাছে বিক্রি করেছেন, বা বাবা জীবদ্দশায় কোনো সন্তানের কাছে বিক্রি করেছেন। সব হিসাব মূল সম্পত্তির ভেতরেই সমন্বয় হবে। না থাকলে খালি রাখুন।
        </p>
        <TransferEditor
          transfers={data.transfers}
          onChange={(ts) => setData((d) => ({ ...d, transfers: ts }))}
          ownerName={data.owner.name}
          names={names}
          fullAmounts={fullAmounts}
          unitLabel={unitLabel}
        />
      </section>

      <ResultsTable
        deeds={result.deeds}
        extraIssues={transferIssues}
        ownerName={data.owner.name}
        total={data.total}
        precision={data.precision}
        result={result}
        unitLabel={unitLabel}
        onPrecision={(p) => setData((d) => ({ ...d, precision: p }))}
      />
    </div>
  )
}
