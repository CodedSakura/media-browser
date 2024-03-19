import type { Express, Request, Response } from "express";
import { existsSync } from "node:fs";
import { lstat, readdir } from "node:fs/promises";
import path from "node:path";
import { basePath } from "./index";

export interface File {
  name: string,
  path: string,
  dir: boolean,
}

export async function getFileList(fullPath: string, mediaDir: string): Promise<File[]> {
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

export default function (mediaDir: string, app: Express) {
  app.get(path.join(basePath, "/"), (_req: Request, res: Response) => {
    res.redirect(path.join(basePath, "/browse/"));
  });
  app.get(path.join(basePath, "/browse/*?"), async (req: Request, res: Response) => {
    const viewPath = req.params[0] ?? "/";
    const { layout = "list" } = req.query;

    // noinspection SuspiciousTypeOfGuard
    if (typeof viewPath !== "string" || typeof layout !== "string" ||
          ![ "list", "grid" ].includes(layout)) {
      res.sendStatus(400);
      return;
    }

    const fullPath = path.join(mediaDir, viewPath);

    if (!existsSync(fullPath) || !(await lstat(fullPath)).isDirectory()) {
      res.sendStatus(404);
      return;
    }

    const items = await getFileList(fullPath, mediaDir);

    if (path.relative(mediaDir, fullPath) !== "") {
      items.unshift({
        name: "..", path: path.sep + path.relative(mediaDir, path.resolve(mediaDir, fullPath, "..")), dir: true,
      });
    }

    res.render(`files-${layout}`, { title: viewPath, items, basePath });
  });
}
