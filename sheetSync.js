/** =========================================================================
 * SAHO TASK SYSTEM - GOOGLE APPS SCRIPT SYNC TOOL
 * - Đồng bộ danh sách công việc từ Firebase DB (/tasks.json, weeklyHistory và /weeklyArchives.json) vào Google Sheet
 * - Hỗ trợ đầy đủ cả mô hình Task hợp nhất (Single-Task với weeklyHistory) lẫn dữ liệu lịch sử tuần cũ (/weeklyArchives.json)
 * - Không ghi đè hay can thiệp vào Data Validation của Google Sheet để bảo tồn 100% kiểu "Khối" (Chip)
 * - Nghiệp vụ đồng bộ chuẩn xác:
 *   + Xử lý chuyển giao tuần (Rollover):
 *     - Task 0% tiến độ nếu đã được chuyển sang tuần sau: Tự động XÓA ở tuần cũ, chỉ hiển thị ở tuần mới.
 *     - Task đã có % tiến độ (> 0%): Giữ nguyên ở tuần cũ để ghi nhận kết quả, tuần mới tiếp tục hiển thị.
 *   + Trạng thái và Effort:
 *     - Task 0% tiến độ (tuần kế hoạch): Status = "To do", Effort = estimatedEffort.
 *     - Task làm dở (>0% và <100%): Status = "In Progress", Effort = estimatedEffort.
 *     - Task hoàn thành (100% hoặc tuần chốt): Status = "Done".
 * - Banner Tuần Chữ Đỏ + Banner Role Vàng + Cách 1 hàng trống giữa các nhân sự
 * ========================================================================= */

// Cấu hình URL Firebase Realtime Database
const FIREBASE_URL = "https://docugen-676bf-default-rtdb.asia-southeast1.firebasedatabase.app/gmm-task";
const SHEET_NAME = "Work Schedules";

// Thứ tự sắp xếp các Role theo chuẩn ưu tiên: BA, Design, FE, BE, SA, QA, QC, ...
const ROLE_ORDER = [
    'BA',
    'Design',
    'FE',
    'BE',
    'SA',
    'QA',
    'QC',
    'DevOps',
    'AI',
    'PO',
    'PM',
    'Back Office'
];

/**
 * Chuẩn hóa tên Role hiển thị trên hàng Banner Vàng (Cột A) và gom nhóm Role
 */
function normalizeRoleBannerName(roleName) {
    const raw = String(roleName || 'BA').trim();
    const lower = raw.toLowerCase();

    if (lower === 'ba' || lower.includes('business analyst') || lower.includes('nghiệp vụ')) return 'BA';
    if (lower === 'des' || lower === 'design' || lower === 'designer' || lower.includes('ui/ux') || lower.includes('thiết kế')) return 'Design';
    if (lower === 'fe' || lower === 'frontend' || lower === 'front-end') return 'FE';
    if (lower === 'be' || lower === 'backend' || lower === 'back-end' || lower === 'dev') return 'BE';
    if (lower === 'sa' || lower.includes('solution architect') || lower.includes('kiến trúc')) return 'SA';
    if (lower === 'qa') return 'QA';
    if (lower === 'qc' || lower === 'qc / tester' || lower.includes('tester') || lower.includes('kiểm thử')) return 'QC';
    if (lower === 'ops' || lower === 'devops' || lower.includes('hạ tầng')) return 'DevOps';
    if (lower === 'ai' || lower.includes('trí tuệ')) return 'AI';
    if (lower === 'po' || lower.includes('product owner')) return 'PO';
    if (lower === 'pm' || lower.includes('project manager')) return 'PM';
    if (lower === 'bof' || lower === 'back office' || lower === 'back-office') return 'Back Office';

    return raw || 'BA';
}

/**
 * Chuẩn hóa giá trị Role ghi vào Cột C trên dòng Task để khớp với Dropdown Chip của Google Sheet
 */
function formatTaskRoleForCell(rawRole, bannerName, allowedRoleChipValues) {
    const raw = String(rawRole || bannerName || 'BA').trim();
    const lower = raw.toLowerCase();
    const hasOption = (opt) =>
        Array.isArray(allowedRoleChipValues) &&
        allowedRoleChipValues.some(v => String(v).trim().toLowerCase() === opt.toLowerCase());

    if (lower === 'des' || lower === 'design' || lower === 'designer') {
        if (hasOption('Designer')) return 'Designer';
        if (hasOption('Design')) return 'Design';
        if (hasOption('DES')) return 'DES';
        return 'Designer';
    }
    if (lower === 'ops' || lower === 'devops') {
        if (hasOption('DevOps')) return 'DevOps';
        if (hasOption('OPS')) return 'OPS';
        return 'DevOps';
    }
    if (lower === 'qc' || lower === 'qc / tester' || lower.includes('tester')) {
        if (hasOption('QC')) return 'QC';
        if (hasOption('QA')) return 'QA';
        return 'QC';
    }
    if (lower === 'bof' || lower === 'back office') {
        if (hasOption('Back Office')) return 'Back Office';
        if (hasOption('BOF')) return 'BOF';
        return 'Back Office';
    }
    return raw;
}

function getRoleOrderIndex(roleName) {
    const normalized = normalizeRoleBannerName(roleName);
    const index = ROLE_ORDER.findIndex(r => r.toLowerCase() === normalized.toLowerCase());
    return index !== -1 ? index : 999;
}

/**
 * Hiển thị thông báo an toàn (không bị crash khi chạy ngầm qua Trigger tự động 5 phút)
 */
function safeAlert(message) {
    try {
        SpreadsheetApp.getUi().alert(message);
    } catch (e) {
        Logger.log(message);
    }
}

/**
 * 1. Tự động tạo Menu "⚡ Saho Sync" trên thanh công cụ Google Sheet khi mở file
 */
function onOpen() {
    const ui = SpreadsheetApp.getUi();
    ui.createMenu('⚡ Saho Sync')
        .addItem('🔄 Đồng bộ Tất Cả Các Tuần (Preserve Chips + Dynamic DB)', 'syncTasksFormattedToSheet')
        .addItem('⏰ Bật tự động đồng bộ ngầm mỗi 5 phút', 'setupAutoSyncTrigger')
        .addToUi();
}

/**
 * Lấy số Tuần Saho hiện tại từ ngày thực tế (VD: Sep 20, 2026 -> ISO 38 -> Saho Week 93)
 */
function getCurrentSahoWeekNum() {
    const now = new Date();
    const yr = now.getFullYear();
    const jan4 = new Date(yr, 0, 4);
    const dayOfWeek = jan4.getDay() || 7;
    const firstMonday = new Date(jan4);
    firstMonday.setDate(jan4.getDate() - dayOfWeek + 1);

    const diffDays = Math.floor((now.getTime() - firstMonday.getTime()) / (24 * 60 * 60 * 1000));
    const isoWeekNo = Math.floor(diffDays / 7) + 1;
    return isoWeekNo + 55;
}

/**
 * Tính toán Chuỗi ngày cho Tuần (Ví dụ: "(14/09-20/09)", "(21/09-27/09)")
 */
function getWeekDateRangeStr(sahoWeekNum, yearNum) {
    const isoWeekNo = sahoWeekNum > 50 ? sahoWeekNum - 55 : sahoWeekNum;
    const yr = yearNum || 2026;

    const jan4 = new Date(yr, 0, 4);
    const dayOfWeek = jan4.getDay() || 7;
    const firstMonday = new Date(jan4);
    firstMonday.setDate(jan4.getDate() - dayOfWeek + 1);

    const monday = new Date(firstMonday);
    monday.setDate(firstMonday.getDate() + (isoWeekNo - 1) * 7);

    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);

    const formatDate = (d) => {
        const day = String(d.getDate()).padStart(2, '0');
        const month = String(d.getMonth() + 1).padStart(2, '0');
        return `${day}/${month}`;
    };

    return `(${formatDate(monday)}-${formatDate(sunday)})`;
}

