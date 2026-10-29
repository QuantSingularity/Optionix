import { fireEvent, screen } from "@testing-library/react-native";

/**
 * react-native-paper's TextInput does not expose its `label` as an
 * accessibility label, but it tags the native input with a stable testID.
 * Inputs are returned in render order.
 */
export const paperInputs = () => screen.getAllByTestId("text-input-outlined");

/** Type into the n-th Paper input (render order). */
export const typeInto = (index, text) =>
  fireEvent.changeText(paperInputs()[index], text);

/** Press the trailing icon adornment (e.g. the show/hide password eye). */
export const pressRightIcon = () =>
  fireEvent.press(screen.getByTestId("right-icon-adornment"));
