/*
  Weekly schedule and permanent fallback data.

  Weekly schedule keys follow JavaScript weekdays:
  0 = Sunday, 1 = Monday ... 6 = Saturday.

  One-day closures and special hours can now be set from the
  NichiNichi Cockpit. The specialDates list below remains as a
  static fallback for longer planned closures if needed.
*/
window.NICHI_SITE = {
  timeZone: "Europe/Berlin",
  liveStateEndpoint: "https://nichinichi-status.fangphaedra.workers.dev/state",

  weeklyHours: {
    0: [{ start: "12:00", end: "18:00", kind: "cafe" }],
    1: [
      { start: "12:00", end: "14:00", kind: "cafe" },
      { start: "18:00", end: "20:00", kind: "mondstube" }
    ],
    2: [
      { start: "12:00", end: "14:00", kind: "cafe" },
      { start: "18:00", end: "20:00", kind: "mondstube" }
    ],
    3: [],
    4: [],
    5: [
      { start: "12:00", end: "14:00", kind: "cafe" },
      { start: "18:00", end: "20:00", kind: "mondstube" }
    ],
    6: [{ start: "12:00", end: "18:00", kind: "cafe" }]
  },

  specialDates: [],

  publicNotice: {
    active: false,
    de: "",
    en: ""
  }
};

window.NICHI_BILINGUAL_HOURS = [
  { deDay: "CAFÉ · MO–DI", enDay: "CAFÉ · MON–TUE", deTime: "12–14 Uhr", enTime: "12:00–14:00" },
  { deDay: "CAFÉ · MI–DO", enDay: "CAFÉ · WED–THU", deTime: "geschlossen", enTime: "Closed" },
  { deDay: "CAFÉ · FR", enDay: "CAFÉ · FRI", deTime: "12–14 Uhr", enTime: "12:00–14:00" },
  { deDay: "CAFÉ · SA–SO", enDay: "CAFÉ · SAT–SUN", deTime: "12–18 Uhr", enTime: "12:00–18:00" },
  { deDay: "MONDSTUBE · MO–DI & FR", enDay: "MONDSTUBE · MON–TUE & FRI", deTime: "18–20 Uhr", enTime: "18:00–20:00" }
];
