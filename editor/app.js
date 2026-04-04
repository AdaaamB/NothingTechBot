import {
    saveToken,
    logout,
    getAccessToken,
    getUser,
    isCollaborator,
    loadYaml,
    saveToMain
} from "./github.js";
import { parseYaml, dumpYaml } from "./yaml.js";

const GITHUB_RAW_URL = "https://raw.githubusercontent.com/rNothingTech/NothingTechBot/main/commands.yaml";

/* ------------------ STATE ------------------ */
let token = null;
let isReadOnly = false;
let yamlData = {};
let fileSha = null;
let originalYamlContent = "";
let activeCategories = new Set(); // categories currently visible

/* ------------------ DOM ELEMENTS ------------------ */
const els = {
    app: document.getElementById("app"),
    tokenInput: document.getElementById("tokenInput"),
    saveTokenBtn: document.getElementById("saveTokenBtn"),
    authSection: document.getElementById("authSection"),
    userSection: document.getElementById("userSection"),
    logoutBtn: document.getElementById("logoutBtn"),
    userInfo: document.getElementById("userInfo"),
    tbody: document.querySelector("#mappingsTable tbody"),
    addBtn: document.getElementById("addBtn"),
    saveBtn: document.getElementById("saveBtn"),
    searchInput: document.getElementById("searchInput"),
    categoryFilters: document.getElementById("categoryFilters"),
    toast: document.getElementById("toast"),

    // Modal
    modal: document.getElementById("modal"),
    modalCategory: document.getElementById("modalCategory"),
    categoryList: document.getElementById("categoryList"),
    modalDisplayName: document.getElementById("modalDisplayName"),
    modalAliases: document.getElementById("modalAliases"),
    modalLink: document.getElementById("modalLink"),
    modalSave: document.getElementById("modalSave"),
    modalCancel: document.getElementById("modalCancel"),

    // Loading
    loader: document.getElementById("loadingOverlay"),
    loaderText: document.getElementById("loadingText"),
};

/* ------------------ TOAST ------------------ */
let toastTimer = null;
function showToast(message, type = "success") {
    els.toast.textContent = message;
    els.toast.className = `toast toast--${type} toast--visible`;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
        els.toast.className = `toast toast--${type}`;
    }, 5000);
}

/* ------------------ INITIALIZATION ------------------ */
els.saveTokenBtn.onclick = () => {
    const t = els.tokenInput.value.trim();
    if (t) saveToken(t);
};

els.logoutBtn.onclick = logout;

async function bootstrap() {
    token = getAccessToken();

    if (!token) {
        // No token — load read-only from GitHub raw
        isReadOnly = true;
        els.authSection.hidden = false;
        els.userSection.hidden = true;
        setLoading(true, "Loading commands (read-only)...");
        try {
            const res = await fetch(GITHUB_RAW_URL);
            if (!res.ok) throw new Error("Failed to fetch commands.yaml");
            const content = await res.text();
            yamlData = parseYaml(content) || {};
            activeCategories = new Set(Object.keys(yamlData));
            renderCategoryFilters();
            renderTable();
            els.app.hidden = false;
            applyReadOnly();
        } catch (err) {
            console.error(err);
            alert("Could not load commands: " + err.message);
        } finally {
            setLoading(false);
        }
        return;
    }

    // Token present — full auth flow
    isReadOnly = false;
    els.authSection.hidden = true;
    els.userSection.hidden = false;
    setLoading(true, "Authenticating with GitHub...");

    try {
        const user = await getUser(token);
        if (user.message === "Bad credentials") throw new Error("Invalid GitHub Token. Please clear and try again.");
        els.userInfo.textContent = `Signed in as ${user.login}`;

        const allowed = await isCollaborator(user.login, token);
        if (!allowed) throw new Error("You do not have write access to the NothingTechBot repository.");

        await loadData();
        els.app.hidden = false;
    } catch (err) {
        console.error(err);
        alert(err.message);
        if (err.message.includes("Invalid")) logout();
    } finally {
        setLoading(false);
    }
}

function applyReadOnly() {
    els.addBtn.hidden = true;
    els.saveBtn.hidden = true;
    // Banner
    const banner = document.createElement("div");
    banner.className = "readonly-banner";
    banner.innerHTML = `<i class="fa-solid fa-lock"></i> Read-only — <a href="#" id="signInLink">sign in with a GitHub PAT</a> to make changes.`;
    document.querySelector("main").prepend(banner);
    document.getElementById("signInLink").onclick = (e) => {
        e.preventDefault();
        els.authSection.hidden = false;
        els.tokenInput.focus();
    };
}

