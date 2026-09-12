/* ==========================================================================
   هسته اصلی مدیریت وضعیت، تعاملات و فیلترهای سامانه انتخاب واحد
   Main Application Logic, State & Advanced Filters
   ========================================================================== */

const presetColors = [
    "#4f46e5", "#059669", "#ea580c", "#7c3aed",
    "#2563eb", "#db2777", "#0891b2", "#dc2626", "#475569"
];

const dayOrderMap = {
    "شنبه": 1, "یک‌شنبه": 2, "دوشنبه": 3,
    "سه‌شنبه": 4, "چهارشنبه": 5, "پنج‌شنبه": 6
};

// وضعیت برنامه - به صورت پیش‌فرض خالی شروع می‌شود تا کاربر خودش دروس را بچیند
let courseList = [];
let currentSearchTerm = "";
let isWideMode = false;
let toastTimer = null;
let confirmAction = null;
let workloadChart = null;
let timeSlotsChart = null;

// فیلترهای پیشرفته بانک دروس
const bankFilters = {
    keyword: "",
    gender: "all",           // 'all' | 'مرد' | 'زن'
    days: new Set(),         // مجموعه روزهای انتخاب شده (خالی = همه روزها)
    timeSlot: "all",         // 'all' | 'morning' | 'noon' | 'evening' | 'custom'
    customStartTime: "07:30",
    customEndTime: "19:30",
    onlyNoConflict: false    // فقط دروس بدون تداخل با برنامه من
};

/**
 * راه‌اندازی اولیه برنامه
 */
function appInit() {
    setupColorPicker();
    setupDayFilterButtons();
    loadPersistedData();
    setupDragAndDrop();
    refreshViews();
    searchBankCourses();
}

/**
 * ایجاد پالت رنگی برای فرم افزودن دستی
 */
function setupColorPicker() {
    const picker = document.getElementById("palettePicker");
    if (!picker) return;
    picker.innerHTML = "";

    presetColors.forEach((color, idx) => {
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = `w-7 h-7 rounded-full border-2 transition-all shadow-sm outline-none ${idx === 0 ? 'border-slate-800 scale-110 shadow-md ring-2 ring-indigo-300' : 'border-transparent hover:scale-110'}`;
        btn.style.backgroundColor = color;
        btn.onclick = () => {
            Array.from(picker.children).forEach(b => {
                b.className = `w-7 h-7 rounded-full border-2 transition-all shadow-sm outline-none border-transparent hover:scale-110`;
            });
            btn.className = `w-7 h-7 rounded-full border-2 transition-all shadow-md outline-none border-slate-800 scale-110 ring-2 ring-indigo-300`;
            document.getElementById("fieldColor").value = color;
        };
        picker.appendChild(btn);
    });
}

/**
 * ایجاد دکمه‌های فیلتر چندگانه روزهای هفته
 */
function setupDayFilterButtons() {
    const container = document.getElementById("dayFilterButtonsContainer");
    if (!container) return;
    container.innerHTML = "";

    const days = ["شنبه", "یک‌شنبه", "دوشنبه", "سه‌شنبه", "چهارشنبه", "پنج‌شنبه"];
    days.forEach(day => {
        const btn = document.createElement("button");
        btn.type = "button";
        btn.id = `filterDay_${day}`;
        btn.className = "day-chip px-2.5 py-1 text-xs font-bold rounded-lg border border-slate-200 bg-slate-100 text-slate-700 hover:bg-slate-200 transition-all";
        btn.innerText = day;
        btn.onclick = () => toggleDayFilter(day);
        container.appendChild(btn);
    });
}

/**
 * سوئیچ فیلتر روز هفته
 */
function toggleDayFilter(day) {
    if (bankFilters.days.has(day)) {
        bankFilters.days.delete(day);
    } else {
        bankFilters.days.add(day);
    }
    updateDayFilterUI();
    searchBankCourses();
}

/**
 * به‌روزرسانی ظاهر دکمه‌های فیلتر روز
 */
function updateDayFilterUI() {
    const days = ["شنبه", "یک‌شنبه", "دوشنبه", "سه‌شنبه", "چهارشنبه", "پنج‌شنبه"];
    days.forEach(day => {
        const btn = document.getElementById(`filterDay_${day}`);
        if (!btn) return;
        if (bankFilters.days.has(day)) {
            btn.className = "day-chip px-2.5 py-1 text-xs font-bold rounded-lg bg-indigo-600 text-white shadow-sm transition-all";
        } else {
            btn.className = "day-chip px-2.5 py-1 text-xs font-bold rounded-lg border border-slate-200 bg-slate-100 text-slate-700 hover:bg-slate-200 transition-all";
        }
    });

    const clearBtn = document.getElementById("btnClearDayFilters");
    if (clearBtn) {
        clearBtn.classList.toggle("hidden", bankFilters.days.size === 0);
    }
}

function clearDayFilters() {
    bankFilters.days.clear();
    updateDayFilterUI();
    searchBankCourses();
}

/**
 * فراخوانی داده‌های ذخیره‌شده از LocalStorage
 * به طور پیش‌فرض خالی شروع می‌شود مگر آنکه کاربر خودش چیزی ذخیره کرده باشد
 */
function loadPersistedData() {
    try {
        const saved = localStorage.getItem("planner_qom_entekhab_v2");
        if (saved) {
            courseList = JSON.parse(saved);
        } else {
            courseList = [];
        }
    } catch (e) {
        console.warn("خطا در بازیابی داده‌ها:", e);
        courseList = [];
    }
}

/**
 * به‌روزرسانی کلیه بخش‌های واسط کاربری
 */
function refreshViews() {
    // ذخیره در LocalStorage
    try {
        localStorage.setItem("planner_qom_entekhab_v2", JSON.stringify(courseList));
    } catch (e) {}

    // پایش تداخل‌ها
    const conflictResult = detectAllConflicts(courseList);

    // رندر تقویم بصری هفتگی
    renderVisualCalendar(courseList, conflictResult.conflictingIds);

    // رندر جدول میز کار سریع
    renderCheatTable();

    // رندر تایم‌لاین و نمودارهای تحلیلی
    renderTimeline();
    renderCharts();

    // به‌روزرسانی هشدارهای تداخل
    updateConflictSection(conflictResult);

    // به‌روزرسانی آمار هدر
    updateHeaderStats();

    // به‌روزرسانی بخش پرینت
    updatePrintView();

    // به‌روزرسانی کارت‌های کاوشگر دروس
    searchBankCourses();
}

/**
 * به‌روزرسانی باکس‌های اطلاع‌رسانی تداخل
 */
