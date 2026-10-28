const data = window.BrandLensData;
const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
const rulesKey = data.keys.rules;
const tasksKey = data.keys.tasks;

let rules = data.getRules();
let { tasks, changed: tasksChanged } = data.getTasks();
let selectedTaskId = null;
let editingTermIndex = null;
let editingValueIndex = null;

function saveRules() {
    data.write(rulesKey, rules);
    renderRules();
}

function renderRules() {
    const tags = $(".tags");
    tags.replaceChildren();
    rules.terms.forEach((term, index) => {
        const tag = document.createElement("span");
        if (editingTermIndex === index) {
            const input = document.createElement("input");
            input.className = "term-editor";
            input.value = term;
            input.setAttribute("aria-label", "Edit prohibited term");
            const save = document.createElement("button");
            save.type = "button";
            save.dataset.saveTerm = index;
            save.textContent = "Save";
            const cancel = document.createElement("button");
            cancel.type = "button";
            cancel.dataset.cancelTerm = index;
            cancel.textContent = "Cancel";
            tag.append(input, save, cancel);
        } else {
            tag.append(document.createTextNode(`${term} `));
            const edit = document.createElement("button");
            edit.type = "button";
            edit.dataset.editTerm = index;
            edit.textContent = "✎";
            edit.setAttribute("aria-label", `Edit ${term}`);
            const remove = document.createElement("button");
            remove.type = "button";
            remove.dataset.removeTerm = index;
            remove.textContent = "×";
            remove.setAttribute("aria-label", `Remove ${term}`);
            tag.append(edit, remove);
        }
        tags.append(tag);
    });

    const table = $(".value-table");
    table.replaceChildren();
    const heading = document.createElement("div");
    heading.className = "table-head";
    heading.innerHTML = "<b>FIELD</b><b>APPROVED VALUE</b><span></span>";
    table.append(heading);
    rules.values.forEach((rule, index) => {
        const row = document.createElement("div");
        if (editingValueIndex === index) {
            row.className = "is-editing";
            row.append(makeValueInput("Edit field name", rule.field),
                makeValueInput("Edit approved value", rule.value));
            const actions = document.createElement("span");
            actions.append(makeButton("Save", "saveValue", index), makeButton("Cancel", "cancelValue", index));
            row.append(actions);
        } else {
            const field = document.createElement("span");
            field.textContent = rule.field;
            const value = document.createElement("strong");
            value.textContent = rule.value;
            const actions = document.createElement("span");
            actions.append(
                makeButton("✎", "edit", index, `Edit ${rule.field}`),
                makeButton("⌫", "delete", index, `Delete ${rule.field}`)
            );
            row.append(field, value, actions);
        }
        table.append(row);
    });

    const counts = $$(".stat strong");
    counts[0].textContent = rules.terms.length;
    counts[1].textContent = rules.values.length;
}

function makeButton(label, action, index, accessibleLabel = label) {
    const button = document.createElement("button");
    button.type = "button";
    button.dataset[action] = index;
    button.textContent = label;
    button.setAttribute("aria-label", accessibleLabel);
    return button;
}

function makeValueInput(label, value) {
    const input = document.createElement("input");
    input.value = value;
    input.setAttribute("aria-label", label);
    return input;
}

function saveTerm(index) {
    const term = $(".term-editor").value.trim();
    if (!term) return alert("Terms cannot be empty.");
    if (rules.terms.some((item, current) => current !== index && item.toLowerCase() === term.toLowerCase())) {
        return alert("This term already exists.");
    }
    rules.terms[index] = term;
    editingTermIndex = null;
    saveRules();
}

function saveValue(index) {
    const row = $(".value-table .is-editing");
    const [fieldInput, valueInput] = $$("input", row);
    const field = fieldInput.value.trim();
    const value = valueInput.value.trim();
    if (!field || !value) return alert("Fields cannot be empty.");
    if (rules.values.some((item, current) =>
        current !== index && item.field.toLowerCase() === field.toLowerCase())) {
        return alert("That field already exists.");
    }
    rules.values[index] = { field, value };
    editingValueIndex = null;
    saveRules();
}