async function loadData() {
    setLoading(true, "Fetching commands.yaml...");
    try {
        const result = await loadYaml(token);
        originalYamlContent = result.content;
        yamlData = parseYaml(result.content) || {};
        fileSha = result.sha;
        activeCategories = new Set(Object.keys(yamlData));
        renderCategoryFilters();
        renderTable();
        updateSaveButtonState();
    } catch (err) {
        console.error(err);
        alert("Error loading YAML: " + err.message);
    } finally {
        setLoading(false);
    }
}

function updateSaveButtonState() {
    if (isReadOnly) return;
    const currentYamlContent = dumpYaml(yamlData);
    els.saveBtn.disabled = (currentYamlContent.trim() === originalYamlContent.trim());
    els.saveBtn.style.opacity = els.saveBtn.disabled ? "0.5" : "1";
    els.saveBtn.style.cursor = els.saveBtn.disabled ? "not-allowed" : "pointer";
}

bootstrap();

/* ------------------ CATEGORY FILTERS ------------------ */
function renderCategoryFilters() {
    els.categoryFilters.innerHTML = "";
    const categories = Object.keys(yamlData);

    // "All" toggle
    const allBtn = document.createElement("button");
    allBtn.className = "filter-btn filter-btn--all";
    allBtn.textContent = "All";
    allBtn.onclick = () => {
        const allActive = activeCategories.size === categories.length;
        activeCategories = allActive ? new Set() : new Set(categories);
        renderCategoryFilters();
        renderTable(els.searchInput.value);
    };
    allBtn.classList.toggle("active", activeCategories.size === categories.length);
    els.categoryFilters.appendChild(allBtn);

    categories.forEach(cat => {
        const btn = document.createElement("button");
        btn.className = "filter-btn";
        btn.textContent = `${cat} (${yamlData[cat]?.length ?? 0})`;
        btn.classList.toggle("active", activeCategories.has(cat));
        btn.onclick = () => {
            if (activeCategories.has(cat)) {
                activeCategories.delete(cat);
            } else {
                activeCategories.add(cat);
            }
            renderCategoryFilters();
            renderTable(els.searchInput.value);
        };
        els.categoryFilters.appendChild(btn);
    });
}

/* ------------------ RENDER & EDITING ------------------ */
function renderTable(filter = "") {
    els.tbody.innerHTML = "";
    const filterText = filter.toLowerCase();

    Object.entries(yamlData).forEach(([category, items]) => {
        if (!items || !Array.isArray(items)) return;
        if (!activeCategories.has(category)) return;

        items.forEach((item, index) => {
            const str = `${category} ${item.display_name} ${item.aliases.join(" ")}`.toLowerCase();
            if (filter && !str.includes(filterText)) return;

            const tr = document.createElement("tr");
            tr.draggable = !isReadOnly;
            tr.dataset.category = category;
            tr.dataset.index = index;

            tr.innerHTML = `
                <td class="drag-handle">${!isReadOnly ? '<i class="fa-solid fa-grip-vertical"></i>' : ''}</td>
                <td><span class="category-badge category-badge--${category}">${category}</span></td>
                <td ${!isReadOnly ? 'contenteditable="true"' : ''} data-field="display_name">${escapeHtml(item.display_name)}</td>
                <td ${!isReadOnly ? 'contenteditable="true"' : ''} data-field="aliases">${escapeHtml(item.aliases.join(", "))}</td>
                <td ${!isReadOnly ? 'contenteditable="true"' : ''} data-field="link" class="link-cell-text">${escapeHtml(item.link)}</td>
                <td>
                    <div class="action-buttons">
                        <button class="secondary copy-btn" title="Copy Link"><i class="fa-solid fa-copy"></i></button>
                        ${!isReadOnly ? '<button class="danger delete-btn" title="Delete"><i class="fa-solid fa-trash"></i></button>' : ''}
                    </div>
                </td>
            `;

            attachRowEvents(tr, category, index);
            els.tbody.appendChild(tr);
        });
    });
}

