export const dynamic = "force-dynamic";

export default function AuthLayout({ children }) {
  return <div className="dark min-h-screen bg-background text-foreground">{children}</div>;
}
