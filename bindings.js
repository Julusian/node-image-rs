const { readFileSync } = require('fs')

const { platform, arch } = process

let nativeBinding = null
let loadError = null


// Workaround to fix webpack's build warnings: 'the request of a dependency is an expression'
const runtimeRequire = typeof __webpack_require__ === 'function' ? __non_webpack_require__ : require // eslint-disable-line

function isMusl() {
  // For Node 10
  if (!process.report || typeof process.report.getReport !== 'function') {
    try {
      const lddPath = require('child_process').execSync('which ldd').toString().trim();
      return readFileSync(lddPath, 'utf8').includes('musl')
    } catch (e) {
      return true
    }
  } else {
    const { glibcVersionRuntime } = process.report.getReport().header
    return !glibcVersionRuntime
  }
}

switch (platform) {
  case 'android':
    switch (arch) {
      case 'arm64':
        try {
          nativeBinding = runtimeRequire('./prebuilds/image-tools-rs.android-arm64.node')
        } catch (e) {
          loadError = e
        }
        break
      case 'arm':
        try {
          nativeBinding = runtimeRequire('./prebuilds/image-tools-rs.android-arm-eabi.node')
        } catch (e) {
          loadError = e
        }
        break
      default:
        throw new Error(`Unsupported architecture on Android ${arch}`)
    }
    break
  case 'win32':
    switch (arch) {
      case 'x64':
        try {
          nativeBinding = runtimeRequire('./prebuilds/image-tools-rs.win32-x64-msvc.node')
        } catch (e) {
          loadError = e
        }
        break
      case 'ia32':
        try {
          nativeBinding = runtimeRequire('./prebuilds/image-tools-rs.win32-ia32-msvc.node')
        } catch (e) {
          loadError = e
        }
        break
      case 'arm64':
        try {
          nativeBinding = runtimeRequire('./prebuilds/image-tools-rs.win32-arm64-msvc.node')
        } catch (e) {
          loadError = e
        }
        break
      default:
        throw new Error(`Unsupported architecture on Windows: ${arch}`)
    }
    break
  case 'darwin':
    try {
      nativeBinding = runtimeRequire('./prebuilds/image-tools-rs.darwin-universal.node')
      break
    } catch {}
    switch (arch) {
      case 'x64':
        try {
          nativeBinding = runtimeRequire('./prebuilds/image-tools-rs.darwin-x64.node')
        } catch (e) {
          loadError = e
        }
        break
      case 'arm64':
        try {
          nativeBinding = runtimeRequire('./prebuilds/image-tools-rs.darwin-arm64.node')
        } catch (e) {
          loadError = e
        }
        break
      default:
        throw new Error(`Unsupported architecture on macOS: ${arch}`)
    }
    break
  case 'freebsd':
    if (arch !== 'x64') {
      throw new Error(`Unsupported architecture on FreeBSD: ${arch}`)
    }
    try {
      nativeBinding = runtimeRequire('./prebuilds/image-tools-rs.freebsd-x64.node')
    } catch (e) {
      loadError = e
    }
    break
  case 'linux':
    switch (arch) {
      case 'x64':
        if (isMusl()) {
          try {
            nativeBinding = runtimeRequire('./prebuilds/image-tools-rs.linux-x64-musl.node')
          } catch (e) {
            loadError = e
          }
        } else {
          try {
            nativeBinding = runtimeRequire('./prebuilds/image-tools-rs.linux-x64-gnu.node')
          } catch (e) {
            loadError = e
          }
        }
        break
      case 'arm64':
        if (isMusl()) {
          try {
            nativeBinding = runtimeRequire('./prebuilds/image-tools-rs.linux-arm64-musl.node')
          } catch (e) {
            loadError = e
          }
        } else {
          try {
            nativeBinding = runtimeRequire('./prebuilds/image-tools-rs.linux-arm64-gnu.node')
          } catch (e) {
            loadError = e
          }
        }
        break
      case 'arm':
        try {
          nativeBinding = runtimeRequire('./prebuilds/image-tools-rs.linux-arm-gnueabihf.node')
        } catch (e) {
          loadError = e
        }
        break
      default:
        throw new Error(`Unsupported architecture on Linux: ${arch}`)
    }
    break
  default:
    throw new Error(`Unsupported OS: ${platform}, architecture: ${arch}`)
}

if (!nativeBinding) {
  if (loadError) {
    throw loadError
  }
  throw new Error(`Failed to load native binding`)
}

module.exports = nativeBinding
