'use client';

import React, { useState } from 'react';
import { AppProvider, useApp } from '../context/AppContext';
import { Header } from '../components/Header';
import { WorkScheduleTable } from '../components/WorkScheduleTable';
import { MilestonesView } from '../components/MilestonesView';
import { KanbanBoard } from '../components/KanbanBoard';
import { AwardLeaderboard } from '../components/AwardLeaderboard';
import { UserManagementView } from '../components/UserManagementView';
import { TaskModal } from '../components/TaskModal';
import { LoginModal } from '../components/LoginModal';
import { Task } from '../types/task';
import { Database } from 'lucide-react';

function MainApp() {
  const { authSession, isFirebaseConnected } = useApp();
  const [activeTab, setActiveTab] = useState<string>('schedule');
  const [selectedTaskForEdit, setSelectedTaskForEdit] = useState<Task | null>(null);
  const [isTaskModalOpen, setIsTaskModalOpen] = useState<boolean>(false);

  const handleOpenTaskModal = (task?: Task) => {
    setSelectedTaskForEdit(task || null);
    setIsTaskModalOpen(true);
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans flex flex-col antialiased selection:bg-indigo-200 selection:text-indigo-900 relative">
      {/* Login Modal Overlay if not logged in */}
      {!authSession && <LoginModal />}

      {authSession && (
        <>
          <Header activeTab={activeTab} setActiveTab={setActiveTab} />

          <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 lg:p-8 space-y-6">
            {activeTab === 'schedule' && (
              <WorkScheduleTable onOpenTaskModal={handleOpenTaskModal} />
            )}
            {activeTab === 'milestones' && <MilestonesView />}
            {activeTab === 'kanban' && (
              <KanbanBoard onOpenTaskModal={handleOpenTaskModal} />
            )}
            {activeTab === 'awards' && <AwardLeaderboard />}
            {activeTab === 'members' && <UserManagementView />}
          </main>

          {/* Footer with Firebase Status Indicator */}
          <footer className="border-t border-slate-200 bg-white py-4 px-6 text-center text-xs text-slate-500 flex flex-col sm:flex-row items-center justify-between gap-2 max-w-7xl mx-auto w-full">
            <div>
              GMM Task System • Node Firebase Realtime: <strong className="text-slate-700">gmm-task</strong>
            </div>

            <div className="flex items-center gap-2">
              <span className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-slate-100 border border-slate-200 text-[11px]">
                <Database className="w-3 h-3 text-emerald-500" />
                Firebase RTDB:{' '}
                <span className={isFirebaseConnected ? 'text-emerald-600 font-semibold' : 'text-amber-500'}>
                  {isFirebaseConnected ? 'Đã kết nối' : 'Đang đồng bộ...'}
                </span>
              </span>
            </div>
          </footer>

          {/* Task Creation / Edit Modal */}
          <TaskModal
            task={selectedTaskForEdit}
            isOpen={isTaskModalOpen}
            onClose={() => {
              setIsTaskModalOpen(false);
              setSelectedTaskForEdit(null);
            }}
          />
        </>
      )}
    </div>
  );
}

export default function Home() {
  return (
    <AppProvider>
      <MainApp />
    </AppProvider>
  );
}
