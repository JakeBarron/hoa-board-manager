import { act, renderHook, waitFor } from "@testing-library/react";
import { useAutosave } from "./useAutosave";

/** Renders the hook with a controllable value and a spy for the save call. */
function setup(initial = "", enabled = true) {
  const save = jest.fn().mockResolvedValue(undefined);
  const view = renderHook(
    ({ value, enabled: on }) => useAutosave({ value, save, enabled: on, delayMs: 50 }),
    { initialProps: { value: initial, enabled } }
  );
  return { save, ...view };
}

describe("useAutosave", () => {
  it("writes nothing before the meeting is running", async () => {
    const { save, rerender } = setup("", false);
    rerender({ value: "<p>typed</p>", enabled: false });

    await new Promise((r) => setTimeout(r, 120));
    expect(save).not.toHaveBeenCalled();
  });

  it("persists the latest value once typing settles", async () => {
    const { save, rerender } = setup();
    rerender({ value: "<p>one</p>", enabled: true });

    await waitFor(() => expect(save).toHaveBeenCalledWith("<p>one</p>"));
  });

  it("collapses a burst of edits into a single write", async () => {
    const { save, rerender } = setup();
    rerender({ value: "<p>a</p>", enabled: true });
    rerender({ value: "<p>ab</p>", enabled: true });
    rerender({ value: "<p>abc</p>", enabled: true });

    await waitFor(() => expect(save).toHaveBeenCalledTimes(1));
    expect(save).toHaveBeenCalledWith("<p>abc</p>");
  });

  it("reports the write so the operator can see the minutes are safe", async () => {
    const { result, rerender } = setup();
    rerender({ value: "<p>one</p>", enabled: true });

    await waitFor(() => expect(result.current.status).toBe("saved"));
    expect(result.current.lastSavedAt).toBeInstanceOf(Date);
  });

  it("surfaces a failed write rather than looking saved", async () => {
    const save = jest.fn().mockRejectedValue(new Error("network down"));
    const { result, rerender } = renderHook(
      ({ value }) => useAutosave({ value, save, enabled: true, delayMs: 10 }),
      { initialProps: { value: "" } }
    );
    rerender({ value: "<p>one</p>" });

    await waitFor(() => expect(result.current.status).toBe("error"));
    expect(result.current.error).toBe("network down");
  });

  it("does not re-save a value that markClean has vouched for", async () => {
    // This is what stops a resumed meeting from writing its own minutes back.
    const { save, result, rerender } = setup();
    act(() => result.current.markClean("<p>restored</p>"));
    rerender({ value: "<p>restored</p>", enabled: true });

    await new Promise((r) => setTimeout(r, 120));
    expect(save).not.toHaveBeenCalled();
  });

  it("saveNow bypasses the debounce and rejects when the write fails", async () => {
    const save = jest.fn().mockRejectedValue(new Error("nope"));
    const { result, rerender } = renderHook(
      ({ value }) => useAutosave({ value, save, enabled: true, delayMs: 10_000 }),
      { initialProps: { value: "" } }
    );
    rerender({ value: "<p>one</p>" });

    await expect(result.current.saveNow()).rejects.toThrow("nope");
    expect(save).toHaveBeenCalledWith("<p>one</p>");
  });
});
