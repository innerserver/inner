(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.ConnectifiGrades = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  function gradeYear(value) {
    const text = String(value || "").trim().toLowerCase().replace(/\s+/g, "");
    const match = text.match(/^(6|7|8|9|10|11|12)(?:[abc])?$/);
    return match ? match[1] : ["college", "staff", "other"].includes(text) ? text : "";
  }
  function sameGrade(left, right) { const grade = gradeYear(left); return Boolean(grade) && grade === gradeYear(right); }
  function gradeSelectionMatches(selection, actual) {
    const chosen = String(selection || "").trim().toLowerCase();
    return /^(6|7|8|9|10|11|12)$/.test(chosen) ? sameGrade(chosen, actual) : Boolean(chosen) && chosen === String(actual || "").trim().toLowerCase();
  }
  return { gradeYear, sameGrade, gradeSelectionMatches };
});
