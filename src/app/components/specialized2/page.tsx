// "use client";

// import dynamic from "next/dynamic";
// import {
//   Box,
//   Flex,
//   Text,
//   Button,
//   Tabs,
//   TabList,
//   Tab,
//   TabPanels,
//   TabPanel,
//   HStack,
//   Image,
//   Icon,
//   VStack,
//   useToast,
//   Spinner,
// } from "@chakra-ui/react";
// import { FaHome, FaMicrophone, FaPlay } from "react-icons/fa";
// import { MdDirectionsBike, MdOutlineKeyboardArrowRight } from "react-icons/md";
// import { useRouter, useSearchParams } from "next/navigation";
// import { useEffect, useState, useRef } from "react";
// import { db, auth } from "@/app/lib/firebase";
// import {
//   addDoc,
//   collection,
//   doc,
//   serverTimestamp,
//   onSnapshot,
//   orderBy,
//   query as firestoreQuery,
// } from "firebase/firestore";

// // ⚙️ Dynamic import react-mic
// const ReactMic: any = dynamic(
//   async () => {
//     const mod = await import("react-mic");
//     return mod.ReactMic;
//   },
//   { ssr: false }
// );

// export default function Specialized2() {
//   const router = useRouter();
//   const searchParams = useSearchParams();
//   const toast = useToast();

//   const category = searchParams.get("category") || "Information Technology";
//   const level = searchParams.get("level") || "";
//   const role = searchParams.get("role") || "";
//   const questions = (() => {
//     try {
//       return JSON.parse(searchParams.get("questions") || "[]");
//     } catch {
//       return [];
//     }
//   })();

//   // 🎯 State
//   const [currentQ, setCurrentQ] = useState<number>(0);
//   const [recording, setRecording] = useState<boolean>(false);
//   const [answers, setAnswers] = useState<string[]>([]);
//   const [isLoading, setIsLoading] = useState(false);
//   const [result, setResult] = useState<any>(null);
//   const [countdown, setCountdown] = useState<number>(60);
//   const [hasMicPermission, setHasMicPermission] = useState<boolean | null>(null);
//   const [started, setStarted] = useState<boolean>(false);
//   const [historyRealtime, setHistoryRealtime] = useState<any[]>([]);

//   const timerRef = useRef<any>(null);
//   const silenceTimerRef = useRef<any>(null);
//   const recorderRef = useRef<any>(null);

//   const silenceThreshold = 0.02;
//   const silenceDuration = 2000;

//   // 🧩 Convert blob → base64
//   const blobToBase64 = (blob: Blob) =>
//     new Promise<string>((resolve, reject) => {
//       const reader = new FileReader();
//       reader.onloadend = () => resolve((reader.result as string).split(",")[1]);
//       reader.onerror = reject;
//       reader.readAsDataURL(blob);
//     });

//   // ✅ Kiểm tra quyền mic
//   const ensureMicPermission = async (): Promise<boolean> => {
//     if (typeof window === "undefined") return false;
//     try {
//       const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
//       stream.getTracks().forEach((t) => t.stop());
//       setHasMicPermission(true);
//       return true;
//     } catch {
//       setHasMicPermission(false);
//       toast({
//         title: "Microphone chưa được phép",
//         description:
//           "Hãy cho phép truy cập micro trong trình duyệt (icon micro trên thanh địa chỉ).",
//         status: "error",
//         position: "top",
//       });
//       return false;
//     }
//   };

//   // 🔊 Phát câu hỏi bằng TTS
//   const playQuestion = async (text: string): Promise<void> => {
//     try {
//       const res = await fetch("/api/tts", {
//         method: "POST",
//         headers: { "Content-Type": "application/json" },
//         body: JSON.stringify({ text }),
//       });
//       const data = await res.json();
//       const audio = new Audio("data:audio/mp3;base64," + data.audioContent);
//       return new Promise<void>((resolve) => {
//         audio.onended = () => resolve();
//         audio.onerror = () => resolve();
//         audio.play().catch(() => resolve());
//       });
//     } catch {
//       const u = new SpeechSynthesisUtterance(text);
//       u.lang = "en-US";
//       return new Promise<void>((resolve) => {
//         u.onend = () => resolve();
//         speechSynthesis.speak(u);
//       });
//     }
//   };

