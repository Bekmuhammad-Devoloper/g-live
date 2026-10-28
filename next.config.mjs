const nextConfig = {
  reactStrictMode: true,
  typescript: { ignoreBuildErrors: true },
  eslint: { ignoreDuringBuilds: true },
  distDir: process.env.NEXT_DIST_DIR || ".next",

  async rewrites() {
    return {
      beforeFiles: [{ source: "/uploads/:name", destination: "/api/files/:name" }],
    };
  },
};

export default nextConfig;
