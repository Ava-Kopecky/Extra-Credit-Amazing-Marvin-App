function hexToRgba(hex, alpha) {
    const r = parseInt(hex.slice(1,3), 16);
    const g = parseInt(hex.slice(3,5), 16);
    const b = parseInt(hex.slice(5,7), 16);
    return `rgba(${r},${g},${b},${alpha})`;
}

function toDateString(date) {
    return date.toISOString().split("T")[0];
}

const activePanel = document.getElementById("active-tasks");
const completedPanel = document.getElementById("completed-tasks");
const addTaskButton = document.querySelector(".add-task-btn");
const selectedDateLabel = document.getElementById("selected-date-label");
const selectedDateTitle = document.getElementById("selected-date-title");

const DURATION_OPTIONS = ["5m", "10m", "15m", "20m", "30m", "45m", "1h", "1h 30m", "2h"];
const PRIORITY_OPTIONS = ["none", "low", "medium", "high"];
const PROJECT_COLORS = ["#5b3cc4","#e05555","#e09a00","#2e8b2e","#0077cc","#cc5500","#888"];

const CATEGORIES = [
    { name: "Work", color: "#0077cc" },
    { name: "Personal", color: "#e05555" },
    { name: "School", color: "#2e8b2e" },
    { name: "Health", color: "#e09a00" },
    { name: "Finance", color: "#8b3cc4" },
    { name: "Social", color: "#cc5500" },
    { name: "Other", color: "#888" }
];

const today = new Date();
let selectedDate = toDateString(today);
let calendarMonth = today.getMonth();
let calendarYear = today.getFullYear();
let currentProjectId = null;
let currentCategory = null;
let categoriesOpen = true;
let projects = [];

function formatDisplayDate(dateStr) {
    const d = new Date(dateStr + "T00:00:00");
    const isToday = dateStr === toDateString(today);
    const label = d.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });
    return { label, title: isToday ? "Today" : label };
}

// --- Projects ---
async function loadProjects() {
    const res = await fetch("http://localhost:8080/projects");
    projects = await res.json();
    renderProjectList();
}

function renderProjectList() {
    const list = document.getElementById("project-list");
    list.innerHTML = "";
    projects.forEach(project => {
        const item = document.createElement("div");
        item.className = "project-item" + (currentProjectId === project.id ? " active" : "");
        item.innerHTML = `
            <div class="project-dot" style="background:${project.color}"></div>
            <span style="flex:1;">${project.name}</span>
            <button class="project-delete-btn" title="Delete project">🗑️</button>
        `;
        item.querySelector("span").addEventListener("click", () => {
            currentProjectId = project.id;
            currentCategory = null;
            selectedDate = null;
            selectedDateLabel.textContent = project.name;
            selectedDateTitle.textContent = project.name;
            renderProjectList();
            renderCategories();
            loadTasks();
        });
        item.querySelector(".project-delete-btn").addEventListener("click", (e) => {
            e.stopPropagation();
            showDeleteProjectModal(project);
        });
        list.appendChild(item);
    });
}

function showDeleteProjectModal(project) {
    const overlay = document.createElement("div");
    overlay.className = "modal-overlay";
    overlay.innerHTML = `
        <div class="modal" style="align-items:stretch;">
            <h3 style="text-align:center;">Delete Project</h3>
            <p style="text-align:center;color:#7d7492;font-size:14px;">
                Are you sure you want to delete <strong>${project.name}</strong>?
                <br><br>
                This will permanently delete the project. Tasks in this project will not be deleted but will be unassigned.
            </p>
            <div class="modal-actions">
                <button class="modal-cancel">Cancel</button>
                <button class="modal-confirm" style="background:#e05555;">Delete</button>
            </div>
        </div>
    `;
    document.body.appendChild(overlay);

    overlay.querySelector(".modal-cancel").addEventListener("click", () => overlay.remove());
    overlay.addEventListener("click", e => { if (e.target === overlay) overlay.remove(); });

    overlay.querySelector(".modal-confirm").addEventListener("click", async () => {
        await fetch(`http://localhost:8080/projects/${project.id}`, { method: "DELETE" });
        if (currentProjectId === project.id) {
            currentProjectId = null;
            selectedDate = toDateString(today);
            const { label, title } = formatDisplayDate(selectedDate);
            selectedDateLabel.textContent = label;
            selectedDateTitle.textContent = title;
        }
        overlay.remove();
        await loadProjects();
        loadTasks();
    });
}

