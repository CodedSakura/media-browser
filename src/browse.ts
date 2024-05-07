import type { Express, Request, Response } from "express";
import { existsSync } from "node:fs";
import { lstat, readdir } from "node:fs/promises";
import path from "node:path";
import { basePath, mediaDir } from "./index";

export interface File {
  name: string,
  path: string,
  dir: boolean,
}

export async function getFileList(fullPath: string): Promise<File[]> {
  return (await readdir(fullPath, { withFileTypes: true }))
        .sort((a, b) => a.isDirectory() ?
              (b.isDirectory() ? a.name.localeCompare(b.name) : -1) :
              (b.isDirectory() ? +1 : a.name.localeCompare(b.name)))
        .map(v => ({
          name: v.name,
          path: path.sep + path.relative(mediaDir, path.resolve(v.path, v.name)),
          dir: v.isDirectory(),
        }));
}

export default function (app: Express) {
  app.get(path.join(basePath, "/"), (_req: Request, res: Response) => {
    res.redirect(path.join(basePath, "/browse/"));
  });
  app.get(path.join(basePath, "/browse/*?"), async (req: Request, res: Response) => {
    const viewPath = ("/" + (req.params[0] ?? "")).replace(/([^\/])$/, "$1/");
    const { layout = "list" } = req.query;
    const query = new URL(req.url, "https://localhost").searchParams;
    query.set("layout", layout as string);

    // noinspection SuspiciousTypeOfGuard
    if (typeof viewPath !== "string" || typeof layout !== "string" ||
          ![ "list", "grid", "grid-small" ].includes(layout)) {
      res.sendStatus(400);
      return;
    }

    const fullPath = path.join(mediaDir, viewPath);

    if (!existsSync(fullPath) || !(await lstat(fullPath)).isDirectory()) {
      res.sendStatus(404);
      return;
    }

    const items = await getFileList(fullPath);

    if (path.relative(mediaDir, fullPath) !== "") {
      items.unshift({
        name: "..",
        path: path.sep + path.relative(mediaDir, path.resolve(mediaDir, fullPath, "..")),
        dir: true,
      });
    }

    const pathSections = viewPath.split(path.sep)
          .filter(v => v)
          .map((v, i, a) => ({
            name: v,
            path: path.sep + path.relative(mediaDir, path.join(mediaDir, ...a.slice(0, i + 1))),
          }));
    pathSections.unshift({
      name: "",
      path: path.sep,
    });

    res.render(`files-${layout}`, {
      basePath,
      items,
      title: viewPath,
      paths: pathSections,
      query: query.toString(),
    });
  });
}
