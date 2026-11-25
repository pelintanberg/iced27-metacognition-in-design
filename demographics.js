/* ############################################################################
              SCREENING, DEMOGRAPHICS, AND DESIGN EXPERTISE
   ############################################################################
   Assumes these already exist in your main script:
     - jsPsych (initJsPsych instance)
     - prolific_random_id
   Plugins needed: jsPsychSurveyText, jsPsychSurveyMultiChoice,
                   jsPsychSurveyMultiSelect, jsPsychHtmlKeyboardResponse

   Two timelines are exported at the bottom:
     - screening        -> place at the START of the study (right after consent)
     - demographics     -> place at the END of the study
   Screening asks the eligibility questions first. Anyone who fails a rule in
   SCREENING_RULES is shown a short message and sent back to Prolific with the
   screen-out code (STUDY_SETTINGS.SCREEN_OUT_URL in index.html; their data
   are still sent to DataPipe before the redirect); they never
   reach the task and never take up a cell. Everyone else continues to the
   verification questions, which are recorded only (see "EXCLUSION RULES").
   ############################################################################ */

/* ---------- Study-specific settings: edit these ---------- */

// The activity participants perform in your task
var TASK_ACTIVITY = "concept generation";

/* ---------- Screen-out rules: edit these ----------
   Only answers that can be checked automatically are used to screen out.
   The job title and work description are recorded for analysis only. */
var SCREENING_RULES = {
  // Employment answers that end the study
  EXCLUDED_EMPLOYMENT: ["Not currently employed", "I prefer not to answer"],
  // Student answers that end the study
  EXCLUDED_STUDENT: ["Yes, full-time"],
  // Industries that pass. null = industry is not used to screen out.
  // TODO: set this to match the Prolific screener you recruit with, e.g.
  // ["Consumer products", "Automotive / transportation", ...]
  ALLOWED_INDUSTRIES: null,
};

/* ---------- Helpers ---------- */

// Copies the response for `field` onto the top level of the data row
// (so it appears as its own column in the CSV).
function recordResponse(field) {
  return function (data) {
    data[field] = data.response[field];
  };
}

// Returns the most recent stored response for `field`.
function lastResponse(field) {
  var rows = jsPsych.data.get().filter({ question_name: field }).values();
  if (rows.length === 0) return null;
  return rows[rows.length - 1][field];
}

// Free-text question.
function textQuestion(field, prompt, questionType, rows) {
  return {
    type: jsPsychSurveyText,
    questions: [
      {
        prompt: prompt,
        name: field,
        rows: rows || 1,
        columns: rows && rows > 1 ? 60 : 40,
        required: true,
      },
    ],
    button_label: "Continue",
    data: { question_type: questionType, question_name: field },
    on_finish: recordResponse(field),
  };
}

// Single-choice question.
function choiceQuestion(field, prompt, options, questionType) {
  return {
    type: jsPsychSurveyMultiChoice,
    questions: [
      { prompt: prompt, options: options, name: field, required: true },
    ],
    button_label: "Continue",
    data: { question_type: questionType, question_name: field },
    on_finish: recordResponse(field),
  };
}

// Text follow-up shown only when an earlier answer to `parentField`
// equals (or, for multi-select, includes) `triggerOption`.
function followUp(field, prompt, parentField, triggerOption, questionType) {
  return {
    timeline: [textQuestion(field, prompt, questionType)],
    conditional_function: function () {
      var ans = lastResponse(parentField);
      if (Array.isArray(ans)) return ans.indexOf(triggerOption) !== -1;
      return ans === triggerOption;
    },
  };
}

// Numeric question that repeats until the answer is a number in [min, max].
function numericQuestion(field, prompt, min, max, questionType) {
  var attempts = 0;
  var trial = {
    type: jsPsychSurveyText,
    preamble: function () {
      return attempts > 0
        ? '<p style="color:#b00020;">Please enter a number between ' +
            min + " and " + max + " (digits only).</p>"
        : "";
    },
    questions: [
      { prompt: prompt, name: field, rows: 1, columns: 20, required: true },
    ],
    button_label: "Continue",
    data: { question_type: questionType, question_name: field },
    on_finish: function (data) {
      attempts++;
      var raw = String(data.response[field]).trim();
      var isNumber = /^\d+(\.\d+)?$/.test(raw);
      var value = isNumber ? parseFloat(raw) : NaN;
      data[field] = value;
      data[field + "_raw"] = raw;
      data[field + "_valid"] = isNumber && value >= min && value <= max;
    },
  };
  return {
    timeline: [trial],
    loop_function: function (d) {
      return !d.values()[0][field + "_valid"];
    },
  };
}

