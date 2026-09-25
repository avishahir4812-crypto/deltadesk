"use client";

import { useEffect } from "react";
import { RotateCcw, TriangleAlert } from "lucide-react";
import { Btn, Card } from "@/components/ui";

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="grid min-h-[60vh] place-items-center animate-rise">
      <Card className="max-w-md p-8 text-center">
        <span className="mx-auto grid h-11 w-11 place-items-center rounded-xl border border-line bg-paper text-warn">
          <TriangleAlert size={19} />
        </span>
        <h2 className="mt-4 text-[16px] font-bold tracking-tight">This panel hit an error</h2>
        <p className="mt-1.5 text-[12.5px] leading-relaxed text-faint">
          The rest of the terminal is unaffected. Retry — transient states clear on the next render.
        </p>
        <Btn variant="solid" className="mt-5" onClick={reset}>
          <RotateCcw size={14} /> Retry
        </Btn>
      </Card>
    </div>
  );
}
