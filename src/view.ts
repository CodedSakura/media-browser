import type { Express, Request, Response } from "express";
import { existsSync } from "node:fs";
import { lstat } from "node:fs/promises";
import path from "node:path";
import { getFileList } from "./files";

/**
 * Get the file mime type from path. No extension required.
 * @param filePath Path to the file
 * @link https://stackoverflow.com/a/62425273
 */
function getMimeFromPath(filePath: string): string {
  const execSync = require("child_process").execSync;
  const mimeType = execSync("file --mime-type -b \"" + filePath + "\"").toString();
  return mimeType.trim();
}

const recognisedMimeTypes = {
  "image/png": "image",
  "image/svg+xml": "image",
  "image/jpeg": "image",
  "image/gif": "image",
  "video/mp4": "video",
  "video/x-matroska": "video",
  "video/webm": "video",
  "text/plain": "text",
} as const;

function mimeTypeToFileType(mime: string): "image" | "video" | "text" | "unknown" {
  if (mime.startsWith("text")) {
    return "text";
  }
  return recognisedMimeTypes[mime as keyof typeof recognisedMimeTypes] ?? "unknown";
}

export default function (mediaDir: string, app: Express) {
  app.get("/view/*", async (req: Request, res: Response) => {
    const viewPath = req.params[0];

    const fullPath = path.join(mediaDir, viewPath);

    if (!existsSync(fullPath) || (await lstat(fullPath)).isDirectory()) {
      res.sendStatus(404);
      return;
    }

    const mime = getMimeFromPath(fullPath);
    const fullBase = path.dirname(fullPath);
    const items = (await getFileList(fullBase, mediaDir))
          .filter(v => !v.dir);

    const absViewPath = path.sep + viewPath;

    const thisIndex = items.findIndex(v => v.path == absViewPath);
    const base = path.dirname(absViewPath);
    const next = thisIndex < items.length - 1 ? items[thisIndex + 1].path : absViewPath;
    const prev = thisIndex > 0 ? items[thisIndex - 1].path : absViewPath;

    res.render(`view`, {
      title: viewPath,
      type: mimeTypeToFileType(mime),
      base, next, prev,
    });
  });
}
