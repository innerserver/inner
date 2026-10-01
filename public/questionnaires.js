(() => {
  let forms = [];
  let loadedFor = "";
  let loading = false;
  let refreshAgain = false;
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
    heading.id = "questionnaireDialogTitle";
    dialog.setAttribute("aria-labelledby", heading.id);
    const previousFocus = document.activeElement;
    const close = () => { overlay.remove(); document.removeEventListener("keydown", keydown); previousFocus?.focus(); };
    const keydown = (event) => {
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
    dialog.append(heading, button("Close", close));
    overlay.append(dialog);
    document.body.append(overlay);
    dialog.querySelector("button").focus();
    return { dialog, close };
  }
  window.refreshQuestionnaires = async (force = false) => {
    if (!state.user || !state.loggedIn) return;
    const key = `${state.user.username}:${state.user.grade}:${state.user.role}`;
    if (loading) { if (force) refreshAgain = true; return; }
    if (!force && loadedFor === key) return;
    loading = true;
    const list = document.getElementById("questionnaireList");
    const create = document.getElementById("createQuestionnaire");
    create.classList.toggle("hidden", !isModerator());
    create.onclick = createForm;
    document.getElementById("refreshQuestionnaires").onclick = () => window.refreshQuestionnaires(true);
    try {
      const data = await api("/api/questionnaires");
      if (key !== `${state.user?.username}:${state.user?.grade}:${state.user?.role}` || !state.loggedIn) return;
      forms = data.questionnaires || [];
      loadedFor = key;
      list.replaceChildren();
      if (!forms.length) list.append(el("p", "No questionnaires yet", "panel-note"));
      forms.forEach((form) => {
        const card = el("article", undefined, "account-card questionnaire-card");
        card.append(el("strong", form.title), el("span", `${form.targetName} | From ${form.createdBy} | ${form.closed ? "Closed" : form.submitted ? "Submitted" : "Open"}`));
        if (form.description) card.append(el("p", form.description));
        const actions = el("div", undefined, "account-actions");
        if (form.canRespond && !form.submitted) actions.append(button("Answer", () => answerForm(form), true));
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
    } catch (error) {
      list.replaceChildren(el("p", error.message, "panel-note"));
    } finally {
      loading = false;
      if (refreshAgain) { refreshAgain = false; window.refreshQuestionnaires(true); }
    }
  };
  function createForm() {
    const { dialog, close } = modal("Create questionnaire");
    const form = el("form", undefined, "questionnaire-editor");
    const title = input("text", 120); title.required = true;
    const description = el("textarea"); description.maxLength = 2000; description.rows = 3;
    const scope = select([["room", "Room"], ["grade", "Grade"]]);
    const target = select([]);
    const grades = ["6", "7", "8", "9", "10", "11", "12"].flatMap((grade) => [grade, `${grade}A`, `${grade}B`, `${grade}C`]).concat(["college", "staff", "other"]);
    const updateTarget = () => {
      target.replaceChildren();
      const options = scope.value === "grade" ? grades.map((grade) => [grade, `Grade ${grade}`]) : state.rooms.map((room) => [room.id, room.name]);
      options.forEach(([value, label]) => { const option = el("option", label); option.value = value; target.append(option); });
    };
    scope.onchange = updateTarget; updateTarget();
    form.append(field("Title", title), field("Description", description), field("Send to", scope), field("Room or grade", target));
    const questions = el("div", undefined, "questionnaire-questions");
    const rows = [];
    function addQuestion() {
      if (rows.length >= 50) return notify("Maximum 50 questions");
      const row = el("fieldset", undefined, "questionnaire-question");
      const label = input(); label.required = true;
      const type = select([["text", "Short answer"], ["paragraph", "Paragraph"], ["choice", "Multiple choice"], ["checkbox", "Checkboxes"]]);
      const options = el("textarea"); options.rows = 3; options.maxLength = 4200;
      const optionsField = field("Options (one per line)", options); optionsField.hidden = true;
      type.onchange = () => { optionsField.hidden = !["choice", "checkbox"].includes(type.value); };
      const required = input("checkbox"); required.checked = true;
      const data = { row, label, type, options, required }; rows.push(data);
      row.append(field("Question", label), field("Answer type", type), optionsField, field("Required", required), button("Remove question", () => { rows.splice(rows.indexOf(data), 1); row.remove(); }));
      questions.append(row);
    }
    addQuestion();
    const send = el("button", "Send questionnaire", "primary-button"); send.type = "submit";
    form.append(questions, button("Add question", addQuestion), send);
    form.onsubmit = async (event) => {
      event.preventDefault(); send.disabled = true;
      try {
        await api("/api/questionnaires", { method: "POST", json: { title: title.value, description: description.value, scope: scope.value, target: target.value, questions: rows.map((row) => ({ label: row.label.value, type: row.type.value, required: row.required.checked, options: row.options.value.split(/\r?\n/).map((value) => value.trim()).filter(Boolean) })) } });
        close(); notify("Questionnaire sent"); await window.refreshQuestionnaires(true);
      } catch (error) { notify(error.message); } finally { send.disabled = false; }
    };
    dialog.append(form); title.focus();
  }
  function answerForm(questionnaire, readonly = false) {
    const { dialog, close } = modal(questionnaire.title);
    const form = el("form", undefined, "questionnaire-editor");
    if (questionnaire.description) form.append(el("p", questionnaire.description));
    const controls = new Map();
    questionnaire.questions.forEach((question) => {
      const group = el("fieldset", undefined, "questionnaire-question");
      group.append(el("legend", `${question.label}${question.required ? " *" : ""}`));
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
        const control = question.type === "paragraph" ? el("textarea") : input("text", 5000);
        control.maxLength = 5000; control.required = question.required; control.disabled = readonly;
        control.value = saved || "";
        control.setAttribute("aria-label", question.label);
        nodes.push(control); group.append(control);
      }
      controls.set(question.id, nodes); form.append(group);
    });
    if (!readonly) {
      const send = el("button", "Submit response", "primary-button"); send.type = "submit";
      form.append(send);
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
    dialog.append(el("p", `${form.responses.length} responses. Awaiting: ${form.pending.join(", ") || "None"}.`));
    dialog.append(button("Download CSV", () => {
      const rows = [["Username", "Grade", "Submitted at", ...form.questions.map((question) => question.label)], ...form.responses.map((response) => [response.username, response.grade, response.submittedAt, ...form.questions.map((question) => { const answer = response.answers[question.id]; return Array.isArray(answer) ? answer.join("; ") : answer || ""; })])];
      const csv = rows.map((row) => row.map((value) => { let text = String(value); if (/^[\s]*[=+@-]/.test(text)) text = `'${text}`; return `"${text.replace(/"/g, '""')}"`; }).join(",")).join("\r\n");
      const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
      const link = el("a"); link.href = url; link.download = "questionnaire-results.csv"; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
    }));
    form.questions.forEach((question) => {
      const section = el("section", undefined, "questionnaire-question"); section.append(el("h4", question.label));
      question.options.forEach((option) => {
        const count = form.responses.filter((response) => { const answer = response.answers[question.id]; return Array.isArray(answer) ? answer.includes(option) : answer === option; }).length;
        section.append(el("p", `${option}: ${count}`));
      });
      form.responses.forEach((response) => {
        const answer = response.answers[question.id];
        section.append(el("p", `${response.username}: ${Array.isArray(answer) ? answer.join(", ") : answer || "No answer"}`));
      });
      dialog.append(section);
    });
  }
})();
