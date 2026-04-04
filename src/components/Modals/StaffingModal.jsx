import { useEffect, useMemo, useState } from 'react';
import { apiStaffing } from '../../api';
import Modal, { ModalFooter, Btn } from './Modal';

const DAY_KEYS = [
  ['mon', 'Mon'],
  ['tue', 'Tue'],
  ['wed', 'Wed'],
  ['thu', 'Thu'],
  ['fri', 'Fri'],
  ['sat', 'Sat'],
  ['sun', 'Sun'],
];

const DEFAULT_PATTERN = {
  mon: true,
  tue: true,
  wed: true,
  thu: true,
  fri: true,
  sat: false,
  sun: false,
};

function addMonths(dateString, months) {
  const date = new Date(`${dateString}T00:00:00`);
  date.setMonth(date.getMonth() + months);
  return date.toISOString().slice(0, 10);
}

function AvailabilityPill({ active, onClick, children }) {
  return (
    <button
      onClick={onClick}
      style={{
        minWidth: 50,
        padding: '7px 8px',
        borderRadius: 8,
        border: active ? '1px solid var(--purple)' : '1px solid var(--gray-light)',
        background: active ? 'var(--purple-pale)' : '#fff',
        color: active ? 'var(--purple)' : 'var(--gray)',
        fontSize: 11,
        fontWeight: 700,
        cursor: 'pointer',
        fontFamily: "'DM Sans', sans-serif",
      }}
    >
      {children}
    </button>
  );
}

function InputLabel({ label, children }) {
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--gray)' }}>
        {label}
      </span>
      {children}
    </label>
  );
}

function readRangeSummary(records, startDate, endDate) {
  if (!records.length) {
    return 'No saved staffing plan yet for this range.';
  }
  const unavailableCount = records.filter((record) => record.isAvailable === false).length;
  const preferred = records.find((record) => record.preferredStart || record.preferredEnd);
  return `${records.length} saved day${records.length === 1 ? '' : 's'} in range ${startDate} to ${endDate}${unavailableCount ? ` • ${unavailableCount} unavailable` : ''}${preferred ? ' • time preference present' : ''}`;
}