function updateConflictSection(result) {
    const redBox = document.getElementById("redConflictBox");
    const yellowBox = document.getElementById("yellowWarningBox");
    const greenBox = document.getElementById("greenSuccessBox");

    if (redBox) {
        redBox.classList.toggle("hidden", result.redList.length === 0);
        const countBadge = document.getElementById("redCountBadge");
        if (countBadge) countBadge.innerText = `${toFa(result.redList.length)} مورد`;
        const listEl = document.getElementById("redConflictList");
        if (listEl) listEl.innerHTML = result.redList.map(r => `<li>${r.message}</li>`).join("");
    }

    if (yellowBox) {
        yellowBox.classList.toggle("hidden", result.yellowList.length === 0);
        const countBadge = document.getElementById("yellowCountBadge");
        if (countBadge) countBadge.innerText = `${toFa(result.yellowList.length)} مورد`;
        const listEl = document.getElementById("yellowWarningList");
        if (listEl) listEl.innerHTML = result.yellowList.map(r => `<li>${r.message}</li>`).join("");
    }

    if (greenBox) {
        greenBox.classList.toggle("hidden", result.redList.length > 0 || courseList.length === 0);
    }
}

/**
 * به‌روزرسانی ارقام سربرگ
 */
function updateHeaderStats() {
    const countEl = document.getElementById("statCourseCount");
    const unitsEl = document.getElementById("statTotalUnits");
    if (countEl) countEl.innerText = toFa(courseList.length);

    const totalUnits = courseList.reduce((sum, c) => sum + (parseInt(c.units, 10) || 0), 0);
    if (unitsEl) unitsEl.innerText = toFa(totalUnits);
}

/**
 * دریافت لیست مرتب‌شده دروس بر پایه روز و ساعت شروع
 */
function getSortedList() {
    return [...courseList].sort((a, b) => {
        if (dayOrderMap[a.day] !== dayOrderMap[b.day]) {
            return (dayOrderMap[a.day] || 9) - (dayOrderMap[b.day] || 9);
        }
        return timeToMinutes(a.startTime) - timeToMinutes(b.startTime);
    });
}

/**
 * رندر جدول میز کار سریع (کپی فوری کدها)
 */
