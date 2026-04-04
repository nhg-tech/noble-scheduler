import { useEffect, useMemo, useState } from 'react';
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

const DEFAULT_WEEKLY_AVAILABILITY = {
  mon: true,
  tue: true,
  wed: true,
  thu: true,
  fri: true,
  sat: true,
  sun: true,
};

function normalizeProfile(profile) {
  return {
    staffId: profile.staffId,
    weeklyAvailability: {
      mon: profile.weeklyAvailability?.mon !== false,
      tue: profile.weeklyAvailability?.tue !== false,
      wed: profile.weeklyAvailability?.wed !== false,
      thu: profile.weeklyAvailability?.thu !== false,
      fri: profile.weeklyAvailability?.fri !== false,
      sat: profile.weeklyAvailability?.sat !== false,
      sun: profile.weeklyAvailability?.sun !== false,
    },
    preferredShift: ['either', 'am', 'pm'].includes(profile.preferredShift) ? profile.preferredShift : 'either',
    preferenceNotes: profile.preferenceNotes || '',
  };
}

function buildProfiles(staffData, staffingProfiles) {
  const profileByStaffId = new Map(
    (staffingProfiles || []).map((profile) => [profile.staffId, normalizeProfile(profile)])
  );
  return (staffData || [])
    .filter((person) => person.isActive !== false)
    .slice()
    .sort((a, b) => {
      const roleCompare = (a.role || '').localeCompare(b.role || '');
      if (roleCompare !== 0) return roleCompare;
      const lastCompare = (a.lastName || '').localeCompare(b.lastName || '');
      if (lastCompare !== 0) return lastCompare;
      return (a.firstName || '').localeCompare(b.firstName || '');
    })
    .map((person) => ({
      staffId: person.id,
      name: `${person.firstName || ''} ${person.lastName || ''}`.trim() || 'Unnamed Employee',
      role: person.role || 'Other',
      employeeCode: person.employeeCode || '',
      ...normalizeProfile(profileByStaffId.get(person.id) || {
        staffId: person.id,
        weeklyAvailability: DEFAULT_WEEKLY_AVAILABILITY,
        preferredShift: 'either',
        preferenceNotes: '',
      }),
    }));
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

export default function StaffingModal({
  scheduleDate,
  staffData,
  staffingProfiles,
  onSave,
  onClose,
}) {
  const [draftProfiles, setDraftProfiles] = useState(() => buildProfiles(staffData, staffingProfiles));
  const [selectedStaffId, setSelectedStaffId] = useState(() => buildProfiles(staffData, staffingProfiles)[0]?.staffId ?? null);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const nextProfiles = buildProfiles(staffData, staffingProfiles);
    setDraftProfiles(nextProfiles);
    setSelectedStaffId((prev) => (
      nextProfiles.some((profile) => profile.staffId === prev)
        ? prev
        : nextProfiles[0]?.staffId ?? null
    ));
  }, [staffData, staffingProfiles]);

  const selectedProfile = useMemo(
    () => draftProfiles.find((profile) => profile.staffId === selectedStaffId) || null,
    [draftProfiles, selectedStaffId]
  );

  function updateSelectedProfile(patch) {
    setDraftProfiles((prev) => prev.map((profile) => (
      profile.staffId === selectedStaffId ? { ...profile, ...patch } : profile
    )));
  }

  function toggleAvailability(dayKey) {
    if (!selectedProfile) return;
    updateSelectedProfile({
      weeklyAvailability: {
        ...selectedProfile.weeklyAvailability,
        [dayKey]: !selectedProfile.weeklyAvailability[dayKey],
      },
    });
  }

  async function handleSave() {
    setIsSaving(true);
    setError('');
    try {
      await onSave(draftProfiles.map((profile) => ({
        staffId: profile.staffId,
        weeklyAvailability: profile.weeklyAvailability,
        preferredShift: profile.preferredShift,
        preferenceNotes: profile.preferenceNotes,
      })));
      onClose();
    } catch (err) {
      setError(err.message || 'Failed to save staffing preferences.');
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <Modal title="Staffing" onClose={onClose} width={980}>
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
          <div style={{ fontSize: 11, color: 'var(--gray)', maxWidth: 360, textAlign: 'right', lineHeight: 1.5 }}>
            Manage recurring weekly availability and soft shift preferences here. Date-specific overrides and assignment warnings will come next.
          </div>
        </div>

        {draftProfiles.length === 0 ? (
          <div style={{
            border: '1px solid var(--gray-light)',
            borderRadius: 10,
            padding: '18px 16px',
            color: 'var(--gray)',
            fontSize: 12,
          }}>
            No active employees are available for staffing preferences yet.
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: '280px 1fr', gap: 14, minHeight: 420 }}>
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
              <div style={{ maxHeight: 460, overflowY: 'auto' }}>
                {draftProfiles.map((profile) => {
                  const selected = profile.staffId === selectedStaffId;
                  return (
                    <button
                      key={profile.staffId}
                      onClick={() => setSelectedStaffId(profile.staffId)}
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
                        {profile.name}
                      </span>
                      <span style={{ fontSize: 11, color: 'var(--gray)' }}>
                        {profile.role}{profile.employeeCode ? ` • ${profile.employeeCode}` : ''}
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
              {selectedProfile && (
                <>
                  <div>
                    <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--purple)' }}>{selectedProfile.name}</div>
                    <div style={{ fontSize: 12, color: 'var(--gray)', marginTop: 2 }}>
                      {selectedProfile.role}{selectedProfile.employeeCode ? ` • ${selectedProfile.employeeCode}` : ''}
                    </div>
                  </div>

                  <div>
                    <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--gray)', marginBottom: 8 }}>
                      Weekly Availability
                    </div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                      {DAY_KEYS.map(([dayKey, label]) => (
                        <AvailabilityPill
                          key={dayKey}
                          active={selectedProfile.weeklyAvailability[dayKey]}
                          onClick={() => toggleAvailability(dayKey)}
                        >
                          {label}
                        </AvailabilityPill>
                      ))}
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--gray)', marginTop: 8 }}>
                      Purple means available. White means unavailable by default for that weekday.
                    </div>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '220px 1fr', gap: 14 }}>
                    <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                      <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--gray)' }}>
                        Preferred Shift
                      </span>
                      <select
                        value={selectedProfile.preferredShift}
                        onChange={(e) => updateSelectedProfile({ preferredShift: e.target.value })}
                        style={{
                          padding: '9px 10px',
                          borderRadius: 8,
                          border: '1px solid var(--gray-light)',
                          fontSize: 13,
                          fontFamily: "'DM Sans', sans-serif",
                          color: 'var(--dark)',
                          background: '#fff',
                        }}
                      >
                        <option value="either">No preference</option>
                        <option value="am">AM preferred</option>
                        <option value="pm">PM preferred</option>
                      </select>
                    </label>

                    <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                      <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--gray)' }}>
                        Preference Notes
                      </span>
                      <textarea
                        value={selectedProfile.preferenceNotes}
                        onChange={(e) => updateSelectedProfile({ preferenceNotes: e.target.value })}
                        rows={4}
                        placeholder="Optional context for staffing decisions..."
                        style={{
                          padding: '10px 12px',
                          borderRadius: 8,
                          border: '1px solid var(--gray-light)',
                          fontSize: 13,
                          fontFamily: "'DM Sans', sans-serif",
                          color: 'var(--dark)',
                          resize: 'vertical',
                          minHeight: 98,
                        }}
                      />
                    </label>
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
        <Btn onClick={handleSave} variant="primary" disabled={isSaving || draftProfiles.length === 0}>
          {isSaving ? 'Saving...' : 'Save Staffing'}
        </Btn>
      </ModalFooter>
    </Modal>
  );
}
