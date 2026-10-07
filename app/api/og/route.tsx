import { ImageResponse } from 'next/og';
import { NextRequest } from 'next/server';

// Role color mappings
const ROLE_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  BA: { bg: '#581c87', text: '#e9d5ff', border: '#7e22ce' },
  Design: { bg: '#78350f', text: '#fde68a', border: '#b45309' },
  Designer: { bg: '#78350f', text: '#fde68a', border: '#b45309' },
  FE: { bg: '#1e3a8a', text: '#bfdbfe', border: '#1d4ed8' },
  BE: { bg: '#064e3b', text: '#a7f3d0', border: '#047857' },
  Dev: { bg: '#1e3a8a', text: '#bfdbfe', border: '#1d4ed8' },
  SA: { bg: '#312e81', text: '#c7d2fe', border: '#4338ca' },
  QA: { bg: '#881337', text: '#fecdd3', border: '#be123c' },
  DevOps: { bg: '#164e63', text: '#a5f3fc', border: '#0e7490' },
  PO: { bg: '#701a75', text: '#f5d0fe', border: '#a21caf' },
  PM: { bg: '#701a75', text: '#f5d0fe', border: '#a21caf' },
};

// Status color mappings
const STATUS_COLORS: Record<string, { bg: string; text: string; dot: string }> = {
  Done: { bg: '#065f46', text: '#34d399', dot: '#10b981' },
  'In Progress': { bg: '#1e40af', text: '#60a5fa', dot: '#3b82f6' },
  'To do': { bg: '#374151', text: '#9ca3af', dot: '#6b7280' },
};

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);

    const title = (searchParams.get('title') || 'Saho Task System').slice(0, 140);
    const role = (searchParams.get('role') || '').trim();
    const assignee = searchParams.get('assignee') || 'Chưa phân công';
    const status = searchParams.get('status') || 'To do';
    const progress = Math.min(100, Math.max(0, Number(searchParams.get('progress')) || 0));
    const effort = searchParams.get('effort') || '0';
    const week = searchParams.get('week') || '';

    const roleStyle = ROLE_COLORS[role] || { bg: '#1e293b', text: '#94a3b8', border: '#334155' };
    const statusStyle = STATUS_COLORS[status] || STATUS_COLORS['To do'];

    return new ImageResponse(
      (
        <div
          style={{
            height: '100%',
            width: '100%',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            backgroundColor: '#090d16',
            backgroundImage: 'radial-gradient(circle at 25% 10%, #1e1b4b 0%, transparent 45%), radial-gradient(circle at 80% 85%, #0f2e3d 0%, transparent 45%)',
            padding: '48px 56px',
            fontFamily: 'system-ui, sans-serif',
            color: '#ffffff',
            boxSizing: 'border-box',
          }}
        >
          {/* Top Bar: Brand & Badges */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
              <div
                style={{
                  width: '42px',
                  height: '42px',
                  borderRadius: '10px',
                  background: 'linear-gradient(135deg, #6366f1, #a855f7)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '22px',
                  fontWeight: 900,
                  boxShadow: '0 4px 14px rgba(99, 102, 241, 0.4)',
                }}
              >
                ⚡
              </div>
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <span style={{ fontSize: '20px', fontWeight: 800, letterSpacing: '-0.5px', color: '#f8fafc' }}>
                  SAHO TASK SYSTEM
                </span>
                <span style={{ fontSize: '13px', color: '#94a3b8', fontWeight: 500 }}>
                  gmm-task.vercel.app
                </span>
              </div>
            </div>

            {/* Badges: Role & Week */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              {role && (
                <div
                  style={{
                    backgroundColor: roleStyle.bg,
                    color: roleStyle.text,
                    border: `1.5px solid ${roleStyle.border}`,
                    borderRadius: '8px',
                    padding: '6px 16px',
                    fontSize: '16px',
                    fontWeight: 700,
                    letterSpacing: '0.5px',
                  }}
                >
                  {role}
                </div>
              )}
              {week && (
                <div
                  style={{
                    backgroundColor: '#1e293b',
                    color: '#cbd5e1',
                    borderRadius: '8px',
                    padding: '6px 14px',
                    fontSize: '15px',
                    fontWeight: 600,
                  }}
                >
                  Tuần {week}
                </div>
              )}
            </div>
          </div>

          {/* Middle Content: Task Title */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginTop: '20px', marginBottom: '20px' }}>
            <div
              style={{
                fontSize: title.length > 70 ? '36px' : '44px',
                fontWeight: 800,
                lineHeight: 1.25,
                color: '#ffffff',
                letterSpacing: '-0.8px',
                display: '-webkit-box',
                WebkitLineClamp: 3,
                WebkitBoxOrient: 'vertical',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}
            >
              {title}
            </div>
          </div>

          {/* Bottom Card: Progress & Metadata Stats */}
          <div
            style={{
              backgroundColor: 'rgba(30, 41, 59, 0.7)',
              border: '1px solid rgba(148, 163, 184, 0.15)',
              borderRadius: '16px',
              padding: '24px 32px',
              display: 'flex',
              flexDirection: 'column',
              gap: '18px',
            }}
          >
            {/* Progress Bar Header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <span style={{ fontSize: '15px', color: '#94a3b8', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  Tiến độ hoàn thành
                </span>
              </div>
              <span style={{ fontSize: '20px', fontWeight: 800, color: progress === 100 ? '#34d399' : '#60a5fa' }}>
                {progress}%
              </span>
            </div>

            {/* Progress Track */}
            <div
              style={{
                width: '100%',
                height: '12px',
                backgroundColor: '#0f172a',
                borderRadius: '6px',
                overflow: 'hidden',
                display: 'flex',
              }}
            >
              <div
                style={{
                  width: `${progress}%`,
                  height: '100%',
                  background: progress === 100 ? 'linear-gradient(90deg, #10b981, #34d399)' : 'linear-gradient(90deg, #3b82f6, #60a5fa)',
                  borderRadius: '6px',
                }}
              />
            </div>

            {/* Stats Row */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: '6px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '16px', color: '#94a3b8' }}>👤 Phụ trách:</span>
                <span style={{ fontSize: '17px', fontWeight: 700, color: '#f1f5f9' }}>
                  {assignee}
                </span>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '16px', color: '#94a3b8' }}>⏱️ Effort:</span>
                <span style={{ fontSize: '17px', fontWeight: 700, color: '#f1f5f9' }}>
                  {effort}h
                </span>
              </div>

              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  backgroundColor: statusStyle.bg,
                  color: statusStyle.text,
                  padding: '6px 14px',
                  borderRadius: '20px',
                  fontSize: '15px',
                  fontWeight: 700,
                }}
              >
                <div
                  style={{
                    width: '8px',
                    height: '8px',
                    borderRadius: '4px',
                    backgroundColor: statusStyle.dot,
                  }}
                />
                {status}
              </div>
            </div>
          </div>
        </div>
      ),
      {
        width: 1200,
        height: 630,
      }
    );
  } catch (e: any) {
    return new Response(`Failed to generate OG image: ${e.message}`, { status: 500 });
  }
}
