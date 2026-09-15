'use client';

import React, { useState } from 'react';
import { AppProvider, useApp } from '../context/AppContext';
import { Header } from '../components/Header';
import { WorkScheduleTable } from '../components/WorkScheduleTable';
import { MilestonesView } from '../components/MilestonesView';
import { KanbanBoard } from '../components/KanbanBoard';
import { AwardLeaderboard } from '../components/AwardLeaderboard';
import { WorkHistoryView } from '../components/WorkHistoryView';
import { NextWeekDefineView } from '../components/NextWeekDefineView';
import { UserManagementView } from '../components/UserManagementView';
import { TaskModal } from '../components/TaskModal';
import { LoginModal } from '../components/LoginModal';
import { Task } from '../types/task';

function MainApp() {
  const { authSession } = useApp();
  const [activeTab, setActiveTab] = useState<string>('schedule');
  const [selectedTaskForEdit, setSelectedTaskForEdit] = useState<Task | null>(null);
  const [isTaskModalOpen, setIsTaskModalOpen] = useState<boolean>(false);
  const [taskModalDefaultWeek, setTaskModalDefaultWeek] = useState<number | undefined>(undefined);
  const [taskModalDefaultAssignee, setTaskModalDefaultAssignee] = useState<string | undefined>(undefined);

  const handleOpenTaskModal = (task?: Task, defaultWeek?: number, defaultAssignee?: string) => {
    setSelectedTaskForEdit(task || null);
    setTaskModalDefaultWeek(defaultWeek);
    setTaskModalDefaultAssignee(defaultAssignee);
    setIsTaskModalOpen(true);
  };

  return (
    <div suppressHydrationWarning className="min-h-screen bg-slate-50 text-slate-900 font-sans flex flex-col antialiased selection:bg-indigo-200 selection:text-indigo-900 relative">
      {/* Login Modal Overlay if not logged in */}
      {!authSession && <LoginModal />}

      {authSession && (
        <>
          <Header activeTab={activeTab} setActiveTab={setActiveTab} />

          <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 lg:p-8 space-y-6">
            <div key={activeTab} className="animate-in fade-in duration-200">
              {activeTab === 'schedule' && (
                <WorkScheduleTable onOpenTaskModal={handleOpenTaskModal} />
              )}
              {activeTab === 'milestones' && <MilestonesView />}
              {activeTab === 'nextweek' && (
                <NextWeekDefineView onOpenTaskModal={handleOpenTaskModal} />
              )}
              {activeTab === 'kanban' && (
                <KanbanBoard onOpenTaskModal={handleOpenTaskModal} />
              )}
              {activeTab === 'awards' && <AwardLeaderboard />}
              {activeTab === 'history' && (
                <WorkHistoryView onOpenTaskModal={handleOpenTaskModal} />
              )}
              {activeTab === 'members' && <UserManagementView />}
            </div>
          </main>

          {/* Task Creation / Edit Modal */}
          <TaskModal
            task={selectedTaskForEdit}
            isOpen={isTaskModalOpen}
            defaultWeek={taskModalDefaultWeek}
            defaultAssignee={taskModalDefaultAssignee}
            onClose={() => {
              setIsTaskModalOpen(false);
              setSelectedTaskForEdit(null);
              setTaskModalDefaultWeek(undefined);
              setTaskModalDefaultAssignee(undefined);
            }}
          />
        </>
      )}
    </div>
  );
}

export default function Home() {
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return null;
  }

  return (
    <AppProvider>
      <MainApp />
    </AppProvider>
  );
}
