const entriesElement = document.querySelector("#entries");
const countElement = document.querySelector("#entry-count");
const alphabetElement = document.querySelector("#alphabet-index");
const searchElement = document.querySelector("#dictionary-search");
const activeFiltersElement = document.querySelector("#active-filters");
let wordIndex = [];
let activeTag = "";
const entryIds = new Map();

function createTextElement(tagName, className, text) {
    const element = document.createElement(tagName);
    element.className = className;
    element.textContent = text;
    return element;
}

function createDetailRow(label, value) {
    const row = document.createElement("div");
    row.className = "entry-detail-row";
    row.append(
        createTextElement("span", "entry-detail-label", label),
        createTextElement("span", "entry-detail-value", value)
    );
    return row;
}

function normalizeWord(word) {
    return word.trim().toLocaleLowerCase();
}

function createRelatedRow(relatedWords) {
    const row = document.createElement("div");
    row.className = "entry-detail-row";
    row.append(createTextElement("span", "entry-detail-label", "Related"));

    const values = document.createElement("span");
    values.className = "entry-detail-value";
    relatedWords.forEach((word, index) => {
        if (index) values.append(document.createTextNode(", "));
        const relatedEntry = wordIndex.find((entry) => normalizeWord(entry.word) === normalizeWord(word));
        if (relatedEntry) {
            const link = createTextElement("a", "related-link", word);
            link.href = `#${entryIds.get(relatedEntry)}`;
            link.dataset.relatedEntryId = entryIds.get(relatedEntry);
            values.append(link);
        } else {
            values.append(document.createTextNode(word));
        }
    });
    row.append(values);
    return row;
}

function createEntry(entry, entryId) {
    const article = document.createElement("article");
    article.className = "entry";
    article.id = entryId;

    const wordColumn = document.createElement("div");
    wordColumn.append(createTextElement("h3", "entry-word", entry.word));

    if (Array.isArray(entry.syllables) && entry.syllables.length) {
        wordColumn.append(createTextElement("p", "entry-syllables", entry.syllables.join("·")));
    }
    if (entry.pronunciation) {
        wordColumn.append(createTextElement("p", "entry-pronunciation", entry.pronunciation));
    }
    if (entry.partOfSpeech) {
        wordColumn.append(createTextElement("p", "entry-kind", entry.partOfSpeech));
    }

    const definitionColumn = document.createElement("div");
    definitionColumn.append(createTextElement("p", "entry-definition", entry.definition));

    if (Array.isArray(entry.examples) && entry.examples.length) {
        definitionColumn.append(createTextElement("p", "entry-example", `“${entry.examples[0]}”`));
    }
    if (entry.notes) {
        definitionColumn.append(createTextElement("p", "entry-note", entry.notes));
    }

    const details = document.createElement("div");
    details.className = "entry-details";
    const related = Array.isArray(entry.related)
        ? entry.related.filter((word) => typeof word === "string" && word.trim())
        : [];
    if (related.length) {
        details.append(createRelatedRow(related));
    }
    if (typeof entry.dateCoined === "string" && entry.dateCoined.trim()) {
        details.append(createDetailRow("Coined", entry.dateCoined));
    }

    const tags = Array.isArray(entry.tags)
        ? entry.tags.filter((tag) => typeof tag === "string" && tag.trim())
        : [];
    if (entry.usage || tags.length) {
        const tagList = document.createElement("div");
        tagList.className = "entry-tags";
        tagList.append(createTextElement("span", "entry-detail-label", "Tags"));
        if (entry.usage) {
            tagList.append(createTextElement("span", "entry-usage", entry.usage));
        }
        for (const tag of tags) {
            const tagButton = createTextElement("button", "entry-tag", tag);
            tagButton.type = "button";
            tagButton.dataset.tag = tag;
            tagButton.setAttribute("aria-pressed", String(normalizeWord(activeTag) === normalizeWord(tag)));
            tagList.append(tagButton);
        }
        details.append(tagList);
    }
    if (details.childElementCount) definitionColumn.append(details);

    article.append(wordColumn, definitionColumn);
    return article;
}

function renderAlphabetBookmarks(entries) {
    const firstEntryByLetter = new Map();
    for (const entry of entries) {
        const firstLetter = entry.word.trim().charAt(0).toLocaleUpperCase();
        if (/^[A-Z]$/.test(firstLetter) && !firstEntryByLetter.has(firstLetter)) {
            firstEntryByLetter.set(firstLetter, entryIds.get(entry));
        }
    }

    const bookmarks = [..."ABCDEFGHIJKLMNOPQRSTUVWXYZ"].map((letter) => {
        const bookmark = createTextElement("a", "alphabet-link", letter);
        const targetId = firstEntryByLetter.get(letter);
        if (targetId) {
            bookmark.href = `#${targetId}`;
            bookmark.setAttribute("aria-label", `Jump to ${letter}`);
        } else {
            bookmark.setAttribute("aria-disabled", "true");
            bookmark.tabIndex = -1;
            bookmark.setAttribute("aria-label", `No words starting with ${letter}`);
        }
        return bookmark;
    });
    alphabetElement.replaceChildren(...bookmarks);
}

