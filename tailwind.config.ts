import type { Config } from "tailwindcss";
const config: Config = {
  content: ["./app/**/*.{js,ts,jsx,tsx,mdx}", "./components/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: { extend: { colors: { elyra: { bg: "#070707", panel: "#0d0d0d", line: "#202020" } } } },
  plugins: []
};
export default config;