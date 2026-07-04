"use client";

import { ImagePlus, Loader2, Trash2, X } from "lucide-react";
import Image from "next/image";
import { useEffect, useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

export type TodoItem = {
  id: string;
  title: string;
  is_complete: boolean;
  image_path: string | null;
  image_url: string | null;
  created_at: string;
};

type TodoWorkbenchProps = {
  initialTodos: TodoItem[];
  userId: string;
};

export function TodoWorkbench({ initialTodos, userId }: TodoWorkbenchProps) {
  const [todos, setTodos] = useState(initialTodos);
  const [title, setTitle] = useState("");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const supabase = useMemo(() => createClient(), []);

  useEffect(() => {
    if (!imageFile) {
      setPreviewUrl(null);
      return;
    }

    const nextPreviewUrl = URL.createObjectURL(imageFile);
    setPreviewUrl(nextPreviewUrl);

    return () => URL.revokeObjectURL(nextPreviewUrl);
  }, [imageFile]);

  const clearImage = () => {
    setImageFile(null);
    setPreviewUrl(null);
  };

  const addTodo = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const trimmedTitle = title.trim();
    if (!trimmedTitle) {
      setError("请输入待办事项内容");
      return;
    }

    setIsSaving(true);
    setError(null);

    try {
      let imagePath: string | null = null;

      if (imageFile) {
        const extension = imageFile.name.split(".").pop() || "jpg";
        const safeName = `${crypto.randomUUID()}.${extension.toLowerCase()}`;
        imagePath = `${userId}/${safeName}`;

        const { error: uploadError } = await supabase.storage
          .from("todo-attachments")
          .upload(imagePath, imageFile, {
            cacheControl: "3600",
            contentType: imageFile.type,
            upsert: false,
          });

        if (uploadError) throw uploadError;
      }

      const { data, error: insertError } = await supabase
        .from("todos")
        .insert({
          title: trimmedTitle,
          user_id: userId,
          image_path: imagePath,
        })
        .select("id, title, is_complete, image_path, created_at")
        .single();

      if (insertError) throw insertError;
      if (!data) throw new Error("待办事项保存失败");

      setTodos((currentTodos) => [
        {
          id: data.id,
          title: data.title,
          is_complete: data.is_complete,
          image_path: data.image_path,
          image_url: previewUrl,
          created_at: data.created_at,
        },
        ...currentTodos,
      ]);
      setTitle("");
      clearImage();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "保存失败");
    } finally {
      setIsSaving(false);
    }
  };

  const toggleTodo = async (todo: TodoItem) => {
    const nextValue = !todo.is_complete;
    setTodos((currentTodos) =>
      currentTodos.map((item) =>
        item.id === todo.id ? { ...item, is_complete: nextValue } : item,
      ),
    );

    const { error: updateError } = await supabase
      .from("todos")
      .update({ is_complete: nextValue })
      .eq("id", todo.id);

    if (updateError) {
      setTodos((currentTodos) =>
        currentTodos.map((item) =>
          item.id === todo.id ? { ...item, is_complete: todo.is_complete } : item,
        ),
      );
      setError(updateError.message);
    }
  };

  const deleteTodo = async (todo: TodoItem) => {
    setError(null);

    const { error: deleteError } = await supabase
      .from("todos")
      .delete()
      .eq("id", todo.id);

    if (deleteError) {
      setError(deleteError.message);
      return;
    }

    if (todo.image_path) {
      await supabase.storage.from("todo-attachments").remove([todo.image_path]);
    }

    setTodos((currentTodos) =>
      currentTodos.filter((item) => item.id !== todo.id),
    );
  };

  return (
    <div className="grid gap-8 lg:grid-cols-[0.85fr_1.15fr]">
      <section className="rounded-lg border bg-card p-5 shadow-sm">
        <div className="mb-5">
          <h2 className="text-xl font-semibold">新增待办</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            输入事项内容，可选择一张图片作为附件。
          </p>
        </div>

        <form onSubmit={addTodo} className="space-y-5">
          <div className="grid gap-2">
            <Label htmlFor="todo-title">待办事项</Label>
            <Input
              id="todo-title"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="例如：整理本周会议纪要"
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="todo-image">图片附件</Label>
            <label
              htmlFor="todo-image"
              className="flex min-h-36 cursor-pointer flex-col items-center justify-center gap-3 rounded-lg border border-dashed bg-background p-4 text-center transition-colors hover:bg-accent"
            >
              {previewUrl ? (
                <div className="relative h-40 w-full overflow-hidden rounded-md border">
                  <Image
                    src={previewUrl}
                    alt="待办附件预览"
                    fill
                    className="object-cover"
                    unoptimized
                  />
                </div>
              ) : (
                <>
                  <ImagePlus className="h-8 w-8 text-muted-foreground" />
                  <span className="text-sm text-muted-foreground">
                    选择图片后会在这里显示预览
                  </span>
                </>
              )}
            </label>
            <Input
              id="todo-image"
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(event) =>
                setImageFile(event.target.files?.[0] ?? null)
              }
            />
            {previewUrl && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={clearImage}
                className="w-fit"
              >
                <X />
                移除图片
              </Button>
            )}
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}

          <Button type="submit" className="w-full" disabled={isSaving}>
            {isSaving && <Loader2 className="animate-spin" />}
            {isSaving ? "保存中..." : "添加到工作台"}
          </Button>
        </form>
      </section>

      <section className="space-y-4">
        <div className="flex items-end justify-between gap-4">
          <div>
            <h2 className="text-xl font-semibold">我的待办</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              共 {todos.length} 项，完成后可勾选。
            </p>
          </div>
        </div>

        {todos.length === 0 ? (
          <div className="rounded-lg border bg-card p-8 text-center text-sm text-muted-foreground">
            还没有待办事项，先添加第一条吧。
          </div>
        ) : (
          <div className="space-y-3">
            {todos.map((todo) => (
              <article
                key={todo.id}
                className="rounded-lg border bg-card p-4 shadow-sm"
              >
                <div className="flex items-start gap-3">
                  <Checkbox
                    checked={todo.is_complete}
                    onCheckedChange={() => toggleTodo(todo)}
                    className="mt-1"
                    aria-label="切换完成状态"
                  />
                  <div className="min-w-0 flex-1 space-y-3">
                    <p
                      className={cn(
                        "break-words text-sm font-medium leading-6",
                        todo.is_complete &&
                          "text-muted-foreground line-through",
                      )}
                    >
                      {todo.title}
                    </p>
                    {todo.image_url && (
                      <div className="relative h-44 overflow-hidden rounded-md border bg-background sm:h-56">
                        <Image
                          src={todo.image_url}
                          alt={`${todo.title} 的附件`}
                          fill
                          className="object-cover"
                          unoptimized
                        />
                      </div>
                    )}
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => deleteTodo(todo)}
                    aria-label="删除待办"
                  >
                    <Trash2 />
                  </Button>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
