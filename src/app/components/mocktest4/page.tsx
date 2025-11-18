// src/app/mocktest4/page.tsx
"use client";

import { Box, Flex, Text, Button, VStack, HStack, Divider } from "@chakra-ui/react";
import { useRouter } from "next/navigation";
import { useState } from "react";

export default function MockTest4() {
  const router = useRouter();

  // State chọn Level (chỉ được chọn 1)
  const [selectedLevel, setSelectedLevel] = useState<string | null>(null);

  // State chọn Role (chỉ được chọn 1)
  const [selectedRole, setSelectedRole] = useState<string | null>(null);

  // Danh sách Level
  const levels = ["Intern", "Fresher", "Junior", "Middle", "Senior"];

  // Danh sách Role (giống hệt ảnh)
  const roles = [
    ["Back-End", "Full-stack", "Cyber security", "DevOps"],
    ["Front-End", "Mobile", "Cloud Computing", "UX/UI Design"],
    ["AI Engineer", "Database Administration", "Data Science", "Analytics"],
  ];

  // Xử lý nhấn Level
  const handleLevelClick = (level: string) => {
    setSelectedLevel(level);
  };

  // Xử lý nhấn Role
  const handleRoleClick = (role: string) => {
    setSelectedRole(role);
  };

  // Xử lý nút Let's Go
  const handleLetsGo = () => {
    if (!selectedLevel || !selectedRole) {
      alert("Please select both Level and Role!");
      return;
    }
    // Chuyển sang mocktest5 với params
    router.push(`/mocktest5?level=${encodeURIComponent(selectedLevel)}&role=${encodeURIComponent(selectedRole)}`);
  };

  return (
    <Box minH="100vh" bg="#f8fcff" position="relative">
      {/* Header */}
      <Box bg="#e6f3ff" py={4} px={8} borderBottom="1px solid #ccc">
        <Text fontSize="sm" color="gray.600" fontWeight="medium">
          AI - Interviews
        </Text>
      </Box>

      <VStack spacing={10} mt={10} px={6}>
        {/* Tiêu đề */}
        <Text fontSize="3xl" fontWeight="extrabold" color="gray.800">
          Receive random questions from companies
        </Text>

        {/* LEVELS - Hình vuông bo góc */}
        <HStack spacing={6}>
          {levels.map((level) => (
            <Button
              key={level}
              w="120px"
              h="60px"
              bg={selectedLevel === level ? "teal.400" : "#b3e0ff"}
              color={selectedLevel === level ? "white" : "gray.800"}
              fontWeight="bold"
              borderRadius="lg"
              boxShadow="md"
              _hover={{ bg: selectedLevel === level ? "teal.500" : "#99d6ff" }}
              transition="all 0.2s"
              onClick={() => handleLevelClick(level)}
            >
              {level}
            </Button>
          ))}
        </HStack>

        {/* Divider */}
        <Divider borderColor="gray.300" w="90%" />

        {/* ROLES - Hình oval (pill) */}
        <VStack spacing={6} align="center">
          {roles.map((row, rowIndex) => (
            <HStack key={rowIndex} spacing={8}>
              {row.map((role) => (
                <Button
                  key={role}
                  px={8}
                  py={5}
                  bg={selectedRole === role ? "teal.400" : "#a1d4ff"}
                  color={selectedRole === role ? "white" : "gray.800"}
                  fontWeight="bold"
                  borderRadius="full"
                  boxShadow="lg"
                  _hover={{ bg: selectedRole === role ? "teal.500" : "#85c8ff" }}
                  transition="all 0.3s"
                  fontSize="lg"
                  minW="180px"
                  onClick={() => handleRoleClick(role)}
                >
                  {role}
                </Button>
              ))}
            </HStack>
          ))}
        </VStack>

        {/* Divider */}
        <Divider borderColor="gray.300" w="90%" mt={10} />

        {/* Nút Let's Go - Giống hệt ảnh */}
        <Box mt={12}>
          <Button
            onClick={handleLetsGo}
            bg="#6ccbff"
            color="gray.900"
            fontSize="3xl"
            fontWeight="extrabold"
            px={16}
            py={10}
            borderRadius="2xl"
            boxShadow="2xl"
            _hover={{ bg: "#4fb8ff", transform: "translateY(-4px)" }}
            _active={{ transform: "translateY(2px)" }}
            transition="all 0.3s"
            isDisabled={!selectedLevel || !selectedRole}
            opacity={!selectedLevel || !selectedRole ? 0.6 : 1}
          >
            Let&apos;go
          </Button>
        </Box>
      </VStack>

      {/* Background nhẹ giống ảnh */}
      <Box
        position="absolute"
        bottom={0}
        left={0}
        right={0}
        h="200px"
        bgGradient="linear(to-t, #e6f7ff, transparent)"
        pointerEvents="none"
        zIndex={-1}
      />
    </Box>
  );
}