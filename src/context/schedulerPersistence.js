export function updateNamedEntryStore(collection, name, entry, existingRecord = null) {
  const updated = { ...collection };
  if (existingRecord?.name && existingRecord.name !== name) {
    delete updated[existingRecord.name];
  }
  updated[name] = entry;
  return updated;
}

export function removeNamedEntryStore(collection, name) {
  const updated = { ...collection };
  delete updated[name];
  return updated;
}

export function buildSchedulePayload(name, state, status) {
  return {
    name,
    scheduleDate: state.assumptions?.date || null,
    status,
    schedule: state.schedule || {},
    assumptions: state.assumptions || {},
    sessionTaskDefs: state.sessionTaskDefs || {},
    skippedTasks: state.skippedTasks || [],
    hiddenColumns: state.hiddenColumns || [],
    columnOrder: state.columnOrder || [],
    extraRoles: state.extraRoles || [],
    employeeAssignments: state.employeeAssignments || {},
  };
}

export function buildSavedScheduleEntry(state, result, payload) {
  return {
    ...state,
    id: result.id,
    status: result.status,
    scheduleDate: payload.scheduleDate,
    updatedAt: result.updated_at,
    versionNumber: result.version_number ?? result.versionNumber ?? 1,
    rootScheduleId: result.root_schedule_id ?? result.rootScheduleId ?? null,
    isCurrentVersion: result.is_current_version ?? result.isCurrentVersion ?? (payload.status === 'posted'),
    publishedAt: result.published_at ?? result.publishedAt ?? null,
    changeNote: result.change_note ?? result.changeNote ?? null,
  };
}

export function sanitizeTemplateState(state) {
  return {
    ...state,
    assumptions: {
      ...(state.assumptions || {}),
      date: '',
    },
  };
}

export async function persistTemplateRecord({
  name,
  state,
  type,
  apiTemplates,
  masterTemplatesData,
  userTemplatesData,
  setMasterTemplatesData,
  setUserTemplatesData,
  saveLS,
  masterTemplatesKey,
  userTemplatesKey,
}) {
  const sanitizedState = sanitizeTemplateState(state);
  if (type === 'master') {
    const result = await apiTemplates.saveMaster(name, sanitizedState);
    const updated = updateNamedEntryStore(
      masterTemplatesData,
      name,
      { ...sanitizedState, id: result.id, updatedAt: result.updated_at }
    );
    setMasterTemplatesData(updated);
    saveLS(masterTemplatesKey, updated);
    return { ...result, type };
  }

  const result = await apiTemplates.saveUser(name, sanitizedState);
  const updated = updateNamedEntryStore(
    userTemplatesData,
    name,
    { ...sanitizedState, id: result.id, updatedAt: result.updated_at }
  );
  setUserTemplatesData(updated);
  saveLS(userTemplatesKey, updated);
  return { ...result, type };
}

export async function persistScheduleRecord({
  name,
  state,
  status,
  existingSchedule = null,
  apiSchedules,
  draftsData,
  postingsData,
  setDraftsData,
  setPostingsData,
  saveLS,
  draftsKey,
  postingsKey,
}) {
  const payload = buildSchedulePayload(name, state, status);
  const result = existingSchedule?.id
    ? await apiSchedules.update(existingSchedule.id, payload)
    : await apiSchedules.save(payload);
  const entry = buildSavedScheduleEntry(state, result, payload);

  if (status === 'draft') {
    const updated = updateNamedEntryStore(draftsData, name, entry, existingSchedule);
    setDraftsData(updated);
    saveLS(draftsKey, updated);
    return result;
  }

  const updated = updateNamedEntryStore(postingsData, name, entry, existingSchedule);
  setPostingsData(updated);
  saveLS(postingsKey, updated);
  return result;
}

export async function deleteScheduleRecord({
  id,
  status,
  name,
  apiSchedules,
  draftsData,
  postingsData,
  setDraftsData,
  setPostingsData,
  saveLS,
  draftsKey,
  postingsKey,
}) {
  await apiSchedules.delete(id);
  if (status === 'draft') {
    const updated = removeNamedEntryStore(draftsData, name);
    setDraftsData(updated);
    saveLS(draftsKey, updated);
    return;
  }

  const updated = removeNamedEntryStore(postingsData, name);
  setPostingsData(updated);
  saveLS(postingsKey, updated);
}

export async function deleteTemplateRecord({
  name,
  type,
  apiTemplates,
  masterTemplatesData,
  userTemplatesData,
  setMasterTemplatesData,
  setUserTemplatesData,
  saveLS,
  masterTemplatesKey,
  userTemplatesKey,
}) {
  try {
    if (type === 'master') await apiTemplates.deleteMaster(name);
    else await apiTemplates.deleteUser(name);
  } catch (err) {
    console.warn('API delete failed:', err.message);
  }

  if (type === 'master') {
    const updated = removeNamedEntryStore(masterTemplatesData, name);
    setMasterTemplatesData(updated);
    saveLS(masterTemplatesKey, updated);
    return;
  }

  const updated = removeNamedEntryStore(userTemplatesData, name);
  setUserTemplatesData(updated);
  saveLS(userTemplatesKey, updated);
}
