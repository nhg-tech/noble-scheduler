export const ROLES = [
  { id: 'GM',      label: 'GM',          sub: 'General Mgr', type: 'GM',  shiftStart: 6.5,  shiftEnd: 15.0, hours: 8.0, unpaidBreak: 0  },
  { id: 'MR',      label: 'MR',          sub: 'Mgr on Duty', type: 'MR',  shiftStart: 13.0, shiftEnd: 21.5, hours: 8.0, unpaidBreak: 0  },
  { id: 'PAW',     label: 'PAW',         sub: 'Pawcierge',   type: 'PAW', shiftStart: 7.0,  shiftEnd: 15.0, hours: 7.5, unpaidBreak: 0  },
  { id: 'TL_AM',   label: 'TL AM',       sub: 'Team Lead',   type: 'TL',  shiftStart: 6.0,  shiftEnd: 14.0, hours: 7.5, unpaidBreak: 30 },
  { id: 'SOC_BD',  label: 'Soc 1BG AM',  sub: 'TM',          type: 'TM',  shiftStart: 6.5,  shiftEnd: 14.0, hours: 7.0, unpaidBreak: 30 },
  { id: 'SOC_SM',  label: 'Soc 1SM AM',  sub: 'TM',          type: 'TM',  shiftStart: 6.5,  shiftEnd: 14.0, hours: 7.0, unpaidBreak: 30 },
  { id: 'SEL_MID', label: 'Sel Mid1',    sub: 'TM',          type: 'TM',  shiftStart: 9.0,  shiftEnd: 17.0, hours: 7.5, unpaidBreak: 30 },
  { id: 'SOC_BPM', label: 'Soc 1BG PM', sub: 'TM',           type: 'TM',  shiftStart: 13.5, shiftEnd: 21.0, hours: 7.0, unpaidBreak: 30 },
  { id: 'SOC_SPM', label: 'Soc 1SM PM', sub: 'TM',           type: 'TM',  shiftStart: 13.5, shiftEnd: 21.0, hours: 7.0, unpaidBreak: 30 },
  { id: 'TL_PM',   label: 'TL PM',       sub: 'Team Lead',   type: 'TL',  shiftStart: 13.5, shiftEnd: 21.5, hours: 7.5, unpaidBreak: 30 },
  { id: 'UTL_MID', label: 'UTL Mid1',    sub: 'TM',          type: 'TM',  shiftStart: 9.0,  shiftEnd: 17.0, hours: 7.5, unpaidBreak: 30 },
  { id: 'ON',      label: 'ON',          sub: 'Overnight',   type: 'ON',  shiftStart: 21.0, shiftEnd: 6.5,  hours: 9.5, unpaidBreak: 0  },
];

// Build time slots: 5:00am → 6:30am next day (covers full overnight shift)
// Hours 24+ represent post-midnight (24=midnight, 25=1am, 30=6am next day)
// Granularity: 15-minute slots (4 per hour). Labels shown only on the :00 row.
export const TIME_SLOTS = [];
function _slotLabel(h, m) {
  const d = h % 24; // display hour (0–23)
  const isPM = d >= 12;
  const h12 = d === 0 ? 12 : d > 12 ? d - 12 : d;
  const suffix = isPM ? 'p' : 'a';
  return m === 0 ? `${h12}:00${suffix}` : `${h12}:${String(m).padStart(2, '0')}${suffix}`;
}
for (let h = 5; h <= 30; h++) {
  const isMidnight = h === 24;
  TIME_SLOTS.push({ hour: h, min:  0, label: _slotLabel(h,  0), isHour: true,  isMidnight });
  TIME_SLOTS.push({ hour: h, min: 15, label: _slotLabel(h, 15), isHour: false, isMidnight: false });
  TIME_SLOTS.push({ hour: h, min: 30, label: _slotLabel(h, 30), isHour: false, isMidnight: false });
  // Don't add :45 for the last hour — grid ends at 6:30am (h=30 min=30)
  if (h < 30) TIME_SLOTS.push({ hour: h, min: 45, label: _slotLabel(h, 45), isHour: false, isMidnight: false });
}
// Final entry is h=30 min=30 (6:30am next day) — correct.
