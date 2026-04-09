import { useRef, useState } from 'react';
import Modal, { ModalFooter, Btn } from '../Modals/Modal';

export function StaffDirectoryPanel({ staffData, setStaffData, skillsData, onCreateStaff, onEditStaff }) {
  const [showInactive, setShowInactive] = useState(false);
  const isDraggingRef = useRef(false);
  const dragIdRef = useRef(null);
  const skillById = Object.fromEntries(skillsData.map((skill) => [skill.id, skill]));

  const visibleStaff = staffData.filter((person) => showInactive || person.isActive !== false);

  function toggleStaff(id) {
    setStaffData((prev) => prev.map((person) => (
      person.id === id
        ? { ...person, isActive: person.isActive === false, sortOrder: person.sortOrder ?? prev.indexOf(person) }
        : person
    )));
  }

  function removeSkillFromStaff(staffId, skillId) {
    setStaffData((prev) => prev.map((person) => (
      person.id === staffId
        ? { ...person, skillIds: (person.skillIds || []).filter((id) => id !== skillId) }
        : person
    )));
  }

  function handleGripPointerDown(e, staffId) {
    e.stopPropagation();
    e.preventDefault();
    isDraggingRef.current = true;
    dragIdRef.current = staffId;
    function onUp() {
      isDraggingRef.current = false;
      dragIdRef.current = null;
      document.removeEventListener('pointerup', onUp);
    }
    document.addEventListener('pointerup', onUp);
  }

  function handleRowPointerEnter(staffId) {
    if (!isDraggingRef.current || !dragIdRef.current || dragIdRef.current === staffId) return;
    const draggingId = dragIdRef.current;
    setStaffData((prev) => {
      const from = prev.findIndex((person) => person.id === draggingId);
      const to = prev.findIndex((person) => person.id === staffId);
      if (from === -1 || to === -1) return prev;
      const next = [...prev];
      next.splice(to, 0, next.splice(from, 1)[0]);
      return next.map((person, index) => ({ ...person, sortOrder: index }));
    });
  }

  return (
    <div>
      <p style={{ fontSize: 12, color: 'var(--gray)', marginTop: 0 }}>
        Maintain the staff directory here, then use the Availability tab for date-based staffing rules. Drag ⠿ to reorder active staff.
      </p>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12, minWidth: 980 }}>
          <thead>
            <tr style={{ background: 'var(--gray-light)' }}>
              <Th style={{ width: 24 }}></Th>
              <Th>Employee Code</Th>
              <Th>Role</Th>
              <Th></Th>
              <Th>First Name</Th>
              <Th>Last Name</Th>
              <Th>Email</Th>
              <Th>Phone</Th>
              <Th>Skills</Th>
              <Th>Notes</Th>
              <Th>Status</Th>
            </tr>
          </thead>
          <tbody>
            {visibleStaff.map((person) => (
              <tr
                key={person.id}
                style={{ borderBottom: '1px solid var(--gray-light)', opacity: person.isActive === false ? 0.6 : 1 }}
                onPointerEnter={() => handleRowPointerEnter(person.id)}
              >
                <Td>
                  <div
                    onPointerDown={(e) => handleGripPointerDown(e, person.id)}
                    style={{ cursor: 'grab', color: 'var(--gray)', fontSize: 14, userSelect: 'none', padding: '0 4px', lineHeight: 1 }}
                    title="Drag to reorder"
                  >⠿</div>
                </Td>
                <Td><span style={{ fontFamily: "'DM Mono', monospace" }}>{person.employeeCode || '—'}</span></Td>
                <Td>{person.role || '—'}</Td>
                <Td>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button onClick={() => onEditStaff(person)} style={{ ...actionBtnStyle, fontSize: 11, padding: '3px 8px', color: 'var(--purple)' }}>Edit</button>
                    <button
                      onClick={() => toggleStaff(person.id)}
                      style={{ ...actionBtnStyle, fontSize: 11, padding: '3px 8px', color: person.isActive === false ? 'var(--purple)' : 'var(--red)' }}
                    >
                      {person.isActive === false ? 'Reactivate' : 'Deactivate'}
                    </button>
                  </div>
                </Td>
                <Td>{person.firstName || '—'}</Td>
                <Td>{person.lastName || '—'}</Td>
                <Td>{person.email || '—'}</Td>
                <Td>{person.phone || '—'}</Td>
                <Td>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, maxWidth: 180 }}>
                    {(person.skillIds || [])
                      .map((skillId) => skillById[skillId])
                      .filter(Boolean)
                      .slice(0, 3)
                      .map((skill) => (
                        <span
                          key={`${person.id}-${skill.id}`}
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 4,
                            padding: '2px 6px',
                            borderRadius: 999,
                            background: skill.isActive === false ? 'var(--gray-light)' : 'var(--purple-pale)',
                            color: skill.isActive === false ? 'var(--gray)' : 'var(--purple)',
                            fontSize: 10,
                            fontWeight: 600,
                            border: skill.isActive === false ? '1px solid #d6dbe3' : 'none',
                          }}
                        >
                          {skill.label || skill.code}
                          {skill.isActive === false ? ' (Inactive)' : ''}
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              removeSkillFromStaff(person.id, skill.id);
                            }}
                            title={`Remove ${skill.label || skill.code}`}
                            style={{
                              border: 'none',
                              background: 'transparent',
                              color: 'inherit',
                              cursor: 'pointer',
                              fontSize: 10,
                              lineHeight: 1,
                              padding: 0,
                              marginLeft: 2,
                              opacity: 0.8,
                            }}
                          >
                            ×
                          </button>
                        </span>
                      ))}
                    {(person.skillIds || []).length > 3 && (
                      <span style={{ fontSize: 10, color: 'var(--gray)', alignSelf: 'center' }}>
                        +{(person.skillIds || []).length - 3} more
                      </span>
                    )}
                    {(person.skillIds || []).length === 0 && (
                      <span style={{ fontSize: 10, color: 'var(--gray)' }}>No skills</span>
                    )}
                  </div>
                </Td>
                <Td><div style={{ maxWidth: 180, color: person.notes ? 'var(--dark)' : 'var(--gray)' }}>{person.notes || '—'}</div></Td>
                <Td>
                  <span style={{
                    fontSize: 10,
                    fontWeight: 700,
                    letterSpacing: '0.04em',
                    color: person.isActive === false ? 'var(--red)' : '#4CAF50',
                  }}>
                    {person.isActive === false ? 'INACTIVE' : 'ACTIVE'}
                  </span>
                </Td>
              </tr>
            ))}
            {visibleStaff.length === 0 && (
              <tr>
                <Td colSpan={11} style={{ color: 'var(--gray)', fontStyle: 'italic' }}>
                  {showInactive
                    ? 'No staff yet. Add your first team member to get started.'
                    : 'No active staff. Toggle inactive staff or add a new team member.'}
                </Td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <div style={{ marginTop: 14, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
        <button
          onClick={onCreateStaff}
          style={{
            padding: '8px 16px', borderRadius: 7, border: '1.5px dashed var(--purple-light)',
            background: 'transparent', color: 'var(--purple)', fontSize: 12,
            fontWeight: 600, fontFamily: "'DM Sans', sans-serif", cursor: 'pointer',
          }}
        >+ Add Staff</button>
        <button
          onClick={() => setShowInactive((prev) => !prev)}
          style={{
            padding: '8px 14px',
            borderRadius: 7,
            border: '1px solid var(--gray-light)',
            background: 'var(--cream)',
            color: 'var(--dark)',
            fontSize: 12,
            fontWeight: 600,
            fontFamily: "'DM Sans', sans-serif",
            cursor: 'pointer',
          }}
        >
          {showInactive ? 'Hide Inactive Staff' : 'Show Inactive Staff'}
        </button>
      </div>
    </div>
  );
}

export function StaffEditorModal({ initialData, skillsData, onSave, onClose }) {
  const activeSkills = skillsData.filter((skill) => skill.isActive !== false);
  const [local, setLocal] = useState({
    id: initialData?.id,
    employeeCode: initialData?.employeeCode || '',
    role: initialData?.role || '',
    firstName: initialData?.firstName || '',
    lastName: initialData?.lastName || '',
    email: initialData?.email || '',
    phone: initialData?.phone || '',
    notes: initialData?.notes || '',
    isActive: initialData?.isActive !== false,
    skillIds: initialData?.skillIds || [],
  });
  const inactiveAssignedSkills = skillsData.filter(
    (skill) => skill.isActive === false && local.skillIds.includes(skill.id)
  );

  function toggleSkill(skillId) {
    setLocal((prev) => ({
      ...prev,
      skillIds: prev.skillIds.includes(skillId)
        ? prev.skillIds.filter((id) => id !== skillId)
        : [...prev.skillIds, skillId],
    }));
  }

  function handleSave() {
    if (!local.employeeCode.trim() || !local.firstName.trim() || !local.lastName.trim()) {
      window.alert('Employee code, first name, and last name are required.');
      return;
    }
    onSave({
      ...local,
      employeeCode: local.employeeCode.trim().toUpperCase(),
      role: local.role.trim(),
      firstName: local.firstName.trim(),
      lastName: local.lastName.trim(),
      email: local.email.trim(),
      phone: local.phone.trim(),
      notes: local.notes.trim(),
    });
  }

  return (
    <Modal title={initialData ? `Edit Staff: ${initialData.firstName} ${initialData.lastName}` : 'Add Staff'} onClose={onClose} width={620}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 12 }}>
          <div>
            <label style={editLabelStyle}>Employee Code</label>
            <input
              value={local.employeeCode}
              maxLength={20}
              onChange={(e) => setLocal((prev) => ({ ...prev, employeeCode: e.target.value.replace(/\s+/g, '') }))}
              style={editInputStyle}
            />
          </div>
          <div>
            <label style={editLabelStyle}>Role</label>
            <input value={local.role} onChange={(e) => setLocal((prev) => ({ ...prev, role: e.target.value }))} style={editInputStyle} />
          </div>
          <div>
            <label style={editLabelStyle}>First Name</label>
            <input value={local.firstName} onChange={(e) => setLocal((prev) => ({ ...prev, firstName: e.target.value }))} style={editInputStyle} />
          </div>
          <div>
            <label style={editLabelStyle}>Last Name</label>
            <input value={local.lastName} onChange={(e) => setLocal((prev) => ({ ...prev, lastName: e.target.value }))} style={editInputStyle} />
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div>
            <label style={editLabelStyle}>Email</label>
            <input type="email" value={local.email} onChange={(e) => setLocal((prev) => ({ ...prev, email: e.target.value }))} style={editInputStyle} />
          </div>
          <div>
            <label style={editLabelStyle}>Phone</label>
            <input value={local.phone} onChange={(e) => setLocal((prev) => ({ ...prev, phone: e.target.value }))} style={editInputStyle} />
          </div>
        </div>

        <div>
          <label style={editLabelStyle}>Notes</label>
          <textarea
            rows={3}
            value={local.notes}
            onChange={(e) => setLocal((prev) => ({ ...prev, notes: e.target.value }))}
            placeholder="Optional notes…"
            style={{ ...editInputStyle, resize: 'vertical', fontFamily: "'DM Sans', sans-serif" }}
          />
        </div>

        <div>
          <label style={editLabelStyle}>Skills</label>
          <div style={{
            border: '1.5px solid var(--gray-light)',
            borderRadius: 8,
            padding: 12,
            display: 'grid',
            gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
            gap: 8,
            maxHeight: 220,
            overflowY: 'auto',
          }}>
            {activeSkills.map((skill) => (
              <label key={skill.id} style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={local.skillIds.includes(skill.id)}
                  onChange={() => toggleSkill(skill.id)}
                  style={{ accentColor: 'var(--purple)' }}
                />
                <span style={{ fontSize: 12, color: 'var(--dark)' }}>
                  <strong>{skill.code}</strong> · {skill.label}
                </span>
              </label>
            ))}
            {activeSkills.length === 0 && inactiveAssignedSkills.length === 0 && (
              <span style={{ fontSize: 12, color: 'var(--gray)' }}>No active skills yet.</span>
            )}
          </div>
          {inactiveAssignedSkills.length > 0 && (
            <div style={{
              marginTop: 10,
              padding: '10px 12px',
              border: '1px solid #d6dbe3',
              borderRadius: 8,
              background: '#f7f8fa',
            }}>
              <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase', color: 'var(--gray)', marginBottom: 8 }}>
                Inactive Assigned Skills
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 8 }}>
                {inactiveAssignedSkills.map((skill) => (
                  <label key={skill.id} style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', opacity: 0.75 }}>
                    <input
                      type="checkbox"
                      checked={local.skillIds.includes(skill.id)}
                      onChange={() => toggleSkill(skill.id)}
                      style={{ accentColor: '#94a3b8' }}
                    />
                    <span style={{ fontSize: 12, color: 'var(--gray)' }}>
                      <strong>{skill.code}</strong> · {skill.label} (Inactive)
                    </span>
                  </label>
                ))}
              </div>
              <div style={{ fontSize: 11, color: 'var(--gray)', marginTop: 8 }}>
                Inactive skills are kept on existing staff records for reference, but cannot be newly assigned.
              </div>
            </div>
          )}
        </div>
      </div>
      <ModalFooter>
        <Btn onClick={onClose} variant="secondary">Cancel</Btn>
        <Btn onClick={handleSave} variant="primary">Save</Btn>
      </ModalFooter>
    </Modal>
  );
}

