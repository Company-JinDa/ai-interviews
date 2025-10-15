import { extendTheme, ThemeConfig } from "@chakra-ui/react";

const config: ThemeConfig = {
  initialColorMode: "light",
  useSystemColorMode: false,
};

const styles = {
  global: (props: any) => ({
    body: {
      bg: props.colorMode === "dark" ? "#1A202C" : "#F4F6FA", // nền sáng hơn chút
      color: props.colorMode === "dark" ? "#EDEDED" : "#1A202C", // chữ rõ ràng hơn
      transition: "background-color 0.3s ease, color 0.3s ease",
    },
    "*": {
      borderColor: props.colorMode === "dark" ? "#2D3748" : "#E2E8F0",
    },
    ".chakra-card, .chakra-box, .chakra-input, .chakra-button, .chakra-tabs":
      {
        backgroundColor:
          props.colorMode === "dark" ? "#2D3748" : "#FFFFFF", // card trắng thật sự
      },
  }),
};

const colors = {
  brand: {
    50: "#E3F2FD",
    100: "#BEE3F8",
    200: "#90CDF4",
    300: "#63B3ED",
    400: "#4299E1",
    500: "#3182CE", // xanh chủ đạo
    600: "#2B6CB0",
    700: "#2C5282",
  },
  bgSoft: "#F4F6FA", // màu nền tổng thể dịu
  textSoft: "#2D3748", // chữ tối hơn
};

const theme = extendTheme({ config, styles, colors });

export default theme;
