import { NextResponse } from 'next/server';
import { GoogleGenAI, Type } from '@google/genai';

export interface SubTaskSuggestion {
  taskName: string;
  role: 'Designer' | 'Frontend' | 'Backend' | 'Tester' | 'DevOps' | 'Leader' | 'Advisor' | 'Other' | 'Dev';
  estimatedEffort: number;
  description: string;
}

export interface ChatHistoryItem {
  role: 'user' | 'model';
  content: string;
}

const VALID_ROLES = ['Designer', 'Frontend', 'Backend', 'Tester', 'DevOps', 'Leader', 'Advisor', 'Other', 'Dev'];

async function generateContentWithFastFallback(
  ai: GoogleGenAI,
  options: {
    contents: any;
    config: any;
  }
) {
  // Prioritize Gemini 3.8 Flash, then fast reliable fallbacks
  const models = ['gemini-3.8-flash', 'gemini-2.5-flash', 'gemini-2.5-flash-lite', 'gemini-3.7-flash'];
  let lastError: any = null;

  // Add thinkingBudget: 0 to disable hidden thinking chains and start outputting immediately (< 2s)
  const fastConfig = {
    ...options.config,
    thinkingConfig: { thinkingBudget: 0 },
  };

  for (const model of models) {
    const t0 = Date.now();
    try {
      // 5.5s timeout per model to prevent hanging when Google AI Studio has 503 spikes
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error(`Timeout 5500ms on ${model}`)), 5500)
      );

      const callPromise = ai.models.generateContent({
        ...options,
        config: fastConfig,
        model,
      });

      const response = (await Promise.race([callPromise, timeoutPromise])) as any;
      console.log(`[Gemini API] Successfully generated with ${model} in ${Date.now() - t0}ms`);
      return response;
    } catch (err: any) {
      console.warn(
        `[Gemini API] Model ${model} failed after ${Date.now() - t0}ms, switching to next fallback:`,
        err?.message || err
      );
      lastError = err;
    }
  }

  throw lastError || new Error('Không thể kết nối với các model Gemini khả dụng.');
}

