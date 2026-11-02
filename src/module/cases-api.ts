export type CaseStatus = 'open' | 'approved' | 'rejected';

export interface Case {
  id: string;
  title: string;
  urgent: boolean;
  /** A day, `yyyy-mm-dd`, or `null` when nobody set it. */
  openedOn: string | null;
  status: CaseStatus;
}

export interface NewCase {
  title: string;
  urgent: boolean;
  openedOn: string | null;
}

/** What the Cases screen needs from AgentFlow. The module talks to AgentFlow through it, and the demo and the tests through a fake. */
export interface CasesApi {
  /** The cases the person may see, newest first. */
  list(): Promise<Case[]>;
  create(input: NewCase): Promise<Case>;
}

/** A refused or failed call. `reason` is AgentFlow's own sentence when it gave one, shown to the person as it is. */
export class CasesError extends Error {
  override name = 'CasesError';
  constructor(readonly code: string, readonly reason: string | null) {
    super(reason ? `${code}: ${reason}` : code);
  }
}
