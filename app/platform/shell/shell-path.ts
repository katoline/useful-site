import { createContext, useContext } from "react";
import { useLocation } from "react-router";
export const ShellPathContext = createContext<{ appPath: string; pathname?: string } | null>(null);
export function useShellPathname() {
  const location = useLocation();
  return useContext(ShellPathContext)?.pathname ?? location.pathname;
}
export function useShellAppPath() {
  return useContext(ShellPathContext)?.appPath;
}
