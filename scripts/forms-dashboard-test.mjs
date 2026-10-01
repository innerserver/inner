import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import vm from "node:vm";

// Exercise dashboard decisions and template rendering without a browser or server.
class Element {
  constructor(tag) {
    this.tagName = tag; this.children = []; this.textContent = ""; this._className = ""; this.events = {};
    this.classList = {
      add: (name) => this.classList.toggle(name, true),
      contains: (name) => this._className.split(/\s+/).includes(name),
      toggle: (name, enabled) => { const names = new Set(this._className.split(/\s+/).filter(Boolean)); if (enabled) names.add(name); else names.delete(name); this._className = [...names].join(" "); },
    };
  }
  set className(value) { this._className = value; }
  get className() { return this._className; }
  set value(value) { this._value = value; }
  get value() { return this._value ?? (this.tagName === "select" ? this.children[0]?.value || "" : ""); }
  append(...nodes) { for (const node of nodes) { node.parent = this; this.children.push(node); } }
  replaceChildren(...nodes) { this.children = []; this.append(...nodes); }
  addEventListener(name, handler) { this.events[name] = handler; }
  setAttribute() {}
  focus() {}
  remove() { if (this.parent) this.parent.children = this.parent.children.filter((node) => node !== this); }
  contains(node) { return this === node || this.children.some((child) => child.contains(node)); }
  querySelector(tag) { return walk(this).find((node) => node.tagName === tag); }
}
const walk = (node) => node.children.flatMap((child) => [child, ...walk(child)]);
const nodes = Object.fromEntries(["questionnairePanel", "questionnaireList", "createQuestionnaire", "manageQuestionnaires", "refreshQuestionnaires"].map((id) => [id, new Element("div")]));
nodes.questionnairePanel.className = "questionnaire-panel hidden";
const body = new Element("body");
const state = { user: { username: "alice", role: "member", grade: "9A" }, loggedIn: true, csrfToken: "session", rooms: [{ id: "main", name: "Main" }] };
let forms = [];
let sent = null;
const context = vm.createContext({
  window: { confirm: () => true }, state,
  document: { body, activeElement: null, getElementById: (id) => nodes[id], createElement: (tag) => new Element(tag), addEventListener() {}, removeEventListener() {} },
  api: async (_path, options) => { if (options?.json) { sent = options.json; return { ok: true }; } return { questionnaires: forms }; },
  isModerator: () => state.user.role === "moderator", notify: () => {}, setTimeout,
});
vm.runInContext(await readFile(new URL("../public/questionnaires.js", import.meta.url), "utf8"), context);
await context.window.refreshQuestionnaires(true);
assert.equal(nodes.questionnairePanel.classList.contains("hidden"), true);
assert.equal(nodes.questionnaireList.children.length, 0);
assert.equal(nodes.createQuestionnaire.classList.contains("hidden"), true);
assert.equal(nodes.manageQuestionnaires.classList.contains("hidden"), true);
forms = [{ id: "signup", title: "MUN registration", kind: "mun", canRespond: true, submitted: false, canManage: false, targetName: "Grade 9", createdBy: "teacher", questions: [] }];
await context.window.refreshQuestionnaires(true);
assert.equal(nodes.questionnairePanel.classList.contains("hidden"), false);
assert.equal(walk(nodes.questionnaireList).some((node) => node.textContent === "Sign up"), true);
forms[0].submitted = true;
await context.window.refreshQuestionnaires(true);
assert.equal(nodes.questionnairePanel.classList.contains("hidden"), true);
forms[0].submitted = false; forms[0].closed = true; forms[0].canRespond = false;
await context.window.refreshQuestionnaires(true);
assert.equal(nodes.questionnairePanel.classList.contains("hidden"), true);
console.log("PASS member dashboard hidden when empty, shown for pending forms, hidden after submission or closure");

forms = []; state.user.role = "moderator";
await context.window.refreshQuestionnaires(true);
assert.equal(nodes.questionnairePanel.classList.contains("hidden"), true);
assert.equal(nodes.createQuestionnaire.classList.contains("hidden"), false);
assert.equal(nodes.manageQuestionnaires.classList.contains("hidden"), false);
nodes.createQuestionnaire.onclick();
const editor = walk(body).find((node) => node.tagName === "form");
const kind = walk(editor).find((node) => node.tagName === "label" && node.textContent === "Form type").children[0];
kind.value = "mun"; kind.onchange();
const labels = walk(editor).filter((node) => node.tagName === "label" && node.textContent === "Question").map((node) => node.children[0].value);
assert.equal(labels.length, 10);
assert.equal(labels.includes("First committee preference"), true);
assert.equal(labels.includes("Registration confirmation"), true);
await editor.onsubmit({ preventDefault() {} });
assert.equal(sent.kind, "mun");
assert.equal(sent.title, "MUN registration");
assert.equal(sent.questions.filter((question) => question.type === "dropdown").length, 2);
assert.equal(sent.questions.some((question) => question.type === "checkbox" && question.options.length === 1 && question.required), true);
console.log("PASS staff controls available with empty dashboard, editable MUN template and signup payload");
