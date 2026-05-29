import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { TodoList } from "./TodoList";
import type { Todo } from "@/types/database";

// Server actions aren't available in jsdom — mock them to avoid import errors
jest.mock("@/actions/todos", () => ({
  addTodo: jest.fn(),
  toggleTodo: jest.fn(),
  deleteTodo: jest.fn(),
}));

const makeTodo = (overrides: Partial<Todo> = {}): Todo => ({
  id: "todo-1",
  position_id: "pos-1",
  title: "Send newsletter",
  completed: false,
  due_date: null,
  meeting_id: null,
  created_at: "2026-01-01T00:00:00Z",
  updated_at: "2026-01-01T00:00:00Z",
  ...overrides,
});

describe("TodoList", () => {
  const positionId = "pos-1";

  describe("empty state", () => {
    it("shows a placeholder when there are no todos", () => {
      render(<TodoList todos={[]} positionId={positionId} canEdit={false} />);
      expect(screen.getByText("No to-dos yet.")).toBeInTheDocument();
    });
  });

  describe("read-only mode (canEdit=false)", () => {
    it("renders todo titles", () => {
      render(
        <TodoList
          todos={[makeTodo({ title: "Prepare agenda" })]}
          positionId={positionId}
          canEdit={false}
        />
      );
      expect(screen.getByText("Prepare agenda")).toBeInTheDocument();
    });

    it("hides the add form", () => {
      render(
        <TodoList todos={[makeTodo()]} positionId={positionId} canEdit={false} />
      );
      expect(screen.queryByPlaceholderText("Add a to-do…")).not.toBeInTheDocument();
    });

    it("hides delete buttons", () => {
      render(
        <TodoList todos={[makeTodo()]} positionId={positionId} canEdit={false} />
      );
      expect(screen.queryByRole("button", { name: /delete/i })).not.toBeInTheDocument();
    });

    it("renders a completed todo with strikethrough styling", () => {
      render(
        <TodoList
          todos={[makeTodo({ title: "Done task", completed: true })]}
          positionId={positionId}
          canEdit={false}
        />
      );
      const span = screen.getByText("Done task");
      expect(span.className).toMatch(/line-through/);
    });
  });

  describe("editable mode (canEdit=true)", () => {
    it("shows the add form", () => {
      render(<TodoList todos={[]} positionId={positionId} canEdit={true} />);
      expect(screen.getByPlaceholderText("Add a to-do…")).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Add" })).toBeInTheDocument();
    });

    it("shows a delete button for each todo", () => {
      render(
        <TodoList
          todos={[makeTodo({ title: "Task A" }), makeTodo({ id: "todo-2", title: "Task B" })]}
          positionId={positionId}
          canEdit={true}
        />
      );
      expect(screen.getAllByRole("button", { name: /delete/i })).toHaveLength(2);
    });

    it("renders a checkbox for each todo", () => {
      render(
        <TodoList
          todos={[makeTodo({ title: "My task" })]}
          positionId={positionId}
          canEdit={true}
        />
      );
      expect(screen.getByRole("checkbox", { name: /mark "my task"/i })).toBeInTheDocument();
    });

    it("renders a checked checkbox for a completed todo", () => {
      render(
        <TodoList
          todos={[makeTodo({ completed: true, title: "Done" })]}
          positionId={positionId}
          canEdit={true}
        />
      );
      expect(screen.getByRole("checkbox")).toBeChecked();
    });
  });
});
