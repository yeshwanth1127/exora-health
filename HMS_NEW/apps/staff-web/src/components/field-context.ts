import { createContext, useContext } from "react";
export const FieldContext = createContext<{
  controlId: string;
  label: string;
  descriptionId?: string;
  errorId?: string;
  invalid: boolean;
  required?: boolean;
} | null>(null);
export const useFieldContext = () => useContext(FieldContext);