function attachRowEvents(tr, category, index) {
    if (!isReadOnly) {
        const inputs = tr.querySelectorAll('[contenteditable]');
        inputs.forEach(el => {
            el.onblur = () => {
                const field = el.dataset.field;
                let val = el.innerText.trim();
                if (field === 'aliases') {
                    yamlData[category][index].aliases = val.split(',').map(s => s.trim()).filter(Boolean);
                } else {
                    yamlData[category][index][field] = val;
                }
                updateSaveButtonState();
            };
            el.onkeydown = (e) => {
                if (e.key === 'Enter') { e.preventDefault(); el.blur(); }
            };
        });

        tr.querySelector('.delete-btn').onclick = () => {
            if (confirm(`Delete "${yamlData[category][index].display_name}"?`)) {
                yamlData[category].splice(index, 1);
                if (yamlData[category].length === 0) delete yamlData[category];
                activeCategories = new Set(Object.keys(yamlData).filter(c => activeCategories.has(c)));
                renderCategoryFilters();
                renderTable(els.searchInput.value);
                updateSaveButtonState();
            }
        };

        tr.ondragstart = e => {
            e.dataTransfer.setData("application/json", JSON.stringify({ category, index }));
            tr.classList.add("dragging");
        };
        tr.ondragend = () => tr.classList.remove("dragging");
        tr.ondragover = e => e.preventDefault();
        tr.ondrop = e => {
            e.preventDefault();
            const { category: sourceCat, index: sourceIdx } = JSON.parse(e.dataTransfer.getData("application/json"));
            const [movedItem] = yamlData[sourceCat].splice(sourceIdx, 1);
            if (yamlData[sourceCat].length === 0 && sourceCat !== category) delete yamlData[sourceCat];
            if (!yamlData[category]) yamlData[category] = [];
            yamlData[category].splice(index, 0, movedItem);
            renderCategoryFilters();
            renderTable(els.searchInput.value);
            updateSaveButtonState();
        };
    }

    // Copy button — available in both modes
    tr.querySelector('.copy-btn').onclick = () => {
        const url = yamlData[category][index].link;
        navigator.clipboard.writeText(url).then(() => {
            const btn = tr.querySelector('.copy-btn');
            const icon = btn.querySelector('i');
            icon.className = 'fa-solid fa-check';
            btn.style.color = 'var(--primary)';
            setTimeout(() => { icon.className = 'fa-solid fa-copy'; btn.style.color = ''; }, 2000);
        });
    };
}

els.searchInput.oninput = (e) => renderTable(e.target.value);

/* ------------------ MODAL ACTIONS ------------------ */
els.addBtn.onclick = () => {
    els.categoryList.innerHTML = "";
    Object.keys(yamlData).forEach(cat => {
        const opt = document.createElement("option");
        opt.value = cat;
        els.categoryList.appendChild(opt);
    });
    els.modalCategory.value = "";
    els.modalDisplayName.value = "";
    els.modalAliases.value = "";
    els.modalLink.value = "";
    els.modal.hidden = false;
};

els.modalCancel.onclick = () => els.modal.hidden = true;

els.modalSave.onclick = () => {
    const cat = els.modalCategory.value.trim();
    const name = els.modalDisplayName.value.trim();
    const aliases = els.modalAliases.value.split(',').map(a => a.trim().toLowerCase()).filter(Boolean);
    const link = els.modalLink.value.trim();

    if (!cat || !name || !link) {
        alert("Please fill in Category, Display Name, and Link.");
        return;
    }

    const aliasConflicts = [];
    Object.entries(yamlData).forEach(([existingCat, items]) => {
        items.forEach(item => {
            item.aliases.forEach(existingAlias => {
                if (aliases.includes(existingAlias)) {
                    aliasConflicts.push({ alias: existingAlias, category: existingCat, name: item.display_name });
                }
            });
        });
    });

    if (aliasConflicts.length > 0) {
        const conflictMsgs = aliasConflicts.map(c => `• "${c.alias}" (found in ${c.category} > ${c.name})`).join('\n');
        if (!confirm(`Warning: The following aliases already exist:\n\n${conflictMsgs}\n\nDo you still want to add this command?`)) return;
    }

    if (!yamlData[cat]) yamlData[cat] = [];
    yamlData[cat].push({ display_name: name, aliases, link });

    // Add new category to active filters
    activeCategories.add(cat);

    els.modal.hidden = true;
    renderCategoryFilters();
    renderTable(els.searchInput.value);
    updateSaveButtonState();

    showToast(`✓ "${name}" added to ${cat}. Don't forget to click Save Changes to publish.`, "success");
};

/* ------------------ SAVE ------------------ */
els.saveBtn.onclick = async () => {
    const currentYaml = dumpYaml(yamlData);
    if (currentYaml.trim() === originalYamlContent.trim()) {
        alert("No changes detected to save.");
        return;
    }

    const customMessage = prompt("Enter a commit message:", "Update commands.yaml via Editor");
    if (customMessage === null) return;
    const message = customMessage.trim() || "Update commands.yaml via Editor";

    setLoading(true, "Committing changes...");
    try {
        await saveToMain(token, currentYaml, fileSha, message);
        showToast("✓ Changes saved and published successfully!", "success");
        await loadData();
    } catch (err) {
        console.error(err);
        alert("Failed to save: " + err.message);
        setLoading(false);
    }
};

/* ------------------ UTILS ------------------ */
function setLoading(isLoading, text = "") {
    els.loader.hidden = !isLoading;
    els.loaderText.textContent = text;
}

function escapeHtml(str) {
    return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}