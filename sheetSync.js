/** =========================================================================
 * SAHO TASK SYSTEM - GOOGLE APPS SCRIPT SYNC TOOL
 * - Đồng bộ danh sách công việc từ Firebase DB (/tasks.json) vào Google Sheet
 * - Không ghi đè hay can thiệp vào Data Validation của Google Sheet để bảo tồn 100% kiểu "Khối" (Chip)
 * - Nghiệp vụ đồng bộ chuẩn xác:
 *   + Tuần 95 trở xuống (Tuần đã làm / báo cáo):
 *     - Thành viên đã nộp báo cáo / có tiến độ: Status = "Done", Effort = actualEffort thực tế.
 *     - Bỏ qua các task 0% & 0h vì đã được chuyển sang Tuần 96.
 *   + Tuần 96 trở đi (Tuần mới / tuần kế hoạch):
 *     - Tất cả task 0% tiến độ: Status = "To do", Effort = estimatedEffort (giờ ước tính est).
 *     - Tất cả task làm dở (>0% và <100%): Status = "In Progress", Effort = estimatedEffort (giờ ước tính est).
 *     - Task hoàn thành (100%): Status = "Done", Effort = estimatedEffort.
 * - Banner Tuần Chữ Đỏ + Banner Role Vàng + Cách 1 hàng trống giữa các nhân sự
 * ========================================================================= */

// Cấu hình URL Firebase Realtime Database
const FIREBASE_URL = "https://docugen-676bf-default-rtdb.asia-southeast1.firebasedatabase.app/gmm-task";
const SHEET_NAME = "Work Schedules";

// Thứ tự sắp xếp các Role theo chuẩn ưu tiên
const ROLE_ORDER = ['BA', 'Design', 'Designer', 'FE', 'BE', 'Dev', 'SA', 'QA', 'DevOps', 'PO', 'PM'];

