"use client";

import { ImagePlus, Loader2, Sparkles, Trash2, X } from "lucide-react";
import Image from "next/image";
import { useEffect, useMemo, useRef, useState } from "react";

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

type TodoRow = {
  id: string;
  user_id?: string;
  title: string;
  is_complete: boolean;
  image_path: string | null;
  created_at: string;
};

type AnalyzedTodoCandidate = {
  id: string;
  title: string;
  confidence: number;
  source: "text" | "image" | "text_and_image";
  selected: boolean;
};

type TodoWorkbenchProps = {
  initialTodos: TodoItem[];
  userId: string;
};

function sortTodosByCreatedAt(todos: TodoItem[]) {
  return [...todos].sort(
    (first, second) =>
      new Date(second.created_at).getTime() - new Date(first.created_at).getTime(),
  );
}

export function TodoWorkbench({ initialTodos, userId }: TodoWorkbenchProps) {
  const [todos, setTodos] = useState(initialTodos);
  const [title, setTitle] = useState("");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [analyzedTodos, setAnalyzedTodos] = useState<AnalyzedTodoCandidate[]>([]);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isRealtimeConnected, setIsRealtimeConnected] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const supabase = useMemo(() => createClient(), []);

  useEffect(() => {
    setTodos(initialTodos);
  }, [initialTodos]);

  useEffect(() => {
    if (!imageFile) {
      setPreviewUrl(null);
      return;
    }

    const nextPreviewUrl = URL.createObjectURL(imageFile);
    setPreviewUrl(nextPreviewUrl);

    return () => URL.revokeObjectURL(nextPreviewUrl);
  }, [imageFile]);

  useEffect(() => {
    let isMounted = true;

    const getSignedImageUrl = async (imagePath: string | null) => {
      if (!imagePath) return null;

      const { data } = await supabase.storage
        .from("todo-attachments")
        .createSignedUrl(imagePath, 60 * 60);

      return data?.signedUrl ?? null;
    };

    const todoFromRow = async (row: TodoRow): Promise<TodoItem> => ({
      id: row.id,
      title: row.title,
      is_complete: row.is_complete,
      image_path: row.image_path,
      image_url: await getSignedImageUrl(row.image_path),
      created_at: row.created_at,
    });

    const upsertTodo = (todo: TodoItem) => {
      setTodos((currentTodos) =>
        sortTodosByCreatedAt([
          todo,
          ...currentTodos.filter((currentTodo) => currentTodo.id !== todo.id),
        ]),
      );
    };

    const channel = supabase
      .channel(`todos-realtime:${userId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "todos",
          filter: `user_id=eq.${userId}`,
        },
        async (payload) => {
          if (payload.eventType === "DELETE") {
            const deletedTodo = payload.old as Pick<TodoRow, "id">;
            setTodos((currentTodos) =>
              currentTodos.filter((todo) => todo.id !== deletedTodo.id),
            );
            return;
          }

          const realtimeTodo = await todoFromRow(payload.new as TodoRow);
          if (isMounted) {
            upsertTodo(realtimeTodo);
          }
        },
      )
      .subscribe((status) => {
        if (!isMounted) return;
        setIsRealtimeConnected(status === "SUBSCRIBED");
      });

    return () => {
      isMounted = false;
      void supabase.removeChannel(channel);
    };
  }, [supabase, userId]);

  const clearImage = () => {
    setImageFile(null);
    setPreviewUrl(null);
  };

  const setImageAttachment = (file: File | null) => {
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      setError("只能添加图片作为附件");
      return;
    }

    setError(null);
    setImageFile(file);
  };

  const handlePasteImage = (event: React.ClipboardEvent<HTMLElement>) => {
    const imageItem = Array.from(event.clipboardData.items).find((item) =>
      item.type.startsWith("image/"),
    );

    if (!imageItem) return;

    const pastedFile = imageItem.getAsFile();
    if (!pastedFile) return;

    event.preventDefault();
    event.stopPropagation();
    const extension = pastedFile.type.split("/")[1] || "png";
    setImageAttachment(
      new File([pastedFile], `pasted-image-${Date.now()}.${extension}`, {
        type: pastedFile.type,
      }),
    );
  };

  const analyzeTodos = async () => {
    if (!title.trim() && !imageFile) {
      setError("请输入文本或选择图片后再进行智能分析");
      return;
    }

    setIsAnalyzing(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append("text", title);
      if (imageFile) {
        formData.append("image", imageFile);
      }

      const response = await fetch("/api/todos/analyze", {
        method: "POST",
        body: formData,
      });
      const payload = (await response.json()) as {
        todos?: Array<{
          title: string;
          confidence?: number;
          source?: "text" | "image" | "text_and_image";
        }>;
        error?: string;
      };

      if (!response.ok) {
        throw new Error(payload.error ?? "智能分析失败");
      }

      const nextAnalyzedTodos = (payload.todos ?? []).map((todo) => ({
        id: crypto.randomUUID(),
        title: todo.title,
        confidence: todo.confidence ?? 0,
        source: todo.source ?? "text",
        selected: true,
      }));

      if (nextAnalyzedTodos.length === 0) {
        setError("没有分析出明确的待办事项");
        setAnalyzedTodos([]);
        return;
      }

      setAnalyzedTodos(nextAnalyzedTodos);
    } catch (analyzeError) {
      setError(
        analyzeError instanceof Error ? analyzeError.message : "智能分析失败",
      );
    } finally {
      setIsAnalyzing(false);
    }
  };

  const updateAnalyzedTodo = (
    id: string,
    updates: Partial<Pick<AnalyzedTodoCandidate, "title" | "selected">>,
  ) => {
    setAnalyzedTodos((currentTodos) =>
      currentTodos.map((todo) =>
        todo.id === id ? { ...todo, ...updates } : todo,
      ),
    );
  };

  const removeAnalyzedTodo = (id: string) => {
    setAnalyzedTodos((currentTodos) =>
      currentTodos.filter((todo) => todo.id !== id),
    );
  };

  const addAnalyzedTodos = async () => {
    const selectedTodos = analyzedTodos
      .filter((todo) => todo.selected)
      .map((todo) => todo.title.trim())
      .filter(Boolean);

    if (selectedTodos.length === 0) {
      setError("请至少选择一条待办事项");
      return;
    }

    setIsSaving(true);
    setError(null);

    try {
      const { data, error: insertError } = await supabase
        .from("todos")
        .insert(
          selectedTodos.map((todoTitle) => ({
            title: todoTitle,
            user_id: userId,
            image_path: null,
          })),
        )
        .select("id, title, is_complete, image_path, created_at");

      if (insertError) throw insertError;

      const insertedTodos = ((data ?? []) as TodoRow[]).map((todo) => ({
        ...todo,
        image_url: null,
      }));

      setTodos((currentTodos) =>
        sortTodosByCreatedAt([
          ...insertedTodos,
          ...currentTodos.filter(
            (todo) =>
              !insertedTodos.some((insertedTodo) => insertedTodo.id === todo.id),
          ),
        ]),
      );
      setAnalyzedTodos([]);
      setTitle("");
      clearImage();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "保存失败");
    } finally {
      setIsSaving(false);
    }
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

      setTodos((currentTodos) =>
        sortTodosByCreatedAt([
          {
            ...(data as TodoRow),
            image_url: previewUrl,
          },
          ...currentTodos.filter((todo) => todo.id !== data.id),
        ]),
      );
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
      <section className="duobi-glass rounded-lg p-5">
        <div className="mb-5">
          <p className="duobi-kicker mb-3">Capture</p>
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
              className="border-white/10 bg-white/[0.04]"
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="todo-image">图片附件</Label>
            <div
              role="button"
              tabIndex={0}
              onPaste={handlePasteImage}
              onClick={() => fileInputRef.current?.click()}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  fileInputRef.current?.click();
                }
              }}
              className="relative flex min-h-36 cursor-pointer flex-col items-center justify-center gap-3 rounded-lg border border-dashed border-white/15 bg-white/[0.035] p-4 text-center transition-colors hover:border-primary/50 hover:bg-primary/10 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            >
              {previewUrl ? (
                <div className="relative h-40 w-full overflow-hidden rounded-md border border-white/10">
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
                    点击选择图片，或复制图片后粘贴到这里
                  </span>
                  <span className="text-xs text-muted-foreground">
                    支持 Cmd/Ctrl + V，右键粘贴取决于浏览器菜单支持
                  </span>
                </>
              )}
              <span
                contentEditable
                suppressContentEditableWarning
                onPaste={handlePasteImage}
                onInput={(event) => {
                  event.currentTarget.textContent = "";
                }}
                className="absolute inset-0 opacity-0"
                aria-hidden="true"
              />
            </div>
            <Input
              ref={fileInputRef}
              id="todo-image"
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(event) =>
                setImageAttachment(event.target.files?.[0] ?? null)
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

          <div className="grid gap-3 sm:grid-cols-2">
            <Button
              type="button"
              variant="outline"
              onClick={analyzeTodos}
              disabled={isAnalyzing || isSaving}
            >
              {isAnalyzing ? (
                <Loader2 className="animate-spin" />
              ) : (
                <Sparkles />
              )}
              {isAnalyzing ? "分析中..." : "智能分析"}
            </Button>
            <Button type="submit" disabled={isSaving || isAnalyzing}>
              {isSaving && <Loader2 className="animate-spin" />}
              {isSaving ? "保存中..." : "直接添加"}
            </Button>
          </div>

          {analyzedTodos.length > 0 && (
            <div className="rounded-lg border border-white/10 bg-white/[0.035] p-4">
              <div className="mb-4 flex items-start justify-between gap-4">
                <div>
                  <h3 className="text-sm font-medium">AI 分析结果</h3>
                  <p className="mt-1 text-xs leading-5 text-muted-foreground">
                    请确认、修改或删除候选项后再写入工作台。
                  </p>
                </div>
                <span className="rounded-full border border-primary/30 bg-primary/10 px-2.5 py-1 text-xs text-primary">
                  {analyzedTodos.length} 条
                </span>
              </div>

              <div className="space-y-3">
                {analyzedTodos.map((todo) => (
                  <div key={todo.id} className="flex items-start gap-3">
                    <Checkbox
                      checked={todo.selected}
                      onCheckedChange={(checked) =>
                        updateAnalyzedTodo(todo.id, {
                          selected: checked === true,
                        })
                      }
                      className="mt-2"
                      aria-label="选择候选待办"
                    />
                    <div className="min-w-0 flex-1 space-y-1">
                      <Input
                        value={todo.title}
                        onChange={(event) =>
                          updateAnalyzedTodo(todo.id, {
                            title: event.target.value,
                          })
                        }
                        className="border-white/10 bg-background/40"
                      />
                      <p className="text-xs text-muted-foreground">
                        来源：
                        {todo.source === "image"
                          ? "图片"
                          : todo.source === "text_and_image"
                            ? "文本 + 图片"
                            : "文本"}
                        {" · "}置信度 {Math.round(todo.confidence * 100)}%
                      </p>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => removeAnalyzedTodo(todo.id)}
                      aria-label="删除候选待办"
                    >
                      <X />
                    </Button>
                  </div>
                ))}
              </div>

              <Button
                type="button"
                className="mt-4 w-full"
                onClick={addAnalyzedTodos}
                disabled={isSaving}
              >
                {isSaving && <Loader2 className="animate-spin" />}
                确认写入选中待办
              </Button>
            </div>
          )}
        </form>
      </section>

      <section className="space-y-4">
        <div className="flex items-end justify-between gap-4 border-b border-white/10 pb-4">
          <div>
            <p className="duobi-kicker mb-3">Focus list</p>
            <h2 className="text-xl font-semibold">我的待办</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              共 {todos.length} 项，完成后可勾选。
            </p>
          </div>
          <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-xs text-muted-foreground">
            {isRealtimeConnected ? "实时同步中" : "正在连接实时同步"}
          </span>
        </div>

        {todos.length === 0 ? (
          <div className="duobi-glass rounded-lg p-8 text-center text-sm text-muted-foreground">
            还没有待办事项，先添加第一条吧。
          </div>
        ) : (
          <div className="space-y-3">
            {todos.map((todo) => (
              <article
                key={todo.id}
                className="duobi-glass rounded-lg p-4 transition-transform hover:-translate-y-0.5"
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
                      <div className="relative h-44 overflow-hidden rounded-md border border-white/10 bg-background/60 sm:h-56">
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
