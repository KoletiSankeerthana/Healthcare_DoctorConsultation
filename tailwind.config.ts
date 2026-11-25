import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/features/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        // Modern Ocean Blue & Turquoise Design System Tokens
        deepOcean: "#123D68",
        ocean: {
          DEFAULT: "#258FE5",
          hover: "#1D78C4",
          dark: "#163B63",
          deep: "#123D68",
          light: "#DCECF8",
        },
        turquoise: {
          DEFAULT: "#20B8AD",
          hover: "#1A9E94",
          light: "#E6F8F7",
          dark: "#163B63",
        },
        mist: {
          DEFAULT: "#DCECF8",
          light: "#EDF5FA",
          dark: "#C8DEF0",
        },
        medical: {
          DEFAULT: "#163B63",
          dark: "#123D68",
          light: "#EDF5FA",
        },
        page: "#EDF5FA",
        ice: {
          DEFAULT: "#DCECF8",
          subtle: "#EDF5FA",
        },
        // Typography & Border tokens
        tx: {
          primary: "#163B63",
          secondary: "#526A82",
          muted: "#8FA3B8",
        },
        bd: {
          DEFAULT: "#D5E4EF",
          subtle: "#D5E4EF",
          dark: "#CBD5E1",
        },
        // Backwards compatibility mappings for existing component classes
        forest: {
          DEFAULT: "#258FE5",
          dark: "#123D68",
          light: "#DCECF8",
          hover: "#1D78C4",
        },
        sage: {
          DEFAULT: "#20B8AD",
          light: "#E6F8F7",
          subtle: "#EDF5FA",
          dark: "#163B63",
        },
        deep: "#123D68",
        ivory: {
          DEFAULT: "#EDF5FA",
          warm: "#FFFFFF",
        },
        cream: {
          DEFAULT: "#DCECF8",
          dark: "#D5E4EF",
        },
        champagne: {
          DEFAULT: "#20B8AD",
          light: "#EDF5FA",
          dark: "#1A9E94",
        },
        brand: {
          navy: "#163B63",
          "navy-dark": "#123D68",
          "navy-light": "#258FE5",
          teal: "#258FE5",
          "teal-dark": "#123D68",
          "teal-light": "#20B8AD",
          mint: "#DCECF8",
          "mint-light": "#EDF5FA",
          "mint-dark": "#DCECF8",
          offwhite: "#EDF5FA",
          slate: "#526A82",
          "slate-light": "#8FA3B8",
          border: "#D5E4EF",
        },
      },
      fontFamily: {
        serif: [
          '"Times New Roman"',
          "Times",
          "Baskerville",
          "Georgia",
          "serif",
        ],
        sans: [
          '"Times New Roman"',
          "Times",
          "Baskerville",
          "Georgia",
          "serif",
        ],
      },
      boxShadow: {
        subtle: "0 2px 10px 0 rgba(18, 61, 104, 0.05), 0 1px 3px 0 rgba(18, 61, 104, 0.03)",
        editorial: "0 10px 30px -4px rgba(18, 61, 104, 0.08), 0 4px 12px -2px rgba(18, 61, 104, 0.04)",
        luxury: "0 20px 48px -10px rgba(18, 61, 104, 0.12), 0 8px 24px -6px rgba(18, 61, 104, 0.06)",
        float: "0 30px 60px -12px rgba(18, 61, 104, 0.16), 0 12px 24px -8px rgba(18, 61, 104, 0.08)",
        champagne: "0 0 0 1px rgba(37, 143, 229, 0.35), 0 8px 24px -4px rgba(18, 61, 104, 0.08)",
      },
    },
  },
  plugins: [],
};

export default config;
