const vscode = acquireVsCodeApi();

let todos = [];

const PRIORITIES = ["Low", "Medium", "High", "Urgent", "Critical"];

const DOM = {
  completedCount: document.getElementById("completedCount"),
  incompleteCount: document.getElementById("incompleteCount"),
  newTodoInput: document.getElementById("newTodoInput"),
  prioritySelect: document.getElementById("prioritySelect"),
  addBtn: document.getElementById("addBtn"),
  completionFilter: document.getElementById("completionFilter"),
  titleFilter: document.getElementById("titleFilter"),
  priorityFilter: document.getElementById("priorityFilter"),
  todoContainer: document.getElementById("todoContainer"),
  confirmModal: document.getElementById("confirmModal"),
  confirmBtn: document.getElementById("confirmBtn"),
  cancelBtn: document.getElementById("cancelBtn"),
  confirmMessage: document.getElementById("confirmMessage"),
};

// Helpers
const sendMessage = (command, payload = {}) =>
  vscode.postMessage({ command, ...payload });

const getPriorityOptions = (selected) =>
  PRIORITIES.map(
    (p) =>
      `<option value="${p}" ${p === selected ? "selected" : ""}>${p}</option>`,
  ).join("");

// Event listeners
DOM.addBtn.addEventListener("click", () => {
  const title = DOM.newTodoInput.value.trim();
  sendMessage("addTodo", { title, priority: DOM.prioritySelect.value });
  DOM.newTodoInput.value = "";
  DOM.newTodoInput.focus();
});

DOM.newTodoInput.addEventListener("keypress", (e) => {
  if (e.key === "Enter") {
    DOM.addBtn.click();
  }
});

DOM.completionFilter.addEventListener("change", renderTable);
DOM.titleFilter.addEventListener("input", renderTable);
DOM.priorityFilter.addEventListener("change", renderTable);

window.addEventListener("message", (event) => {
  if (event.data.command === "updateTodos") {
    todos = event.data.todos;
    renderTable();
  }
});

function getFilteredTodos() {
  let filteredTodos = [...todos];

  // Apply completion filter
  const completionFilterValue = DOM.completionFilter.value;

  if (completionFilterValue && completionFilterValue !== "all") {
    if (completionFilterValue === "completed") {
      filteredTodos = filteredTodos.filter((todo) => todo.completed);
    } else if (completionFilterValue === "incomplete") {
      filteredTodos = filteredTodos.filter((todo) => !todo.completed);
    }
  }

  // Apply priority filter first for better performance
  if (DOM.priorityFilter.value && DOM.priorityFilter.value !== "all") {
    filteredTodos = filteredTodos.filter(
      (todo) => todo.priority === DOM.priorityFilter.value,
    );
  }

  // Apply completion filter next
  let titleFilterValue = DOM.titleFilter.value.toLowerCase().trim();
  if (titleFilterValue) {
    filteredTodos = filteredTodos.filter((todo) =>
      todo.title.toLowerCase().includes(titleFilterValue),
    );
  }

  return filteredTodos;
}

function getSortedTodos(filtered) {
  return filtered.sort((a, b) => parseInt(b.id) - parseInt(a.id));
}

function getMostUsedPriority() {
  if (!todos.length) {return null;}

  const priorityCount = todos.reduce((acc, todo) => {
    acc[todo.priority] = (acc[todo.priority] || 0) + 1;
    return acc;
  }, {});

  const [priority, count] = Object.entries(priorityCount).reduce(
    (max, [p, c]) => (c > max[1] ? [p, c] : max)
  );

  return { priority, count };
}

// Actions
const sendToggle = (id) => sendMessage("toggleTodo", { id });

const sendEdit = (id, title, priority) =>
  sendMessage("editTodo", { id, title, priority });

const sendDelete = (id) => sendMessage("deleteTodo", { id });

function handleToggle(id) {
  sendToggle(id);
}

function handleEdit(id) {
  const titleInput = document.getElementById(`title-${id}`);
  titleInput.contentEditable = "true";
  titleInput.focus();
  titleInput.classList.add("title-input");

  const saveEdit = () => {
    const newTitle = titleInput.textContent.trim();
    const newPriority = document.getElementById(`priority-${id}`).value;
    if (newTitle) {
      sendEdit(id, newTitle, newPriority);
      titleInput.contentEditable = "false";
      titleInput.classList.remove("title-input");
    }
  };

  titleInput.addEventListener("blur", saveEdit, { once: true });
  titleInput.addEventListener(
    "keypress",
    (e) => {
      if (e.key === "Enter") {
        saveEdit();
      }
    },
    { once: true },
  );
}

