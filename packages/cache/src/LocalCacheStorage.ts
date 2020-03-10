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

    await Promise.all(
      fs.readdirSync(localCacheFolder).map(async fileOrFolder => {
        await fs.copy(path.join(localCacheFolder, fileOrFolder), fileOrFolder);
      })
    );

    return true;
  }

  protected async _put(hash: string, outputGlob: string[]): Promise<void> {
    const localCacheFolder = this.getLocalCacheFolder(hash);

    const files = fg.sync(outputGlob);

    await Promise.all(
      files.map(async file => {
        const destinationFolder = path.join(
          localCacheFolder,
          path.dirname(file)
        );
        await fs.mkdirp(destinationFolder);
        await fs.copy(file, path.join(localCacheFolder, file));
      })
    );
  }
}