function renderCheatTable() {
    const tbody = document.getElementById("cheatTableBody");
    if (!tbody) return;
    tbody.innerHTML = "";

    const sorted = getSortedList();

    if (sorted.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="9" class="text-center py-12 text-slate-500 font-bold bg-slate-50/50">
                    هنوز درسی به تقویم اضافه نشده است. از پنل «کاوشگر و فیلتر دروس» در سمت راست درس‌های دلخواه خود را اضافه کنید.
                </td>
            </tr>
        `;
        return;
    }

    let rowsHtml = "";
    sorted.forEach((c, index) => {
        let isVisible = true;
        if (currentSearchTerm) {
            const query = currentSearchTerm.toLowerCase();
            const searchString = `${c.name} ${c.instructor || ''} ${c.code || ''} ${c.group || ''}`.toLowerCase();
            isVisible = searchString.includes(query);
        }

        if (isVisible) {
            const statusClass = c.status === "ثبت شد"
                ? "bg-emerald-100 text-emerald-800 border-emerald-300"
                : c.status === "پر شد / خطا"
                    ? "bg-rose-100 text-rose-800 border-rose-300"
                    : "bg-amber-100 text-amber-800 border-amber-300";

            rowsHtml += `
                <tr class="hover:bg-slate-50/80 transition-colors">
                    <td class="text-center font-bold text-slate-400">${toFa(index + 1)}</td>
                    <td class="font-bold text-slate-800 whitespace-normal min-w-[160px]">
                        <div class="flex items-center gap-2">
                            <span class="w-3 h-3 rounded-full shrink-0 shadow-sm" style="background: ${c.color || '#4f46e5'}"></span>
                            <span>${c.name}</span>
                        </div>
                    </td>
                    <td class="text-center">
                        <button onclick="copyData('${c.code}', 'کد درس')" class="copy-btn px-3 py-1.5 bg-slate-100 rounded-lg font-mono font-bold hover:bg-slate-200 border border-slate-300 text-slate-700 shadow-sm w-full min-w-[95px] text-xs">
                            ${toFa(c.code) || '-'}
                        </button>
                    </td>
                    <td class="text-center">
                        <button onclick="copyData('${c.group}', 'کد گروه')" class="copy-btn px-3 py-1.5 bg-slate-100 rounded-lg font-mono font-bold hover:bg-slate-200 border border-slate-300 text-slate-700 shadow-sm w-full min-w-[70px] text-xs">
                            ${toFa(c.group) || '-'}
                        </button>
                    </td>
                    <td class="text-center font-black text-slate-700">${toFa(c.units)}</td>
                    <td class="text-xs font-bold text-slate-700 whitespace-nowrap">
                        <span class="bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded border border-indigo-100 ml-1">${c.day}</span>
                        <span>${toFa(c.startTime)} تا ${toFa(c.endTime)}</span>
                    </td>
                    <td class="text-xs text-slate-600 whitespace-normal font-medium">${c.instructor || '-'}</td>
                    <td class="text-center">
                        <select onchange="updateCourseStatus(${c.id}, this.value)" class="text-xs font-bold py-1 px-2.5 rounded-lg border outline-none shadow-sm cursor-pointer ${statusClass}">
                            <option value="در انتظار" ${c.status === "در انتظار" ? 'selected' : ''}>⏳ در انتظار</option>
                            <option value="ثبت شد" ${c.status === "ثبت شد" ? 'selected' : ''}>✅ ثبت شد</option>
                            <option value="پر شد / خطا" ${c.status === "پر شد / خطا" ? 'selected' : ''}>❌ پر شد</option>
                        </select>
                    </td>
                    <td class="text-center no-print whitespace-nowrap">
                        <button onclick="editCourse(${c.id})" class="bg-white border border-slate-200 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 p-1.5 rounded-lg mx-0.5 transition-colors shadow-sm" title="ویرایش">✏️</button>
                        <button onclick="removeCourseDirectly(${c.id})" class="bg-white border border-slate-200 text-slate-500 hover:text-rose-600 hover:bg-rose-50 p-1.5 rounded-lg mx-0.5 transition-colors shadow-sm" title="حذف از تقویم">🗑️</button>
                    </td>
                </tr>
            `;
        }
    });

    tbody.innerHTML = rowsHtml;
}

/**
 * به‌روزرسانی وضعیت اخذ درس
 */
function updateCourseStatus(id, newStatus) {
    const course = courseList.find(c => c.id === id);
    if (course) {
        course.status = newStatus;
        refreshViews();
    }
}

/**
 * کپی داده به کلیپ‌بورد با بازخورد Toast
 */
function copyData(text, typeName) {
    if (!text) {
        showToast("⚠️ مقداری برای کپی وجود ندارد.");
        return;
    }

    if (navigator.clipboard && window.isSecureContext) {
        navigator.clipboard.writeText(text).then(() => {
            showToast(`کپی شد: ${typeName} (${toFa(text)})`);
        });
    } else {
        const el = document.createElement('textarea');
        el.value = text;
        el.style.position = 'absolute';
        el.style.left = '-9999px';
        document.body.appendChild(el);
        el.select();
        document.execCommand('copy');
        document.body.removeChild(el);
        showToast(`کپی شد: ${typeName} (${toFa(text)})`);
    }
}

/**
 * رندر تایم‌لاین روزانه و محاسبه استراحت‌ها
 */
function renderTimeline() {
    const container = document.getElementById("dailyScheduleList");
    if (!container) return;

    let hasAny = false;
    let finalHtml = "";

    Object.keys(dayOrderMap).forEach(day => {
        const dayCourses = courseList.filter(c => c.day === day).sort((a, b) => timeToMinutes(a.startTime) - timeToMinutes(b.startTime));
        if (!dayCourses.length) return;
        hasAny = true;

        const dayUnits = dayCourses.reduce((sum, c) => sum + (parseInt(c.units, 10) || 0), 0);

        let dayHtml = `
            <div class="bg-white border border-slate-200 rounded-2xl overflow-hidden mb-4 shadow-sm">
                <div class="bg-slate-50 px-4 py-3 font-bold text-sm border-b border-slate-200 flex justify-between items-center">
                    <span class="text-slate-800 text-base flex items-center gap-2">📅 ${day}</span>
                    <span class="bg-white border border-slate-200 px-3 py-1 rounded-lg text-slate-600 text-xs shadow-sm">${toFa(dayUnits)} واحد | ${toFa(dayCourses.length)} کلاس</span>
                </div>
                <div class="p-3 space-y-2">
        `;

        dayCourses.forEach((c, idx) => {
            let gapHtml = "";
            if (idx > 0) {
                const prevEnd = timeToMinutes(dayCourses[idx - 1].endTime);
                const currStart = timeToMinutes(c.startTime);
                const gap = currStart - prevEnd;

                if (gap > 0) {
                    const h = Math.floor(gap / 60);
                    const m = gap % 60;
                    let text = "";
                    if (h > 0) text += `${h} ساعت `;
                    if (m > 0) text += `و ${m} دقیقه `;
                    gapHtml = `<div class="flex items-center justify-center py-1"><span class="bg-emerald-50 text-emerald-700 text-[11px] font-bold px-3 py-0.5 rounded-full border border-emerald-200">☕ ${toFa(text)}استراحت</span></div>`;
                } else if (gap === 0) {
                    gapHtml = `<div class="flex items-center justify-center py-1"><span class="bg-amber-100 text-amber-800 text-[11px] font-bold px-3 py-0.5 rounded-full border border-amber-300">⚠️ کلاس متوالی بدون وقفه</span></div>`;
                }
            }

            dayHtml += gapHtml;
            dayHtml += `
                <div class="flex items-center p-3 rounded-xl border border-slate-100 hover:bg-slate-50 transition-colors gap-3" style="border-right: 4px solid ${c.color || '#4f46e5'}">
                    <div class="shrink-0 text-center bg-slate-100 rounded-lg px-3 py-1.5 border border-slate-200 text-xs font-mono font-bold text-slate-700">
                        ${toFa(c.startTime)} - ${toFa(c.endTime)}
                    </div>
                    <div class="flex-1 min-w-0">
                        <div class="font-black text-sm text-slate-800 truncate">${c.name}</div>
                        <div class="text-[11px] text-slate-500 font-medium flex gap-3 mt-0.5">
                            <span>کد: ${toFa(c.code)} (${toFa(c.group)})</span>
                            <span>استاد: ${c.instructor || 'نامشخص'}</span>
                        </div>
                    </div>
                </div>
            `;
        });

        dayHtml += `</div></div>`;
        finalHtml += dayHtml;
    });

    container.innerHTML = hasAny ? finalHtml : `<div class="text-center py-12 bg-white rounded-2xl border border-dashed border-slate-300 text-slate-400 font-bold">برنامه‌ای برای نمایش وجود ندارد.</div>`;
}

/**
 * رسم نمودارهای تحلیلی با Chart.js
 */
function renderCharts() {
    const workloadCanvas = document.getElementById("weeklyWorkloadChart");
    const slotsCanvas = document.getElementById("timeSlotsChart");
    if (!workloadCanvas || !window.Chart) return;

    Chart.defaults.font.family = 'Vazirmatn';
    Chart.defaults.color = '#64748b';

    const days = Object.keys(dayOrderMap);
    const unitsData = days.map(d => courseList.filter(c => c.day === d).reduce((s, c) => s + (parseInt(c.units, 10) || 0), 0));

    if (workloadChart) workloadChart.destroy();
    workloadChart = new Chart(workloadCanvas, {
        type: 'bar',
        data: {
            labels: days,
            datasets: [{
                data: unitsData,
                backgroundColor: '#6366f1',
                borderRadius: 6,
                hoverBackgroundColor: '#4f46e5'
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                tooltip: { titleFont: { family: 'Vazirmatn' }, bodyFont: { family: 'Vazirmatn' } }
            },
            scales: {
                y: { beginAtZero: true, ticks: { stepSize: 1, precision: 0 } },
                x: { grid: { display: false } }
            }
        }
    });

    let morning = 0, noon = 0, evening = 0;
    courseList.forEach(c => {
        if (!c.startTime || !c.startTime.includes(':')) return;
        const hour = parseInt(toEn(c.startTime).split(':')[0], 10);
        if (isNaN(hour)) return;
        if (hour < 12) morning++;
        else if (hour < 15) noon++;
        else evening++;
    });

    if (slotsCanvas) {
        if (timeSlotsChart) timeSlotsChart.destroy();
        timeSlotsChart = new Chart(slotsCanvas, {
            type: 'doughnut',
            data: {
                labels: ['صبح (قبل ۱۲)', 'ظهر (۱۲ تا ۱۵)', 'عصر (بعد ۱۵)'],
                datasets: [{
                    data: [morning, noon, evening],
                    backgroundColor: ['#38bdf8', '#facc15', '#f43f5e'],
                    borderWidth: 2,
                    borderColor: '#ffffff'
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { display: false } },
                cutout: '70%'
            }
        });

        const breakdown = document.getElementById("timeSlotsBreakdown");
        if (breakdown) {
            breakdown.innerHTML = `
                <div class="flex justify-between items-center pb-2 border-b border-slate-200">
                    <span class="flex items-center gap-2"><span class="w-3 h-3 rounded-full bg-sky-400"></span>صبح (قبل ۱۲):</span>
                    <span class="font-black text-slate-800">${toFa(morning)} <span class="text-xs text-slate-500 font-normal">کلاس</span></span>
                </div>
                <div class="flex justify-between items-center pb-2 border-b border-slate-200">
                    <span class="flex items-center gap-2"><span class="w-3 h-3 rounded-full bg-yellow-400"></span>ظهر (۱۲ تا ۱۵):</span>
                    <span class="font-black text-slate-800">${toFa(noon)} <span class="text-xs text-slate-500 font-normal">کلاس</span></span>
                </div>
                <div class="flex justify-between items-center">
                    <span class="flex items-center gap-2"><span class="w-3 h-3 rounded-full bg-rose-500"></span>عصر (بعد ۱۵):</span>
                    <span class="font-black text-slate-800">${toFa(evening)} <span class="text-xs text-slate-500 font-normal">کلاس</span></span>
                </div>
            `;
        }
    }
}

/**
 * مدیریت فیلترهای پیشرفته بانک دروس
 */
function setBankGenderFilter(gender) {
    bankFilters.gender = gender;
    ['btnFilterAll', 'btnFilterMale', 'btnFilterFemale'].forEach(id => {
        const btn = document.getElementById(id);
        if (btn) btn.className = "gender-btn px-3 py-1.5 rounded-lg bg-slate-100 text-slate-700 hover:bg-slate-200 transition-all border border-slate-200 text-xs font-bold";
    });

    if (gender === 'all') {
        const b = document.getElementById('btnFilterAll');
        if (b) b.className = "gender-btn px-3 py-1.5 rounded-lg bg-indigo-600 text-white transition-all shadow-sm text-xs font-bold";
    } else if (gender === 'مرد') {
        const b = document.getElementById('btnFilterMale');
        if (b) b.className = "gender-btn px-3 py-1.5 rounded-lg bg-blue-600 text-white transition-all shadow-sm text-xs font-bold";
    } else if (gender === 'زن') {
        const b = document.getElementById('btnFilterFemale');
        if (b) b.className = "gender-btn px-3 py-1.5 rounded-lg bg-pink-600 text-white transition-all shadow-sm text-xs font-bold";
    }

    searchBankCourses();
}

function setBankTimeSlotFilter(slot) {
    bankFilters.timeSlot = slot;
    ['btnSlotAll', 'btnSlotMorning', 'btnSlotNoon', 'btnSlotEvening', 'btnSlotCustom'].forEach(id => {
        const btn = document.getElementById(id);
        if (btn) btn.className = "timeslot-btn px-2.5 py-1 text-xs font-bold rounded-lg bg-slate-100 text-slate-700 hover:bg-slate-200 transition-all border border-slate-200";
    });

    const activeMap = {
        'all': 'btnSlotAll',
        'morning': 'btnSlotMorning',
        'noon': 'btnSlotNoon',
        'evening': 'btnSlotEvening',
        'custom': 'btnSlotCustom'
    };

    const activeEl = document.getElementById(activeMap[slot]);
    if (activeEl) {
        activeEl.className = "timeslot-btn px-2.5 py-1 text-xs font-bold rounded-lg bg-indigo-600 text-white transition-all shadow-sm";
    }

    const customControls = document.getElementById("customTimeControls");
    if (customControls) {
        customControls.classList.toggle("hidden", slot !== 'custom');
    }

    searchBankCourses();
}

function toggleNoConflictFilter() {
    const toggle = document.getElementById("toggleNoConflictOnly");
    if (toggle) {
        bankFilters.onlyNoConflict = toggle.checked;
        searchBankCourses();
    }
}

function updateCustomTimeRange() {
    const startInput = document.getElementById("bankCustomStartTime");
    const endInput = document.getElementById("bankCustomEndTime");
    if (startInput) bankFilters.customStartTime = startInput.value;
    if (endInput) bankFilters.customEndTime = endInput.value;
    searchBankCourses();
}

/**
 * جستجو و فیلتر پیشرفته در بانک دروس دانشگاه قم
 */
function searchBankCourses() {
    const searchInput = document.getElementById("bankSearchInput");
    const query = searchInput ? toEn(searchInput.value.trim().toLowerCase()) : "";
    const container = document.getElementById("bankResultsContainer");
    if (!container || !window.boostanDB) return;

    let filtered = window.boostanDB.filter(c => {
        // ۱. فیلتر جنسیت
        if (bankFilters.gender !== 'all' && c.gender !== bankFilters.gender) return false;

        // ۲. فیلتر جستجوی متنی
        if (query) {
            const searchString = `${c.name} ${c.instructor || ''} ${c.code || ''} ${c.group || ''}`.toLowerCase();
            if (!searchString.includes(query)) return false;
        }

        // استخراج جلسات درس
        const sessions = c.sessions && c.sessions.length > 0
            ? c.sessions
            : [{ day: c.day, startTime: c.startTime, endTime: c.endTime }];

        // ۳. فیلتر روزهای هفته
        if (bankFilters.days.size > 0) {
            const hasMatchingDay = sessions.some(s => bankFilters.days.has(s.day));
            if (!hasMatchingDay) return false;
        }

        // ۴. فیلتر بازه زمانی
        if (bankFilters.timeSlot !== 'all') {
            const matchesTimeSlot = sessions.some(s => {
                if (!s.startTime || !s.startTime.includes(':')) return false;
                const startMins = timeToMinutes(s.startTime);
                const endMins = timeToMinutes(s.endTime);

                if (bankFilters.timeSlot === 'morning') {
                    return startMins < 720; // قبل از ۱۲:۰۰
                } else if (bankFilters.timeSlot === 'noon') {
                    return startMins >= 720 && startMins < 900; // ۱۲:۰۰ تا ۱۵:۰۰
                } else if (bankFilters.timeSlot === 'evening') {
                    return startMins >= 900; // بعد از ۱۵:۰۰
                } else if (bankFilters.timeSlot === 'custom') {
                    const customStart = timeToMinutes(bankFilters.customStartTime);
                    const customEnd = timeToMinutes(bankFilters.customEndTime);
                    return startMins >= customStart && endMins <= customEnd;
                }
                return true;
            });
            if (!matchesTimeSlot) return false;
        }

        // ۵. فیلتر فقط دروس بدون تداخل
        if (bankFilters.onlyNoConflict) {
            if (checkCandidateConflict(c, courseList)) {
                return false;
            }
        }

        return true;
    });

    const badge = document.getElementById("bankFilterCountBadge");
    if (badge) badge.innerText = `${toFa(filtered.length)} درس`;

    if (filtered.length === 0) {
        container.innerHTML = `
            <div class="text-center py-10 bg-white rounded-xl border border-slate-200 shadow-sm col-span-full">
                <span class="text-3xl block mb-2">🧐</span>
                <div class="text-slate-600 font-bold text-xs">هیچ درسی با این فیلترها یافت نشد.</div>
                <div class="text-[11px] text-slate-400 mt-1">می‌توانید فیلتر روز، ساعت یا تداخل را تغییر دهید.</div>
            </div>
        `;
        return;
    }

    let cardsHtml = "";
    filtered.forEach(c => {
        const isAlreadyAdded = courseList.some(item => item.code === c.code && item.group === c.group);
        const conflictInfo = getCandidateConflictInfo(c, courseList);

        let sessionsHtml = "";
        if (c.sessions && c.sessions.length > 0) {
            sessionsHtml = c.sessions.map(s => {
                const parityText = s.parity ? ` (${s.parity === 'ف' ? 'فرد' : 'زوج'})` : '';
                return `<span class="inline-block bg-slate-100 text-slate-700 px-2 py-0.5 rounded border border-slate-200 text-[11px]"><strong class="text-indigo-700">${s.day}</strong> ${toFa(s.startTime)} تا ${toFa(s.endTime)}${parityText}</span>`;
            }).join(" ");
        } else {
            sessionsHtml = `<span class="text-amber-600 font-bold text-xs">ساعت نامشخص</span>`;
        }

        const genderBadge = c.gender === "مرد"
            ? `<span class="bg-blue-50 text-blue-700 border border-blue-200 px-1.5 py-0.5 rounded text-[10px] font-bold">👨 برادران</span>`
            : `<span class="bg-pink-50 text-pink-700 border border-pink-200 px-1.5 py-0.5 rounded text-[10px] font-bold">👩 خواهران</span>`;

        let conflictNotice = "";
        if (conflictInfo.hasConflict && !isAlreadyAdded) {
            conflictNotice = `<div class="text-[11px] text-rose-700 bg-rose-50 px-2 py-1 rounded-lg border border-rose-200 font-medium">⚠️ تداخل با درس «${conflictInfo.conflictingCourse.name}» (${conflictInfo.conflictingCourse.day})</div>`;
        }

        let buttonHtml = "";
        if (isAlreadyAdded) {
            buttonHtml = `
                <div class="flex items-center gap-1.5 shrink-0">
                    <span class="bg-emerald-50 text-emerald-700 border border-emerald-200 px-2.5 py-1.5 rounded-xl text-xs font-black flex items-center gap-1">
                        <span>✓</span> در تقویم
                    </span>
                    <button onclick="removeCourseByCodeAndGroup('${c.code}', '${c.group}')" class="bg-rose-50 hover:bg-rose-100 text-rose-600 border border-rose-200 px-2.5 py-1.5 rounded-xl text-xs font-bold transition-colors" title="حذف از تقویم">
                        🗑️
                    </button>
                </div>
            `;
        } else {
            buttonHtml = `
                <button onclick="addCourseFromBank('${c.code}', '${c.group}')" class="shrink-0 bg-indigo-600 hover:bg-indigo-700 text-white px-3.5 py-1.5 rounded-xl text-xs font-black transition-all shadow flex items-center gap-1 active:scale-95">
                    <span>➕</span> افزودن به تقویم
                </button>
            `;
        }

        cardsHtml += `
            <div class="bg-white border ${isAlreadyAdded ? 'border-emerald-300 bg-emerald-50/10' : conflictInfo.hasConflict ? 'border-rose-200 bg-rose-50/10' : 'border-slate-200'} p-3 rounded-xl flex flex-col gap-2.5 shadow-sm hover:shadow-md transition-all">
                <div class="flex items-start justify-between gap-2">
                    <div>
                        <div class="flex flex-wrap items-center gap-1.5">
                            <h4 class="font-black text-slate-800 text-sm">${c.name}</h4>
                            ${genderBadge}
                            <span class="bg-slate-100 text-slate-600 text-[10px] px-1.5 py-0.5 rounded font-bold">واحد: ${toFa(c.units)}</span>
                            <span class="bg-slate-100 text-slate-600 text-[10px] px-1.5 py-0.5 rounded font-bold">ظرفیت: ${toFa(c.capacity)}</span>
                        </div>
                        <div class="text-xs text-slate-600 font-medium mt-1">
                            <span>👤 استاد: <strong class="text-slate-800">${c.instructor || 'نامشخص'}</strong></span>
                        </div>
                    </div>
                    ${buttonHtml}
                </div>
                
                <div class="text-xs text-slate-700 flex flex-wrap items-center gap-1">
                    <span>🕒 زمان:</span> ${sessionsHtml}
                </div>

                ${conflictNotice}

                <div class="pt-1 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500 font-mono">
                    <div class="flex gap-3">
                        <span>کد: <strong class="text-slate-700">${toFa(c.code)}</strong></span>
                        <span>گروه: <strong class="text-slate-700">${toFa(c.group)}</strong></span>
                    </div>
                    ${c.exam ? `<span class="text-amber-800 font-sans text-[10px]">📅 ${toFa(c.exam)}</span>` : ''}
                </div>
            </div>
        `;
    });

    container.innerHTML = cardsHtml;
}

/**
 * افزودن درس از بانک به برنامه
 */
function addCourseFromBank(code, group) {
    if (!window.boostanDB) return;
    const source = window.boostanDB.find(c => c.code === code && c.group === group);
    if (!source) return;

    if (courseList.some(c => c.code === code && c.group === group)) {
        showToast("⚠️ این درس قبلاً در تقویم شما قرار گرفته است.");
        return;
    }

    const assignedColor = presetColors[Math.floor(Math.random() * presetColors.length)];

    if (source.sessions && source.sessions.length > 1) {
        source.sessions.forEach((s, idx) => {
            courseList.push({
                id: Date.now() + idx,
                name: source.name + ` (جلسه ${toFa(idx + 1)})`,
                code: source.code,
                group: source.group,
                units: idx === 0 ? String(source.units) : "0",
                day: s.day,
                startTime: s.startTime,
                endTime: s.endTime,
                instructor: source.instructor,
                gender: source.gender,
                exam: source.exam || "",
                status: "در انتظار",
                color: assignedColor
            });
        });
    } else if (source.sessions && source.sessions.length === 1) {
        const s = source.sessions[0];
        courseList.push({
            id: Date.now(),
            name: source.name,
            code: source.code,
            group: source.group,
            units: String(source.units),
            day: s.day,
            startTime: s.startTime,
            endTime: s.endTime,
            instructor: source.instructor,
            gender: source.gender,
            exam: source.exam || "",
            status: "در انتظار",
            color: assignedColor
        });
    } else {
        courseList.push({
            id: Date.now(),
            name: source.name,
            code: source.code,
            group: source.group,
            units: String(source.units),
            day: "نامشخص",
            startTime: "08:00",
            endTime: "10:00",
            instructor: source.instructor,
            gender: source.gender,
            exam: source.exam || "",
            status: "در انتظار",
            color: assignedColor
        });
    }

    refreshViews();
    showToast(`درس «${source.name}» به تقویم هفتگی افزوده شد.`);
}

/**
 * حذف مستقیم یک درس از روی تقویم یا دکمه سریع
 */
function removeCourseDirectly(id) {
    const course = courseList.find(c => c.id === id);
    const courseName = course ? course.name : "درس";
    courseList = courseList.filter(c => c.id !== id);
    refreshViews();
    showToast(`«${courseName}» از تقویم برداشته شد.`);
}

/**
 * حذف درس از روی کد و گروه (برای دروسی که چند جلسه‌ای هستند)
 */
function removeCourseByCodeAndGroup(code, group) {
    courseList = courseList.filter(c => !(c.code === code && c.group === group));
    refreshViews();
    showToast("درس با موفقیت از تقویم برداشته شد.");
}

/**
 * سوئیچ تب‌های پنل کناری (بانک دروس / فرم دستی)
 */
function setSidePanelTab(tab) {
    const bankSection = document.getElementById("sideBankSection");
    const manualSection = document.getElementById("sideManualSection");
    const tabBankBtn = document.getElementById("btnSideTabBank");
    const tabManualBtn = document.getElementById("btnSideTabManual");

    if (tab === 'bank') {
        if (bankSection) bankSection.classList.remove("hidden");
        if (manualSection) manualSection.classList.add("hidden");
        if (tabBankBtn) {
            tabBankBtn.className = "flex-1 py-2 text-xs font-black rounded-xl bg-indigo-600 text-white shadow-sm transition-all";
        }
        if (tabManualBtn) {
            tabManualBtn.className = "flex-1 py-2 text-xs font-bold rounded-xl bg-slate-100 text-slate-600 hover:bg-slate-200 transition-all";
        }
        searchBankCourses();
    } else {
        if (bankSection) bankSection.classList.add("hidden");
        if (manualSection) manualSection.classList.remove("hidden");
        if (tabBankBtn) {
            tabBankBtn.className = "flex-1 py-2 text-xs font-bold rounded-xl bg-slate-100 text-slate-600 hover:bg-slate-200 transition-all";
        }
        if (tabManualBtn) {
            tabManualBtn.className = "flex-1 py-2 text-xs font-black rounded-xl bg-indigo-600 text-white shadow-sm transition-all";
        }
    }
}

/**
 * مدیریت فرم افزودن / ویرایش دستی درس
 */
function handleCourseFormSubmit(e) {
    e.preventDefault();
    const id = document.getElementById("fieldCourseId").value;
    const obj = {
        name: document.getElementById("fieldName").value.trim(),
        code: toEn(document.getElementById("fieldCode").value.trim()),
        group: toEn(document.getElementById("fieldGroup").value.trim()),
        units: document.getElementById("fieldUnits").value,
        day: document.getElementById("fieldDay").value,
        startTime: document.getElementById("fieldStartTime").value,
        endTime: document.getElementById("fieldEndTime").value,
        instructor: document.getElementById("fieldInstructor").value.trim(),
        color: document.getElementById("fieldColor").value || "#4f46e5",
        status: "در انتظار"
    };

    if (timeToMinutes(obj.startTime) >= timeToMinutes(obj.endTime)) {
        showToast("⚠️ خطا: ساعت پایان باید بعد از ساعت شروع باشد.");
        return;
    }

    if (id) {
        const index = courseList.findIndex(c => c.id == id);
        if (index > -1) {
            obj.id = parseInt(id, 10);
            obj.status = courseList[index].status;
            courseList[index] = obj;
        }
        showToast("تغییرات درس با موفقیت ذخیره شد.");
    } else {
        obj.id = Date.now();
        courseList.push(obj);
        showToast("درس جدید به تقویم اضافه شد.");
    }

    cancelFormEditing();
    refreshViews();
}

function editCourse(id) {
    const c = courseList.find(x => x.id == id);
    if (!c) return;

    setSidePanelTab('manual');

    document.getElementById("fieldCourseId").value = c.id;
    document.getElementById("fieldName").value = c.name;
    document.getElementById("fieldCode").value = c.code || '';
    document.getElementById("fieldGroup").value = c.group || '';
    document.getElementById("fieldUnits").value = c.units;
    document.getElementById("fieldDay").value = c.day;
    document.getElementById("fieldStartTime").value = c.startTime;
    document.getElementById("fieldEndTime").value = c.endTime;
    document.getElementById("fieldInstructor").value = c.instructor || '';
    document.getElementById("fieldColor").value = c.color;

    document.getElementById("formHeaderTitle").innerHTML = "<span>✏️</span> ویرایش مشخصات درس";
    document.getElementById("btnSubmitCourse").innerText = "💾 ذخیره تغییرات";
    document.getElementById("btnSubmitCourse").classList.replace("bg-indigo-600", "bg-emerald-600");
    document.getElementById("btnSubmitCourse").classList.replace("hover:bg-indigo-700", "hover:bg-emerald-700");
    document.getElementById("editBadge").classList.remove("hidden");
    document.getElementById("btnCancelEdit").classList.remove("hidden");

    // هایلایت رنگ در پالت
    const picker = document.getElementById("palettePicker");
    if (picker) {
        Array.from(picker.children).forEach(b => {
            if (b.style.backgroundColor === c.color) {
                b.className = "w-7 h-7 rounded-full border-2 transition-all shadow-md outline-none border-slate-800 scale-110 ring-2 ring-indigo-300";
            } else {
                b.className = "w-7 h-7 rounded-full border-2 transition-all shadow-sm outline-none border-transparent hover:scale-110";
            }
        });
    }

    const formCol = document.getElementById("formContainerCol");
    if (formCol) formCol.scrollIntoView({ behavior: 'smooth' });
}

function cancelFormEditing() {
    const form = document.getElementById("courseManageForm");
    if (form) form.reset();
    document.getElementById("fieldCourseId").value = "";
    document.getElementById("formHeaderTitle").innerHTML = "<span>➕</span> افزودن درس دستی";
    document.getElementById("btnSubmitCourse").innerText = "➕ افزودن به برنامه";
    document.getElementById("btnSubmitCourse").classList.replace("bg-emerald-600", "bg-indigo-600");
    document.getElementById("btnSubmitCourse").classList.replace("hover:bg-emerald-700", "hover:bg-indigo-700");
    document.getElementById("editBadge").classList.add("hidden");
    document.getElementById("btnCancelEdit").classList.add("hidden");

    const picker = document.getElementById("palettePicker");
    if (picker && picker.children.length > 0) picker.children[0].click();
}

/**
 * ریست کامل برنامه
 */
function showResetAllModal() {
    document.getElementById("confirmModalTitle").innerText = "خالی کردن کل تقویم";
    document.getElementById("confirmModalText").innerText = "آیا می‌خواهید تمام دروس چیده‌شده در تقویم پاک شوند؟ پس از پاک شدن می‌توانید مجدداً بر اساس فیلترها برنامه دلخواه خود را بچینید.";
    confirmAction = () => {
        courseList = [];
        refreshViews();
        showToast("تقویم کاملاً خالی شد. اکنون می‌توانید دروس را بچینید.");
    };
    openConfirmModal();
}

function openConfirmModal() {
    const m = document.getElementById("confirmModal");
    const c = document.getElementById("confirmModalCard");
    if (m) m.classList.remove("opacity-0", "pointer-events-none");
    if (c) c.classList.remove("scale-95");
}

function closeConfirmModal() {
    const m = document.getElementById("confirmModal");
    const c = document.getElementById("confirmModalCard");
    if (m) m.classList.add("opacity-0", "pointer-events-none");
    if (c) c.classList.add("scale-95");
}

/**
 * نمایش جزئیات درس با کلیک روی کارت تقویم
 */
function showCourseDetail(id) {
    const c = courseList.find(x => x.id === id);
    if (!c) return;

    document.getElementById("courseDetailTitle").innerText = c.name;
    document.getElementById("courseDetailBody").innerHTML = `
        <div class="space-y-3 text-sm">
            <div class="flex justify-between py-1.5 border-b border-slate-100">
                <span class="text-slate-500">کد درس:</span>
                <span class="font-mono font-bold text-slate-800">${toFa(c.code) || '-'}</span>
            </div>
            <div class="flex justify-between py-1.5 border-b border-slate-100">
                <span class="text-slate-500">کد گروه:</span>
                <span class="font-mono font-bold text-slate-800">${toFa(c.group) || '-'}</span>
            </div>
            <div class="flex justify-between py-1.5 border-b border-slate-100">
                <span class="text-slate-500">تعداد واحد:</span>
                <span class="font-bold text-slate-800">${toFa(c.units)}</span>
            </div>
            <div class="flex justify-between py-1.5 border-b border-slate-100">
                <span class="text-slate-500">زمان کلاس:</span>
                <span class="font-bold text-indigo-700">${c.day} (${toFa(c.startTime)} تا ${toFa(c.endTime)})</span>
            </div>
            <div class="flex justify-between py-1.5 border-b border-slate-100">
                <span class="text-slate-500">استاد:</span>
                <span class="font-bold text-slate-800">${c.instructor || 'نامشخص'}</span>
            </div>
            ${c.exam ? `<div class="p-2 bg-amber-50 rounded-lg text-amber-800 text-xs font-medium border border-amber-200">📅 امتحان: ${toFa(c.exam)}</div>` : ''}
        </div>
    `;

    const detailModal = document.getElementById("courseDetailModal");
    const detailCard = document.getElementById("courseDetailModalCard");
    if (detailModal) detailModal.classList.remove("opacity-0", "pointer-events-none");
    if (detailCard) detailCard.classList.remove("scale-95");
}

function closeCourseDetailModal() {
    const detailModal = document.getElementById("courseDetailModal");
    const detailCard = document.getElementById("courseDetailModalCard");
    if (detailModal) detailModal.classList.add("opacity-0", "pointer-events-none");
    if (detailCard) detailCard.classList.add("scale-95");
}

/**
 * مدیریت تب‌ها
 */
function setActiveTab(tabId) {
    ['panelCalendar', 'panelFastView', 'panelWeeklyView'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.classList.add('hidden');
    });

    ['tabBtnCalendar', 'tabBtnFast', 'tabBtnWeekly'].forEach(id => {
        const el = document.getElementById(id);
        if (el) {
            el.classList.remove('tab-btn-active', 'bg-white', 'text-indigo-600');
            el.classList.add('text-slate-500');
        }
    });

    const targetPanel = document.getElementById('panel' + tabId.charAt(0).toUpperCase() + tabId.slice(1));
    if (targetPanel) targetPanel.classList.remove('hidden');

    const targetBtn = document.getElementById('tabBtn' + tabId.charAt(0).toUpperCase() + tabId.slice(1));
    if (targetBtn) {
        targetBtn.classList.add('tab-btn-active', 'bg-white', 'text-indigo-600');
        targetBtn.classList.remove('text-slate-500');
    }

    if (tabId === 'weeklyView') {
        renderCharts();
    }
}

/**
 * حالت عریض تمام‌صفحه جدول و تقویم
 */
function toggleWideTableMode() {
    isWideMode = !isWideMode;
    const mainCol = document.getElementById("tableMainCol");
    const formCol = document.getElementById("formContainerCol");
    const toggleBtn = document.getElementById("btnWideToggle");

    if (mainCol) mainCol.className = isWideMode ? "lg:col-span-12 space-y-6" : "lg:col-span-7 space-y-6";
    if (formCol) formCol.classList.toggle("hidden", isWideMode);
    if (toggleBtn) toggleBtn.innerHTML = isWideMode ? "🔙 بازگشت کاوشگر دروس" : "↔️ تمام‌صفحه کردن تقویم";

    if (!document.getElementById('panelWeeklyView').classList.contains('hidden')) {
        setTimeout(renderCharts, 150);
    }
}

/**
 * خروجی فایل پشتیبان JSON (مطابق فرمت Barname_EntekhabVahed_Backup.json)
 */
function exportDataToJSON() {
    if (courseList.length === 0) {
        showToast("⚠️ تقویم خالی است. ابتدا دروسی را انتخاب کنید.");
        return;
    }
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([JSON.stringify(courseList, null, 2)], { type: "application/json;charset=utf-8;" }));
    a.download = "Barname_EntekhabVahed_Backup.json";
    a.click();
    showToast("فایل پشتیبان با موفقیت ذخیره شد.");
}

/**
 * بارگذاری فایل پشتیبان JSON
 */
function handleImportFile(e) {
    const input = e.target;
    if (!input.files || !input.files[0]) return;
    const file = input.files[0];

    const reader = new FileReader();
    reader.onload = ev => {
        try {
            const textContent = ev.target.result;
            if (!textContent || !textContent.trim()) {
                showToast("⚠️ فایل انتخاب‌شده خالی است.");
                return;
            }
            const data = JSON.parse(textContent);
            if (Array.isArray(data)) {
                courseList = data;
                refreshViews();
                showToast(`✅ تعداد ${toFa(courseList.length)} درس با موفقیت در تقویم چیده شد.`);
            } else {
                showToast("⚠️ ساختار داده‌های داخل فایل استاندارد نیست.");
            }
        } catch (err) {
            console.error("خطا در پردازش JSON:", err);
            showToast("⚠️ خطا در پردازش فایل: لطفاً از فایل معتبر JSON استفاده کنید.");
        } finally {
            input.value = "";
        }
    };
    reader.onerror = () => {
        showToast("⚠️ خطا در دسترسی به فایل در مرورگر.");
        input.value = "";
    };
    reader.readAsText(file, 'utf-8');
}

/**
 * پشتیبانی از Drag & Drop فایل JSON در سراسر صفحه
 */
function setupDragAndDrop() {
    window.addEventListener("dragover", e => e.preventDefault());
    window.addEventListener("drop", e => {
        e.preventDefault();
        if (e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0]) {
            const file = e.dataTransfer.files[0];
            if (file.name.toLowerCase().endsWith('.json')) {
                const fakeEvent = { target: { files: [file], value: "" } };
                handleImportFile(fakeEvent);
            } else {
                showToast("⚠️ لطفاً فقط فایل با فرمت .json را رها کنید.");
            }
        }
    });
}

/**
 * خروجی اکسل با فرمت CSV و پشتیبانی از UTF-8 BOM
 */
function exportToCSV() {
    if (courseList.length === 0) {
        showToast("⚠️ برنامه‌ای برای خروجی اکسل وجود ندارد.");
        return;
    }

    let csv = "\uFEFFردیف,نام درس,کد استاندارد,کد گروه,واحد,روز,ساعت شروع,ساعت پایان,استاد,وضعیت\n";
    getSortedList().forEach((c, idx) => {
        const name = `"${c.name.replace(/"/g, '""')}"`;
        const inst = `"${(c.instructor || '').replace(/"/g, '""')}"`;
        csv += `${idx + 1},${name},"${c.code || ''}","${c.group || ''}",${c.units},"${c.day}","${c.startTime}","${c.endTime}",${inst},"${c.status}"\n`;
    });

    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8;" }));
    a.download = "Barname_Haftegi_Doroos.csv";
    a.click();
    showToast("خروجی اکسل با موفقیت تولید شد.");
}

