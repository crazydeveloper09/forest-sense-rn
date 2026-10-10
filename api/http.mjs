export function sendJson(response, statusCode, body) {
  response.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Headers": "Content-Type, Authorization, Stripe-Signature",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  });
  response.end(JSON.stringify(body));
}

export async function readRawBody(request, maxBytes) {
  const chunks = [];
  let size = 0;
  for await (const chunk of request) {
    size += chunk.length;
    if (size > maxBytes) throw new Error("BODY_TOO_LARGE");
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}

export async function readJson(request, maxBytes) {
  return JSON.parse((await readRawBody(request, maxBytes)).toString("utf8"));
}

export function sendAppReturnPage(response, result) {
  const url = `forest-sense://premium?checkout=${result}`;
  response.writeHead(200, {
    "Content-Type": "text/html; charset=utf-8",
    "Cache-Control": "no-store",
  });
  response.end(
    `<!doctype html><html lang="pl"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Forest Sense</title><body style="font:16px system-ui;background:#081a14;color:#eff9f1;padding:32px"><h1>${result === "success" ? "Płatność zakończona" : "Płatność anulowana"}</h1><p>Wróć do aplikacji Forest Sense.</p><a style="color:#aef0a0" href="${url}">Otwórz aplikację</a><script>window.location.replace(${JSON.stringify(url)})</script></body></html>`,
  );
}
