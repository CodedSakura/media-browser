import type { Express, Request, Response } from "express";
import { existsSync } from "node:fs";
import { lstat } from "node:fs/promises";
import path from "node:path";
import { getFileList } from "./browse";
import { readConf, readDirConf } from "./conf";
import { basePath, mediaDir } from "./index";

/**
 * Get the file mime type from path. No extension required.
 * @param filePath Path to the file
 * @link https://stackoverflow.com/a/62425273
 */
function pathToMimeType(filePath: string): string {
  const execSync = require("child_process").execSync;
  const mimeType = execSync(`file --mime-type -b "${filePath}"`).toString();
  return mimeType.trim();
}

enum FileType {
  Image = "image",
  ImageRAW = "image-raw",
  Video = "video",
  Text = "text",
  Audio = "audio",
  Unknown = "unknown",
}

const recognisedMimeTypes: Record<string, FileType> = {
  "image/png": FileType.Image,
  "image/svg+xml": FileType.Image,
  "image/jpeg": FileType.Image,
  "image/gif": FileType.Image,
  "image/tiff": FileType.ImageRAW,
  "video/mp4": FileType.Video,
  "video/x-matroska": FileType.Video,
  "video/webm": FileType.Video,
  "video/quicktime": FileType.Video,
  "text/plain": FileType.Text,
} as const;

function mimeTypeToFileType(mime: string): FileType {
  if (mime.startsWith("text")) {
    return FileType.Text;
  }
  const fileType = recognisedMimeTypes[mime as keyof typeof recognisedMimeTypes] ?? FileType.Unknown;
  if (fileType === FileType.Unknown) {
    console.log("unknown mime type:", mime);
  }
  return fileType;
}

export default function (app: Express) {
  app.get(path.join(basePath, "/view/*"), async (req: Request, res: Response) => {
    const viewPath = req.params[0];
    const { style = "default", fit = "default" } = req.query;
    const query = new URL(req.url, "https://localhost").searchParams;
    query.set("style", style as string);
    query.set("fit", fit as string);

    const fullPath = path.join(mediaDir, viewPath);

    if (!existsSync(fullPath) || (await lstat(fullPath)).isDirectory()) {
      res.sendStatus(404);
      return;
    }

    const mime = pathToMimeType(fullPath);
    const viewBase = path.sep + path.dirname(viewPath);
    const items = (await getFileList(viewBase))
          .filter(v => !v.dir);

    const absViewPath = path.sep + viewPath;

    const thisIndex = items.findIndex(v => v.path == absViewPath);
    const base = path.dirname(absViewPath);
    const next = thisIndex < items.length - 1 ? items[thisIndex + 1].path : false;
    const prev = thisIndex > 0 ? items[thisIndex - 1].path : false;

    if (thisIndex === -1) {
      res.sendStatus(404);
      return;
    }

    const conf = await readConf();
    const dirConf = await readDirConf(viewBase);

    res.render("view", {
      title: viewPath,
      type: mimeTypeToFileType(mime),
      query: query.toString(),
      name: items[thisIndex].name,
      style: style === "default" ? (dirConf.defaultStyle === "default" ? conf.defaultStyle : dirConf.defaultStyle) : style,
      fit: fit === "default" ? (dirConf.defaultFit === "default" ? conf.defaultFit : dirConf.defaultFit) : fit,
      base, next, prev, basePath,
    });
  });
}
