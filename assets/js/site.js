(() => {
  "use strict";

  function initNichiSite() {
    const config = window.NICHI_SITE || {};
    const languageButtons = document.querySelectorAll("[data-language]");
    const languageNodes = document.querySelectorAll("[data-lang]");
    const localizedAriaNodes = document.querySelectorAll("[data-aria-label-de][data-aria-label-en]");
    const localizedAltImages = document.querySelectorAll("img[data-alt-de][data-alt-en]");
    const statusElement = document.getElementById("today-status");
    const nextElement = document.getElementById("next-opening");
    const noticeBox = document.getElementById("public-notice");
    const noticeText = document.getElementById("public-notice-text");

    function readStoredLanguage() {
      try { return localStorage.getItem("nichinichi-language"); }
      catch (_) { return null; }
    }

    function storeLanguage(language) {
      try { localStorage.setItem("nichinichi-language", language); }
      catch (_) { /* Local previews may block storage. */ }
    }

    let currentLanguage = readStoredLanguage() || "de";
    if (!["de", "en"].includes(currentLanguage)) currentLanguage = "de";

    function partsForTimeZone(date) {
      const parts = new Intl.DateTimeFormat("en-CA", {
        timeZone: config.timeZone || "Europe/Berlin",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        hourCycle: "h23"
      }).formatToParts(date);

      return Object.fromEntries(
        parts
          .filter(part => part.type !== "literal")
          .map(part => [part.type, part.value])
      );
    }

    function dateKeyFromParts(parts) {
      return `${parts.year}-${parts.month}-${parts.day}`;
    }

    function dateKeyPlusDays(dateKey, days) {
      const [year, month, day] = dateKey.split("-").map(Number);
      return new Date(Date.UTC(year, month - 1, day + days, 12))
        .toISOString()
        .slice(0, 10);
    }

    function weekdayForDateKey(dateKey) {
      const [year, month, day] = dateKey.split("-").map(Number);
      return new Date(Date.UTC(year, month - 1, day, 12)).getUTCDay();
    }

    function specialDate(dateKey) {
      return (config.specialDates || []).find(item => item.date === dateKey) || null;
    }

    function hoursForDate(dateKey) {
      const special = specialDate(dateKey);
      if (special?.closed) return [];
      if (Array.isArray(special?.hours)) return special.hours;
      return config.weeklyHours?.[weekdayForDateKey(dateKey)] || [];
    }

    function minutes(value) {
      const [hours, mins] = value.split(":").map(Number);
      return hours * 60 + mins;
    }

    function formatTime(value, language) {
      if (language === "en") return value;
      return value.replace(/^0/, "");
    }

    function formatDate(dateKey, language, options = {}) {
      const [year, month, day] = dateKey.split("-").map(Number);
      const date = new Date(Date.UTC(year, month - 1, day, 12));

      return new Intl.DateTimeFormat(language === "de" ? "de-DE" : "en-GB", {
        timeZone: "UTC",
        weekday: options.weekday === false ? undefined : "long",
        day: "numeric",
        month: "long"
      }).format(date);
    }

    function findNextOpenDate(todayKey, includeToday = false) {
      for (let offset = includeToday ? 0 : 1; offset <= 21; offset += 1) {
        const key = dateKeyPlusDays(todayKey, offset);
        const hours = hoursForDate(key);
        if (hours.length) return { key, hours };
      }
      return null;
    }

    function formatRange(slot, language) {
      const start = formatTime(slot.start, language);
      const end = formatTime(slot.end, language);
      return language === "de" ? `${start}–${end} Uhr` : `${start}–${end}`;
    }

    function renderStatus() {
      if (!statusElement || !nextElement) return;

      try {
        const nowParts = partsForTimeZone(new Date());
        const todayKey = dateKeyFromParts(nowParts);
        const nowMinutes = Number(nowParts.hour) * 60 + Number(nowParts.minute);
        const todayHours = hoursForDate(todayKey);
        const special = specialDate(todayKey);
        const language = currentLanguage;
        let status = "";
        let next = "";

        if (!todayHours.length) {
          status = language === "de" ? "Heute geschlossen" : "Closed today";
          const nextOpen = findNextOpenDate(todayKey);

          if (nextOpen) {
            next = language === "de"
              ? `Nächster Café-Tag: ${formatDate(nextOpen.key, language)} · ${formatRange(nextOpen.hours[0], language)}`
              : `Next café opening: ${formatDate(nextOpen.key, language)} · ${formatRange(nextOpen.hours[0], language)}`;
          }
        } else {
          const currentSlot = todayHours.find(
            slot => nowMinutes >= minutes(slot.start) && nowMinutes < minutes(slot.end)
          );
          const futureSlot = todayHours.find(slot => nowMinutes < minutes(slot.start));

          if (currentSlot) {
            status = language === "de"
              ? `Jetzt geöffnet · bis ${formatTime(currentSlot.end, language)} Uhr`
              : `Open now · until ${formatTime(currentSlot.end, language)}`;
          } else if (futureSlot) {
            status = language === "de"
              ? `Heute ab ${formatTime(futureSlot.start, language)} Uhr geöffnet`
              : `Open today from ${formatTime(futureSlot.start, language)}`;
          } else {
            status = language === "de" ? "Für heute geschlossen" : "Closed for today";
            const nextOpen = findNextOpenDate(todayKey);

            if (nextOpen) {
              next = language === "de"
                ? `Nächster Café-Tag: ${formatDate(nextOpen.key, language)} · ${formatRange(nextOpen.hours[0], language)}`
                : `Next café opening: ${formatDate(nextOpen.key, language)} · ${formatRange(nextOpen.hours[0], language)}`;
            }
          }

          if (!next && !currentSlot) {
            next = language === "de"
              ? `Regulär ${todayHours.map(slot => formatRange(slot, language)).join(" · ")}`
              : `Regular hours ${todayHours.map(slot => formatRange(slot, language)).join(" · ")}`;
          }
        }

        const specialNote = special?.[language === "de" ? "noteDe" : "noteEn"];
        if (specialNote) next = specialNote;

        statusElement.textContent = status;
        nextElement.textContent = next;

        const publicNotice = config.publicNotice || {};
        const notice = publicNotice[language];

        if (noticeBox && noticeText && publicNotice.active && notice) {
          noticeText.textContent = notice;
          noticeBox.hidden = false;
        } else if (noticeBox) {
          noticeBox.hidden = true;
        }
      } catch (_) {
        statusElement.textContent =
          currentLanguage === "de" ? "Reguläre Café-Zeiten" : "Regular café hours";

        nextElement.textContent =
          currentLanguage === "de"
            ? "MO–DI 12–14 Uhr · FR–SO 12–18 Uhr"
            : "MON–TUE 12:00–14:00 · FRI–SUN 12:00–18:00";
      }
    }

    function updateLocalizedAttributes(language) {
      localizedAriaNodes.forEach(node => {
        node.setAttribute(
          "aria-label",
          language === "en" ? node.dataset.ariaLabelEn : node.dataset.ariaLabelDe
        );
      });

      localizedAltImages.forEach(image => {
        image.alt = language === "en" ? image.dataset.altEn : image.dataset.altDe;
      });
    }

    function setLanguage(language) {
      currentLanguage = language;
      document.documentElement.lang = language;
      storeLanguage(language);

      languageNodes.forEach(node => {
        node.hidden = node.dataset.lang !== language;
      });

      languageButtons.forEach(button => {
        const active = button.dataset.language === language;
        button.classList.toggle("is-active", active);
        button.setAttribute("aria-pressed", String(active));
      });

      updateLocalizedAttributes(language);
      renderStatus();
    }

    languageButtons.forEach(button => {
      button.addEventListener("click", () => setLanguage(button.dataset.language));
    });

    const lightbox = document.getElementById("image-lightbox");
    const lightboxImage = document.getElementById("lightbox-image");
    const closeButton = lightbox?.querySelector(".lightbox__close");

    document.querySelectorAll("[data-lightbox-src]").forEach(button => {
      button.addEventListener("click", () => {
        if (!lightbox || !lightboxImage) return;

        lightboxImage.src = button.dataset.lightboxSrc;
        lightboxImage.alt =
          currentLanguage === "en"
            ? (button.dataset.lightboxAltEn || "")
            : (button.dataset.lightboxAltDe || button.dataset.lightboxAlt || "");

        lightbox.showModal();
      });
    });

    closeButton?.addEventListener("click", () => lightbox.close());

    lightbox?.addEventListener("click", event => {
      if (event.target === lightbox) lightbox.close();
    });

    setLanguage(currentLanguage);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initNichiSite, { once: true });
  } else {
    initNichiSite();
  }
})();
