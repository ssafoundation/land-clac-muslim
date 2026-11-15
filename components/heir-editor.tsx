'use client'

import { ALL_RELS, Gender, MALE_RELS, REL_LABEL, Rel } from '@/lib/faraid'
import { HeirNode, Status } from '@/lib/estate'

export const uid = () => Math.random().toString(36).slice(2, 10)

const input =
  'rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white'

export function HeirEditor({
  heirs,
  onChange,
  gender,
  deceasedName,
  onlyChildren = false,
  depth = 0,
}: {
  heirs: HeirNode[]
  onChange: (h: HeirNode[]) => void
  gender: Gender
  deceasedName: string
  onlyChildren?: boolean
  depth?: number
}) {
  const rels: Rel[] = onlyChildren
    ? ['son', 'daughter']
    : ALL_RELS.filter((r) => !(gender === 'male' && r === 'husband') && !(gender === 'female' && r === 'wife'))

  const update = (id: string, patch: Partial<HeirNode>) =>
    onChange(heirs.map((h) => (h.id === id ? { ...h, ...patch } : h)))
  const remove = (id: string) => onChange(heirs.filter((h) => h.id !== id))
  const add = () =>
    onChange([...heirs, { id: uid(), name: '', rel: onlyChildren ? 'son' : 'son', status: 'alive', heirs: [] }])

  return (
    <div className={depth > 0 ? 'ml-3 md:ml-6 pl-3 md:pl-4 border-l-2 border-emerald-200 space-y-3' : 'space-y-3'}>
      {heirs.map((h, i) => {
        const canPre = !onlyChildren && (h.rel === 'son' || h.rel === 'daughter')
        return (
          <div key={h.id} className="rounded-xl border border-slate-200 bg-slate-50/60 p-3">
            <div className="grid grid-cols-1 sm:grid-cols-[2rem_1fr_1fr_1fr_auto] gap-2 items-center">
              <span className="text-sm text-slate-500">{i + 1}.</span>
              <input
                className={input}
                placeholder="ওয়ারিশের নাম (দলিল/সনদ অনুযায়ী)"
                value={h.name}
                onChange={(e) => update(h.id, { name: e.target.value })}
              />
              <select className={input} value={h.rel} onChange={(e) => update(h.id, { rel: e.target.value as Rel, status: h.status === 'pre' && !['son', 'daughter'].includes(e.target.value) ? 'alive' : h.status })}>
                {rels.map((r) => (
                  <option key={r} value={r}>
                    {REL_LABEL[r]}
                  </option>
                ))}
              </select>
              <select className={input} value={h.status} onChange={(e) => update(h.id, { status: e.target.value as Status })}>
                <option value="alive">জীবিত</option>
                <option value="later">{deceasedName || 'মালিক'}-এর পরে মারা গেছেন</option>
                {canPre && <option value="pre">{deceasedName || 'মালিক'}-এর আগে মারা গেছেন (সন্তান আছে)</option>}
              </select>
              <button
                type="button"
                onClick={() => remove(h.id)}
                className="text-sm text-rose-600 hover:bg-rose-50 rounded-lg px-3 py-2"
                aria-label="মুছুন"
              >
                মুছুন
              </button>
            </div>

            {h.status !== 'alive' && (
              <div className="mt-3">
                <p className="text-xs font-medium text-emerald-800 mb-2">
                  {h.status === 'later'
                    ? `${h.name || 'এই ব্যক্তি'}-এর ওয়ারিশগণ (তার মৃত্যুর সময় যারা জীবিত ছিলেন):`
                    : `${h.name || 'পূর্বমৃত সন্তান'}-এর সন্তানগণ — মুসলিম পারিবারিক আইন অধ্যাদেশ ১৯৬১, ধারা ৪ অনুযায়ী পিতা/মাতার অংশ পাবেন:`}
                </p>
                <HeirEditor
                  heirs={h.heirs}
                  onChange={(hs) => update(h.id, { heirs: hs })}
                  gender={MALE_RELS.has(h.rel) ? 'male' : 'female'}
                  deceasedName={h.name}
                  onlyChildren={h.status === 'pre'}
                  depth={depth + 1}
                />
              </div>
            )}
          </div>
        )
      })}
      <button
        type="button"
        onClick={add}
        className="text-sm font-medium text-emerald-700 hover:bg-emerald-50 border border-dashed border-emerald-300 rounded-lg px-4 py-2"
      >
        + {onlyChildren ? 'সন্তান' : 'ওয়ারিশ'} যোগ করুন
      </button>
    </div>
  )
}
