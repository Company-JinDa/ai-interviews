"use client";

import { ChakraProvider, ColorModeScript } from "@chakra-ui/react";
import theme from "../theme";
import { Provider } from "@/components/ui/provider";
import { LangProvider } from "@/app/context/LangContext/LangContext";
import { ReactNode } from "react";

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        <ColorModeScript initialColorMode={theme.config.initialColorMode} />

        <ChakraProvider theme={theme}>
          <Provider>
            <LangProvider>{children}</LangProvider>
          </Provider>
        </ChakraProvider>
      </body>
    </html>
  );
}
