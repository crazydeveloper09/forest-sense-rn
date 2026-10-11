import ejs from "ejs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const viewsDir = join(dirname(fileURLToPath(import.meta.url)), "views");
const VIEW_NAME = /^[a-z0-9-]+$/;

export const privacyContext = {
  appName: "Forest Sense",
  controllerName: "Maciej Kuta",
  contactEmail: "forest.sense@maciejsolutions.pl",
  updatedAt: "11 października 2026",
};

export function renderView(name, data = {}) {
  if (!VIEW_NAME.test(name)) {
    throw new Error("Nieprawidłowa nazwa widoku.");
  }
  return ejs.renderFile(join(viewsDir, `${name}.ejs`), data, {
    async: false,
    views: [viewsDir],
  });
}

export async function sendView(response, name, data = {}, statusCode = 200) {
  const html = await renderView(name, data);
  response.writeHead(statusCode, {
    "Content-Type": "text/html; charset=utf-8",
    "Cache-Control": "public, max-age=3600",
    "X-Content-Type-Options": "nosniff",
  });
  response.end(html);
}
