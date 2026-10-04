/** =========================================================================
 * SAHO TASK SYSTEM - GOOGLE APPS SCRIPT SYNC TOOL (DYNAMIC ACCOUNTS & COLOR CHIPS)
 * - Tự động lấy danh sách Staff Code (Account) TRỰC TIẾP từ Firebase DB (/users.json)
 * - Tự động màu sắc ô Status (Cột G):
 *   + "Done": Xanh lá (#137333), Chữ trắng
 *   + "In Progress": Xanh biển (#0B57D0), Chữ trắng
 *   + "To do": Xám (#E5E7EB), Chữ đậm (#374151)
 * - Nghiệp vụ đồng bộ chuẩn xác:
 *   + Tuần 95 trở xuống (Tuần đã làm / báo cáo):
 *     - Thành viên đã nộp báo cáo / có tiến độ: Status = "Done", Effort = actualEffort thực tế.
 *     - Task 0% tiến độ (chưa làm): Effort = 0, Status = "To do".
 *   + Tuần 96 trở đi (Tuần mới / tuần kế hoạch):
 *     - Tất cả task 0% tiến độ: Status = "To do", Effort = 0.
 *     - Tất cả task làm dở (>0% và <100%): Status = "In Progress", Effort = 0.
 *     - Tuyệt đối không có task nào là "Done" ở Tuần 96.
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
        .addItem('🔄 Đồng bộ Tất Cả Các Tuần (Color Status Chips + Dynamic DB)', 'syncTasksFormattedToSheet')
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
 * 2. Hàm đồng bộ tất cả các tuần từ Firebase vào Google Sheet (Color Chips Status)
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
    let userAccounts = [];
    try {
        const userRes = UrlFetchApp.fetch(`${FIREBASE_URL}/users.json`);
        const userContent = userRes.getContentText();
        if (userContent && userContent !== 'null') {
            const usersData = JSON.parse(userContent);
            usersList = Object.values(usersData).filter(u => u && !u.disabled && u.status !== 'disabled');
            userAccounts = usersList
                .map(u => (u && u.account) ? String(u.account).trim() : '')
                .filter(Boolean);
        }
    } catch (err) {
        Logger.log("Chưa lấy được danh sách user: " + err.toString());
    }

    userAccounts = Array.from(new Set(userAccounts)).sort();
    if (userAccounts.length === 0) {
        userAccounts = ['Chưa phân công'];
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

    // Quy tắc Dropdown Linh Hoạt
    const roleValidation = SpreadsheetApp.newDataValidation()
        .requireValueInList(ROLE_ORDER, true)
        .setAllowInvalid(true)
        .build();

    const statusValidation = SpreadsheetApp.newDataValidation()
        .requireValueInList(['To do', 'In Progress', 'Done'], true)
        .setAllowInvalid(true)
        .build();

    const accountValidation = SpreadsheetApp.newDataValidation()
        .requireValueInList(userAccounts, true)
        .setAllowInvalid(true)
        .build();

    // C. Nhóm toàn bộ Task theo từng Tuần khác nhau (Tuần 93, Tuần 94, Tuần 95, Tuần 96...)
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

    // Sắp xếp các Tuần theo thứ tự tăng dần (Tuần 93 -> Tuần 94 -> Tuần 95 -> Tuần 96...)
    const sortedWeekKeys = Object.keys(tasksByWeekAndRole).sort((a, b) => {
        return tasksByWeekAndRole[a].sahoWeekNum - tasksByWeekAndRole[b].sahoWeekNum;
    });

    // D. Xử lý đồng bộ cho từng Tuần
    let totalWeeksProcessed = 0;

    sortedWeekKeys.forEach(weekHeaderKey => {
        const weekData = tasksByWeekAndRole[weekHeaderKey];
        const rolesMap = weekData.roles;

        // 1. Quét tìm xem Tuần này đã có vị trí trên Sheet chưa (Tìm chính xác "Week X" từ DƯỚI LÊN TRÊN)
        let lastRow = sheet.getLastRow();
        let weekRowIdx = -1;

        if (lastRow >= 1) {
            const colAValues = sheet.getRange(1, 1, lastRow, 1).getValues();
            for (let r = colAValues.length - 1; r >= 0; r--) {
                const val = String(colAValues[r][0] || '').trim();
                // Khớp chính xác tiêu đề "Week 93", "Week 94", "Week 95", "Week 96"...
                if (new RegExp(`^Week\\s+${weekData.sahoWeekNum}\\b`, 'i').test(val)) {
                    weekRowIdx = r + 1;
                    break;
                }
            }
        }

        // Nếu chưa có Tuần này trong Sheet (VD: Tuần 96 mới) -> Thêm ở cuối bảng tính
        if (weekRowIdx === -1) {
            weekRowIdx = sheet.getLastRow() + 1;
            if (weekRowIdx === 1) weekRowIdx = 2;
        }

        // Ghi tiêu đề Tuần Chữ Đỏ (VD: Week 95 (28/09-04/10), Week 96 (05/10-11/10))
        const weekCell = sheet.getRange(weekRowIdx, 1);
        weekCell.setValue(weekData.headerText);
        weekCell.setFontWeight("bold").setFontColor("#CC0000").setFontSize(14).setFontFamily("Arial");

        // 2. Dựng các hàng dữ liệu cho Tuần này
        const allRowsToInsert = [];
        const rowFormats = [];

        const sortedRoles = Object.keys(rolesMap).sort((a, b) => getRoleOrderIndex(a) - getRoleOrderIndex(b));

        sortedRoles.forEach(bannerName => {
            const tasksInRole = rolesMap[bannerName];
            if (!tasksInRole || tasksInRole.length === 0) return;

            // Banner Vàng Role (#FFE599)
            allRowsToInsert.push([bannerName, "", "", "", "", "", "", "", "", ""]);
            rowFormats.push({ type: 'BANNER', name: bannerName });

            // Nhóm Task theo Assignee / SyncAccount
            const tasksByAssignee = {};
            tasksInRole.forEach(t => {
                const acc = (t.syncAccount || t.assigneeAccount || 'Chưa phân công').trim();
                if (!tasksByAssignee[acc]) tasksByAssignee[acc] = [];
                tasksByAssignee[acc].push(t);
            });

            // Sắp xếp thứ tự các thành viên theo cấp bậc (Leader/Advisor trước) rồi đến bảng chữ cái
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

            assignees.forEach((accName, accIdx) => {
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
                const personTasks = Array.from(personTasksMap.values());

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
                        // 1. Task 0% tiến độ -> Status "To do", Effort = 0
                        // 2. Task làm dở (>0% và <100%) -> Status "In Progress", Effort = 0
                        // 3. Tuyệt đối không có task nào là "Done"
                        if (rawPct > 0 && rawPct < 100) {
                            finalStatus = "In Progress";
                        } else {
                            finalStatus = "To do";
                        }
                        effortVal = 0;
                    } else {
                        // ==========================================
                        // TUẦN 95 TRỞ XUỐNG: Tuần đã làm / đã báo cáo
                        // ==========================================
                        if (rawPct === 0) {
                            // Task 0% tiến độ: Effort luôn là 0 (để khi chốt tuần sẽ chuyển sang tuần sau)
                            effortVal = 0;
                            finalStatus = "To do";
                        } else {
                            // Task có tiến độ > 0%:
                            // Ai đã làm và nộp báo cáo tuần -> Status là "Done"
                            finalStatus = "Done";
                            effortVal = Number(t.actualEffort) || 0;
                        }
                    }

                    allRowsToInsert.push([
                        "",                      // Col A (1): Trống (Bỏ STT)
                        t.title,                 // Col B (2): Tên Task
                        t.role || bannerName,    // Col C (3): Role
                        "",                      // Col D (4): Trống
                        pctStr,                  // Col E (5): Phần trăm công việc (%)
                        effortVal,               // Col F (6): Effort (Số giờ làm thực tế)
                        finalStatus,             // Col G (7): Status ("Done", "In Progress", "To do")
                        accName,                 // Col H (8): Account (Được gán chính xác theo thành viên bao gồm cả Collab!)
                        "",                      // Col I (9): Trống
                        ""                       // Col J (10): Trống
                    ]);
                    rowFormats.push({ type: 'TASK', task: t, finalStatus: finalStatus });
                });

                // Hàng trống phân cách 2 người khác nhau
                if (accIdx < assignees.length - 1) {
                    allRowsToInsert.push(["", "", "", "", "", "", "", "", "", ""]);
                    rowFormats.push({ type: 'EMPTY' });
                }
            });
        });

        // 3. Làm sạch phạm vi của riêng Tuần này và ghi lại dữ liệu mới
        const dataStartRow = weekRowIdx + 1;
        let nextWeekRowIdx = -1;
        lastRow = sheet.getLastRow();

        if (lastRow > weekRowIdx) {
            const colAValues = sheet.getRange(weekRowIdx + 1, 1, lastRow - weekRowIdx, 1).getValues();
            for (let r = 0; r < colAValues.length; r++) {
                const val = String(colAValues[r][0] || '').trim();
                if (/^Week\s+\d+/i.test(val)) {
                    nextWeekRowIdx = weekRowIdx + 1 + r;
                    break;
                }
            }
        }

        const rowsToClear = (nextWeekRowIdx !== -1) ? (nextWeekRowIdx - dataStartRow) : (sheet.getLastRow() - weekRowIdx);

        if (rowsToClear > 0) {
            const currentWeekRange = sheet.getRange(dataStartRow, 1, rowsToClear, 10);
            currentWeekRange.clearContent();
            currentWeekRange.clearFormat();
            currentWeekRange.clearDataValidations();
        }

        if (allRowsToInsert.length > 0) {
            const dataRange = sheet.getRange(dataStartRow, 1, allRowsToInsert.length, 10);
            dataRange.setValues(allRowsToInsert);

            // Định dạng dòng & Tô màu sắc Nổi bật cho Status Chip (Cột G)
            for (let i = 0; i < rowFormats.length; i++) {
                const currRow = dataStartRow + i;
                const fmt = rowFormats[i];

                if (fmt.type === 'BANNER') {
                    const bannerRange = sheet.getRange(currRow, 1, 1, 10);
                    bannerRange.setBackground("#FFE599");
                    sheet.getRange(currRow, 1).setFontWeight("bold").setFontColor("#000000").setFontSize(10).setFontFamily("Arial");
                } else if (fmt.type === 'TASK') {
                    const taskRange = sheet.getRange(currRow, 1, 1, 10);
                    sheet.getRange(currRow, 3).setDataValidation(roleValidation);
                    sheet.getRange(currRow, 7).setDataValidation(statusValidation);
                    sheet.getRange(currRow, 8).setDataValidation(accountValidation);

                    // Căn lề
                    sheet.getRange(currRow, 2).setHorizontalAlignment("left").setWrap(true).setFontFamily("Arial");
                    sheet.getRange(currRow, 3).setHorizontalAlignment("center");
                    sheet.getRange(currRow, 5, 1, 4).setHorizontalAlignment("center"); // Căn giữa Col E (%), Col F (Effort), Col G (Status), Col H (Account)

                    // TÔ MÀU SẮC CHO Ô STATUS (CỘT G):
                    const statusCell = sheet.getRange(currRow, 7);
                    const stVal = fmt.finalStatus || (fmt.task ? fmt.task.status : "To do");
                    if (stVal === 'Done') {
                        statusCell.setBackground("#137333").setFontColor("#FFFFFF").setFontWeight("bold"); // Xanh lá
                    } else if (stVal === 'In Progress') {
                        statusCell.setBackground("#0B57D0").setFontColor("#FFFFFF").setFontWeight("bold"); // Xanh biển
                    } else {
                        statusCell.setBackground("#E5E7EB").setFontColor("#374151").setFontWeight("bold"); // Xám
                    }

                    taskRange.setBorder(true, true, true, true, true, true, "#E2E8F0", SpreadsheetApp.BorderStyle.SOLID);
                } else if (fmt.type === 'EMPTY') {
                    sheet.getRange(currRow, 1, 1, 10).setBackground(null);
                }
            }

            // THÊM ĐỊNH DẠNG ĐIỀU KIỆN (CONDITIONAL FORMATTING) CHO CỘT STATUS (CỘT G)
            const statusRange = sheet.getRange(dataStartRow, 7, allRowsToInsert.length, 1);
            const rules = sheet.getConditionalFormatRules();

            const ruleDone = SpreadsheetApp.newConditionalFormatRule()
                .whenTextEqualTo("Done")
                .setBackground("#137333")
                .setFontColor("#FFFFFF")
                .setBold(true)
                .setRanges([statusRange])
                .build();

            const ruleInProgress = SpreadsheetApp.newConditionalFormatRule()
                .whenTextEqualTo("In Progress")
                .setBackground("#0B57D0")
                .setFontColor("#FFFFFF")
                .setBold(true)
                .setRanges([statusRange])
                .build();

            const ruleToDo = SpreadsheetApp.newConditionalFormatRule()
                .whenTextEqualTo("To do")
                .setBackground("#E5E7EB")
                .setFontColor("#374151")
                .setBold(true)
                .setRanges([statusRange])
                .build();

            rules.push(ruleDone, ruleInProgress, ruleToDo);
            sheet.setConditionalFormatRules(rules);
        }

        totalWeeksProcessed++;
    });

    SpreadsheetApp.getUi().alert(`✅ Đã đồng bộ hoàn tất! Số tuần đã xử lý: ${totalWeeksProcessed}`);
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
