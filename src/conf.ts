import { readFile } from "node:fs/promises";
import path from "node:path";
import { mediaDir } from "./index";

export interface Conf {
  mode: "allow-all" | "whitelist",
  renderThumbnails: false | string[],
  hideRaws: false | string[],
  rawStrategy: "append" | "replace",
  showExif: boolean,
  whitelist: string[],
  directoryConfigName: string,
  hidePrefix: string,
  confExpireMs: number,
  defaultLayout: "list" | "grid" | "grid-small",
  defaultStyle: "ltr" | "rtl" | "bi",
  defaultFit: "h" | "v",
}

export interface DirConf {
  mode: "blacklist" | "whitelist",
  hide: boolean,
  list: string[],
  defaultLayout: "list" | "grid" | "grid-small" | "default",
  defaultStyle: "ltr" | "rtl" | "bi" | "default",
  defaultFit: "h" | "v" | "default",
}

type Cached<T> = { value: T, expires: number };

const defaultConf: Conf = {
  mode: "allow-all",
  renderThumbnails: [ ".png", ".jpg", ".jpeg" ],
  hideRaws: false,
  rawStrategy: "replace",
  showExif: true,
  whitelist: [],
  directoryConfigName: ".~conf.json",
  hidePrefix: ".",
  confExpireMs: 10000,
  defaultLayout: "grid-small",
  defaultStyle: "ltr",
  defaultFit: "h",
} as const;
const defaultDirConf: DirConf = {
  mode: "blacklist",
  hide: false,
  list: [],
  defaultLayout: "default",
  defaultStyle: "default",
  defaultFit: "default",
} as const;

const latestConf: Cached<Conf> = { expires: Date.now(), value: defaultConf };

export async function readConf(): Promise<Conf> {
  if (Date.now() < latestConf.expires) {
    return latestConf.value;
  }

  const mainConfPath = path.join(mediaDir, ".~main-conf.json");
  const fileContents = await readFile(mainConfPath, "utf-8")
        .catch(() => "{}");
  const conf: Partial<Conf> = JSON.parse(fileContents);
  latestConf.value = { ...defaultConf, ...conf };
  latestConf.expires = Date.now() + latestConf.value.confExpireMs;
  return latestConf.value;
}

const dirConfCache = new Map<string, Cached<DirConf>>();

export async function readDirConf(dirPath: string): Promise<DirConf> {
  if (dirConfCache.has(dirPath) && dirConfCache.get(dirPath)!.expires > Date.now()) {
    return dirConfCache.get(dirPath)!.value;
  }

  const conf = await readConf();
  const dirConfPath = path.join(mediaDir, dirPath, conf.directoryConfigName);
  const fileContents = await readFile(dirConfPath, "utf-8")
        .catch(() => "{}");
  const dirConf: Partial<DirConf> = JSON.parse(fileContents);
  const fullDirConf: DirConf = { ...defaultDirConf, ...dirConf };

  dirConfCache.set(dirPath, {
    value: fullDirConf,
    expires: Date.now() + conf.confExpireMs,
  });

  return fullDirConf;
}
