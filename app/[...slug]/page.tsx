import React from 'react';
import type { Metadata } from 'next';
import { MainAppClient } from '../../components/MainAppClient';
import { fetchTaskForMetadata, buildTaskMetadata } from '../../lib/serverTaskHelper';
import { getPageTitleForPath } from '../../lib/sahoRoutesMeta';

type CatchAllProps = {
  params: Promise<{ slug: string[] }>;
};

export async function generateMetadata(props: CatchAllProps): Promise<Metadata> {
  const { slug } = await props.params;
  if (slug && slug.length >= 2 && (slug[0] === 'task' || slug[0] === 'tasks') && slug[1] !== 'create') {
    const task = await fetchTaskForMetadata(slug[1]);
    if (task) {
      return buildTaskMetadata(task, slug[1]);
    }
  }

  const joined = '/' + (slug || []).join('/');
  return {
    title: getPageTitleForPath(joined),
    description: 'Hệ thống quản lý task, milestones và báo cáo tiến độ thời gian thực',
  };
}

export default function SahoRoutePage() {
  return <MainAppClient />;
}
