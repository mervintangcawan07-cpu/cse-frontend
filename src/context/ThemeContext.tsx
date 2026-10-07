// Relative Path: src/context/ThemeContext.tsx
"use client";

import React, {
  createContext,
  useContext,
  useEffect,
  type ReactNode,
} from "react";

export type Theme = "light" | "dark";

interface ThemeContextType {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

function applyLightTheme() {
  if (typeof document === "undefined") return;

  const root = document.documentElement;

  // GovStudyX now uses light mode only.
  root.classList.remove("dark");
  root.style.colorScheme = "light";

  try {
    localStorage.setItem("theme", "light");
  } catch {
    // Ignore storage errors.
  }
}

export function ThemeProvider({
  children,
}: Readonly<{ children: ReactNode }>) {
  useEffect(() => {
    applyLightTheme();
  }, []);

  // Preserve the existing context API so no dependent component can break.
  const setTheme = (_theme: Theme) => {
    applyLightTheme();
  };

  const toggleTheme = () => {
    applyLightTheme();
  };

  return (
    <ThemeContext.Provider
      value={{
        theme: "light",
        setTheme,
        toggleTheme,
      }}
    >
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme(): ThemeContextType {
  const context = useContext(ThemeContext);

  if (!context) {
    throw new Error("useTheme must be used within a ThemeProvider");
  }

  return context;
}