function Th({ children, style, ...props }) {
  return (
    <th style={{
      padding: '6px 10px',
      textAlign: 'left',
      fontSize: 10,
      fontWeight: 700,
      letterSpacing: '0.06em',
      textTransform: 'uppercase',
      color: 'var(--gray)',
      ...style,
    }} {...props}>{children}</th>
  );
}

function Td({ children, style, ...props }) {
  return (
    <td style={{ padding: '6px 10px', ...style }} {...props}>
      {children}
    </td>
  );
}

const actionBtnStyle = {
  padding: '2px 5px',
  borderRadius: 4,
  border: '1px solid var(--gray-light)',
  background: 'none',
  cursor: 'pointer',
  fontSize: 12,
  lineHeight: 1,
  color: 'var(--gray)',
};

const editLabelStyle = {
  display: 'block', fontSize: 11, fontWeight: 700,
  color: 'var(--gray)', marginBottom: 6, letterSpacing: '0.05em', textTransform: 'uppercase',
};

const editInputStyle = {
  width: '100%', padding: '8px 10px', borderRadius: 7,
  border: '1.5px solid var(--gray-light)', fontSize: 13,
  fontFamily: "'DM Sans', sans-serif", color: 'var(--dark)',
  background: '#fff', outline: 'none', boxSizing: 'border-box',
};
