import type { Express, Request, Response } from "express";
import { existsSync } from "node:fs";
import { lstat, mkdir, readdir } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import { basePath, mediaDir, thumbnailDir } from "./index";

export interface File {
  name: string,
  path: string,
  dir: boolean,
  thumbnail?: string,
}

const thumbnailsForFilenames = /\.(?:png|jpeg|jpg)$/i;

export async function getFileList(fullPath: string): Promise<File[]> {
  return (await readdir(fullPath, { withFileTypes: true }))
        .sort((a, b) => a.isDirectory() ?
              (b.isDirectory() ? a.name.localeCompare(b.name) : -1) :
              (b.isDirectory() ? +1 : a.name.localeCompare(b.name)))
        .map(v => ({
          name: v.name,
          path: path.sep + path.relative(mediaDir, path.resolve(v.path, v.name)),
          dir: v.isDirectory(),
          thumbnail: thumbnailsForFilenames.test(v.name) ?
                path.relative(mediaDir, path.resolve(v.path, v.name)) :
                undefined,
        }));
}

export default function (app: Express) {
  app.get(path.join(basePath, "/"), (_req: Request, res: Response) => {
    res.redirect(path.join(basePath, "/browse/"));
  });
  app.get(path.join(basePath, "/browse/*?"), async (req: Request, res: Response) => {
    const viewPath = ("/" + (req.params[0] ?? "")).replace(/([^\/])$/, "$1/");
    let { layout = "list" } = req.query;

    if (Array.isArray(layout) && layout.length > 0) {
      layout = layout.pop()!;
    }
    // noinspection SuspiciousTypeOfGuard
    if (typeof viewPath !== "string" || typeof layout !== "string" ||
          ![ "list", "grid", "grid-small" ].includes(layout)) {
      res.sendStatus(400);
      return;
    }
    const query = new URL(req.url, "https://localhost").searchParams;
    query.set("layout", layout as string);

    const fullPath = path.join(mediaDir, viewPath);

    if (!existsSync(fullPath) || !(await lstat(fullPath)).isDirectory()) {
      res.sendStatus(404);
      return;
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

    const items = await getFileList(fullPath);

    if (path.relative(mediaDir, fullPath) !== "") {
      items.unshift({
        name: "..",
        path: path.sep + path.relative(mediaDir, path.resolve(mediaDir, fullPath, "..")),
        dir: true,
      });
    }

    await mkdir(path.join(thumbnailDir, viewPath), { recursive: true });
    await Promise.all(items
          .map(v => v.thumbnail)
          .filter(v => typeof v === "string")
          .filter(v => !existsSync(path.join(thumbnailDir, v as string)))
          .map(v =>
                sharp(path.join(mediaDir, v as string))
                      .resize({
                        width: 320,
                        height: 320,
                        fit: "inside",
                      })
                      .rotate()
                      .toFile(path.join(thumbnailDir, v as string))));

    res.render(`files-${layout}`, {
      basePath,
      items,
      title: viewPath,
      paths: pathSections,
      query: query.toString(),
    });
  });
}
