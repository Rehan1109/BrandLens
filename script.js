const menuToggle = document.querySelector(".menu-toggle");
const mainNav = document.querySelector(".main-nav");

menuToggle.addEventListener("click", () => {
    const isOpen = menuToggle.getAttribute("aria-expanded") === "true";
    menuToggle.setAttribute("aria-expanded", String(!isOpen));
    mainNav.classList.toggle("is-open", !isOpen);
});

mainNav.addEventListener("click", (event) => {
    if (event.target.closest("a")) {
        menuToggle.setAttribute("aria-expanded", "false");
        mainNav.classList.remove("is-open");
    }
});

const draftCopy = document.querySelector("#draft-copy");
const runCheck = document.querySelector("#run-check");
const findingList = document.querySelector("#finding-list");
const findingCount = document.querySelector("#finding-count");
const activeRuleList = document.querySelector("#active-rule-list");
const rulesKey = BrandLensData.keys.rules;
let rules = BrandLensData.getRules();

function renderActiveRules() {
    activeRuleList.replaceChildren();
    document.querySelector("#rules-checked").textContent =
        `${rules.terms.length + rules.values.length} rules checked`;
    rules.terms.forEach((term) => {
        const chip = document.createElement("span");
        chip.className = "rule-chip";
        const dot = document.createElement("i");
        dot.className = "rule-dot red";
        chip.append(dot, document.createTextNode(`Avoid “${term}”`));
        activeRuleList.append(chip);
    });
    rules.values.forEach((rule) => {
        const chip = document.createElement("span");
        chip.className = "rule-chip";
        const dot = document.createElement("i");
        dot.className = "rule-dot green";
        chip.append(dot, document.createTextNode(`${rule.field} · ${rule.value}`));
        activeRuleList.append(chip);
    });
    if (!activeRuleList.childElementCount) activeRuleList.textContent = "No active rules";
}

function runBrandCheck() {
    rules = BrandLensData.getRules();
    renderActiveRules();
    const result = BrandLensData.evaluate(draftCopy.value, rules);
    findingList.replaceChildren();
    findingCount.textContent = `${result.issues.length} ${result.issues.length === 1 ? "finding" : "findings"}`;

    if (!result.issues.length) {
        const item = document.createElement("article");
        item.className = result.passed ? "finding finding-ok" : "finding finding-warning";
        item.innerHTML = result.passed
            ? "<span class=\"finding-icon\">✓</span><div><strong>No rule issues found</strong><p>Your draft matches the active brand rules. A person should still review the final copy.</p></div>"
            : "<span class=\"finding-icon\">!</span><div><strong>Content is empty</strong><p>Enter marketing content to check it against the active brand rules.</p></div>";
        findingList.append(item);
        return;
    }

    result.issues.forEach((issue) => {
        const item = document.createElement("article");
        item.className = `finding ${issue.type === "Prohibited term" ? "finding-danger" : "finding-warning"}`;
        const icon = document.createElement("span");
        icon.className = "finding-icon";
        icon.textContent = "!";
        const detail = document.createElement("div");
        const title = document.createElement("strong");
        title.textContent = issue.type;
        const message = document.createElement("p");
        message.textContent = issue.desc;
        detail.append(title, message);
        item.append(icon, detail);
        findingList.append(item);
    });
}

runCheck.addEventListener("click", runBrandCheck);
window.addEventListener("storage", (event) => {
    if (event.key === rulesKey) {
        rules = BrandLensData.getRules();
        renderActiveRules();
        runBrandCheck();
    }
});
renderActiveRules();
runBrandCheck();

const comparisonCard = document.querySelector(".comparison-card");
const comparisonCopy = document.querySelector(".preview-copy");
const comparisonHeader = document.querySelector(".preview-header > span:first-child");
const comparisonStatus = document.querySelector(".preview-header .status-pill");

document.querySelectorAll(".comparison-tabs button").forEach((button) => {
    button.addEventListener("click", () => {
        const isAfter = button.dataset.view === "after";
        document.querySelectorAll(".comparison-tabs button").forEach((tab) => {
            const selected = tab === button;
            tab.classList.toggle("is-active", selected);
            tab.setAttribute("aria-pressed", String(selected));
        });
        comparisonCard.classList.toggle("is-after", isAfter);
        comparisonHeader.textContent = isAfter ? "Updated draft" : "Original draft";
        comparisonStatus.textContent = isAfter ? "Ready for review" : "Needs changes";
        comparisonStatus.classList.toggle("status-warn", !isAfter);
        comparisonStatus.classList.toggle("status-ready", isAfter);
        comparisonCopy.innerHTML = isAfter
            ? "Get the Pro Plan for just <mark>₹999</mark>."
            : 'Get the <mark>cheapest</mark> Pro Plan for just <mark>₹799</mark>!';
        comparisonCard.querySelectorAll(".preview-finding").forEach((finding) => {
            finding.hidden = isAfter;
        });
        if (isAfter && !comparisonCard.querySelector(".finding-ok")) {
            const resolved = document.createElement("div");
            resolved.className = "preview-finding finding-ok";
            resolved.innerHTML = "<span>✓</span><div><strong>All findings resolved</strong><p>The edited draft now matches the active rules.</p></div>";
            comparisonCard.append(resolved);
        } else if (!isAfter) {
            comparisonCard.querySelector(".finding-ok")?.remove();
        }
    });
});
