import type { APIRoute } from 'astro';
import { getFeatureApiHandler } from '@/lib/features/runtime.js';
import { isFeatureActive } from '@/lib/features/state.js';

export const ALL: APIRoute = async (context) => {
  const { feature, action } = context.params;
  if (!feature || !action) {
    return new Response(JSON.stringify({ error: 'Feature and action are required' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  const handler = await getFeatureApiHandler(feature, action);
  if (!handler) {
    return new Response(JSON.stringify({ error: 'Feature action not found' }), {
      status: 404,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  const featureIsActive = await isFeatureActive(feature);
  if (!featureIsActive) {
    return new Response(JSON.stringify({
      error: `Feature "${feature}" is inactive. Enable it in Admin → Settings first.`
    }), {
      status: 409,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  try {
    return await handler({
      request: context.request,
      params: context.params,
      locals: context.locals
    });
  } catch (error) {
    console.error(`Feature API error (${feature}/${action}):`, error);
    return new Response(JSON.stringify({ error: 'Feature handler failed' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};
