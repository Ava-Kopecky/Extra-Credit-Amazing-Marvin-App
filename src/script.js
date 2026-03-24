const activePanel = document.getElementById("active-tasks");
const completedPanel = document.getElementById("completed-tasks");
const addTaskButton = document.querySelector(".add-task-btn");

const DURATION_OPTIONS = ["5m", "10m", "15m", "20m", "30m", "45m", "1h", "1h 30m", "2h"];

async function loadTasks() {
    const res = await fetch("http://localhost:8080/tasks");
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
                ${DURATION_OPTIONS.map(d => `
                    <button class="duration-option" data-value="${d}">${d}</button>
                `).join("")}
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

    // Preset button selection
    overlay.querySelectorAll(".duration-option").forEach(btn => {
        btn.addEventListener("click", () => {
            overlay.querySelectorAll(".duration-option").forEach(b => b.classList.remove("selected"));
            btn.classList.add("selected");
            selected = btn.dataset.value;
            overlay.querySelector("#custom-duration-input").value = "";
        });
    });

    // Cancel
    overlay.querySelector(".modal-cancel").addEventListener("click", () => {
        overlay.remove();
    });

    // Confirm
    overlay.querySelector(".modal-confirm").addEventListener("click", () => {
        const customVal = overlay.querySelector("#custom-duration-input").value.trim();
        if (customVal) selected = `${customVal}m`;

        if (selected) {
            onConfirm(selected);
        }
        overlay.remove();
    });

    // Close on overlay click
    overlay.addEventListener("click", (e) => {
        if (e.target === overlay) overlay.remove();
    });
}

function renderTask(task) {
    const taskCard = document.createElement("div");
    taskCard.className = "task-card" + (task.completed ? " completed" : "");
    taskCard.dataset.id = task.id;

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
                taskCard.remove();
                return;
            }
            await fetch(`http://localhost:8080/tasks/${task.id}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ text: newText })
            });
        });

        text.addEventListener("keydown", (e) => {
            if (e.key === "Enter") {
                e.preventDefault();
                text.blur();
            }
        });
    }

    // Duration badge — visible when not hovering
    const durationBadge = document.createElement("span");
    durationBadge.className = "duration-badge";
    durationBadge.textContent = task.duration || "";
    durationBadge.style.display = task.duration ? "inline-block" : "none";

    // Timer button — visible on hover
    const timerBtn = document.createElement("button");
    timerBtn.className = "timer-btn";
    timerBtn.innerHTML = "⏱️";
    timerBtn.title = "Set duration";

    timerBtn.addEventListener("click", () => {
        showDurationModal(task, async (duration) => {
            task.duration = duration;
            durationBadge.textContent = duration;
            durationBadge.style.display = "inline-block";
            await fetch(`http://localhost:8080/tasks/${task.id}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ duration: duration })
            });
        });
    });

    // Trash button — visible on hover
    const deleteBtn = document.createElement("button");
    deleteBtn.className = "delete-btn";
    deleteBtn.innerHTML = "🗑️";
    deleteBtn.title = "Delete task";

    deleteBtn.addEventListener("click", async () => {
        await fetch(`http://localhost:8080/tasks/${task.id}`, { method: "DELETE" });
        taskCard.remove();
    });

    // Swap badge/buttons on hover
    taskCard.addEventListener("mouseenter", () => {
        if (task.duration) durationBadge.style.display = "none";
        timerBtn.style.marginLeft = "auto";
    });
    taskCard.addEventListener("mouseleave", () => {
        if (task.duration) durationBadge.style.display = "inline-block";
        timerBtn.style.marginLeft = "0";
    });

    // Order: checkbox, text, duration badge, timer, trash
    taskCard.appendChild(checkbox);
    taskCard.appendChild(text);
    taskCard.appendChild(durationBadge);
    taskCard.appendChild(timerBtn);
    taskCard.appendChild(deleteBtn);

    if (task.completed) {
        completedPanel.appendChild(taskCard);
    } else {
        activePanel.appendChild(taskCard);
    }
}

addTaskButton.addEventListener("click", async () => {
    const res = await fetch("http://localhost:8080/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: "" })
    });
    const newTask = await res.json();
    renderTask(newTask);
    const newCard = activePanel.lastElementChild;
    const textSpan = newCard.querySelector("span");
    textSpan.focus();
});

loadTasks();