# Changelog

## [2.0.2](https://github.com/Julusian/node-image-rs/compare/v2.0.1...v2.0.2) (2025-08-24)


### Bug Fixes

* incorrect type re-export ([8745408](https://github.com/Julusian/node-image-rs/commit/874540860eee8840817aeff055232af3e60445e5))

## [2.0.1](https://github.com/Julusian/node-image-rs/compare/v2.0.0...v2.0.1) (2025-08-05)


### Bug Fixes

* strip npm package ([cc9e98b](https://github.com/Julusian/node-image-rs/commit/cc9e98b5d78507e7e882b49e09fc5564f7bcb3fb))
* usage with webpack ([28dd6fe](https://github.com/Julusian/node-image-rs/commit/28dd6fee2e822e299d797b0efb3d9d4d61d30e33))

## [2.0.0](https://github.com/Julusian/node-image-rs/compare/v1.1.1...v2.0.0) (2025-07-24)


### ⚠ BREAKING CHANGES

* emit esm and update minimum nodejs to 20

### Features

* add methods for data-urls ([7d9be12](https://github.com/Julusian/node-image-rs/commit/7d9be12ffd17369483b1b36a5fe0da617d7813e2))
* add overlap method ([9e70f57](https://github.com/Julusian/node-image-rs/commit/9e70f5766e15bd470c35961f802c45abf7b87ab1))
* emit esm and update minimum nodejs to 20 ([1dfc37b](https://github.com/Julusian/node-image-rs/commit/1dfc37b66c0cd35b0b42a7273f865ef5d26c3bfa))
* fixup internals ([6c884d4](https://github.com/Julusian/node-image-rs/commit/6c884d47a02103f444b46c872a50df770226baf7))
* improved unit tests ([5185fe3](https://github.com/Julusian/node-image-rs/commit/5185fe335c270564222cbf21d55b7dcf975aeae5))
* update napi-rs and add image encode/decode methods ([cc2a3f2](https://github.com/Julusian/node-image-rs/commit/cc2a3f289df9050dd5fb692cd394a99089b7e664))


### Bug Fixes

* bindings loading ([ef807f1](https://github.com/Julusian/node-image-rs/commit/ef807f165d44fe03bc72d85f3d63cde392661651))
* casing of ImageFormat enum ([62cca91](https://github.com/Julusian/node-image-rs/commit/62cca9141d0934828481454c7af4ce595d1a95f4))
* disable wasm build, as it is missing some portions ([00e796e](https://github.com/Julusian/node-image-rs/commit/00e796eae6404c088b3df617a9676f4d15b3fee8))

## [1.1.1](https://github.com/Julusian/node-image-rs/compare/v1.1.0...v1.1.1) (2024-08-15)


### Bug Fixes

* generate full (non-const) enums ([9bdd5d3](https://github.com/Julusian/node-image-rs/commit/9bdd5d337c5ed9b674eb21b85a772ca0bbe17d0f))

## [1.1.0](https://github.com/Julusian/node-image-rs/compare/v1.0.4...v1.1.0) (2024-08-15)


### Features

* generate string enums ([251ce89](https://github.com/Julusian/node-image-rs/commit/251ce89df807e971074b1355a8c61f8796be056a))

## [1.0.4](https://github.com/Julusian/node-image-rs/compare/v1.0.3...v1.0.4) (2024-08-15)


### Bug Fixes

* cropping ([9ecfefe](https://github.com/Julusian/node-image-rs/commit/9ecfefe56a0619b00c1caca255f295e2109f580f))

## [1.0.3](https://github.com/Julusian/node-image-rs/compare/v1.0.2...v1.0.3) (2024-07-22)


### Bug Fixes

* static link msvc runtime ([e7dfb3f](https://github.com/Julusian/node-image-rs/commit/e7dfb3fa77e190b7fa1242fd2e6cce38e0a59fc5))

## [1.0.2](https://github.com/Julusian/node-image-rs/compare/v1.0.1...v1.0.2) (2024-07-22)


### Bug Fixes

* repository url ([ac41460](https://github.com/Julusian/node-image-rs/commit/ac41460ad7a0da61ab24427929d8c590c904a4e8))

## [1.0.1](https://github.com/Julusian/node-image-rs/compare/v1.0.0...v1.0.1) (2024-07-22)


### Bug Fixes

* auto-publish workflow ([534beb0](https://github.com/Julusian/node-image-rs/commit/534beb06eeda75f1ed3a05f4b7a878e5adf850fd))

## [1.0.0](https://github.com/Julusian/node-image-rs/compare/v0.4.0...v1.0.0) (2024-07-22)


### ⚠ BREAKING CHANGES

* add pad operation

### Features

* add pad operation ([a96c935](https://github.com/Julusian/node-image-rs/commit/a96c9352fb6dcf775f3ed66b7175454e295b6be4))
* check common scenarios for being no-ops, and avoid computing new image ([73e32a4](https://github.com/Julusian/node-image-rs/commit/73e32a4bc6d04bc47d2816aa4b96ef17a2f4e922))
* expose current image dimensions ([4e486d4](https://github.com/Julusian/node-image-rs/commit/4e486d412539eb960e58b3c08350977e14248a81))
