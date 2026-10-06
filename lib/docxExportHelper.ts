import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  HeadingLevel,
  Table,
  TableRow,
  TableCell,
  WidthType,
  BorderStyle,
  AlignmentType,
  ShadingType,
} from 'docx';

export interface DocxExportOptions {
  weekNumber: number;
  year: number;
  author?: string;
  totalTasksCount: number;
  doneCount: number;
  inProgressCount: number;
  todoCount: number;
  completionRate: number;
  totalActualEffort: number;
  totalEstEffort: number;
  summaryText: string;
}

/**
 * Parse markdown bold, italic, and normal text segments into TextRuns for docx
 */
function parseFormattedRuns(text: string, defaultOptions: { color?: string; size?: number; italic?: boolean } = {}): TextRun[] {
  const runs: TextRun[] = [];
  let remaining = text;

  while (remaining.length > 0) {
    const boldMatch = remaining.match(/\*\*(.*?)\*\*/);
    const italicMatch = remaining.match(/\*(.*?)\*/);

    const boldIndex = boldMatch ? remaining.indexOf(boldMatch[0]) : -1;
    const italicIndex = italicMatch ? remaining.indexOf(italicMatch[0]) : -1;

    let matchType: 'bold' | 'italic' | 'none' = 'none';
    let firstIndex = remaining.length;

    if (boldIndex !== -1 && boldIndex < firstIndex) {
      firstIndex = boldIndex;
      matchType = 'bold';
    }
    if (italicIndex !== -1 && italicIndex < firstIndex) {
      firstIndex = italicIndex;
      matchType = 'italic';
    }

    if (matchType === 'none') {
      runs.push(
        new TextRun({
          text: remaining,
          font: 'Segoe UI',
          size: defaultOptions.size || 22, // 11pt
          color: defaultOptions.color || '1E293B',
          italics: defaultOptions.italic || false,
        })
      );
      break;
    }

    if (firstIndex > 0) {
      runs.push(
        new TextRun({
          text: remaining.substring(0, firstIndex),
          font: 'Segoe UI',
          size: defaultOptions.size || 22,
          color: defaultOptions.color || '1E293B',
          italics: defaultOptions.italic || false,
        })
      );
    }

    if (matchType === 'bold' && boldMatch) {
      runs.push(
        new TextRun({
          text: boldMatch[1],
          font: 'Segoe UI',
          size: defaultOptions.size || 22,
          bold: true,
          color: defaultOptions.color || '0F172A',
        })
      );
      remaining = remaining.substring(firstIndex + boldMatch[0].length);
    } else if (matchType === 'italic' && italicMatch) {
      runs.push(
        new TextRun({
          text: italicMatch[1],
          font: 'Segoe UI',
          size: defaultOptions.size || 22,
          italics: true,
          color: defaultOptions.color || '475569',
        })
      );
      remaining = remaining.substring(firstIndex + italicMatch[0].length);
    }
  }

  return runs;
}

/**
 * Generate a Microsoft Word (.docx) document from weekly summary data
 */
