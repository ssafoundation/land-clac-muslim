import { CalculatorForm } from '@/components/calculator-form'

export default function Home() {
  return (
    <main className="py-8 md:py-10 px-4 print:p-0">
      <div className="max-w-5xl mx-auto text-center mb-8 print:hidden">
        <h1 className="text-3xl md:text-4xl font-bold text-slate-900 mb-2">জমির হিসাব</h1>
        <p className="text-slate-600 text-base md:text-lg">
          মুসলিম ফারায়েজ অনুযায়ী ওয়ারিশদের নির্ভুল হিস্যা (১০০০ ভাগে)
        </p>
      </div>
      <CalculatorForm />
    </main>
  )
}
