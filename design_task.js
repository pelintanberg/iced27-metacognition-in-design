/* ############################################################################
              DESIGN CALIBRATION TASK (built to the coding specification)
   ############################################################################
   Requires (already in index.html):
     - design_stim.js loaded before this file
     - plugins: html-button-response, html-keyboard-response,
                survey-html-form, survey-multi-choice, instructions
   Usage, AFTER initJsPsych() and after the cell is known (see index.html):
     var design = buildDesignTimeline(cellId, assignmentMethod);
     timeline.push(design.instructions, design.practice, design.main);
     ...MAI, NCS-6...
     timeline.push(design.tlx);

   Each problem (practice and the 3 main problems):
     A. read the problem                             -> problem_read_time_ms
     B. prospective judgments: overall confidence, then novel / useful /
        feasible (0–100 sliders, no default handle)   -> pro_conf_*
     C. ideation: 3:00 fixed, 3 boxes + "Add another idea", no countdown, "1 minute left" banner
        at 2:00, no early advance, paste blocked, tab switches and fullscreen
        exits logged
     D. per idea (skipped if no ideas): confidence, then novelty /
        usefulness / feasibility (0–100 sliders, judge anchors at the ends)
     E. effort, difficulty and enjoyment (0–100 sliders) -> trial row

   Data tables (filter on the `table` column):
     table = "trial"  one row per problem, written on Screen E
     table = "idea"   one row per non-empty idea, written on Screen D
   All judgments are 0–100 sliders that start at 50; Continue stays disabled
   until each one has been moved. Rescale to 0–1 before comparing with judges.
   ############################################################################ */

var TASK_SETTINGS = {
  IDEATION_MS: 180000, // main problems: exactly 180 s
  PRACTICE_IDEATION_MS: 180000, // practice: same as the main problems
  REMINDER_BEFORE_END_MS: 60000, // banner appears 60 s before the end (at 2:00)
  N_START_BOXES: 3, // boxes shown at the start
  MAX_BOXES: 15, // "Add another idea" adds one box at a time, up to this many
  PARTIAL_WINDOW_MS: 2000, // was_partial = edited in the last 2 s
  ACTIVE_GAP_MS: 2000, // keystroke gaps up to 2 s count as active typing
};

/* ---------- Overall prospective confidence question ----------
   Worded as a prediction about the outcome ("will"), like a judgment of
   learning, rather than a judgment of capability ("can", "ability to"),
   which is how self-efficacy items are worded. */
var OVERALL_CONFIDENCE = {
  question: "How confident are you that you will come up with <b>at least one good idea</b> for this problem?",
  low: "Not at all confident",
  high: "Completely confident",
  instruction: "Tell us how confident you are that you will come up with at least one good idea for it.",
};

var TASK_OPTIONS = {
  PREDICTED_N_IDEAS: false, // [OPTIONAL] "How many ideas do you expect...?" 0–6
  OUT_OF_IDEAS_CHECKBOX: false, // [OPTIONAL] "I've run out of ideas" (logged only)
};

/* ---------- Dimension order: randomised once per participant ---------- */
var DIMENSIONS = {
  novel: {
    key: "novel",
    word: "novel",
    definition: "new and unique, not a copy of a common or existing solution",
    rating_question: "How <b>novel</b> is this idea?",
    low: "Copied from a common or existing solution",
    high: "New and unique",
  },
  useful: {
    key: "useful",
    word: "useful",
    definition: "actually helps with the problem, beyond what exists today",
    rating_question: "How <b>useful</b> is this idea?",
    low: "Does not address the problem",
    high: "Helpful beyond current solutions",
  },
  feasible: {
    key: "feasible",
    word: "feasible",
    definition: "could realistically be made or implemented as described",
    rating_question: "How <b>feasible</b> is this idea?",
    low: "The technology to make it does not exist",
    high: "Could be implemented as described",
  },
};
var DIMENSION_ORDER = ["novel", "useful", "feasible"];

/* ---------- Helpers ---------- */

