import * as fs from "fs-extra";
import * as path from "path";
import * as fg from "fast-glob";

import { CacheStorage } from "./CacheStorage";

export class LocalCacheStorage extends CacheStorage {
  constructor(private internalCacheFolder: string) {
    super();
  }

  protected getLocalCacheFolder(hash: string): string {
    return path.join(this.internalCacheFolder, hash);
  }

  protected async _fetch(hash: string): Promise<boolean> {
    const localCacheFolder = this.getLocalCacheFolder(hash);

    if (!fs.pathExistsSync(localCacheFolder)) {
      return false;
    }

    fs.readdirSync(localCacheFolder).forEach(fileOrFolder => {
      fs.copySync(path.join(localCacheFolder, fileOrFolder), fileOrFolder);
    });

    return true;
  }

  protected async _put(hash: string, outputGlob: string[]): Promise<void> {
    const localCacheFolder = this.getLocalCacheFolder(hash);

    const files = fg.sync(outputGlob);
    files.forEach(file => {
      const destinationFolder = path.join(localCacheFolder, path.dirname(file));
      fs.mkdirpSync(destinationFolder);
      fs.copySync(file, path.join(localCacheFolder, file));
    });
  }
}
