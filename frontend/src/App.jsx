import { BrowserRouter, Routes, Route } from "react-router-dom";
import HomePage from "./layout/HomePage";
import SearchPage from "./pages/SearchPage";
import SequenceDetailPage from "./pages/SequenceDetailPage";

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* First page */}
        <Route path="/" element={<HomePage />} />

        {/* Other pages */}
        <Route path="/search" element={<SearchPage />} />
        <Route path="/sequence/:id" element={<SequenceDetailPage />} />

        {/* 404 */}
        <Route path="*" element={<h2>404 — Page Not Found</h2>} />
      </Routes>
    </BrowserRouter>
  );
}