/* ############################################################################
              BLOCK 1: SCREENING AND VERIFICATION (start of study)
   ############################################################################ */

var screening_begin = {
  type: jsPsychHtmlKeyboardResponse,
  stimulus:
    "<div>First, we will ask you a few questions about your work.</div>",
  choices: "NO_KEYS",
  trial_duration: 3000,
};

var question_employment = choiceQuestion(
  "employment",
  "<strong>What is your current employment status?</strong>",
  [
    "Employed full-time",
    "Employed part-time",
    "Self-employed / freelance",
    "Not currently employed",
    "I prefer not to answer",
  ],
  "screening"
);

var question_student = choiceQuestion(
  "student_status",
  "<strong>Are you currently enrolled as a student?</strong>",
  ["No", "Yes, full-time", "Yes, part-time"],
  "screening"
);

var question_job_title = textQuestion(
  "job_title",
  "<strong>What is your current job title?</strong>",
  "screening"
);

var question_work_description = textQuestion(
  "work_description",
  "<strong>In two or three sentences, describe the design work you do in a typical week.</strong>",
  "screening",
  4
);

// Re-ask of the Prolific screener. Edit these options so they match the
// Prolific screener you used; mismatches are flagged at analysis.
var question_industry = choiceQuestion(
  "industry",
  "<strong>Which industry do you currently work in?</strong>",
  [
    "Consumer products",
    "Automotive / transportation",
    "Aerospace / defence",
    "Medical devices / healthcare",
    "Industrial equipment / manufacturing",
    "Architecture / construction",
    "Software / digital products",
    "Other",
  ],
  "screening"
);

var question_industry_other = followUp(
  "industry_other",
  "<strong>Please describe your industry.</strong>",
  "industry",
  "Other",
  "screening"
);

/* ---------- Screen-out decision ---------- */
function screeningResult() {
  var reasons = [];
  if (SCREENING_RULES.EXCLUDED_EMPLOYMENT.indexOf(lastResponse("employment")) !== -1) {
    reasons.push("employment");
  }
  if (SCREENING_RULES.EXCLUDED_STUDENT.indexOf(lastResponse("student_status")) !== -1) {
    reasons.push("student");
  }
  if (
    SCREENING_RULES.ALLOWED_INDUSTRIES !== null &&
    SCREENING_RULES.ALLOWED_INDUSTRIES.indexOf(lastResponse("industry")) === -1
  ) {
    reasons.push("industry");
  }
  return { pass: reasons.length === 0, reasons: reasons };
}

// Records the decision on its own row (no screen is shown)
var screening_decision = {
  type: jsPsychHtmlKeyboardResponse,
  stimulus: "",
  choices: "NO_KEYS",
  trial_duration: 10,
  data: { trial_kind: "screening_decision" },
  on_finish: function (data) {
    var r = screeningResult();
    data.screen_pass = r.pass ? 1 : 0;
    data.screen_out_reason = r.reasons.join(";");
  },
};

// Shown only to participants who are screened out; returns them to Prolific
var screened_out = {
  timeline: [
    {
      type: jsPsychHtmlKeyboardResponse,
      stimulus:
        "<p><b>Thank you for your interest in this study.</b></p>" +
        "<p>Based on your answers, you are not eligible to take part in our study. " +
        "You will be returned to Prolific in a few seconds and <b> are asked to return your submission </b>.</p>",
      choices: "NO_KEYS",
      data: { trial_kind: "screened_out", screened_out: 1 },
      on_load: function () {
        // End the study after 4 s. Ending (rather than leaving the page) lets
        // DataPipe send this participant's file; the redirect to the
        // screen-out code then happens in index.html's on_finish.
        FINAL_REDIRECT_URL = STUDY_SETTINGS.SCREEN_OUT_URL;
        setTimeout(function () {
          jsPsych.endExperiment();
        }, 4000);
      },
    },
  ],
  conditional_function: function () {
    return !screeningResult().pass;
  },
};

