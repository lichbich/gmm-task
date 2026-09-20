/** =========================================================================
 * SAHO TASK SYSTEM - GOOGLE APPS SCRIPT SYNC TOOL (DYNAMIC ACCOUNTS & COLOR CHIPS)
 * - Tự động lấy danh sách Staff Code (Account) TRỰC TIẾP từ Firebase DB (/users.json)
 * - Tự động màu sắc ô Status (Cột G):
 *   + "Done": Xanh lá (#137333), Chữ trắng
 *   + "In Progress": Xanh biển (#0B57D0), Chữ trắng
 *   + "To do": Xám (#E5E7EB), Chữ đậm
 * - Tự động tính toán & quản lý số Tuần chuẩn (VD: Week 93 (14/09-20/09), Week 94 (21/09-27/09)...)
 * - Banner Tuần Chữ Đỏ + Banner Role Vàng + Cách 1 hàng trống giữa các nhân sự
 * ========================================================================= */

// Cấu hình URL Firebase Realtime Database
const FIREBASE_URL = "https://docugen-676bf-default-rtdb.asia-southeast1.firebasedatabase.app/gmm-task";
const SHEET_NAME = "Work Schedules";

// Thứ tự sắp xếp các Role theo chuẩn ưu tiên
const ROLE_ORDER = ['BA', 'Design', 'Designer', 'FE', 'BE', 'Dev', 'SA', 'QA', 'DevOps'];

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
    let userAccounts = [];
    try {
        const userRes = UrlFetchApp.fetch(`${FIREBASE_URL}/users.json`);
        const userContent = userRes.getContentText();
        if (userContent && userContent !== 'null') {
            const usersData = JSON.parse(userContent);
            userAccounts = Object.values(usersData)
                .filter(u => u && !u.disabled && u.status !== 'disabled')
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

    // C. Nhóm toàn bộ Task theo từng Tuần khác nhau (Tuần 93, Tuần 94, Tuần 95...)
    const tasksByWeekAndRole = {};

    taskList.forEach(t => {
        const titleClean = String(t.title || '').trim();
        if (!titleClean) return;

        // Chỉ đồng bộ các công việc ĐÃ ĐƯỢC PHÂN CÔNG (Có người phụ trách / assigneeAccount)
        const assignee = (t.assigneeAccount || '').trim();
        if (!assignee) return;

        const rawWeek = Number(t.weekNumber) || 38;
        // Task weekNumber trên hệ thống Saho đã là số tuần cộng dồn (VD: 93, 94). Nếu <= 53 mới cần + 55.
        const sahoWeekNum = rawWeek > 50 ? rawWeek : rawWeek + 55;
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

        const roleCode = (t.role || 'BA').trim();
        if (!tasksByWeekAndRole[weekHeaderKey].roles[roleCode]) {
            tasksByWeekAndRole[weekHeaderKey].roles[roleCode] = [];
        }

        tasksByWeekAndRole[weekHeaderKey].roles[roleCode].push(t);
    });

    // Sắp xếp các Tuần theo thứ tự tăng dần (Tuần 93 -> Tuần 94 -> Tuần 95...)
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
                // Khớp chính xác tiêu đề "Week 93", "Week 94"...
                if (new RegExp(`^Week\\s+${weekData.sahoWeekNum}\\b`, 'i').test(val)) {
                    weekRowIdx = r + 1;
                    break;
                }
            }
        }

        // Nếu chưa có Tuần này trong Sheet (VD: Tuần 94 mới) -> Thêm ở cuối bảng tính
        if (weekRowIdx === -1) {
            weekRowIdx = sheet.getLastRow() + 1;
            if (weekRowIdx === 1) weekRowIdx = 2;
        }

        // Ghi tiêu đề Tuần Chữ Đỏ (VD: Week 93 (14/09-20/09), Week 94 (21/09-27/09))
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

            // Nhóm Task theo Assignee
            const tasksByAssignee = {};
            tasksInRole.forEach(t => {
                const acc = (t.assigneeAccount || 'Chưa phân công').trim();
                if (!tasksByAssignee[acc]) tasksByAssignee[acc] = [];
                tasksByAssignee[acc].push(t);
            });

            const assignees = Object.keys(tasksByAssignee);

            assignees.forEach((accName, accIdx) => {
                const personTasks = tasksByAssignee[accName];

                personTasks.forEach(t => {
                    const currentSahoWeek = getCurrentSahoWeekNum();
                    const isFutureWeek = weekData.sahoWeekNum > currentSahoWeek;
                    const isReported = !!t.lastSubmittedAt || t.status === 'Done';

                    let finalStatus = "To do";
                    let pctStr = "";

                    if (isFutureWeek) {
                        // Task thuộc tuần tới (Week 94+): Luôn ở trạng thái To do
                        finalStatus = "To do";
                        if (t.completionPercentage !== undefined && t.completionPercentage !== null && Number(t.completionPercentage) > 0) {
                            pctStr = `${t.completionPercentage}%`;
                        }
                    } else {
                        // Task thuộc tuần hiện tại / quá khứ (Week 93 trở xuống):
                        if (isReported) {
                            // Đã nộp báo cáo tuần này -> Đánh 'Done' trên Sheet
                            finalStatus = "Done";
                        } else {
                            finalStatus = t.status || "To do";
                        }

                        // Lấy % tiến độ thực tế từ hệ thống (0%, 50%, 100%...)
                        const comp = (t.completionPercentage !== undefined && t.completionPercentage !== null)
                            ? Number(t.completionPercentage)
                            : (isReported ? 100 : 0);
                        
                        pctStr = `${comp}%`;
                    }

                    // Số giờ làm (Col F)
                    const effortVal = (t.actualEffort !== undefined && t.actualEffort !== null && t.actualEffort > 0)
                        ? t.actualEffort
                        : (t.estimatedEffort || 0);

                    allRowsToInsert.push([
                        "",                      // Col A (1): Trống (Bỏ STT)
                        t.title,                 // Col B (2): Tên Task
                        t.role || bannerName,    // Col C (3): Role
                        "",                      // Col D (4): Trống
                        pctStr,                  // Col E (5): Phần trăm công việc (%) (ô trước số giờ làm)
                        effortVal,               // Col F (6): Effort (Số giờ làm)
                        finalStatus,             // Col G (7): Status ("Done", "In Progress", "To do")
                        t.assigneeAccount || "", // Col H (8): Account
                        "",                      // Col I (9): Trống
                        ""                       // Col J (10): Bỏ số 0
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
