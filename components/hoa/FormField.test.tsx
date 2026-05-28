import { render, screen } from "@testing-library/react";
import { FormField } from "./FormField";

describe("FormField", () => {
  it("renders the label and children", () => {
    render(
      <FormField label="Address" htmlFor="address">
        <input id="address" />
      </FormField>
    );
    expect(screen.getByLabelText("Address")).toBeInTheDocument();
  });

  it("associates label with the child input via htmlFor", () => {
    render(
      <FormField label="Description" htmlFor="desc">
        <input id="desc" />
      </FormField>
    );
    const input = screen.getByLabelText("Description");
    expect(input).toBeInTheDocument();
  });

  it("renders the error message when provided", () => {
    render(
      <FormField label="Address" htmlFor="address" error="Address is required">
        <input id="address" />
      </FormField>
    );
    expect(screen.getByRole("alert")).toHaveTextContent("Address is required");
  });

  it("does not render an error when error prop is absent", () => {
    render(
      <FormField label="Address" htmlFor="address">
        <input id="address" />
      </FormField>
    );
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("shows a required asterisk when required=true", () => {
    render(
      <FormField label="Email" htmlFor="email" required>
        <input id="email" />
      </FormField>
    );
    // The asterisk is aria-hidden but still in the DOM
    expect(screen.getByText("*")).toBeInTheDocument();
  });
});
