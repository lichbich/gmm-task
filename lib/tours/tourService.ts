import { driver, DriveStep, Driver } from 'driver.js';

export type TourId = 'subtask' | 'milestones' | 'general';

const TOUR_STORAGE_KEYS: Record<TourId, string> = {
  subtask: 'saho_tour_subtask_v1',
  milestones: 'saho_tour_milestones_v1',
  general: 'saho_tour_general_v1',
};

export function isTourCompleted(tourId: TourId): boolean {
  if (typeof window === 'undefined') return true;
  try {
    return localStorage.getItem(TOUR_STORAGE_KEYS[tourId]) === 'true';
  } catch {
    return false;
  }
}

export function markTourCompleted(tourId: TourId): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(TOUR_STORAGE_KEYS[tourId], 'true');
  } catch {
    // Ignore localStorage errors
  }
}

export function resetTourProgress(tourId?: TourId): void {
  if (typeof window === 'undefined') return;
  try {
    if (tourId) {
      localStorage.removeItem(TOUR_STORAGE_KEYS[tourId]);
    } else {
      Object.values(TOUR_STORAGE_KEYS).forEach((k) => localStorage.removeItem(k));
    }
  } catch {
    // Ignore localStorage errors
  }
}

/**
 * Tạo cấu hình Driver.js chung đồng bộ với thiết kế của Saho
 */
function createDriverInstance(onFinish?: () => void): Driver {
  return driver({
    animate: true,
    smoothScroll: true,
    allowClose: true,
    disableActiveInteraction: true, // Khóa click tương tác vào element để tránh kích hoạt sự kiện ngoài ý muốn khi đang xem tour
    overlayClickBehavior: 'none', // Không tự đóng khi click ra ngoài vùng backdrop
    overlayOpacity: 0.65,
    stagePadding: 6,
    stageRadius: 12,
    popoverClass: 'saho-tour-popover',
    nextBtnText: 'Tiếp tục →',
    prevBtnText: '← Quay lại',
    doneBtnText: 'Hoàn tất ✓',
    showProgress: true,
    progressText: 'Bước {{current}} / {{total}}',
    onDestroyed: () => {
      onFinish?.();
    },
  });
}

/**
 * TOUR 1: Hướng dẫn Quản lý Subtask (Công việc con)
 */
export function startSubtaskTour(options?: {
  onTabSwitch?: (tab: string) => void;
  onComplete?: () => void;
}): void {
  if (typeof window === 'undefined') return;

  // Đóng tất cả các modal đang mở (nếu có) để trả lại màn hình sạch sẽ cho tour
  window.dispatchEvent(new CustomEvent('saho-close-all-modals'));

  // Nếu cần chuyển sang tab Milestones để xem cấu trúc cây
  if (options?.onTabSwitch) {
    options.onTabSwitch('milestones');
  }

  // Chờ 300ms để DOM render xong sau khi chuyển tab
  setTimeout(() => {
    const steps: DriveStep[] = [
      {
        element: '[data-tour="tab-milestones"]',
        popover: {
          title: '🌟 Cây Công Việc & Subtask',
          description:
            'Tab Milestones & Break Tasks là nơi trực quan nhất để quản lý các công việc lớn và các công việc con (Subtask) phân cấp theo dạng cây.',
          side: 'bottom',
          align: 'center',
        },
      },
      {
        element: '[data-tour="subtask-parent-row"]',
        popover: {
          title: '🌲 Phân Cấp Task Cha & Con',
          description:
            'Task cha sẽ hiển thị số lượng Subtask trực thuộc. Bấm vào icon mũi tên (hoặc hàng) để mở rộng hoặc thu gọn các công việc con thụt đầu dòng bên trong.',
          side: 'bottom',
          align: 'start',
        },
      },
      {
        element: '[data-tour="subtask-metrics-cell"]',
        popover: {
          title: '🔄 Tự Động Tính Toán Tiến Độ & Giờ Làm',
          description:
            'Tiến độ % và số giờ làm việc (Ước tính & Thực tế) của Task cha sẽ TỰ ĐỘNG tổng hợp từ toàn bộ các Subtask con. Bạn không cần phải tính toán hay cập nhật thủ công!',
          side: 'left',
          align: 'center',
        },
      },
      {
        element: '[data-tour="quick-add-subtask-btn"]',
        popover: {
          title: '⚡ Tạo Subtask Nhanh',
          description:
            'Bấm vào icon mũi tên cong để tạo nhanh một công việc con trực thuộc cho task này. Hệ thống sẽ tự động gán task cha và đồng bộ quyền liên quan.',
          side: 'top',
          align: 'center',
        },
      },
      {
        element: '[data-tour="tour-help-btn"]',
        popover: {
          title: '🎉 Hoàn Tất Hướng Dẫn!',
          description:
            'Bạn đã nắm rõ cách hoạt động của tính năng Subtask. Bất cứ lúc nào cần xem lại hướng dẫn, bạn có thể bấm vào icon La bàn / Trợ giúp tại đây.',
          side: 'bottom',
          align: 'end',
        },
      },
    ];

    // Lọc bỏ những step mà element chưa render trên DOM (fallback mượt mà)
    const validSteps = steps.filter((step) => {
      if (typeof step.element === 'string') {
        return Boolean(document.querySelector(step.element));
      }
      return true;
    });

    const driverObj = createDriverInstance(() => {
      markTourCompleted('subtask');
      options?.onComplete?.();
    });

    driverObj.setSteps(validSteps.length > 0 ? validSteps : steps);
    driverObj.drive();
  }, 350);
}

/**
 * TOUR 2: Hướng dẫn Kho Milestones & Cột Mốc Dự Án
 */
export function startMilestonesTour(options?: {
  onTabSwitch?: (tab: string) => void;
  onComplete?: () => void;
}): void {
  if (typeof window === 'undefined') return;

  // Đóng tất cả các modal đang mở (nếu có)
  window.dispatchEvent(new CustomEvent('saho-close-all-modals'));

  if (options?.onTabSwitch) {
    options.onTabSwitch('milestones');
  }

  setTimeout(() => {
    const steps: DriveStep[] = [
      {
        element: '[data-tour="tab-milestones"]',
        popover: {
          title: '🎯 Quản Lý Milestones',
          description:
            'Khu vực tập trung các cột mốc quan trọng của dự án. Các công việc được gắn vào từng Milestone cụ thể để theo dõi tiến độ chung.',
          side: 'bottom',
        },
      },
      {
        element: '[data-tour="milestone-card"]',
        popover: {
          title: '📦 Thẻ Cột Mốc Milestone',
          description:
            'Mỗi thẻ thể hiện tỷ lệ hoàn thành, thời hạn deadline và danh sách các đầu việc cần làm để đạt được cột mốc đó.',
          side: 'bottom',
        },
      },
      {
        element: '[data-tour="tour-help-btn"]',
        popover: {
          title: '✓ Hoàn Tất Tour Milestones',
          description: 'Bạn có thể xem lại bất kỳ lúc nào tại nút Trợ giúp này.',
          side: 'bottom',
        },
      },
    ];

    const validSteps = steps.filter((step) => {
      if (typeof step.element === 'string') {
        return Boolean(document.querySelector(step.element));
      }
      return true;
    });

    const driverObj = createDriverInstance(() => {
      markTourCompleted('milestones');
      options?.onComplete?.();
    });

    driverObj.setSteps(validSteps.length > 0 ? validSteps : steps);
    driverObj.drive();
  }, 350);
}
