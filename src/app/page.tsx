"use client";

import { useState } from "react";
import Link from "next/link";
import { Button, HStack, Box, Text, VStack, IconButton } from "@chakra-ui/react";
import { FaGlobe } from "react-icons/fa";

export default function HomePage() {
  const [lang, setLang] = useState<"en" | "vi">("en");

  // Text theo ngôn ngữ
  const content = {
    en: {
      welcome: "Welcome to AI Interview",
      line1:
        "Support business partners to create their own questions for candidates, helping businesses to facilitate and feel comfortable during the preliminary round interview",
      line2:
        "Help candidates and students practice AI interviews, to increase candidates' confidence",
      login: "Login",
      signup: "Sign Up",
      toggle: "VI",
    },
    vi: {
      welcome: "Chào mừng đến với AI Interview",
      line1:
        "Hỗ trợ các doanh nghiệp tạo ra bộ câu hỏi riêng cho ứng viên, giúp doanh nghiệp dễ dàng và thoải mái hơn trong vòng phỏng vấn sơ bộ",
      line2:
        "Giúp ứng viên và sinh viên luyện tập phỏng vấn AI, tăng sự tự tin cho ứng viên",
      login: "Đăng nhập",
      signup: "Đăng ký",
      toggle: "EN",
    },
  };

  return (
    <Box position="relative" w="100vw" h="100vh" overflow="hidden">
      {/* Fullscreen background video */}
      <video
        src="/assets/ai-demo.mp4"
        autoPlay
        loop
        muted
        playsInline
        style={{
          width: "100%",
          height: "100%",
          objectFit: "cover",
          position: "absolute",
          top: 0,
          left: 0,
        }}
      />

      <Box
        position="absolute"
        top={0}
        left={0}
        w="100%"
        h="100%"
        bg="rgba(0,0,0,0.45)"
        zIndex={0}
      />

      {/* Buttons top right */}
      <HStack spacing={3} position="absolute" top={6} right={8} zIndex={2}>
        {/* Toggle Language */}
        <IconButton
          aria-label="Toggle Language"
          icon={<FaGlobe />}
          colorScheme="teal"
          size="md"
          bg="teal.500"
          _hover={{ bg: "teal.600" }}
          onClick={() => setLang(lang === "en" ? "vi" : "en")}
        >
          {content[lang].toggle}
        </IconButton>

        {/* Auth Buttons */}
        <Link href="/auth/login">
          <Button colorScheme="teal" size="md" bg="teal.500" _hover={{ bg: "teal.600" }}>
            {content[lang].login}
          </Button>
        </Link>
        <Link href="/auth/signup">
          <Button colorScheme="teal" size="md" bg="teal.500" _hover={{ bg: "teal.600" }}>
            {content[lang].signup}
          </Button>
        </Link>
      </HStack>

      {/* Center slogan */}
      <VStack
        position="absolute"
        top="50%"
        left="50%"
        transform="translate(-50%, -50%)"
        zIndex={1}
        spacing={6}
        textAlign="center"
        px={6}
        animation="fadeUp 1.2s ease-out"
      >
        {/* Title */}
        <Text
          fontSize={{ base: "3xl", md: "3xl", lg: "4xl" }}
          fontWeight="extrabold"
          color="white"
          textShadow="4px 4px 12px rgba(0,0,0,0.9)"
        >
          {content[lang].welcome}
        </Text>

        <Text
          fontSize={{ base: "xl", md: "2xl", lg: "1xl" }}
          fontWeight="extrabold"
          bgGradient="linear(to-r, teal.200, cyan.300, white)"
          bgClip="text"
          textShadow="3px 3px 12px rgba(0,0,0,0.8)"
        >
          {content[lang].line1}
        </Text>
         <Text
          fontSize={{ base: "xl", md: "2xl", lg: "1xl" }}
          fontWeight="extrabold"
          bgGradient="linear(to-r, teal.200, cyan.300, white)"
          bgClip="text"
          textShadow="3px 3px 12px rgba(0,0,0,0.8)"
        >
          {content[lang].line2}
        </Text>
      </VStack>

      {/* Animation keyframes */}
      <style jsx global>{`
        @keyframes fadeUp {
          from {
            opacity: 0;
            transform: translate(-50%, -40%);
          }
          to {
            opacity: 1;
            transform: translate(-50%, -50%);
          }
        }
      `}</style>
    </Box>
  );
}
