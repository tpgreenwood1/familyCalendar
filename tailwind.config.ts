import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./lib/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "var(--background)",
        foreground: "var(--foreground)",
        "honey-bronze": "#f6bd60",
        linen: "#f7ede2",
        "cotton-rose": "#f5cac3",
        "muted-teal": "#84a59d",
        "light-coral": "#f28482",
      },
    },
  },
  plugins: [],
};
export default config;
