import { createStart, createMiddleware } from "@tanstack/react-start";

import { renderErrorPage } from "./lib/error-page";

const errorMiddleware = createMiddleware().server(async ({ next }) => {
  try {
    return await next();
  } catch (error) {
    if (error != null && typeof error === "object" && "statusCode" in error) {
      throw error;
    }
    console.error(error);
    return new Response(renderErrorPage(), {
      status: 500,
      headers: { "content-type": "text/html; charset=utf-8" },
    });
  }
});

// Sem o attachSupabaseAuth: a loja não usa login do Supabase (o /admin entra com senha), e ele
// derrubava toda server function quando o navegador não tinha as chaves VITE_.
export const startInstance = createStart(() => ({
  requestMiddleware: [errorMiddleware],
}));
