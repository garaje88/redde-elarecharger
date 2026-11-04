import { Suspense } from "react";
import { BottomNav, BottomNavFallback } from "@/components/bottom-nav";

export default function AppLayout({ children }: LayoutProps<"/">) {
  return (
    <div className="flex min-h-dvh flex-1 flex-col pb-24 md:pb-0 md:pl-24">
      {children}
      <Suspense fallback={<BottomNavFallback />}>
        <BottomNav />
      </Suspense>
    </div>
  );
}
