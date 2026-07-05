import Link from "next/link";
import { ArrowRight, CheckCircle2, Sparkles } from "lucide-react";

import { Button } from "@/components/ui/button";

export default function Home() {
  return (
    <main className="duobi-shell min-h-screen">
      <div className="relative z-10 mx-auto flex min-h-screen w-full max-w-6xl flex-col px-5">
        <nav className="flex h-20 items-center justify-between border-b border-white/10 text-sm">
          <Link href="/" className="font-semibold text-foreground">
            多比待办事项管理系统
          </Link>
          <Button asChild variant="ghost" size="sm">
            <Link href="/protected">我的工作台</Link>
          </Button>
        </nav>

        <div className="grid flex-1 items-center gap-10 py-12 md:grid-cols-[1.08fr_0.92fr]">
          <section className="flex flex-col gap-8">
            <div className="space-y-6">
              <p className="duobi-kicker">
                <Sparkles className="h-3.5 w-3.5 text-primary" />
                私人效率空间
              </p>
              <h1 className="duobi-gradient-text max-w-3xl text-5xl font-semibold leading-tight md:text-7xl">
                把今天过得漂亮一点
              </h1>
              <p className="max-w-xl text-base leading-8 text-muted-foreground md:text-lg">
                一个克制、利落、带一点锋芒的待办系统。记录事项、收藏画面、管理节奏，让每一天都有清晰的完成感。
              </p>
            </div>
            <div className="flex flex-col gap-3 sm:flex-row">
              <Button asChild size="lg" className="shadow-lg shadow-primary/20">
                <Link href="/auth/sign-up">
                  新用户注册
                  <ArrowRight />
                </Link>
              </Button>
              <Button asChild size="lg" variant="outline" className="border-white/15 bg-white/[0.03]">
                <Link href="/auth/login">用户登录</Link>
              </Button>
            </div>
            <div className="grid max-w-xl gap-3 text-sm text-muted-foreground sm:grid-cols-3">
              {["图片附件", "私有数据", "多端访问"].map((item) => (
                <div key={item} className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-primary" />
                  {item}
                </div>
              ))}
            </div>
          </section>

          <section className="duobi-glass rounded-lg p-6">
            <div className="space-y-5">
              <div className="flex items-center justify-between border-b border-white/10 pb-4">
                <div>
                  <p className="font-medium text-foreground">我的工作台</p>
                  <p className="text-sm text-muted-foreground">今日待办预览</p>
                </div>
                <span className="rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs text-primary">
                  3 项
                </span>
              </div>
              {["整理产品需求", "上传会议照片", "确认数据库策略"].map(
                (item, index) => (
                  <div
                    key={item}
                    className="flex items-center gap-3 rounded-md border border-white/10 bg-white/[0.04] p-3"
                  >
                    <span className="flex h-6 w-6 items-center justify-center rounded-full border border-white/15 bg-background/40 text-xs text-primary">
                      {index + 1}
                    </span>
                    <span className="text-sm">{item}</span>
                  </div>
                ),
              )}
            </div>
          </section>
        </div>
        <footer className="border-t border-white/10 py-5 text-center text-xs text-muted-foreground">
          系统版权归属@多比爸爸
        </footer>
      </div>
    </main>
  );
}
