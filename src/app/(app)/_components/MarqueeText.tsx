"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/cn";

// Uzun matnni maydonidan chiqarmasdan ko'rsatadi: matn sig'masa 3 soniyadan
// keyin sekin surilib oxirini ko'rsatadi va qaytadi (globals.css → mqScroll).
// Sig'sa — hech qanday animatsiya bo'lmaydi.
export default function MarqueeText({ text, className }: { text: string; className?: string }) {
  const boxRef = useRef<HTMLSpanElement>(null);
  const innerRef = useRef<HTMLSpanElement>(null);
  const [shift, setShift] = useState(0);

  useEffect(() => {
    const measure = () => {
      const box = boxRef.current;
      const inner = innerRef.current;
      if (!box || !inner) return;
      const over = inner.scrollWidth - box.clientWidth;
      setShift(over > 4 ? over : 0); // 4px — o'lchov xatosiga bardosh
    };
    measure();
    const ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(measure) : null;
    if (ro && boxRef.current) ro.observe(boxRef.current);
    return () => ro?.disconnect();
  }, [text]);

  return (
    <span ref={boxRef} className={cn("block overflow-hidden whitespace-nowrap", className)}>
      <span
        ref={innerRef}
        className={cn("inline-block whitespace-nowrap will-change-transform", shift > 0 && "mq-run")}
        style={
          shift > 0
            ? ({ "--mq-shift": `-${shift}px`, "--mq-dur": `${Math.round(10 + shift / 25)}s` } as React.CSSProperties)
            : undefined
        }
      >
        {text}
      </span>
    </span>
  );
}
