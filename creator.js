const data = window.BrandLensData;
const $ = selector => document.querySelector(selector);
const rulesKey = data.keys.rules;
const tasksKey = data.keys.tasks;
const historyKey = data.keys.history;
const content = $("#content");
const results = $("#compliance-results");
const message = $("#review-message");

let rules = data.getRules();
let { tasks, changed: tasksChanged } = data.getTasks();
let lastChecked = null;
let checkedRules = null;
let passed = false;
let editingTaskId = null;

function showMessage(text, color = "#64748B") {
    message.textContent = text;
    message.style.color = color;
}

function updateCount() {
    $("#char-count").textContent = content.value.length;
}

function renderGuidelines() {
    const list = $("#prohibited-terms");
    list.replaceChildren();
    rules.terms.forEach(term => {
        const item = document.createElement("li");
        item.textContent = term;
        list.append(item);
    });

    const values = $("#approved-values");
    values.replaceChildren();
    if (!rules.values.length) {
        const empty = document.createElement("p");
        empty.textContent = "No approved values are configured.";
        values.append(empty);
        return;
    }

    rules.values.forEach(rule => {
        const field = document.createElement("p");
        field.textContent = rule.field;
        const value = document.createElement("strong");
        value.textContent = rule.value;
        values.append(field, value);
    });
}

function setStatus(id, value) {
    const status = $(id);
    status.className = "test-status";
    if (value === null) {
        status.textContent = "Not configured";
        return;
    }
    if (value === undefined) {
        status.textContent = "Not Run";
        return;
    }
    status.textContent = value ? "Passed" : "Failed";
    status.classList.add(value ? "pass" : "fail");
}

function loadDashboard() {
    const history = data.getHistory();
    const applicable = 1 + Number(rules.values.some(rule => /price|cost|amount/i.test(rule.field))) +
        Number(rules.values.some(rule => /duration|trial/i.test(rule.field)));
    const passedCount = history.reduce((total, item) => total + (Number(item.passed) || 0), 0);
    const failedCount = history.reduce((total, item) => total + (Number(item.failed) || 0), 0);
    const last = history.length ? history[history.length - 1] : null;
    const latest = last && last.rulesSignature === JSON.stringify(rules) ? last : null;

    $("#total-tests").textContent = applicable;
    $("#passed-tests").textContent = history.length ? passedCount : "—";
    $("#failed-tests").textContent = history.length ? failedCount : "—";
    setStatus("#term-test-status", latest ? latest.termsPassed : undefined);
    const hasPriceRule = rules.values.some(rule => /price|cost|amount/i.test(rule.field));
    const hasDurationRule = rules.values.some(rule => /duration|trial/i.test(rule.field));
    setStatus("#price-test-status", latest ? latest.pricePassed : hasPriceRule ? undefined : null);
    setStatus("#duration-test-status", latest ? latest.durationPassed : hasDurationRule ? undefined : null);
}