function formatDate(value) {
    if (!value) return "Date not provided";
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? String(value) :
        date.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

function statusClass(status) {
    if (status === "Approved") return "approved";
    if (status === "Needs Changes") return "needs-changes";
    return "ready";
}

function renderQueue() {
    const table = $(".queue-table");
    table.replaceChildren();
    const heading = document.createElement("div");
    heading.className = "queue-head";
    heading.innerHTML = "<span>SUBMISSION</span><span>SUBMITTED</span><span>COMPLIANCE</span><span></span>";
    table.append(heading);

    const pending = tasks.filter(task => task.status !== "Approved").length;
    $(".pending-count").textContent = `${pending} pending`;
    $$(".stat strong")[2].textContent = pending;

    if (!tasks.length) {
        const empty = document.createElement("p");
        empty.className = "empty-queue";
        empty.textContent = "No submissions yet. Submit content from the Creator page.";
        table.append(empty);
        return;
    }

    tasks.forEach((task, index) => {
        const row = document.createElement("article");
        row.className = "queue-item";
        const submission = document.createElement("div");
        submission.className = "submission";
        const icon = document.createElement("span");
        icon.className = "file-icon";
        icon.textContent = "▤";
        const description = document.createElement("div");
        const title = document.createElement("strong");
        title.textContent = task.title || `Submission ${index + 1}`;
        const creator = document.createElement("small");
        creator.textContent = task.creator || `Creator ${index + 1}`;
        description.append(title, creator);
        submission.append(icon, description);

        const date = document.createElement("span");
        date.className = "date";
        date.textContent = formatDate(task.date);
        const status = document.createElement("span");
        status.className = `status ${statusClass(task.status)}`;
        status.textContent = task.status;
        const review = document.createElement("button");
        review.className = "review-button";
        review.type = "button";
        review.dataset.review = task.id;
        review.textContent = "Review Content";
        row.append(submission, date, status, review);
        table.append(row);
    });
}

function renderIssues(issues) {
    const list = $(".issues");
    list.replaceChildren();
    if (!issues.length) {
        const row = document.createElement("article");
        const icon = document.createElement("b");
        icon.textContent = "✓";
        const message = document.createElement("div");
        const title = document.createElement("strong");
        title.textContent = "No automated issues found";
        const detail = document.createElement("p");
        detail.textContent = "Still review the content before approving.";
        message.append(title, detail);
        row.append(icon, message);
        list.append(row);
        return;
    }

    issues.forEach(issue => {
        const row = document.createElement("article");
        const icon = document.createElement("b");
        icon.textContent = "!";
        const detail = document.createElement("div");
        const title = document.createElement("strong");
        title.textContent = issue.title;
        const description = document.createElement("p");
        description.textContent = issue.desc;
        const guidance = document.createElement("small");
        guidance.textContent = "Review this finding against the brand rules.";
        detail.append(title, description, guidance);
        const type = document.createElement("small");
        type.textContent = issue.type;
        row.append(icon, detail, type);
        list.append(row);
    });
}

function openReview(taskId) {
    const task = tasks.find(item => item.id === taskId);
    if (!task) return;
    selectedTaskId = task.id;
    const index = tasks.indexOf(task);
    const status = $(".dialog-header .status");
    status.textContent = task.status;
    status.className = `status ${statusClass(task.status)}`;
    $(".dialog-header h2").textContent = task.title || `Submission ${index + 1}`;
    $(".dialog-header > p:last-child").textContent =
        `${task.creator || `Creator ${index + 1}`} · Submitted ${formatDate(task.date)}`;
    const content = task.content || "(No content was saved.)";
    $(".submitted-copy").textContent = content;
    const issues = data.findIssues(content, rules);
    $(".issues-heading span").textContent =
        `⚠ ${issues.length} detected issue${issues.length === 1 ? "" : "s"}`;
    renderIssues(issues);
    $("#feedback").value = task.feedback || "";
    $("#review-modal").style.display = "flex";
    history.replaceState(null, "", "#review-modal");
}

function closeReview() {
    $("#review-modal").style.display = "none";
    selectedTaskId = null;
    history.replaceState(null, "", location.pathname + location.search);
}

function decide(status) {
    const task = tasks.find(item => item.id === selectedTaskId);
    if (!task) return;
    task.status = status;
    task.feedback = $("#feedback").value.trim();
    task.reviewedAt = new Date().toISOString();
    if (!data.write(tasksKey, tasks)) return;
    renderQueue();
    closeReview();
    $("#queue-message").textContent = status === "Approved"
        ? "Content approved."
        : "Changes requested and feedback saved.";
}

$(".input-row button").addEventListener("click", () => {
    const input = $("#restricted-word");
    const term = input.value.trim();
    if (!term) return alert("Enter a term first.");
    if (rules.terms.some(item => item.toLowerCase() === term.toLowerCase())) {
        return alert("This term already exists.");
    }
    rules.terms.push(term);
    input.value = "";
    saveRules();
});

$("#restricted-word").addEventListener("keydown", event => {
    if (event.key === "Enter") {
        event.preventDefault();
        $(".input-row button").click();
    }
});

$(".tags").addEventListener("click", event => {
    const edit = event.target.closest("[data-edit-term]");
    const remove = event.target.closest("[data-remove-term]");
    if (edit) {
        editingTermIndex = Number(edit.dataset.editTerm);
        renderRules();
        $(".term-editor").focus();
    }
    const save = event.target.closest("[data-save-term]");
    if (save) saveTerm(Number(save.dataset.saveTerm));
    const cancel = event.target.closest("[data-cancel-term]");
    if (cancel) {
        editingTermIndex = null;
        renderRules();
    }
    if (remove) {
        rules.terms.splice(Number(remove.dataset.removeTerm), 1);
        saveRules();
    }
});

$(".tags").addEventListener("keydown", event => {
    if (event.key === "Enter" && event.target.matches(".term-editor")) {
        event.preventDefault();
        saveTerm(editingTermIndex);
    }
    if (event.key === "Escape" && event.target.matches(".term-editor")) {
        editingTermIndex = null;
        renderRules();
    }
});

const valueSection = $(".guideline-columns section + section");
$("button", valueSection).addEventListener("click", () => {
    const [fieldInput, valueInput] = $$("input", valueSection);
    const field = fieldInput.value.trim();
    const value = valueInput.value.trim();
    if (!field || !value) return alert("Enter both field and approved value.");
    if (rules.values.some(item => item.field.toLowerCase() === field.toLowerCase())) {
        return alert("That field already exists.");
    }
    rules.values.push({ field, value });
    fieldInput.value = "";
    valueInput.value = "";
    saveRules();
});

$(".value-table").addEventListener("click", event => {
    const edit = event.target.closest("[data-edit]");
    const remove = event.target.closest("[data-delete]");
    if (edit) {
        editingValueIndex = Number(edit.dataset.edit);
        renderRules();
        $(".value-table .is-editing input").focus();
    }
    const save = event.target.closest("[data-save-value]");
    if (save) saveValue(Number(save.dataset.saveValue));
    const cancel = event.target.closest("[data-cancel-value]");
    if (cancel) {
        editingValueIndex = null;
        renderRules();
    }
    if (remove) {
        const index = Number(remove.dataset.delete);
        rules.values.splice(index, 1);
        saveRules();
    }
});

$(".value-table").addEventListener("keydown", event => {
    if (event.key === "Enter" && event.target.closest(".is-editing")) {
        event.preventDefault();
        saveValue(editingValueIndex);
    }
    if (event.key === "Escape" && event.target.closest(".is-editing")) {
        editingValueIndex = null;
        renderRules();
    }
});

$(".save-row button").addEventListener("click", () => {
    if (data.write(rulesKey, rules)) $("#queue-message").textContent = "Brand rules saved.";
});

$(".queue-table").addEventListener("click", event => {
    const button = event.target.closest("[data-review]");
    if (button) openReview(button.dataset.review);
});

$(".modal-backdrop").addEventListener("click", event => {
    event.preventDefault();
    closeReview();
});
$(".close").addEventListener("click", event => {
    event.preventDefault();
    closeReview();
});
$(".dialog-actions .review-button").addEventListener("click", event => {
    event.preventDefault();
    closeReview();
});
$(".request-button").addEventListener("click", event => {
    event.preventDefault();
    decide("Needs Changes");
});
$(".approve-button").addEventListener("click", event => {
    event.preventDefault();
    decide("Approved");
});
document.addEventListener("keydown", event => {
    if (event.key === "Escape" && selectedTaskId) closeReview();
});

if (localStorage.getItem(rulesKey) === null) data.write(rulesKey, rules);
if (tasksChanged) data.write(tasksKey, tasks);
renderRules();
renderQueue();
if (location.hash === "#review-modal") {
    history.replaceState(null, "", location.pathname + location.search);
}

window.addEventListener("storage", event => {
    if (event.key === rulesKey) {
        rules = data.getRules();
        editingTermIndex = null;
        editingValueIndex = null;
        renderRules();
        if (selectedTaskId) openReview(selectedTaskId);
    }
    if (event.key === tasksKey) {
        ({ tasks } = data.getTasks());
        renderQueue();
        if (selectedTaskId) {
            if (tasks.some(task => task.id === selectedTaskId)) openReview(selectedTaskId);
            else closeReview();
        }
    }
});
