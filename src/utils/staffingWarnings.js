import { getShiftEndMinute, normalizeMinuteForShift } from './scheduling';

function parseTimeToMinutes(value) {
  if (!value || typeof value !== 'string') return null;
  const [hours, minutes] = value.split(':').map((part) => Number.parseInt(part, 10));
  if (!Number.isInteger(hours) || !Number.isInteger(minutes)) return null;
  return hours * 60 + minutes;
}

function getColumnTaskSkillIds(schedule, roleId, taskDefs) {
  const required = new Set();
  Object.entries(schedule).forEach(([, task]) => {
    const [taskRoleId] = String(task.roleId || '').split('|');
    const blockRoleId = taskRoleId || null;
    void blockRoleId;
  });

  Object.entries(schedule).forEach(([blockKey, task]) => {
    const [blockRoleId] = String(blockKey).split('|');
    if (blockRoleId !== roleId) return;

    const taskIds = [];
    if (task.taskId) taskIds.push(task.taskId);
    if (Array.isArray(task.taskIds)) taskIds.push(...task.taskIds);
    if (task.merged && Array.isArray(task.constituents)) {
      task.constituents.forEach((part) => {
        if (part.taskId) taskIds.push(part.taskId);
      });
    }

    taskIds.forEach((taskId) => {
      const def = taskDefs?.[taskId];
      if (!def?.requiredSkills) return;
      def.requiredSkills.forEach((skillId) => required.add(Number(skillId)));
    });
  });
  return [...required].filter(Number.isInteger);
}

function buildShiftWindow(role) {
  if (!role) return null;
  const start = Number(role.shiftStart) * 60;
  const end = getShiftEndMinute(role);
  return Number.isFinite(start) && Number.isFinite(end) ? { start, end } : null;
}

function overlaps(rangeA, rangeB) {
  return rangeA.start < rangeB.end && rangeA.end > rangeB.start;
}

function buildPreferenceWarning(source, shiftWindow, label) {
  const prefStart = parseTimeToMinutes(source?.preferredStart);
  const prefEnd = parseTimeToMinutes(source?.preferredEnd);
  if (prefStart == null || prefEnd == null || !shiftWindow) return null;

  const window = {
    start: normalizeMinuteForShift({ shiftStart: shiftWindow.start / 60, shiftEnd: (shiftWindow.end % 1440) / 60 }, prefStart),
    end: normalizeMinuteForShift({ shiftStart: shiftWindow.start / 60, shiftEnd: (shiftWindow.end % 1440) / 60 }, prefEnd <= prefStart ? prefEnd + 1440 : prefEnd),
  };

  if (shiftWindow.start >= window.start && shiftWindow.end <= window.end) return null;
  return {
    type: 'preference',
    severity: 'soft',
    title: `${label} preference mismatch`,
    message: `This shift falls outside the preferred time window ${source.preferredStart}-${source.preferredEnd}.`,
  };
}

export function buildAssignmentWarnings({
  schedule,
  role,
  roleId,
  person,
  taskDefs,
  skills,
  availabilityRecords = [],
  exceptions = [],
  scheduleDate,
}) {
  const warnings = [];
  const shiftWindow = buildShiftWindow(role);

  const dayRecord = availabilityRecords.find((record) => record.date === scheduleDate);
  if (dayRecord?.isAvailable === false) {
    warnings.push({
      type: 'availability',
      severity: 'strong',
      title: 'Employee marked unavailable',
      message: 'This employee is marked unavailable for the selected schedule date.',
    });
  }

  const matchingExceptions = exceptions.filter((exception) => scheduleDate >= exception.startDate && scheduleDate <= exception.endDate);
  matchingExceptions.forEach((exception) => {
    if (exception.mode === 'unavailable') {
      warnings.push({
        type: 'availability',
        severity: 'strong',
        title: 'Unavailable exception',
        message: 'This employee has an unavailable exception covering the selected date.',
      });
      return;
    }

    if (!shiftWindow) return;
    const startMin = parseTimeToMinutes(exception.availableStart);
    const endMinRaw = parseTimeToMinutes(exception.availableEnd);
    if (startMin == null || endMinRaw == null) return;
    const endMin = endMinRaw <= startMin ? endMinRaw + 1440 : endMinRaw;
    const exceptionWindow = {
      start: normalizeMinuteForShift(role, startMin),
      end: normalizeMinuteForShift(role, endMin),
    };

    if (exception.mode === 'unavailable_window' && overlaps(shiftWindow, exceptionWindow)) {
      warnings.push({
        type: 'availability',
        severity: 'strong',
        title: 'Partial-day unavailable',
        message: `This shift overlaps an unavailable window (${exception.availableStart}-${exception.availableEnd}).`,
      });
    }

    if (exception.mode === 'available_window') {
      const fullyInside = shiftWindow.start >= exceptionWindow.start && shiftWindow.end <= exceptionWindow.end;
      if (!fullyInside) {
        warnings.push({
          type: 'availability',
          severity: 'strong',
          title: 'Outside available window',
          message: `This shift falls outside the available window (${exception.availableStart}-${exception.availableEnd}).`,
        });
      }
    }

    const exceptionPreference = buildPreferenceWarning(exception, shiftWindow, 'Exception');
    if (exceptionPreference) warnings.push(exceptionPreference);
  });

  if (!matchingExceptions.some((exception) => exception.preferredStart && exception.preferredEnd)) {
    const basePreference = buildPreferenceWarning(dayRecord, shiftWindow, 'Saved');
    if (basePreference) warnings.push(basePreference);
  }

  const requiredSkillIds = getColumnTaskSkillIds(schedule, roleId, taskDefs);
  const employeeSkillIds = new Set((person.skillIds || []).map((value) => Number(value)));
  const missingSkillIds = requiredSkillIds.filter((skillId) => !employeeSkillIds.has(Number(skillId)));
  if (missingSkillIds.length > 0) {
    const skillLabels = missingSkillIds.map((skillId) => {
      const skill = skills.find((entry) => Number(entry.id) === Number(skillId));
      return skill?.label || skill?.code || `Skill ${skillId}`;
    });
    warnings.push({
      type: 'skills',
      severity: 'soft',
      title: 'Missing required skills',
      message: `This column contains tasks that require: ${skillLabels.join(', ')}.`,
    });
  }

  return warnings;
}
