import Sidebar from "@/components/sidebar";
import { ErrorBoundary } from "@/components/error-boundary";

export const dynamic = "force-dynamic";

export default function DashboardLayout({ children }) {
  return (
    <div className="dark flex min-h-screen bg-background text-foreground">
      <Sidebar />
      <main className="flex-1 md:ml-64 pt-14 md:pt-0">
        <ErrorBoundary>{children}</ErrorBoundary>
      </main>
    </div>
  );
}