// Verification questions: recorded for analysis, nobody is screened out here
var screening_details = {
  timeline: [question_job_title, question_work_description],
  conditional_function: function () {
    return screeningResult().pass;
  },
};

var screening = {
  timeline: [
    screening_begin,
    question_employment,
    question_student,
    question_industry,
    question_industry_other,
    screening_decision,
    screened_out,
    screening_details,
  ],
};

/* ############################################################################
              BLOCK 2: DEMOGRAPHICS AND DESIGN EXPERTISE (end of study)
   ############################################################################ */

var demographic_begin = {
  type: jsPsychHtmlKeyboardResponse,
  stimulus:
    "<div>Next, we will ask you some questions regarding demographics.</div>",
  choices: "NO_KEYS",
  trial_duration: 3000,
};

var question_age = numericQuestion(
  "age",
  "<strong>How old are you?</strong> (in years)",
  18,
  99,
  "demographic"
);

var scale_gender = [
  "Woman / Transwoman",
  "Man / Transman",
  "Gender queer / Gender non-conforming / Gender non-binary",
  "Two-Spirited",
  "I prefer to self-describe",
  "I prefer not to answer",
];

var question_gender = choiceQuestion(
  "gender",
  "<strong>With which gender do you identify?</strong>",
  scale_gender,
  "demographic"
);

var question_gender_self = followUp(
  "gender_self",
  "<strong>Please describe your gender.</strong>",
  "gender",
  "I prefer to self-describe",
  "demographic"
);

var ETHNICITY_SPECIFY =
  "I prefer to specify: Please describe your racial/ethnic background by typing into the box in the next question";

var scale_ethnicity = [
  "Black/African (e.g., Haitian, Jamaican, Somali)",
  "White/European (e.g., Irish, Swedish, Italian)",
  "Arab or West Asian (e.g., Armenian, Egyptian, Iranian, Lebanese, Moroccan)",
  "East Asian (e.g., Chinese, Japanese, Korean)",
  "South Asian (e.g., East Indian, Pakistani, Punjabi, Sri Lankan)",
  "Southeast Asian (e.g, Cambodian, Indonesian, Laotian)",
  "Indigenous (e.g., First Nations, Metis, Inuit, American Indian, Alaska Native, Native Hawaiian, or Pacific Islander)",
  "Latin American/Hispanic (e.g., Mexican, Venezuelan, Cuban)",
  "I prefer not to answer",
  ETHNICITY_SPECIFY,
];

var question_ethnicity = {
  type: jsPsychSurveyMultiSelect,
  questions: [
    {
      prompt:
        "<strong>What racial or ethnic groups best describe you? (select all that apply)</strong>",
      options: scale_ethnicity,
      name: "ethnicity",
      required: true,
    },
  ],
  button_label: "Continue",
  data: { question_type: "demographic", question_name: "ethnicity" },
  on_finish: function (data) {
    // Stored as a semicolon-separated string so it stays in one CSV cell
    data.ethnicity_list = data.response["ethnicity"];
    data.ethnicity = data.response["ethnicity"].join("; ");
  },
};

// The "next question" that the specify option refers to
var question_ethnicity_specify = {
  timeline: [
    textQuestion(
      "ethnicity_specify",
      "<strong>Please describe your racial/ethnic background.</strong>",
      "demographic"
    ),
  ],
  conditional_function: function () {
    var rows = jsPsych.data.get().filter({ question_name: "ethnicity" }).values();
    var list = rows[rows.length - 1].ethnicity_list;
    return list.indexOf(ETHNICITY_SPECIFY) !== -1;
  },
};

var scale_degree = [
  "No high school",
  "Some high school, no diploma",
  "High school diploma or GED equivalent",
  "Some university/college, no degree",
  "Associate (2-year) degree / college diploma",
  "Bachelor’s (4-year) degree",
  "Master’s degree",
  "Doctorate degree",
  "I prefer not to answer",
];

var question_degree = choiceQuestion(
  "degree",
  "<strong>What is your highest level of education completed?</strong>",
  scale_degree,
  "demographic"
);