function renderActiveFilters() {
    if (!activeTag) {
        activeFiltersElement.replaceChildren();
        return;
    }

    const selectedTag = createTextElement("span", "active-filter-label", `Tag: ${activeTag}`);
    const clearButton = createTextElement("button", "clear-filter", "Clear");
    clearButton.type = "button";
    clearButton.setAttribute("aria-label", `Clear ${activeTag} tag filter`);
    clearButton.addEventListener("click", () => {
        activeTag = "";
        renderDictionary(searchElement.value);
    });
    activeFiltersElement.replaceChildren(selectedTag, clearButton);
}

function matchesSearch(entry, query) {
    if (!query) return true;
    const searchableFields = [
        entry.word,
        entry.partOfSpeech,
        entry.pronunciation,
        entry.definition,
        entry.usage,
        entry.notes,
        entry.dateCoined,
        ...(Array.isArray(entry.syllables) ? entry.syllables : []),
        ...(Array.isArray(entry.examples) ? entry.examples : []),
        ...(Array.isArray(entry.related) ? entry.related : []),
        ...(Array.isArray(entry.tags) ? entry.tags : [])
    ];
    return searchableFields
        .filter((field) => typeof field === "string")
        .join(" ")
        .toLocaleLowerCase()
        .includes(query.toLocaleLowerCase());
}

function renderDictionary(query = "") {
    const visibleEntries = wordIndex.filter((entry) => {
        const hasActiveTag = !activeTag || (Array.isArray(entry.tags)
            && entry.tags.some((tag) => typeof tag === "string" && normalizeWord(tag) === normalizeWord(activeTag)));
        return hasActiveTag && matchesSearch(entry, query.trim());
    });
    const renderedEntries = visibleEntries.map((entry) => {
        return createEntry(entry, entryIds.get(entry));
    });

    renderAlphabetBookmarks(visibleEntries);
    renderActiveFilters();
    if (visibleEntries.length) {
        entriesElement.replaceChildren(...renderedEntries);
    } else {
        const message = query.trim() ? "No entries match your search." : "No entries yet.";
        entriesElement.replaceChildren(createTextElement("p", "status-message", message));
    }

    countElement.textContent = query.trim() || activeTag
        ? `${visibleEntries.length} of ${wordIndex.length} ${wordIndex.length === 1 ? "entry" : "entries"}`
        : `${wordIndex.length} ${wordIndex.length === 1 ? "entry" : "entries"}`;
}

async function loadDictionary() {
    try {
        const response = await fetch("vocab.json");
        if (!response.ok) throw new Error(`Could not load vocab.json (${response.status})`);

        const data = await response.json();
        if (!data || !Array.isArray(data.words)) {
            throw new Error("vocab.json must contain a words array");
        }

        wordIndex = data.words
            .filter((entry) => entry && typeof entry.word === "string" && entry.word.trim() && typeof entry.definition === "string" && entry.definition.trim())
            .sort((first, second) => first.word.localeCompare(second.word, undefined, { sensitivity: "base" }));
        wordIndex.forEach((entry, index) => entryIds.set(entry, `entry-${index + 1}`));

        renderDictionary(searchElement.value);
    } catch (error) {
        const message = createTextElement("p", "status-message", `The dictionary could not be loaded. ${error.message}`);
        message.dataset.error = "true";
        entriesElement.replaceChildren(message);
        countElement.textContent = "Unavailable";
        renderAlphabetBookmarks([]);
    }
}

searchElement.addEventListener("input", () => renderDictionary(searchElement.value));
entriesElement.addEventListener("click", (event) => {
    if (!(event.target instanceof Element)) return;

    const tagButton = event.target.closest("button[data-tag]");
    if (tagButton) {
        activeTag = normalizeWord(activeTag) === normalizeWord(tagButton.dataset.tag)
            ? ""
            : tagButton.dataset.tag;
        searchElement.value = "";
        renderDictionary();
        return;
    }

    const relatedLink = event.target.closest("a[data-related-entry-id]");
    if (relatedLink && !document.getElementById(relatedLink.dataset.relatedEntryId)) {
        searchElement.value = "";
        activeTag = "";
        renderDictionary();
    }
});
loadDictionary();