/**
 * به‌روزرسانی بخش چاپ رسمی
 */
function updatePrintView() {
    const ptbody = document.getElementById("printableTableBody");
    const printDate = document.getElementById("printFaDate");
    const printSummary = document.getElementById("printSummaryPill");

    if (printDate) {
        printDate.innerText = new Intl.DateTimeFormat('fa-IR', { dateStyle: 'full' }).format(new Date());
    }

    const totalUnits = courseList.reduce((s, c) => s + (parseInt(c.units, 10) || 0), 0);
    if (printSummary) {
        printSummary.innerText = `مجموع: ${toFa(courseList.length)} درس | ${toFa(totalUnits)} واحد`;
    }

    if (ptbody) {
        const sorted = getSortedList();
        let rows = "";
        sorted.forEach((c, i) => {
            rows += `
                <tr>
                    <td>${toFa(i + 1)}</td>
                    <td style="font-weight: bold;">${c.name}</td>
                    <td style="font-family: monospace; font-weight: bold;">${toFa(c.code) || '-'}</td>
                    <td style="font-family: monospace; font-weight: bold;">${toFa(c.group) || '-'}</td>
                    <td style="font-weight: bold;">${toFa(c.units)}</td>
                    <td>${c.day} (${toFa(c.startTime)} تا ${toFa(c.endTime)})</td>
                    <td>${c.instructor || '-'}</td>
                    <td style="font-weight: bold;">${c.status}</td>
                </tr>
            `;
        });
        ptbody.innerHTML = rows;
    }
}

