import type { AdministrativeMode } from "../contracts";
export interface GeographySelection {
  mode: AdministrativeMode;
  wilayaCode: string;
  communeId: string;
}
export type GeographyAction =
  | {
      type: "mode";
      value: AdministrativeMode;
    }
  | {
      type: "wilaya";
      value: string;
    }
  | {
      type: "commune";
      value: string;
    };
export const initialGeographySelection: GeographySelection = {
  mode: "legacy58",
  wilayaCode: "",
  communeId: "",
};
export function geographySelectionReducer(
  state: GeographySelection,
  action: GeographyAction,
): GeographySelection {
  switch (action.type) {
    case "mode":
      return action.value === state.mode
        ? state
        : { mode: action.value, wilayaCode: "", communeId: "" };
    case "wilaya":
      return action.value === state.wilayaCode
        ? state
        : { ...state, wilayaCode: action.value, communeId: "" };
    case "commune":
      return { ...state, communeId: action.value };
  }
}
