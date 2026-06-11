import React, { createContext, useContext } from 'react';

export type GameTuningValue = {
  stageId: number;
  getNumber: (key: string, fallback: number) => number;
  setNumber: (key: string, value: number) => void;
  reset: () => void;
  locked: boolean;
  setLocked: (locked: boolean) => void;
};

const GameTuningContext = createContext<GameTuningValue | null>(null);

export function GameTuningProvider({
  value,
  children,
}: {
  value: GameTuningValue;
  children: React.ReactNode;
}) {
  return <GameTuningContext.Provider value={value}>{children}</GameTuningContext.Provider>;
}

export function useGameTuning() {
  return useContext(GameTuningContext);
}