/**
 * Tính số giờ effort điền thêm riêng biệt trên Task cha (nếu có).
 * Nghiệp vụ:
 * - Trên hệ thống, effort của task cha mặc định là tổng các effort của các task con.
 *   Nếu đồng bộ cả task cha lẫn các task con lên Sheet thì sẽ bị trùng lặp / dư thừa effort của nhân sự.
 * - Do đó, khi sync dữ liệu lên Sheet, mặc định KHÔNG sync task cha nữa, chỉ sync các task con.
 * - Trừ khi task cha có effort riêng do người phụ trách thêm (khi số effort của task cha lớn hơn
 *   tổng các effort của các task con cộng lại), lúc đó sẽ hiện task cha lên với số effort chênh lệch được điền thêm đó.
 * - Nếu extraEffort <= 0 (bằng hoặc nhỏ hơn tổng subtasks) -> Trả về 0 (không hiển thị task cha).
 */
function calculateParentExtraEffort(parentTask, allSubtasksOfT, accName, isPastWeek) {
    if (!allSubtasksOfT || allSubtasksOfT.length === 0) return 0;

    // 1. Số effort hiện tại của Task cha (trước khi trừ subtask)
    let rawParentEffort = 0;
    if (isPastWeek) {
        if (parentTask.memberEfforts && typeof parentTask.memberEfforts === 'object' && Object.keys(parentTask.memberEfforts).length > 0) {
            rawParentEffort = parentTask.memberEfforts[accName] !== undefined
                ? (Number(parentTask.memberEfforts[accName]) || 0)
                : (Number(parentTask.actualEffort) || 0);
        } else {
            rawParentEffort = Number(parentTask.actualEffort) || 0;
        }
        if (rawParentEffort === 0 && Number(parentTask.estimatedEffort) > 0) {
            rawParentEffort = Number(parentTask.estimatedEffort);
        }
    } else {
        if (parentTask.memberEfforts && parentTask.memberEfforts[accName] !== undefined) {
            rawParentEffort = Number(parentTask.memberEfforts[accName]) || 0;
        } else {
            const act = Number(parentTask.actualEffort) || 0;
            const est = Number(parentTask.estimatedEffort) || 0;
            rawParentEffort = act > 0 ? act : est;
        }
    }

    // 2. Tổng effort của toàn bộ các Task con trực thuộc
    const getSubEffort = (st) => {
        let act = Number(st.actualEffort) || 0;
        if (act === 0 && st.memberEfforts && typeof st.memberEfforts === 'object') {
            act = Object.values(st.memberEfforts).reduce((mSum, v) => mSum + (Number(v) || 0), 0);
        }
        let est = Number(st.estimatedEffort) || 0;
        return { act, est };
    };

    const sumChildrenAct = Math.round(allSubtasksOfT.reduce((s, st) => s + getSubEffort(st).act, 0) * 100) / 100;
    const sumChildrenEst = Math.round(allSubtasksOfT.reduce((s, st) => s + getSubEffort(st).est, 0) * 100) / 100;
    const sumChildrenEffort = sumChildrenAct > 0 ? sumChildrenAct : sumChildrenEst;

    // 3. Tính số effort chênh lệch (effort riêng được điền thêm trên task cha)
    const extraEffort = Math.round((rawParentEffort - sumChildrenEffort) * 100) / 100;

    return extraEffort > 0 ? extraEffort : 0;
}

/**
 * Chuẩn hóa số tuần về hệ tuần cộng dồn Saho (Week 95, 96, ..., 102)
 */
function normalizeSahoWeekNum(rawWeek) {
    const n = Number(rawWeek) || 38;
    return n > 50 ? n : n + 55;
}

/**
 * Trích xuất số tuần cộng dồn Saho từ key (VD: "2026-W101") hoặc value của weeklyHistory entry
 */
function parseWeeklyHistoryWeekNum(histKey, entry) {
    if (entry && entry.weekNumber !== undefined && entry.weekNumber !== null && entry.weekNumber !== '') {
        return normalizeSahoWeekNum(entry.weekNumber);
    }
    const m = String(histKey || '').match(/W(\d+)$/i);
    if (m) {
        return normalizeSahoWeekNum(Number(m[1]));
    }
    return 0;
}

function normalizeTaskDedupeText(val) {
    return String(val || '').trim().replace(/\s+/g, ' ').toLowerCase();
}

/**
 * Chiếu dữ liệu một task hợp nhất (single-task + weeklyHistory) về đúng trạng thái của tuần `targetSahoWeek`
 */
function projectTaskForSahoWeek(baseTask, entry, targetSahoWeek, fallbackYear) {
    const safeEntry = entry || {};
    return {
        ...baseTask,
        weekNumber: targetSahoWeek,
        year: safeEntry.year || baseTask.year || fallbackYear || 2026,
        actualEffort: safeEntry.actualEffort !== undefined ? safeEntry.actualEffort : baseTask.actualEffort,
        estimatedEffort: safeEntry.estimatedEffort !== undefined ? safeEntry.estimatedEffort : baseTask.estimatedEffort,
        completionPercentage: safeEntry.completionPercentage !== undefined ? safeEntry.completionPercentage : baseTask.completionPercentage,
        status: safeEntry.status || baseTask.status,
        assigneeAccount: safeEntry.assigneeAccount !== undefined ? safeEntry.assigneeAccount : baseTask.assigneeAccount,
        supporterAccounts: safeEntry.supporterAccounts !== undefined ? safeEntry.supporterAccounts : baseTask.supporterAccounts,
        memberEfforts: safeEntry.memberEfforts !== undefined ? safeEntry.memberEfforts : baseTask.memberEfforts,
        lastSubmittedAt: safeEntry.lastSubmittedAt !== undefined ? safeEntry.lastSubmittedAt : baseTask.lastSubmittedAt,
        isSubmittedLate: safeEntry.isSubmittedLate !== undefined ? safeEntry.isSubmittedLate : baseTask.isSubmittedLate
    };
}

/**
 * Mở rộng và hợp nhất toàn bộ task theo từng tuần Saho (>= 95) từ 3 nguồn:
 * 1. Task live trên /tasks.json ở đúng tuần `t.weekNumber`
 * 2. Các tuần trước lưu trong `t.weeklyHistory` (do nghiệp vụ mới chỉ giữ 1 task duy nhất rollover qua các tuần)
 * 3. Các task lịch sử từ /weeklyArchives.json (bù những task tuần cũ không còn trong /tasks.json hoặc chưa có weeklyHistory)
 * Có chống trùng lặp trong từng tuần theo id, parentTaskId, code và (title + assigneeAccount).
 */
