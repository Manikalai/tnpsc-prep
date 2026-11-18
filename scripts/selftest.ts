// Offline checks that need no keys: aptitude answers are right, options distinct, syllabus totals add up.
import { APT_TYPES } from "../lib/aptitude";
import { EXAMS } from "../data/syllabus";
import { mdToHtml } from "../components/Md";
import { validate } from "../lib/questions";

let fail = 0;
const check = (cond: boolean, msg: string) => { if (!cond) { fail++; console.error("✗", msg); } };

for (const t of APT_TYPES) {
  for (let i = 0; i < 300; i++) {
    const q = t.gen();
    check(q.options.length === 4, `${t.key}: 4 options (${q.options})`);
    check(new Set(q.options).size === 4, `${t.key}: distinct options ${q.options.join(" | ")}`);
    check(q.answer_index >= 0 && q.answer_index < 4, `${t.key}: answer index`);
    check(q.explanation.includes(q.options[q.answer_index].replace(/ .*$/, "").replace(/%$/, "")), `${t.key}: explanation mentions answer — ${q.stem} → ${q.options[q.answer_index]} :: ${q.explanation}`);
  }
}
for (const e of EXAMS) {
  const sum = e.parts.reduce((s, p) => s + p.units.reduce((t, u) => t + u.questions, 0), 0);
  check(sum === e.totalQuestions, `${e.code} blueprint sums to ${sum}`);
}
check(mdToHtml("| a | b |\n|---|---|\n| 1 | 2 |").includes("<td>1</td>"), "markdown table");
check(mdToHtml("<script>x</script>").includes("&lt;script"), "markdown escapes html");
check(validate({ stem: "இந்தியாவின் தலைநகரம் எது?", options: ["தில்லி", "மும்பை", "சென்னை", "கொல்கத்தா"], answer_index: 0 }) !== null, "validate ok");
check(validate({ stem: "What is the capital?", options: ["a", "b", "c", "d"], answer_index: 0 }) === null, "validate rejects English stem");
check(validate({ stem: "இந்தியாவின் தலைநகரம் எது?", options: ["தில்லி", "தில்லி", "சென்னை", "கொல்கத்தா"], answer_index: 0 }) === null, "validate rejects duplicate options");
console.log(fail ? `${fail} checks failed` : "all checks passed");
process.exit(fail ? 1 : 0);
