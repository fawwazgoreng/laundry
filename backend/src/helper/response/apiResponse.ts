import type { Context } from "hono";
import { ContentfulStatusCode } from "hono/utils/http-status";
import type { meta } from "../../domain/types/globalType";

interface ApiEnvelope<T> {
    success: boolean;
    message: string;
    meta?: meta;
    data: T;
}

function send<T>(c: Context, status: ContentfulStatusCode, body: ApiEnvelope<T>): Response {
    return c.json({ ...body, meta: body.meta }, status);
}

export function ok<T>(c: Context, data: T, message = "Success", extraMeta?: meta): Response {
    return send(c, 200, { success: true, message, data, ...(extraMeta ? { meta: extraMeta } : {}) });
}

export function created<T>(c: Context, data: T, message = "Resource created"): Response {
    return send(c, 201, { success: true, message, data });
}

export function noContent(c: Context): Response {
    return c.body(null, 204);
}