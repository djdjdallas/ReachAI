/** @type {import('next').NextConfig} */
const nextConfig = {
  async redirects() {
    return [
      {
        source: "/:path*",
        has: [{ type: "host", value: "clinchd.io" }],
        destination: "https://www.clinchd.io/:path*",
        permanent: true,
      },
    ];
  },
};

export default nextConfig;
