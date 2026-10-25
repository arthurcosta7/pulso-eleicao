import { electionService } from '../../../src/server/tse.js';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const result = await electionService.get();
    return Response.json(result, {
      status: result.snapshot ? 200 : 503,
      headers: { 'Cache-Control': 'no-store' },
    });
  } catch {
    return Response.json({ error: 'Não foi possível consultar o TSE. Tente novamente em um minuto.' }, {
      status: 503, headers: { 'Cache-Control': 'no-store' },
    });
  }
}
