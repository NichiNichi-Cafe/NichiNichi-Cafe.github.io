/*
  THIS IS THE ONLY FILE THAT SHOULD NEED OCCASIONAL EDITING.

  Weekly schedule keys follow JavaScript weekdays:
  0 = Sunday, 1 = Monday ... 6 = Saturday.

  To close a special date:
  { date: "2026-08-15", closed: true, noteDe: "Geschlossen", noteEn: "Closed" }

  To use special hours:
  { date: "2026-08-21", hours: [{ start: "13:00", end: "18:00", kind: "cafe" }], noteDe: "Heute später", noteEn: "Opening later today" }
*/
window.NICHI_SITE = {
  timeZone: "Europe/Berlin",

  weeklyHours: {
    0: [{ start: "12:00", end: "18:00", kind: "cafe" }],
    1: [
      { start: "12:00", end: "14:00", kind: "cafe" },
      { start: "18:30", end: "20:30", kind: "mondstube" }
    ],
    2: [
      { start: "12:00", end: "14:00", kind: "cafe" },
      { start: "18:30", end: "20:30", kind: "mondstube" }
    ],
    3: [],
    4: [],
    5: [{ start: "12:00", end: "18:00", kind: "cafe" }],
    6: [{ start: "12:00", end: "18:00", kind: "cafe" }]
  },

  specialDates: [
    {
      date: "2026-08-12",
      closed: true,
      noteDe: "Sommerpause · wieder geöffnet am Montag, 17. August",
      noteEn: "Summer break · back on Monday, 17 August"
    },
    {
      date: "2026-08-13",
      closed: true,
      noteDe: "Sommerpause · wieder geöffnet am Montag, 17. August",
      noteEn: "Summer break · back on Monday, 17 August"
    },
    {
      date: "2026-08-14",
      closed: true,
      noteDe: "Sommerpause · wieder geöffnet am Montag, 17. August",
      noteEn: "Summer break · back on Monday, 17 August"
    },
    {
      date: "2026-08-15",
      closed: true,
      noteDe: "Sommerpause · wieder geöffnet am Montag, 17. August",
      noteEn: "Summer break · back on Monday, 17 August"
    },
    {
      date: "2026-08-16",
      closed: true,
      noteDe: "Sommerpause · wieder geöffnet am Montag, 17. August",
      noteEn: "Summer break · back on Monday, 17 August"
    }
  ],

  publicNotice: {
    active: false,
    de: "",
    en: ""
  }
};

window.NICHI_BILINGUAL_HOURS = [
  { deDay: "CAFÉ · MO–DI", enDay: "CAFÉ · MON–TUE", deTime: "12–14 Uhr", enTime: "12:00–14:00" },
  { deDay: "CAFÉ · MI–DO", enDay: "CAFÉ · WED–THU", deTime: "geschlossen", enTime: "Closed" },
  { deDay: "CAFÉ · FR–SO", enDay: "CAFÉ · FRI–SUN", deTime: "12–18 Uhr", enTime: "12:00–18:00" },
  { deDay: "MONDSTUBE · MO–DI", enDay: "MONDSTUBE · MON–TUE", deTime: "18:30–20:30 Uhr", enTime: "18:30–20:30" }
];
