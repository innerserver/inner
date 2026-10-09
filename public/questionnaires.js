(() => {
  let forms = [];
  let loadedFor = "";
  let loading = false;
  let refreshAgain = false;
  let managementList = null;
  const modalStack = [];
  let modalSequence = 0;
  const kinds = { questionnaire: "Questionnaire", signup: "Signup form", mun: "MUN signup", feedback: "Feedback form" };
  const templates = {
    signup: { title: "Event signup", questions: [
      { label: "Full name", type: "text" }, { label: "Email address", type: "email" },
      { label: "Phone number", type: "tel", required: false },
      { label: "Preferred session", type: "dropdown", options: ["Morning", "Afternoon"] },
      { label: "Additional requirements", type: "paragraph", required: false },
    ] },
    mun: { title: "MUN registration", questions: [
      { label: "Delegate full name", type: "text" }, { label: "Contact email", type: "email" },
      { label: "School / institution", type: "text" },
      { label: "First committee preference", type: "dropdown", options: ["UNGA", "UNSC", "UNHRC", "ECOSOC"] },
      { label: "Second committee preference", type: "dropdown", options: ["UNGA", "UNSC", "UNHRC", "ECOSOC"], required: false },
      { label: "Country preferences", type: "text" },
      { label: "Previous MUN experience", type: "choice", options: ["First MUN", "1-2 conferences", "3 or more conferences"] },
      { label: "Roles of interest", type: "checkbox", options: ["Delegate", "International press", "Organising team"] },
      { label: "Dietary or accessibility requirements", type: "paragraph", required: false },
      { label: "Registration confirmation", type: "checkbox", options: ["I confirm my registration details are correct"] },
    ] },
    feedback: { title: "Event feedback", questions: [
      { label: "Overall experience", type: "choice", options: ["Excellent", "Good", "Average", "Poor"] },
      { label: "What worked well?", type: "paragraph" },
      { label: "What could improve?", type: "paragraph", required: false },
    ] },
  };
  const el = (tag, text, className) => {
    const node = document.createElement(tag);
    if (text !== undefined) node.textContent = text;
    if (className) node.className = className;
    return node;
  };
  const button = (text, action, primary = false) => {
    const node = el("button", text, primary ? "primary-button compact-button" : "secondary-button compact-button");
    node.type = "button";
    node.addEventListener("click", action);
    return node;
  };
  const field = (label, input) => {
    const node = el("label", label);
    node.append(input);
    return node;
  };
  const toolButton = (symbol, title, action) => {
    const node = button(symbol, action);
    node.className = "questionnaire-tool";
    node.title = title;
    node.setAttribute("aria-label", title);
    return node;
  };
  const input = (type = "text", max = 500) => {
    const node = el("input");
    node.type = type;
    node.maxLength = max;
    return node;
  };
  const select = (options) => {
    const node = el("select");
    options.forEach(([value, label]) => {
      const option = el("option", label);
      option.value = value;
      node.append(option);
    });
    return node;
  };
  function modal(title) {
    const overlay = el("div", undefined, "strike-modal-backdrop");
    const dialog = el("section", undefined, "strike-modal questionnaire-dialog");
    dialog.setAttribute("role", "dialog");
    dialog.setAttribute("aria-modal", "true");
    const heading = el("h3", title);
    heading.id = `questionnaireDialogTitle-${++modalSequence}`;
    dialog.setAttribute("aria-labelledby", heading.id);
    const previousFocus = document.activeElement;
    const close = () => {
      if (managementList && dialog.contains(managementList)) managementList = null;
      overlay.remove(); document.removeEventListener("keydown", keydown); previousFocus?.focus();
      const index = modalStack.indexOf(overlay);
      if (index !== -1) modalStack.splice(index, 1);
    };
    const keydown = (event) => {
      if (modalStack[modalStack.length - 1] !== overlay) return;
      if (event.key === "Escape") close();
      if (event.key === "Tab") {
        const nodes = [...dialog.querySelectorAll("button,input,textarea,select")].filter((node) => !node.disabled && node.getClientRects().length);
        const first = nodes[0], last = nodes[nodes.length - 1];
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
      }
    };
    document.addEventListener("keydown", keydown);
    overlay.addEventListener("click", (event) => { if (event.target === overlay) close(); });
    const header = el("header", undefined, "questionnaire-modal-header");
    header.append(heading, toolButton("\u00d7", "Close form", close));
    dialog.append(header);
    overlay.append(dialog);
    document.body.append(overlay);
    modalStack.push(overlay);
    dialog.querySelector("button").focus();
    return { dialog, close };
  }
  window.refreshQuestionnaires = async (force = false) => {
    if (!state.user || !state.loggedIn) return;
    const keyForUser = () => `${state.user?.username}:${state.user?.grade}:${state.user?.role}:${state.csrfToken}`;
    const key = keyForUser();
    if (loading) { if (force) refreshAgain = true; return; }
    if (!force && loadedFor === key) return;
    loading = true;
    const list = document.getElementById("questionnaireList");
    const panel = document.getElementById("questionnairePanel");
    const create = document.getElementById("createQuestionnaire");
    const manage = document.getElementById("manageQuestionnaires");
    create.classList.toggle("hidden", !isModerator());
    manage.classList.toggle("hidden", !isModerator());
    create.onclick = createForm;
    manage.onclick = openManagement;
    if (loadedFor !== key) { panel.classList.add("hidden"); list.replaceChildren(); }
    document.getElementById("refreshQuestionnaires").onclick = () => window.refreshQuestionnaires(true);
    try {
      const data = await api("/api/questionnaires");
      if (key !== keyForUser() || !state.loggedIn) return;
      forms = data.questionnaires || [];
      loadedFor = key;
      const available = forms.filter((form) => form.canRespond && !form.submitted);
      panel.classList.toggle("hidden", !available.length);
      renderForms(list, available);
      if (managementList) renderForms(managementList, forms.filter((form) => form.canManage));
    } catch (error) {
      panel.classList.add("hidden");
      if (force) notify(error.message);
    } finally {
      loading = false;
      if (refreshAgain) { refreshAgain = false; window.refreshQuestionnaires(true); }
    }
  };
  function renderForms(list, entries) {
    list.replaceChildren();
    entries.forEach((form) => {
        const card = el("article", undefined, "account-card questionnaire-card");
        card.append(el("strong", form.title), el("span", `${kinds[form.kind] || kinds.questionnaire} | ${form.targetName} | From ${form.createdBy} | ${form.closed ? "Closed" : form.submitted ? "Submitted" : "Open"}`));
        if (form.description) card.append(el("p", form.description));
        const actions = el("div", undefined, "account-actions");
        if (form.canRespond && !form.submitted) actions.append(button(["signup", "mun"].includes(form.kind) ? "Sign up" : "Complete form", () => answerForm(form), true));
        if (form.submitted) actions.append(button("Your response", () => answerForm(form, true)));
        if (form.canManage) {
          card.append(el("span", `${form.responses.length} responses | ${form.pending.length} awaiting response`));
          actions.append(button("Results", () => results(form)));
          if (!form.closed) actions.append(button("Close submissions", async () => {
            if (!window.confirm(`Close submissions for "${form.title}"?`)) return;
            try { await api(`/api/questionnaires/${form.id}/close`, { method: "POST", json: {} }); await window.refreshQuestionnaires(true); } catch (error) { notify(error.message); }
          }));
        }
        card.append(actions);
        list.append(card);
    });
    if (!entries.length && managementList === list) list.append(el("p", "No forms created yet", "panel-note"));
  }
  function openManagement() {
    const { dialog, close } = modal("Manage forms");
    dialog.append(button("Create form", () => { close(); createForm(); }, true));
    const list = el("div", undefined, "account-list");
    managementList = list;
    dialog.append(list);
    renderForms(list, forms.filter((form) => form.canManage));
    window.refreshQuestionnaires(true);
  }
  function createForm() {
    const { dialog, close } = modal("Create form");
    const form = el("form", undefined, "questionnaire-editor");
    const title = input("text", 120); title.required = true;
    const description = el("textarea"); description.maxLength = 2000; description.rows = 3;
    const kind = select(Object.entries(kinds));
    const scope = select([["room", "Room"], ["grade", "Grade"]]);
    const target = select([]);
    const grades = ["6", "7", "8", "9", "10", "11", "12"].flatMap((grade) => [grade, `${grade}A`, `${grade}B`, `${grade}C`]).concat(["college", "staff", "other"]);
    const updateTarget = () => {
      target.replaceChildren();
      const options = scope.value === "grade" ? grades.map((grade) => [grade, `Grade ${grade}`]) : state.rooms.map((room) => [room.id, room.name]);
      options.forEach(([value, label]) => { const option = el("option", label); option.value = value; target.append(option); });
    };
    scope.onchange = updateTarget; updateTarget();
    title.placeholder = "Untitled form";
    description.placeholder = "Form description";
    const details = el("div", undefined, "questionnaire-details");
    const audience = el("div", undefined, "questionnaire-audience");
    audience.append(field("Send to", scope), field("Room or grade", target));
    details.append(field("Form type", kind), field("Title", title), field("Description", description), audience);
    form.append(details);
    const questions = el("div", undefined, "questionnaire-questions");
    const rows = [];
    const refreshOrder = () => {
      questions.replaceChildren(...rows.map((entry, index) => {
        entry.heading.textContent = `Question ${index + 1}`;
        entry.up.disabled = index === 0;
        entry.down.disabled = index === rows.length - 1;
        return entry.row;
      }));
    };
    function addQuestion(seed = {}) {
      if (rows.length >= 50) return notify("Maximum 50 questions");
      const row = el("fieldset", undefined, "questionnaire-question");
      const heading = el("legend");
      const label = input(); label.required = true; label.value = seed.label || "";
      const type = select([["text", "Short answer"], ["paragraph", "Paragraph"], ["choice", "Multiple choice"], ["checkbox", "Checkboxes"], ["dropdown", "Dropdown"], ["email", "Email address"], ["tel", "Phone number"], ["number", "Number"], ["date", "Date"], ["time", "Time"], ["url", "Website URL"]]);
      type.value = seed.type || "text";
      const options = el("textarea"); options.rows = 3; options.maxLength = 4200;
      options.value = (seed.options || []).join("\n");
      const optionsField = field("Options (one per line)", options); optionsField.hidden = true;
      type.onchange = () => { optionsField.hidden = !["choice", "checkbox", "dropdown"].includes(type.value); };
      type.onchange();
      const required = input("checkbox"); required.checked = seed.required !== false;
      const data = { row, label, type, options, required, heading }; rows.push(data);
      const move = (offset) => {
        const index = rows.indexOf(data), next = index + offset;
        if (next < 0 || next >= rows.length) return;
        [rows[index], rows[next]] = [rows[next], rows[index]];
        refreshOrder();
      };
      data.up = toolButton("\u2191", "Move question up", () => move(-1));
      data.down = toolButton("\u2193", "Move question down", () => move(1));
      const tools = el("div", undefined, "questionnaire-question-tools");
      tools.append(field("Required", required), data.up, data.down,
        toolButton("+", "Duplicate question", () => addQuestion({ label: label.value, type: type.value, options: options.value.split(/\r?\n/), required: required.checked })),
        toolButton("\u00d7", "Remove question", () => { rows.splice(rows.indexOf(data), 1); refreshOrder(); }));
      const questionHeading = el("div", undefined, "questionnaire-question-heading");
      questionHeading.append(field("Question", label), field("Answer type", type));
      row.append(heading, questionHeading, optionsField, tools);
      refreshOrder();
    }
    addQuestion();
    let previousKind = kind.value;
    kind.onchange = () => {
      if (rows.some((row) => row.label.value.trim()) && !window.confirm("Replace the current questions with this form template?")) { kind.value = previousKind; return; }
      const previousTitle = templates[previousKind]?.title;
      previousKind = kind.value;
      rows.splice(0); questions.replaceChildren();
      const template = templates[kind.value];
      if (template) { if (!title.value || title.value === previousTitle) title.value = template.title; template.questions.forEach(addQuestion); }
      else addQuestion();
    };
    const send = el("button", "Send form", "primary-button"); send.type = "submit";
    const footer = el("div", undefined, "questionnaire-footer");
    footer.append(button("Add question", () => addQuestion()), button("Preview", () => {
      answerForm({ title: title.value || "Untitled form", description: description.value, questions: rows.map((row, index) => ({ id: `preview-${index}`, label: row.label.value || `Question ${index + 1}`, type: row.type.value, required: row.required.checked, options: row.options.value.split(/\r?\n/).map((value) => value.trim()).filter(Boolean) })) }, true);
    }), send);
    form.append(questions, footer);
    form.onsubmit = async (event) => {
      event.preventDefault(); send.disabled = true;
      try {
        await api("/api/questionnaires", { method: "POST", json: { kind: kind.value, title: title.value, description: description.value, scope: scope.value, target: target.value, questions: rows.map((row) => ({ label: row.label.value, type: row.type.value, required: row.required.checked, options: ["choice", "checkbox", "dropdown"].includes(row.type.value) ? row.options.value.split(/\r?\n/).map((value) => value.trim()).filter(Boolean) : [] })) } });
        close(); notify("Form sent"); await window.refreshQuestionnaires(true);
      } catch (error) { notify(error.message); } finally { send.disabled = false; }
    };
    dialog.append(form); title.focus();
  }
  function answerForm(questionnaire, readonly = false) {
    const { dialog, close } = modal(questionnaire.title);
    const form = el("form", undefined, "questionnaire-editor");
    if (questionnaire.description) form.append(el("p", questionnaire.description));
    const controls = new Map();
    questionnaire.questions.forEach((question, index) => {
      const group = el("fieldset", undefined, "questionnaire-question");
      group.append(el("legend", `${index + 1}. ${question.label}${question.required ? " *" : ""}`));
      const saved = questionnaire.ownResponse?.answers[question.id];
      const nodes = [];
      if (["choice", "checkbox"].includes(question.type)) {
        question.options.forEach((option) => {
          const control = input(question.type === "choice" ? "radio" : "checkbox");
          control.name = question.id; control.value = option;
          control.checked = Array.isArray(saved) ? saved.includes(option) : saved === option;
          control.disabled = readonly;
          if (question.type === "choice") control.required = question.required;
          nodes.push(control); group.append(field(option, control));
        });
      } else {
        const control = question.type === "dropdown" ? select([["", "Select an option"], ...question.options.map((option) => [option, option])]) : question.type === "paragraph" ? el("textarea") : input(["email", "tel", "number", "date", "time", "url"].includes(question.type) ? question.type : "text", 5000);
        if (question.type === "number") control.step = "any";
        if (question.type === "tel") control.pattern = "\\+?[0-9\\s.\\(\\)\\-]{5,40}";
        control.maxLength = 5000; control.required = question.required; control.disabled = readonly;
        control.value = saved || "";
        control.setAttribute("aria-label", question.label);
        nodes.push(control); group.append(control);
      }
      controls.set(question.id, nodes); form.append(group);
    });
    if (!readonly) {
      const send = el("button", "Submit response", "primary-button"); send.type = "submit";
      const footer = el("div", undefined, "questionnaire-footer");
      footer.append(el("span", "* Required", "panel-note"), send);
      form.append(footer);
      form.onsubmit = async (event) => {
        event.preventDefault(); const answers = {};
        for (const question of questionnaire.questions) {
          const nodes = controls.get(question.id);
          answers[question.id] = question.type === "checkbox" ? nodes.filter((node) => node.checked).map((node) => node.value) : question.type === "choice" ? nodes.find((node) => node.checked)?.value || "" : nodes[0].value;
          if (question.required && !answers[question.id].length) return notify(`Answer: ${question.label}`);
        }
        send.disabled = true;
        try { await api(`/api/questionnaires/${questionnaire.id}/responses`, { method: "POST", json: { answers } }); close(); notify("Response submitted"); await window.refreshQuestionnaires(true); } catch (error) { notify(error.message); } finally { send.disabled = false; }
      };
    }
    dialog.append(form);
  }
  function results(form) {
    const { dialog } = modal(`Results: ${form.title}`);
    const toolbar = el("div", undefined, "questionnaire-results-toolbar");
    toolbar.append(el("strong", `${form.responses.length} responses`));
    toolbar.append(button("Download CSV", () => {
      const rows = [["Username", "Grade", "Submitted at", ...form.questions.map((question) => question.label)], ...form.responses.map((response) => [response.username, response.grade, response.submittedAt, ...form.questions.map((question) => { const answer = response.answers[question.id]; return Array.isArray(answer) ? answer.join("; ") : answer || ""; })])];
      const csv = rows.map((row) => row.map((value) => { let text = String(value); if (/^[\s]*[=+@-]/.test(text)) text = `'${text}`; return `"${text.replace(/"/g, '""')}"`; }).join(",")).join("\r\n");
      const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
      const link = el("a"); link.href = url; link.download = "questionnaire-results.csv"; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
    }));
    dialog.append(toolbar);
    const tabs = el("div", undefined, "questionnaire-tabs");
    tabs.setAttribute("role", "tablist");
    tabs.setAttribute("aria-label", "Results view");
    const content = el("div", undefined, "questionnaire-results-content");
    content.id = `questionnaire-results-${modalSequence}`;
    content.setAttribute("role", "tabpanel");
    const tabButtons = [];
    const answerText = (value) => Array.isArray(value) ? value.join(", ") || "No answer" : String(value ?? "") || "No answer";
    const renderSummary = () => {
      content.replaceChildren();
      const pending = el("details", undefined, "questionnaire-pending");
      pending.append(el("summary", `${form.pending.length} awaiting response`), el("p", form.pending.join(", ") || "Everyone has responded"));
      content.append(pending);
      form.questions.forEach((question, index) => {
        const section = el("section", undefined, "questionnaire-result-question");
        section.append(el("h4", `${index + 1}. ${question.label}`));
        if (["choice", "checkbox", "dropdown"].includes(question.type)) {
          question.options.forEach((option) => {
            const count = form.responses.filter((response) => { const answer = response.answers[question.id]; return Array.isArray(answer) ? answer.includes(option) : answer === option; }).length;
            const row = el("div", undefined, "questionnaire-option-total");
            const progress = el("progress"); progress.max = Math.max(form.responses.length, 1); progress.value = count;
            progress.setAttribute("aria-label", `${option}: ${count} of ${form.responses.length} responses`);
            row.append(el("span", option), progress, el("strong", String(count)));
            section.append(row);
          });
        } else {
          form.responses.forEach((response) => {
            const answer = el("div", undefined, "questionnaire-result-answer");
            answer.append(el("strong", response.username), el("p", answerText(response.answers[question.id])));
            section.append(answer);
          });
        }
        if (!form.responses.length) section.append(el("p", "No responses yet", "panel-note"));
        content.append(section);
      });
    };
    const renderIndividual = () => {
      content.replaceChildren();
      if (!form.responses.length) { content.append(el("p", "No responses yet", "panel-note")); return; }
      const person = select(form.responses.map((response, index) => [String(index), `${response.username}${response.grade ? ` | ${response.grade}` : ""}`]));
      const answers = el("div");
      const showPerson = () => {
        const response = form.responses[Number(person.value)];
        answers.replaceChildren(el("p", `Submitted ${new Date(response.submittedAt).toLocaleString()}`, "panel-note"));
        form.questions.forEach((question, index) => {
          const section = el("section", undefined, "questionnaire-result-question");
          section.append(el("h4", `${index + 1}. ${question.label}`), el("p", answerText(response.answers[question.id])));
          answers.append(section);
        });
      };
      person.onchange = showPerson;
      content.append(field("Respondent", person), answers);
      showPerson();
    };
    const activate = (index) => {
      tabButtons.forEach((tab, i) => { tab.setAttribute("aria-selected", String(i === index)); tab.tabIndex = i === index ? 0 : -1; });
      content.setAttribute("aria-labelledby", tabButtons[index].id);
      if (index === 0) renderSummary(); else renderIndividual();
    };
    ["Summary", "Individual"].forEach((label, index) => {
      const tab = button(label, () => activate(index));
      tab.className = "questionnaire-tab";
      tab.id = `${content.id}-tab-${index}`;
      tab.setAttribute("role", "tab"); tab.setAttribute("aria-controls", content.id);
      tab.addEventListener("keydown", (event) => {
        if (["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) {
          event.preventDefault(); const next = event.key === "Home" ? 0 : event.key === "End" ? 1 : 1 - index;
          activate(next); tabButtons[next].focus();
        }
      });
      tabButtons.push(tab); tabs.append(tab);
    });
    dialog.append(tabs, content);
    activate(0);
  }
})();