function getRoleOrderIndex(roleName) {
    const index = ROLE_ORDER.findIndex(r => r.toLowerCase() === String(roleName || '').trim().toLowerCase());
    return index !== -1 ? index : 999;
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
 * 2. Hàm đồng bộ tất cả các tuần từ Firebase vào Google Sheet
 */
function syncTasksFormattedToSheet() {
    const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = spreadsheet.getSheetByName(SHEET_NAME) || spreadsheet.getSheets()[0];

    if (!sheet) {
        SpreadsheetApp.getUi().alert(`Không tìm thấy sheet "${SHEET_NAME}". Vui lòng kiểm tra lại tên sheet.`);
        return;
    }

    // A. Lấy danh sách Staff Code (Account) TRỰC TIẾP DỘNG từ Firebase DB /users.json
    let usersList = [];
    try {
        const userRes = UrlFetchApp.fetch(`${FIREBASE_URL}/users.json`);
        const userContent = userRes.getContentText();
        if (userContent && userContent !== 'null') {
            const usersData = JSON.parse(userContent);
            usersList = Object.values(usersData).filter(u => u && !u.disabled && u.status !== 'disabled');
        }
    } catch (err) {
        Logger.log("Chưa lấy được danh sách user: " + err.toString());
    }

    // B. Lấy dữ liệu Task từ Firebase RTDB /tasks.json
    let firebaseTasks = {};
    try {
        const response = UrlFetchApp.fetch(`${FIREBASE_URL}/tasks.json`);
        const content = response.getContentText();
        if (content && content !== 'null') {
            firebaseTasks = JSON.parse(content);
        }
    } catch (err) {
        SpreadsheetApp.getUi().alert("❌ Lỗi kết nối tới Firebase: " + err.toString());
        return;
    }

    const taskList = Object.values(firebaseTasks);
    if (taskList.length === 0) {
        SpreadsheetApp.getUi().alert("ℹ️ Chưa có Task nào trên Hệ thống.");
        return;
    }

    // C. Nhóm toàn bộ Task theo từng Tuần khác nhau (Tuần 95, Tuần 96...)
    const tasksByWeekAndRole = {};

    taskList.forEach(t => {
        const titleClean = String(t.title || '').trim();
        if (!titleClean) return;

        const rawWeek = Number(t.weekNumber) || 38;
        // Task weekNumber trên hệ thống Saho đã là số tuần cộng dồn (VD: 93, 94, 95, 96). Nếu <= 53 mới cần + 55.
        const sahoWeekNum = rawWeek > 50 ? rawWeek : rawWeek + 55;
        
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
            let r = (roleName || 'BA').trim();
            if (r.toLowerCase() === 'designer') r = 'Design';
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

                // Xác định role phù hợp cho thành viên Collab này
                let targetRole = t.role;
                for (let r of supRoles) {
                    const matched = ROLE_ORDER.find(ro => ro.toLowerCase() === r.toLowerCase() || (ro === 'Design' && r.toLowerCase() === 'designer'));
                    if (matched) {
                        targetRole = matched;
                        break;
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
        SpreadsheetApp.getUi().alert("ℹ️ Không có task nào từ Tuần 95 trở đi để đồng bộ.");
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

    // E. Xây dựng toàn bộ các dòng dữ liệu và định dạng cho TẤT CẢ các tuần thành một khối liền mạch
    const allRowsToInsert = [];
    const rowFormats = [];

    sortedWeekKeys.forEach((weekHeaderKey, wIdx) => {
        const weekData = tasksByWeekAndRole[weekHeaderKey];
        const rolesMap = weekData.roles;
        const isPastWeek = weekData.sahoWeekNum < 96;

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

                // Nếu là tuần cũ đã kết thúc / đã chốt (Tuần 95 trở xuống):
                // Bỏ qua các task 0% tiến độ & 0h effort vì chúng đã được chuyển tiếp sang Tuần 96!
                const filteredTasks = Array.from(personTasksMap.values()).filter(t => {
                    if (!isPastWeek) return true; // Tuần 96+: giữ nguyên toàn bộ (bao gồm cả task 0% kế thừa)
                    const rawPct = (t.completionPercentage !== undefined && t.completionPercentage !== null) ? Number(t.completionPercentage) : 0;
                    const effort = Number(t.actualEffort) || 0;
                    const isUnworked = rawPct === 0 && effort === 0 && t.status !== 'Done';
                    return !isUnworked; // Chỉ giữ task có tiến độ hoặc đã làm ở tuần cũ
                });

                if (filteredTasks.length > 0) {
                    validAssignees.push({ accName, tasks: filteredTasks });
                }
            });

            // Nếu role này không có task nào thì bỏ qua banner
            if (validAssignees.length === 0) return;

            // DUY NHẤT 1 DÒNG Banner Vàng Role (#FFE599)
            allRowsToInsert.push([bannerName, "", "", "", "", "", "", "", "", ""]);
            rowFormats.push({ type: 'BANNER', name: bannerName });

            validAssignees.forEach((assigneeItem, accIdx) => {
                const { accName, tasks: personTasks } = assigneeItem;

                personTasks.forEach(t => {
                    const rawPct = (t.completionPercentage !== undefined && t.completionPercentage !== null)
                        ? Number(t.completionPercentage)
                        : 0;

                    const isWeek96OrFuture = weekData.sahoWeekNum >= 96;

                    let finalStatus = "To do";
                    let effortVal = 0;
                    let pctStr = `${rawPct}%`;

                    if (isWeek96OrFuture) {
                        // ==========================================
                        // TUẦN 96+: Tuần mới / tuần kế hoạch chưa làm
                        // ==========================================
                        // 1. Task 0% tiến độ -> Status "To do"
                        // 2. Task làm dở (>0% và <100%) -> Status "In Progress"
                        // 3. Task hoàn thành (100%) -> Status "Done"
                        // Effort: Lấy theo giờ ước tính (estimatedEffort) được define cho tuần mới
                        if (rawPct > 0 && rawPct < 100) {
                            finalStatus = "In Progress";
                        } else if (rawPct >= 100) {
                            finalStatus = "Done";
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
                    } else {
                        // ==========================================
                        // TUẦN 95 TRỞ XUỐNG: Tuần đã làm / đã báo cáo
                        // ==========================================
                        finalStatus = "Done";
                        if (t.memberEfforts && typeof t.memberEfforts === 'object' && Object.keys(t.memberEfforts).length > 0) {
                            effortVal = t.memberEfforts[accName] !== undefined ? (Number(t.memberEfforts[accName]) || 0) : 0;
                        } else {
                            effortVal = Number(t.actualEffort) || 0;
                        }
                    }

                    allRowsToInsert.push([
                        "",                      // Col A (1): Trống (Bỏ STT)
                        t.title,                 // Col B (2): Tên Task
                        t.role || bannerName,    // Col C (3): Role
                        "",                      // Col D (4): Trống
                        pctStr,                  // Col E (5): Phần trăm công việc (%)
                        effortVal,               // Col F (6): Effort (Số giờ làm)
                        finalStatus,             // Col G (7): Status
                        accName,                 // Col H (8): Account
                        "",                      // Col I (9): Trống
                        ""                       // Col J (10): Trống
                    ]);
                    rowFormats.push({ type: 'TASK', task: t, finalStatus: finalStatus, accName: accName, role: t.role || bannerName });
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

    // F. Làm sạch nội dung cũ từ startRow đến cuối Sheet
    // TUYỆT ĐỐI KHÔNG GỌI clearDataValidations() để bảo tồn nguyên vẹn quy tắc Khối (Chip) trên Google Sheet!
    lastRow = sheet.getLastRow();
    if (lastRow >= startRow) {
        const rowsToClear = lastRow - startRow + 1;
        const clearRange = sheet.getRange(startRow, 1, rowsToClear, 10);
        clearRange.clearContent();
        clearRange.clearFormat();
    }

    // G. Ghi toàn bộ dữ liệu liền mạch từ startRow & Áp dụng định dạng hàng loạt
    const numRows = allRowsToInsert.length;
    if (numRows > 0) {
        const dataRange = sheet.getRange(startRow, 1, numRows, 10);
        dataRange.setValues(allRowsToInsert);

        // Chuẩn bị ma trận định dạng (2D Arrays) để cập nhật hàng loạt trong 1 lần gọi (Cực nhanh)
        const backgrounds = [];
        const fontColors = [];
        const fontWeights = [];
        const fontSizes = [];
        const fontFamilies = [];
        const horizontalAlignments = [];

        for (let i = 0; i < numRows; i++) {
            const fmt = rowFormats[i];

            if (fmt.type === 'WEEK_HEADER') {
                backgrounds.push(["#FFFFFF", "#FFFFFF", "#FFFFFF", "#FFFFFF", "#FFFFFF", "#FFFFFF", "#FFFFFF", "#FFFFFF", "#FFFFFF", "#FFFFFF"]);
                fontColors.push(["#CC0000", "#000000", "#000000", "#000000", "#000000", "#000000", "#000000", "#000000", "#000000", "#000000"]);
                fontWeights.push(["bold", "normal", "normal", "normal", "normal", "normal", "normal", "normal", "normal", "normal"]);
                fontSizes.push([14, 10, 10, 10, 10, 10, 10, 10, 10, 10]);
                fontFamilies.push(["Arial", "Arial", "Arial", "Arial", "Arial", "Arial", "Arial", "Arial", "Arial", "Arial"]);
                horizontalAlignments.push(["left", "left", "center", "center", "center", "center", "center", "center", "center", "center"]);
            } else if (fmt.type === 'BANNER') {
                backgrounds.push(["#FFE599", "#FFE599", "#FFE599", "#FFE599", "#FFE599", "#FFE599", "#FFE599", "#FFE599", "#FFE599", "#FFE599"]);
                fontColors.push(["#000000", "#000000", "#000000", "#000000", "#000000", "#000000", "#000000", "#000000", "#000000", "#000000"]);
                fontWeights.push(["bold", "normal", "normal", "normal", "normal", "normal", "normal", "normal", "normal", "normal"]);
                fontSizes.push([10, 10, 10, 10, 10, 10, 10, 10, 10, 10]);
                fontFamilies.push(["Arial", "Arial", "Arial", "Arial", "Arial", "Arial", "Arial", "Arial", "Arial", "Arial"]);
                horizontalAlignments.push(["left", "left", "center", "center", "center", "center", "center", "center", "center", "center"]);
            } else if (fmt.type === 'TASK') {
                // Task row: Nền sạch (#FFFFFF) để Chip hiển thị dạng pill nổi bật
                backgrounds.push(["#FFFFFF", "#FFFFFF", "#FFFFFF", "#FFFFFF", "#FFFFFF", "#FFFFFF", "#FFFFFF", "#FFFFFF", "#FFFFFF", "#FFFFFF"]);
                fontColors.push(["#000000", "#1E293B", "#334155", "#000000", "#0F172A", "#0F172A", "#000000", "#1E293B", "#000000", "#000000"]);
                fontWeights.push(["normal", "normal", "normal", "normal", "bold", "normal", "normal", "normal", "normal", "normal"]);
                fontSizes.push([10, 10, 10, 10, 10, 10, 10, 10, 10, 10]);
                fontFamilies.push(["Arial", "Arial", "Arial", "Arial", "Arial", "Arial", "Arial", "Arial", "Arial", "Arial"]);
                horizontalAlignments.push(["center", "left", "center", "center", "center", "center", "center", "center", "center", "center"]);
            } else {
                // EMPTY row
                backgrounds.push(["#FFFFFF", "#FFFFFF", "#FFFFFF", "#FFFFFF", "#FFFFFF", "#FFFFFF", "#FFFFFF", "#FFFFFF", "#FFFFFF", "#FFFFFF"]);
                fontColors.push(["#000000", "#000000", "#000000", "#000000", "#000000", "#000000", "#000000", "#000000", "#000000", "#000000"]);
                fontWeights.push(["normal", "normal", "normal", "normal", "normal", "normal", "normal", "normal", "normal", "normal"]);
                fontSizes.push([10, 10, 10, 10, 10, 10, 10, 10, 10, 10]);
                fontFamilies.push(["Arial", "Arial", "Arial", "Arial", "Arial", "Arial", "Arial", "Arial", "Arial", "Arial"]);
                horizontalAlignments.push(["center", "left", "center", "center", "center", "center", "center", "center", "center", "center"]);
            }
        }

        // Thực thi gán định dạng hàng loạt (Không can thiệp vào Data Validation)
        dataRange.setBackgrounds(backgrounds);
        dataRange.setFontColors(fontColors);
        dataRange.setFontWeights(fontWeights);
        dataRange.setFontSizes(fontSizes);
        dataRange.setFontFamilies(fontFamilies);
        dataRange.setHorizontalAlignments(horizontalAlignments);
        dataRange.setWrap(true);

        // Kẻ viền cho toàn bộ dữ liệu
        dataRange.setBorder(true, true, true, true, true, true, "#E2E8F0", SpreadsheetApp.BorderStyle.SOLID);

        // H. Tự động dọn sạch triệt để các Dropdown/Khối thừa trên hàng Tiêu đề Tuần, Banner Role và Hàng trống
        const nonTaskA1Ranges = [];
        for (let i = 0; i < numRows; i++) {
            const currRow = startRow + i;
            const fmt = rowFormats[i];
            if (fmt.type === 'WEEK_HEADER' || fmt.type === 'BANNER' || fmt.type === 'EMPTY') {
                nonTaskA1Ranges.push(`A${currRow}:J${currRow}`);
            }
        }

        if (nonTaskA1Ranges.length > 0) {
            // Xử lý theo từng nhóm 50 dải ô để xóa sạch Dropdown thừa ngay lập tức
            for (let k = 0; k < nonTaskA1Ranges.length; k += 50) {
                const chunk = nonTaskA1Ranges.slice(k, k + 50);
                sheet.getRangeList(chunk).clearDataValidations();
            }
        }
    }

    SpreadsheetApp.getUi().alert(`✅ Đã đồng bộ hoàn tất! Tổng số tuần: ${sortedWeekKeys.length} tuần, tổng số dòng: ${numRows}.\nĐã tự động xóa sạch các khối thừa trên hàng Banner và hàng trống!`);
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

    SpreadsheetApp.getUi().alert("⏰ Đã bật tự động đồng bộ ngầm mỗi 5 phút!");
}