export default function StaffingModal({ scheduleDate, staffData, onClose }) {
  const today = scheduleDate || new Date().toISOString().slice(0, 10);
  const activeStaff = useMemo(
    () => (staffData || [])
      .filter((person) => person.isActive !== false)
      .slice()
      .sort((a, b) => {
        const roleCompare = (a.role || '').localeCompare(b.role || '');
        if (roleCompare !== 0) return roleCompare;
        const lastCompare = (a.lastName || '').localeCompare(b.lastName || '');
        if (lastCompare !== 0) return lastCompare;
        return (a.firstName || '').localeCompare(b.firstName || '');
      }),
    [staffData]
  );
  const [selectedStaffId, setSelectedStaffId] = useState(activeStaff[0]?.id ?? null);
  const [startDate, setStartDate] = useState(today);
  const [endDate, setEndDate] = useState(addMonths(today, 3));
  const [mode, setMode] = useState('range');
  const [defaultAvailability, setDefaultAvailability] = useState(true);
  const [weekdayPattern, setWeekdayPattern] = useState(DEFAULT_PATTERN);
  const [preferenceMode, setPreferenceMode] = useState('none');
  const [preferredStart, setPreferredStart] = useState('08:00');
  const [preferredEnd, setPreferredEnd] = useState('16:00');
  const [notes, setNotes] = useState('');
  const [savedRecords, setSavedRecords] = useState([]);
  const [exceptions, setExceptions] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingExceptions, setIsLoadingExceptions] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isSavingExceptions, setIsSavingExceptions] = useState(false);
  const [error, setError] = useState('');
  const [exceptionDraft, setExceptionDraft] = useState(() => ({
    startDate: today,
    endDate: today,
    mode: 'unavailable',
    availableStart: '09:00',
    availableEnd: '17:00',
    preferredStart: '',
    preferredEnd: '',
    notes: '',
  }));

  const selectedStaff = activeStaff.find((person) => person.id === selectedStaffId) || null;

  useEffect(() => {
    if (!activeStaff.length) {
      setSelectedStaffId(null);
      return;
    }
    if (!activeStaff.some((person) => person.id === selectedStaffId)) {
      setSelectedStaffId(activeStaff[0].id);
    }
  }, [activeStaff, selectedStaffId]);

  useEffect(() => {
    setExceptionDraft((prev) => ({ ...prev, startDate: today, endDate: today }));
  }, [today]);

  useEffect(() => {
    async function loadAvailability() {
      if (!selectedStaffId || !startDate || !endDate) {
        setSavedRecords([]);
        return;
      }
      setIsLoading(true);
      setError('');
      try {
        const records = await apiStaffing.getAvailability({ staffId: selectedStaffId, startDate, endDate });
        setSavedRecords(records);
      } catch (err) {
        setError(err.message || 'Failed to load staffing availability.');
        setSavedRecords([]);
      } finally {
        setIsLoading(false);
      }
    }
    loadAvailability();
  }, [selectedStaffId, startDate, endDate]);

  useEffect(() => {
    async function loadExceptions() {
      if (!selectedStaffId) {
        setExceptions([]);
        return;
      }
      setIsLoadingExceptions(true);
      try {
        const rows = await apiStaffing.getExceptions({ staffId: selectedStaffId });
        setExceptions(rows);
      } catch (err) {
        setError(err.message || 'Failed to load staffing exceptions.');
        setExceptions([]);
      } finally {
        setIsLoadingExceptions(false);
      }
    }
    loadExceptions();
  }, [selectedStaffId]);

  function togglePatternDay(dayKey) {
    setWeekdayPattern((prev) => ({ ...prev, [dayKey]: !prev[dayKey] }));
  }

  async function handleSave() {
    if (!selectedStaffId) return;
    setIsSaving(true);
    setError('');
    try {
      await apiStaffing.saveAvailability({
        staffId: selectedStaffId,
        startDate,
        endDate,
        mode,
        defaultAvailability,
        weekdayPattern,
        preferredStart: preferenceMode === 'none' ? null : preferredStart,
        preferredEnd: preferenceMode === 'none' ? null : preferredEnd,
        notes,
      });
      const records = await apiStaffing.getAvailability({ staffId: selectedStaffId, startDate, endDate });
      setSavedRecords(records);
    } catch (err) {
      setError(err.message || 'Failed to save staffing availability.');
    } finally {
      setIsSaving(false);
    }
  }

  async function handleSaveExceptions() {
    if (!selectedStaffId) return;
    setIsSavingExceptions(true);
    setError('');
    try {
      await apiStaffing.saveExceptions({
        staffId: selectedStaffId,
        exceptions: exceptions.map((exception) => ({
          startDate: exception.startDate,
          endDate: exception.endDate,
          mode: exception.mode,
          availableStart: exception.mode === 'available_window' ? exception.availableStart : null,
          availableEnd: exception.mode === 'available_window' ? exception.availableEnd : null,
          preferredStart: exception.preferredStart || null,
          preferredEnd: exception.preferredEnd || null,
          notes: exception.notes || '',
        })),
      });
      const rows = await apiStaffing.getExceptions({ staffId: selectedStaffId });
      setExceptions(rows);
    } catch (err) {
      setError(err.message || 'Failed to save staffing exceptions.');
    } finally {
      setIsSavingExceptions(false);
    }
  }

  function handleAddException() {
    setExceptions((prev) => [
      ...prev,
      {
        id: `draft-${Date.now()}`,
        ...exceptionDraft,
      },
    ]);
    setExceptionDraft((prev) => ({
      ...prev,
      startDate,
      endDate: startDate,
      notes: '',
    }));
  }

  function removeException(targetId) {
    setExceptions((prev) => prev.filter((exception) => exception.id !== targetId));
  }

  return (
    <Modal title="Staffing" onClose={onClose} width={1040}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 12,
          padding: '12px 14px',
          borderRadius: 10,
          background: 'var(--purple-pale)',
          border: '1px solid var(--gray-light)',
        }}>
          <div>
            <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--purple)' }}>Active Schedule Date</div>
            <div style={{ fontSize: 13, color: 'var(--dark)', marginTop: 2 }}>
              {scheduleDate || 'No date selected yet'}
            </div>
          </div>
          <div style={{ fontSize: 11, color: 'var(--gray)', maxWidth: 420, textAlign: 'right', lineHeight: 1.5 }}>
            Plan date-based staffing up to 6 months ahead. Apply one pattern across a date range, or use a weekday pattern for more flexibility.
          </div>
        </div>

        {activeStaff.length === 0 ? (
          <div style={{
            border: '1px solid var(--gray-light)',
            borderRadius: 10,
            padding: '18px 16px',
            color: 'var(--gray)',
            fontSize: 12,
          }}>
            No active employees are available for staffing yet.
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: '280px 1fr', gap: 14, minHeight: 560 }}>
            <div style={{
              border: '1px solid var(--gray-light)',
              borderRadius: 10,
              overflow: 'hidden',
              background: '#fff',
            }}>
              <div style={{
                padding: '12px 14px',
                borderBottom: '1px solid var(--gray-light)',
                fontSize: 11,
                fontWeight: 700,
                letterSpacing: '0.06em',
                textTransform: 'uppercase',
                color: 'var(--gray)',
              }}>
                Employees
              </div>
              <div style={{ maxHeight: 520, overflowY: 'auto' }}>
                {activeStaff.map((person) => {
                  const selected = person.id === selectedStaffId;
                  return (
                    <button
                      key={person.id}
                      onClick={() => setSelectedStaffId(person.id)}
                      style={{
                        width: '100%',
                        textAlign: 'left',
                        padding: '11px 14px',
                        border: 'none',
                        borderBottom: '1px solid var(--gray-light)',
                        background: selected ? 'var(--purple-pale)' : '#fff',
                        cursor: 'pointer',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 3,
                      }}
                    >
                      <span style={{ fontSize: 12, fontWeight: 700, color: selected ? 'var(--purple)' : 'var(--dark)' }}>
                        {`${person.firstName || ''} ${person.lastName || ''}`.trim() || 'Unnamed Employee'}
                      </span>
                      <span style={{ fontSize: 11, color: 'var(--gray)' }}>
                        {person.role || 'Other'}{person.employeeCode ? ` • ${person.employeeCode}` : ''}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div style={{
              border: '1px solid var(--gray-light)',
              borderRadius: 10,
              padding: '16px',
              background: '#fff',
              display: 'flex',
              flexDirection: 'column',
              gap: 16,
            }}>
              {selectedStaff && (
                <>
                  <div>
                    <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--purple)' }}>
                      {`${selectedStaff.firstName || ''} ${selectedStaff.lastName || ''}`.trim() || 'Unnamed Employee'}
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--gray)', marginTop: 2 }}>
                      {(selectedStaff.role || 'Other')}{selectedStaff.employeeCode ? ` • ${selectedStaff.employeeCode}` : ''}
                    </div>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                    <InputLabel label="Start Date">
                      <input
                        type="date"
                        value={startDate}
                        onChange={(e) => setStartDate(e.target.value)}
                        style={inputStyle}
                      />
                    </InputLabel>
                    <InputLabel label="End Date">
                      <input
                        type="date"
                        value={endDate}
                        max={addMonths(startDate || today, 6)}
                        onChange={(e) => setEndDate(e.target.value)}
                        style={inputStyle}
                      />
                    </InputLabel>
                  </div>

                  <div>
                    <div style={sectionLabelStyle}>Availability Mode</div>
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                      <AvailabilityPill active={mode === 'range'} onClick={() => setMode('range')}>Same For Range</AvailabilityPill>
                      <AvailabilityPill active={mode === 'pattern'} onClick={() => setMode('pattern')}>Pattern By Weekday</AvailabilityPill>
                    </div>
                  </div>

                  {mode === 'range' ? (
                    <div>
                      <div style={sectionLabelStyle}>Range Availability</div>
                      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                        <AvailabilityPill active={defaultAvailability} onClick={() => setDefaultAvailability(true)}>Available</AvailabilityPill>
                        <AvailabilityPill active={!defaultAvailability} onClick={() => setDefaultAvailability(false)}>Unavailable</AvailabilityPill>
                      </div>
                    </div>
                  ) : (
                    <div>
                      <div style={sectionLabelStyle}>Weekday Pattern</div>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                        {DAY_KEYS.map(([dayKey, label]) => (
                          <AvailabilityPill
                            key={dayKey}
                            active={weekdayPattern[dayKey]}
                            onClick={() => togglePatternDay(dayKey)}
                          >
                            {label}
                          </AvailabilityPill>
                        ))}
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--gray)', marginTop: 8 }}>
                        Selected weekdays will be saved as available. Unselected weekdays will be saved as unavailable in the chosen date range.
                      </div>
                    </div>
                  )}

                  <div style={{ display: 'grid', gridTemplateColumns: '220px 1fr 1fr', gap: 14 }}>
                    <InputLabel label="Preferred Time">
                      <select
                        value={preferenceMode}
                        onChange={(e) => setPreferenceMode(e.target.value)}
                        style={inputStyle}
                      >
                        <option value="none">No Preference</option>
                        <option value="window">Preferred Time Window</option>
                      </select>
                    </InputLabel>
                    <InputLabel label="Preferred Start">
                      <input
                        type="time"
                        value={preferredStart}
                        disabled={preferenceMode === 'none'}
                        onChange={(e) => setPreferredStart(e.target.value)}
                        style={inputStyle}
                      />
                    </InputLabel>
                    <InputLabel label="Preferred End">
                      <input
                        type="time"
                        value={preferredEnd}
                        disabled={preferenceMode === 'none'}
                        onChange={(e) => setPreferredEnd(e.target.value)}
                        style={inputStyle}
                      />
                    </InputLabel>
                  </div>

                  <InputLabel label="Planning Notes">
                    <textarea
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      rows={4}
                      placeholder="Optional notes for this date range..."
                      style={{ ...inputStyle, minHeight: 98, resize: 'vertical' }}
                    />
                  </InputLabel>

                  <div style={{
                    padding: '12px 14px',
                    borderRadius: 8,
                    background: 'var(--cream)',
                    border: '1px solid var(--gray-light)',
                    fontSize: 12,
                    color: 'var(--gray)',
                    lineHeight: 1.6,
                  }}>
                    {isLoading ? 'Loading saved staffing plan for this range...' : readRangeSummary(savedRecords, startDate, endDate)}
                  </div>

                  <div style={{
                    borderTop: '1px solid var(--gray-light)',
                    paddingTop: 16,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 14,
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--purple)' }}>Availability Exceptions</div>
                        <div style={{ fontSize: 11, color: 'var(--gray)', marginTop: 2 }}>
                          Exceptions override the base staffing plan for vacations, one-off changes, or specific-time availability.
                        </div>
                      </div>
                      <Btn onClick={handleSaveExceptions} variant="secondary" disabled={isSavingExceptions}>
                        {isSavingExceptions ? 'Saving Exceptions...' : 'Save Exceptions'}
                      </Btn>
                    </div>

                    <div style={{
                      padding: '12px 14px',
                      borderRadius: 8,
                      border: '1px solid var(--gray-light)',
                      background: 'var(--cream)',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 12,
                    }}>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 200px', gap: 12 }}>
                        <InputLabel label="Exception Start">
                          <input
                            type="date"
                            value={exceptionDraft.startDate}
                            onChange={(e) => setExceptionDraft((prev) => ({ ...prev, startDate: e.target.value }))}
                            style={inputStyle}
                          />
                        </InputLabel>
                        <InputLabel label="Exception End">
                          <input
                            type="date"
                            value={exceptionDraft.endDate}
                            onChange={(e) => setExceptionDraft((prev) => ({ ...prev, endDate: e.target.value }))}
                            style={inputStyle}
                          />
                        </InputLabel>
                        <InputLabel label="Mode">
                          <select
                            value={exceptionDraft.mode}
                            onChange={(e) => setExceptionDraft((prev) => ({ ...prev, mode: e.target.value }))}
                            style={inputStyle}
                          >
                            <option value="unavailable">Unavailable</option>
                            <option value="unavailable_window">Unavailable Time Window</option>
                            <option value="available_window">Available Window</option>
                          </select>
                        </InputLabel>
                      </div>

                      {(exceptionDraft.mode === 'available_window' || exceptionDraft.mode === 'unavailable_window') && (
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 12 }}>
                          <InputLabel label="Available Start">
                            <input
                              type="time"
                              value={exceptionDraft.availableStart}
                              onChange={(e) => setExceptionDraft((prev) => ({ ...prev, availableStart: e.target.value }))}
                              style={inputStyle}
                            />
                          </InputLabel>
                          <InputLabel label="Available End">
                            <input
                              type="time"
                              value={exceptionDraft.availableEnd}
                              onChange={(e) => setExceptionDraft((prev) => ({ ...prev, availableEnd: e.target.value }))}
                              style={inputStyle}
                            />
                          </InputLabel>
                          <InputLabel label="Preferred Start">
                            <input
                              type="time"
                              value={exceptionDraft.preferredStart}
                              onChange={(e) => setExceptionDraft((prev) => ({ ...prev, preferredStart: e.target.value }))}
                              style={inputStyle}
                            />
                          </InputLabel>
                          <InputLabel label="Preferred End">
                            <input
                              type="time"
                              value={exceptionDraft.preferredEnd}
                              onChange={(e) => setExceptionDraft((prev) => ({ ...prev, preferredEnd: e.target.value }))}
                              style={inputStyle}
                            />
                          </InputLabel>
                        </div>
                      )}

                      <InputLabel label="Exception Notes">
                        <textarea
                          value={exceptionDraft.notes}
                          onChange={(e) => setExceptionDraft((prev) => ({ ...prev, notes: e.target.value }))}
                          rows={2}
                          placeholder="Optional note for this exception..."
                          style={{ ...inputStyle, minHeight: 72, resize: 'vertical' }}
                        />
                      </InputLabel>

                      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                        <Btn onClick={handleAddException} variant="primary">Add Exception</Btn>
                      </div>
                    </div>

                    <div style={{
                      border: '1px solid var(--gray-light)',
                      borderRadius: 8,
                      overflow: 'hidden',
                    }}>
                      <div style={{
                        padding: '10px 12px',
                        borderBottom: '1px solid var(--gray-light)',
                        background: '#fff',
                        fontSize: 11,
                        fontWeight: 700,
                        letterSpacing: '0.06em',
                        textTransform: 'uppercase',
                        color: 'var(--gray)',
                      }}>
                        Saved Exceptions
                      </div>
                      <div style={{ maxHeight: 220, overflowY: 'auto', background: '#fff' }}>
                        {isLoadingExceptions ? (
                          <div style={{ padding: '12px', fontSize: 12, color: 'var(--gray)' }}>
                            Loading exceptions...
                          </div>
                        ) : exceptions.length === 0 ? (
                          <div style={{ padding: '12px', fontSize: 12, color: 'var(--gray)' }}>
                            No exceptions yet for this employee.
                          </div>
                        ) : exceptions.map((exception) => (
                          <div
                            key={exception.id}
                            style={{
                              padding: '12px',
                              borderBottom: '1px solid var(--gray-light)',
                              display: 'flex',
                              alignItems: 'flex-start',
                              justifyContent: 'space-between',
                              gap: 12,
                            }}
                          >
                            <div style={{ minWidth: 0 }}>
                              <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--dark)' }}>
                                {exception.startDate === exception.endDate
                                  ? exception.startDate
                                  : `${exception.startDate} to ${exception.endDate}`}
                              </div>
                              <div style={{ fontSize: 11, color: 'var(--gray)', marginTop: 3 }}>
                                {exception.mode === 'unavailable'
                                  ? 'Unavailable'
                                  : exception.mode === 'unavailable_window'
                                    ? `Unavailable ${exception.availableStart || '--'} - ${exception.availableEnd || '--'}`
                                    : `Available ${exception.availableStart || '--'} - ${exception.availableEnd || '--'}`}
                                {exception.preferredStart && exception.preferredEnd
                                  ? ` • Prefers ${exception.preferredStart} - ${exception.preferredEnd}`
                                  : ''}
                              </div>
                              {exception.notes && (
                                <div style={{ fontSize: 11, color: 'var(--gray)', marginTop: 4 }}>
                                  {exception.notes}
                                </div>
                              )}
                            </div>
                            <button
                              onClick={() => removeException(exception.id)}
                              style={{
                                border: 'none',
                                background: 'none',
                                color: '#B42318',
                                fontSize: 12,
                                fontWeight: 700,
                                cursor: 'pointer',
                                flexShrink: 0,
                              }}
                            >
                              Remove
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        )}

        {error && (
          <div style={{
            padding: '10px 12px',
            borderRadius: 8,
            background: '#FDECEC',
            color: '#7F1D1D',
            fontSize: 12,
          }}>
            {error}
          </div>
        )}
      </div>
      <ModalFooter>
        <Btn onClick={onClose} variant="secondary">Cancel</Btn>
        <Btn onClick={handleSave} variant="primary" disabled={isSaving || !selectedStaffId}>
          {isSaving ? 'Saving...' : 'Save Staffing'}
        </Btn>
      </ModalFooter>
    </Modal>
  );
}

const inputStyle = {
  padding: '9px 10px',
  borderRadius: 8,
  border: '1px solid var(--gray-light)',
  fontSize: 13,
  fontFamily: "'DM Sans', sans-serif",
  color: 'var(--dark)',
  background: '#fff',
};

const sectionLabelStyle = {
  fontSize: 11,
  fontWeight: 700,
  letterSpacing: '0.06em',
  textTransform: 'uppercase',
  color: 'var(--gray)',
  marginBottom: 8,
};
