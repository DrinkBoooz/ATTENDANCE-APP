/** Converts "7:00AM" / "07:00 PM" / "13:00" to 24-hour "HH:MM". */
export function normalizeToMilitary(rawTime) {
  const trimmed = rawTime.trim();

  const militaryMatch = trimmed.match(/^([01]?\d|2[0-3]):([0-5]\d)$/);
  if (militaryMatch && !/[AaPp][Mm]/.test(trimmed)) {
    const hh = militaryMatch[1].padStart(2, '0');
    return `${hh}:${militaryMatch[2]}`;
  }

  const twelveHourMatch = trimmed.match(/^(\d{1,2}):([0-5]\d)\s*([AaPp][Mm])$/);
  if (twelveHourMatch) {
    let hh = parseInt(twelveHourMatch[1], 10);
    const mm = twelveHourMatch[2];
    const meridiem = twelveHourMatch[3].toUpperCase();
    if (meridiem === 'AM') {
      hh = hh === 12 ? 0 : hh;
    } else {
      hh = hh === 12 ? 12 : hh + 12;
    }
    return `${String(hh).padStart(2, '0')}:${mm}`;
  }

  throw new Error(`Unrecognized time format: "${rawTime}"`);
}

/** Parses Schedule Code text into an inclusive military-time window. */
export function parseScheduleWindow(scheduleCode) {
  const rangePattern = /(\d{1,2}:\d{2}\s*[AaPp][Mm]|\d{1,2}:\d{2})\s*-\s*(\d{1,2}:\d{2}\s*[AaPp][Mm]|\d{1,2}:\d{2})/g;
  const matches = [...scheduleCode.matchAll(rangePattern)];

  if (matches.length === 0) {
    return { startTime: null, endTime: null };
  }

  let earliestStart = null;
  let latestEnd = null;

  for (const match of matches) {
    try {
      const start = normalizeToMilitary(match[1]);
      const end = normalizeToMilitary(match[2]);
      if (earliestStart === null || start < earliestStart) earliestStart = start;
      if (latestEnd === null || end > latestEnd) latestEnd = end;
    } catch {
      continue;
    }
  }

  return { startTime: earliestStart, endTime: latestEnd };
}

/** Checks whether a given local time falls within a military-time window. */
export function isWithinSchedule(startTime, endTime, when = new Date()) {
  if (!startTime || !endTime) return true;
  const nowMilitary = `${String(when.getHours()).padStart(2, '0')}:${String(when.getMinutes()).padStart(2, '0')}`;
  return nowMilitary >= startTime && nowMilitary <= endTime;
}