var question_degree_field = textQuestion(
  "degree_field",
  "<strong>What was the field or major of your highest degree?</strong> (e.g., Mechanical Engineering, Industrial Design). If not applicable, type N/A.",
  "demographic"
);

var question_english_first = choiceQuestion(
  "english_first",
  "<strong>Is English your first language?</strong>",
  ["Yes", "No"],
  "demographic"
);

var question_english_fluency = {
  timeline: [
    choiceQuestion(
      "english_fluency",
      "<strong>How would you rate your English fluency?</strong>",
      ["Native-like", "Fluent", "Intermediate", "Basic"],
      "demographic"
    ),
  ],
  conditional_function: function () {
    return lastResponse("english_first") === "No";
  },
};

var question_country = textQuestion(
  "country",
  "<strong>In which country do you currently live?</strong>",
  "demographic"
);

/* ---------- Design expertise ---------- */

var expertise_begin = {
  type: jsPsychHtmlKeyboardResponse,
  stimulus:
    "<div>Finally, we will ask you some questions about your design experience.</div>",
  choices: "NO_KEYS",
  trial_duration: 3000,
};

// Definition stated in the item so "experience" is interpreted consistently
var question_years_experience = numericQuestion(
  "years_experience",
  "<strong>How many years of paid professional design experience do you have?</strong><br>" +
    "Count only paid work in a design role (full-time, part-time, or freelance). " +
    "Do not count years spent as a student, internships during a degree, or unpaid projects. " +
    "Enter a number (e.g., 4 or 4.5).",
  0,
  60,
  "expertise"
);

var question_design_domain = choiceQuestion(
  "design_domain",
  "<strong>Which type of design work do you do most often?</strong>",
  [
    "Mechanical / engineering design",
    "Industrial / product design",
    "Architectural design",
    "UX / interaction design",
    "Systems engineering",
    "Other",
  ],
  "expertise"
);

var question_design_domain_other = followUp(
  "design_domain_other",
  "<strong>Please describe the type of design work you do most often.</strong>",
  "design_domain",
  "Other",
  "expertise"
);

var question_activity_frequency = choiceQuestion(
  "activity_frequency",
  "<strong>In your work, how often do you do " + TASK_ACTIVITY + "?</strong>",
  [
    "Daily",
    "Weekly",
    "Monthly",
    "A few times a year",
    "Rarely or never",
  ],
  "expertise"
);

var question_genai_use = choiceQuestion(
  "genai_use",
  "<strong>Do you use generative AI tools (e.g., ChatGPT, Claude, Midjourney, Copilot) in your design work?</strong>",
  ["Yes", "No", "I prefer not to answer"],
  "expertise"
);

var question_genai_frequency = {
  timeline: [
    choiceQuestion(
      "genai_frequency",
      "<strong>How often do you use generative AI tools in your design work?</strong>",
      [
        "Daily",
        "Weekly",
        "Monthly",
        "A few times a year",
        "Rarely",
      ],
      "expertise"
    ),
  ],
  conditional_function: function () {
    return lastResponse("genai_use") === "Yes";
  },
};

var demographics = {
  timeline: [
    demographic_begin,
    question_age,
    question_gender,
    question_gender_self,
    question_ethnicity,
    question_ethnicity_specify,
    question_degree,
    question_degree_field,
    question_english_first,
    question_english_fluency,
    question_country,
    expertise_begin,
    question_years_experience,
    question_design_domain,
    question_design_domain_other,
    question_activity_frequency,
    question_genai_use,
    question_genai_frequency,
  ],
};

/* ############################################################################
   USAGE in your main timeline:
     timeline.push(PROLIFIC_ID, screening);   // screen-out happens here
     ...main task...
     timeline.push(demographics);

   SCREENED OUT DURING THE STUDY (SCREENING_RULES above):
     - employment == "Not currently employed" or "I prefer not to answer"
     - student_status == "Yes, full-time"
     - industry not in ALLOWED_INDUSTRIES (only if that list is set)

   EXCLUSION RULES (applied at analysis, decide and preregister these):
     - work_description empty, off-topic, or copied (code by hand, blind to condition)
     - years_experience below your minimum (e.g., < 2)
   ############################################################################ */