//   // 🔔 Beep nhỏ
//   const playBeep = () => {
//     try {
//       const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
//       const o = ctx.createOscillator();
//       const g = ctx.createGain();
//       o.type = "sine";
//       o.frequency.value = 800;
//       g.gain.value = 0.1;
//       o.connect(g);
//       g.connect(ctx.destination);
//       o.start();
//       setTimeout(() => {
//         o.stop();
//         ctx.close();
//       }, 150);
//     } catch {}
//   };

//   // ▶️ Bắt đầu
//   const handleStart = async () => {
//     if (started) return;
//     const ok = await ensureMicPermission();
//     if (!ok) return;
//     setStarted(true);
//     setAnswers([]);
//     await runQuestionCycle(0);
//   };

//   // 🔁 Chu trình câu hỏi
//   const runQuestionCycle = async (index: number) => {
//     if (index >= questions.length) return await finishInterview();
//     setCurrentQ(index);
//     setCountdown(60);

//     await playQuestion(questions[index]);
//     playBeep();
//     await new Promise((r) => setTimeout(r, 500));
//     startRecording();
//   };

//   // 🎙️ Bắt đầu ghi âm
//   const startRecording = () => {
//     setRecording(true);
//     if (timerRef.current) clearInterval(timerRef.current);
//     timerRef.current = setInterval(() => {
//       setCountdown((prev) => {
//         if (prev <= 1) {
//           clearInterval(timerRef.current);
//           stopRecording();
//           return 0;
//         }
//         return prev - 1;
//       });
//     }, 1000);
//   };

//   // 🛑 Dừng ghi âm
//   const stopRecording = () => {
//     setRecording(false);
//     setTimeout(() => {
//       if (recorderRef.current?.stopRecording) {
//         recorderRef.current.stopRecording();
//       }
//     }, 500);
//   };

//   // 🎧 Khi dừng ghi
//   const onStop = async (recordedBlob: any) => {
//     try {
//       const reader = new FileReader();
//       reader.onloadend = async () => {
//         if (!reader.result) return;
//         const base64Audio = (reader.result as string).split(",")[1];

//         const res = await fetch("/api/stt", {
//           method: "POST",
//           headers: { "Content-Type": "application/json" },
//           body: JSON.stringify({ audio: base64Audio }),
//         });

//         const data = await res.json();
//         if (data.transcription) {
//           const newAnswers = [...answers, data.transcription];
//           setAnswers(newAnswers);
//           await new Promise((r) => setTimeout(r, 1000));
//           await runQuestionCycle(currentQ + 1);
//         } else {
//           await runQuestionCycle(currentQ + 1);
//         }
//       };
//       reader.readAsDataURL(recordedBlob.blob);
//     } catch (err) {
//       console.error("❌ onStop error:", err);
//       await runQuestionCycle(currentQ + 1);
//     }
//   };

//   // 🏁 Kết thúc phỏng vấn
//   const finishInterview = async () => {
//     clearInterval(timerRef.current);
//     setRecording(false);
//     setStarted(false);
//     setIsLoading(true);

//     try {
//       const res = await fetch("/api/evaluate", {
//         method: "POST",
//         headers: { "Content-Type": "application/json" },
//         body: JSON.stringify({ answers }),
//       });
//       const data = await res.json();
//       setResult(data);

//       const uid =
//         auth.currentUser?.uid ||
//         `guest-${localStorage.getItem("guestUid") || `guest-${Date.now()}`}`;
//       const userDocRef = doc(db, "users", uid);
//       const interviewsRef = collection(userDocRef, "interviews");

