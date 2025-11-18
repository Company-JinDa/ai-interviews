// src/app/mocktest4/page.tsx
"use client";

import {
  Box,
  Flex,
  Text,
  Button,
  VStack,
  HStack,
  Divider,
  Image,
  Center,
} from "@chakra-ui/react";
import { useRouter } from "next/navigation";
import { useState } from "react";

export default function MockTest4() {
  const router = useRouter();

  // State chọn Level & Role (chỉ được chọn 1)
  const [selectedLevel, setSelectedLevel] = useState<string | null>(null);
  const [selectedRole, setSelectedRole] = useState<string | null>(null);

  // Danh sách Level
  const levels = ["Intern", "Fresher", "Junior", "Middle", "Senior"];

  // Danh sách Role - đúng 100% theo ảnh Figma
  const roles = [
    ["Back-End", "Full-stack", "Cyber security", "DevOps"],
    ["Front-End", "Mobile", "Cloud Computing", "UX/UI Design"],
    ["AI Engineer", "Database Administration", "Data Science", "Analytics"],
  ];

  // Xử lý chọn Level
  const handleLevelClick = (level: string) => {
    setSelectedLevel(level);
  };

  // Xử lý chọn Role
  const handleRoleClick = (role: string) => {
    setSelectedRole(role);
  };

  // Xử lý nút Let's Go
  const handleLetsGo = () => {
    if (!selectedLevel || !selectedRole) {
      alert("Please select your Level and Role first!");
      return;
    }

    router.push(
      `/mocktest5?level=${encodeURIComponent(selectedLevel)}&role=${encodeURIComponent(
        selectedRole
      )}`
    );
  };

  return (
    <Box minH="100vh" bg="#f8fcff" position="relative">
      {/* Header với Logo + Tên */}
      <Flex
        align="center"
        justify="flex-start"
        px={8}
        py={6}
        borderBottom="1px solid #ddd"
        bg="white"
      >
        <Image
          src="/logo.png"
          alt="AI-Interview Logo"
          boxSize="50px"
          borderRadius="full"
          mr={3}
          fallbackSrc="https://via.placeholder.com/50?text=AI"
        />
        <Text fontSize="2xl" fontWeight="extrabold" color="teal.600">
          AI-Interview
        </Text>
      </Flex>

      <VStack spacing={12} mt={10} px={6} maxW="1200px" mx="auto">
        {/* Tiêu đề chính */}
        <Text
          fontSize={{ base: "2xl", md: "4xl" }}
          fontWeight="extrabold"
          color="gray.800"
          textAlign="center"
          lineHeight="1.2"
        >
          Receive random questions from companies
        </Text>

        {/* LEVELS - Nút vuông bo góc */}
        <Center>
          <HStack spacing={{ base: 3, md: 6 }} flexWrap="wrap" justify="center">
            {levels.map((level) => (
              <Button
                key={level}
                w={{ base: "100px", md: "130px" }}
                h="70px"
                bg={selectedLevel === level ? "teal.500" : "#b3e5fc"}
                color={selectedLevel === level ? "white" : "gray.800"}
                fontWeight="bold"
                fontSize={{ base: "sm", md: "lg" }}
                borderRadius="lg"
                boxShadow="md"
                _hover={{
                  bg: selectedLevel === level ? "teal.600" : "#81d4fa",
                  transform: "translateY(-2px)",
                }}
                transition="all 0.2s"
                onClick={() => handleLevelClick(level)}
              >
                {level}
              </Button>
            ))}
          </HStack>
        </Center>

        {/* Đường kẻ ngang */}
        <Divider borderColor="gray.300" w="90%" maxW="1000px" />

        {/* ROLES - Nút hình oval (pill) */}
        <VStack spacing={6} align="center" w="full">
          {roles.map((row, idx) => (
            <HStack key={idx} spacing={{ base: 4, md: 8 }} flexWrap="wrap" justify="center">
              {row.map((role) => (
                <Button
                  key={role}
                  px={{ base: 6, md: 8 }}
                  py={5}
                  minW={{ base: "160px", md: "200px" }}
                  bg={selectedRole === role ? "teal.500" : "#81d4fa"}
                  color={selectedRole === role ? "white" : "gray.800"}
                  fontWeight="bold"
                  fontSize="lg"
                  borderRadius="full"
                  boxShadow="lg"
                  _hover={{
                    bg: selectedRole === role ? "teal.600" : "#4fc3f7",
                    transform: "translateY(-3px)",
                  }}
                  transition="all 0.3s"
                  onClick={() => handleRoleClick(role)}
                >
                  {role}
                </Button>
              ))}
            </HStack>
          ))}
        </VStack>

        {/* Đường kẻ ngang thứ 2 */}
        <Divider borderColor="gray.300" w="90%" maxW="1000px" mt={8} />

        {/* Nút Let's Go - To đùng, đẹp như Figma */}
        <Box mt={12}>
          <Button
            onClick={handleLetsGo}
            bg="#4fc3f7"
            color="gray.900"
            fontSize={{ base: "3xl", md: "5xl" }}
            fontWeight="extrabold"
            px={{ base: 12, md: 20 }}
            py={{ base: 10, md: 12 }}
            borderRadius="3xl"
            boxShadow="0 20px 40px rgba(79, 195, 247, 0.4)"
            _hover={{
              bg: "#29b6f6",
              transform: "translateY(-6px)",
              boxShadow: "0 25px 50px rgba(79, 195, 247, 0.5)",
            }}
            _active={{ transform: "translateY(2px)" }}
            transition="all 0.3s"
            isDisabled={!selectedLevel || !selectedRole}
            opacity={!selectedLevel || !selectedRole ? 0.5 : 1}
            cursor={!selectedLevel || !selectedRole ? "not-allowed" : "pointer"}
          >
            Let&apos;go
          </Button>
        </Box>
      </VStack>

      {/* Background gradient nhẹ dưới cùng */}
      <Box
        position="absolute"
        bottom={0}
        left={0}
        right={0}
        h="300px"
        bgGradient="linear(to-t, #e1f5fe, transparent)"
        pointerEvents="none"
        zIndex={-1}
      />
    </Box>
  );
}