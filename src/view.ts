import type { Express, Request, Response } from "express";
import { existsSync } from "node:fs";
import { lstat } from "node:fs/promises";
import path from "node:path";
import { getFileList } from "./browse";
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
    const { style = "ltr", fit = "h" } = req.query;
    const query = new URL(req.url, "https://localhost").searchParams;
    query.set("style", style as string);
    query.set("fit", fit as string);

    const fullPath = path.join(mediaDir, viewPath);

    if (!existsSync(fullPath) || (await lstat(fullPath)).isDirectory()) {
      res.sendStatus(404);
      return;
    }

    const mime = pathToMimeType(fullPath);
    const fullBase = path.dirname(fullPath);
    const items = (await getFileList(fullBase))
          .filter(v => !v.dir);

    const absViewPath = path.sep + viewPath;

    const thisIndex = items.findIndex(v => v.path == absViewPath);
    const base = path.dirname(absViewPath);
    const next = thisIndex < items.length - 1 ? items[thisIndex + 1].path : false;
    const prev = thisIndex > 0 ? items[thisIndex - 1].path : false;

    res.render("view", {
      title: viewPath,
      type: mimeTypeToFileType(mime),
      query: query.toString(),
      base, next, prev, basePath, style, fit,
    });
  });
}
