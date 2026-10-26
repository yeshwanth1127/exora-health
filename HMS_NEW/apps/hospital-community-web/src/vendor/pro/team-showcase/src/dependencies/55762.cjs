// Reconstructed from public browser-delivered JavaScript; original TSX not recovered.
const interop = require("../interop.cjs");
Object.defineProperty(exports, "__esModule", {
  value: !0
});
var r = {
  VALID_LOADERS: function () {
    return n;
  },
  imageConfigDefault: function () {
    return a;
  }
};
for (var i in r) Object.defineProperty(exports, i, {
  enumerable: !0,
  get: r[i]
});
let n = ["default", "imgix", "cloudinary", "akamai", "custom"],
  a = {
    deviceSizes: [640, 750, 828, 1080, 1200, 1920, 2048, 3840],
    imageSizes: [32, 48, 64, 96, 128, 256, 384],
    path: "",
    loader: "default",
    loaderFile: "",
    domains: [],
    disableStaticImages: !1,
    minimumCacheTTL: 14400,
    formats: ["image/webp"],
    maximumDiskCacheSize: void 0,
    maximumRedirects: 3,
    maximumResponseBody: 5e7,
    dangerouslyAllowLocalIP: !1,
    dangerouslyAllowSVG: !1,
    contentSecurityPolicy: "script-src 'none'; frame-src 'none'; sandbox;",
    contentDispositionType: "attachment",
    localPatterns: void 0,
    remotePatterns: [],
    qualities: [75],
    unoptimized: !0,
    customCacheHandler: !1
  };
