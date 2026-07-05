import { EnvVarWarning } from "@/components/env-var-warning";
import { AuthButton } from "@/components/auth-button";
import { hasEnvVars } from "@/lib/utils";
import Link from "next/link";
import { Suspense } from "react";

export default function ProtectedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <main className="duobi-shell flex min-h-screen flex-col items-center">
      <div className="relative z-10 flex w-full flex-1 flex-col items-center">
        <nav className="flex h-20 w-full justify-center border-b border-white/10 bg-background/30 backdrop-blur-xl">
          <div className="flex w-full max-w-6xl items-center justify-between p-3 px-5 text-sm">
            <div className="flex items-center gap-5 font-semibold">
              <Link href={"/"}>多比待办事项管理系统</Link>
              <Link
                href="/protected"
                className="text-sm font-normal text-muted-foreground hover:text-foreground"
              >
                我的工作台
              </Link>
            </div>
            {!hasEnvVars ? (
              <EnvVarWarning />
            ) : (
              <Suspense>
                <AuthButton />
              </Suspense>
            )}
          </div>
        </nav>
        <div className="flex w-full max-w-6xl flex-1 flex-col p-5 py-8">
          {children}
        </div>
      </div>
    </main>
  );
}
