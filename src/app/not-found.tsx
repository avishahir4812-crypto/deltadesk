import Link from "next/link";
import { Compass } from "lucide-react";
import { Card } from "@/components/ui";

export default function NotFound() {
  return (
    <div className="grid min-h-[60vh] place-items-center animate-rise">
      <Card className="max-w-md p-8 text-center">
        <span className="mx-auto grid h-11 w-11 place-items-center rounded-xl border border-line bg-paper text-brand">
          <Compass size={19} />
        </span>
        <p className="num mt-4 text-[12px] font-bold tracking-[0.2em] text-faint">404</p>
        <h2 className="mt-1 text-[16px] font-bold tracking-tight">This desk doesn't exist</h2>
        <p className="mt-1.5 text-[12.5px] leading-relaxed text-faint">
          The page you asked for isn't one of the terminal's modules.
        </p>
        <Link
          href="/"
          className="mt-5 inline-flex h-9 items-center rounded-lg bg-brand px-3.5 text-[13px] font-medium text-white transition-colors hover:bg-brand-deep"
        >
          Back to Overview
        </Link>
      </Card>
    </div>
  );
}
