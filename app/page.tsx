import Link from "next/link";

import { Button } from "@/components/ui/button";

export default function Home() {
  return (
    <main className="min-h-screen bg-background">
      <div className="mx-auto flex min-h-screen w-full max-w-5xl flex-col px-5">
        <nav className="flex h-16 items-center justify-between border-b text-sm">
          <Link href="/" className="font-semibold">
            多比待办事项管理系统
          </Link>
          <Button asChild variant="ghost" size="sm">
            <Link href="/protected">我的工作台</Link>
          </Button>
        </nav>

        <div className="grid flex-1 items-center gap-10 py-12 md:grid-cols-[1.1fr_0.9fr]">
          <section className="flex flex-col gap-6">
            <div className="space-y-4">
              <p className="text-sm font-medium text-muted-foreground">
                Supabase + Next.js
              </p>
              <h1 className="max-w-2xl text-4xl font-semibold leading-tight md:text-6xl">
                管理今天要完成的每一件事
              </h1>
              <p className="max-w-xl text-base leading-7 text-muted-foreground">
                使用邮箱快速注册或登录，在工作台中记录待办事项，并为任务添加图片附件。
              </p>
            </div>
            <div className="flex flex-col gap-3 sm:flex-row">
              <Button asChild size="lg">
                <Link href="/auth/sign-up">新用户注册</Link>
              </Button>
              <Button asChild size="lg" variant="outline">
                <Link href="/auth/login">用户登录</Link>
              </Button>
            </div>
          </section>

          <section className="rounded-lg border bg-card p-6 shadow-sm">
            <div className="space-y-5">
              <div className="flex items-center justify-between border-b pb-4">
                <div>
                  <p className="font-medium">我的工作台</p>
                  <p className="text-sm text-muted-foreground">今日待办预览</p>
                </div>
                <span className="rounded-full bg-secondary px-3 py-1 text-xs">
                  3 项
                </span>
              </div>
              {["整理产品需求", "上传会议照片", "确认数据库策略"].map(
                (item, index) => (
                  <div
                    key={item}
                    className="flex items-center gap-3 rounded-md border bg-background p-3"
                  >
                    <span className="flex h-6 w-6 items-center justify-center rounded-full border text-xs">
                      {index + 1}
                    </span>
                    <span className="text-sm">{item}</span>
                  </div>
                ),
              )}
            </div>
          </section>
        </div>
        <footer className="border-t py-5 text-center text-xs text-muted-foreground">
          系统版权归属@多比爸爸
        </footer>
      </div>
    </main>
  );
}
