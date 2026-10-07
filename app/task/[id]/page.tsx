import React from 'react';
import type { Metadata } from 'next';
import { MainAppClient } from '../../../components/MainAppClient';
import { fetchTaskForMetadata, buildTaskMetadata } from '../../../lib/serverTaskHelper';

type TaskPageProps = {
  params: Promise<{ id: string }>;
  searchParams?: Promise<{ [key: string]: string | string[] | undefined }>;
};

/**
 * Server-Side Dynamic Metadata for dedicated task URLs: /task/[id]
 */
export async function generateMetadata(props: TaskPageProps): Promise<Metadata> {
  const params = await props.params;
  const rawTaskId = params.id;

  if (rawTaskId) {
    const task = await fetchTaskForMetadata(rawTaskId);
    if (task) {
      return buildTaskMetadata(task, rawTaskId);
    }
  }

  return {
    title: 'Saho Task System - Hệ thống quản lý task & báo cáo',
    description: 'Hệ thống quản lý task, milestones và báo cáo tiến độ thời gian thực',
  };
}

export default function TaskPage() {
  return <MainAppClient />;
}
