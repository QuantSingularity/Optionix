import { fireEvent, screen } from "@testing-library/react";

/**
 * The analytics forms render <Label>text</Label> directly followed by its
 * control inside the same wrapper, without a htmlFor/id association, so
 * getByLabelText cannot be used. This finds the control next to a label.
 */
export const control = (labelText, index = 0) => {
  const labels = screen.getAllByText(labelText);
  const label = labels[index];
  const el = label.parentElement.querySelector("input, select, textarea");
  if (!el) throw new Error(`No control found next to label "${labelText}"`);
  return el;
};

export const setField = (labelText, value, index = 0) =>
  fireEvent.change(control(labelText, index), { target: { value } });
