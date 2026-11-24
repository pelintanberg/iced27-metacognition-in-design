/* ############################################################################
              NEED FOR COGNITION SCALE: NCS-6 (default) OR NCS-18
   ############################################################################
   NCS-6: Coelho, Hanel, & Wolf (2020), Assessment, 27(8), 1870–1885.
          Items 1, 2, 3, 4, 11, 15 of the NCS-18; items 3 and 4 reverse-scored.
          Response scale: 1 = extremely uncharacteristic of me to
          5 = extremely characteristic of me.
   Items and reverse-scored items: Cacioppo, Petty, & Kao (1984), Journal of
   Personality Assessment, 48(3), 306–307, Table 1.
   Reverse-scored (asterisked in Table 1): 3, 4, 5, 7, 8, 9, 12, 16, 17.

   NCS-18 response scale: Cacioppo et al. (1984) do not report one. Choose
   with NFC_SCALE below and report your choice:
     "characteristic5": 1 = extremely uncharacteristic of me ...
                        5 = extremely characteristic of me
     "agree9":          -4 = very strong disagreement ... +4 = very strong agreement
                        (stored as -4 to +4)
   Scoring: reverse-scored items are flipped, then nfc_mean = mean of the
   items shown (6 or 18). Item columns (nfc_1, nfc_2, ...) keep the raw,
   unreversed responses and the original NCS-18 item numbers.
   Layout: grid (statements left, shared answer labels on top); see
   gridTrial() in design_task.js, which must be loaded before this file.
   Requires: plugin-survey-html-form
   ############################################################################ */

var NFC_VERSION = "ncs6"; // "ncs6" (6 items) or "ncs18" (18 items)
var NFC_SCALE = "characteristic5"; // or "agree9" (NCS-18 only)
if (NFC_VERSION === "ncs6") NFC_SCALE = "characteristic5"; // the scale NCS-6 was validated with

var NCS6_ITEMS = [1, 2, 3, 4, 11, 15];

var NFC_ITEMS = [
  { num: 1, reverse: false, text: "I would prefer complex to simple problems." },
  { num: 2, reverse: false, text: "I like to have the responsibility of handling a situation that requires a lot of thinking." },
  { num: 3, reverse: true, text: "Thinking is not my idea of fun." },
  { num: 4, reverse: true, text: "I would rather do something that requires little thought than something that is sure to challenge my thinking abilities." },
  { num: 5, reverse: true, text: "I try to anticipate and avoid situations where there is likely chance I will have to think in depth about something." },
  { num: 6, reverse: false, text: "I find satisfaction in deliberating hard and for long hours." },
  { num: 7, reverse: true, text: "I only think as hard as I have to." },
  { num: 8, reverse: true, text: "I prefer to think about small, daily projects to long-term ones." },
  { num: 9, reverse: true, text: "I like tasks that require little thought once I’ve learned them." },
  { num: 10, reverse: false, text: "The idea of relying on thought to make my way to the top appeals to me." },
  { num: 11, reverse: false, text: "I really enjoy a task that involves coming up with new solutions to problems." },
  { num: 12, reverse: true, text: "Learning new ways to think doesn’t excite me very much." },
  { num: 13, reverse: false, text: "I prefer my life to be filled with puzzles that I must solve." },
  { num: 14, reverse: false, text: "The notion of thinking abstractly is appealing to me." },
  { num: 15, reverse: false, text: "I would prefer a task that is intellectual, difficult, and important to one that is somewhat important but does not require much thought." },
  { num: 16, reverse: true, text: "I feel relief rather than satisfaction after completing a task that required a lot of mental effort." },
  { num: 17, reverse: true, text: "It’s enough for me that something gets the job done; I don’t care how or why it works." },
  { num: 18, reverse: false, text: "I usually end up deliberating about issues even when they do not affect me personally." },
];

var NFC_ITEMS_SHOWN = NFC_ITEMS.filter(function (item) {
  return NFC_VERSION === "ncs18" || NCS6_ITEMS.indexOf(item.num) !== -1;
});

var NFC_SCALES = {
  characteristic5: {
    instructions: "Please indicate how characteristic each statement is of you.",
    // Coelho et al. (2020) report labels only for the end points
    labels: [
      "1 = Extremely uncharacteristic of me",
      "2",
      "3",
      "4",
      "5 = Extremely characteristic of me",
    ],
    min: 1,
  },
  agree9: {
    instructions: "Please indicate how much you agree or disagree with each statement.",
    labels: [
      "−4 Very strong disagreement", "−3", "−2", "−1", "0 Neither",
      "+1", "+2", "+3", "+4 Very strong agreement",
    ],
    min: -4,
  },
};

// Grid layout (gridTrial is defined in design_task.js)
var nfc = gridTrial({
  preamble:
    "<p><b>" + NFC_SCALES[NFC_SCALE].instructions + "</b></p>" +
    "<p>There are no right or wrong answers.</p>",
  rows: NFC_ITEMS_SHOWN.map(function (item) {
    return { name: "nfc_" + item.num, text: item.text };
  }),
  labels: NFC_SCALES[NFC_SCALE].labels,
  values: NFC_SCALES[NFC_SCALE].labels.map(function (l, i) {
    return NFC_SCALES[NFC_SCALE].min + i;
  }),
  data: { trial_kind: "nfc", nfc_version: NFC_VERSION, nfc_scale: NFC_SCALE },
  on_finish: function (data) {
    var scale = NFC_SCALES[NFC_SCALE];
    var min = scale.min;
    var max = scale.min + scale.labels.length - 1;
    var sum = 0;
    NFC_ITEMS_SHOWN.forEach(function (item) {
      var name = "nfc_" + item.num;
      var v = parseInt(data.response[name], 10); // stored on the scale's own values
      data[name] = v;
      sum += item.reverse ? max + min - v : v;
    });
    data.nfc_mean = sum / NFC_ITEMS_SHOWN.length;
  },
});