function buildExpandedWeeklyTasks(taskList, archiveList) {
    const tasksBySahoWeek = {};
    const weekSeenMeta = {};

    const ensureWeekBucket = (w) => {
        if (!tasksBySahoWeek[w]) {
            tasksBySahoWeek[w] = [];
            weekSeenMeta[w] = {
                ids: new Set(),
                parentIds: new Set(),
                codes: new Set(),
                titleAccs: new Set()
            };
        }
        return weekSeenMeta[w];
    };

    const registerTaskInWeek = (w, taskObj, checkDuplicate) => {
        if (!taskObj || w < 95) return;
        const titleClean = String(taskObj.title || '').trim();
        if (!titleClean) return;

        const meta = ensureWeekBucket(w);
        const tid = String(taskObj.id || '').trim();
        const pid = String(taskObj.parentTaskId || '').trim();
        const code = normalizeTaskDedupeText(taskObj.code);
        const titleAccKey = `${normalizeTaskDedupeText(titleClean)}|${normalizeTaskDedupeText(taskObj.assigneeAccount)}`;

        if (checkDuplicate) {
            if (tid && meta.ids.has(tid)) return;
            if (pid && meta.ids.has(pid)) return;
            if (tid && meta.parentIds.has(tid)) return;
            if (code && meta.codes.has(code)) return;
            if (meta.titleAccs.has(titleAccKey)) return;
        }

        if (tid) meta.ids.add(tid);
        if (pid) meta.parentIds.add(pid);
        if (code) meta.codes.add(code);
        meta.titleAccs.add(titleAccKey);

        tasksBySahoWeek[w].push({
            ...taskObj,
            sahoWeekNum: w
        });
    };

    // Nguồn 1: Task trực tiếp trên /tasks.json theo t.weekNumber
    (taskList || []).forEach(t => {
        if (!t) return;
        const w = normalizeSahoWeekNum(t.weekNumber);
        if (w < 95) return;
        registerTaskInWeek(w, { ...t, weekNumber: w }, false);
    });

    // Nguồn 2: Các tuần trước nằm trong t.weeklyHistory của từng task hợp nhất
    (taskList || []).forEach(t => {
        if (!t || !t.weeklyHistory || typeof t.weeklyHistory !== 'object') return;
        Object.entries(t.weeklyHistory).forEach(([histKey, entry]) => {
            if (!entry || typeof entry !== 'object') return;
            const hw = parseWeeklyHistoryWeekNum(histKey, entry);
            if (hw < 95) return;
            const projected = projectTaskForSahoWeek(t, entry, hw, t.year || 2026);
            registerTaskInWeek(hw, projected, true);
        });
    });

    // Nguồn 3: Dữ liệu snapshot trong /weeklyArchives.json cho các tuần cũ bị thiếu trong /tasks.json
    (archiveList || []).forEach(arch => {
        if (!arch || !Array.isArray(arch.tasksSnapshot)) return;
        const aw = normalizeSahoWeekNum(arch.weekNumber);
        if (aw < 95) return;
        arch.tasksSnapshot.forEach(st => {
            if (!st) return;
            registerTaskInWeek(aw, {
                ...st,
                weekNumber: aw,
                year: st.year || arch.year || 2026
            }, true);
        });
    });

    const expandedTaskList = [];
    Object.keys(tasksBySahoWeek)
        .map(Number)
        .sort((a, b) => a - b)
        .forEach(w => {
            tasksBySahoWeek[w].forEach(item => expandedTaskList.push(item));
        });

    return { expandedTaskList, tasksBySahoWeek };
}

/**
 * 2. Hàm đồng bộ tất cả các tuần từ Firebase vào Google Sheet
 */