export async function generateWeeklySummaryDocxBlob(options: DocxExportOptions): Promise<Blob> {
  const todayStr = new Date().toLocaleDateString('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });

  const children: any[] = [];

  // 1. Document Title
  children.push(
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: 120, after: 80 },
      children: [
        new TextRun({
          text: `BÁO CÁO TỔNG HỢP TIẾN ĐỘ TUẦN ${options.weekNumber} / ${options.year}`,
          font: 'Segoe UI',
          size: 32, // 16pt
          bold: true,
          color: '4F46E5', // Indigo
        }),
      ],
    })
  );

  // 2. Subtitle / Metadata
  children.push(
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 240 },
      children: [
        new TextRun({
          text: `Hệ thống Quản lý Saho Task • Ngày lập: ${todayStr} • Người lập: @${options.author || 'Admin'}`,
          font: 'Segoe UI',
          size: 20, // 10pt
          italics: true,
          color: '64748B',
        }),
      ],
    })
  );

  // 3. KPI Summary Table
  const tableBorder = {
    style: BorderStyle.SINGLE,
    size: 1,
    color: 'CBD5E1',
  };

  const createCell = (title: string, value: string, subvalue: string, bgColor: string) => {
    return new TableCell({
      width: { size: 25, type: WidthType.PERCENTAGE },
      shading: { type: ShadingType.CLEAR, fill: bgColor },
      margins: { top: 120, bottom: 120, left: 140, right: 140 },
      borders: {
        top: tableBorder,
        bottom: tableBorder,
        left: tableBorder,
        right: tableBorder,
      },
      children: [
        new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { after: 40 },
          children: [
            new TextRun({
              text: title.toUpperCase(),
              font: 'Segoe UI',
              size: 17,
              bold: true,
              color: '64748B',
            }),
          ],
        }),
        new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { after: 20 },
          children: [
            new TextRun({
              text: value,
              font: 'Segoe UI',
              size: 26,
              bold: true,
              color: '0F172A',
            }),
          ],
        }),
        new Paragraph({
          alignment: AlignmentType.CENTER,
          children: [
            new TextRun({
              text: subvalue,
              font: 'Segoe UI',
              size: 17,
              color: '475569',
            }),
          ],
        }),
      ],
    });
  };

  const kpiTable = new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    alignment: AlignmentType.CENTER,
    rows: [
      new TableRow({
        children: [
          createCell('Tổng Task', `${options.totalTasksCount}`, 'đầu việc', 'F8FAFC'),
          createCell('Hoàn Thành', `${options.doneCount}`, `(${options.completionRate}%)`, 'F0FDF4'),
          createCell('Đang Làm / Chờ', `${options.inProgressCount}`, `${options.todoCount} to do`, 'FEFCE8'),
          createCell('Giờ Thực Tế', `${options.totalActualEffort}h`, `/ ${options.totalEstEffort}h ước tính`, 'FAF5FF'),
        ],
      }),
    ],
  });

  children.push(kpiTable);
  children.push(new Paragraph({ spacing: { after: 240 } }));

  // 4. Parse Markdown Sections into Word Paragraphs
  const lines = (options.summaryText || '').split('\n');
  let currentSectionType = 'general';

  for (let i = 0; i < lines.length; i++) {
    const rawLine = lines[i].trim();
    if (!rawLine || rawLine === '---' || rawLine === '***' || rawLine === '___') continue;
    if (rawLine.startsWith('# ') || rawLine.toLowerCase().startsWith('ngày báo cáo:')) continue;

    // Detect Headings
    if (rawLine.startsWith('### ') || rawLine.startsWith('## ') || (/^\*\*\d+\./.test(rawLine) && rawLine.endsWith('**'))) {
      const headingTitle = rawLine.replace(/^[#*]+\s*/, '').replace(/\*+$/, '').trim();
      const lower = headingTitle.toLowerCase();

      let headingColor = '1E293B';
      if (lower.includes('1.') || lower.includes('tổng quan')) {
        currentSectionType = 'overview';
        headingColor = '1D4ED8'; // Blue
      } else if (lower.includes('2.') || lower.includes('kết quả') || lower.includes('hoàn thành')) {
        currentSectionType = 'highlights';
        headingColor = '047857'; // Emerald
      } else if (lower.includes('3.') || lower.includes('đang làm') || lower.includes('triển khai') || lower.includes('rollover')) {
        currentSectionType = 'inprogress';
        headingColor = 'B45309'; // Amber
      } else if (lower.includes('4.') || lower.includes('rủi ro') || lower.includes('điểm nghẽn')) {
        currentSectionType = 'risks';
        headingColor = 'B91C1C'; // Red
      } else if (lower.includes('5.') || lower.includes('đề xuất') || lower.includes('hành động')) {
        currentSectionType = 'actions';
        headingColor = '6D28D9'; // Purple
      } else {
        currentSectionType = 'general';
      }

      children.push(
        new Paragraph({
          heading: HeadingLevel.HEADING_2,
          spacing: { before: 280, after: 120 },
          children: [
            new TextRun({
              text: headingTitle,
              font: 'Segoe UI',
              size: 26, // 13pt
              bold: true,
              color: headingColor,
            }),
          ],
        })
      );
      continue;
    }

    const isTaskDone = /^(\*|\-)?\s*\[[xXvV]\]/.test(rawLine);
    const isTaskPending = /^(\*|\-)?\s*\[\s*\]/.test(rawLine);
    const isBullet = /^(\*|\-)\s+/.test(rawLine);
    const isNumbered = /^\d+\.\s+/.test(rawLine);
    const isSubExplanation = /^(\*|\-)?\s*(➔|->)\s*/.test(rawLine) || /^\s*(➔|->)\s*/.test(rawLine);
    const isCallout =
      currentSectionType === 'overview' &&
      (rawLine.includes('💡') ||
        rawLine.toLowerCase().includes('lưu ý nổi bật') ||
        rawLine.toLowerCase().includes('điểm cốt lõi'));

    const cleanText = rawLine
      .replace(/^(\*|\-)?\s*\[[xXvV\s]\]\s*/, '')
      .replace(/^(\*|\-|\d+\.)\s+/, '')
      .replace(/^(\*|\-)?\s*(➔|->)\s*/, '')
      .trim();

    // 1. Callout Box in Section 1
    if (isCallout) {
      children.push(
        new Paragraph({
          spacing: { before: 100, after: 140 },
          shading: { type: ShadingType.CLEAR, fill: 'EFF6FF' },
          border: {
            left: { style: BorderStyle.SINGLE, size: 24, color: '3B82F6' },
          },
          indent: { left: 240, right: 240 },
          children: [
            new TextRun({
              text: '💡 ',
              font: 'Segoe UI',
              size: 22,
            }),
            ...parseFormattedRuns(cleanText, { color: '1E3A8A' }),
          ],
        })
      );
      continue;
    }

    // 2. Sub-explanation line in Section 3
    if (isSubExplanation) {
      children.push(
        new Paragraph({
          spacing: { before: 40, after: 100 },
          shading: { type: ShadingType.CLEAR, fill: 'FFFBEB' },
          border: {
            left: { style: BorderStyle.SINGLE, size: 16, color: 'F59E0B' },
          },
          indent: { left: 480, right: 240 },
          children: [
            new TextRun({
              text: '➔ ',
              font: 'Segoe UI',
              size: 20,
              bold: true,
              color: 'D97706',
            }),
            ...parseFormattedRuns(cleanText, { color: '78350F', size: 20, italic: true }),
          ],
        })
      );
      continue;
    }

    // 3. Task Done
    if (isTaskDone || (currentSectionType === 'highlights' && isBullet)) {
      children.push(
        new Paragraph({
          spacing: { before: 60, after: 60 },
          indent: { left: 240 },
          children: [
            new TextRun({
              text: '✔  ',
              font: 'Segoe UI',
              size: 22,
              bold: true,
              color: '16A34A',
            }),
            ...parseFormattedRuns(cleanText, { color: '1E293B' }),
          ],
        })
      );
      continue;
    }

    // 4. Task Pending / Rollover
    if (isTaskPending || (currentSectionType === 'inprogress' && isBullet)) {
      const hasInlineArrow = cleanText.includes(' ➔ ') || cleanText.includes(' -> ');
      if (hasInlineArrow) {
        const arrowSplit = cleanText.split(/\s+(?:➔|->)\s+/);
        const taskHeader = arrowSplit[0];
        const taskReason = arrowSplit.slice(1).join(' - ');

        children.push(
          new Paragraph({
            spacing: { before: 80, after: 40 },
            indent: { left: 240 },
            children: [
              new TextRun({
                text: '⏳  ',
                font: 'Segoe UI',
                size: 22,
                bold: true,
                color: 'D97706',
              }),
              ...parseFormattedRuns(taskHeader, { color: '1E293B' }),
            ],
          })
        );

        if (taskReason) {
          children.push(
            new Paragraph({
              spacing: { before: 20, after: 80 },
              shading: { type: ShadingType.CLEAR, fill: 'FFFBEB' },
              border: {
                left: { style: BorderStyle.SINGLE, size: 16, color: 'F59E0B' },
              },
              indent: { left: 480, right: 240 },
              children: [
                new TextRun({
                  text: '➔ ',
                  font: 'Segoe UI',
                  size: 20,
                  bold: true,
                  color: 'D97706',
                }),
                ...parseFormattedRuns(taskReason, { color: '78350F', size: 20, italic: true }),
              ],
            })
          );
        }
        continue;
      }

      children.push(
        new Paragraph({
          spacing: { before: 60, after: 60 },
          indent: { left: 240 },
          children: [
            new TextRun({
              text: '⏳  ',
              font: 'Segoe UI',
              size: 22,
              bold: true,
              color: 'D97706',
            }),
            ...parseFormattedRuns(cleanText, { color: '1E293B' }),
          ],
        })
      );
      continue;
    }

    // 5. Bullet item
    if (isBullet) {
      let bulletIcon = '•  ';
      let bulletColor = '6366F1';
      if (currentSectionType === 'risks') {
        bulletIcon = '⚠  ';
        bulletColor = 'DC2626';
      } else if (currentSectionType === 'actions') {
        bulletIcon = '➔  ';
        bulletColor = '9333EA';
      }

      children.push(
        new Paragraph({
          spacing: { before: 60, after: 60 },
          indent: { left: 240 },
          children: [
            new TextRun({
              text: bulletIcon,
              font: 'Segoe UI',
              size: 22,
              bold: true,
              color: bulletColor,
            }),
            ...parseFormattedRuns(cleanText, { color: '1E293B' }),
          ],
        })
      );
      continue;
    }

    // 6. Numbered item
    if (isNumbered) {
      const numMatch = rawLine.match(/^(\d+)\.\s+/);
      const numStr = numMatch ? numMatch[1] : '1';

      children.push(
        new Paragraph({
          spacing: { before: 60, after: 60 },
          indent: { left: 240 },
          children: [
            new TextRun({
              text: `${numStr}. `,
              font: 'Segoe UI',
              size: 22,
              bold: true,
              color: '7C3AED',
            }),
            ...parseFormattedRuns(cleanText, { color: '1E293B' }),
          ],
        })
      );
      continue;
    }

    // 7. Standard Paragraph
    children.push(
      new Paragraph({
        spacing: { before: 60, after: 80 },
        children: parseFormattedRuns(rawLine, { color: '1E293B' }),
      })
    );
  }

  // 5. Footer note
  children.push(new Paragraph({ spacing: { before: 360 } }));
  children.push(
    new Paragraph({
      alignment: AlignmentType.CENTER,
      children: [
        new TextRun({
          text: '— Báo cáo được khởi tạo tự động bởi AI Multi-Engine trên Hệ thống Saho Task Management —',
          font: 'Segoe UI',
          size: 18,
          italics: true,
          color: '94A3B8',
        }),
      ],
    })
  );

  const doc = new Document({
    sections: [
      {
        properties: {
          page: {
            margin: {
              top: 1440, // 1 inch
              bottom: 1440,
              left: 1440,
              right: 1440,
            },
          },
        },
        children,
      },
    ],
  });

  return await Packer.toBlob(doc);
}
