import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ContactRow } from "./ContactRow";
import { updateContact, deleteContact } from "@/actions/contacts";
import type { Contact } from "@/types/database";

jest.mock("@/actions/contacts", () => ({
  updateContact: jest.fn(),
  deleteContact: jest.fn(),
}));

const mockUpdate = updateContact as jest.MockedFunction<typeof updateContact>;
const mockDelete = deleteContact as jest.MockedFunction<typeof deleteContact>;

const makeContact = (overrides: Partial<Contact> = {}): Contact => ({
  id: "c-1",
  name: "Jane Doe",
  title: "Swim Team",
  email: "jane@example.com",
  phone: "555-1234",
  category: "Aquatics",
  sort_order: 0,
  created_at: "2026-01-01T00:00:00Z",
  ...overrides,
});

describe("ContactRow", () => {
  beforeEach(() => {
    mockUpdate.mockReset();
    mockDelete.mockReset();
  });

  it("renders the contact name, email and phone in the idle view", () => {
    render(<ContactRow contact={makeContact()} />);
    expect(screen.getByText(/Jane Doe/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "jane@example.com" })).toHaveAttribute(
      "href",
      "mailto:jane@example.com"
    );
    expect(screen.getByRole("link", { name: "555-1234" })).toHaveAttribute("href", "tel:555-1234");
  });

  it("toggles to the edit view and saves changes via updateContact", async () => {
    const user = userEvent.setup();
    mockUpdate.mockResolvedValue(undefined);
    render(<ContactRow contact={makeContact()} />);

    await user.click(screen.getByRole("button", { name: "Edit" }));
    const nameInput = screen.getByLabelText("Name");
    await user.clear(nameInput);
    await user.type(nameInput, "Janet Doe");
    await user.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => expect(mockUpdate).toHaveBeenCalledTimes(1));
    expect(mockUpdate).toHaveBeenCalledWith(
      "c-1",
      expect.objectContaining({ name: "Janet Doe" })
    );
  });

  it("shows an error message when the save fails", async () => {
    const user = userEvent.setup();
    mockUpdate.mockResolvedValue("Something went wrong.");
    render(<ContactRow contact={makeContact()} />);

    await user.click(screen.getByRole("button", { name: "Edit" }));
    await user.click(screen.getByRole("button", { name: "Save" }));

    expect(await screen.findByText("Something went wrong.")).toBeInTheDocument();
  });

  it("deletes after confirmation", async () => {
    const user = userEvent.setup();
    mockDelete.mockResolvedValue(undefined);
    render(<ContactRow contact={makeContact()} />);

    await user.click(screen.getByRole("button", { name: "Delete" }));
    // InlineConfirm renders a second destructive "Delete" button to confirm
    const confirmButtons = screen.getAllByRole("button", { name: "Delete" });
    await user.click(confirmButtons[confirmButtons.length - 1]);

    await waitFor(() => expect(mockDelete).toHaveBeenCalledWith("c-1"));
  });
});