function formatDate(value) {
    if (!value) return "Date not provided";
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? String(value) :
        date.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

function taskStatusClass(status) {
    if (status === "Approved") return "task-approved";
    if (status === "Needs Changes") return "task-needs-changes";
    return "task-ready";
}

function renderTasks() {
    const list = $("#saved-tasks-list");
    list.replaceChildren();
    if (!tasks.length) {
        const empty = document.createElement("p");
        empty.textContent = "No tasks submitted yet.";
        list.append(empty);
        return;
    }

    tasks.forEach((task, index) => {
        const card = document.createElement("article");
        card.className = "saved-task";
        const title = document.createElement("h3");
        title.textContent = task.title || `Task ${index + 1}`;
        const status = document.createElement("strong");
        status.className = taskStatusClass(task.status);
        status.textContent = task.status || "Ready for Review";
        const contentLine = document.createElement("p");
        contentLine.textContent = `Content: ${task.content || "(No content saved)"}`;
        const submittedLine = document.createElement("p");
        submittedLine.textContent = `Submitted: ${formatDate(task.date)}`;
        card.append(title, status, contentLine, submittedLine);

        if (task.feedback) {
            const feedback = document.createElement("p");
            feedback.textContent = `Brand Manager feedback: ${task.feedback}`;
            card.append(feedback);
        }

        if (task.status === "Needs Changes") {
            const edit = document.createElement("button");
            edit.type = "button";
            edit.dataset.editTask = task.id;
            edit.textContent = "Edit and resubmit";
            card.append(edit);
        }
        list.append(card);
    });
}

function renderIssues(issues, isEmpty) {
    results.replaceChildren();
    const summary = document.createElement("div");
    summary.className = `report-summary ${passed ? "report-pass" : "report-fail"}`;
    const badge = document.createElement("span");
    badge.className = "report-status";
    badge.textContent = passed ? "PASS" : "FAIL";
    const detail = document.createElement("div");
    const heading = document.createElement("h3");
    heading.textContent = passed ? "All checks passed" :
        isEmpty ? "Enter content to run a compliance check" : `${issues.length} issue(s) found`;
    const description = document.createElement("p");
    description.textContent = passed
        ? "Your content passed the active brand rules."
        : "Review the findings and update your content.";
    detail.append(heading, description);
    summary.append(badge, detail);
    results.append(summary);

    if (isEmpty) {
        const issue = document.createElement("div");
        issue.className = "issue-card";
        const title = document.createElement("h3");
        title.textContent = "Empty content";
        const text = document.createElement("p");
        text.textContent = "Enter marketing content before checking.";
        issue.append(title, text);
        results.append(issue);
    }

    issues.forEach(item => {
        const card = document.createElement("div");
        card.className = "issue-card";
        const title = document.createElement("h3");
        title.textContent = `${item.type}: ${item.title}`;
        const description = document.createElement("p");
        description.textContent = item.desc;
        card.append(title, description);
        results.append(card);
    });
}

function checkContent() {
    rules = data.getRules();
    renderGuidelines();
    const result = data.evaluate(content.value, rules);
    lastChecked = content.value;
    checkedRules = JSON.stringify(rules);
    passed = result.passed;
    renderIssues(result.issues, result.empty);

    const passedTests = Number(result.termsPassed) + Number(result.pricePassed === true) +
        Number(result.durationPassed === true);
    const failedTests = result.applicable - passedTests;
    const history = data.getHistory();
    history.push({
        date: new Date().toISOString(),
        content: content.value,
        result: passed ? "Passed" : "Failed",
        passed: passedTests,
        failed: failedTests,
        termsPassed: result.termsPassed,
        pricePassed: result.pricePassed,
        durationPassed: result.durationPassed,
        rulesSignature: checkedRules
    });
    if (history.length > 500) history.splice(0, history.length - 500);
    data.write(historyKey, history);
    loadDashboard();
    showMessage("Status: Not submitted");
}

function invalidateCheck(messageText = "Content changed — check again.") {
    passed = false;
    if (lastChecked !== null && content.value !== lastChecked) {
        showMessage(messageText, "#DC2626");
    }
}

function loadTaskForEditing(taskId) {
    const task = tasks.find(item => item.id === taskId);
    if (!task || task.status !== "Needs Changes") return;
    editingTaskId = task.id;
    content.value = task.content || "";
    $("#content-type").value = task.contentType || $("#content-type").options[0].text;
    $("#ready-button").textContent = "Resubmit for Review";
    $("#cancel-edit-button").hidden = false;
    lastChecked = null;
    checkedRules = null;
    passed = false;
    results.replaceChildren();
    const report = document.createElement("p");
    report.textContent = "Check your updated content before resubmitting.";
    results.append(report);
    updateCount();
    showMessage(`Editing requested changes. Check the content before resubmitting. ${task.feedback || ""}`, "#DC2626");
    content.focus();
}

function resetEditor() {
    editingTaskId = null;
    $("#ready-button").textContent = "Ready for Review";
    $("#cancel-edit-button").hidden = true;
}

function submitContent() {
    if (lastChecked === null) return showMessage("Please check your content first.", "#DC2626");
    if (content.value !== lastChecked) return showMessage("Content changed. Check it again first.", "#DC2626");
    const currentRules = data.getRules();
    if (JSON.stringify(currentRules) !== checkedRules) {
        rules = currentRules;
        renderGuidelines();
        lastChecked = null;
        passed = false;
        return showMessage("Brand rules changed. Check your content again.", "#DC2626");
    }
    if (!passed) return showMessage("Fix all compliance issues before submitting.", "#DC2626");

    const now = new Date().toISOString();
    const contentType = $("#content-type").value;
    if (editingTaskId) {
        const task = tasks.find(item => item.id === editingTaskId);
        if (!task || task.status !== "Needs Changes") {
            resetEditor();
            return showMessage("This task has already been reviewed. Refresh your task list.", "#DC2626");
        }
        Object.assign(task, {
            content: content.value,
            contentType,
            status: "Ready for Review",
            feedback: "",
            date: now,
            updatedAt: now
        });
    } else {
        tasks.push({
            id: data.makeId(),
            title: `${contentType} Submission`,
            creator: "Creator",
            contentType,
            content: content.value,
            status: "Ready for Review",
            feedback: "",
            date: now
        });
    }

    if (!data.write(tasksKey, tasks)) return;
    renderTasks();
    const status = editingTaskId ? "Resubmitted for review" : "Ready for Review";
    showMessage(`Status: ${status}`);
    resetEditor();
    lastChecked = null;
    checkedRules = null;
    passed = false;
}

$("#check-button").addEventListener("click", checkContent);
content.addEventListener("input", () => {
    updateCount();
    invalidateCheck();
});

$("#clear-button").addEventListener("click", () => {
    content.value = "";
    updateCount();
    results.replaceChildren();
    const empty = document.createElement("p");
    empty.textContent = "No report yet. Check your content to see results.";
    results.append(empty);
    lastChecked = null;
    checkedRules = null;
    passed = false;
    showMessage(editingTaskId ? "Draft cleared. Check the content before resubmitting." : "Status: Not submitted");
});

$("#ready-button").addEventListener("click", submitContent);
$("#changes-button").addEventListener("click", () => {
    const task = tasks.find(item => item.status === "Needs Changes");
    if (task) loadTaskForEditing(task.id);
    else showMessage("There are no tasks waiting for changes.");
});
$("#cancel-edit-button").addEventListener("click", () => {
    resetEditor();
    content.value = "";
    lastChecked = null;
    checkedRules = null;
    passed = false;
    updateCount();
    showMessage("Editing cancelled.");
});
$("#saved-tasks-list").addEventListener("click", event => {
    const button = event.target.closest("[data-edit-task]");
    if (button) loadTaskForEditing(button.dataset.editTask);
});

window.addEventListener("storage", event => {
    if (event.key === rulesKey) {
        rules = data.getRules();
        renderGuidelines();
        loadDashboard();
        lastChecked = null;
        checkedRules = null;
        passed = false;
        showMessage("Brand rules changed. Check your content again.", "#DC2626");
    }
    if (event.key === tasksKey) {
        ({ tasks } = data.getTasks());
        renderTasks();
    }
    if (event.key === historyKey) loadDashboard();
});

if (localStorage.getItem(rulesKey) === null) data.write(rulesKey, rules);
if (tasksChanged) data.write(tasksKey, tasks);
renderGuidelines();
renderTasks();
updateCount();
loadDashboard();