// Prevents participants' own text from being read as HTML when shown back
function escapeHTML(text) {
  return String(text)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function problemHTML(problem) {
  return (
    '<div class="design-problem">' +
    '<p class="design-opening">' + OPENING_LINE + "</p>" +
    '<p class="design-problem-text">' + problem.problem_text + "</p>" +
    "</div>"
  );
}

function problemLabel(phase, position) {
  return (
    '<p class="problem-label">' +
    (phase === "practice" ? "Practice problem" : "Problem " + position + " of 3") +
    "</p>"
  );
}

// Short definitions reminder shown on the confidence and rating screens
function definitionsReminderHTML() {
  return (
    '<div class="definitions-reminder">' +
    '<p class="definitions-title">Definitions</p>' +
    DIMENSION_ORDER.map(function (k) {
      var d = DIMENSIONS[k];
      return "<p><b>" + d.word.charAt(0).toUpperCase() + d.word.slice(1) + ":</b> " +
        d.definition.charAt(0).toUpperCase() + d.definition.slice(1) + ".</p>";
    }).join("") +
    "</div>"
  );
}

function trialData(kind, phase, problem, position) {
  return {
    trial_kind: kind,
    phase: phase,
    is_practice: phase === "practice" ? 1 : 0,
    problem_id: problem.problem_id,
    serial_position: position, // 0 = practice, 1 to 3
  };
}

// 0–100 slider. Starts at 50; the track fills from the left as it is dragged.
function sliderHTML(name, question, lowLabel, highLabel) {
  return (
    '<div class="conf-item">' +
    "<p>" + question + "</p>" +
    '<input type="range" class="conf-slider" min="0" max="100" step="1" value="50" style="--fill:50%" name="' +
    name + '" id="' + name + '">' +
    '<div class="conf-anchors"><span>0<br>' + lowLabel + "</span>" +
    '<span class="conf-value" id="' + name + '_value"></span>' +
    "<span>100<br>" + highLabel + "</span></div>" +
    "</div>"
  );
}

// Horizontal 7-point radio scale; only the end points are labelled; no default
function sevenPointHTML(name, question, lowLabel, highLabel) {
  var html =
    '<div class="rating-row"><p class="rating-label">' + question + "</p>" +
    '<div class="rating-scale">' +
    '<span class="rating-anchor rating-anchor-low">1 = ' + lowLabel + "</span>";
  for (var v = 1; v <= 7; v++) {
    html +=
      '<label class="rating-option"><input type="radio" name="' + name +
      '" value="' + v + '" required><span>' + v + "</span></label>";
  }
  html +=
    '<span class="rating-anchor rating-anchor-high">7 = ' + highLabel + "</span>" +
    "</div></div>";
  return html;
}

// Continue stays disabled until every named slider has been clicked or moved,
// so no answer is left at the starting point by accident.
function requireAllMoved(names) {
  var btn = document.getElementById("jspsych-survey-html-form-next");
  btn.disabled = true;
  var moved = {};
  names.forEach(function (name) {
    var slider = document.getElementById(name);
    var valueEl = document.getElementById(name + "_value");
    function touch() {
      moved[name] = true;
      var pct = ((slider.value - slider.min) / (slider.max - slider.min)) * 100;
      slider.style.setProperty("--fill", pct + "%");
      if (valueEl) valueEl.textContent = slider.value;
      if (Object.keys(moved).length === names.length) btn.disabled = false;
    }
    slider.addEventListener("input", touch);
    slider.addEventListener("change", touch);
    slider.addEventListener("pointerup", touch); // clicking exactly on 50 fires no input event
    slider.addEventListener("keydown", function () {
      setTimeout(touch, 0);
    });
  });
}

/* ############################################################################
              SCREEN A: PROBLEM
   ############################################################################ */
function readProblemTrial(problem, phase, position) {
  return {
    type: jsPsychHtmlButtonResponse,
    stimulus:
      '<div class="task-left">' + problemLabel(phase, position) + problemHTML(problem) + "</div>",
    choices: ["Continue"],
    data: trialData("design_read", phase, problem, position),
    on_finish: function (data) {
      data.problem_read_time_ms = Math.round(data.rt);
    },
  };
}

/* ############################################################################
              SCREEN B: PROSPECTIVE JUDGMENTS
   ############################################################################
   Overall confidence first, then the three dimensions in the participant's
   dimension order. Optional: predicted number of ideas (0–6). */
function prospectiveTrial(problem, phase, position, ideationSeconds) {
  return {
    type: jsPsychSurveyHtmlForm,
    preamble: function () {
      return problemLabel(phase, position) + problemHTML(problem) + definitionsReminderHTML();
    },
    html: function () {
      var html = "";
      if (TASK_OPTIONS.PREDICTED_N_IDEAS) {
        html +=
          '<div class="conf-item"><p>How many ideas do you expect to come up with for this problem in ' +
          Math.round(ideationSeconds / 60) + " minutes?</p>" +
          '<input type="number" name="predicted_n_ideas" min="0" max="' + TASK_SETTINGS.MAX_BOXES + '" step="1" required class="number-input"></div>';
      }
      html += sliderHTML(
        "pro_conf_overall",
        OVERALL_CONFIDENCE.question,
        OVERALL_CONFIDENCE.low,
        OVERALL_CONFIDENCE.high
      );
      html +=
        '<p class="conf-group-lead">How confident are you that you will come up with ideas for this problem that are:</p>';
      html += DIMENSION_ORDER.map(function (k) {
        return sliderHTML(
          "pro_conf_" + k,
          "<b>" + DIMENSIONS[k].word + "</b>?",
          "Not at all confident",
          "Completely confident"
        );
      }).join("");
      return html;
    },
    button_label: "Continue",
    data: trialData("design_prospective", phase, problem, position),
    on_load: function () {
      requireAllMoved(["pro_conf_overall"].concat(DIMENSION_ORDER.map(function (k) { return "pro_conf_" + k; })));
    },
    on_finish: function (data) {
      ["overall"].concat(DIMENSION_ORDER).forEach(function (k) {
        data["pro_conf_" + k] = parseInt(data.response["pro_conf_" + k], 10);
      });
      if (TASK_OPTIONS.PREDICTED_N_IDEAS) {
        data.predicted_n_ideas = parseInt(data.response.predicted_n_ideas, 10);
      }
      data.prospective_time_ms = Math.round(data.rt);
    },
  };
}

/* ############################################################################
              SCREEN C: IDEATION
   ############################################################################ */
var CURRENT_IDEAS = { ideas: [], index: 0, boxes: [] };

function setupIdeation(durationMs) {
  var t0 = performance.now();
  var log = {
    boxes: [],
    warning_shown_ms: null,
    out_of_ideas_ms: null,
    out_of_ideas_events: [],
    paste_times: [],
    tab_events: [],
    n_boxes_added: 0,
    n_tab_switches: 0,
    time_hidden_ms: 0,
  };
  function elapsed() {
    return Math.round(performance.now() - t0);
  }

  /* ---- Idea boxes: 3 at the start, more on request ---- */
  var container = document.getElementById("idea-boxes");
  var addBtn = document.getElementById("add-idea");
  function addBox() {
    if (log.boxes.length >= TASK_SETTINGS.MAX_BOXES) return null;
    var ta;
    (function (idx) {
      var rec = {
        idea_index: idx + 1,
        added_ms: elapsed(), // when the box appeared (0 for the first three)
        idea_text: "",
        first_key_ms: null,
        last_key_ms: null,
        n_keystrokes: 0,
        active_typing_ms: 0,
      };
      log.boxes.push(rec);

      var wrap = document.createElement("div");
      wrap.className = "idea-box";
      var label = document.createElement("label");
      label.textContent = "Idea " + (idx + 1);
      ta = document.createElement("textarea");
      ta.rows = 3;
      ta.setAttribute("autocomplete", "off");
      ta.setAttribute("spellcheck", "true");

      ta.addEventListener("keydown", function () {
        var now = elapsed();
        if (rec.first_key_ms === null) {
          rec.first_key_ms = now;
        } else {
          var gap = now - rec.last_key_ms;
          if (gap <= TASK_SETTINGS.ACTIVE_GAP_MS) rec.active_typing_ms += gap;
        }
        rec.last_key_ms = now;
        rec.n_keystrokes++;
      });
      // Copied on every change, so partially typed text is kept at 3:00
      ta.addEventListener("input", function () {
        rec.idea_text = ta.value;
      });
      // Block paste and drag-and-drop (incl. context-menu paste)
      function blockPaste(e) {
        e.preventDefault();
        log.paste_times.push(elapsed());
        var msg = document.getElementById("paste-msg");
        msg.style.visibility = "visible";
        setTimeout(function () {
          msg.style.visibility = "hidden";
        }, 3000);
      }
      ta.addEventListener("paste", blockPaste);
      ta.addEventListener("drop", blockPaste);
      ta.addEventListener("beforeinput", function (e) {
        if (e.inputType === "insertFromPaste" || e.inputType === "insertFromDrop") blockPaste(e);
      });

      wrap.appendChild(label);
      wrap.appendChild(ta);
      container.appendChild(wrap);
    })(log.boxes.length);
    if (log.boxes.length >= TASK_SETTINGS.MAX_BOXES) addBtn.disabled = true;
    return ta;
  }
  for (var i = 0; i < TASK_SETTINGS.N_START_BOXES; i++) addBox();
  container.querySelector("textarea").focus();
  addBtn.addEventListener("click", function () {
    var ta = addBox();
    if (ta) {
      log.n_boxes_added++;
      ta.focus();
    }
  });

  /* ---- [OPTIONAL] I've run out of ideas: logged only, never advances ---- */
  var outBox = document.getElementById("out-of-ideas");
  if (outBox) {
    outBox.addEventListener("change", function () {
      var t = elapsed();
      log.out_of_ideas_events.push({ checked: outBox.checked, ms: t });
      if (outBox.checked && log.out_of_ideas_ms === null) log.out_of_ideas_ms = t;
    });
  }

  /* ---- Tab / window switching ---- */
  var away = false;
  var awayStart = null;
  function goAway(source) {
    if (away) return;
    away = true;
    awayStart = elapsed();
    log.n_tab_switches++;
    log.tab_events.push({ event: "away", source: source, ms: awayStart });
  }
  function comeBack(source) {
    if (!away || document.hidden) return;
    away = false;
    var t = elapsed();
    log.time_hidden_ms += t - awayStart;
    log.tab_events.push({ event: "back", source: source, ms: t });
  }
  function onVisibility() {
    if (document.hidden) goAway("visibilitychange");
    else comeBack("visibilitychange");
  }
  function onBlur() {
    goAway("blur");
  }
  function onFocus() {
    comeBack("focus");
  }
  document.addEventListener("visibilitychange", onVisibility);
  window.addEventListener("blur", onBlur);
  window.addEventListener("focus", onFocus);

  /* ---- "1 minute left" banner: non-blocking, does not take focus ---- */
  var reminderTimer = setTimeout(function () {
    log.warning_shown_ms = elapsed();
    var el = document.getElementById("idea-reminder");
    el.style.display = "block";
    // next frame, so the slide-in animation runs
    requestAnimationFrame(function () {
      el.classList.add("idea-reminder-visible");
    });
  }, durationMs - TASK_SETTINGS.REMINDER_BEFORE_END_MS);

  return {
    finish: function () {
      clearTimeout(reminderTimer);
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("blur", onBlur);
      window.removeEventListener("focus", onFocus);
      var end = elapsed();
      if (away) log.time_hidden_ms += end - awayStart;
      log.end_ms = end;
      return log;
    },
  };
}

function ideationTrial(problem, phase, position, durationMs) {
  var state = null;
  return {
    type: jsPsychHtmlKeyboardResponse,
    stimulus:
      // Hidden with an inline style so it cannot show early even if the CSS is missing or cached
      '<div id="idea-reminder" class="idea-reminder" role="status" aria-live="polite" style="display:none">1 minute left</div>' +
      '<div class="task-left">' +
      problemLabel(phase, position) +
      problemHTML(problem) +
      '<p class="idea-instructions">Write one idea per box. In one or two sentences, explain how the idea works. ' +
      "If you need more boxes, click <b>Add another idea</b>.</p>" +
      '<div id="idea-boxes"></div>' +
      '<button type="button" id="add-idea" class="jspsych-btn add-idea-btn">Add another idea</button>' +
      (TASK_OPTIONS.OUT_OF_IDEAS_CHECKBOX
        ? '<label class="out-of-ideas"><input type="checkbox" id="out-of-ideas"> I\'ve run out of ideas</label>'
        : "") +
      '<p id="paste-msg" class="paste-msg">Pasting is disabled. Please type your ideas.</p>' +
      "</div>",
    choices: "NO_KEYS",
    trial_duration: durationMs,
    response_ends_trial: false,
    data: trialData("design_ideation", phase, problem, position),
    on_load: function () {
      state = setupIdeation(durationMs);
      if (typeof FullscreenGuard !== "undefined") {
        state.fsStart = FullscreenGuard.snapshot();
        FullscreenGuard.setIdeation(true);
      }
    },
    on_finish: function (data) {
      var log = state.finish();
      if (typeof FullscreenGuard !== "undefined") {
        var fsEnd = FullscreenGuard.snapshot();
        FullscreenGuard.setIdeation(false);
        data.fs_n_exits = fsEnd.fs_n_exits - state.fsStart.fs_n_exits;
        data.fs_time_out_ms = fsEnd.fs_time_out_ms - state.fsStart.fs_time_out_ms;
      }
      var boxes = log.boxes;

      boxes.forEach(function (b) {
        b.n_chars_final = b.idea_text.length;
        b.was_partial =
          b.last_key_ms !== null && b.last_key_ms >= durationMs - TASK_SETTINGS.PARTIAL_WINDOW_MS ? 1 : 0;
      });
      var ideas = boxes.filter(function (b) {
        return b.idea_text.trim() !== "";
      });
      // idea_order: order of first keystroke among this trial's ideas
      ideas
        .slice()
        .sort(function (a, b) {
          return a.first_key_ms - b.first_key_ms;
        })
        .forEach(function (b, k) {
          b.idea_order = k + 1;
        });

      data.ideation_duration_s = durationMs / 1000;
      data.n_boxes = boxes.length;
      data.n_boxes_added = log.n_boxes_added;
      data.n_ideas = ideas.length;
      data.zero_ideas_flag = ideas.length === 0 ? 1 : 0;
      data.warning_shown_ms = log.warning_shown_ms;
      data.out_of_ideas_ms = log.out_of_ideas_ms;
      data.out_of_ideas_events_json = JSON.stringify(log.out_of_ideas_events);
      data.paste_attempts = log.paste_times.length;
      data.paste_times_json = JSON.stringify(log.paste_times);
      data.n_tab_switches = log.n_tab_switches;
      data.time_hidden_ms = log.time_hidden_ms;
      data.tab_events_json = JSON.stringify(log.tab_events);
      data.boxes_json = JSON.stringify(boxes); // every box, incl. empty ones

      // Ideas are rated in the order they were written (first keystroke)
      CURRENT_IDEAS.ideas = ideas.slice().sort(function (a, b) {
        return a.idea_order - b.idea_order;
      });
      CURRENT_IDEAS.index = 0;
    },
  };
}

/* ############################################################################
              SCREEN D: SELF-RATINGS OF OWN IDEAS (one idea at a time)
   ############################################################################
   Skipped when the participant wrote no ideas. Idea text is read-only. */
function selfRatingBlock(problem, phase, position) {
  var rateIdea = {
    type: jsPsychSurveyHtmlForm,
    preamble: function () {
      var i = CURRENT_IDEAS.index;
      return (
        problemLabel(phase, position) +
        '<p class="rating-progress">Idea ' + (i + 1) + " of " + CURRENT_IDEAS.ideas.length + "</p>" +
        '<div class="idea-card">' + escapeHTML(CURRENT_IDEAS.ideas[i].idea_text) + "</div>" +
        definitionsReminderHTML()
      );
    },
    html: function () {
      return (
        sliderHTML(
          "idea_conf",
          "How confident are you that this idea is a <b>good idea</b> for the problem?",
          "Not at all confident",
          "Completely confident"
        ) +
        DIMENSION_ORDER.map(function (k) {
          var d = DIMENSIONS[k];
          return sliderHTML("self_" + k, d.rating_question, d.low, d.high);
        }).join("")
      );
    },
    button_label: "Continue",
    data: trialData("design_self_rating", phase, problem, position),
    on_load: function () {
      requireAllMoved(["idea_conf"].concat(DIMENSION_ORDER.map(function (k) { return "self_" + k; })));
    },
    on_finish: function (data) {
      var idea = CURRENT_IDEAS.ideas[CURRENT_IDEAS.index];
      data.table = "idea";
      data.idea_uid = jsPsych.randomization.randomID(10); // random; reveals nothing about the participant
      data.idea_index = idea.idea_index;
      data.idea_order = idea.idea_order;
      data.idea_text = idea.idea_text;
      data.first_key_ms = idea.first_key_ms;
      data.last_key_ms = idea.last_key_ms;
      data.n_keystrokes = idea.n_keystrokes;
      data.active_typing_ms = idea.active_typing_ms;
      data.n_chars_final = idea.n_chars_final;
      data.was_partial = idea.was_partial;
      data.idea_conf = parseInt(data.response.idea_conf, 10);
      DIMENSION_ORDER.forEach(function (k) {
        data["self_" + k] = parseInt(data.response["self_" + k], 10);
      });
      data.rating_time_ms = Math.round(data.rt);
      CURRENT_IDEAS.index++;
    },
  };

  return {
    timeline: [rateIdea],
    conditional_function: function () {
      return CURRENT_IDEAS.ideas.length > 0;
    },
    loop_function: function () {
      return CURRENT_IDEAS.index < CURRENT_IDEAS.ideas.length;
    },
  };
}

/* ############################################################################
              SCREEN E: EFFORT AND DIFFICULTY  (also writes the trial row)
   ############################################################################ */
var EFFORT_ITEMS = [
  { name: "effort", question: "How much <b>mental effort</b> did you invest in this problem?", low: "Very low", high: "Very high" },
  { name: "difficulty", question: "How <b>difficult</b> was this problem?", low: "Very low", high: "Very high" },
  { name: "enjoyment", question: "How much did you <b>enjoy</b> working on this problem?", low: "Not at all", high: "Very much" },
];

function effortTrial(problem, phase, position) {
  return {
    type: jsPsychSurveyHtmlForm,
    preamble:
      problemLabel(phase, position) +
      "<p>Thinking about the problem you just worked on:</p>" +
      '<p class="design-problem-recap">' + problem.problem_text + "</p>",
    html: EFFORT_ITEMS.map(function (item) {
      return sliderHTML(item.name, item.question, item.low, item.high);
    }).join(""),
    button_label: "Continue",
    data: trialData("design_effort", phase, problem, position),
    on_load: function () {
      requireAllMoved(EFFORT_ITEMS.map(function (i) { return i.name; }));
    },
    on_finish: function (data) {
      EFFORT_ITEMS.forEach(function (item) {
        data[item.name] = parseInt(data.response[item.name], 10);
      });

      // Trial row: copy this problem's values from screens A to C onto this row
      var rows = jsPsych.data.get().filter({ problem_id: problem.problem_id, phase: phase });
      var read = rows.filter({ trial_kind: "design_read" }).values()[0] || {};
      var pro = rows.filter({ trial_kind: "design_prospective" }).values()[0] || {};
      var ide = rows.filter({ trial_kind: "design_ideation" }).values()[0] || {};
      data.table = "trial";
      data.problem_read_time_ms = read.problem_read_time_ms;
      ["predicted_n_ideas", "pro_conf_overall", "pro_conf_novel", "pro_conf_useful",
        "pro_conf_feasible", "prospective_time_ms"].forEach(function (k) {
        data[k] = pro[k];
      });
      ["ideation_duration_s", "n_ideas", "n_boxes", "n_boxes_added", "zero_ideas_flag",
        "warning_shown_ms", "out_of_ideas_ms",
        "paste_attempts", "n_tab_switches", "time_hidden_ms", "fs_n_exits", "fs_time_out_ms"].forEach(function (k) {
        data[k] = ide[k];
      });
      data.self_ratings_skipped = ide.n_ideas === 0 ? 1 : 0;
    },
  };
}

// One full problem: A -> B -> C -> D (if any ideas) -> E
function problemBlock(problem, phase, position, durationMs) {
  return {
    timeline: [
      readProblemTrial(problem, phase, position),
      prospectiveTrial(problem, phase, position, durationMs / 1000),
      ideationTrial(problem, phase, position, durationMs),
      selfRatingBlock(problem, phase, position),
      effortTrial(problem, phase, position),
    ],
  };
}

/* ############################################################################
              NASA-TLX (whole scale, once, after all problems)
   ############################################################################
   Raw TLX: six 0–100 subscales in steps of 5, no pairwise weighting.
   Performance runs from Perfect (0) to Failure (100), as in the original,
   so higher always means more workload. tlx_raw = mean of the six. */
var TLX_ITEMS = [
  { name: "tlx_mental", title: "Mental demand", prompt: "How mentally demanding was the task?", low: "Very low", high: "Very high" },
  { name: "tlx_physical", title: "Physical demand", prompt: "How physically demanding was the task?", low: "Very low", high: "Very high" },
  { name: "tlx_temporal", title: "Temporal demand", prompt: "How hurried or rushed was the pace of the task?", low: "Very low", high: "Very high" },
  { name: "tlx_performance", title: "Performance", prompt: "How successful were you in accomplishing what you were asked to do?", low: "Perfect", high: "Failure" },
  { name: "tlx_effort", title: "Effort", prompt: "How hard did you have to work to accomplish your level of performance?", low: "Very low", high: "Very high" },
  { name: "tlx_frustration", title: "Frustration", prompt: "How insecure, discouraged, irritated, stressed, and annoyed were you?", low: "Very low", high: "Very high" },
];

var tlxTrial = {
  type: jsPsychSurveyHtmlForm,
  preamble:
    "<p>Think about the <b>design problems as a whole</b>: reading each problem, " +
    "rating your confidence, generating ideas, and rating your ideas.</p>" +
    "<p>Move each slider to show how you experienced the task.</p>",
  html: TLX_ITEMS.map(function (item) {
    return (
      '<div class="conf-item">' +
      "<p><b>" + item.title + ".</b> " + item.prompt + "</p>" +
      '<input type="range" class="conf-slider" min="0" max="100" step="5" value="50" style="--fill:50%" name="' +
      item.name + '" id="' + item.name + '">' +
      '<div class="conf-anchors"><span>' + item.low + "</span>" +
      '<span class="conf-value" id="' + item.name + '_value"></span>' +
      "<span>" + item.high + "</span></div>" +
      "</div>"
    );
  }).join(""),
  button_label: "Continue",
  data: { trial_kind: "nasa_tlx" },
  on_load: function () {
    requireAllMoved(TLX_ITEMS.map(function (i) { return i.name; }));
  },
  on_finish: function (data) {
    var sum = 0;
    TLX_ITEMS.forEach(function (item) {
      data[item.name] = parseInt(data.response[item.name], 10);
      sum += data[item.name];
    });
    data.tlx_raw = sum / TLX_ITEMS.length;
  },
};

/* ############################################################################
              BUILD THE TIMELINE
   ############################################################################ */
function buildDesignTimeline(cellId, assignmentMethod) {
  var assignment = getAssignment(cellId);
  DIMENSION_ORDER = jsPsych.randomization.shuffle(["novel", "useful", "feasible"]);

  jsPsych.data.addProperties({
    cell_id: assignment.cell_id,
    set_id: assignment.set_id,
    order_id: assignment.order_id,
    problem_pos1: assignment.problem_ids[0],
    problem_pos2: assignment.problem_ids[1],
    problem_pos3: assignment.problem_ids[2],
    assignment_method: assignmentMethod || "random",
    dimension_order: DIMENSION_ORDER.join(";"),
  });

  /* ---------- 4.1 General instructions ---------- */
  var general_instructions = {
    type: jsPsychInstructions,
    pages: [
      "<p>In this study you will work on <b>3 short design problems</b>.</p>" +
        "<p>For each problem you will:</p>" +
        '<ol class="instr-list">' +
        "<li>Read the problem.</li>" +
        "<li>" + OVERALL_CONFIDENCE.instruction + "</li>" +
        "<li>Write as many ideas as you can in 3 minutes, one idea per box. Describe each idea in one or two sentences, explaining how it works.</li>" +
        "<li>Rate each of your own ideas.</li>" +
        "<li>Tell us how much effort the problem took, how difficult it was, and how much you enjoyed it.</li>" +
        "</ol>",
      "<p>You will have 3 minutes for each problem. You will see a reminder when 1 minute is left, " +
        "and the page will move on automatically when time is up. " +
        "Please keep thinking for the full 3 minutes; new ideas often come later.</p>" +
        "<p>There are no right or wrong answers. You do not need to draw anything.</p>" +
        "<p>Please stay in fullscreen and on this page for the whole study. " +
        "We record if you leave fullscreen or switch to another tab or window.</p>",
    ],
    show_clickable_nav: true,
    allow_backward: true,
    button_label_next: "Next",
    button_label_previous: "Back",
    data: { trial_kind: "design_instructions" },
  };

  /* ---------- 4.2 AI-use instruction and check (repeats until "No") ---------- */
  var aiCheckAttempts = 0;

  var ai_instruction = {
    type: jsPsychHtmlButtonResponse,
    stimulus: function () {
      return (
        (aiCheckAttempts > 0
          ? '<p class="error-text">Please read the instruction again.</p>'
          : "") +
        "<p>Please do not use AI tools (for example ChatGPT, Copilot or Gemini), search engines, " +
        "or any other outside help during this study. We are interested in your own ideas and judgments.</p>"
      );
    },
    choices: ["Continue"],
    data: { trial_kind: "ai_instruction" },
  };

  var ai_check = {
    type: jsPsychSurveyMultiChoice,
    questions: [
      {
        prompt: "<strong>During this study, am I allowed to use AI tools or search engines?</strong>",
        options: ["Yes", "No"],
        name: "ai_check",
        required: true,
      },
    ],
    button_label: "Continue",
    data: { trial_kind: "ai_check" },
    on_finish: function (data) {
      aiCheckAttempts++;
      data.ai_check = data.response.ai_check;
      data.ai_check_correct = data.response.ai_check === "No";
      data.ai_check_attempts = aiCheckAttempts;
    },
  };

  var ai_check_loop = {
    timeline: [ai_instruction, ai_check],
    loop_function: function (d) {
      return !d.filter({ trial_kind: "ai_check" }).values()[0].ai_check_correct;
    },
  };

  /* ---------- 4.3 Rating dimension definitions ---------- */
  var definitions = {
    type: jsPsychHtmlButtonResponse,
    stimulus: function () {
      return (
        "<p>You will rate ideas on three qualities:</p>" +
        '<ul class="instr-list">' +
        DIMENSION_ORDER.map(function (k) {
          var d = DIMENSIONS[k];
          return "<li><b>" + d.word.charAt(0).toUpperCase() + d.word.slice(1) + "</b>: " + d.definition + ".</li>";
        }).join("") +
        "</ul>" +
        "<p>A short reminder of these definitions appears on every rating screen.</p>" +
        "<p>When you are ready, start the first problem.</p>"
      );
    },
    choices: ["Start the first problem"],
    data: { trial_kind: "design_definitions" },
  };

  /* ---------- Practice ---------- */
  var practice_end = {
    type: jsPsychHtmlButtonResponse,
    stimulus: "<p>The practice is over. You will now complete 3 design problems.</p>",
    choices: ["Start"],
    data: { trial_kind: "design_practice_end" },
  };

  var practice = {
    timeline: [
      problemBlock(PRACTICE_PROBLEM, "practice", 0, TASK_SETTINGS.PRACTICE_IDEATION_MS),
      practice_end,
    ],
    data: { practice_duration_s: TASK_SETTINGS.PRACTICE_IDEATION_MS / 1000 },
  };

  /* ---------- Main problems ---------- */
  var mainBlocks = assignment.problems.map(function (problem, k) {
    return problemBlock(problem, "main", k + 1, TASK_SETTINGS.IDEATION_MS);
  });

  var main_end = {
    type: jsPsychHtmlButtonResponse,
    stimulus: "<p>You have finished the design problems.</p><p>Next, we will ask you a few questions about yourself.</p>",
    choices: ["Continue"],
    data: { trial_kind: "design_main_end" },
  };

  return {
    assignment: assignment,
    instructions: { timeline: [general_instructions, ai_check_loop, definitions] },
    practice: practice,
    main: { timeline: mainBlocks.concat([main_end]) },
    tlx: { timeline: [tlxTrial] },
  };
}

/* ############################################################################
              QUESTIONNAIRE GRID (used by mai.js and nfc.js)
   ############################################################################
   Qualtrics-style matrix: statements on the left, one shared header of
   answer labels across the top (stays visible while scrolling), one row of
   radio buttons per statement. Every row is required. Each radio's value is
   the scale value itself (e.g. 1–5), so no conversion is needed. */

// "1 = Not at all typical of me" -> "<b>1</b><br>Not at all typical of me"
function gridHeaderLabel(label) {
  var m = String(label).match(/^\s*([−\-+]?\d+)\s*(?:=\s*)?(.*)$/);
  if (!m) return label;
  return "<b>" + m[1] + "</b>" + (m[2] ? "<br>" + m[2] : "");
}

function gridHTML(rows, labels, values) {
  var head =
    "<thead><tr><th class=\"grid-statement-head\"></th>" +
    labels.map(function (l) {
      return '<th class="grid-option-head">' + gridHeaderLabel(l) + "</th>";
    }).join("") +
    "</tr></thead>";
  var body =
    "<tbody>" +
    rows.map(function (row) {
      return (
        '<tr class="grid-row"><td class="grid-statement">' + row.text + "</td>" +
        values.map(function (v, i) {
          return (
            '<td class="grid-option"><label class="grid-cell" title="' +
            String(labels[i]).replace(/"/g, "&quot;") + '">' +
            '<input type="radio" name="' + row.name + '" value="' + v + '" required>' +
            "</label></td>"
          );
        }).join("") +
        "</tr>"
      );
    }).join("") +
    "</tbody>";
  return '<table class="q-grid">' + head + body + "</table>";
}

// rows: [{ name, text }]; labels: header labels; values: stored value per column
function gridTrial(opts) {
  return {
    type: jsPsychSurveyHtmlForm,
    preamble: opts.preamble,
    html: gridHTML(opts.rows, opts.labels, opts.values),
    button_label: "Continue",
    data: opts.data,
    on_finish: opts.on_finish,
  };
}
