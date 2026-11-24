/* ############################################################################
              METACOGNITIVE AWARENESS INVENTORY: 19-ITEM VERSION
   ############################################################################
   Items: Schraw & Dennison (1994), original item numbers kept in `mai_num`.
   Subset: Harrison & Vallin (2018), Metacognition and Learning, Table 4
           (cross-checked against the item eliminations in their Table 3).
   Response scale: the fully labelled 5-point "typical of me" scale used by
           Harrison & Vallin (2018), not the original false-true format.
   No items are reverse-scored.
   Scoring: mai_knowledge = mean of 8 knowledge items;
            mai_regulation = mean of 11 regulation items.
   Attention check: one instructed-response item ("select Fairly typical of
   me") sits among the MAI items. It is not scored; attention_check_pass = 1
   when answered as instructed.
   Layout: grid (statements left, shared answer labels on top); see
   gridTrial() in design_task.js, which must be loaded before this file.
   Requires: plugin-survey-html-form
   ############################################################################ */

var MAI_ITEMS = [
  // dim: K = knowledge of cognition, R = regulation of cognition
  // sub: DK declarative, PK procedural, CK conditional knowledge;
  //      P planning, IMS information management, M monitoring,
  //      E evaluation, DS debugging
  { mai_num: 6, dim: "R", sub: "P", text: "I think about what I really need to learn before I begin a task." },
  { mai_num: 8, dim: "R", sub: "P", text: "I set specific goals before I begin a task." },
  { mai_num: 10, dim: "K", sub: "DK", text: "I know what kind of information is most important to learn." },
  { mai_num: 16, dim: "K", sub: "DK", text: "I know what the teacher expects me to learn." },
  { mai_num: 20, dim: "K", sub: "DK", text: "I have control over how well I learn." },
  { mai_num: 21, dim: "R", sub: "M", text: "I periodically review to help me understand important relationships." },
  { mai_num: 24, dim: "R", sub: "E", text: "I summarize what I’ve learned after I finish." },
  { mai_num: 26, dim: "K", sub: "CK", text: "I can motivate myself to learn when I need to." },
  { mai_num: 27, dim: "K", sub: "PK", text: "I am aware of what strategies I use when I study." },
  { mai_num: 32, dim: "K", sub: "DK", text: "I am a good judge of how well I understand something." },
  { mai_num: 33, dim: "K", sub: "PK", text: "I find myself using helpful learning strategies automatically." },
  { mai_num: 35, dim: "K", sub: "CK", text: "I know when each strategy I use will be most effective." },
  { mai_num: 39, dim: "R", sub: "IMS", text: "I try to translate new information into my own words." },
  { mai_num: 40, dim: "R", sub: "DS", text: "I change strategies when I fail to understand." },
  { mai_num: 41, dim: "R", sub: "IMS", text: "I use the organizational structure of the text to help me learn." },
  { mai_num: 43, dim: "R", sub: "IMS", text: "I ask myself if what I’m reading is related to what I already know." },
  { mai_num: 44, dim: "R", sub: "DS", text: "I re-evaluate my assumptions when I get confused." },
  { mai_num: 50, dim: "R", sub: "E", text: "I ask myself if I learned as much as I could have once I finish a task." },
  { mai_num: 51, dim: "R", sub: "DS", text: "I stop and go back over new information that is not clear." },
];

var MAI_LABELS = [
  "1 = Not at all typical of me",
  "2 = Not very typical of me",
  "3 = Somewhat typical of me",
  "4 = Fairly typical of me",
  "5 = Very typical of me",
];

// Instructed-response attention check, shown after the 10th MAI item
var MAI_ATTENTION_ITEM = {
  name: "mai_attention",
  text: "To show that you are reading carefully, please select “Fairly typical of me” for this statement.",
  correct: 4, // value of "4 = Fairly typical of me"
  position: 10,
};

// Rows of the grid, in the original MAI order, with the attention check inserted
var MAI_ROWS = MAI_ITEMS.map(function (item) {
  return { name: "mai_" + item.mai_num, text: item.text };
});
MAI_ROWS.splice(MAI_ATTENTION_ITEM.position, 0, {
  name: MAI_ATTENTION_ITEM.name,
  text: MAI_ATTENTION_ITEM.text,
});

// Grid layout (gridTrial is defined in design_task.js)
var mai = gridTrial({
  preamble:
    "<p><b>Please read each statement and indicate how typical it is of you.</b></p>" +
    "<p>There are no right or wrong answers.</p>",
  rows: MAI_ROWS,
  labels: MAI_LABELS,
  values: [1, 2, 3, 4, 5],
  data: { trial_kind: "mai" },
  on_finish: function (data) {
    var k = [], r = [];
    MAI_ITEMS.forEach(function (item) {
      var name = "mai_" + item.mai_num;
      var v = parseInt(data.response[name], 10);
      data[name] = v;
      (item.dim === "K" ? k : r).push(v);
    });
    var mean = function (a) {
      return a.reduce(function (s, x) { return s + x; }, 0) / a.length;
    };
    data.attention_check_response = parseInt(data.response[MAI_ATTENTION_ITEM.name], 10);
    data.attention_check_pass = data.attention_check_response === MAI_ATTENTION_ITEM.correct ? 1 : 0;
    data.mai_knowledge = mean(k);
    data.mai_regulation = mean(r);
  },
});
