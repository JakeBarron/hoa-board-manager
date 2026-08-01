import { render, screen } from "@testing-library/react";
import { MinutesDocument } from "./MinutesDocument";

describe("MinutesDocument", () => {
  it("renders the minutes headings and body text", () => {
    render(
      <MinutesDocument content="<h2>Old Business</h2><p>Pool gate repair approved.</p>" />
    );
    expect(
      screen.getByRole("heading", { name: "Old Business" })
    ).toBeInTheDocument();
    expect(screen.getByText("Pool gate repair approved.")).toBeInTheDocument();
  });

  it("renders list items from the stored HTML", () => {
    render(
      <MinutesDocument content="<ul><li>Approve prior minutes</li><li>Treasurer report</li></ul>" />
    );
    expect(screen.getAllByRole("listitem")).toHaveLength(2);
    expect(screen.getByText("Treasurer report")).toBeInTheDocument();
  });

  it("shows the empty state when no minutes exist", () => {
    render(<MinutesDocument content={null} />);
    expect(screen.getByText("No minutes on file")).toBeInTheDocument();
  });

  it("shows the empty state for Tiptap's empty document", () => {
    render(<MinutesDocument content="<p></p>" />);
    expect(screen.getByText("No minutes on file")).toBeInTheDocument();
  });

  it("uses a custom empty description when provided", () => {
    render(
      <MinutesDocument content="" emptyDescription="This meeting was cancelled." />
    );
    expect(screen.getByText("This meeting was cancelled.")).toBeInTheDocument();
  });

  it("does not render the empty state when content is present", () => {
    render(<MinutesDocument content="<p>Called to order at 7:00 PM.</p>" />);
    expect(screen.queryByText("No minutes on file")).not.toBeInTheDocument();
  });
});
