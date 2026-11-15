'use client'

import { CaseResult, Deed } from '@/lib/estate'
import { apportion, Frac, sum } from '@/lib/fraction'
import { bn, fixedFromScaled, fmtFrac } from '@/lib/units'

const th = 'px-3 py-2.5 font-semibold text-left border border-slate-200 bg-slate-100 text-slate-700 text-xs md:text-sm align-bottom'
const td = 'px-3 py-2 border border-slate-200 text-sm align-top'
const tdn = `${td} text-right tabular-nums whitespace-nowrap`

function downloadCSV(name: string, head: string[], lines: (string | number)[][]) {
  const csv = [head, ...lines].map((row) => row.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\r\n')
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = `ওয়ারিশ-হিস্যা-${name || 'হিসাব'}.csv`
  a.click()
  URL.revokeObjectURL(a.href)
}

export function ResultsTable({
  deeds,
  extraIssues,
  ownerName,
  total,
  precision,
  result,
  unitLabel,
  onPrecision,
}: {
  deeds: Deed[]
  extraIssues: string[]
  ownerName: string
  total: string
  precision: 3 | 4
  result: CaseResult
  unitLabel: string
  onPrecision: (p: 3 | 4) => void
}) {
  const { rows, scale } = result
  const hissya = (p: bigint) => bn(fixedFromScaled(p, precision).replace(/^0(?=\.)/, ''))

  // পরিমাণ: টাকায় ২ ঘর, জমিতে ৪ ঘর দশমিক। প্রতিটি কলাম largest-remainder এ গোল — কলামের যোগফল ঠিক থাকে
  const amtPlaces = unitLabel === 'টাকা' ? 2 : 4
  const S = 10n ** BigInt(amtPlaces)
  const round = (x: Frac) => {
    const { q, rem } = x.floorScaled(S)
    return q + (rem.mul(2).cmp(Frac.one) >= 0 ? 1n : 0n)
  }
  const fmt = (p: bigint) => fixedFromScaled(p, amtPlaces)
  const sumParts = (ps: bigint[]) => ps.reduce((a, b) => a + b, 0n)

  const inhParts = apportion(rows.map((r) => sum(Object.values(r.inherited))), S)
  const buyParts = apportion(rows.map((r) => sum(Object.values(r.bought))), S)
  const sellParts = apportion(rows.map((r) => sum(Object.values(r.sold))), S)
  const netParts = rows.map((_, i) => inhParts[i] + buyParts[i] - sellParts[i])

  // বাইরের ক্রেতা (ওয়ারিশ নন) — তাদের কাছে যাওয়া জমিও এই সম্পত্তির অংশ, তাই চূড়ান্ত হিস্যায় আলাদা সারি
  const outsiders = new Map<string, Frac>()
  deeds
    .filter((d) => d.external && d.type === 'sale')
    .forEach((d) => {
      const k = d.counterparty.trim() || 'বাইরের ক্রেতা'
      outsiders.set(k, (outsiders.get(k) || Frac.zero).add(d.areaFrac ?? Frac.fromDecimal(d.area)))
    })
  const outList = [...outsiders.entries()]

  // চূড়ান্ত হিস্যা: কেনা-বেচার পর পুরো সম্পত্তিতে প্রত্যেকের অংশ (১০০০ ভাগে) — খারিজে এটিই লাগে
  const netTotal = sum(rows.map((r) => r.finalTotal))
  const outTotal = sum(outList.map(([, v]) => v))
  const allTotal = netTotal.add(outTotal)
  const allFinal = [...rows.map((r) => r.finalTotal), ...outList.map(([, v]) => v)]
  const allParts = allTotal.isPos() ? apportion(allFinal.map((v) => (v.isPos() ? v.div(allTotal) : Frac.zero)), scale) : allFinal.map(() => 0n)
  const finalParts = allParts.slice(0, rows.length)
  const outParts = allParts.slice(rows.length)
  const outAmt = apportion(outList.map(([, v]) => v), S)

  // মিলানো (নির্ভুল ভগ্নাংশে)
  const owner = ownerName.trim()
  const fsum = (ds: Deed[]) => sum(ds.map((d) => d.areaFrac ?? Frac.fromDecimal(d.area)))
  const start = Frac.fromDecimal(total || '0')
  const ownerSoldIn = fsum(deeds.filter((d) => d.party === owner && d.type === 'sale' && !d.external))
  const extIn = fsum(deeds.filter((d) => d.external && d.type === 'purchase'))
  const extOut = fsum(deeds.filter((d) => d.external && d.type === 'sale'))
  const estate = result.dagTotals.total?.ownerAfterDeeds ?? start
  const unassignedAmt = result.unassigned.mul(estate)
  const expected = start.add(extIn).sub(extOut).sub(unassignedAmt)
  const ok = expected.cmp(netTotal) === 0

  const issues = [...extraIssues.map((text) => ({ level: 'error' as const, text })), ...result.issues]

  const csv = () =>
    downloadCSV(
      ownerName,
      ['ক্রম', 'ওয়ারিশের নাম', 'সম্পর্ক', 'উত্তরাধিকার অংশ', `উত্তরাধিকার হিস্যা (${scale} ভাগে)`, `ওয়ারিশসূত্রে (${unitLabel})`, 'ক্রয় (+)', 'বিক্রয় (−)', `মোট প্রাপ্য (${unitLabel})`, `চূড়ান্ত হিস্যা (${scale} ভাগে)`],
      [
        ...rows.map((r, i) => [i + 1, r.name, r.relations.join('; '), r.share.toString(), fixedFromScaled(r.parts, precision), fmt(inhParts[i]), fmt(buyParts[i]), fmt(sellParts[i]), fmt(netParts[i]), fixedFromScaled(finalParts[i], precision)]),
        ...outList.map(([n], j) => [rows.length + j + 1, n, 'বাইরের ক্রেতা (ওয়ারিশ নন)', '', '', '', fmt(outAmt[j]), '', fmt(outAmt[j]), fixedFromScaled(outParts[j], precision)]),
      ],
    )

  return (
    <section className="bg-white rounded-2xl shadow-sm border border-slate-200 p-5 md:p-6 space-y-6 print:shadow-none print:border-0 print:p-0">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-xl md:text-2xl font-bold text-slate-900">ওয়ারিশদের হিস্যা বণ্টন</h2>
          <p className="text-sm text-slate-600 mt-1">
            মৃত ব্যক্তি: <b>{ownerName || '—'}</b> | মোট সম্পত্তি: <b>{bn(total || '০')} {unitLabel}</b>
          </p>
        </div>
        <div className="flex flex-wrap gap-2 print:hidden">
          <select className="rounded-lg border border-slate-300 px-3 py-2 text-sm bg-white" value={precision} onChange={(e) => onPrecision(Number(e.target.value) as 3 | 4)}>
            <option value={3}>১০০০ ভাগে</option>
            <option value={4}>১০০০০ ভাগে</option>
          </select>
          <button type="button" disabled={!rows.length} onClick={csv} className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm hover:bg-slate-50 disabled:opacity-50">Excel</button>
          <button type="button" onClick={() => window.print()} className="rounded-lg bg-emerald-600 text-white px-4 py-2 text-sm hover:bg-emerald-700">প্রিন্ট</button>
        </div>
      </div>

      {issues.length > 0 && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 print:hidden">
          <h3 className="font-semibold text-amber-900 mb-2">যে তথ্য মিসিং / ঠিক করুন</h3>
          <ul className="list-disc pl-5 space-y-1 text-sm text-amber-900">
            {issues.map((x, i) => <li key={i} className={x.level === 'error' ? 'text-rose-700' : ''}>{bn(x.text)}</li>)}
          </ul>
        </div>
      )}

      {rows.length === 0 ? (
        <p className="text-center text-slate-500 py-8">উপরে মোট সম্পত্তি ও ওয়ারিশদের দিলে এখানে ভাগের টেবিল আসবে।</p>
      ) : (
        <>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr>
                  <th className={th}>ক্রম</th>
                  <th className={th}>ওয়ারিশের নাম</th>
                  <th className={th}>সম্পর্ক</th>
                  <th className={th}>উত্তরাধিকার অংশ</th>
                  <th className={th}>উত্তরাধিকার হিস্যা<br />({bn(scale)} ভাগে)</th>
                  <th className={th}>ওয়ারিশসূত্রে<br />({unitLabel})</th>
                  <th className={th}>ক্রয় (+)</th>
                  <th className={th}>বিক্রয় (−)</th>
                  <th className={`${th} bg-emerald-100`}>মোট প্রাপ্য<br />({unitLabel})</th>
                  <th className={`${th} bg-emerald-100`}>চূড়ান্ত হিস্যা<br />({bn(scale)} ভাগে)</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => (
                  <tr key={r.name} className="even:bg-slate-50/60">
                    <td className={td}>{bn(i + 1)}</td>
                    <td className={`${td} font-medium text-slate-900`}>{r.name}</td>
                    <td className={`${td} text-slate-600`}>{r.relations.join('; ')}</td>
                    <td className={tdn}>{r.share.isZero() ? '—' : fmtFrac(r.share)}</td>
                    <td className={tdn}>{hissya(r.parts)}</td>
                    <td className={tdn}>{bn(fmt(inhParts[i]))}</td>
                    <td className={`${tdn} text-emerald-700`}>{buyParts[i] ? '+' + bn(fmt(buyParts[i])) : '—'}</td>
                    <td className={`${tdn} text-rose-700`}>{sellParts[i] ? '−' + bn(fmt(sellParts[i])) : '—'}</td>
                    <td className={`${tdn} font-semibold ${netParts[i] < 0n ? 'text-rose-700' : ''}`}>{bn(fmt(netParts[i]))}</td>
                    <td className={`${tdn} font-semibold text-emerald-800`}>
                      {hissya(finalParts[i])} <span className="text-slate-400 font-normal text-xs">({bn(finalParts[i])}/{bn(scale)})</span>
                    </td>
                  </tr>
                ))}
                {outList.map(([n], j) => (
                  <tr key={'out' + n} className="bg-amber-50/50">
                    <td className={td}>{bn(rows.length + j + 1)}</td>
                    <td className={`${td} font-medium text-slate-900`}>{n}</td>
                    <td className={`${td} text-slate-600`}>বাইরের ক্রেতা (ওয়ারিশ নন)</td>
                    <td className={tdn}>—</td>
                    <td className={tdn}>—</td>
                    <td className={tdn}>—</td>
                    <td className={`${tdn} text-emerald-700`}>+{bn(fmt(outAmt[j]))}</td>
                    <td className={tdn}>—</td>
                    <td className={`${tdn} font-semibold`}>{bn(fmt(outAmt[j]))}</td>
                    <td className={`${tdn} font-semibold text-emerald-800`}>
                      {hissya(outParts[j])} <span className="text-slate-400 font-normal text-xs">({bn(outParts[j])}/{bn(scale)})</span>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="bg-emerald-50 font-semibold text-emerald-900">
                  <td className={td} colSpan={3}>মোট</td>
                  <td className={tdn}>{fmtFrac(sum(rows.map((r) => r.share)))}</td>
                  <td className={tdn}>{hissya(sumParts(rows.map((r) => r.parts)))}</td>
                  <td className={tdn}>{bn(fmt(sumParts(inhParts)))}</td>
                  <td className={tdn}>{sumParts(buyParts) + sumParts(outAmt) ? '+' + bn(fmt(sumParts(buyParts) + sumParts(outAmt))) : '—'}</td>
                  <td className={tdn}>{sumParts(sellParts) ? '−' + bn(fmt(sumParts(sellParts))) : '—'}</td>
                  <td className={tdn}>{bn(fmt(sumParts(netParts) + sumParts(outAmt)))}</td>
                  <td className={tdn}>{hissya(sumParts(allParts))}</td>
                </tr>
              </tfoot>
            </table>
          </div>

          <div className="rounded-xl bg-slate-50 border border-slate-200 p-4 text-sm text-slate-700 space-y-1.5">
            <p className="font-semibold text-slate-800">হিসাব মিলানো</p>
            <p>
              মোট সম্পত্তি {bn(fmt(round(start)))}
              {ownerSoldIn.isPos() && <> (এর মধ্যে মৃত ব্যক্তি জীবদ্দশায় ওয়ারিশদের কাছে বিক্রি করেছেন {bn(fmt(round(ownerSoldIn)))} — বাকি {bn(fmt(round(estate)))} উত্তরাধিকারে ভাগ হয়েছে)</>}
              {extIn.isPos() && <> + বাইরে থেকে ক্রয় {bn(fmt(round(extIn)))}</>}
              {extOut.isPos() && <> − বাইরে বিক্রয় {bn(fmt(round(extOut)))}</>}
              {unassignedAmt.isPos() && <> − অবণ্টিত {bn(fmt(round(unassignedAmt)))}</>}
              {' '}= ওয়ারিশদের মোট প্রাপ্য <b>{bn(fmt(round(netTotal)))} {unitLabel}</b>
              {outTotal.isPos() && <> ; বাইরের ক্রেতাদের সহ পুরো সম্পত্তি <b>{bn(fmt(round(allTotal)))} {unitLabel}</b></>}
              {ok ? <span className="text-emerald-700 font-semibold"> ✓ মিলেছে</span> : <span className="text-rose-700 font-semibold"> ✗ মিলছে না (হওয়ার কথা {bn(fmt(round(expected)))}) — উপরের সতর্কতা দেখুন</span>}
            </p>
            <p className="text-xs text-slate-500">
              ওয়ারিশদের নিজেদের মধ্যে কেনা-বেচায় মোট বদলায় না — বিক্রেতার যত কমে, ক্রেতাদের তত বাড়ে। “উত্তরাধিকার হিস্যা” = শুধু ফারায়েজ অনুযায়ী অংশ; “চূড়ান্ত হিস্যা” = কেনা-বেচার পর বর্তমান মালিকানা (খারিজে এটি দিন)। হিস্যা নির্ভুল ভগ্নাংশ থেকে গোল করা, মোট সবসময় ঠিক {bn(scale)}।
            </p>
          </div>

          <details className="rounded-xl border border-slate-200 p-4 print:border-0 print:p-0" open>
            <summary className="font-semibold text-slate-800 cursor-pointer print:list-none">কে কেন কত পেলেন (ধাপে ধাপে)</summary>
            <div className="overflow-x-auto mt-3">
              <table className="w-full border-collapse">
                <thead>
                  <tr>
                    <th className={th}>মৃত ব্যক্তি</th>
                    <th className={th}>ওয়ারিশ</th>
                    <th className={th}>সম্পর্ক</th>
                    <th className={th}>নিয়ম / কারণ</th>
                    <th className={th}>অংশ</th>
                  </tr>
                </thead>
                <tbody>
                  {result.breakdown.map((b, i) => (
                    <tr key={i} className={b.status === 'excluded' ? 'text-slate-400' : ''}>
                      <td className={td} style={{ paddingLeft: 12 + b.level * 14 }}>{b.deceased}</td>
                      <td className={td}>{b.heir}</td>
                      <td className={td}>{b.rel}</td>
                      <td className={`${td} text-xs`}>{b.basis}</td>
                      <td className={tdn}>{b.status === 'excluded' ? 'পাবেন না' : fmtFrac(b.share)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {result.estateNotes.length > 0 && (
              <ul className="mt-3 space-y-1 text-sm text-slate-700 list-disc pl-5">
                {result.estateNotes.flatMap((e) => e.notes.map((n, j) => <li key={e.deceased + j}><b>{e.deceased}:</b> {bn(n)}</li>))}
              </ul>
            )}
          </details>
        </>
      )}
    </section>
  )
}
