"use client";

import { createContext, useContext } from "react";
import { TEAM, type TeamConfig, type TeamKind } from "./teamKind";

export interface BranchOpt { id: string; name: string }

interface TeamCtx { cfg: TeamConfig; branches: BranchOpt[] }

const Ctx = createContext<TeamCtx>({ cfg: TEAM.operator, branches: [] });

export function TeamProvider({ kind, branches = [], children }: { kind: TeamKind; branches?: BranchOpt[]; children: React.ReactNode }) {
  return <Ctx.Provider value={{ cfg: TEAM[kind], branches }}>{children}</Ctx.Provider>;
}

export const useTeam = () => useContext(Ctx);
