export const dynamic = "force-dynamic";

export default function AuthLayout({ children }) {
  return (
    <div className="min-h-screen bg-background text-foreground">{children}</div>
  );
}
