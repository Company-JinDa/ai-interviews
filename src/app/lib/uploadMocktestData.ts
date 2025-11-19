// lib/uploadMocktestData.ts
import { initializeApp } from "firebase/app";
import { getFirestore, collection, doc, setDoc } from "firebase/firestore";

// Thay bằng config Firebase của bạn
const firebaseConfig = {
  apiKey: "AIzaSyCaWIB51m3m8Sv0u_jtvXEd41c064FhYak",
  authDomain: "ai-interview-5863c.firebaseapp.com",
  projectId: "ai-interview-5863c",
  storageBucket: "ai-interview-5863c.firebasestorage.app",
  messagingSenderId: "1077521349218",
  appId: "1:1077521349218:web:535a301576444405adaf3b",
  measurementId: "G-WEKJFC9Z58",
}

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

const mocktestData = [
  { level: "Intern", role: "Front-End", questions: ["What is HTML?", "Explain semantic tags", "Block vs Inline elements?", "What is CSS?", "How to include JS?"] },
  { level: "Intern", role: "Back-End", questions: ["What is an API?", "HTTP methods?", "What is JSON?", "Client vs Server?", "What is a database?"] },
  { level: "Intern", role: "Full-stack", questions: ["What is MERN?", "Frontend vs Backend?", "What is REST?", "Git basics?", "Deploy a web app?"] },

  { level: "Fresher", role: "Front-End", questions: ["What is React?", "useState vs useEffect?", "What is JSX?", "Virtual DOM?", "Props vs State?"] },
  { level: "Fresher", role: "Mobile", questions: ["React Native vs Flutter?", "What is Expo?", "Navigation in RN?", "How to style in RN?"] },

  { level: "Junior", role: "Front-End", questions: ["var, let, const difference?", "Event delegation?", "Flexbox vs Grid?", "React Hooks rules?", "useMemo vs useCallback?"] },
  { level: "Junior", role: "Back-End", questions: ["REST API principles?", "JWT vs Session?", "Database indexing?", "Error handling in Node.js?", "MVC pattern?"] },
  { level: "Junior", role: "DevOps", questions: ["What is Docker?", "Docker vs VM?", "CI/CD là gì?", "GitHub Actions?"] },

  { level: "Middle", role: "Front-End", questions: ["React Performance Optimization?", "Code splitting?", "React Query?", "SSR vs CSR?", "Accessibility (a11y)?"] },
  { level: "Middle", role: "Back-End", questions: ["Database transactions?", "OAuth2 flow?", "Rate limiting?", "Caching strategies?"] },
  { level: "Middle", role: "AI Engineer", questions: ["Supervised vs Unsupervised?", "What is CNN?", "Overfitting?", "Transfer Learning?"] },

  { level: "Senior", role: "Back-End", questions: ["Design URL shortener?", "Microservices patterns?", "Eventual consistency?", "CQRS + Event Sourcing?"] },
  { level: "Senior", role: "DevOps", questions: ["Kubernetes concepts?", "Blue-green deployment?", "Infrastructure as Code?", "Observability?"] },
  { level: "Senior", role: "Cyber security", questions: ["OWASP Top 10?", "SQL Injection prevention?", "XSS, CSRF?", "Zero Trust?"] },

  // Thêm bao nhiêu cũng được...
];

async function upload() {
  for (const item of mocktestData) {
    const id = `${item.level}_${item.role.replace(/ /g, "_")}`;
    await setDoc(doc(db, "mocktestData", id), {
      level: item.level,
      role: item.role,
      questions: item.questions,
      uploadedAt: new Date(),
    });
    console.log("Uploaded:", id);
  }
  console.log("HOÀN TẤT! ĐÃ UPLOAD", mocktestData.length, "bộ câu hỏi lên Firestore");
}

upload().catch(err => console.error("Lỗi:", err));