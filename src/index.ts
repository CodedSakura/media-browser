import connectLiveReload from "connect-livereload";
import express, { Request, Response } from "express";
import { create } from "express-handlebars";
import { readFileSync } from "fs";
import livereload from "livereload";
import fs from "node:fs";
import path from "node:path";
import qs from "qs";
import sass from "sass";
import files from "./files";
import view from "./view";

const mediaDir = path.resolve(__dirname, process.env.MEDIA_DIR ?? "../media/");

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
  },
});

app.engine("handlebars", hbs.engine);
app.set("view engine", "handlebars");
app.set("views", path.resolve(__dirname, "../views"));

app.set("query parser", (str: string) => {
  return qs.parse(str);
});

app.use(connectLiveReload());

files(mediaDir, app);
view(mediaDir, app);

app.get("*.css", (req: Request, res: Response) => {
  const urlBase = path.dirname(path.relative("/", req.url));
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

app.use(express.static(path.resolve(__dirname, "../public")));

app.use("/media", express.static(mediaDir));

app.listen(Number(process.env.PORT ?? 3000), () => {
  console.log("App started");
});
