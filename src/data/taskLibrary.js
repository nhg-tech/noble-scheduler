export const TASK_LIBRARY = [
  // Group
  { id:'GPB_SOC_AM', name:'Soc Potty Breaks - AM',  code:'SocPB-am',  cat:'group', color:'block-group', slots:1, unitMin:20,  unitBasis:'per SocPG',         idealStart:'7:00am',  expectedInstances:'socpg',   desc:'Social group AM potty break' },
  { id:'GPB_SOC_PM', name:'Soc Potty Breaks - PM',  code:'SocPB-pm',  cat:'group', color:'block-group', slots:1, unitMin:20,  unitBasis:'per SocPG',         idealStart:'7:00pm',  expectedInstances:'socpg',   desc:'Social group PM potty break' },
  { id:'GPB_SEL_AM', name:'Sel Potty Breaks - AM',  code:'SelPB-am',  cat:'group', color:'block-group', slots:1, unitMin:15,  unitBasis:'per SelPG',         idealStart:'7:00am',  expectedInstances:'selpg',   desc:'Select group AM potty break' },
  { id:'GPB_SEL_PM', name:'Sel Potty Breaks - PM',  code:'SelPB-pm',  cat:'group', color:'block-group', slots:1, unitMin:15,  unitBasis:'per SelPG',         idealStart:'7:00pm',  expectedInstances:'selpg',   desc:'Select group PM potty break' },
  { id:'PG_PREP',    name:'PG Prep',                code:'PG-Prep',   cat:'group', color:'block-group', slots:1, unitMin:30,  unitBasis:'fixed',             idealStart:'7:30am',  expectedInstances:1,         desc:'Play group preparation' },
  { id:'PGM',        name:'PG Management',          code:'PGM',       cat:'group', color:'block-group', slots:1, unitMin:30,  unitBasis:'per group',         idealStart:'8:00am',  expectedInstances:'socpg*2', desc:'Play group oversight' },
  { id:'SOC_AM_BD',  name:'Social AM Big Dogs',     code:'SocPG-BD',  cat:'group', color:'block-group', slots:6, unitMin:150, unitBasis:'per group (2.5h)',  idealStart:'8:00am',  expectedInstances:1,         desc:'Noble Social AM · Big Dogs · 2.5 hrs' },
  { id:'SOC_AM_SM',  name:'Social AM Sm Dogs',      code:'SocPG-SD',  cat:'group', color:'block-group', slots:6, unitMin:150, unitBasis:'per group (2.5h)',  idealStart:'8:30am',  expectedInstances:1,         desc:'Noble Social AM · Small Dogs · 2.5 hrs' },
  { id:'SEL_AM1',    name:'Select AM 1',            code:'SelPG-am1', cat:'group', color:'block-group', slots:2, unitMin:60,  unitBasis:'per group (1h)',    idealStart:'9:00am',  expectedInstances:1,         desc:'Noble Select AM Group 1 · 1 hr' },
  { id:'SEL_AM2',    name:'Select AM 2',            code:'SelPG-am2', cat:'group', color:'block-group', slots:2, unitMin:60,  unitBasis:'per group (1h)',    idealStart:'10:30am', expectedInstances:1,         desc:'Noble Select AM Group 2 · 1 hr' },
  { id:'SOC_PM_BD',  name:'Social PM Big Dogs',     code:'SocPG-BDp', cat:'group', color:'block-group', slots:6, unitMin:150, unitBasis:'per group (2.5h)',  idealStart:'2:00pm',  expectedInstances:1,         desc:'Noble Social PM · Big Dogs · 2.5 hrs' },
  { id:'SOC_PM_SM',  name:'Social PM Sm Dogs',      code:'SocPG-SDp', cat:'group', color:'block-group', slots:6, unitMin:150, unitBasis:'per group (2.5h)',  idealStart:'2:00pm',  expectedInstances:1,         desc:'Noble Social PM · Small Dogs · 2.5 hrs' },
  { id:'SEL_PM1',    name:'Select PM 1',            code:'SelPG-pm1', cat:'group', color:'block-group', slots:2, unitMin:60,  unitBasis:'per group (1h)',    idealStart:'2:30pm',  expectedInstances:1,         desc:'Noble Select PM Group 1 · 1 hr' },
  { id:'SEL_PM2',    name:'Select PM 2',            code:'SelPG-pm2', cat:'group', color:'block-group', slots:2, unitMin:60,  unitBasis:'per group (1h)',    idealStart:'4:00pm',  expectedInstances:1,         desc:'Noble Select PM Group 2 · 1 hr' },
  // Suite
  { id:'SC1',   name:'SC Potty Breaks - AM',        code:'SC1',       cat:'suite', color:'block-suite', slots:1, unitMin:5,   unitBasis:'per suite (10/hr)', idealStart:'7:00am',  expectedInstances:2,         desc:'Individual AM potty · 5 min/suite' },
  { id:'SC4',   name:'SC Potty Breaks - PM',        code:'SC4',       cat:'suite', color:'block-suite', slots:1, unitMin:5,   unitBasis:'per suite (10/hr)', idealStart:'8:00pm',  expectedInstances:1,         desc:'Individual PM potty · 5 min/suite' },
  { id:'SC2',   name:'Personal/Family Play AM',     code:'SC2',       cat:'suite', color:'block-suite', slots:3, unitMin:15,  unitBasis:'per suite (3/hr)',  idealStart:'10:00am', expectedInstances:2,         desc:'Personal/Family play AM · 15 min/suite' },
  { id:'SC3',   name:'Personal/Family Play PM',     code:'SC3',       cat:'suite', color:'block-suite', slots:3, unitMin:15,  unitBasis:'per suite (3/hr)',  idealStart:'3:00pm',  expectedInstances:1,         desc:'Personal/Family play PM · 15 min/suite' },
  { id:'CATS',  name:'Cats',                        code:'CATS',      cat:'suite', color:'block-suite', slots:3, unitMin:10,  unitBasis:'per bungalow (75%)',idealStart:'11:00am', expectedInstances:1,         desc:'Cat interaction · 10 min/bungalow (75%)' },
  { id:'HK',    name:'Housekeeping',                code:'HK',        cat:'suite', color:'block-suite', slots:5, unitMin:3,   unitBasis:'per suite',         idealStart:'9:00am',  expectedInstances:1,         desc:'Suite tidy · 3 min/suite' },
  { id:'SC_CS', name:'Spot Check Suites',           code:'SC-CS',     cat:'suite', color:'block-suite', slots:2, unitMin:12,  unitBasis:'per suite (est.)',  idealStart:'3:00pm',  expectedInstances:1,         desc:'Suite checks after groups' },
  // Meals
  { id:'BRFT',  name:'Breakfasts',                  code:'BRFT',      cat:'meals', color:'block-meals', slots:2, unitMin:3,   unitBasis:'per suite/bungalow',idealStart:'6:30am',  expectedInstances:2,         desc:'Breakfast all guests · 3 min/suite' },
  { id:'LUN',   name:'Lunches',                     code:'LUN',       cat:'meals', color:'block-meals', slots:1, unitMin:1,   unitBasis:'per suite (max 60)',idealStart:'12:00pm', expectedInstances:1,         desc:'Lunch subset guests · 1 min/suite' },
  { id:'DIN',   name:'Dinners',                     code:'DIN',       cat:'meals', color:'block-meals', slots:2, unitMin:3,   unitBasis:'per suite/bungalow',idealStart:'6:00pm',  expectedInstances:2,         desc:'Dinner all guests · 3 min/suite' },
  { id:'TUCK',  name:'Tuck-ins',                    code:'TUCK',      cat:'meals', color:'block-meals', slots:1, unitMin:2,   unitBasis:'per suite',         idealStart:'8:00pm',  expectedInstances:2,         desc:'Night cuddle + health check · 2 min/suite' },
  // Fixed
  { id:'SC_PA', name:'Spot Clean Play Areas',       code:'SC-PA',     cat:'fixed', color:'block-fixed', slots:1, unitMin:15,  unitBasis:'per play area',    idealStart:'11:00am', expectedInstances:1,         desc:'Post-AM group · 15 min/area' },
  { id:'SC_CA', name:'Spot Clean Common Areas',     code:'SC-CA',     cat:'fixed', color:'block-fixed', slots:2, unitMin:30,  unitBasis:'fixed (2x daily)', idealStart:'10:00am', expectedInstances:2,         desc:'Common areas · 30 min · 2x daily' },
  { id:'MB',    name:'Mop Buckets',                 code:'MB',        cat:'fixed', color:'block-fixed', slots:1, unitMin:30,  unitBasis:'fixed (3x daily)', idealStart:'10:00am', expectedInstances:3,         desc:'Change mop buckets · 30 min · 3x daily' },
  { id:'CLS',   name:'Closing Tasks',               code:'CLS',       cat:'fixed', color:'block-fixed', slots:2, unitMin:60,  unitBasis:'fixed',            idealStart:'8:00pm',  expectedInstances:2,         desc:'End of day closing · 60 min' },
  { id:'HUD',   name:'Team Huddle',                 code:'HUD',       cat:'fixed', color:'block-fixed', slots:1, unitMin:30,  unitBasis:'fixed',            idealStart:'1:30pm',  expectedInstances:'roles',   desc:'All-hands · 1:30pm · 30 min' },
  { id:'TL_ADAM',name:'TL Admin AM',                code:'TL-ADam',   cat:'fixed', color:'block-fixed', slots:2, unitMin:60,  unitBasis:'fixed',            idealStart:'12:00pm', expectedInstances:1,         desc:'TL admin · 60 min · incl next-day schedule' },
  { id:'TL_ADPM',name:'TL Admin PM / FD',           code:'TL-ADpm',   cat:'fixed', color:'block-fixed', slots:4, unitMin:60,  unitBasis:'fixed',            idealStart:'7:00pm',  expectedInstances:1,         desc:'TL admin + front desk · 7–9pm' },
  { id:'PAW_SVC',name:'Pawcierge',                  code:'PAW',       cat:'fixed', color:'block-fixed', slots:2, unitMin:30,  unitBasis:'per shift block',  idealStart:'7:00am',  expectedInstances:1,         desc:'Front desk + guest services' },
  { id:'BRK30', name:'Break 30 min',                code:'BRK-30',    cat:'fixed', color:'block-fixed', slots:1, unitMin:30,  unitBasis:'per employee',     idealStart:'Various', expectedInstances:'roles',   desc:'Mandatory 30-min break' },
  { id:'RNR',   name:'R&R',                         code:'R&R',       cat:'fixed', color:'block-fixed', slots:3, unitMin:90,  unitBasis:'fixed',            idealStart:'10:30am', expectedInstances:1,         desc:'Rest & relaxation between groups' },
  // Overnight
  { id:'ON_WT', name:'ON Walkthrough',              code:'ON-WT',     cat:'on',    color:'block-on',    slots:1, unitMin:15,  unitBasis:'fixed (min 15min)',idealStart:'6:00am',  expectedInstances:2,         desc:'Overnight walkthrough · 15 min min' },
];

export const CAT_LABELS = {
  group: 'Play Groups',
  suite: 'Suite Care',
  meals: 'Meals',
  fixed: 'Fixed Tasks',
  on:    'Overnight',
};

export const CAT_ORDER = ['group', 'suite', 'meals', 'fixed', 'on'];
