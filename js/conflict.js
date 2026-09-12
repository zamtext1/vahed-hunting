/* ==========================================================================
   ماژول هوشمند پایش تداخل‌های زمانی و اعتبارسنجی
   Conflict Detection & Timing Helpers
   ========================================================================== */

const persianDigits = ['۰', '۱', '۲', '۳', '۴', '۵', '۶', '۷', '۸', '۹'];
const englishDigits = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9'];

function toFa(str) {
    if (str === null || str === undefined) return '';
    return str.toString().replace(/\d/g, d => persianDigits[parseInt(d)]);
}

function toEn(str) {
    if (!str) return '';
    return str.toString().replace(/[۰-۹]/g, w => persianDigits.indexOf(w));
}

function timeToMinutes(t) {
    if (!t) return 0;
    t = toEn(t);
    const parts = t.split(':');
    if (parts.length < 2) return 0;
    return (parseInt(parts[0], 10) || 0) * 60 + (parseInt(parts[1], 10) || 0);
}

function minutesToTime(mins) {
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
}

/**
 * بررسی هم‌پوشانی زمانی دو بازه
 */
function isOverlapping(s1, e1, s2, e2) {
    return s1 < e2 && s2 < e1;
}

/**
 * پایش جامع تداخل‌ها در لیست دروس جاری
 * @param {Array} courseList - آرایه دروس ثبت‌شده
 * @returns {Object} شامل لیست تداخل‌های قطعی، هشدارهای متوالی و شناسه‌های دارای تداخل
 */
function detectAllConflicts(courseList) {
    const redList = [];
    const yellowList = [];
    const conflictingIds = new Set();

    for (let i = 0; i < courseList.length; i++) {
        for (let j = i + 1; j < courseList.length; j++) {
            const c1 = courseList[i];
            const c2 = courseList[j];

            // اگر روز یکسان باشد و نامشخص نباشد
            if (c1.day && c2.day && c1.day === c2.day && c1.day !== 'نامشخص') {
                const s1 = timeToMinutes(c1.startTime);
                const e1 = timeToMinutes(c1.endTime);
                const s2 = timeToMinutes(c2.startTime);
                const e2 = timeToMinutes(c2.endTime);

                if (isOverlapping(s1, e1, s2, e2)) {
                    redList.push({
                        c1,
                        c2,
                        message: `هم‌پوشانی زمانی: «${c1.name}» (${toFa(c1.startTime)} تا ${toFa(c1.endTime)}) با «${c2.name}» (${toFa(c2.startTime)} تا ${toFa(c2.endTime)}) در روز ${c1.day}`
                    });
                    conflictingIds.add(c1.id);
                    conflictingIds.add(c2.id);
                } else if (e1 === s2) {
                    yellowList.push({
                        c1,
                        c2,
                        message: `کلاس «${c2.name}» بلافاصله پس از «${c1.name}» در روز ${c1.day} آغاز می‌شود (بدون استراحت).`
                    });
                } else if (e2 === s1) {
                    yellowList.push({
                        c1,
                        c2,
                        message: `کلاس «${c1.name}» بلافاصله پس از «${c2.name}» در روز ${c1.day} آغاز می‌شود (بدون استراحت).`
                    });
                }
            }
        }
    }

    return {
        redList,
        yellowList,
        conflictingIds,
        hasHardConflict: redList.length > 0
    };
}

/**
 * بررسی تداخل احتمالی یک درس کاندید با برنامه فعلی دانشجو
 * @param {Object} candidate - درس کاندید
 * @param {Array} currentList - لیست دروس جاری دانشجو
 * @returns {Boolean} آیا تداخل دارد؟
 */
function checkCandidateConflict(candidate, currentList) {
    const info = getCandidateConflictInfo(candidate, currentList);
    return info.hasConflict;
}

/**
 * دریافت جزئیات تداخل یک درس کاندید با دروس جاری
 */
function getCandidateConflictInfo(candidate, currentList) {
    if (!currentList || currentList.length === 0) {
        return { hasConflict: false };
    }

    const sessions = candidate.sessions && candidate.sessions.length > 0
        ? candidate.sessions
        : [{ day: candidate.day, startTime: candidate.startTime, endTime: candidate.endTime }];

    for (const session of sessions) {
        if (!session.day || session.day === 'نامشخص') continue;
        const candStart = timeToMinutes(session.startTime);
        const candEnd = timeToMinutes(session.endTime);

        for (const existing of currentList) {
            if (existing.day === session.day) {
                const exStart = timeToMinutes(existing.startTime);
                const exEnd = timeToMinutes(existing.endTime);

                if (isOverlapping(candStart, candEnd, exStart, exEnd)) {
                    return {
                        hasConflict: true,
                        conflictingCourse: existing,
                        conflictingSession: session
                    };
                }
            }
        }
    }

    return { hasConflict: false };
}

// ثبت در محدوده سراسری window
window.toFa = toFa;
window.toEn = toEn;
window.timeToMinutes = timeToMinutes;
window.minutesToTime = minutesToTime;
window.detectAllConflicts = detectAllConflicts;
window.checkCandidateConflict = checkCandidateConflict;
window.getCandidateConflictInfo = getCandidateConflictInfo;