function showAddProjectModal() {
    const overlay = document.createElement("div");
    overlay.className = "modal-overlay";
    overlay.innerHTML = `
        <div class="modal">
            <h3>New Project</h3>
            <input class="detail-input" id="project-name-input" placeholder="Project name" />
            <div style="display:flex;gap:8px;flex-wrap:wrap;justify-content:center;">
                ${PROJECT_COLORS.map(c => `
                    <div class="project-color-option" data-color="${c}"
                        style="width:28px;height:28px;border-radius:50%;background:${c};cursor:pointer;border:3px solid transparent;">
                    </div>
                `).join("")}
            </div>
            <div class="modal-actions">
                <button class="modal-cancel">Cancel</button>
                <button class="modal-confirm">Create</button>
            </div>
        </div>
    `;
    document.body.appendChild(overlay);

    let selectedColor = PROJECT_COLORS[0];
    overlay.querySelectorAll(".project-color-option").forEach(el => {
        if (el.dataset.color === selectedColor) el.style.border = "3px solid #2d2340";
        el.addEventListener("click", () => {
            overlay.querySelectorAll(".project-color-option").forEach(e => e.style.border = "3px solid transparent");
            el.style.border = "3px solid #2d2340";
            selectedColor = el.dataset.color;
        });
    });

    overlay.querySelector(".modal-cancel").addEventListener("click", () => overlay.remove());
    overlay.querySelector(".modal-confirm").addEventListener("click", async () => {
        const name = overlay.querySelector("#project-name-input").value.trim();
        if (!name) return;
        await fetch("http://localhost:8080/projects", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ name, color: selectedColor })
        });
        overlay.remove();
        loadProjects();
    });
    overlay.addEventListener("click", e => { if (e.target === overlay) overlay.remove(); });
}

document.getElementById("add-project-btn").addEventListener("click", showAddProjectModal);

// --- Nav ---
document.getElementById("nav-today").addEventListener("click", () => {
    currentProjectId = null;
    currentCategory = null;
    selectedDate = toDateString(today);
    const { label, title } = formatDisplayDate(selectedDate);
    selectedDateLabel.textContent = label;
    selectedDateTitle.textContent = title;
    document.querySelectorAll(".nav-item").forEach(b => b.classList.remove("active"));
    document.getElementById("nav-today").classList.add("active");
    renderProjectList();
    renderCategories();
    loadTasks();
    renderCalendar();
});

document.getElementById("nav-all").addEventListener("click", () => {
    currentProjectId = null;
    currentCategory = null;
    selectedDate = null;
    selectedDateLabel.textContent = "All tasks";
    selectedDateTitle.textContent = "All Tasks";
    document.querySelectorAll(".nav-item").forEach(b => b.classList.remove("active"));
    document.getElementById("nav-all").classList.add("active");
    renderProjectList();
    renderCategories();
    loadTasks();
});