//       await addDoc(interviewsRef, {
//         questions,
//         answers,
//         score: data?.score ?? null,
//         feedback: data?.feedback ?? null,
//         createdAt: serverTimestamp(),
//       });

//       toast({
//         title: "Interview finished!",
//         description: "Results saved successfully.",
//         status: "success",
//         duration: 2000,
//       });
//     } catch (err) {
//       console.error(err);
//     } finally {
//       setIsLoading(false);
//     }
//   };

//   // 🧠 Realtime history
//   useEffect(() => {
//     let unsub: (() => void) | undefined;
//     (async () => {
//       const uid =
//         auth.currentUser?.uid ||
//         (localStorage.getItem("guestUid") ||
//           (() => {
//             const g = `guest-${Date.now()}`;
//             localStorage.setItem("guestUid", g);
//             return g;
//           })());
//       const userDocRef = doc(db, "users", uid);
//       const histCol = collection(userDocRef, "history");
//       const q = firestoreQuery(histCol, orderBy("createdAt", "asc"));
//       unsub = onSnapshot(q, (snap) => {
//         const arr: any[] = [];
//         snap.forEach((d) => arr.push({ id: d.id, ...d.data() }));
//         setHistoryRealtime(arr);
//       });
//     })();
//     return () => unsub && unsub();
//   }, []);

//   useEffect(() => {
//     ensureMicPermission();
//     return () => clearInterval(timerRef.current);
//   }, []);

//   // ✅ UI
//   return (
//     <Box p={4} minH="100vh" bg="white">
//       <Flex align="center" borderBottom="1px solid black" pb={2}>
//         <Image src="/logo.png" alt="Logo" boxSize="40px" mr={2} borderRadius="full" />
//         <Text fontSize="2xl" fontWeight="bold">
//           AI-Interview
//         </Text>
//       </Flex>

//       <HStack spacing={2} mt={2} mb={4}>
//         <Button variant="ghost" p={0} onClick={() => router.push("/auth/dashboard")}>
//           <Icon as={FaHome} boxSize={5} mr={1} />
//           <Text>Home</Text>
//         </Button>
//         <Icon as={MdOutlineKeyboardArrowRight} />
//         <Button variant="ghost" p={0} onClick={() => router.push("/components/specialized")}>
//           <Icon as={MdDirectionsBike} boxSize={5} />
//           <Text>Specialized Practice</Text>
//         </Button>
//         <Icon as={MdOutlineKeyboardArrowRight} />
//         <Button
//           variant="ghost"
//           p={0}
//           onClick={() => router.push(`/components/specialized1?category=${category}`)}
//         >
//           <Icon as={FaMicrophone} boxSize={5} />
//           <Text>{category}</Text>
//         </Button>
//         <Icon as={MdOutlineKeyboardArrowRight} />
//         <Icon as={FaPlay} color="teal.400" />
//         <Text>{role ? `${role} - ${level}` : ""}</Text>
//       </HStack>

//       <Flex>
//         {/* LEFT */}
//         <Box
//           flex="2"
//           borderRight="1px solid black"
//           minH="70vh"
//           position="relative"
//           display="flex"
//           flexDirection="column"
//           justifyContent="center"
//           alignItems="center"
//         >
//           {isLoading && <Spinner size="xl" color="teal.400" mb={4} />}

//           <VStack spacing={4} mb={6} w="full">
//             <Box
//               p={6}
//               border="1px solid"
//               borderColor="teal.400"
//               borderRadius="md"
//               bg="teal.50"
//               w="full"
//               maxW="800px"
//             >
//               <Text fontWeight="bold">
//                 Question {currentQ + 1} / {questions.length}
//               </Text>
//               <Text mt={2} fontSize="lg">
//                 {questions[currentQ] || "No question"}
//               </Text>
//             </Box>
//           </VStack>

