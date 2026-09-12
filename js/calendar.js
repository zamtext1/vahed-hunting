/* ==========================================================================
   ماژول تقویم هفتگی بصری
   Visual Weekly Calendar Matrix
   ========================================================================== */

const WEEK_DAYS = ["شنبه", "یک‌شنبه", "دوشنبه", "سه‌شنبه", "چهارشنبه", "پنج‌شنبه"];
const START_HOUR_MINUTES = 450; // 07:30
const END_HOUR_MINUTES = 1170;  // 19:30
const TOTAL_HALF_HOURS = 24;    // (19:30 - 07:30) / 30 mins = 24 segments

/**
 * رندر تقویم هفتگی بصری با نشانگر تداخل‌ها و کارت‌های رنگی
 * @param {Array} courseList - لیست دروس جاری
 * @param {Set} conflictingIds - شناسه‌های دروس دارای تداخل
 */
function renderVisualCalendar(courseList, conflictingIds = new Set()) {
    const container = document.getElementById("matrixDaysContainer");
    const emptyNotice = document.getElementById("calendarEmptyNotice");
    if (!container) return;

    if (emptyNotice) {
        emptyNotice.classList.toggle("hidden", courseList.length > 0);
    }

    let matrixHtml = "";

    WEEK_DAYS.forEach(day => {
        const dayCourses = courseList.filter(c => c.day === day);
        let blocksHtml = "";

        // مرتب‌سازی دروس روز بر اساس ساعت شروع
        dayCourses.sort((a, b) => timeToMinutes(a.startTime) - timeToMinutes(b.startTime));

        dayCourses.forEach(course => {
            const startMins = Math.max(START_HOUR_MINUTES, timeToMinutes(course.startTime));
            const endMins = Math.min(END_HOUR_MINUTES, timeToMinutes(course.endTime));

            if (endMins > startMins) {
                const colStart = Math.floor((startMins - START_HOUR_MINUTES) / 30) + 1;
                const span = Math.max(1, Math.ceil((endMins - startMins) / 30));
                const isConflicted = conflictingIds.has(course.id);
                const cardColor = course.color || '#4f46e5';

                blocksHtml += `
                    <div 
                        style="grid-column: ${colStart} / span ${span}; background-color: ${cardColor};"
                        class="calendar-card ${isConflicted ? 'calendar-card-conflict ring-2 ring-rose-500 ring-offset-1' : ''}"
                        onclick="showCourseDetail(${course.id})"
                        title="${course.name} | ${course.instructor || 'نامشخص'} (${toFa(course.startTime)} تا ${toFa(course.endTime)})"
                    >
                        <div class="flex items-center justify-between gap-1 overflow-hidden">
                            <span class="truncate font-black text-[11px] sm:text-xs drop-shadow-sm">${course.name}</span>
                            <div class="flex items-center gap-1 shrink-0">
                                ${isConflicted ? '<span class="text-xs animate-bounce" title="دارای تداخل زمانی">⚠️</span>' : ''}
                                <button 
                                    type="button" 
                                    onclick="event.stopPropagation(); removeCourseDirectly(${course.id})" 
                                    class="text-white/80 hover:text-white hover:bg-black/30 rounded p-0.5 transition-colors leading-none text-xs" 
                                    title="حذف از تقویم"
                                >
                                    ✕
                                </button>
                            </div>
                        </div>
                        <div class="flex items-center justify-between text-[10px] opacity-90 font-mono mt-0.5">
                            <span>${toFa(course.startTime)} - ${toFa(course.endTime)}</span>
                            <span class="truncate mr-1 max-w-[70px] font-sans">${course.instructor || ''}</span>
                        </div>
                    </div>
                `;
            }
        });

        // ردیف هر روز هفته
        matrixHtml += `
            <div class="flex min-h-[64px] border-b border-slate-200 last:border-0 hover:bg-slate-50/70 transition-colors group">
                <div class="w-24 shrink-0 bg-slate-50 group-hover:bg-indigo-50/50 border-l border-slate-200 flex flex-col items-center justify-center p-2 text-center transition-colors">
                    <span class="font-black text-xs text-slate-800">${day}</span>
                    <span class="text-[10px] text-slate-400 font-bold mt-0.5">${toFa(dayCourses.length)} کلاس</span>
                </div>
                <div class="flex-1 grid p-1.5 gap-x-1.5 relative time-slot-column" 
                     style="grid-template-columns: repeat(${TOTAL_HALF_HOURS}, minmax(0, 1fr));">
                    ${blocksHtml}
                </div>
            </div>
        `;
    });

    container.innerHTML = matrixHtml;
}

// ثبت در محدوده سراسری
window.renderVisualCalendar = renderVisualCalendar;
