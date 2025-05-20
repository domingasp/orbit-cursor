import "../src/index.css";
import "./styles.css";

import { withThemeByClassName } from "@storybook/addon-themes";
import { themes } from "@storybook/theming";

import type { Decorator, Preview } from "@storybook/react";

const preview: Preview = {
  parameters: {
    controls: {
      matchers: {
        color: /(background|color)$/i,
        date: /Date$/i,
      },
    },
    docs: {
      theme: themes.dark,
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