//           {recording ? (
//             <Box textAlign="center" mb={4} w="100%">
//               <Text color="red.500">Recording... ({countdown}s)</Text>
//               <ReactMic
//                 ref={recorderRef}
//                 key={currentQ}
//                 record={recording}
//                 onStop={onStop}
//                 onData={(chunk: any) => {
//                   const amplitude = Math.abs(chunk?.amplitude ?? 0);
//                   if (amplitude < silenceThreshold) {
//                     if (!silenceTimerRef.current) {
//                       silenceTimerRef.current = setTimeout(() => {
//                         stopRecording();
//                         clearTimeout(silenceTimerRef.current);
//                         silenceTimerRef.current = null;
//                       }, silenceDuration);
//                     }
//                   } else {
//                     clearTimeout(silenceTimerRef.current);
//                     silenceTimerRef.current = null;
//                   }
//                 }}
//                 mimeType="audio/webm;codecs=opus"
//                 strokeColor="#00b894"
//                 backgroundColor="#f1f6f4"
//                 visualSetting="frequencyBars"
//                 width={600}
//                 height={150}
//               />
//             </Box>
//           ) : (
//             <Box mb={4}>
//               <Text color={hasMicPermission ? "gray.500" : "red.500"}>
//                 {hasMicPermission ? "Ready to record" : "Microphone not allowed"}
//               </Text>
//             </Box>
//           )}

//           <Flex justify="center" position="absolute" bottom="16" left="0" right="0">
//             <Button
//               size="lg"
//               color="white"
//               bg={started ? "gray.400" : "teal.400"}
//               borderRadius="full"
//               px={10}
//               py={6}
//               fontSize="xl"
//               _hover={{ bg: started ? "gray.400" : "teal.500" }}
//               onClick={handleStart}
//               isDisabled={started}
//             >
//               {started ? "Interview in progress..." : "Start"}
//             </Button>
//           </Flex>
//         </Box>

//         {/* RIGHT */}
//         <Box flex="1" pl={4} borderLeft="1px solid black">
//           <Tabs variant="unstyled">
//             <TabList borderBottom="1px solid black">
//               <Tab fontSize="lg" _selected={{ fontWeight: "bold", borderBottom: "2px solid black" }}>
//                 Interview Results
//               </Tab>
//               <Tab fontSize="lg" ml={4} _selected={{ fontWeight: "bold", borderBottom: "2px solid black" }}>
//                 AI Suggestions
//               </Tab>
//             </TabList>

//             <TabPanels>
//               <TabPanel>
//                 {result ? (
//                   <Box>
//                     <Text
//                       fontSize="2xl"
//                       fontWeight="bold"
//                       color={result.score >= 6 ? "teal.500" : "red.500"}
//                     >
//                       {result.score >= 6 ? "✅ PASS" : "❌ FAIL"}
//                     </Text>
//                     <Text mt={2}>Score: {result.score}</Text>
//                     <Text mt={2}>{result.feedback}</Text>
//                   </Box>
//                 ) : (
//                   <Text>Interview result will appear here.</Text>
//                 )}

//                 <Box mt={6}>
//                   <Text fontSize="sm" fontWeight="bold">
//                     Realtime history (last answers)
//                   </Text>
//                   <VStack align="start" mt={2} spacing={2}>
//                     {historyRealtime.length === 0 ? (
//                       <Text fontSize="sm" color="gray.500">
//                         No answers yet
//                       </Text>
//                     ) : (
//                       historyRealtime.map((h) => (
//                         <Box key={h.id} p={2} border="1px solid #eee" borderRadius="md" w="full">
//                           <Text fontSize="sm" fontWeight="semibold">
//                             {h.question}
//                           </Text>
//                           <Text fontSize="sm">{h.answer}</Text>
//                         </Box>
//                       ))
//                     )}
//                   </VStack>
//                 </Box>
//               </TabPanel>

