"use client";

import { useState } from "react";
import { Box, Flex, Text, Button, Image, Wrap } from "@chakra-ui/react";

export default function MockTestView() {
  const levels = ["Intern", "Fresher", "Junior", "Middle", "Senior"];
  const topics = [
    "Back-End", "Front-End", "AI Engineer",
    "Full-stack", "Mobile", "Database Administration",
    "Cyber Security", "Cloud Computing", "Data Science",
    "DevOps", "UX/UI Design", "Analytics"
  ];

  const [selectedLevel, setSelectedLevel] = useState<string | null>(null);
  const [selectedTopics, setSelectedTopics] = useState<string[]>([]);

  const toggleTopic = (topic: string) => {
    if (selectedTopics.includes(topic)) {
      setSelectedTopics(selectedTopics.filter((t) => t !== topic));
    } else {
      setSelectedTopics([...selectedTopics, topic]);
    }
  };

  return (
    <Box bg="#f5f9fa" minH="100vh" p={8}>
      {/* Header */}
      <Flex align="center" mb={10}>
        /logo.png
        <Text fontSize="lg" fontWeight="semibold">AI Interviews</Text>
      </Flex>
      <Text fontSize="xl" fontWeight="bold" textAlign="center" mb={8}>
        Receive random questions from companies
      </Text>

      {/* Levels */}
      <Flex justify="center" gap={4} mb={8}>
        {levels.map((level) => (
          <Button
            key={level}
            bg={selectedLevel === level ? "teal.600" : "teal.500"}
            color="white"
            _hover={{ bg: "teal.700" }}
            borderRadius="md"
            px={6}
            py={4}
            onClick={() => setSelectedLevel(level)}
          >
            {level}
          </Button>
        ))}
      </Flex>

      {/* Topics */}
      <Wrap justify="center" spacing={4} mb={10}>
        {topics.map((topic) => (
          <Button
            key={topic}
            bg={selectedTopics.includes(topic) ? "teal.400" : "gray.200"}
            color="black"
            borderRadius="full"
            px={6}
            py={3}
            _hover={{ bg: selectedLevel ? "teal.300" : "gray.300" }}
            isDisabled={!selectedLevel}
            onClick={() => toggleTopic(topic)}
          >
            {topic}
          </Button>
        ))}
      </Wrap>

      {/* Action Button */}
      <Flex justify="center">
        <Button
          bg="teal.600"
          color="white"
          _hover={{ bg: "teal.700" }}
          borderRadius="md"
          px={10}
          py={6}
          isDisabled={!selectedLevel || selectedTopics.length === 0}
        >
          Let’s go
        </Button>
      </Flex>
    </Box>
  );
}