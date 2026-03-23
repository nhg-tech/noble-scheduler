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

// Build time slots: 5:00am to 9:30pm in 30-min increments
export const TIME_SLOTS = [];
for (let h = 5; h <= 21; h++) {
  TIME_SLOTS.push({ hour: h, min: 0, label: h <= 12 ? `${h}:00a` : `${h-12}:00p`, isHour: true });
  if (h < 21) TIME_SLOTS.push({ hour: h, min: 30, label: h < 12 ? `${h}:30a` : `${h-12}:30p`, isHour: false });
}
TIME_SLOTS.push({ hour: 21, min: 30, label: '9:30p', isHour: false });
