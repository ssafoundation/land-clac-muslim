'use client'

import { Frac } from '@/lib/fraction'
import { buyerKeys, newTransfer, OUT, OUT_BUYER_KEY, splitTransfer, Transfer } from '@/lib/transfer'
import { bn, fmtDec } from '@/lib/units'
import { uid } from './heir-editor'

const inputCls =
  'w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 bg-white'

export function TransferEditor({
  transfers,
  onChange,
  ownerName,
  names,
  fullAmounts,
  unitLabel,
}: {
  transfers: Transfer[]
  onChange: (t: Transfer[]) => void
  ownerName: string
  names: string[] // জীবিত/পরে মৃত ওয়ারিশদের নাম
  fullAmounts: Record<string, Frac>
  unitLabel: string
}) {
  const owner = ownerName.trim()
  const people = [...(owner ? [owner] : []), ...names.filter((n) => n !== owner)]
  const label = (n: string) => (n === owner ? `${n} (মৃত ব্যক্তি — জীবদ্দশায়)` : n)
  const set = (id: string, patch: Partial<Transfer>) => onChange(transfers.map((t) => (t.id === id ? { ...t, ...patch } : t)))

  if (!names.length)
    return (
      <p className="rounded-lg bg-amber-50 border border-amber-200 text-amber-900 text-sm p-3">
        আগে উপরে মৃত ব্যক্তি ও ওয়ারিশদের নাম দিন — তারপর এখানে বিক্রেতা ও ক্রেতা হিসেবে তাদের নাম বাছাই করা যাবে।
      </p>
    )

  return (
    <div className="space-y-4">
      {transfers.map((t, i) => {
        const keys = buyerKeys(t)
        const canFull = t.from && t.from !== OUT && t.from !== owner
        const { total, per } = splitTransfer(t, fullAmounts[t.id])
        const buyerName = (k: string) => (k === OUT_BUYER_KEY ? t.outBuyer : k)
        return (
          <div key={t.id} className="rounded-xl border border-slate-200 bg-slate-50/60 p-4 space-y-4">
            <div className="flex items-center justify-between">
              <span className="font-medium text-slate-700">দলিল / হস্তান্তর {bn(i + 1)}</span>
              <button type="button" className="text-sm text-rose-600 hover:bg-rose-50 rounded-lg px-3 py-1.5" onClick={() => onChange(transfers.filter((x) => x.id !== t.id))}>
                মুছুন
              </button>
            </div>

            {/* বিক্রেতা */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <label className="block">
                <span className="block text-sm font-medium text-slate-700 mb-1">কে বিক্রি করেছেন? (বিক্রেতা)</span>
                <select
                  className={inputCls}
                  value={t.from}
                  onChange={(e) => {
                    const from = e.target.value
                    set(t.id, { from, buyers: t.buyers.filter((b) => b !== from), full: from === OUT || from === owner ? false : t.full })
                  }}
                >
                  <option value="">— বাছাই করুন —</option>
                  {people.map((n) => <option key={n} value={n}>{label(n)}</option>)}
                  <option value={OUT}>বাইরের ব্যক্তি (ওয়ারিশ নন)</option>
                </select>
              </label>
              {t.from === OUT && (
                <label className="block">
                  <span className="block text-sm font-medium text-slate-700 mb-1">বিক্রেতার নাম</span>
                  <input className={inputCls} value={t.fromOut} onChange={(e) => set(t.id, { fromOut: e.target.value })} />
                </label>
              )}
              <label className="block">
                <span className="block text-sm font-medium text-slate-700 mb-1">দলিল নং (ঐচ্ছিক)</span>
                <input className={inputCls} value={t.deedNo} onChange={(e) => set(t.id, { deedNo: e.target.value })} />
              </label>
            </div>

            {/* ক্রেতা */}
            <div>
              <span className="block text-sm font-medium text-slate-700 mb-2">কে কে কিনেছেন? (একাধিক বাছাই করা যাবে)</span>
              <div className="flex flex-wrap gap-2">
                {people
                  .filter((n) => n !== t.from)
                  .map((n) => {
                    const on = t.buyers.includes(n)
                    return (
                      <label
                        key={n}
                        className={`cursor-pointer select-none rounded-full border px-3 py-1.5 text-sm ${on ? 'bg-emerald-600 border-emerald-600 text-white' : 'bg-white border-slate-300 text-slate-700 hover:border-emerald-400'}`}
                      >
                        <input
                          type="checkbox"
                          className="sr-only"
                          checked={on}
                          onChange={() => set(t.id, { buyers: on ? t.buyers.filter((b) => b !== n) : [...t.buyers, n] })}
                        />
                        {on ? '✓ ' : ''}
                        {label(n)}
                      </label>
                    )
                  })}
              </div>
              {t.from !== OUT && (
                <input
                  className={`${inputCls} mt-2 md:max-w-sm`}
                  placeholder="বাইরের কেউ কিনলে তার নাম (ঐচ্ছিক)"
                  value={t.outBuyer}
                  onChange={(e) => set(t.id, { outBuyer: e.target.value })}
                />
              )}
            </div>

            {/* পরিমাণ */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="space-y-2">
                <span className="block text-sm font-medium text-slate-700">কতটুকু বিক্রি?</span>
                {canFull && (
                  <label className="flex items-center gap-2 text-sm">
                    <input type="radio" checked={t.full} onChange={() => set(t.id, { full: true, split: 'equal' })} className="accent-emerald-600" />
                    বিক্রেতার পুরো অংশ (হিসাব নিজে বের করবে)
                  </label>
                )}
                <label className="flex items-center gap-2 text-sm">
                  <input type="radio" checked={!t.full} onChange={() => set(t.id, { full: false })} className="accent-emerald-600" />
                  নির্দিষ্ট পরিমাণ
                </label>
                {!t.full && t.split === 'equal' && (
                  <input className={inputCls} inputMode="decimal" placeholder={`মোট পরিমাণ (${unitLabel})`} value={t.amount} onChange={(e) => set(t.id, { amount: e.target.value })} />
                )}
              </div>
              <div className="space-y-2">
                <span className="block text-sm font-medium text-slate-700">ক্রেতাদের মধ্যে ভাগ</span>
                <label className="flex items-center gap-2 text-sm">
                  <input type="radio" checked={t.split === 'equal'} onChange={() => set(t.id, { split: 'equal' })} className="accent-emerald-600" />
                  সমান ভাগে
                </label>
                {!t.full && (
                  <label className="flex items-center gap-2 text-sm">
                    <input type="radio" checked={t.split === 'custom'} onChange={() => set(t.id, { split: 'custom' })} className="accent-emerald-600" />
                    আলাদা আলাদা পরিমাণ
                  </label>
                )}
                {t.split === 'custom' && !t.full && (
                  <div className="space-y-2">
                    {keys.map((k) => (
                      <div key={k} className="flex items-center gap-2">
                        <span className="text-sm w-40 truncate">{buyerName(k)}</span>
                        <input
                          className={inputCls}
                          inputMode="decimal"
                          placeholder={unitLabel}
                          value={t.custom[k] || ''}
                          onChange={(e) => set(t.id, { custom: { ...t.custom, [k]: e.target.value } })}
                        />
                      </div>
                    ))}
                    {!keys.length && <p className="text-xs text-slate-500">আগে ক্রেতা বাছাই করুন।</p>}
                  </div>
                )}
              </div>
            </div>

            {/* সারাংশ */}
            {t.from && keys.length > 0 && total.isPos() && (
              <p className="text-sm rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-900 px-3 py-2">
                {t.from === OUT ? t.fromOut || 'বাইরের বিক্রেতা' : t.from} → {keys.map(buyerName).join(', ')}: মোট <b>{fmtDec(total)} {unitLabel}</b>
                {keys.length > 1 && <> — {keys.map((k) => `${buyerName(k)} ${fmtDec(per[k])}`).join(', ')}</>}
                {t.full && ' (পুরো অংশ)'}
              </p>
            )}
          </div>
        )
      })}

      <button
        type="button"
        onClick={() => onChange([...transfers, newTransfer(uid())])}
        className="text-sm font-medium text-emerald-700 hover:bg-emerald-50 border border-dashed border-emerald-300 rounded-lg px-4 py-2"
      >
        + দলিল / হস্তান্তর যোগ করুন
      </button>
    </div>
  )
}