//               <TabPanel>
//                 {result && result.score < 6 ? (
//                   <Box>
//                     <Text mb={2}>AI Suggestion:</Text>
//                     <Text whiteSpace="pre-wrap">
//                       {result.suggestion || "Try to be more structured..."}
//                     </Text>
//                   </Box>
//                 ) : (
//                   <Text>No suggestions yet.</Text>
//                 )}
//               </TabPanel>
//             </TabPanels>
//           </Tabs>
//         </Box>
//       </Flex>
//     </Box>
//   );
// }
 "use client"
 
 import {
   Box,
   Flex,
   Text,
   HStack,
   Image,
   Button,
   VStack,
   Input,
   IconButton,
   useToast,
   Spinner,
 } from "@chakra-ui/react"
 import { useEffect, useState } from "react"
 import {
   AddIcon,
   EditIcon,
   DeleteIcon,
   CheckIcon,
   CloseIcon,
 } from "@chakra-ui/icons"
 import { auth, db } from "@/app/lib/firebase"
 import {
   doc,
   setDoc,
   getDocs,
   collection,
   getDoc,
 } from "firebase/firestore"
 import { useRouter } from "next/navigation"
 
 const CATEGORIES = {
   "Information Technology": [
     "Frontend",
     "Backend",
     "DevOps",
     "Security",
     "Intern BE",
   ],
   English: [
     "Translation & Interpretation",
     "English Language Teaching",
     "Business English",
     "English for Tourism",
     "English for Media",
     "Academic English",
   ],
 }
 
 type Question = {
   id: number
   question: string
   expected: string
   editMode?: boolean
 }
 
 export default function ManagePage() {
   const router = useRouter()
   const [tab, setTab] = useState<"question" | "result">("question")
   const [selectedCategory, setSelectedCategory] = useState<string | null>(null)
   const [selectedSpec, setSelectedSpec] = useState<string | null>(null)
 
   // Questions lưu theo spec
   const [questionsMap, setQuestionsMap] = useState<Record<string, Question[]>>(
     {}
   )
 
   const [qInput, setQInput] = useState("")
   const [eInput, setEInput] = useState("")
   const [generatedLinks, setGeneratedLinks] = useState<Record<string, string>>(
     {}
   )
   const [loading, setLoading] = useState(false)
   const [companyId, setCompanyId] = useState<string | null>(null)
 
   const toast = useToast()
 
   const currentQuestions = selectedSpec ? questionsMap[selectedSpec] || [] : []
 
   // Load role và questionSets từ Firestore
   useEffect(() => {
     const fetchQuestions = async () => {
       const user = auth.currentUser
       if (!user) return
       setLoading(true)
 
       try {
         // Lấy role của user
         const userRef = doc(db, "users", user.uid)
         const userSnap = await getDoc(userRef)
 
         if (!userSnap.exists()) {
           console.error("User doc not found")
           setLoading(false)
           return
         }
 
         const role = userSnap.data()?.role
         if (role !== "company") {
           console.error("User is not company")
           setLoading(false)
           return
         }
 
         setCompanyId(user.uid)
 
         // Lấy questionSets trong companies/{uid}/questionSets
         const ref = collection(db, "companies", user.uid, "questionSets")
         const snapshot = await getDocs(ref)
 
         const data: Record<string, Question[]> = {}
         const links: Record<string, string> = {}
 
         snapshot.forEach((docSnap) => {
           const spec = docSnap.id
           const qData = docSnap.data()?.questions || []
           data[spec] = qData
           links[spec] = `${window.location.origin}/interview/${user.uid}/${encodeURIComponent(spec)}`
         })
 
         setQuestionsMap(data)
         setGeneratedLinks(links)
       } catch (err) {
         console.error("Error loading questions:", err)
       }
 
       setLoading(false)
     }
 
     fetchQuestions()
   }, [])
 
   // Add new question
   const handleAdd = () => {
     if (!selectedSpec || !qInput.trim() || !eInput.trim()) return
 
     const newQs = [
       ...(questionsMap[selectedSpec] || []),
       { id: Date.now(), question: qInput, expected: eInput, editMode: false },
     ]
     setQuestionsMap({ ...questionsMap, [selectedSpec]: newQs })
     setQInput("")
     setEInput("")
   }
 
   // Delete question
   const handleDelete = (id: number) => {
     if (!selectedSpec) return
     const newQs = (questionsMap[selectedSpec] || []).filter((q) => q.id !== id)
     setQuestionsMap({ ...questionsMap, [selectedSpec]: newQs })
   }
 
   // Toggle edit mode
   const handleEditToggle = (id: number) => {
     if (!selectedSpec) return
     const newQs = (questionsMap[selectedSpec] || []).map((q) =>
       q.id === id ? { ...q, editMode: !q.editMode } : q
     )
     setQuestionsMap({ ...questionsMap, [selectedSpec]: newQs })
   }
 
   // Save after edit
   const handleEditSave = (id: number, newQ: string, newE: string) => {
     if (!selectedSpec) return
     const newQs = (questionsMap[selectedSpec] || []).map((q) =>
       q.id === id
         ? { ...q, question: newQ, expected: newE, editMode: false }
         : q
     )
     setQuestionsMap({ ...questionsMap, [selectedSpec]: newQs })
   }
 
   // Save to Firestore + generate link
   const handleGenerate = async () => {
     const user = auth.currentUser
     if (!user || !selectedSpec || !companyId) return
 
     try {
       const ref = doc(db, "companies", companyId, "questionSets", selectedSpec)
       await setDoc(ref, { questions: currentQuestions }, { merge: true })
 
       const link = `${window.location.origin}/interview/${companyId}/${encodeURIComponent(
         selectedSpec
       )}`
 
       setGeneratedLinks((prev) => ({ ...prev, [selectedSpec]: link }))
 
       toast({
         title: `${selectedSpec} saved & link generated!`,
         status: "success",
         duration: 3000,
       })
     } catch (err) {
       console.error("Error saving:", err)
       toast({
         title: "Error saving questions",
         status: "error",
         duration: 3000,
       })
     }
   }
 
   return (
     <Flex
       direction="column"
       minH="100vh"
       border="2px solid"
       borderColor="blue.300"
       p={4}
       align="center"
     >
       {/* Logo + Title */}
       <HStack
         spacing={3}
         cursor="pointer"
         mb={4}
         onClick={() => router.push("/auth/dashboard")}
       >
         <Image src="/logo.png" alt="logo" boxSize="50px" borderRadius="full" />
         <Text fontSize="2xl" fontWeight="bold">
           AI-Interview
         </Text>
       </HStack>
 
       <Box w="100%" borderBottom="1px solid black" mb={6}></Box>
 
       {/* Tabs */}
       <HStack spacing={6} mb={6}>
         <Button
           colorScheme={tab === "question" ? "blue" : "gray"}
           onClick={() => setTab("question")}
         >
           Question
         </Button>
         <Button
           colorScheme={tab === "result" ? "blue" : "gray"}
           onClick={() => setTab("result")}
         >
           Result
         </Button>
       </HStack>
 
       {/* Loading spinner */}
       {loading && (
         <Flex flex="1" align="center" justify="center">
           <Spinner size="xl" />
         </Flex>
       )}
 
       {/* Question View */}
       {!loading && tab === "question" && (
         <Flex w="100%" flex="1" gap={6}>
           {/* Left side: Category + Specialization */}
           <VStack
             w="260px"
             spacing={3}
             align="stretch"
             borderRight="1px solid #ccc"
             pr={2}
           >
             {Object.entries(CATEGORIES).map(([cat, specs]) => (
               <Box key={cat}>
                 <Button
                   w="100%"
                   colorScheme={selectedCategory === cat ? "blue" : "gray"}
                   onClick={() => {
                     setSelectedCategory(cat)
                     setSelectedSpec(null)
                   }}
                   mb={2}
                 >
                   {cat}
                 </Button>
                 {selectedCategory === cat && (
                   <VStack align="stretch" pl={4} spacing={2}>
                     {specs.map((spec) => (
                       <Button
                         key={spec}
                         variant={selectedSpec === spec ? "solid" : "outline"}
                         colorScheme={selectedSpec === spec ? "blue" : "gray"}
                         onClick={() => setSelectedSpec(spec)}
                       >
                         {spec}
                       </Button>
                     ))}
                   </VStack>
                 )}
               </Box>
             ))}
           </VStack>
 
           {/* Center: Question editor */}
           <Flex flex="1" direction="column" align="center" p={4}>
             {selectedSpec ? (
               <>
                 <Text fontSize="xl" fontWeight="bold" mb={4}>
                   {selectedSpec} Questions
                 </Text>
 
                 {/* Input fields */}
                 <HStack mb={4} spacing={4} w="100%">
                   <Input
                     placeholder="Insert Question"
                     value={qInput}
                     onChange={(e) => setQInput(e.target.value)}
                   />
                   <Input
                     placeholder="Expected Result"
                     value={eInput}
                     onChange={(e) => setEInput(e.target.value)}
                   />
                   <IconButton
                     aria-label="Add"
                     icon={<AddIcon />}
                     colorScheme="green"
                     onClick={handleAdd}
                   />
                 </HStack>
 
                 {/* Question list */}
                 <VStack spacing={3} w="100%">
                   {currentQuestions.map((q) => (
                     <Flex
                       key={q.id}
                       w="100%"
                       p={3}
                       border="1px solid #ccc"
                       borderRadius="md"
                       justify="space-between"
                       align="center"
                       bg="white"
                     >
                       {q.editMode ? (
                         <HStack w="100%">
                           <Input
                             defaultValue={q.question}
                             onChange={(e) => (q.question = e.target.value)}
                           />
                           <Input
                             defaultValue={q.expected}
                             onChange={(e) => (q.expected = e.target.value)}
                           />
                           <IconButton
                             aria-label="Save"
                             icon={<CheckIcon />}
                             colorScheme="blue"
                             onClick={() =>
                               handleEditSave(q.id, q.question, q.expected)
                             }
                           />
                           <IconButton
                             aria-label="Cancel"
                             icon={<CloseIcon />}
                             onClick={() => handleEditToggle(q.id)}
                           />
                         </HStack>
                       ) : (
                         <>
                           <Box>
                             <Text fontWeight="bold">{q.question}</Text>
                             <Text color="gray.500" fontSize="sm">
                               Expected: {q.expected}
                             </Text>
                           </Box>
                           <HStack>
                             <IconButton
                               aria-label="Edit"
                               icon={<EditIcon />}
                               colorScheme="yellow"
                               onClick={() => handleEditToggle(q.id)}
                             />
                             <IconButton
                               aria-label="Delete"
                               icon={<DeleteIcon />}
                               colorScheme="red"
                               onClick={() => handleDelete(q.id)}
                             />
                           </HStack>
                         </>
                       )}
                     </Flex>
                   ))}
                 </VStack>
 
                 {/* Save button */}
                 {currentQuestions.length > 0 && (
                   <Button colorScheme="blue" mt={6} onClick={handleGenerate}>
                     Generate
                   </Button>
                 )}
 
                 {/* Generated Link */}
                 {generatedLinks[selectedSpec] && (
                   <Box mt={4} p={3} border="1px solid #ccc" borderRadius="md">
                     <Text fontWeight="bold">Candidate Link:</Text>
                     <Text color="blue.600">
                       {generatedLinks[selectedSpec]}
                     </Text>
                   </Box>
                 )}
               </>
             ) : (
               <Text color="gray.500">Select a specialization to start</Text>
             )}
           </Flex>
         </Flex>
       )}
 
       {/* Result View */}
       {!loading && tab === "result" && (
         <Flex flex="1" w="100%" align="center" justify="center" bg="white">
           <Text fontSize="lg" color="gray.500">
             Result view (coming soon)...
           </Text>
         </Flex>
       )}
       
     </Flex>
   )
 }
 