// --- Calendar ---
async function renderCalendar() {
    const cal = document.getElementById("mini-calendar");
    const monthNames = ["January","February","March","April","May","June",
        "July","August","September","October","November","December"];
    const dayNames = ["Su","Mo","Tu","We","Th","Fr","Sa"];
    const firstDay = new Date(calendarYear, calendarMonth, 1).getDay();
    const daysInMonth = new Date(calendarYear, calendarMonth + 1, 0).getDate();
    const todayStr = toDateString(today);

    const res = await fetch("http://localhost:8080/tasks");
    const allTasks = await res.json();
    const datesWithTasks = new Set(allTasks.map(t => t.date));

    let html = `
        <div class="cal-header">
            <button class="cal-nav" id="cal-prev">&#8249;</button>
            <span>${monthNames[calendarMonth]} ${calendarYear}</span>
            <button class="cal-nav" id="cal-next">&#8250;</button>
        </div>
        <div class="cal-grid">
            ${dayNames.map(d => `<div class="cal-day-name">${d}</div>`).join("")}
            ${Array(firstDay).fill(`<div class="cal-day empty"></div>`).join("")}
    `;

    for (let d = 1; d <= daysInMonth; d++) {
        const dateStr = `${calendarYear}-${String(calendarMonth+1).padStart(2,"0")}-${String(d).padStart(2,"0")}`;
        const isToday = dateStr === todayStr;
        const isSelected = dateStr === selectedDate;
        const hasTasks = datesWithTasks.has(dateStr);
        let cls = "cal-day";
        if (isToday) cls += " today";
        if (isSelected) cls += " selected";
        if (hasTasks) cls += " has-tasks";
        html += `<div class="${cls}" data-date="${dateStr}">${d}</div>`;
    }
    html += `</div>`;
    cal.innerHTML = html;

    cal.querySelectorAll(".cal-day[data-date]").forEach(el => {
        el.addEventListener("click", () => {
            currentProjectId = null;
            currentCategory = null;
            selectedDate = el.dataset.date;
            const { label, title } = formatDisplayDate(selectedDate);
            selectedDateLabel.textContent = label;
            selectedDateTitle.textContent = title;
            loadTasks();
            renderCalendar();
            renderProjectList();
            renderCategories();
        });
    });

    document.getElementById("cal-prev").addEventListener("click", () => {
        calendarMonth--;
        if (calendarMonth < 0) { calendarMonth = 11; calendarYear--; }
        renderCalendar();
    });
    document.getElementById("cal-next").addEventListener("click", () => {
        calendarMonth++;
        if (calendarMonth > 11) { calendarMonth = 0; calendarYear++; }
        renderCalendar();
    });
}