function handleDelete(id) {
  // showConfirmDialog("Are you sure you want to delete this todo?").then(
  //   (confirmed) => confirmed && sendDelete(id),
  // );
  sendDelete(id);
}

function createTodoRow(todo) {
  const completedClass = todo.completed ? "completed-row" : "";
  return `
    <tr class="priority-${todo.priority.toLowerCase()} ${completedClass}">
      <td class="checkbox-cell">
        <input
          type="checkbox" ${todo.completed ? "checked" : ""} 
          data-id="${todo.id}"
        >
      </td>
      <td
        class="title-cell"
        id="title-${todo.id}"
        data-id="${todo.id}"
      >
        ${escapeHtml(todo.title)}
      </td>
      <td class="priority-cell" id="priority-select-${todo.id}">
        <select
          id="priority-${todo.id}" 
          class="priority-select" 
          data-id="${todo.id}"
        >
          ${getPriorityOptions(todo.priority)}
        </select>
      </td>
      <td class="actions-cell">
        <button 
          class="delete-btn" 
          data-id="${todo.id}"
        >
          Delete
        </button>
      </td>
    </tr>`;
}

function renderTable() {
  const sorted = getSortedTodos(getFilteredTodos());

  const totalCount = todos.length;
  const completedCount = todos.filter((t) => t.completed).length;
  DOM.completedCount.textContent = completedCount;
  DOM.incompleteCount.textContent = totalCount - completedCount;

  if (!sorted.length) {
    DOM.todoContainer.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">📝</div>
        <p>No todos yet. Add one to get started!</p>
      </div>`;
    return;
  }

  const tableHtml = `
    <table border="1">
      <thead>
        <tr>
          <th></th>
          <th>Title</th>
          <th class="priority-cell">Priority</th>
          <th class="actions-cell"></th>
        </tr>
      </thead>
      <tbody>
        ${sorted.map(createTodoRow).join("")}
      </tbody>
    </table>`;

  DOM.todoContainer.innerHTML = tableHtml;

  attachEventListeners();

  const mostUsedPriority = getMostUsedPriority();
  
  if (mostUsedPriority && mostUsedPriority.priority) {
    DOM.prioritySelect.value = mostUsedPriority.priority;
  }
}

function escapeHtml(text) {
  const map = {
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;",
  };
  return text.replace(/[&<>"']/g, (m) => map[m]);
}

function attachListener(selector, event, handler) {
  DOM.todoContainer.querySelectorAll(selector).forEach((el) => {
    el.removeEventListener(event, handler);
    el.addEventListener(event, handler);
  });
}

const handlers = {
  checkbox: function () {
    if (this.dataset.id) {
      handleToggle(this.dataset.id);
    }
  },
  title: function () {
    if (this.dataset.id) {
      handleEdit(this.dataset.id);
    }
  },
  priority: function () {
    if (this.dataset.id) {
      const id = this.dataset.id;
      sendEdit(
        id,
        document.getElementById(`title-${id}`).textContent,
        this.value,
      );
    }
  },
  delete: function () {
    if (this.dataset.id) {
      handleDelete(this.dataset.id);
    }
  },
};

function attachEventListeners() {
  attachListener(".checkbox-cell input", "change", handlers.checkbox);
  attachListener(".title-cell", "click", handlers.title);
  attachListener(".priority-select", "change", handlers.priority);
  attachListener(".delete-btn", "click", handlers.delete);
}

function showConfirmDialog(message) {
  return new Promise((resolve) => {
    DOM.confirmMessage.textContent = message;
    DOM.confirmModal.style.display = "flex";

    const cleanup = () => {
      DOM.confirmBtn.removeEventListener("click", onConfirm);
      DOM.cancelBtn.removeEventListener("click", onCancel);
    };

    const onConfirm = () => {
      cleanup();
      DOM.confirmModal.style.display = "none";
      resolve(true);
    };

    const onCancel = () => {
      cleanup();
      DOM.confirmModal.style.display = "none";
      resolve(false);
    };

    DOM.confirmBtn.onclick = onConfirm;
    DOM.cancelBtn.onclick = onCancel;
  });
}

// Initial request for todos
sendMessage("getTodos");
