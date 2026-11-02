import { AgentFlowError, getAppObjects, ok, type AppHost, type components } from '@reflexify/agentflow-sdk';
import { CasesError, type Case, type CaseStatus, type CasesApi } from './cases-api.js';

type WireRecord = components['schemas']['EntityRecord'];

const STATUSES: readonly CaseStatus[] = ['open', 'approved', 'rejected'];

function toCase(record: WireRecord): Case {
  const body = record.body as Record<string, unknown>;
  const day = typeof body.opened_on === 'string' ? body.opened_on.slice(0, 10) : null;
  return {
    id: record.id,
    title: typeof body.title === 'string' ? body.title : '',
    urgent: body.urgent === true,
    openedOn: day,
    status: STATUSES.includes(body.status as CaseStatus) ? (body.status as CaseStatus) : 'open',
  };
}

function toCasesError(error: unknown): CasesError {
  if (error instanceof CasesError) return error;
  if (!(error instanceof AgentFlowError)) return new CasesError('NETWORK', null);
  // A field's own message is the most precise; a refusal's detail starts with its code, which people do not read.
  const field = (error.fieldErrors?.[0] as { message?: unknown } | undefined)?.message;
  const said = typeof field === 'string' ? field : error.detail ?? null;
  return new CasesError(error.code, said ? said.replace(/^[A-Z][A-Z0-9_]+:\s*/, '') : null);
}

async function call<T>(request: Promise<{ data?: T; error?: unknown; response: Response }>): Promise<T> {
  try {
    return await ok(request);
  } catch (error) {
    throw toCasesError(error);
  }
}

/** The case entity's id in this organization, from the keys the package ships with. A module never hard-codes one. */
async function caseEntityId(host: Pick<AppHost, 'api'>): Promise<string> {
  const objects = getAppObjects(host.api);
  // A failed load is not kept, so the next call asks again and Try again can recover.
  await objects.load().catch((error: unknown) => {
    throw toCasesError(error);
  });
  const id = objects.id('entity:case');
  if (!id) throw new CasesError('NOT_INSTALLED', null);
  return id;
}

/** The cases over AgentFlow's published record operations, through the host's client. */
export function createHttpCasesApi(host: Pick<AppHost, 'api'>): CasesApi {
  const entityId = () => caseEntityId(host);

  return {
    async list() {
      const entity_id = await entityId();
      const page = (cursor: string | null) => call(host.api.POST('/entities/{entity_id}/records/query', {
        params: { path: { entity_id } },
        body: { sort: 'created_at', dir: 'desc', limit: 200, cursor },
      }));
      // A page holds at most 200; the cursor says whether more follow.
      const cases: Case[] = [];
      let cursor: string | null = null;
      do {
        const next = await page(cursor);
        cases.push(...next.items.map(toCase));
        cursor = next.next_cursor ?? null;
      } while (cursor);
      return cases;
    },
    async create(input) {
      const entity_id = await entityId();
      // Only the create form's fields: AgentFlow keeps the keys the form binds and drops the rest.
      const record = await call(host.api.POST('/entities/{entity_id}/records', {
        params: { path: { entity_id } },
        body: { form_payload: { title: input.title, urgent: input.urgent, opened_on: input.openedOn } },
      }));
      return toCase(record);
    },
  };
}