export async function POST(req: Request) {
  try {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        {
          success: false,
          error: 'Chưa cấu hình GEMINI_API_KEY trong file .env hoặc biến môi trường.',
        },
        { status: 500 }
      );
    }

    const body = await req.json();
    const { action, prompt, message, history, title, description, role, context } = body;

    const ai = new GoogleGenAI({ apiKey });

    // Target role & team scope resolution
    const targetRole = context?.currentRole || role || '';
    const scope = context?.scope || 'current_role';
    const isSingleRoleScope = scope === 'current_role' && !!targetRole && targetRole !== 'All';

    let roleInstruction = '';
    if (isSingleRoleScope) {
      roleInstruction = `
🎯 QUY TẮC BẮT BUỘC VỀ VAI TRÒ & TEAM:
- Người dùng đang tạo/chỉnh sửa task dành riêng cho Team / Role: "${targetRole}".
- TẤT CẢ các task con trong mảng "tasks" BẮT BUỘC phải gán "role": "${targetRole}".
- CHỈ bóc tách các đầu việc, phân đoạn chuyên môn thuộc phạm vi công việc của role "${targetRole}" (Ví dụ: Nếu là Designer chỉ tạo các task thiết kế UI/UX/Wireframe/Prototype/Design System; Nếu là Backend chỉ tạo API/Database/Logic/Bảo mật; Nếu là Frontend chỉ tạo UI Component/State/Tích hợp API/Responsive; Nếu là Tester chỉ tạo Test Cases/Automation/QC/Test Tải...).
- TUYỆT ĐỐI KHÔNG tự ý tạo task cho các role khác (Backend, Frontend, Tester, Designer...) trừ khi người dùng có ghi chú rõ ràng yêu cầu thêm role khác.`;
    } else {
      roleInstruction = `
🌐 PHẠM VI BÓC TÁCH TOÀN BỘ CÁC TEAM:
- Bóc tách toàn diện và gán role phù hợp cho từng chuyên môn liên quan ("Designer", "Frontend", "Backend", "Tester", "DevOps", "Leader", "Advisor", "Other").`;
    }

    // 1. Multi-turn AI Chat Assistant (Breakdown & Iterative Refinement)
    if (action === 'chat' || (action === 'breakdown' && Array.isArray(history) && history.length > 0)) {
      const userMessage = message || prompt;
      if (!userMessage || typeof userMessage !== 'string' || !userMessage.trim()) {
        return NextResponse.json(
          { success: false, error: 'Vui lòng cung cấp nội dung trao đổi hoặc mô tả tính năng.' },
          { status: 400 }
        );
      }

      const systemInstruction = `Bạn là một AI Tech Lead & Scrum Master chuyên nghiệp, hỗ trợ bóc tách tính năng thành các task con rõ ràng, thực tế và điều chỉnh linh hoạt theo phản hồi của người dùng.
${roleInstruction}

Quy định xử lý:
1. "message": Viết phản hồi ngắn gọn, thân thiện, súc tích bằng tiếng Việt giải thích những gì bạn đã phân tích, bóc tách hoặc vừa chỉnh sửa theo yêu cầu của user.
2. "tasks": Danh sách các task con mới nhất đầy đủ sau các lượt chỉnh sửa.
   - Mỗi task con gồm:
     + taskName: Tên đầu việc ngắn gọn, rõ nghĩa.
     + role: Vai trò phụ trách (${VALID_ROLES.map((r) => `"${r}"`).join(' | ')}). ${isSingleRoleScope ? `(Phải là "${targetRole}")` : ''}
     + estimatedEffort: Số giờ làm việc hợp lý (number từ 0.5 đến 40).
     + description: Mô tả chi tiết nội dung, checklist hoặc tiêu chí hoàn thành.
3. Khi người dùng yêu cầu chỉnh sửa (VD: "chỉnh lại giờ", "chia nhỏ task hơn", "thêm checklist..."), bạn cập nhật danh sách "tasks" tương ứng và giải thích trong "message".
${context?.milestoneTitle ? `\nMốc cột mốc hiện tại: ${context.milestoneTitle}` : ''}`;

      // Build formatted multi-turn history for Gemini
      const contents: Array<{ role: 'user' | 'model'; parts: Array<{ text: string }> }> = [];

      if (Array.isArray(history)) {
        for (const turn of history) {
          if (turn && turn.content && (turn.role === 'user' || turn.role === 'model')) {
            contents.push({
              role: turn.role,
              parts: [{ text: String(turn.content) }],
            });
          }
        }
      }

      // Append current user message
      contents.push({
        role: 'user',
        parts: [{ text: userMessage.trim() }],
      });

      const response = await generateContentWithFastFallback(ai, {
        contents,
        config: {
          systemInstruction,
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              message: { type: Type.STRING },
              tasks: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    taskName: { type: Type.STRING },
                    role: {
                      type: Type.STRING,
                      enum: VALID_ROLES,
                    },
                    estimatedEffort: { type: Type.NUMBER },
                    description: { type: Type.STRING },
                  },
                  required: ['taskName', 'role', 'estimatedEffort', 'description'],
                },
              },
            },
            required: ['message', 'tasks'],
          },
        },
      });

      const parsed = JSON.parse(response.text || '{}');
      const tasks: SubTaskSuggestion[] = Array.isArray(parsed.tasks) ? parsed.tasks : [];
      const botMessage: string = parsed.message || 'Đã phân tích và cập nhật danh sách task.';

      return NextResponse.json({
        success: true,
        message: botMessage,
        tasks,
      });
    }

    // 2. Single-turn Breakdown Fallback
    if (action === 'breakdown') {
      if (!prompt || typeof prompt !== 'string' || !prompt.trim()) {
        return NextResponse.json(
          { success: false, error: 'Vui lòng cung cấp nội dung hoặc mô tả tính năng cần bóc tách.' },
          { status: 400 }
        );
      }

      const promptContent = `Bạn là một Tech Lead/Project Manager chuyên nghiệp. Hãy phân tích và bóc tách tính năng/yêu cầu sau thành danh sách các task con cụ thể, thực tế và rõ ràng:
${roleInstruction}

Nội dung yêu cầu / Tính năng cần bóc tách:
"""
${prompt.trim()}
"""
${context?.milestoneTitle ? `Mốc cột mốc (Milestone): ${context.milestoneTitle}` : ''}
${targetRole ? `Role đang phụ trách: ${targetRole}` : ''}

Quy định yêu cầu kết quả:
- Mỗi task phải có tên rõ ràng (taskName), vai trò (role: ${VALID_ROLES.map((r) => `"${r}"`).join(' | ')}), số giờ ước tính hợp lý (estimatedEffort: number từ 0.5 đến 40 giờ tùy độ lớn), và mô tả chi tiết/checklist việc con (description).
- Ngôn ngữ đầu ra: Tiếng Việt.`;

      const response = await generateContentWithFastFallback(ai, {
        contents: promptContent,
        config: {
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              message: { type: Type.STRING },
              tasks: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    taskName: { type: Type.STRING },
                    role: {
                      type: Type.STRING,
                      enum: VALID_ROLES,
                    },
                    estimatedEffort: { type: Type.NUMBER },
                    description: { type: Type.STRING },
                  },
                  required: ['taskName', 'role', 'estimatedEffort', 'description'],
                },
              },
            },
            required: ['tasks'],
          },
        },
      });

      const parsed = JSON.parse(response.text || '{}');
      const tasks: SubTaskSuggestion[] = Array.isArray(parsed.tasks) ? parsed.tasks : [];

      return NextResponse.json({
        success: true,
        message: parsed.message || 'Đã phân tích và bóc tách thành công.',
        tasks,
      });
    }

    // 3. AI Effort Suggester
    if (action === 'suggest-effort') {
      const taskTitle = title || prompt;
      if (!taskTitle || typeof taskTitle !== 'string' || !taskTitle.trim()) {
        return NextResponse.json(
          { success: false, error: 'Vui lòng cung cấp tiêu đề hoặc mô tả task để AI ước tính giờ.' },
          { status: 400 }
        );
      }

      const promptContent = `Bạn là một Tech Lead/Scrum Master giàu kinh nghiệm. Hãy ước tính số giờ làm việc (Effort tính bằng giờ) hợp lý cho đầu việc sau:

Tiêu đề task: ${taskTitle.trim()}
${description ? `Mô tả chi tiết: ${description.trim()}` : ''}
${role ? `Chuyên môn (Role): ${role}` : ''}

Hướng dẫn:
- Đưa ra con số ước tính giờ thực tế (estimatedEffort: number, ví dụ: 1, 2, 3, 4, 6, 8, 12, 16...).
- Đưa ra giải thích ngắn gọn, súc tích bằng tiếng Việt về lý do ước tính số giờ này (reasoning).`;

      const response = await generateContentWithFastFallback(ai, {
        contents: promptContent,
        config: {
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              estimatedEffort: { type: Type.NUMBER },
              reasoning: { type: Type.STRING },
            },
            required: ['estimatedEffort', 'reasoning'],
          },
        },
      });

      const parsed = JSON.parse(response.text || '{}');
      return NextResponse.json({
        success: true,
        estimatedEffort: typeof parsed.estimatedEffort === 'number' ? parsed.estimatedEffort : 2,
        reasoning: parsed.reasoning || 'Dựa theo độ phức tạp công việc.',
      });
    }

    return NextResponse.json(
      { success: false, error: `Hành động không hợp lệ: ${action}` },
      { status: 400 }
    );
  } catch (error: any) {
    console.error('[Gemini API Route Error]:', error);
    return NextResponse.json(
      {
        success: false,
        error: error?.message || 'Lỗi xử lý kết nối Google Gemini API.',
      },
      { status: 500 }
    );
  }
}
