import debug from 'debug';
import { type NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

const log = debug('api-route:agent:execute-step');

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const operationId = body?.operationId;
  const stepIndex = body?.stepIndex ?? 0;

  log('[%s] /api/agent/run is no longer used in the internal queue path', operationId ?? 'unknown');

  return NextResponse.json(
    {
      error: 'This route is no longer used by the internal agent runtime scheduler.',
      operationId,
      stepIndex,
    },
    { status: 410 },
  );
}

/**
 * Health check endpoint
 */
export async function GET() {
  return NextResponse.json({
    healthy: true,
    message: 'Agent execution route is deprecated; internal scheduler executes steps directly.',
    timestamp: new Date().toISOString(),
  });
}
