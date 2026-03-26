import Sidebar from "@/components/sidebar";
import DashboardHeader from "@/components/app/DashboardHeader";
import { ErrorBoundary } from "@/components/error-boundary";

export const dynamic = "force-dynamic";

export default function DashboardLayout({ children }) {
  return (
    <div className="flex h-screen overflow-hidden bg-[#fafaf9] text-foreground">
      <Sidebar />
      <main className="flex-1 flex flex-col min-w-0 md:ml-64">
        <DashboardHeader />
        <div className="flex-1 overflow-y-auto">
          <ErrorBoundary>{children}</ErrorBoundary>
        </div>
      </main>
    </div>
  );
}
