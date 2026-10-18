/**
 * TopbarContext — client/src/context/TopbarContext.jsx
 * Allows any page to inject JSX into the Topbar's right side.
 */
import React, { createContext, useState } from 'react';

export const TopbarContext = createContext(null);

export function TopbarProvider({ children }) {
  const [rightActions, setRightActions] = useState(null);
  return (
    <TopbarContext.Provider value={{ rightActions, setRightActions }}>
      {children}
    </TopbarContext.Provider>
  );
}
