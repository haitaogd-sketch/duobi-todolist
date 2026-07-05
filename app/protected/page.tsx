import { redirect } from "next/navigation";
import { Suspense } from "react";

import { createClient } from "@/lib/supabase/server";
import { TodoItem, TodoWorkbench } from "@/components/todo-workbench";
import { hasEnvVars } from "@/lib/utils";

type TodoRecord = Omit<TodoItem, "image_url">;

async function ProtectedWorkbench() {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getUser();

  if (error || !data?.user) {
    redirect("/auth/login");
  }

  const userId = data.user.id;
  const { data: todos } = await supabase
    .from("todos")
    .select("id, title, is_complete, image_path, created_at")
    .order("created_at", { ascending: false });

  const todosWithSignedUrls: TodoItem[] = await Promise.all(
    ((todos ?? []) as TodoRecord[]).map(async (todo) => {
      if (!todo.image_path) {
        return { ...todo, image_url: null };
      }

      const { data: signedUrlData } = await supabase.storage
        .from("todo-attachments")
        .createSignedUrl(todo.image_path, 60 * 60);

      return {
        ...todo,
        image_url: signedUrlData?.signedUrl ?? null,
      };
    }),
  );

  return <TodoWorkbench initialTodos={todosWithSignedUrls} userId={userId} />;
}

function WorkbenchFallback() {
  return (
    <div className="grid gap-8 lg:grid-cols-[0.85fr_1.15fr]">
      <div className="duobi-glass h-96 animate-pulse rounded-lg" />
      <div className="space-y-3">
        <div className="duobi-glass h-16 animate-pulse rounded-lg" />
        <div className="duobi-glass h-28 animate-pulse rounded-lg" />
        <div className="duobi-glass h-28 animate-pulse rounded-lg" />
      </div>
    </div>
  );
}

export default function ProtectedPage() {
  if (!hasEnvVars) {
    return (
      <div className="rounded-lg border bg-card p-6 shadow-sm">
        <h1 className="text-2xl font-semibold">需要配置 Supabase</h1>
        <p className="mt-3 text-sm leading-6 text-muted-foreground">
          请先在环境变量中配置 NEXT_PUBLIC_SUPABASE_URL 和
          NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY，然后执行
          supabase/schema.sql 中的数据库脚本。
        </p>
      </div>
    );
  }

  return (
    <div className="flex w-full flex-1 flex-col gap-8">
      <header className="space-y-2">
        <p className="duobi-kicker">欢迎回来</p>
        <h1 className="duobi-gradient-text text-4xl font-semibold md:text-5xl">
          我的工作台
        </h1>
        <p className="max-w-2xl text-sm leading-6 text-muted-foreground">
          在这里记录待办事项、上传图片附件，并跟踪每项任务的完成状态。
        </p>
      </header>
      <Suspense fallback={<WorkbenchFallback />}>
        <ProtectedWorkbench />
      </Suspense>
    </div>
  );
}
