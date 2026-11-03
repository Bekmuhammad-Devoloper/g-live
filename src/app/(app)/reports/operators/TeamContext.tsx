"use client";

import { createContext, useContext } from "react";
import type { SipOption } from "@/lib/sip";
import { TEAM, type TeamConfig, type TeamKind } from "./teamKind";

export interface BranchOpt { id: string; name: string }

interface TeamCtx { cfg: TeamConfig; branches: BranchOpt[]; sipOptions: SipOption[] }

const Ctx = createContext<TeamCtx>({ cfg: TEAM.operator, branches: [], sipOptions: [] });

export function TeamProvider({ kind, branches = [], sipOptions = [], children }: { kind: TeamKind; branches?: BranchOpt[]; sipOptions?: SipOption[]; children: React.ReactNode }) {
  return <Ctx.Provider value={{ cfg: TEAM[kind], branches, sipOptions }}>{children}</Ctx.Provider>;
}

export const useTeam = () => useContext(Ctx);
