// prettier-ignore
/* eslint-disable */
// @ts-nocheck
/* auto-generated by NAPI-RS */

import { createRequire } from 'node:module'
import { join } from "node:path";
import { existsSync, readFileSync } from "node:fs";
const require = createRequire(import.meta.url);

// Workaround to fix webpack's build warnings: 'the request of a dependency is an expression'
const runtimeRequire0 =
  typeof __webpack_require__ === "function" ? __non_webpack_require__ : require; // eslint-disable-line

function runtimeRequire(name) {
  const candidates = [
    join(import.meta.dirname, name),
    join(import.meta.dirname, "prebuilds", name),
  ];
  for (const candidate of candidates) {
    if (existsSync(candidate)) return runtimeRequire0(candidate);
  }
  throw new Error(`No candidate found. Tried: \n${candidates.join("\n")}`);
}

const isMusl = () => {
  let musl = false;
  if (process.platform === "linux") {
    musl = isMuslFromFilesystem();
    if (musl === null) {
      musl = isMuslFromReport();
    }
    if (musl === null) {
      musl = isMuslFromChildProcess();
    }
  }
  return musl;
};

const isFileMusl = (f) => f.includes("libc.musl-") || f.includes("ld-musl-");

const isMuslFromFilesystem = () => {
  try {
    return readFileSync("/usr/bin/ldd", "utf-8").includes("musl");
  } catch {
    return null;
  }
};

const isMuslFromReport = () => {
  let report = null;
  if (typeof process.report?.getReport === "function") {
    process.report.excludeNetwork = true;
    report = process.report.getReport();
  }
  if (!report) {
    return null;
  }
  if (report.header && report.header.glibcVersionRuntime) {
    return false;
  }
  if (Array.isArray(report.sharedObjects)) {
    if (report.sharedObjects.some(isFileMusl)) {
      return true;
    }
  }
  return false;
};

const isMuslFromChildProcess = () => {
  try {
    return require("child_process")
      .execSync("ldd --version", { encoding: "utf8" })
      .includes("musl");
  } catch (e) {
    // If we reach this case, we don't know if the system is musl or not, so is better to just fallback to false
    return false;
  }
};

let nativeBinding = null;
const loadErrors = [];

