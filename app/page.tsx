import React from 'react';
import type { Metadata } from 'next';
import { MainAppClient } from '../components/MainAppClient';
import { fetchTaskForMetadata, buildTaskMetadata } from '../lib/serverTaskHelper';

type PageProps = {
  params?: Promise<Record<string, string | string[] | undefined>>;
  searchParams?: Promise<{ [key: string]: string | string[] | undefined }>;
};

/**
 * Server-Side Dynamic Metadata for Next.js App Router
 * When a task link (e.g. ?taskId=1791124942374) is shared into Telegram, Zalo, Slack, Facebook,
 * this fetches task details from Firebase on the server and delivers rich Open Graph meta tags!
 */
export async function generateMetadata(props: PageProps): Promise<Metadata> {
  const searchParams = props.searchParams ? await props.searchParams : {};
  const rawTaskId = (searchParams.taskId || searchParams.task || searchParams.openTaskId) as string | undefined;

  if (rawTaskId && typeof rawTaskId === 'string') {
    const task = await fetchTaskForMetadata(rawTaskId);
    if (task) {
      return buildTaskMetadata(task, rawTaskId);
    }
  }

  return {
    title: 'Saho Task System - Hệ thống quản lý task & báo cáo',
    description: 'Hệ thống quản lý task, milestones và báo cáo tiến độ thời gian thực',
    openGraph: {
      title: 'Saho Task System - Hệ thống quản lý task & báo cáo',
      description: 'Hệ thống quản lý task, milestones và báo cáo tiến độ thời gian thực',
      url: 'https://gmm-task.vercel.app',
      siteName: 'Saho Task System',
      type: 'website',
    },
  };
}

export default function Home() {
  return <MainAppClient />;
}
