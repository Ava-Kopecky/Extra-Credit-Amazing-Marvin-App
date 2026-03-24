const taskPanel = document.querySelector(".task-panel");
const addTaskButton = document.querySelector(".add-task-btn");

// Load tasks from backend on page start
async function loadTasks() {
    const res = await fetch("http://localhost:8080/tasks");
    const tasks = await res.json();

    taskPanel.innerHTML = ""; // clear hardcoded tasks
    tasks.forEach(task => renderTask(task));
}

// Render a single task card
function renderTask(task) {
    const taskCard = document.createElement("div");
    taskCard.className = "task-card";
    taskCard.dataset.id = task.id;

    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.checked = task.completed;

    // When checkbox is ticked, update backend
    checkbox.addEventListener("change", async () => {
        await fetch(`http://localhost:8080/tasks/${task.id}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ completed: checkbox.checked })
        });
    });

    const text = document.createElement("span");
    text.textContent = task.text;
    text.contentEditable = "true";
    text.style.outline = "none";

    // When text is edited, update backend
    text.addEventListener("blur", async () => {
        await fetch(`http://localhost:8080/tasks/${task.id}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ text: text.textContent })
        });
    });

    taskCard.appendChild(checkbox);
    taskCard.appendChild(text);
    taskPanel.appendChild(taskCard);
}

// Add new task
addTaskButton.addEventListener("click", async () => {
    const res = await fetch("http://localhost:8080/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: "New task" })
    });
    const newTask = await res.json();
    renderTask(newTask);
});

// Start by loading tasks
loadTasks();