function requireNative() {
  if (process.env.NAPI_RS_NATIVE_LIBRARY_PATH) {
    try {
      nativeBinding = require(process.env.NAPI_RS_NATIVE_LIBRARY_PATH);
    } catch (err) {
      loadErrors.push(err);
    }
  } else if (process.platform === "android") {
    if (process.arch === "arm64") {
      try {
        return runtimeRequire("julusian-image-rs.android-arm64.node");
      } catch (e) {
        loadErrors.push(e);
      }
    } else if (process.arch === "arm") {
      try {
        return runtimeRequire("julusian-image-rs.android-arm-eabi.node");
      } catch (e) {
        loadErrors.push(e);
      }
    } else {
      loadErrors.push(
        new Error(`Unsupported architecture on Android ${process.arch}`)
      );
    }
  } else if (process.platform === "win32") {
    if (process.arch === "x64") {
      try {
        return runtimeRequire("julusian-image-rs.win32-x64-msvc.node");
      } catch (e) {
        loadErrors.push(e);
      }
    } else if (process.arch === "ia32") {
      try {
        return runtimeRequire("julusian-image-rs.win32-ia32-msvc.node");
      } catch (e) {
        loadErrors.push(e);
      }
    } else if (process.arch === "arm64") {
      try {
        return runtimeRequire("julusian-image-rs.win32-arm64-msvc.node");
      } catch (e) {
        loadErrors.push(e);
      }
    } else {
      loadErrors.push(
        new Error(`Unsupported architecture on Windows: ${process.arch}`)
      );
    }
  } else if (process.platform === "darwin") {
    if (process.arch === "x64") {
      try {
        return runtimeRequire("julusian-image-rs.darwin-x64.node");
      } catch (e) {
        loadErrors.push(e);
      }
    } else if (process.arch === "arm64") {
      try {
        return runtimeRequire("julusian-image-rs.darwin-arm64.node");
      } catch (e) {
        loadErrors.push(e);
      }
    } else {
      loadErrors.push(
        new Error(`Unsupported architecture on macOS: ${process.arch}`)
      );
    }
  } else if (process.platform === "freebsd") {
    if (process.arch === "x64") {
      try {
        return runtimeRequire("julusian-image-rs.freebsd-x64.node");
      } catch (e) {
        loadErrors.push(e);
      }
    } else if (process.arch === "arm64") {
      try {
        return runtimeRequire("julusian-image-rs.freebsd-arm64.node");
      } catch (e) {
        loadErrors.push(e);
      }
    } else {
      loadErrors.push(
        new Error(`Unsupported architecture on FreeBSD: ${process.arch}`)
      );
    }
  } else if (process.platform === "linux") {
    if (process.arch === "x64") {
      if (isMusl()) {
        try {
          return runtimeRequire("julusian-image-rs.linux-x64-musl.node");
        } catch (e) {
          loadErrors.push(e);
        }
      } else {
        try {
          return runtimeRequire("julusian-image-rs.linux-x64-gnu.node");
        } catch (e) {
          loadErrors.push(e);
        }
      }
    } else if (process.arch === "arm64") {
      if (isMusl()) {
        try {
          return runtimeRequire("julusian-image-rs.linux-arm64-musl.node");
        } catch (e) {
          loadErrors.push(e);
        }
      } else {
        try {
          return runtimeRequire("julusian-image-rs.linux-arm64-gnu.node");
        } catch (e) {
          loadErrors.push(e);
        }
      }
    } else if (process.arch === "arm") {
      if (isMusl()) {
        try {
          return runtimeRequire("julusian-image-rs.linux-arm-musleabihf.node");
        } catch (e) {
          loadErrors.push(e);
        }
      } else {
        try {
          return runtimeRequire("julusian-image-rs.linux-arm-gnueabihf.node");
        } catch (e) {
          loadErrors.push(e);
        }
      }
    } else if (process.arch === "riscv64") {
      if (isMusl()) {
        try {
          return runtimeRequire("julusian-image-rs.linux-riscv64-musl.node");
        } catch (e) {
          loadErrors.push(e);
        }
      } else {
        try {
          return runtimeRequire("julusian-image-rs.linux-riscv64-gnu.node");
        } catch (e) {
          loadErrors.push(e);
        }
      }
    } else if (process.arch === "ppc64") {
      try {
        return runtimeRequire("julusian-image-rs.linux-ppc64-gnu.node");
      } catch (e) {
        loadErrors.push(e);
      }
    } else if (process.arch === "s390x") {
      try {
        return runtimeRequire("julusian-image-rs.linux-s390x-gnu.node");
      } catch (e) {
        loadErrors.push(e);
      }
    } else {
      loadErrors.push(
        new Error(`Unsupported architecture on Linux: ${process.arch}`)
      );
    }
  } else {
    loadErrors.push(
      new Error(
        `Unsupported OS: ${process.platform}, architecture: ${process.arch}`
      )
    );
  }
}

nativeBinding = requireNative();

// if (!nativeBinding || process.env.NAPI_RS_FORCE_WASI) {
//   try {
//     nativeBinding = require("julusian-image-rs.wasi.cjs");
//   } catch (err) {
//     if (process.env.NAPI_RS_FORCE_WASI) {
//       loadErrors.push(err);
//     }
//   }
// }

if (!nativeBinding) {
  if (loadErrors.length > 0) {
    throw new Error(`Cannot find native binding.`, { cause: loadErrors });
  }
  throw new Error(`Failed to load native binding`);
}

const { ImageTransformer, ImageFormat, PixelFormat, ResizeMode, RotationMode } =
  nativeBinding;
export { ImageTransformer };
export { ImageFormat };
export { PixelFormat };
export { ResizeMode };
export { RotationMode };
