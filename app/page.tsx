'use client';

import React, { useState } from 'react';
import { AppProvider, useApp } from '../context/AppContext';
import { Header, MainSectionType } from '../components/Header';
import { WorkScheduleTable } from '../components/WorkScheduleTable';
import { MilestonesView } from '../components/MilestonesView';
import { KanbanBoard } from '../components/KanbanBoard';
import { AwardLeaderboard } from '../components/AwardLeaderboard';
import { WorkHistoryView } from '../components/WorkHistoryView';
import { NextWeekDefineView } from '../components/NextWeekDefineView';
import { UserManagementView } from '../components/UserManagementView';
import { ResourceManagerView } from '../components/ResourceManagerView';
import { TaskModal } from '../components/TaskModal';
import { LoginModal } from '../components/LoginModal';
import { Task } from '../types/task';

function MainApp() {
  const { authSession } = useApp();
  const [activeMainSection, setActiveMainSection] = useState<MainSectionType>('tasks');
  const [activeTaskTab, setActiveTaskTab] = useState<string>('schedule');

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
          <Header
            activeMainSection={activeMainSection}
            setActiveMainSection={setActiveMainSection}
            activeTaskTab={activeTaskTab}
            setActiveTaskTab={setActiveTaskTab}
          />

          <main className="flex-1 max-w-7xl w-full mx-auto p-3 sm:p-6 lg:p-8 space-y-4 sm:space-y-6">
            {/* MAIN SECTION 1: TASK MANAGEMENT */}
            {activeMainSection === 'tasks' && (
              <div key={activeTaskTab} className="animate-in fade-in duration-200">
                {activeTaskTab === 'schedule' && (
                  <WorkScheduleTable onOpenTaskModal={handleOpenTaskModal} />
                )}
                {activeTaskTab === 'milestones' && <MilestonesView />}
                {activeTaskTab === 'nextweek' && (
                  <NextWeekDefineView onOpenTaskModal={handleOpenTaskModal} />
                )}
                {activeTaskTab === 'kanban' && (
                  <KanbanBoard onOpenTaskModal={handleOpenTaskModal} />
                )}
                {activeTaskTab === 'awards' && <AwardLeaderboard />}
                {activeTaskTab === 'history' && (
                  <WorkHistoryView onOpenTaskModal={handleOpenTaskModal} />
                )}
              </div>
            )}

            {/* MAIN SECTION 2: RESOURCE MANAGEMENT */}
            {activeMainSection === 'resources' && (
              <div className="animate-in fade-in duration-200">
                <ResourceManagerView />
              </div>
            )}

            {/* MAIN SECTION 3: USER MANAGEMENT (ADMIN ONLY) */}
            {activeMainSection === 'users' && (
              <div className="animate-in fade-in duration-200">
                <UserManagementView />
              </div>
            )}
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
