import Link from "next/link";
import { Button, VStack, Box } from "@chakra-ui/react";

export default function HomePage() {
  return (
    <Box
      position="relative"
      w="100vw"
      h="100vh"
      overflow="hidden"
    >
      {/* Fullscreen background video */}
      <video
        src="/assets/ai-demo.mp4" // để video trong public/assets
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

      {/* Overlay buttons */}
      <VStack
        spacing={4}
        position="absolute"
        top="50%"
        left="50%"
        transform="translate(-50%, -50%)"
        zIndex={1}
        w="full"
        maxW="sm"
      >
        <Link href="/auth/login" style={{ width: "100%" }}>
          <Button
            w="full"
            colorScheme="teal"
            size="lg"
            bg="rgba(0,128,128,0.8)"
            _hover={{ bg: "teal.600" }}
          >
            Login
          </Button>
        </Link>
        <Link href="/auth/signup" style={{ width: "100%" }}>
          <Button
            w="full"
            colorScheme="blue"
            size="lg"
            bg="rgba(0,0,255,0.8)"
            _hover={{ bg: "blue.600" }}
          >
            Sign Up
          </Button>
        </Link>
      </VStack>
    </Box>
  );
}
