(() => {
    const KEYS = {
        rules: "brandlensRules",
        tasks: "brandlensTasks",
        history: "brandlensTestHistory"
    };

    const DEFAULT_RULES = {
        terms: ["cheapest", "guaranteed", "#1 in India"],
        values: [
            { field: "Pro Plan Price", value: "₹999" },
            { field: "Free Trial Duration", value: "7 days" }
        ]
    };

    function freshDefaults() {
        return {
            terms: [...DEFAULT_RULES.terms],
            values: DEFAULT_RULES.values.map(value => ({ ...value }))
        };
    }

    function read(key, fallback) {
        try {
            const saved = localStorage.getItem(key);
            if (saved === null) return fallback;
            return JSON.parse(saved);
        } catch (error) {
            console.warn(`Could not read ${key}; using safe defaults.`, error);
            return fallback;
        }
    }

    function write(key, value) {
        try {
            localStorage.setItem(key, JSON.stringify(value));
            return true;
        } catch (error) {
            console.error(`Could not save ${key}.`, error);
            alert("BrandLens could not save your changes. Check browser storage and try again.");
            return false;
        }
    }

    function normalizeRules(value) {
        if (!value || typeof value !== "object" || Array.isArray(value)) return freshDefaults();

        const terms = Array.isArray(value.terms)
            ? [...new Set(value.terms.filter(term => typeof term === "string")
                .map(term => term.trim()).filter(Boolean))]
            : freshDefaults().terms;
        const values = Array.isArray(value.values)
            ? value.values.filter(item => item && typeof item === "object")
                .map(item => ({
                    field: String(item.field ?? "").trim(),
                    value: String(item.value ?? "").trim()
                })).filter(item => item.field && item.value)
            : freshDefaults().values;

        return { terms, values };
    }

    function getRules() {
        return normalizeRules(read(KEYS.rules, freshDefaults()));
    }

    function makeId() {
        if (globalThis.crypto && typeof globalThis.crypto.randomUUID === "function") {
            return globalThis.crypto.randomUUID();
        }
        return `task-${Date.now()}-${Math.random().toString(16).slice(2)}`;
    }

    function stableLegacyId(task, index) {
        const source = `${index}:${task.title || ""}:${task.content || task.text || ""}`;
        let hash = 0;
        for (let i = 0; i < source.length; i++) {
            hash = (hash * 31 + source.charCodeAt(i)) | 0;
        }
        return `legacy-${index}-${Math.abs(hash)}`;
    }

    function normalizeTasks(value) {
        if (!Array.isArray(value)) return { tasks: [], changed: false };

        const usedIds = new Set();
        let changed = false;
        const tasks = value.filter(task => task && typeof task === "object" && !Array.isArray(task))
            .map((task, index) => {
                const normalized = { ...task };
                if (!normalized.id || usedIds.has(String(normalized.id))) {
                    normalized.id = stableLegacyId(task, index);
                    changed = true;
                }
                normalized.id = String(normalized.id);
                usedIds.add(normalized.id);
                normalized.content = String(normalized.content ?? normalized.text ?? "");
                normalized.status = String(normalized.status || "Ready for Review");
                normalized.feedback = String(normalized.feedback ?? "");
                normalized.title = String(normalized.title || normalized.contentType || "");
                normalized.creator = String(normalized.creator || "Creator");
                if (task.content !== normalized.content || task.status !== normalized.status ||
                    task.feedback !== normalized.feedback || task.title !== normalized.title ||
                    task.creator !== normalized.creator) changed = true;
                return normalized;
            });

        if (tasks.length !== value.length) changed = true;
        return { tasks, changed };
    }

    function getTasks() {
        return normalizeTasks(read(KEYS.tasks, []));
    }

    function getHistory() {
        const history = read(KEYS.history, []);
        if (!Array.isArray(history)) {
            console.warn(`${KEYS.history} is not a list; showing an empty test history.`);
            return [];
        }
        return history.filter(item => item && typeof item === "object" && !Array.isArray(item));
    }

    function escapeRegExp(text) {
        return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    }

    function includesTerm(text, term) {
        const escaped = escapeRegExp(term);
        const left = /^[a-z0-9]/i.test(term) ? "(^|[^a-z0-9])" : "";
        const right = /[a-z0-9]$/i.test(term) ? "(?=$|[^a-z0-9])" : "";
        return new RegExp(`${left}${escaped}${right}`, "i").test(text);
    }

    function numberFrom(value) {
        const match = String(value).match(/\d[\d,]*(?:\.\d+)?/);
        return match ? Number(match[0].replaceAll(",", "")) : null;
    }

    function currencyFrom(value) {
        if (/₹|\b(?:INR|Rs\.?)\b/i.test(value)) return "INR";
        if (value.includes("$")) return "USD";
        if (value.includes("€")) return "EUR";
        if (value.includes("£")) return "GBP";
        return "";
    }

    function priceMentions(text) {
        const mentions = [];
        const currencyPattern = /(?:₹|Rs\.?|INR|[$€£])\s*([\d,]+(?:\.\d{1,2})?)/gi;
        for (const match of text.matchAll(currencyPattern)) {
            mentions.push({ text: match[0], amount: numberFrom(match[1]), currency: currencyFrom(match[0]) });
        }
        const plainPricePattern = /\b(?:price|costs?|priced\s+at)\s*(?:is\s*)?(\d[\d,]*(?:\.\d{1,2})?)/gi;
        for (const match of text.matchAll(plainPricePattern)) {
            mentions.push({ text: match[1], amount: numberFrom(match[1]), currency: "" });
        }
        return mentions;
    }

    function durationMentions(text) {
        const mentions = [];
        const pattern = /\b(\d+(?:\.\d+)?)\s*-?\s*(days?|weeks?|months?|years?)\b/gi;
        for (const match of text.matchAll(pattern)) {
            const unit = match[2].toLowerCase();
            const factor = unit.startsWith("day") ? 1 :
                unit.startsWith("week") ? 7 :
                    unit.startsWith("month") ? 30 : 365;
            mentions.push({ text: match[0], days: Number(match[1]) * factor });
        }
        return mentions;
    }

    function findIssues(text, rules = getRules()) {
        const issues = [];
        const priceRule = rules.values.find(rule => /price|cost|amount/i.test(rule.field));
        const durationRule = rules.values.find(rule => /duration|trial/i.test(rule.field));
        const approvedPrice = priceRule ? numberFrom(priceRule.value) : null;
        const approvedCurrency = priceRule ? currencyFrom(priceRule.value) : "";
        const approvedDuration = durationRule ? durationMentions(durationRule.value)[0] : null;

        rules.terms.forEach(term => {
            if (includesTerm(text, term)) {
                issues.push({
                    title: `“${term}”`,
                    desc: `This content includes the prohibited term “${term}”.`,
                    type: "Prohibited term"
                });
            }
        });

        if (priceRule && approvedPrice !== null) {
            priceMentions(text).forEach(mention => {
                if (mention.amount !== approvedPrice ||
                    (approvedCurrency && mention.currency && mention.currency !== approvedCurrency)) {
                    issues.push({
                        title: priceRule.field,
                        desc: `Submitted: ${mention.text} → Approved: ${priceRule.value}`,
                        type: "Value mismatch"
                    });
                }
            });
        }

        if (durationRule && approvedDuration) {
            durationMentions(text).forEach(mention => {
                if (mention.days !== approvedDuration.days) {
                    issues.push({
                        title: durationRule.field,
                        desc: `Submitted: ${mention.text} → Approved: ${durationRule.value}`,
                        type: "Value mismatch"
                    });
                }
            });
        }

        return issues;
    }

    function evaluate(text, rules = getRules()) {
        const empty = !text.trim();
        const priceRule = rules.values.find(rule => /price|cost|amount/i.test(rule.field));
        const durationRule = rules.values.find(rule => /duration|trial/i.test(rule.field));
        const issues = findIssues(text, rules);
        const termsPassed = !empty && !issues.some(issue => issue.type === "Prohibited term");
        const pricePassed = priceRule ? !empty && !issues.some(issue =>
            issue.title === priceRule.field && issue.type === "Value mismatch") : null;
        const durationPassed = durationRule ? !empty && !issues.some(issue =>
            issue.title === durationRule.field && issue.type === "Value mismatch") : null;

        return {
            empty,
            issues,
            termsPassed,
            pricePassed,
            durationPassed,
            passed: !empty && issues.length === 0,
            applicable: 1 + Number(Boolean(priceRule)) + Number(Boolean(durationRule))
        };
    }

    window.BrandLensData = {
        keys: KEYS,
        defaults: freshDefaults,
        read,
        write,
        getRules,
        normalizeRules,
        getTasks,
        getHistory,
        makeId,
        findIssues,
        evaluate
    };
})();