/**
 * نمایش پیام Toast شناور
 */
function showToast(msg) {
    const t = document.getElementById("toastNotification");
    const msgEl = document.getElementById("toastMessage");
    if (!t || !msgEl) return;

    msgEl.innerText = msg;
    t.classList.remove("translate-y-24", "opacity-0");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => t.classList.add("translate-y-24", "opacity-0"), 3000);
}

// گوش دادن به کلید تأیید در مودال تأییدیه
document.addEventListener("DOMContentLoaded", () => {
    const confirmBtn = document.getElementById("confirmModalOkBtn");
    if (confirmBtn) {
        confirmBtn.onclick = () => {
            if (confirmAction) confirmAction();
            closeConfirmModal();
        };
    }
});

// ثبت توابع در محدوده سراسری
window.toFa = toFa;
window.toEn = toEn;
window.setBankGenderFilter = setBankGenderFilter;
window.setBankTimeSlotFilter = setBankTimeSlotFilter;
window.toggleNoConflictFilter = toggleNoConflictFilter;
window.updateCustomTimeRange = updateCustomTimeRange;
window.toggleDayFilter = toggleDayFilter;
window.clearDayFilters = clearDayFilters;
window.searchBankCourses = searchBankCourses;
window.addCourseFromBank = addCourseFromBank;
window.removeCourseDirectly = removeCourseDirectly;
window.removeCourseByCodeAndGroup = removeCourseByCodeAndGroup;
window.setSidePanelTab = setSidePanelTab;
window.handleCourseFormSubmit = handleCourseFormSubmit;
window.editCourse = editCourse;
window.cancelFormEditing = cancelFormEditing;
window.showResetAllModal = showResetAllModal;
window.showCourseDetail = showCourseDetail;
window.closeCourseDetailModal = closeCourseDetailModal;
window.closeConfirmModal = closeConfirmModal;
window.setActiveTab = setActiveTab;
window.toggleWideTableMode = toggleWideTableMode;
window.exportDataToJSON = exportDataToJSON;
window.handleImportFile = handleImportFile;
window.exportToCSV = exportToCSV;
window.copyData = copyData;
window.updateCourseStatus = updateCourseStatus;

// راه‌اندازی پس از بارگذاری صفحه
window.onload = appInit;