function syncTasksFormattedToSheet() {
    const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = spreadsheet.getSheetByName(SHEET_NAME) || spreadsheet.getSheets()[0];

    if (!sheet) {
        safeAlert(`Không tìm thấy sheet "${SHEET_NAME}". Vui lòng kiểm tra lại tên sheet.`);
        return;
    }

    // Đảm bảo ô tiêu đề A1 hiển thị "Role" đúng format chuẩn nếu đang bị trống
    try {
        const a1Cell = sheet.getRange(1, 1);
        if (!String(a1Cell.getValue() || '').trim()) {
            a1Cell.setValue("Role").setFontColor("#CC0000").setFontWeight("bold").setFontSize(16).setFontFamily("Arial");
        }
    } catch (e) {}

    // A. Lấy danh sách Staff Code (Account) TRỰC TIẾP ĐỘNG từ Firebase DB /users.json (Lấy cả user đang hoạt động và user cũ để đồng bộ đầy đủ vào Dropdown)
    let allDbUsers = [];
    let usersList = [];
    try {
        const userRes = UrlFetchApp.fetch(`${FIREBASE_URL}/users.json`);
        const userContent = userRes.getContentText();
        if (userContent && userContent !== 'null') {
            const usersData = JSON.parse(userContent);
            allDbUsers = Object.values(usersData).filter(Boolean);
            usersList = allDbUsers.filter(u => !u.disabled && u.status !== 'disabled');
        }
    } catch (err) {
        Logger.log("Chưa lấy được danh sách user: " + err.toString());
    }

    // A2. Lấy danh sách Roles động từ Firebase DB /roles.json
    let allDbRoles = [];
    try {
        const roleRes = UrlFetchApp.fetch(`${FIREBASE_URL}/roles.json`);
        const roleContent = roleRes.getContentText();
        if (roleContent && roleContent !== 'null') {
            const rolesData = JSON.parse(roleContent);
            allDbRoles = Object.values(rolesData).filter(Boolean);
        }
    } catch (err) {
        Logger.log("Chưa lấy được danh sách roles: " + err.toString());
    }

    // B. Lấy dữ liệu Task từ Firebase RTDB /tasks.json và lịch sử tuần từ /weeklyArchives.json
    let firebaseTasks = {};
    try {
        const response = UrlFetchApp.fetch(`${FIREBASE_URL}/tasks.json`);
        const content = response.getContentText();
        if (content && content !== 'null') {
            firebaseTasks = JSON.parse(content);
        }
    } catch (err) {
        safeAlert("❌ Lỗi kết nối tới Firebase: " + err.toString());
        return;
    }

    let archiveList = [];
    try {
        const archiveRes = UrlFetchApp.fetch(`${FIREBASE_URL}/weeklyArchives.json`);
        const archiveContent = archiveRes.getContentText();
        if (archiveContent && archiveContent !== 'null') {
            const archiveData = JSON.parse(archiveContent);
            archiveList = Object.values(archiveData).filter(Boolean);
        }
    } catch (err) {
        Logger.log("Chưa lấy được weeklyArchives: " + err.toString());
    }

    const taskList = Object.values(firebaseTasks).filter(Boolean);
    const { expandedTaskList, tasksBySahoWeek } = buildExpandedWeeklyTasks(taskList, archiveList);

    if (expandedTaskList.length === 0) {
        safeAlert("ℹ️ Chưa có Task nào trên Hệ thống.");
        return;
    }

    // C. Nhóm toàn bộ Task theo từng Tuần khác nhau (Tuần 95, Tuần 96...)
    const tasksByWeekAndRole = {};

    expandedTaskList.forEach(t => {
        const titleClean = String(t.title || '').trim();
        if (!titleClean) return;

        const sahoWeekNum = t.sahoWeekNum || normalizeSahoWeekNum(t.weekNumber);

        // BỎ QUA CÁC TUẦN < 95: Tuần 94 trở xuống chỉ lưu trong Lịch Sử Công Việc, đồng bộ từ Tuần 95 trở đi làm chuẩn
        if (sahoWeekNum < 95) return;

        const yr = t.year || 2026;
        const dateRangeStr = getWeekDateRangeStr(sahoWeekNum, yr);
        const weekHeaderKey = `Week ${sahoWeekNum} ${dateRangeStr}`;

        if (!tasksByWeekAndRole[weekHeaderKey]) {
            tasksByWeekAndRole[weekHeaderKey] = {
                sahoWeekNum: sahoWeekNum,
                headerText: weekHeaderKey,
                roles: {}
            };
        }

        const pushTask = (roleName, taskItem) => {
            const r = normalizeRoleBannerName(roleName);
            if (!tasksByWeekAndRole[weekHeaderKey].roles[r]) {
                tasksByWeekAndRole[weekHeaderKey].roles[r] = [];
            }
            tasksByWeekAndRole[weekHeaderKey].roles[r].push(taskItem);
        };

        const primaryAcc = (t.assigneeAccount || '').trim();

        // 1. Primary Assignee Task Row
        if (primaryAcc && primaryAcc.toLowerCase() !== 'unassigned') {
            pushTask(t.role, {
                ...t,
                syncAccount: primaryAcc,
                isCollab: false
            });
        }

        // 2. Collab Supporter Members Task Rows (Break out cho từng thành viên Collab!)
        if (t.supporterAccounts && Array.isArray(t.supporterAccounts) && t.supporterAccounts.length > 0) {
            t.supporterAccounts.forEach(supAcc => {
                const cleanSupAcc = String(supAcc || '').trim();
                if (!cleanSupAcc || (primaryAcc && cleanSupAcc.toLowerCase() === primaryAcc.toLowerCase())) return;

                const supUser = usersList.find(u => u.account && u.account.trim().toLowerCase() === cleanSupAcc.toLowerCase());
                const supRoles = (supUser && supUser.specializations && supUser.specializations.length > 0)
                    ? supUser.specializations
                    : (supUser && supUser.role)
                        ? [supUser.role]
                        : [t.role];

                // Xác định role phù hợp cho thành viên Collab này theo thứ tự ưu tiên ROLE_ORDER
                let targetRole = normalizeRoleBannerName(t.role);
                let bestOrderIdx = 9999;
                for (let r of supRoles) {
                    const normR = normalizeRoleBannerName(r);
                    const idx = getRoleOrderIndex(normR);
                    if (idx < bestOrderIdx) {
                        bestOrderIdx = idx;
                        targetRole = normR;
                    }
                }

                pushTask(targetRole, {
                    ...t,
                    syncAccount: cleanSupAcc,
                    isCollab: true
                });
            });
        }
    });

    // Sắp xếp các Tuần theo thứ tự tăng dần (Tuần 95 -> Tuần 96...)
    const sortedWeekKeys = Object.keys(tasksByWeekAndRole).sort((a, b) => {
        return tasksByWeekAndRole[a].sahoWeekNum - tasksByWeekAndRole[b].sahoWeekNum;
    });

    if (sortedWeekKeys.length === 0) {
        safeAlert("ℹ️ Không có task nào từ Tuần 95 trở đi để đồng bộ.");
        return;
    }

    const firstWeekNum = tasksByWeekAndRole[sortedWeekKeys[0]].sahoWeekNum;

    // D. Tìm vị trí dòng bắt đầu cho Tuần đầu tiên (VD: Tuần 95)
    let lastRow = sheet.getLastRow();
    let startRow = -1;

    if (lastRow >= 1) {
        const colAValues = sheet.getRange(1, 1, lastRow, 1).getValues();
        for (let r = 0; r < colAValues.length; r++) {
            const val = String(colAValues[r][0] || '').trim();
            if (new RegExp(`^Week\\s+${firstWeekNum}\\b`, 'i').test(val)) {
                startRow = r + 1;
                break;
            }
        }
    }

    if (startRow === -1) {
        startRow = sheet.getLastRow() + 1;
        if (startRow === 1) startRow = 2;
    }

    // Quét tìm ô mẫu có sẵn Data Validation trên Sheet cho Cột C (Role), G (Status), H (Account)
    let chipTemplateRowC = -1;
    let chipTemplateRowG = -1;
    let chipTemplateRowH = -1;
    let existingRuleC = null;
    let existingRuleG = null;
    let existingRuleH = null;
    let allowedRoleChipValues = [];
    let existingAccountChipValues = [];
    const existingAccountCellsAboveStart = [];
    const existingRoleCellsAboveStart = [];

    if (lastRow >= 2) {
        try {
            const checkRows = Math.min(lastRow - 1, 2500);
            const rulesC = sheet.getRange(2, 3, checkRows, 1).getDataValidations();
            const rulesG = sheet.getRange(2, 7, checkRows, 1).getDataValidations();
            const rulesH = sheet.getRange(2, 8, checkRows, 1).getDataValidations();

            for (let r = 0; r < checkRows; r++) {
                const rowNum = r + 2;
                if (rulesC[r][0] != null) {
                    if (rowNum < startRow) existingRoleCellsAboveStart.push(`C${rowNum}`);
                    if (chipTemplateRowC === -1) {
                        chipTemplateRowC = rowNum;
                        existingRuleC = rulesC[r][0];
                        try {
                            const crit = existingRuleC.getCriteriaValues();
                            if (crit && Array.isArray(crit[0])) {
                                allowedRoleChipValues = crit[0];
                            }
                        } catch (e) {}
                    }
                }
                if (chipTemplateRowG === -1 && rulesG[r][0] != null) {
                    chipTemplateRowG = rowNum;
                    existingRuleG = rulesG[r][0];
                }
                if (rulesH[r][0] != null) {
                    if (rowNum < startRow) existingAccountCellsAboveStart.push(`H${rowNum}`);
                    if (chipTemplateRowH === -1) {
                        chipTemplateRowH = rowNum;
                        existingRuleH = rulesH[r][0];
                        try {
                            const critH = existingRuleH.getCriteriaValues();
                            if (critH && Array.isArray(critH[0])) {
                                existingAccountChipValues = critH[0];
                            }
                        } catch (e) {}
                    }
                }
            }
        } catch (e) {
            Logger.log("Không đọc được DataValidation mẫu: " + e.toString());
        }
    }

    // Tổng hợp danh sách Account ĐỘNG từ:
    // 1. Toàn bộ thành viên trong Firebase DB (/users.json)
    // 2. Toàn bộ thành viên xuất hiện trong Tasks (/tasks.json - cả người nhận chính và người collab)
    // 3. Các thành viên cũ đã có sẵn trong Dropdown của Google Sheet
    const dynamicAccountSet = new Set();
    existingAccountChipValues.forEach(acc => {
        const clean = String(acc || '').trim();
        if (clean) dynamicAccountSet.add(clean);
    });
    allDbUsers.forEach(u => {
        const clean = String((u && u.account) || '').trim();
        if (clean) dynamicAccountSet.add(clean);
    });
    expandedTaskList.forEach(t => {
        if (t && t.assigneeAccount) {
            const clean = String(t.assigneeAccount).trim();
            if (clean) dynamicAccountSet.add(clean);
        }
        if (t && Array.isArray(t.supporterAccounts)) {
            t.supporterAccounts.forEach(sup => {
                const clean = String(sup || '').trim();
                if (clean) dynamicAccountSet.add(clean);
            });
        }
    });
    const dynamicAccountList = Array.from(dynamicAccountSet).sort((a, b) => a.localeCompare(b));
    if (dynamicAccountList.length === 0) {
        dynamicAccountList.push('Chưa phân công');
    }

    // Tổng hợp danh sách Role ĐỘNG từ ROLE_ORDER + Firebase DB (/roles.json) + Tasks + Dropdown sẵn có trên Sheet
    const dynamicRoleSet = new Set([
        ...ROLE_ORDER,
        'Designer',
        'DES',
        'OPS',
        'BOF'
    ]);
    allowedRoleChipValues.forEach(r => {
        const clean = String(r || '').trim();
        if (clean) dynamicRoleSet.add(clean);
    });
    allDbRoles.forEach(r => {
        if (r && r.code) dynamicRoleSet.add(String(r.code).trim());
        if (r && r.name) dynamicRoleSet.add(String(r.name).trim());
    });
    expandedTaskList.forEach(t => {
        if (t && t.role) dynamicRoleSet.add(String(t.role).trim());
    });
    const dynamicRoleList = Array.from(dynamicRoleSet).filter(Boolean);

    // Tạo quy tắc DataValidation động có chứa đầy đủ thành viên & role mới từ DB, đồng thời bật setAllowInvalid(true) để không bao giờ văng lỗi chặn đồng bộ
    const dynamicAccountValidation = (existingRuleH ? existingRuleH.copy() : SpreadsheetApp.newDataValidation())
        .requireValueInList(dynamicAccountList, true)
        .setAllowInvalid(true)
        .build();

    const dynamicRoleValidation = (existingRuleC ? existingRuleC.copy() : SpreadsheetApp.newDataValidation())
        .requireValueInList(dynamicRoleList, true)
        .setAllowInvalid(true)
        .build();

    const dynamicStatusValidation = (existingRuleG ? existingRuleG.copy() : SpreadsheetApp.newDataValidation())
        .requireValueInList(['To do', 'In Progress', 'Done'], true)
        .setAllowInvalid(true)
        .build();

    // E. Xây dựng toàn bộ các dòng dữ liệu và định dạng cho TẤT CẢ các tuần thành một khối liền mạch
    const allRowsToInsert = [];
    const rowFormats = [];

    sortedWeekKeys.forEach((weekHeaderKey, wIdx) => {
        const weekData = tasksByWeekAndRole[weekHeaderKey];
        const rolesMap = weekData.roles;
        const currentWeekNum = getCurrentSahoWeekNum() || 96;
        const isPastWeek = weekData.sahoWeekNum < currentWeekNum;

        // 1. Tiêu đề Tuần Chữ Đỏ (VD: Week 95 (28/09-04/10))
        allRowsToInsert.push([weekData.headerText, "", "", "", "", "", "", "", "", ""]);
        rowFormats.push({ type: 'WEEK_HEADER', text: weekData.headerText });

        const sortedRoles = Object.keys(rolesMap).sort((a, b) => getRoleOrderIndex(a) - getRoleOrderIndex(b));

        sortedRoles.forEach(bannerName => {
            const tasksInRole = rolesMap[bannerName];
            if (!tasksInRole || tasksInRole.length === 0) return;

            // Nhóm Task theo Assignee / SyncAccount
            const tasksByAssignee = {};
            tasksInRole.forEach(t => {
                const acc = (t.syncAccount || t.assigneeAccount || 'Chưa phân công').trim();
                if (!tasksByAssignee[acc]) tasksByAssignee[acc] = [];
                tasksByAssignee[acc].push(t);
            });

            // Sắp xếp thứ tự các thành viên theo cấp bậc (Admin/Leader/Advisor trước) rồi đến bảng chữ cái
            const assignees = Object.keys(tasksByAssignee).sort((a, b) => {
                const userA = usersList.find(u => u.account && u.account.trim().toLowerCase() === a.toLowerCase());
                const userB = usersList.find(u => u.account && u.account.trim().toLowerCase() === b.toLowerCase());
                const getRank = (u) => {
                    if (!u) return 99;
                    if (u.role === 'Admin') return 0;
                    if (u.role === 'Leader') return 1;
                    if (u.role === 'Advisor') return 2;
                    return 3;
                };
                const rankDiff = getRank(userA) - getRank(userB);
                if (rankDiff !== 0) return rankDiff;
                return a.localeCompare(b);
            });

            // Lọc danh sách nhân sự có task hợp lệ cần hiển thị
            const validAssignees = [];

            assignees.forEach(accName => {
                const rawPersonTasks = tasksByAssignee[accName];
                // Deduplicate tasks for this person in this week by title
                const personTasksMap = new Map();
                rawPersonTasks.forEach(t => {
                    const titleKey = String(t.title || '').trim().toLowerCase();
                    const existing = personTasksMap.get(titleKey);
                    if (!existing) {
                        personTasksMap.set(titleKey, t);
                    } else {
                        const timeCurr = t.updatedAt ? new Date(t.updatedAt).getTime() : 0;
                        const timeExisting = existing.updatedAt ? new Date(existing.updatedAt).getTime() : 0;
                        if (timeCurr >= timeExisting) {
                            personTasksMap.set(titleKey, t);
                        }
                    }
                });

                const weekTasksList = tasksBySahoWeek[weekData.sahoWeekNum] || expandedTaskList;
                const findWeekSubtasksOf = (parentTask) => {
                    const pId = String((parentTask && parentTask.id) || '').trim();
                    const pParentId = String((parentTask && parentTask.parentTaskId) || '').trim();
                    return weekTasksList.filter(st => {
                        const subPid = String((st && st.subtaskParentId) || '').trim();
                        if (!subPid) return false;
                        return (pId && subPid === pId) || (pParentId && subPid === pParentId);
                    });
                };

                // Kiểm tra xem task này đã được chuyển/cắt sang tuần sau hay chưa (bao gồm cả weeklyHistory và weeklyArchives)
                const isTransferredToFutureWeek = (taskItem) => {
                    const rootId = taskItem.parentTaskId || taskItem.id;
                    const tCode = normalizeTaskDedupeText(taskItem.code);
                    const tTitle = normalizeTaskDedupeText(taskItem.title);
                    const tAcc = normalizeTaskDedupeText(accName || taskItem.syncAccount || taskItem.assigneeAccount);

                    return expandedTaskList.some(nt => {
                        const ntWeekNum = nt.sahoWeekNum || normalizeSahoWeekNum(nt.weekNumber);
                        if (ntWeekNum <= weekData.sahoWeekNum) return false;

                        // 1. Khớp theo parentTaskId hoặc id
                        if (rootId && (nt.parentTaskId === rootId || nt.id === rootId)) return true;

                        // 2. Khớp theo Mã Task (nếu cùng người phụ trách hoặc task hợp nhất)
                        const ntCode = normalizeTaskDedupeText(nt.code);
                        const ntPrimaryAcc = normalizeTaskDedupeText(nt.assigneeAccount || nt.syncAccount);
                        const ntSupporters = Array.isArray(nt.supporterAccounts)
                            ? nt.supporterAccounts.map(s => normalizeTaskDedupeText(s))
                            : [];
                        const sameAccount = (ntPrimaryAcc && ntPrimaryAcc === tAcc) || (tAcc && ntSupporters.indexOf(tAcc) !== -1);
                        if (tCode && ntCode && tCode === ntCode && (sameAccount || nt.id === taskItem.id)) return true;

                        // 3. Khớp theo Title và Account
                        const ntTitle = normalizeTaskDedupeText(nt.title);
                        if (ntTitle === tTitle && sameAccount) return true;

                        return false;
                    });
                };

                // Lọc bỏ task:
                // - Những task 0% của tuần này nếu đã cắt/chuyển sang tuần sau thì sẽ xoá ở tuần này đi.
                // - Những task nào đã có phần trăm (> 0%) thì giữ nguyên ở tuần này.
                const filteredTasks = Array.from(personTasksMap.values()).filter(t => {
                    const rawPct = (t.completionPercentage !== undefined && t.completionPercentage !== null) ? Number(t.completionPercentage) : 0;

                    // 1. Task 0% tiến độ nếu đã được chuyển sang tuần sau -> Xóa ở tuần cũ đi
                    if (rawPct === 0 && isTransferredToFutureWeek(t)) {
                        return false;
                    }

                    // 2. Với các tuần cũ trong quá khứ (< currentWeekNum): bỏ qua các task unworked chưa làm
                    if (isPastWeek) {
                        const effort = Number(t.actualEffort) || 0;
                        const isUnworked = rawPct === 0 && effort === 0 && t.status !== 'Done';
                        if (isUnworked) return false;
                    }

                    return true;
                });

                // Sắp xếp dạng cây: Task cha đứng trước (nếu có effort riêng), các subtask trực thuộc xếp ngay liền kề bên dưới.
                // Nghiệp vụ: Nếu effort task cha chỉ là tổng subtasks -> không sync task cha.
                // Chỉ sync task cha khi có effort riêng (> tổng các subtask), với số effort chênh lệch đó.
                const arrangedTasks = [];
                const subtasksNestedSet = new Set();
                const personTasksList = filteredTasks;

                personTasksList.forEach(t => {
                    if (t.subtaskParentId && personTasksList.some(p => p.id === t.subtaskParentId)) {
                        subtasksNestedSet.add(t.id);
                    }
                });

                personTasksList.forEach(t => {
                    if (!subtasksNestedSet.has(t.id)) {
                        const allSubtasksOfT = findWeekSubtasksOf(t);
                        if (allSubtasksOfT.length > 0) {
                            const extraEffort = calculateParentExtraEffort(t, allSubtasksOfT, accName, isPastWeek);
                            // Chỉ đưa task cha vào danh sách hiển thị khi có effort điền thêm riêng biệt (> tổng effort các task con)
                            if (extraEffort > 0) {
                                arrangedTasks.push({ ...t, calculatedParentExtraEffort: extraEffort });
                            }
                            // Các subtask con thuộc về thành viên này vẫn luôn được đưa vào hiển thị đầy đủ
                            personTasksList.forEach(st => {
                                if (st.subtaskParentId === t.id || (t.parentTaskId && st.subtaskParentId === t.parentTaskId)) {
                                    arrangedTasks.push(st);
                                }
                            });
                        } else {
                            arrangedTasks.push(t);
                        }
                    }
                });

                if (arrangedTasks.length > 0) {
                    validAssignees.push({ accName, arrangedTasks });
                }
            });

            // Nếu role này không có task nào thì bỏ qua banner
            if (validAssignees.length === 0) return;

            // DUY NHẤT 1 DÒNG Banner Vàng Role (#FFE599)
            allRowsToInsert.push([bannerName, "", "", "", "", "", "", "", "", ""]);
            rowFormats.push({ type: 'BANNER', name: bannerName });

            const weekTasksForRole = tasksBySahoWeek[weekData.sahoWeekNum] || expandedTaskList;
            validAssignees.forEach((assigneeItem, accIdx) => {
                const { accName, arrangedTasks } = assigneeItem;

                arrangedTasks.forEach(t => {
                    let rawPct = (t.completionPercentage !== undefined && t.completionPercentage !== null)
                        ? Number(t.completionPercentage)
                        : 0;

                    const isSub = Boolean(t.isSubtask || (t.subtaskParentId && String(t.subtaskParentId).trim() !== ''));
                    const tId = String((t && t.id) || '').trim();
                    const tParentId = String((t && t.parentTaskId) || '').trim();
                    const allSubtasksOfT = weekTasksForRole.filter(st => {
                        const subPid = String((st && st.subtaskParentId) || '').trim();
                        if (!subPid) return false;
                        return (tId && subPid === tId) || (tParentId && subPid === tParentId);
                    });
                    const isParent = Boolean(t.isParentTask || allSubtasksOfT.length > 0);

                    // Nếu là task cha và không ghi đè thủ công, tự động tổng hợp số liệu từ các subtask
                    if (allSubtasksOfT.length > 0 && !t.isManualOverride && !isPastWeek) {
                        const sumEst = Math.round(allSubtasksOfT.reduce((s, st) => s + (Number(st.estimatedEffort) || 0), 0) * 100) / 100;
                        const sumAct = Math.round(allSubtasksOfT.reduce((s, st) => s + (Number(st.actualEffort) || 0), 0) * 100) / 100;
                        const totalWeight = allSubtasksOfT.reduce((s, st) => s + (Number(st.estimatedEffort) || Number(st.actualEffort) || 1), 0);
                        let calcPct = 0;
                        if (totalWeight > 0) {
                            const weightedSum = allSubtasksOfT.reduce((s, st) => {
                                const weight = Number(st.estimatedEffort) || Number(st.actualEffort) || 1;
                                const pct = Number(st.completionPercentage) || 0;
                                return s + pct * weight;
                            }, 0);
                            calcPct = Math.round(weightedSum / totalWeight);
                        } else {
                            const sumPct = allSubtasksOfT.reduce((s, st) => s + (Number(st.completionPercentage) || 0), 0);
                            calcPct = Math.round(sumPct / allSubtasksOfT.length);
                        }
                        rawPct = calcPct;
                    }

                    let finalStatus = "To do";
                    let effortVal = 0;
                    let pctStr = `${rawPct}%`;

                    if (isPastWeek) {
                        // ==========================================
                        // TUẦN CŨ: Tuần đã chốt trong quá khứ
                        // ==========================================
                        finalStatus = "Done";
                        if (t.calculatedParentExtraEffort !== undefined) {
                            effortVal = t.calculatedParentExtraEffort;
                        } else if (t.memberEfforts && typeof t.memberEfforts === 'object' && Object.keys(t.memberEfforts).length > 0) {
                            effortVal = t.memberEfforts[accName] !== undefined ? (Number(t.memberEfforts[accName]) || 0) : 0;
                        } else {
                            effortVal = Number(t.actualEffort) || 0;
                        }
                    } else {
                        // ==========================================
                        // TUẦN HIỆN TẠI & TUẦN TƯƠNG LAI:
                        // ==========================================
                        if (t.calculatedParentExtraEffort !== undefined) {
                            effortVal = t.calculatedParentExtraEffort;
                            if (allSubtasksOfT.length > 0 && !t.isManualOverride) {
                                const allSubDone = allSubtasksOfT.every(st => st.status === 'Done' || (Number(st.completionPercentage) || 0) >= 100);
                                const anySubProg = allSubtasksOfT.some(st => st.status === 'In Progress' || (Number(st.completionPercentage) || 0) > 0);
                                if (allSubDone && rawPct >= 100) {
                                    finalStatus = "Done";
                                } else if (anySubProg || rawPct > 0) {
                                    finalStatus = "In Progress";
                                } else {
                                    finalStatus = "To do";
                                }
                            } else {
                                if (rawPct >= 100 || t.status === 'Done') {
                                    finalStatus = "Done";
                                } else if (rawPct > 0 || t.status === 'In Progress') {
                                    finalStatus = "In Progress";
                                } else {
                                    finalStatus = "To do";
                                }
                            }
                        } else {
                            if (rawPct >= 100 || t.status === 'Done') {
                                finalStatus = "Done";
                            } else if (rawPct > 0 || t.status === 'In Progress') {
                                finalStatus = "In Progress";
                            } else {
                                finalStatus = "To do";
                            }

                            if (t.memberEfforts && t.memberEfforts[accName] !== undefined) {
                                effortVal = Number(t.memberEfforts[accName]) || 0;
                            } else {
                                effortVal = (t.estimatedEffort !== undefined && t.estimatedEffort !== null && t.estimatedEffort !== '')
                                    ? Number(t.estimatedEffort) || 0
                                    : (Number(t.actualEffort) || 0);
                            }
                        }
                    }

                    // Tên task hiển thị: Thêm thụt dòng "   ↳ " cho các Subtask
                    let sheetTitle = t.title || "";
                    if (isSub) {
                        const trimmedTitle = sheetTitle.trim();
                        sheetTitle = trimmedTitle.startsWith('↳') ? `   ${trimmedTitle}` : `   ↳ ${trimmedTitle}`;
                    }

                    const cellRoleValue = formatTaskRoleForCell(t.role || bannerName, bannerName, allowedRoleChipValues);

                    allRowsToInsert.push([
                        "",                      // Col A (1): Trống (Bỏ STT)
                        sheetTitle,              // Col B (2): Tên Task (Có thụt dòng nếu là subtask)
                        cellRoleValue,           // Col C (3): Role
                        "",                      // Col D (4): Trống
                        pctStr,                  // Col E (5): Phần trăm công việc (%)
                        effortVal,               // Col F (6): Effort (Số giờ làm)
                        finalStatus,             // Col G (7): Status
                        accName,                 // Col H (8): Account
                        "",                      // Col I (9): Trống
                        ""                       // Col J (10): Trống
                    ]);
                    rowFormats.push({ type: 'TASK', task: t, finalStatus: finalStatus, accName: accName, role: cellRoleValue, isParent: isParent, isSub: isSub });
                });

                // Hàng trống phân cách 2 người khác nhau
                if (accIdx < validAssignees.length - 1) {
                    allRowsToInsert.push(["", "", "", "", "", "", "", "", "", ""]);
                    rowFormats.push({ type: 'EMPTY' });
                }
            });
        });

        // Hàng trống phân cách giữa 2 Tuần
        if (wIdx < sortedWeekKeys.length - 1) {
            allRowsToInsert.push(["", "", "", "", "", "", "", "", "", ""]);
            rowFormats.push({ type: 'EMPTY' });
        }
    });

    const numRows = allRowsToInsert.length;

    // Nếu ô mẫu Chip Status (Cột G) nằm trong vùng sắp bị xóa (>= startRow), sao lưu tạm sang ô Z1 (ngoài vùng cột A:J)
    let statusTemplateRange = null;
    let usedBackupZ1 = false;
    if (chipTemplateRowG !== -1) {
        if (chipTemplateRowG < startRow) {
            statusTemplateRange = sheet.getRange(chipTemplateRowG, 7);
        } else {
            try {
                const backupCell = sheet.getRange(1, 26); // Ô Z1
                sheet.getRange(chipTemplateRowG, 7).copyTo(backupCell, SpreadsheetApp.CopyPasteType.PASTE_DATA_VALIDATION, false);
                statusTemplateRange = backupCell;
                usedBackupZ1 = true;
            } catch (e) {}
        }
    }

    // F. Cập nhật trước danh sách thành viên & role mới từ DB cho các dòng phía trên startRow (ví dụ Week 95),
    // đồng thời làm sạch toàn bộ DataValidation, nội dung và định dạng cũ từ startRow đến hết vùng dữ liệu mới (endRowNeeded).
    // Phải xóa DataValidation tới tận endRowNeeded và flush() TRƯỚC khi setValues,
    // vì các hàng trống bên dưới getLastRow() (ví dụ H2033) vẫn giữ DataValidation cũ chặn thành viên mới!
    try {
        if (existingAccountCellsAboveStart.length > 0) {
            for (let k = 0; k < existingAccountCellsAboveStart.length; k += 50) {
                const chunk = existingAccountCellsAboveStart.slice(k, k + 50);
                sheet.getRangeList(chunk).setDataValidation(dynamicAccountValidation);
            }
        }
        if (existingRoleCellsAboveStart.length > 0) {
            for (let k = 0; k < existingRoleCellsAboveStart.length; k += 50) {
                const chunk = existingRoleCellsAboveStart.slice(k, k + 50);
                sheet.getRangeList(chunk).setDataValidation(dynamicRoleValidation);
            }
        }
    } catch (e) {}

    lastRow = sheet.getLastRow();
    const maxSheetRow = sheet.getMaxRows();
    const endRowNeeded = Math.max(maxSheetRow, lastRow, startRow + Math.max(numRows, 1) - 1);
    if (endRowNeeded >= startRow) {
        const totalRowsToBottom = endRowNeeded - startRow + 1;
        sheet.getRange(startRow, 1, totalRowsToBottom, 10).clearDataValidations();
    }
    if (lastRow >= startRow) {
        const rowsToClear = lastRow - startRow + 1;
        const clearRange = sheet.getRange(startRow, 1, rowsToClear, 10);
        clearRange.clearContent();
        clearRange.clearFormat();
    }
    SpreadsheetApp.flush();

    // G. Ghi toàn bộ dữ liệu liền mạch từ startRow & Áp dụng định dạng hàng loạt
    if (numRows > 0) {
        const dataRange = sheet.getRange(startRow, 1, numRows, 10);

        const nonTaskA1Ranges = [];
        const weekHeaderCellA1s = [];
        const bannerRowA1s = [];
        const bannerCellA1s = [];

        for (let i = 0; i < numRows; i++) {
            const currRow = startRow + i;
            const fmt = rowFormats[i];
            if (fmt.type === 'WEEK_HEADER' || fmt.type === 'BANNER' || fmt.type === 'EMPTY') {
                nonTaskA1Ranges.push(`A${currRow}:J${currRow}`);
            }
            if (fmt.type === 'WEEK_HEADER') {
                weekHeaderCellA1s.push(`A${currRow}`);
            } else if (fmt.type === 'BANNER') {
                bannerRowA1s.push(`A${currRow}:J${currRow}`);
                bannerCellA1s.push(`A${currRow}`);
            }
        }

        // 1. Ghi dữ liệu vào Sheet (đã xóa sạch DataValidation cũ trước đó nên không bao giờ bị chặn)
        try {
            dataRange.setValues(allRowsToInsert);
        } catch (valErr) {
            Logger.log("Phát hiện xung đột DataValidation khi setValues, tự động xử lý: " + valErr.toString());
            dataRange.clearDataValidations();
            SpreadsheetApp.flush();
            dataRange.setValues(allRowsToInsert);
        }

        const hasStatusChip = statusTemplateRange !== null;

        // 2. Chuẩn bị ma trận định dạng (2D Arrays) để cập nhật hàng loạt trong 1 lần gọi
        const backgrounds = [];
        const fontColors = [];
        const fontWeights = [];
        const fontSizes = [];
        const fontFamilies = [];
        const horizontalAlignments = [];
        const wraps = [];

        for (let i = 0; i < numRows; i++) {
            const fmt = rowFormats[i];

            if (fmt.type === 'WEEK_HEADER') {
                // Hàng tiêu đề Tuần: Chữ Đỏ (#CC0000), In đậm, Cỡ 14, Không wrap để tràn ngang đẹp mắt
                backgrounds.push(["#FFFFFF", "#FFFFFF", "#FFFFFF", "#FFFFFF", "#FFFFFF", "#FFFFFF", "#FFFFFF", "#FFFFFF", "#FFFFFF", "#FFFFFF"]);
                fontColors.push(["#CC0000", "#000000", "#000000", "#000000", "#000000", "#000000", "#000000", "#000000", "#000000", "#000000"]);
                fontWeights.push(["bold", "normal", "normal", "normal", "normal", "normal", "normal", "normal", "normal", "normal"]);
                fontSizes.push([14, 10, 10, 10, 10, 10, 10, 10, 10, 10]);
                fontFamilies.push(["Arial", "Arial", "Arial", "Arial", "Arial", "Arial", "Arial", "Arial", "Arial", "Arial"]);
                horizontalAlignments.push(["left", "left", "center", "center", "center", "center", "center", "center", "center", "center"]);
                wraps.push([false, false, false, false, false, false, false, false, false, false]);
            } else if (fmt.type === 'BANNER') {
                // Hàng Banner Role riêng biệt: Nền Vàng (#FFE599) toàn dòng A:J, Chữ Đen In đậm ở Cột A
                backgrounds.push(["#FFE599", "#FFE599", "#FFE599", "#FFE599", "#FFE599", "#FFE599", "#FFE599", "#FFE599", "#FFE599", "#FFE599"]);
                fontColors.push(["#000000", "#000000", "#000000", "#000000", "#000000", "#000000", "#000000", "#000000", "#000000", "#000000"]);
                fontWeights.push(["bold", "normal", "normal", "normal", "normal", "normal", "normal", "normal", "normal", "normal"]);
                fontSizes.push([10, 10, 10, 10, 10, 10, 10, 10, 10, 10]);
                fontFamilies.push(["Arial", "Arial", "Arial", "Arial", "Arial", "Arial", "Arial", "Arial", "Arial", "Arial"]);
                horizontalAlignments.push(["left", "left", "center", "center", "center", "center", "center", "center", "center", "center"]);
                wraps.push([false, false, false, false, false, false, false, false, false, false]);
            } else if (fmt.type === 'TASK') {
                // Task row: Nếu Sheet chưa có Chip Status thì tô màu trực tiếp cho ô Status (Cột G)
                let statusBg = "#FFFFFF";
                let statusColor = "#000000";
                let statusWeight = "normal";
                if (!hasStatusChip) {
                    if (fmt.finalStatus === 'Done') {
                        statusBg = "#137333";
                        statusColor = "#FFFFFF";
                        statusWeight = "bold";
                    } else if (fmt.finalStatus === 'In Progress') {
                        statusBg = "#0B57D0";
                        statusColor = "#FFFFFF";
                        statusWeight = "bold";
                    } else {
                        statusBg = "#E5E7EB";
                        statusColor = "#374151";
                        statusWeight = "bold";
                    }
                }

                backgrounds.push(["#FFFFFF", "#FFFFFF", "#FFFFFF", "#FFFFFF", "#FFFFFF", "#FFFFFF", statusBg, "#FFFFFF", "#FFFFFF", "#FFFFFF"]);
                fontColors.push(["#000000", "#1E293B", "#334155", "#000000", "#0F172A", "#0F172A", statusColor, "#1E293B", "#000000", "#000000"]);
                fontWeights.push(["normal", fmt.isParent ? "bold" : "normal", "normal", "normal", "bold", "normal", statusWeight, "normal", "normal", "normal"]);
                fontSizes.push([10, 10, 10, 10, 10, 10, 10, 10, 10, 10]);
                fontFamilies.push(["Arial", "Arial", "Arial", "Arial", "Arial", "Arial", "Arial", "Arial", "Arial", "Arial"]);
                horizontalAlignments.push(["center", "left", "center", "center", "center", "center", "center", "center", "center", "center"]);
                wraps.push([false, true, false, false, false, false, false, false, false, false]);
            } else {
                // EMPTY row
                backgrounds.push(["#FFFFFF", "#FFFFFF", "#FFFFFF", "#FFFFFF", "#FFFFFF", "#FFFFFF", "#FFFFFF", "#FFFFFF", "#FFFFFF", "#FFFFFF"]);
                fontColors.push(["#000000", "#000000", "#000000", "#000000", "#000000", "#000000", "#000000", "#000000", "#000000", "#000000"]);
                fontWeights.push(["normal", "normal", "normal", "normal", "normal", "normal", "normal", "normal", "normal", "normal"]);
                fontSizes.push([10, 10, 10, 10, 10, 10, 10, 10, 10, 10]);
                fontFamilies.push(["Arial", "Arial", "Arial", "Arial", "Arial", "Arial", "Arial", "Arial", "Arial", "Arial"]);
                horizontalAlignments.push(["center", "left", "center", "center", "center", "center", "center", "center", "center", "center"]);
                wraps.push([false, false, false, false, false, false, false, false, false, false]);
            }
        }

        // 3. Thực thi gán định dạng màu sắc & font chữ hàng loạt TRƯỚC khi gán DataValidation
        dataRange.setBackgrounds(backgrounds);
        dataRange.setFontColors(fontColors);
        dataRange.setFontWeights(fontWeights);
        dataRange.setFontSizes(fontSizes);
        dataRange.setFontFamilies(fontFamilies);
        dataRange.setHorizontalAlignments(horizontalAlignments);
        dataRange.setWraps(wraps);

        // Kẻ viền cho toàn bộ dữ liệu
        dataRange.setBorder(true, true, true, true, true, true, "#E2E8F0", SpreadsheetApp.BorderStyle.SOLID);

        // Ép định dạng trực tiếp lần 2 trên RangeList cho các dòng Week Header & Role Banner để đảm bảo 100% hiển thị màu chuẩn
        if (weekHeaderCellA1s.length > 0) {
            for (let k = 0; k < weekHeaderCellA1s.length; k += 50) {
                const chunk = weekHeaderCellA1s.slice(k, k + 50);
                sheet.getRangeList(chunk)
                    .setFontColor("#CC0000")
                    .setFontWeight("bold")
                    .setFontSize(14)
                    .setFontFamily("Arial")
                    .setWrap(false);
            }
        }

        if (bannerRowA1s.length > 0) {
            for (let k = 0; k < bannerRowA1s.length; k += 50) {
                const chunkRows = bannerRowA1s.slice(k, k + 50);
                const chunkCells = bannerCellA1s.slice(k, k + 50);
                sheet.getRangeList(chunkRows).setBackground("#FFE599");
                sheet.getRangeList(chunkCells)
                    .setFontColor("#000000")
                    .setFontWeight("bold")
                    .setFontSize(10)
                    .setFontFamily("Arial")
                    .setWrap(false);
            }
        }

        // Flush ngay màu sắc và định dạng xuống Sheet
        SpreadsheetApp.flush();

        // 4. Gán Dropdown / Data Validation ĐỘNG (đã đồng bộ đầy đủ thành viên & role mới nhất từ Firebase DB)
        try {
            // Cột C (Role): Gán danh sách Role động từ DB + ROLE_ORDER
            sheet.getRange(startRow, 3, numRows, 1).setDataValidation(dynamicRoleValidation);

            // Cột G (Status): Sao chép Chip màu xanh/xám có sẵn (vì Status luôn chỉ có To do / In Progress / Done), hoặc dùng rule động
            if (statusTemplateRange !== null) {
                statusTemplateRange.copyTo(sheet.getRange(startRow, 7, numRows, 1), SpreadsheetApp.CopyPasteType.PASTE_DATA_VALIDATION, false);
            } else {
                sheet.getRange(startRow, 7, numRows, 1).setDataValidation(dynamicStatusValidation);
            }

            // Cột H (Account): Gán danh sách Thành viên động lấy trực tiếp từ Firebase DB (/users.json + /tasks.json) + danh sách cũ trên Sheet
            sheet.getRange(startRow, 8, numRows, 1).setDataValidation(dynamicAccountValidation);

            // Cập nhật luôn danh sách thành viên & role mới từ DB cho cả các dòng phía trên startRow (ví dụ Week 95)
            if (existingAccountCellsAboveStart.length > 0) {
                for (let k = 0; k < existingAccountCellsAboveStart.length; k += 50) {
                    const chunk = existingAccountCellsAboveStart.slice(k, k + 50);
                    sheet.getRangeList(chunk).setDataValidation(dynamicAccountValidation);
                }
            }
            if (existingRoleCellsAboveStart.length > 0) {
                for (let k = 0; k < existingRoleCellsAboveStart.length; k += 50) {
                    const chunk = existingRoleCellsAboveStart.slice(k, k + 50);
                    sheet.getRangeList(chunk).setDataValidation(dynamicRoleValidation);
                }
            }
        } catch (e) {
            Logger.log("Lỗi khi gán DataValidation động: " + e.toString());
        }

        // 5. Dọn sạch Dropdown/Khối thừa trên hàng Tiêu đề Tuần, Banner Role và Hàng trống
        if (nonTaskA1Ranges.length > 0) {
            for (let k = 0; k < nonTaskA1Ranges.length; k += 50) {
                const chunk = nonTaskA1Ranges.slice(k, k + 50);
                try {
                    sheet.getRangeList(chunk).clearDataValidations();
                } catch (e) {}
            }
        }

        // Dọn ô sao lưu tạm Z1 nếu có sử dụng
        if (usedBackupZ1) {
            try {
                sheet.getRange(1, 26).clearDataValidations();
            } catch (e) {}
        }

        // Flush hoàn tất toàn bộ thay đổi
        SpreadsheetApp.flush();
    }

    safeAlert(`✅ Đã đồng bộ hoàn tất! Tổng số tuần: ${sortedWeekKeys.length} tuần, tổng số dòng: ${numRows}.`);
}

/**
 * 3. Bật tự động đồng bộ ngầm sau mỗi 5 phút
 */
function setupAutoSyncTrigger() {
    const triggers = ScriptApp.getProjectTriggers();
    triggers.forEach(t => {
        if (t.getHandlerFunction() === 'syncTasksFormattedToSheet') {
            ScriptApp.deleteTrigger(t);
        }
    });

    ScriptApp.newTrigger('syncTasksFormattedToSheet')
        .timeBased()
        .everyMinutes(5)
        .create();

    safeAlert("⏰ Đã bật tự động đồng bộ ngầm mỗi 5 phút!");
}
