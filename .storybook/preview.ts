import "overlayscrollbars/styles/overlayscrollbars.css";
import "../src/index.css";
import "./styles.css";

import { withThemeByClassName } from "@storybook/addon-themes";
import { themes } from "storybook/theming";

import type { Decorator, Preview } from "@storybook/react-vite";

const preview: Preview = {
  parameters: {
    controls: {
      expanded: true, // Show description/default in Story view
      matchers: {
        color: /(background|color)$/i,
        date: /Date$/i,
      },
      disableSaveFromUI: true,
    },
    docs: {
      theme: themes.dark,
    },
    options: {
      /* eslint-disable */ // Runs in a javascript context, no typing available
      storySort: (a, b) =>
        a.title === b.title ? 0 : a.title.localeCompare(b.title),
      /* eslint-enable */
    },
  },
  tags: ["autodocs"],
};

export const decorators = [
  withThemeByClassName({
    defaultTheme: "dark",
    themes: {
      dark: "dark",
      light: "",
    },
  }),
] as Decorator[];

export default preview;
