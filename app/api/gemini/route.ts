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

function parseErrorMessage(err: any): string {
  if (!err) return 'Không thể kết nối với máy chủ AI.';
  const msg = typeof err === 'string' ? err : err?.message || JSON.stringify(err);

  if (msg.includes('503') || msg.includes('high demand') || msg.includes('UNAVAILABLE')) {
    return 'Máy chủ AI đang có lưu lượng truy cập cao tạm thời. Vui lòng bấm "Thử lại" sau giây lát nhé.';
  }
  if (msg.includes('429') || msg.includes('RESOURCE_EXHAUSTED') || msg.includes('quota') || msg.includes('credit_balance_exhausted') || msg.includes('Insufficient Balance')) {
    return 'Đạt giới hạn lượt gọi AI tạm thời. Vui lòng chờ vài giây hoặc nạp thêm hạn ngạch nhé.';
  }
  if (msg.includes('API_KEY_INVALID') || msg.includes('API key not valid')) {
    return 'Khóa API Key chưa hợp lệ hoặc đã hết hạn.';
  }
  return msg;
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function callDeepSeekChat(messages: Array<{ role: string; content: string }>, jsonMode: boolean = false): Promise<string> {
  const apiKey = process.env.DEEPSEEK_API_KEY;
  if (!apiKey) throw new Error('No DEEPSEEK_API_KEY');
  const t0 = Date.now();
  const body: any = {
    model: 'deepseek-chat',
    messages,
  };
  if (jsonMode) {
    body.response_format = { type: 'json_object' };
  }
  const res = await fetch('https://api.deepseek.com/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(35000),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data?.error?.message || `DeepSeek HTTP ${res.status}`);
  const content = data?.choices?.[0]?.message?.content;
  if (!content) throw new Error('DeepSeek returned empty content');
  console.log(`[DeepSeek API] Generated in ${Date.now() - t0}ms`);
  return content;
}

async function callOpenAIChat(messages: Array<{ role: string; content: string }>, jsonMode: boolean = false): Promise<string> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error('No OPENAI_API_KEY');
  const t0 = Date.now();
  const body: any = {
    model: 'gpt-4o-mini',
    messages,
  };
  if (jsonMode) {
    body.response_format = { type: 'json_object' };
  }
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(35000),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data?.error?.message || `OpenAI HTTP ${res.status}`);
  const content = data?.choices?.[0]?.message?.content;
  if (!content) throw new Error('OpenAI returned empty content');
  console.log(`[OpenAI API] Generated in ${Date.now() - t0}ms`);
  return content;
}

async function generateContentWithFastFallback(
  ai: GoogleGenAI,
  options: {
    contents: any;
    config?: any;
  }
) {
  // Ordered by quota headroom, reliability, and speed:
  // 1. gemini-3.1-flash-lite (High quota: 500 RPD & 15 RPM!)
  // 2. gemini-3.7-flash (Smart Flash model)
  // 3. gemini-3.8-flash
  // 4. gemini-2.5-flash
  // 5. gemini-2.5-flash-lite
  const models = [
    'gemini-3.1-flash-lite',
    'gemini-3.7-flash',
    'gemini-3.8-flash',
    'gemini-2.5-flash',
    'gemini-2.5-flash-lite',
  ];
  let lastError: any = null;

  for (const model of models) {
    for (let attempt = 1; attempt <= 2; attempt++) {
      const t0 = Date.now();
      try {
        const timeoutPromise = new Promise((_, reject) =>
          setTimeout(() => reject(new Error(`Timeout 25000ms on ${model}`)), 25000)
        );

        const callPromise = ai.models.generateContent({
          ...options,
          model,
        });

        const response = (await Promise.race([callPromise, timeoutPromise])) as any;
        console.log(`[Gemini API] Successfully generated with ${model} (attempt ${attempt}) in ${Date.now() - t0}ms`);
        return response;
      } catch (err: any) {
        lastError = err;
        const errMsg = err?.message || String(err);
        const isTransient =
          errMsg.includes('503') ||
          errMsg.includes('UNAVAILABLE') ||
          errMsg.includes('429') ||
          errMsg.includes('high demand');

        console.warn(
          `[Gemini API] Model ${model} (attempt ${attempt}/2) failed in ${Date.now() - t0}ms:`,
          errMsg
        );

        if (isTransient && attempt < 2) {
          await sleep(1000);
          continue;
        }
        break;
      }
    }
  }

  const friendlyMsg = parseErrorMessage(lastError);
  throw new Error(friendlyMsg);
}

