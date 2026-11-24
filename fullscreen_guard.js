/* ############################################################################
              FULLSCREEN GUARD + STUDY-WIDE TAB-SWITCH LOGGING
   ############################################################################
   Browsers only allow fullscreen after a click or key press, and Esc always
   exits, so the study cannot force participants back. Instead:
     - Outside ideation: a blocking overlay ("Please return to fullscreen to
       continue") with a button. One click restores fullscreen and the study
       resumes on the same screen.
     - During ideation: a non-blocking banner with the same button, so the
       3-minute timer does not eat into anyone's typing time.
   Every exit and return is logged with a timestamp, plus study-wide tab or
   window switches.

   Usage (index.html):
     FullscreenGuard.start()   when fullscreen is first entered
     FullscreenGuard.stop()    before the study exits fullscreen at the end
   design_task.js calls FullscreenGuard.setIdeation(true/false) and
   FullscreenGuard.snapshot() to get per-trial counts.
   ############################################################################ */

var FullscreenGuard = (function () {
  var t0 = performance.now();
  var active = false;
  var inIdeation = false;
  var lastFocus = null;

  var fs = { exits: [], n_exits: 0, time_out_ms: 0, outSince: null };
  var tab = { events: [], n_switches: 0, time_hidden_ms: 0, awaySince: null };

  function now() {
    return Math.round(performance.now() - t0);
  }
  function isFullscreen() {
    return !!(document.fullscreenElement || document.webkitFullscreenElement);
  }
  function supported() {
    return !!(document.fullscreenEnabled || document.webkitFullscreenEnabled);
  }
  function currentTrialKind() {
    try {
      var t = jsPsych.getCurrentTrial();
      return (t && t.data && t.data.trial_kind) || (t && t.type && t.type.info && t.type.info.name) || null;
    } catch (e) {
      return null;
    }
  }

  /* ---------- UI: blocking overlay and non-blocking banner ---------- */
  var overlay = null;
  var banner = null;

  function requestFs() {
    var el = document.documentElement;
    var p = el.requestFullscreen ? el.requestFullscreen() : el.webkitRequestFullscreen && el.webkitRequestFullscreen();
    if (p && p.catch) p.catch(function () {});
  }

  function buildUI() {
    if (overlay) return;
    overlay = document.createElement("div");
    overlay.className = "fs-overlay";
    overlay.innerHTML =
      '<div class="fs-overlay-box">' +
      "<p><b>Please return to fullscreen to continue.</b></p>" +
      '<button type="button" class="jspsych-btn fs-return">Return to fullscreen</button>' +
      "</div>";
    banner = document.createElement("div");
    banner.className = "fs-banner";
    banner.innerHTML =
      "<span>Please return to fullscreen. You can keep typing.</span>" +
      '<button type="button" class="jspsych-btn fs-return">Return to fullscreen</button>';
    [overlay, banner].forEach(function (node) {
      node.querySelector(".fs-return").addEventListener("click", function () {
        requestFs();
      });
      document.body.appendChild(node);
    });
  }

  function showPrompt() {
    buildUI();
    if (inIdeation) banner.classList.add("fs-visible");
    else overlay.classList.add("fs-visible");
  }
  function hidePrompt() {
    if (!overlay) return;
    overlay.classList.remove("fs-visible");
    banner.classList.remove("fs-visible");
    // Put the cursor back where it was (e.g., the idea box being typed in)
    if (lastFocus && document.contains(lastFocus)) {
      try {
        lastFocus.focus();
      } catch (e) {}
    }
  }

  /* ---------- Fullscreen exit / return ---------- */
  function onFsChange() {
    if (!active) return;
    var t = now();
    if (!isFullscreen()) {
      if (fs.outSince === null) {
        fs.outSince = t;
        fs.n_exits++;
        lastFocus = document.activeElement;
        fs.exits.push({ event: "exit", ms: t, screen: currentTrialKind(), during_ideation: inIdeation });
      }
      showPrompt();
    } else {
      if (fs.outSince !== null) {
        fs.time_out_ms += t - fs.outSince;
        fs.exits.push({ event: "return", ms: t, screen: currentTrialKind() });
        fs.outSince = null;
      }
      hidePrompt();
    }
  }
  document.addEventListener("fullscreenchange", onFsChange);
  document.addEventListener("webkitfullscreenchange", onFsChange);

  /* ---------- Study-wide tab / window switching ---------- */
  function goAway(source) {
    if (tab.awaySince !== null) return;
    tab.awaySince = now();
    tab.n_switches++;
    tab.events.push({ event: "away", source: source, ms: tab.awaySince, screen: currentTrialKind() });
  }
  function comeBack(source) {
    if (tab.awaySince === null || document.hidden) return;
    var t = now();
    tab.time_hidden_ms += t - tab.awaySince;
    tab.events.push({ event: "back", source: source, ms: t });
    tab.awaySince = null;
  }
  document.addEventListener("visibilitychange", function () {
    if (document.hidden) goAway("visibilitychange");
    else comeBack("visibilitychange");
  });
  window.addEventListener("blur", function () {
    goAway("blur");
  });
  window.addEventListener("focus", function () {
    comeBack("focus");
  });

  return {
    supported: supported,
    start: function () {
      active = supported();
    },
    stop: function () {
      active = false;
      hidePrompt();
    },
    setIdeation: function (on) {
      inIdeation = on;
      // Switch prompt style if someone is already out of fullscreen
      if (active && !isFullscreen()) {
        hidePrompt();
        showPrompt();
      }
    },
    // Running totals, counting any exit or tab switch still in progress
    snapshot: function () {
      var t = now();
      return {
        fs_n_exits: fs.n_exits,
        fs_time_out_ms: fs.time_out_ms + (fs.outSince !== null ? t - fs.outSince : 0),
        tab_n_switches: tab.n_switches,
        tab_time_hidden_ms: tab.time_hidden_ms + (tab.awaySince !== null ? t - tab.awaySince : 0),
      };
    },
    log: function () {
      return { fullscreen_events: fs.exits, tab_events: tab.events };
    },
  };
})();
