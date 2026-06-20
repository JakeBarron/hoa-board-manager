import { render, screen } from "@testing-library/react";
import { Spinner } from "./Spinner";

describe("Spinner", () => {
  it("exposes a status role for assistive tech", () => {
    render(<Spinner />);
    expect(screen.getByRole("status")).toBeInTheDocument();
  });

  it("renders the label when provided", () => {
    render(<Spinner label="Saving…" />);
    expect(screen.getByText("Saving…")).toBeInTheDocument();
  });
});