/**
 * Universal Multi-Provider AI Fallback Engine
 * Cascades: DeepSeek -> OpenAI -> Google Gemini
 */
async function callUniversalMultiProviderAI(options: {
  systemInstruction?: string;
  messages: Array<{ role: 'user' | 'assistant' | 'model' | 'system'; content: string }>;
  jsonMode?: boolean;
  geminiSchema?: any;
}): Promise<string> {
  const errors: string[] = [];

  // Format messages for OpenAI / DeepSeek format
  const oaiMessages: Array<{ role: string; content: string }> = [];
  if (options.systemInstruction) {
    oaiMessages.push({ role: 'system', content: options.systemInstruction });
  }
  for (const m of options.messages) {
    oaiMessages.push({
      role: m.role === 'model' ? 'assistant' : m.role,
      content: m.content,
    });
  }

  // 1. Try DeepSeek if key exists
  if (process.env.DEEPSEEK_API_KEY) {
    try {
      return await callDeepSeekChat(oaiMessages, options.jsonMode);
    } catch (e: any) {
      console.warn('[AI Multi-Provider] DeepSeek failed:', e?.message || e);
      errors.push(`DeepSeek: ${e?.message || e}`);
    }
  }

  // 2. Try OpenAI if key exists
  if (process.env.OPENAI_API_KEY) {
    try {
      return await callOpenAIChat(oaiMessages, options.jsonMode);
    } catch (e: any) {
      console.warn('[AI Multi-Provider] OpenAI failed:', e?.message || e);
      errors.push(`OpenAI: ${e?.message || e}`);
    }
  }

  // 3. Fallback to Google Gemini
  if (process.env.GEMINI_API_KEY) {
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
      const contents = options.messages.map((m) => ({
        role: (m.role === 'assistant' ? 'model' : m.role) as 'user' | 'model',
        parts: [{ text: m.content }],
      }));

      const config: any = {};
      if (options.systemInstruction) config.systemInstruction = options.systemInstruction;
      if (options.jsonMode) {
        config.responseMimeType = 'application/json';
        if (options.geminiSchema) config.responseSchema = options.geminiSchema;
      }

      const res = await generateContentWithFastFallback(ai, {
        contents,
        config,
      });
      return res.text || '';
    } catch (e: any) {
      console.warn('[AI Multi-Provider] Gemini failed:', e?.message || e);
      errors.push(`Gemini: ${e?.message || e}`);
    }
  }

  throw new Error(`Không thể kết nối với các mô hình AI. ${parseErrorMessage(errors.join(' | '))}`);
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { action, prompt, message, history, title, description, role, context } = body;

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

      const systemInstruction = `Bạn là một AI Tech Lead, Cố vấn Nghiệp vụ & Scrum Master chuyên nghiệp trong phát triển phần mềm. Bạn vừa có khả năng tư vấn, giải đáp mọi câu hỏi nghiệp vụ/kỹ thuật, vừa có khả năng bóc tách, gợi ý và điều chỉnh task chuyên sâu.
Trả về định dạng JSON duy nhất gồm 2 trường:
- message: Phản hồi súc tích bằng tiếng Việt.
- tasks: Danh sách các task con dạng mảng objects { taskName, role, estimatedEffort, description }.

${roleInstruction}

Quy định cấu trúc task trong mảng "tasks" (khi có task):
- taskName: Tên đầu việc ngắn gọn, rõ nghĩa.
- role: Vai trò phụ trách (${VALID_ROLES.map((r) => `"${r}"`).join(' | ')}). ${isSingleRoleScope ? `(Bắt buộc phải là "${targetRole}")` : ''}
- estimatedEffort: Số giờ làm việc hợp lý (number từ 0.5 đến 40).
- description: Mô tả chi tiết nội dung cần làm.

${context?.milestoneTitle ? `\nMốc cột mốc hiện tại: ${context.milestoneTitle}` : ''}
${context?.currentTaskTitle ? `\nTask đang thao tác: ${context.currentTaskTitle}` : ''}`;

      const messages: Array<{ role: 'user' | 'model'; content: string }> = [];
      if (Array.isArray(history)) {
        for (const turn of history) {
          if (turn && turn.content && (turn.role === 'user' || turn.role === 'model')) {
            messages.push({
              role: turn.role,
              content: String(turn.content),
            });
          }
        }
      }
      messages.push({
        role: 'user',
        content: userMessage.trim(),
      });

      const responseText = await callUniversalMultiProviderAI({
        systemInstruction,
        messages,
        jsonMode: true,
        geminiSchema: {
          type: Type.OBJECT,
          properties: {
            message: { type: Type.STRING },
            tasks: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  taskName: { type: Type.STRING },
                  role: { type: Type.STRING, enum: VALID_ROLES },
                  estimatedEffort: { type: Type.NUMBER },
                  description: { type: Type.STRING },
                },
                required: ['taskName', 'role', 'estimatedEffort', 'description'],
              },
            },
          },
          required: ['message', 'tasks'],
        },
      });

      const parsed = JSON.parse(responseText || '{}');
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

      const promptContent = `Bạn là một Tech Lead/Project Manager chuyên nghiệp. Hãy phân tích và bóc tách tính năng sau thành danh sách các task con cụ thể dạng JSON { message, tasks }:
${roleInstruction}

Nội dung yêu cầu / Tính năng cần bóc tách:
"""
${prompt.trim()}
"""
${context?.milestoneTitle ? `Mốc cột mốc (Milestone): ${context.milestoneTitle}` : ''}
${targetRole ? `Role đang phụ trách: ${targetRole}` : ''}`;

      const responseText = await callUniversalMultiProviderAI({
        messages: [{ role: 'user', content: promptContent }],
        jsonMode: true,
      });

      const parsed = JSON.parse(responseText || '{}');
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

      const promptContent = `Bạn là một Tech Lead/Scrum Master giàu kinh nghiệm. Hãy ước tính số giờ làm việc (Effort tính bằng giờ) hợp lý dạng JSON { estimatedEffort: number, reasoning: string } cho đầu việc sau:

Tiêu đề task: ${taskTitle.trim()}
${description ? `Mô tả chi tiết: ${description.trim()}` : ''}
${role ? `Chuyên môn (Role): ${role}` : ''}`;

      const responseText = await callUniversalMultiProviderAI({
        messages: [{ role: 'user', content: promptContent }],
        jsonMode: true,
      });

      const parsed = JSON.parse(responseText || '{}');
      return NextResponse.json({
        success: true,
        estimatedEffort: typeof parsed.estimatedEffort === 'number' ? parsed.estimatedEffort : 2,
        reasoning: parsed.reasoning || 'Dựa theo độ phức tạp công việc.',
      });
    }

    // 4. AI Executive Weekly Summary Generator
    if (action === 'summarize-week') {
      const { weekNumber, year, overallStats, tasksSummary, ticketsSummary, roleStats, memberStats, overdueTasks } = body;
      if (!Array.isArray(tasksSummary)) {
        return NextResponse.json(
          { success: false, error: 'Dữ liệu task tuần không hợp lệ.' },
          { status: 400 }
        );
      }

      const totalTasks = overallStats?.totalTasks ?? tasksSummary.length;
      const doneTasks = overallStats?.doneTasks ?? tasksSummary.filter((t: any) => t.status === 'Done' || t.completionPercentage === 100).length;
      const inProgressTasks = overallStats?.inProgressTasks ?? tasksSummary.filter((t: any) => t.status === 'In Progress' || (t.completionPercentage > 0 && t.completionPercentage < 100)).length;
      const todoTasks = overallStats?.todoTasks ?? (totalTasks - doneTasks - inProgressTasks);
      const totalActualEffort = overallStats?.totalActualEffort ?? Math.round(tasksSummary.reduce((acc: number, t: any) => acc + (t.actualEffort || 0), 0) * 10) / 10;
      const totalEstEffort = overallStats?.totalEstEffort ?? Math.round(tasksSummary.reduce((acc: number, t: any) => acc + (t.estimatedEffort || 0), 0) * 10) / 10;
      const completionRate = overallStats?.completionRate ?? (totalTasks > 0 ? Math.round((doneTasks / totalTasks) * 100) : 0);
      const effortPercent = totalEstEffort > 0 ? Math.round((totalActualEffort / totalEstEffort) * 100) : 0;

      const todayStr = new Date().toLocaleDateString('vi-VN', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
      });

      const promptContent = `Bạn là Trợ lý Giám đốc Dự án / Senior Project Manager (Scrum Master) cho hệ thống Saho Task. Hãy phân tích toàn bộ dữ liệu tuần ${weekNumber} / ${year} dưới đây và viết một bản BÁO CÁO TỔNG HỢP TIẾN ĐỘ TUẦN cực kỳ chuyên nghiệp, sắc bén, ngắn gọn, trực quan và súc tích bằng tiếng Việt.

BỘ SỐ LIỆU TỔNG QUAN REAL-TIME ĐÃ ĐƯỢC HỆ THỐNG TÍNH TOÁN CHUẨN XÁC (GROUND TRUTH - BẮT BUỘC SỬ DỤNG 100% CÁC SỐ NÀY, TUYỆT ĐỐI KHÔNG TỰ TÍNH LẠI HOẶC BỊA SỐ KHÁC):
- Tổng số đầu việc tuần ${weekNumber}: ${totalTasks} task
- Số task hoàn thành (Done 100%): ${doneTasks} task (${completionRate}% tổng task)
- Số task đang làm (In Progress): ${inProgressTasks} task
- Số task chờ thực hiện (To do): ${todoTasks} task
- Tổng thời gian thực tế ghi nhận (Actual Effort): ${totalActualEffort}h
- Tổng thời gian ước tính (Estimated Effort): ${totalEstEffort}h
- Tỷ lệ hoàn thành khối lượng giờ: ${totalActualEffort}h / ${totalEstEffort}h (${effortPercent}%)

DỮ LIỆU CHI TIẾT ĐẦU VÀO TUẦN ${weekNumber} / ${year} (Ngày lập báo cáo: ${todayStr}):
1. Thống kê theo Role:
${JSON.stringify(roleStats || [], null, 2)}

2. Thống kê theo Thành viên (Top nỗ lực):
${JSON.stringify(memberStats || [], null, 2)}

3. Danh sách Task Quá hạn / Cần chú ý:
${JSON.stringify(overdueTasks || [], null, 2)}

4. Danh sách toàn bộ Task trong tuần (${tasksSummary.length} task - Đã bao gồm dữ liệu luân chuyển tuần và deadline):
${JSON.stringify(tasksSummary, null, 2)}

5. Danh sách Ticket yêu cầu / Vướng mắc liên quan:
${JSON.stringify(ticketsSummary || [], null, 2)}

QUY TẮC CẤU TRÚC BẢN BÁO CÁO (BẮT BUỘC):
- BẮT ĐẦU NGAY LẬP TỨC với "### 📌 1. TỔNG QUAN HIỆU SUẤT TUẦN". Tuyệt đối KHÔNG viết lời chào mở đầu (như "Tuyệt vời!", "Chào bạn...", "Với vai trò..."), không viết lại tiêu đề H1 hay ngày tháng dạng placeholder.
- Trình bày cô đọng, dễ đọc, không lan man, tập trung vào số liệu thực tế.

CẤU TRÚC 5 PHẦN CHUẨN:
### 📌 1. TỔNG QUAN HIỆU SUẤT TUẦN
- 2-3 câu nhận xét đánh giá tổng quan về nhịp độ làm việc, khối lượng hoàn thành và năng suất chung của toàn đội ngũ trong tuần ${weekNumber} (${todayStr}).
- QUY TẮC BẮT BUỘC VỀ SỐ LIỆU TỔNG:
  * Phải trích dẫn CHÍNH XÁC: **${totalActualEffort}/${totalEstEffort} giờ dự kiến** (đạt khoảng **${effortPercent}%**) và **${doneTasks}/${totalTasks} task** (${completionRate}% hoàn thành).
  * BẮT BUỘC **in đậm các từ khóa trọng tâm** (ví dụ: **${totalActualEffort}h/${totalEstEffort}h**, **nhóm Backend**, **nhóm Frontend**, **tiến độ thực tế**...).
  * TUYỆT ĐỐI KHÔNG trích dẫn con số nào khác ngoài bộ số liệu chuẩn ở trên.
- Kèm theo 1 ghi chú nổi bật theo định dạng:
  * 💡 **Lưu ý nổi bật:** [Ghi chú 1-2 câu súc tích về điểm then chốt nhất mà Ban quản trị & Leader cần nắm bắt ngay tuần này].

### 🏆 2. KẾT QUẢ NỔI BẬT & ĐẦU VIỆC HOÀN THÀNH
- Nhóm theo từng Role (**Backend**, **Frontend**, **Designer**, **Tester**, **BA**...).
- Dùng cú pháp '* [x]' cho các task tiêu biểu đã hoàn thành 100% (Done):
  * [x] **[Role]** Tên task (@Account - X giờ thực tế)
- Chỉ chọn lọc 5-8 đầu việc quan trọng nhất đã hoàn thành, không liệt kê tràn lan các task nhỏ.

### ⏳ 3. CÁC ĐẦU VIỆC ĐANG TRIỂN KHAI TRỌNG TÂM & CHUYỂN TIẾP (ROLLOVER)
- CHỈ chọn lọc các task quan trọng đang triển khai dở (In Progress > 0% hoặc task lớn/phức tạp kéo dài cần chuyển tiếp sang tuần tới).
- Phải làm rõ cực kỳ cụ thể & trực quan: Task đã luân chuyển qua bao nhiêu tuần (dựa trên trường 'rolloverHistory'), tình trạng deadline thế nào (dựa trên 'deadlineStatus'), tại sao lại chậm/kéo dài, và hướng xử lý tiếp theo là gì.
- Định dạng mỗi task theo cấu trúc 2 dòng:
  * [ ] **[Role]** Tên task (@Account - X% tiến độ | Thực tế: Ah / Est: Bh | Deadline: DD/MM [Trạng thái hạn] | [Lịch sử luân chuyển tuần])
    ➔ *Nguyên nhân & Hướng xử lý:* [Giải thích súc tích, dễ hiểu: Task quy mô lớn đang triển khai giai đoạn 1, hoặc đã đạt 90% chỉ còn review/QA nghiệm thu, hoặc đã kéo dài qua X tuần cần dứt điểm trước deadline...]
- 🚫 QUY TẮC BẮT BUỘC:
  + TUYỆT ĐỐI KHÔNG tự bịa hoặc tự thêm các câu mơ hồ như "Lưu ý: Task này đã có entry Done", "cần làm rõ". Chỉ dựa trên dữ liệu thật.
  + KHÔNG liệt kê các task 0% To do bình thường thành danh sách dài gây rối mắt.

### ⚠️ 4. PHÂN TÍCH ĐIỂM NGHẼN & RỦI RO (BLOCKERS & RISKS)
- 2-3 gạch đầu dòng ngắn gọn chỉ rõ các rủi ro cụ thể dựa trên danh sách task quá hạn, các task kéo dài nhiều tuần và các Role có tỉ lệ To do cao.

### 🎯 5. ĐỀ XUẤT HÀNH ĐỘNG CHO TUẦN TỚI
- Đánh số thứ tự 1., 2., 3., 4. các hành động cụ thể, thiết thực dành cho Admin/Leader.`;

      const summaryText = await callUniversalMultiProviderAI({
        systemInstruction: 'Bạn là chuyên gia PM/Scrum Master tổng hợp báo cáo tiến độ tuần dự án phần mềm chuyên nghiệp, súc tích và chính xác.',
        messages: [{ role: 'user', content: promptContent }],
        jsonMode: false,
      });

      return NextResponse.json({
        success: true,
        summary: summaryText || 'Không thể tạo bản tổng hợp tuần.',
      });
    }

    // 5. Context-Aware Project Knowledge Assistant (Ask System)
    if (action === 'ask-system') {
      const userMessage = message || prompt;
      if (!userMessage || typeof userMessage !== 'string' || !userMessage.trim()) {
        return NextResponse.json(
          { success: false, error: 'Vui lòng cung cấp câu hỏi.' },
          { status: 400 }
        );
      }

      const { systemContext } = body;
      const targetUser = systemContext?.currentUser;
      const userAccount = targetUser?.account || '';
      const userName = targetUser?.name || '';
      const userRole = targetUser?.role || '';
      const userSpecs = (targetUser?.specializations || []).join(', ');

      const systemInstruction = `Bạn là Trợ lý AI Quản trị Hệ thống Saho Task (Saho Project Intelligence Assistant).
Bạn được kết nối trực tiếp với dữ liệu thời gian thực của hệ thống Saho Task Management.

THÔNG TIN NGƯỜI DÙNG ĐANG TRAO ĐỔI TRỰC TIẾP VỚI BẠN:
- Họ và tên: ${userName || 'N/A'}
- Tài khoản (Account / Username): @${userAccount || 'N/A'}
- Vai trò & Chuyên môn: ${userRole || 'Member'} ${userSpecs ? `(${userSpecs})` : ''}

DỮ LIỆU THỰC TẾ DỰ ÁN ĐƯỢC CẤP HIỆN TẠI:
- Tuần hiện tại: Tuần ${systemContext?.currentWeek || 'N/A'} / ${systemContext?.currentYear || '2026'}
- Chỉ số KPI Tuần hiện tại (Đã tính chuẩn xác):
${JSON.stringify(systemContext?.currentWeekMetrics || {}, null, 2)}
- Danh sách thành viên & Role:
${JSON.stringify(systemContext?.users || [], null, 2)}
- Danh sách Milestone:
${JSON.stringify(systemContext?.milestones || [], null, 2)}
- Danh sách Task hiện tại:
${JSON.stringify(systemContext?.tasks || [], null, 2)}
- Dữ liệu Lịch sử các tuần trước (Archives Snapshot):
${JSON.stringify(systemContext?.recentArchives || [], null, 2)}
- Danh sách Tickets (Yêu cầu chéo):
${JSON.stringify(systemContext?.tickets || [], null, 2)}

QUY TẮC TRẢ LỜI QUAN TRỌNG (BẮT BUỘC):
1. QUY TẮC XƯNG HÔ CHÍNH XÁC:
   - Hãy xưng hô và chào hỏi đúng tên/account của người dùng đang chat (${userAccount ? `@${userAccount}` : userName || 'bạn'}).
   - Ví dụ: "Chào @${userAccount || 'bạn'}", "Chào ${userName || (userAccount ? `@${userAccount}` : 'bạn')}".
   - TUYỆT ĐỐI KHÔNG tự tiện gọi người dùng là "Chào Admin" nếu tài khoản của họ không phải là Admin (ví dụ: tài khoản @LichDT, @TruongNN, @DungDV... là Leader/Member thì phải gọi đúng tên @LichDT, @TruongNN...).
2. TRUNG THỰC & CHÍNH XÁC 100%: Chỉ trả lời dựa trên dữ liệu thật ở trên. Nếu dữ liệu không có thông tin, hãy nói rõ là hệ thống chưa ghi nhận.
3. ĐỊNH DẠNG DANH SÁCH TASK TRỰC QUAN (TUYỆT ĐỐI KHÔNG DÙNG BẢNG MARKDOWN ĐỂ LIỆT KÊ TASK):
   - Trong hệ thống Saho, tên các đầu việc thường chứa ký tự gạch đứng "|" (ví dụ: "Design | HR view | Employee list..."). Việc dùng bảng Markdown sẽ làm vỡ cột và sai lệch dữ liệu.
   - Do đó, KHI LIỆT KÊ DANH SÁCH TASK, BẮT BUỘC sử dụng định dạng Danh sách (Bullet Points / Card) trực quan:
     * 📌 **[Role]** Tên task đầy đủ (@Account)
       - Trạng thái: **Done / In Progress / To do** | Tiến độ: **X%** | Ước tính: **Y giờ** (Thực tế: **Ah**) | Tuần: **Z**
   - Chỉ sử dụng bảng (table) khi người dùng yêu cầu thống kê ma trận tổng hợp (ví dụ: Bảng tổng hợp theo Role gồm: Role | Số Task | Giờ thực tế | Giờ ước tính).
4. TUYỆT ĐỐI KHÔNG in ra các mã ID kỹ thuật nội bộ thô ("tsk-17904...", "archive-...").
5. IN ĐẬM TỪ KHÓA: In đậm các con số, tên nhân sự (@Account), vai trò (**Backend**, **Frontend**, **Designer**, **Tester**, **BA**...), trạng thái (**Done**, **In Progress**, **To do**).
6. TƯ VẤN QUẢN TRỊ: Đưa ra nhận định logic, súc tích và có tính hành động cao.`;

      const messages: Array<{ role: 'user' | 'model'; content: string }> = [];
      if (Array.isArray(history)) {
        for (const turn of history) {
          if (turn && turn.content && (turn.role === 'user' || turn.role === 'model')) {
            messages.push({
              role: turn.role,
              content: String(turn.content),
            });
          }
        }
      }
      messages.push({
        role: 'user',
        content: userMessage.trim(),
      });

      const replyText = await callUniversalMultiProviderAI({
        systemInstruction,
        messages,
        jsonMode: false,
      });

      return NextResponse.json({
        success: true,
        reply: replyText || 'Không nhận được phản hồi từ AI.',
      });
    }

    return NextResponse.json(
      { success: false, error: `Hành động không hợp lệ: ${action}` },
      { status: 400 }
    );
  } catch (error: any) {
    console.error('[AI API Route Error]:', error);
    return NextResponse.json(
      {
        success: false,
        error: error?.message || 'Lỗi xử lý kết nối AI API.',
      },
      { status: 500 }
    );
  }
}

