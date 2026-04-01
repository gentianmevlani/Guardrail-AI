import { AuthProvider } from "@/context/auth-context";

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <AuthProvider>{children}</AuthProvider>;
}
