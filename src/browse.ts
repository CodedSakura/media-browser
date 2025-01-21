import type { Express, Request, RequestHandler, Response } from "express";
import { existsSync } from "node:fs";
import { lstat, mkdir, readdir } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import { readConf, readDirConf } from "./conf";
import { basePath, mediaDir, thumbnailDir } from "./index";

export interface File {
  name: string,
  path: string,
  dir: boolean,
  thumbnail?: string,
}

export async function getFileList(viewPath: string): Promise<File[]> {
  const fullPath = path.join(mediaDir, viewPath);

  const conf = await readConf();
  const dirConf = await readDirConf(viewPath);

  if (conf.mode === "whitelist" && !conf.whitelist.some(p => p.startsWith(viewPath))) {
    console.log("not whitelisted", viewPath);
    return [];
  }

  return (await readdir(fullPath, { withFileTypes: true }))
        .sort((a, b) => a.isDirectory() ?
              (b.isDirectory() ? a.name.localeCompare(b.name) : -1) :
              (b.isDirectory() ? +1 : a.name.localeCompare(b.name)))
        .map(v => ({
          name: v.name,
          path: path.sep + path.relative(mediaDir, path.resolve(v.path, v.name)),
          dir: v.isDirectory(),
          thumbnail: conf.renderThumbnails && conf.renderThumbnails.map(v => v.toLowerCase()).includes(path.extname(v.name).toLowerCase()) ?
                path.relative(mediaDir, path.resolve(v.path, v.name)) :
                undefined,
        }))
        .filter(v => {
          if (v.name.startsWith(conf.hidePrefix)) {
            return false;
          }
          if (conf.hideRaws && conf.hideRaws.map(v => v.toLowerCase()).includes(path.extname(v.name).toLowerCase())) {
            return false;
          }

          if (v.dir && conf.mode === "whitelist") {
            if (!conf.whitelist.some(p => p.startsWith(v.path))) {
              return false;
            }
          }

          if (dirConf.hide) {
            return false;
          }

          if (dirConf.mode === "whitelist") {
            return dirConf.list.includes(v.name);
          }
          return !dirConf.list.includes(v.name);
        });
}

export const isAllowedMiddleware = (mediaPath: string): RequestHandler => {
  return async (req, res, next) => {
    const viewPath = path.sep + path.dirname(path.relative(basePath, req.path));
    const name = path.basename(req.path);

    const conf = await readConf();
    const dirConf = await readDirConf(viewPath);
    if (conf.whitelist && conf.whitelist.length > 0 && !conf.whitelist.some(p => p.startsWith(viewPath))) {
      res.sendStatus(404);
      return;
    }

    if (dirConf.hide) {
      res.sendStatus(404);
      return;
    }
    if (dirConf.mode === "whitelist" && !dirConf.list.includes(name)) {
      res.sendStatus(404);
      return;
    }
    if (dirConf.mode === "blacklist" && dirConf.list.includes(name)) {
      res.sendStatus(404);
      return;
    }

    next();
  };
};

export default function (app: Express) {
  app.get(path.join(basePath, "/"), (_req: Request, res: Response) => {
    res.redirect(path.join(basePath, "/browse/"));
  });
  app.get(path.join(basePath, "/browse/{*path}"), async (req: Request, res: Response) => {
    const viewPath = ("/" + path.join(...(req.params.path ?? []))).replace(/([^\/])$/, "$1/");
    let { layout = "default" } = req.query;

    if (Array.isArray(layout) && layout.length > 0) {
      layout = layout.pop()!;
    }
    // noinspection SuspiciousTypeOfGuard
    if (typeof viewPath !== "string" || typeof layout !== "string" ||
          ![ "default", "list", "grid", "grid-small" ].includes(layout)) {
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

    const conf = await readConf();
    const dirConf = await readDirConf(viewPath);

    if (conf.mode === "whitelist" && !conf.whitelist.some(p => p.startsWith(viewPath))) {
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

    const items = await getFileList(viewPath);

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

    res.render(`files-${layout == "default" ? (dirConf.defaultLayout === "default" ? conf.defaultLayout : dirConf.defaultLayout) : layout}`, {
      basePath,
      items,
      title: viewPath,
      paths: pathSections,
      query: query.toString(),
    });
  });
}
