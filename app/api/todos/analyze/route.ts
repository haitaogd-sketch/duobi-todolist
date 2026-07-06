import { NextResponse, type NextRequest } from "next/server";

import { createClient } from "@/lib/supabase/server";

type AnalyzedTodo = {
  title: string;
  confidence?: number;
  source?: "text" | "image" | "text_and_image";
};

type BailianContentPart =
  | {
      type: "text";
      text: string;
    }
  | {
      type: "image_url";
      image_url: {
        url: string;
      };
    };

type BailianResponse = {
  choices?: Array<{
    message?: {
      content?: string;
    };
  }>;
  error?: {
    message?: string;
  };
};

function parseBailianOutput(response: BailianResponse) {
  const text = response.choices?.[0]?.message?.content;

  if (!text) {
    throw new Error("AI 没有返回可解析的内容");
  }

  const parsed = JSON.parse(text) as { todos?: AnalyzedTodo[] };
  const todos = (parsed.todos ?? [])
    .map((todo) => ({
      title: todo.title.trim(),
      confidence: todo.confidence ?? 0,
      source: todo.source ?? "text",
    }))
    .filter((todo) => todo.title.length > 0);

  return { todos };
}

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getUser();

  if (error || !data.user) {
    return NextResponse.json({ error: "请先登录后再使用智能分析" }, { status: 401 });
  }

  const apiKey = process.env.DASHSCOPE_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "缺少 DASHSCOPE_API_KEY 环境变量" },
      { status: 500 },
    );
  }

  const formData = await request.formData();
  const text = String(formData.get("text") ?? "").trim();
  const image = formData.get("image");

  if (!text && !(image instanceof File)) {
    return NextResponse.json(
      { error: "请输入文本或上传图片后再分析" },
      { status: 400 },
    );
  }

  const content: BailianContentPart[] = [
    {
      type: "text",
      text: [
        "你是待办事项拆解助手。",
        "请从用户输入文本和图片内容中提取明确可执行的待办事项。",
        "如果文本或图片中包含多件事，请拆成多条短待办。",
        "忽略寒暄、装饰文字、无行动含义的信息。",
        "每条待办使用简洁中文动宾短句，不要编号，不要添加不存在的信息。",
        '必须只输出 JSON，不要输出 Markdown。格式为：{"todos":[{"title":"待办标题","confidence":0.8,"source":"text"}]}',
        'source 只能是 "text"、"image" 或 "text_and_image"。',
        "confidence 为 0 到 1 的数字。",
        "最多返回 12 条待办。",
      ].join("\n"),
    },
  ];

  if (text) {
    content.push({
      type: "text",
      text: `用户输入：${text}`,
    });
  }

  if (image instanceof File) {
    if (!image.type.startsWith("image/")) {
      return NextResponse.json(
        { error: "只能上传图片文件进行智能分析" },
        { status: 400 },
      );
    }

    if (image.size > 5 * 1024 * 1024) {
      return NextResponse.json(
        { error: "图片不能超过 5MB" },
        { status: 400 },
      );
    }

    const bytes = Buffer.from(await image.arrayBuffer());
    content.push({
      type: "image_url",
      image_url: {
        url: `data:${image.type};base64,${bytes.toString("base64")}`,
      },
    });
  }

  const baseUrl =
    process.env.DASHSCOPE_BASE_URL ??
    "https://dashscope.aliyuncs.com/compatible-mode/v1";

  const bailianResponse = await fetch(`${baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: process.env.DASHSCOPE_MODEL ?? "qwen-vl-plus",
      messages: [
        {
          role: "user",
          content,
        },
      ],
      response_format: {
        type: "json_object",
      },
    }),
  });

  const payload = (await bailianResponse.json()) as BailianResponse;
  if (!bailianResponse.ok) {
    return NextResponse.json(
      { error: payload.error?.message ?? "AI 分析失败" },
      { status: bailianResponse.status },
    );
  }

  try {
    return NextResponse.json(parseBailianOutput(payload));
  } catch (parseError) {
    return NextResponse.json(
      {
        error:
          parseError instanceof Error
            ? parseError.message
            : "AI 结果解析失败",
      },
      { status: 502 },
    );
  }
}
