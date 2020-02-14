import * as execa from "execa";
import * as fs from "fs-extra";
import * as path from "path";
import * as fg from "fast-glob";

import { NpmCacheStorageOptions } from "backfill-config";

import { CacheStorage } from "./CacheStorage";

export class NpmCacheStorage extends CacheStorage {
  constructor(
    private options: NpmCacheStorageOptions,
    private internalCacheFolder: string
  ) {
    super();
  }

  protected async _fetch(hash: string): Promise<boolean> {
    const { npmPackageName, registryUrl, npmrcUserconfig } = this.options;

    const temporaryNpmOutputFolder = path.join(
      this.internalCacheFolder,
      "npm",
      hash
    );

    const packageFolderInTemporaryFolder = path.join(
      temporaryNpmOutputFolder,
      "node_modules",
      npmPackageName
    );

    if (!fs.existsSync(packageFolderInTemporaryFolder)) {
      fs.mkdirpSync(temporaryNpmOutputFolder);

      try {
        await execa(
          "npm",
          [
            "install",
            "--prefix",
            temporaryNpmOutputFolder,
            `${npmPackageName}@0.0.0-${hash}`,
            "--registry",
            registryUrl,
            "--prefer-offline",
            "--ignore-scripts",
            "--no-shrinkwrap",
            "--no-package-lock",
            "--loglevel",
            "error",
            ...(npmrcUserconfig ? ["--userconfig", npmrcUserconfig] : [])
          ],
          { stdout: "inherit" }
        );
      } catch (error) {
        fs.removeSync(temporaryNpmOutputFolder);

        if (error.stderr.toString().indexOf("ETARGET") > -1) {
          return false;
        } else {
          throw new Error(error);
        }
      }
    }

    fs.readdirSync(packageFolderInTemporaryFolder).forEach(fileOrFolder => {
      fs.copySync(
        path.join(packageFolderInTemporaryFolder, fileOrFolder),
        fileOrFolder
      );
    });

    return true;
  }

  protected async _put(hash: string, outputGlob: string[]) {
    const { npmPackageName, registryUrl, npmrcUserconfig } = this.options;

    const temporaryNpmOutputFolder = path.join(
      this.internalCacheFolder,
      "npm",
      hash,
      "upload"
    );

    // Create package.json file
    fs.outputJSONSync(path.join(temporaryNpmOutputFolder, "package.json"), {
      name: npmPackageName,
      version: `0.0.0-${hash}`
    });

    const files = fg.sync(outputGlob);
    files.forEach(file => {
      const destinationFolder = path.join(
        temporaryNpmOutputFolder,
        path.dirname(file)
      );
      fs.mkdirpSync(destinationFolder);
      fs.copySync(file, path.join(temporaryNpmOutputFolder, file));
    });

    // Upload package
    try {
      await execa(
        "npm",
        [
          "publish",
          "--registry",
          registryUrl,
          "--loglevel",
          "error",
          ...(npmrcUserconfig ? ["--userconfig", npmrcUserconfig] : [])
        ],
        {
          cwd: temporaryNpmOutputFolder,
          stdout: "inherit"
        }
      );
    } catch (error) {
      if (error.stderr.toString().indexOf("403") === -1) {
        throw new Error(error);
      }
    }
  }
}
