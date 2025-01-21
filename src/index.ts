import connectLiveReload from "connect-livereload";
import express, { type NextFunction, Request, Response } from "express";
import { create } from "express-handlebars";
import { mkdirSync, readFileSync } from "fs";
import livereload from "livereload";
import fs from "node:fs";
import type { AddressInfo } from "node:net";
import path from "node:path";
import qs from "qs";
import sass from "sass";
import browse, { isAllowedMiddleware } from "./browse";
import view from "./view";

export const mediaDir = path.resolve(__dirname, process.env.MEDIA_DIR ?? "../media/");
export const thumbnailDir = path.resolve(__dirname, process.env.THUMB_DIR ?? "../thumbs/");
export const basePath = ("/" + (process.env.BASE_PATH ?? "")
      .replace(/\/$/, "")
      .replace(/^\//, "") + "/").replace(/^\/\/$/, "/");

export class FileNotFoundError extends Error {}

const title = process.env.TITLE ?? "Media Browser";

mkdirSync(thumbnailDir, { recursive: true });

const liveReloadServer = livereload.createServer();
liveReloadServer.server.once("connection", () => {
  setTimeout(() => {
    liveReloadServer.refresh("/");
  });
});

const app = express();

const hbs = create({
  helpers: {
    eq: (a: any, b: any) => a == b,
    getFileContents: (p: string) => readFileSync(path.join(mediaDir, p), "utf-8"),
    appTitle: () => title,
    getCurrDirName: (arr: { name: string }[]) => arr[arr.length - 1].name,
  },
});

app.engine("handlebars", hbs.engine);
app.set("view engine", "handlebars");
app.set("views", path.resolve(__dirname, "../views"));

app.set("query parser", (str: string) => {
  return qs.parse(str);
});

app.use(connectLiveReload());
app.use(express.json());

browse(app);
view(app);

app.get(path.join(basePath, "*filename.css"), (req: Request, res: Response) => {
  const urlBase = path.dirname(path.relative(path.join(basePath, "/"), req.url));
  const filename = path.basename(req.url, ".css");
  const extLessPath = path.resolve(__dirname, "../public", urlBase, filename);
  if (fs.existsSync(extLessPath + ".css")) {
    res.sendFile(extLessPath + ".css");
    return;
  } else if (fs.existsSync(extLessPath + ".sass")) {
    res.set("Content-Type", "text/css");
    res.send(sass.compile(extLessPath + ".sass").css);
    return;
  } else if (fs.existsSync(extLessPath + ".scss")) {
    res.set("Content-Type", "text/css");
    res.send(sass.compile(extLessPath + ".scss").css);
    return;
  }
  res.sendStatus(404);
});

app.use(path.join(basePath, "/"), express.static(path.resolve(__dirname, "../public")));

app.use(path.join(basePath, "/media"), isAllowedMiddleware("/media"), express.static(mediaDir));

app.use(path.join(basePath, "/thumbs"), isAllowedMiddleware("/thumbs"), express.static(thumbnailDir));

app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  if (err instanceof FileNotFoundError) {
    res.sendStatus(404);
    return;
  }

  console.error(err.stack)
  res.status(500).send('Something broke!')
});

const listener = app.listen(Number(process.env.PORT ?? 80), () => {
  const address = listener.address()! as AddressInfo;
  console.log(`App started on ${address.port}, base path = '${basePath}'`);
});
