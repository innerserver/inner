const { randomUUID } = require("crypto");
const fileExtensions = [".pdf", ".doc", ".docx", ".ppt", ".pptx", ".xls", ".xlsx", ".txt", ".csv", ".png", ".jpg", ".jpeg", ".webp", ".gif", ".heic", ".heif"];
function buildFormQuestions(source) {
  const fail = () => { throw Object.assign(new Error("Check question types, file limits and conditional questions"), { statusCode: 400 }); };
  const questions = source.map((entry, index) => {
    const type = ["text", "paragraph", "choice", "checkbox", "dropdown", "email", "tel", "number", "date", "time", "url", "file"].includes(entry.type) ? entry.type : "text";
    const question = { id: randomUUID(), label: String(entry.label || "").trim().slice(0, 500), type, required: Boolean(entry.required), options: [...new Set((Array.isArray(entry.options) ? entry.options : []).map((value) => String(value).trim().slice(0, 200)).filter(Boolean))].slice(0, 20) };
    if (type === "file") {
      question.maxFiles = Number(entry.maxFiles || 3);
      question.maxFileBytes = Number(entry.maxFileBytes || 20 * 1024 * 1024);
      question.accept = (Array.isArray(entry.accept) ? [...new Set(entry.accept)] : fileExtensions).map((ext) => String(ext).toLowerCase());
      if (!Number.isInteger(question.maxFiles) || question.maxFiles < 1 || question.maxFiles > 5 || !Number.isSafeInteger(question.maxFileBytes) || question.maxFileBytes < 1 || question.maxFileBytes > 50 * 1024 * 1024 || !question.accept.length || question.accept.some((ext) => !fileExtensions.includes(ext))) fail();
    }
    if (entry.showWhen) {
      const reference = Number(entry.showWhen.questionIndex);
      if (!Number.isInteger(reference) || reference < 0 || reference >= index) fail();
      question.showWhen = { questionIndex: reference, equals: String(entry.showWhen.equals || "").slice(0, 200) };
    }
    return question;
  });
  for (const question of questions) {
    if (!question.showWhen) continue;
    const sourceQuestion = questions[question.showWhen.questionIndex];
    if (!["choice", "checkbox", "dropdown"].includes(sourceQuestion.type) || !sourceQuestion.options.includes(question.showWhen.equals)) fail();
    question.showWhen = { questionId: sourceQuestion.id, equals: question.showWhen.equals };
  }
  return questions;
}
function formQuestionVisible(question, answers) {
  if (!question.showWhen) return true;
  const value = answers[question.showWhen.questionId];
  return Array.isArray(value) ? value.includes(question.showWhen.equals) : value === question.showWhen.equals;
}
module.exports = { buildFormQuestions, formQuestionVisible };
