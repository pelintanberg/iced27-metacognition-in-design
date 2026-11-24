// Design calibration stimuli: 6 design problems + 1 practice problem
// Fields: problem_id, problem_text
// This file does not use jsPsych, so it can be loaded in <head> before
// jsPsych is initialized. Problem text must be displayed exactly as written.

/* ############################################################################
              OPENING LINE (shown above every problem, including practice)
   ############################################################################ */
var OPENING_LINE =
  "Your idea can be a product, a service, an app, a change to a space, or a mix.";

/* ############################################################################
              PRACTICE PROBLEM (not analysed; always presented first)
   ############################################################################ */
var PRACTICE_PROBLEM = {
  problem_id: "PRAC",
  problem_text: "A way to stop people forgetting their keys when they leave home.",
};

/* ############################################################################
              MASTER PROBLEM LIST (6 problems)
   ############################################################################ */
var DESIGN_PROBLEMS = {
  P1: { problem_id: "P1", problem_text: "A way for people to stay active while travelling." },
  P2: { problem_id: "P2", problem_text: "A way for people to keep track of time without looking at a screen." },
  P3: { problem_id: "P3", problem_text: "A new way to make frothy milk for coffee at home." },
  P4: { problem_id: "P4", problem_text: "A way to reduce accidents when people walk while looking at their phones." },
  P5: { problem_id: "P5", problem_text: "A way to make public drinking fountains usable by all people." },
  P6: { problem_id: "P6", problem_text: "A way to help a household use less energy." },
};

/* ############################################################################
              PROBLEM SETS: balanced incomplete block design
   ############################################################################
   6 problems in sets of 3: 10 sets. Each problem appears in 5 sets; every
   pair of problems appears together in exactly 2 sets. */
var PROBLEM_SETS = {
  S01: ["P1", "P2", "P3"],
  S02: ["P1", "P2", "P4"],
  S03: ["P1", "P3", "P5"],
  S04: ["P1", "P4", "P6"],
  S05: ["P1", "P5", "P6"],
  S06: ["P2", "P3", "P6"],
  S07: ["P2", "P4", "P5"],
  S08: ["P2", "P5", "P6"],
  S09: ["P3", "P4", "P5"],
  S10: ["P3", "P4", "P6"],
};

/* ############################################################################
              ORDERS: all 6 permutations of (a, b, c)
   ############################################################################
   (a, b, c) = the set's problems in the order listed above.
   Within each set, every problem appears in every serial position twice. */
var PROBLEM_ORDERS = {
  O1: [0, 1, 2], // a, b, c
  O2: [0, 2, 1], // a, c, b
  O3: [1, 0, 2], // b, a, c
  O4: [1, 2, 0], // b, c, a
  O5: [2, 0, 1], // c, a, b
  O6: [2, 1, 0], // c, b, a
};

/* ############################################################################
              CELLS: 10 sets x 6 orders = 60 cells, ids like "S03_O4"
   ############################################################################ */
var CELL_IDS = [];
Object.keys(PROBLEM_SETS).forEach(function (setId) {
  Object.keys(PROBLEM_ORDERS).forEach(function (orderId) {
    CELL_IDS.push(setId + "_" + orderId);
  });
});

// Returns the three problems for a cell id (e.g. "S03_O4"), in presentation
// order. An unknown or missing id draws a cell at random.
function getAssignment(cellId) {
  if (CELL_IDS.indexOf(cellId) === -1) {
    cellId = CELL_IDS[Math.floor(Math.random() * CELL_IDS.length)];
  }
  var parts = cellId.split("_");
  var setId = parts[0];
  var orderId = parts[1];
  var set = PROBLEM_SETS[setId];
  var problems = PROBLEM_ORDERS[orderId].map(function (k) {
    return DESIGN_PROBLEMS[set[k]];
  });
  return {
    cell_id: cellId,
    set_id: setId,
    order_id: orderId,
    problems: problems,
    problem_ids: problems.map(function (p) {
      return p.problem_id;
    }),
  };
}