// --- Task Detail Panel ---
function showTaskDetail(task) {
    document.querySelector(".task-detail-panel")?.remove();

    const panel = document.createElement("div");
    panel.className = "task-detail-panel";

    const projectOptions = projects.map(p =>
        `<option value="${p.id}" ${task.projectId === p.id ? "selected" : ""}>${p.name}</option>`
    ).join("");

    panel.innerHTML = `
        <button class="close-detail-btn">✕</button>
        <h3>Task Details</h3>
        <div>
            <div class="detail-label">Task Name</div>
            <input class="detail-input" id="detail-text" value="${task.text}" />
        </div>
        <div>
            <div class="detail-label">Priority</div>
            <select class="detail-select" id="detail-priority">
                ${PRIORITY_OPTIONS.map(p => `<option value="${p}" ${task.priority === p ? "selected" : ""}>${p.charAt(0).toUpperCase() + p.slice(1)}</option>`).join("")}
            </select>
        </div>
        <div>
            <div class="detail-label">Category</div>
            <select class="detail-select" id="detail-label">
                <option value="">None</option>
                ${CATEGORIES.map(c => `<option value="${c.name}" ${task.label === c.name ? "selected" : ""}>${c.name}</option>`).join("")}
            </select>
        </div>
        <div>
            <div class="detail-label">Project</div>
            <select class="detail-select" id="detail-project">
                <option value="">None</option>
                ${projectOptions}
            </select>
        </div>
        <div>
            <div class="detail-label">Due Date</div>
            <input class="detail-input" id="detail-due" type="date" value="${task.dueDate || ""}" />
        </div>
        <div>
            <div class="detail-label">Scheduled Date</div>
            <input class="detail-input" id="detail-date" type="date" value="${task.date || ""}" />
        </div>
        <div>
            <div class="detail-label">Notes</div>
            <textarea class="detail-textarea" id="detail-notes" placeholder="Add notes...">${task.notes || ""}</textarea>
        </div>
        <button class="detail-save-btn">Save</button>
    `;

    document.body.appendChild(panel);

    panel.querySelector(".close-detail-btn").addEventListener("click", () => panel.remove());

    panel.querySelector(".detail-save-btn").addEventListener("click", async () => {
        const updatedText = panel.querySelector("#detail-text").value.trim();
        const updatedPriority = panel.querySelector("#detail-priority").value;
        const updatedLabel = panel.querySelector("#detail-label").value;
        const updatedProject = panel.querySelector("#detail-project").value;
        const updatedDue = panel.querySelector("#detail-due").value;
        const updatedDate = panel.querySelector("#detail-date").value;
        const updatedNotes = panel.querySelector("#detail-notes").value.trim();

        await fetch(`http://localhost:8080/tasks/${task.id}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                text: updatedText || task.text,
                priority: updatedPriority,
                label: updatedLabel || null,
                projectId: updatedProject ? parseInt(updatedProject) : null,
                dueDate: updatedDue || null,
                date: updatedDate || task.date,
                notes: updatedNotes || null
            })
        });

        panel.remove();
        await loadProjects();
        loadTasks();
        renderCalendar();
    });
}

// --- Tasks ---
async function loadTasks() {
    let url = "http://localhost:8080/tasks";
    const params = [];
    if (currentCategory) {
        params.push(`label=${encodeURIComponent(currentCategory)}`);
    } else {
        if (selectedDate) params.push(`date=${selectedDate}`);
        if (currentProjectId) params.push(`projectId=${currentProjectId}`);
    }
    if (params.length) url += "?" + params.join("&");

    const res = await fetch(url);
    const tasks = await res.json();
    activePanel.innerHTML = "";
    completedPanel.innerHTML = "";
    tasks.forEach(task => renderTask(task));
}

function showDurationModal(task, onConfirm) {
    let selected = null;
    const overlay = document.createElement("div");
    overlay.className = "modal-overlay";
    overlay.innerHTML = `
        <div class="modal">
            <h3>Set duration</h3>
            <p class="modal-task-name">${task.text || "New task"}</p>
            <div class="duration-options">
                ${DURATION_OPTIONS.map(d => `<button class="duration-option" data-value="${d}">${d}</button>`).join("")}
            </div>
            <div class="custom-duration">
                <input type="number" min="1" placeholder="Custom" id="custom-duration-input" />
                <span>m</span>
            </div>
            <div class="modal-actions">
                <button class="modal-cancel">Cancel</button>
                <button class="modal-confirm">Set</button>
            </div>
        </div>
    `;
    document.body.appendChild(overlay);

    overlay.querySelectorAll(".duration-option").forEach(btn => {
        btn.addEventListener("click", () => {
            overlay.querySelectorAll(".duration-option").forEach(b => b.classList.remove("selected"));
            btn.classList.add("selected");
            selected = btn.dataset.value;
            overlay.querySelector("#custom-duration-input").value = "";
        });
    });

    overlay.querySelector(".modal-cancel").addEventListener("click", () => overlay.remove());
    overlay.querySelector(".modal-confirm").addEventListener("click", () => {
        const customVal = overlay.querySelector("#custom-duration-input").value.trim();
        if (customVal) selected = `${customVal}m`;
        if (selected) onConfirm(selected);
        overlay.remove();
    });
    overlay.addEventListener("click", e => { if (e.target === overlay) overlay.remove(); });
}

function getPriorityClass(priority) {
    if (priority === "high") return "priority-high";
    if (priority === "medium") return "priority-medium";
    if (priority === "low") return "priority-low";
    return null;
}

function showNotesPopup(notes) {
    const overlay = document.createElement("div");
    overlay.className = "modal-overlay";
    overlay.innerHTML = `
        <div class="modal" style="align-items:stretch;width:400px;">
            <h3 style="text-align:center;">📝 Notes</h3>
            <p style="
                color: #2d2340;
                font-size: 15px;
                line-height: 1.6;
                white-space: pre-wrap;
                background: #f4f1fb;
                border-radius: 12px;
                padding: 16px;
            ">${notes}</p>
            <div class="modal-actions">
                <button class="modal-confirm">Close</button>
            </div>
        </div>
    `;
    document.body.appendChild(overlay);
    overlay.querySelector(".modal-confirm").addEventListener("click", () => overlay.remove());
    overlay.addEventListener("click", e => { if (e.target === overlay) overlay.remove(); });
}

function renderTask(task) {
    const wrapper = document.createElement("div");
    wrapper.className = "task-wrapper";

    const taskCard = document.createElement("div");
    taskCard.className = "task-card" + (task.completed ? " completed" : "");
    taskCard.dataset.id = task.id;
    taskCard.style.flex = "1";

    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.checked = task.completed;
    checkbox.addEventListener("change", async () => {
        await fetch(`http://localhost:8080/tasks/${task.id}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ completed: checkbox.checked })
        });
        loadTasks();
    });

    const text = document.createElement("span");
    text.textContent = task.text;
    if (!task.completed) {
        text.contentEditable = "true";
        text.style.outline = "none";
        text.addEventListener("blur", async () => {
            const newText = text.textContent.trim();
            if (newText === "") {
                await fetch(`http://localhost:8080/tasks/${task.id}`, { method: "DELETE" });
                wrapper.remove();
                return;
            }
            await fetch(`http://localhost:8080/tasks/${task.id}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ text: newText })
            });
        });
        text.addEventListener("keydown", e => {
            if (e.key === "Enter") { e.preventDefault(); text.blur(); }
        });
    }
    text.addEventListener("click", () => {
        if (!task.completed) showTaskDetail(task);
    });

    // Project color bar
    const project = projects.find(p => p.id === task.projectId);
    if (project) {
        const bar = document.createElement("div");
        bar.className = "task-project-bar";
        bar.style.background = project.color;
        taskCard.appendChild(bar);
    }

    // Category tint
    const category = CATEGORIES.find(c => c.name === task.label);
    if (category) {
        taskCard.classList.add("tinted");
        taskCard.style.borderLeftColor = category.color;
        taskCard.style.background = task.completed
            ? "#e9e6f0"
            : hexToRgba(category.color, 0.06);
    }

    taskCard.appendChild(checkbox);
    if (category) {
        const categoryPill = document.createElement("span");
        categoryPill.style.cssText = `
            font-size: 11px;
            font-weight: 700;
            padding: 2px 10px;
            border-radius: 20px;
            background: ${hexToRgba(category.color, 0.18)};
            color: ${category.color};
            white-space: nowrap;
            flex-shrink: 0;
            letter-spacing: 0.03em;
            text-transform: uppercase;
        `;
        categoryPill.textContent = category.name;
        taskCard.appendChild(categoryPill);
    }
    taskCard.appendChild(text);

    // Meta badges
    const meta = document.createElement("div");
    meta.className = "task-meta";

    if (task.priority && task.priority !== "none") {
        const badge = document.createElement("span");
        badge.className = `priority-badge ${getPriorityClass(task.priority)}`;
        badge.textContent = task.priority;
        meta.appendChild(badge);
    }

    if (task.dueDate) {
        const badge = document.createElement("span");
        const isOverdue = task.dueDate < toDateString(today) && !task.completed;
        badge.className = "due-date-badge" + (isOverdue ? " overdue" : "");
        badge.textContent = "Due " + task.dueDate;
        meta.appendChild(badge);
    }

    if (task.notes) {
        const indicator = document.createElement("span");
        indicator.className = "notes-indicator";
        indicator.textContent = "📝";
        indicator.title = task.notes;
        indicator.style.cursor = "pointer";
        indicator.addEventListener("click", (e) => {
            e.stopPropagation();
            showNotesPopup(task.notes);
        });
        meta.appendChild(indicator);
    }

    // Tag button
    const tagBtn = document.createElement("button");
    tagBtn.className = "tag-btn";
    tagBtn.innerHTML = "🏷️";
    tagBtn.title = "Set category";
    tagBtn.style.position = "relative";

    tagBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        document.querySelectorAll(".category-popover").forEach(p => p.remove());

        const popover = document.createElement("div");
        popover.className = "category-popover";

        CATEGORIES.forEach(cat => {
            const item = document.createElement("div");
            item.className = "category-popover-item" + (task.label === cat.name ? " selected" : "");
            item.innerHTML = `<div class="category-dot" style="background:${cat.color}"></div><span>${cat.name}</span>`;
            item.addEventListener("click", async () => {
                await fetch(`http://localhost:8080/tasks/${task.id}`, {
                    method: "PUT",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ label: cat.name })
                });
                popover.remove();
                loadTasks();
                renderCategories();
            });
            popover.appendChild(item);
        });

        const removeItem = document.createElement("div");
        removeItem.className = "category-popover-item remove-category-item";
        removeItem.innerHTML = `<span>✕ Remove category</span>`;
        removeItem.addEventListener("click", async () => {
            await fetch(`http://localhost:8080/tasks/${task.id}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ label: "" })
            });
            popover.remove();
            loadTasks();
            renderCategories();
        });
        popover.appendChild(removeItem);

        tagBtn.appendChild(popover);
        popover.style.top = "32px";
        popover.style.right = "0";

        setTimeout(() => {
            document.addEventListener("click", () => popover.remove(), { once: true });
        }, 0);
    });

    // Timer button
    const timerBtn = document.createElement("button");
    timerBtn.className = "timer-btn";
    timerBtn.innerHTML = "⏱️";
    timerBtn.title = "Set duration";
    timerBtn.addEventListener("click", () => {
        showDurationModal(task, async (duration) => {
            task.duration = duration;
            externalBadge.textContent = duration;
            externalBadge.style.display = "flex";
            await fetch(`http://localhost:8080/tasks/${task.id}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ duration })
            });
        });
    });

    // Trash button
    const deleteBtn = document.createElement("button");
    deleteBtn.className = "delete-btn";
    deleteBtn.innerHTML = "🗑️";
    deleteBtn.title = "Delete task";
    deleteBtn.addEventListener("click", async () => {
        await fetch(`http://localhost:8080/tasks/${task.id}`, { method: "DELETE" });
        wrapper.remove();
        renderCalendar();
    });

    taskCard.addEventListener("mouseenter", () => {
        if (task.duration) externalBadge.style.display = "none";
    });
    taskCard.addEventListener("mouseleave", () => {
        if (task.duration) externalBadge.style.display = "flex";
    });

    taskCard.appendChild(meta);
    taskCard.appendChild(timerBtn);
    taskCard.appendChild(tagBtn);
    taskCard.appendChild(deleteBtn);

    const externalBadge = document.createElement("div");
    externalBadge.className = "external-duration-badge";
    externalBadge.textContent = task.duration || "";
    externalBadge.style.display = task.duration ? "flex" : "none";
    externalBadge.style.alignItems = "center";
    externalBadge.style.justifyContent = "center";

    wrapper.appendChild(taskCard);
    wrapper.appendChild(externalBadge);

    if (task.completed) {
        completedPanel.appendChild(wrapper);
    } else {
        activePanel.appendChild(wrapper);
    }
}

