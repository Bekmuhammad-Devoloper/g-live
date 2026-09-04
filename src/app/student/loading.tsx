// Sahifa ma'lumot kutayotganda ko'rinadigan skelet.
//
// O'quvchi sahifalari serverda o'nlab so'rov bajaradi (davomat, vazifa, tanga,
// reyting...). Bunisiz sekin internetda telefonda BO'SH ekran turardi va ilova
// osilib qolgandek tuyulardi. Skelet layout ichida chiziladi — sarlavha, fon va
// pastki menyu darhol joyida bo'ladi, faqat mazmun "yuklanmoqda" holatida.
//
// Bu butun /student bo'limiga tegishli, shu sabab ataylab NEYTRAL: aniq bir
// sahifaning maketini takrorlamaydi, umumiy ritmni beradi.

function Bar({ w = "100%", h = 14, r = 8 }: { w?: string; h?: number; r?: number }) {
  return <span className="block bg-slate-900/[0.07]" style={{ width: w, height: h, borderRadius: r }} />;
}

export default function StudentLoading() {
  return (
    <div className="animate-pulse space-y-[18px]" aria-busy="true" aria-live="polite">
      {/* sarlavha qatori */}
      <div className="flex items-center gap-2.5 pt-1">
        <span className="h-11 w-11 shrink-0 rounded-full bg-slate-900/[0.07]" />
        <div className="flex-1 space-y-2">
          <Bar w="62%" h={18} />
          <Bar w="42%" h={11} />
        </div>
        <span className="gl-glass h-11 w-[74px] rounded-2xl" />
        <span className="gl-glass h-11 w-11 rounded-full" />
      </div>

      {/* to'rtta kichik karta */}
      <div className="grid grid-cols-4 gap-2.5">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="gl-glass flex flex-col items-center gap-2 rounded-[22px] px-1 pb-3.5 pt-4">
            <span className="h-12 w-12 rounded-2xl bg-slate-900/[0.07]" />
            <Bar w="80%" h={11} />
            <span className="h-[52px] w-[52px] rounded-full bg-slate-900/[0.07]" />
          </div>
        ))}
      </div>

      {/* katta karta */}
      <div className="gl-glass min-h-[168px] p-6">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 space-y-3">
            <Bar w="45%" h={11} />
            <Bar w="70%" h={26} />
            <Bar w="55%" h={13} />
          </div>
          <span className="h-24 w-24 shrink-0 rounded-full bg-slate-900/[0.07]" />
        </div>
        <div className="mt-6">
          <Bar h={10} r={999} />
        </div>
      </div>

      {/* keng karta */}
      <div className="gl-glass space-y-3 p-6">
        <Bar w="58%" h={22} />
        <Bar w="80%" h={13} />
        <span className="mt-2 block h-11 w-[150px] rounded-2xl bg-slate-900/[0.07]" />
      </div>
    </div>
  );
}
