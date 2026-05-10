import { ReactNode } from "react";
import { Battery, Wifi, WifiOff, Signal } from "lucide-react";
import { useAppStore } from "@/lib/store";

interface PhoneFrameProps {
  children: ReactNode;
}

export function PhoneFrame({ children }: PhoneFrameProps) {
  const pendingCount = useAppStore((s) => s.pendingCount);
  const timeStr = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

  return (
    <div className="min-h-screen w-full bg-background md:bg-black md:p-8 flex items-center justify-center">
      <div className="w-full h-full md:w-[390px] md:h-[844px] md:rounded-[3rem] md:border-[8px] border-zinc-800 bg-background overflow-hidden relative shadow-2xl flex flex-col">
        {/* Dynamic Island / Notch (desktop only) */}
        <div className="hidden md:block absolute top-0 inset-x-0 h-7 z-50 pointer-events-none">
          <div className="w-32 h-7 bg-zinc-900 mx-auto rounded-b-3xl" />
        </div>

        {/* Status Bar */}
        <div className="h-12 w-full flex items-center justify-between px-6 pt-2 text-[13px] font-medium z-40 bg-background/80 backdrop-blur-md sticky top-0 border-b border-border/50">
          <div className="w-16 flex justify-start">
            <span>{timeStr}</span>
          </div>
          <div className="w-16 flex justify-end items-center gap-1.5">
            <Signal className="w-3.5 h-3.5" />
            {pendingCount > 0 ? <WifiOff className="w-3.5 h-3.5 text-amber-400" /> : <Wifi className="w-3.5 h-3.5" />}
            <Battery className="w-4 h-4" />
          </div>
        </div>

        {/* App Content */}
        <div className="flex-1 overflow-y-auto relative bg-background pb-safe">
          {children}
        </div>
      </div>
    </div>
  );
}