function renderCategories() {
    const list = document.getElementById("category-list");
    list.innerHTML = "";

    CATEGORIES.forEach(cat => {
        const item = document.createElement("div");
        item.className = "category-item" + (currentCategory === cat.name ? " active" : "");
        item.innerHTML = `
            <div class="category-dot" style="background:${cat.color}"></div>
            <span>${cat.name}</span>
        `;
        item.addEventListener("click", () => {
            if (currentCategory === cat.name) {
                currentCategory = null;
            } else {
                currentCategory = cat.name;
                currentProjectId = null;
                selectedDate = null;
                selectedDateLabel.textContent = cat.name;
                selectedDateTitle.textContent = cat.name;
                document.querySelectorAll(".nav-item").forEach(b => b.classList.remove("active"));
                renderProjectList();
            }
            renderCategories();
            loadTasks();
        });
        list.appendChild(item);
    });

    document.getElementById("category-list").style.display = categoriesOpen ? "flex" : "none";
}

document.getElementById("categories-toggle").addEventListener("click", () => {
    categoriesOpen = !categoriesOpen;
    document.getElementById("category-list").style.display = categoriesOpen ? "flex" : "none";
    document.getElementById("categories-arrow").textContent = categoriesOpen ? "▾" : "▸";
});

function showNewTaskModal() {
    const overlay = document.createElement("div");
    overlay.className = "modal-overlay";

    const projectOptions = projects.map(p =>
        `<option value="${p.id}">${p.name}</option>`
    ).join("");

    overlay.innerHTML = `
        <div class="modal" style="align-items:stretch;width:400px;">
            <h3 style="text-align:center;">New Task</h3>
            <div>
                <div class="detail-label">Task Name</div>
                <input class="detail-input" id="new-task-text" placeholder="What needs to be done?" />
            </div>
            <div>
                <div class="detail-label">Priority</div>
                <select class="detail-select" id="new-task-priority">
                    ${PRIORITY_OPTIONS.map(p => `<option value="${p}">${p.charAt(0).toUpperCase() + p.slice(1)}</option>`).join("")}
                </select>
            </div>
            <div>
                <div class="detail-label">Category</div>
                <select class="detail-select" id="new-task-label">
                    <option value="">None</option>
                    ${CATEGORIES.map(c => `<option value="${c.name}" ${currentCategory === c.name ? "selected" : ""}>${c.name}</option>`).join("")}
                </select>
            </div>
            <div>
                <div class="detail-label">Project</div>
                <select class="detail-select" id="new-task-project">
                    <option value="">None</option>
                    ${projectOptions}
                </select>
            </div>
            <div>
                <div class="detail-label">Due Date</div>
                <input class="detail-input" id="new-task-due" type="date" />
            </div>
            <div>
                <div class="detail-label">Scheduled Date</div>
                <input class="detail-input" id="new-task-date" type="date" value="${selectedDate || toDateString(today)}" />
            </div>
            <div>
                <div class="detail-label">Notes</div>
                <textarea class="detail-textarea" id="new-task-notes" placeholder="Add notes..."></textarea>
            </div>
            <div class="modal-actions">
                <button class="modal-cancel">Cancel</button>
                <button class="modal-confirm">Create Task</button>
            </div>
        </div>
    `;

    document.body.appendChild(overlay);

    if (currentProjectId) {
        overlay.querySelector("#new-task-project").value = currentProjectId;
    }

    overlay.querySelector(".modal-cancel").addEventListener("click", () => overlay.remove());
    overlay.addEventListener("click", e => { if (e.target === overlay) overlay.remove(); });

    overlay.querySelector(".modal-confirm").addEventListener("click", async () => {
        const text = overlay.querySelector("#new-task-text").value.trim();
        const priority = overlay.querySelector("#new-task-priority").value;
        const label = overlay.querySelector("#new-task-label").value;
        const projectId = overlay.querySelector("#new-task-project").value;
        const dueDate = overlay.querySelector("#new-task-due").value;
        const date = overlay.querySelector("#new-task-date").value;
        const notes = overlay.querySelector("#new-task-notes").value.trim();

        await fetch("http://localhost:8080/tasks", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                text: text || "Untitled Task",
                date: date || toDateString(today),
                projectId: projectId ? parseInt(projectId) : null,
                label: label || null,
                priority: priority || "none",
                dueDate: dueDate || null,
                notes: notes || null
            })
        });

        overlay.remove();
        loadTasks();
        renderCalendar();
        renderCategories();
    });

    setTimeout(() => overlay.querySelector("#new-task-text").focus(), 50);
}

addTaskButton.addEventListener("click", () => {
    showNewTaskModal();
});

// Initialize
const { label, title } = formatDisplayDate(selectedDate);
selectedDateLabel.textContent = label;
selectedDateTitle.textContent = title;
loadProjects();
renderCategories();
renderCalendar();
loadTasks();