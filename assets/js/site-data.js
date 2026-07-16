/*
  THIS IS THE ONLY FILE THAT SHOULD NEED OCCASIONAL EDITING.

  Weekly schedule keys follow JavaScript weekdays:
  0 = Sunday, 1 = Monday ... 6 = Saturday.

  To close a special date:
  { date: "2026-08-15", closed: true, noteDe: "Geschlossen", noteEn: "Closed" }

  To use special hours:
  { date: "2026-08-21", hours: [{ start: "13:00", end: "18:00" }], noteDe: "Heute später", noteEn: "Opening later today" }
*/
window.NICHI_SITE = {
  timeZone: "Europe/Berlin",

  weeklyHours: {
    0: [{ start: "12:00", end: "18:00" }],
    1: [{ start: "12:00", end: "14:00" }],
    2: [{ start: "12:00", end: "14:00" }],
    3: [],
    4: [],
    5: [{ start: "12:00", end: "18:00" }],
    6: [{ start: "12:00", end: "18:00" }]
  },

  specialDates: [],

  publicNotice: {
    active: false,
    de: "",
    en: ""
  }
};

window.NICHI_BILINGUAL_HOURS = [
  { deDay: "MO–DI", enDay: "MON–TUE", deTime: "12–14 Uhr", enTime: "12:00–14:00" },
  { deDay: "MI–DO", enDay: "WED–THU", deTime: "geschlossen", enTime: "Closed" },
  { deDay: "FR–SO", enDay: "FRI–SUN", deTime: "12–18 Uhr", enTime: "12:00–18:00" }
];
