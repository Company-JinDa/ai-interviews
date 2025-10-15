import { extendTheme, ThemeConfig } from "@chakra-ui/react"

const config: ThemeConfig = {
  initialColorMode: "light",
  useSystemColorMode: false,
}
const styles = {
  global: (props: any) => ({
    body: {
      bg: props.colorMode === "dark" ? "#1A202C" : "#F5F7FB", 
      color: props.colorMode === "dark" ? "#EDEDED" : "#1A202C",
      transition: "background-color 0.3s ease, color 0.3s ease",
    },
    "*": {
      borderColor: props.colorMode === "dark" ? "#2D3748" : "#E2E8F0",
    },
    ".chakra-card, .chakra-box, .chakra-input, .chakra-button, .chakra-tabs": {
      backgroundColor:
        props.colorMode === "dark" ? "#2D3748" : "#FFFFFF",
      borderRadius: "xl",
      boxShadow:
        props.colorMode === "dark"
          ? "0 1px 3px rgba(0,0,0,0.3)"
          : "0 1px 4px rgba(0,0,0,0.08)",
    },

    ".chakra-tabs__tab[aria-selected=true]": {
      bg: props.colorMode === "dark" ? "#2B6CB0" : "#E3F2FD",
      color: props.colorMode === "dark" ? "white" : "#2B6CB0",
      fontWeight: "600",
    },
  }),
}
const colors = {
  brand: {
    50: "#E8F5FF",
    100: "#CDE8FF",
    200: "#9FD0FF",
    300: "#6AB7FF",
    400: "#4299E1", 
    500: "#3182CE",
    600: "#2B6CB0",
    700: "#265A8F",
  },
  accent: {
    mint: "#E6FFFA", 
    blueSoft: "#F0F8FF", 
    graySoft: "#F5F7FB",
  },
  bgSoft: "#F5F7FB",
  textSoft: "#2D3748",
}

const theme = extendTheme({ config, styles, colors })

export default theme
