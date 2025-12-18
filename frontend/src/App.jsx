import { BrowserRouter, Routes, Route } from "react-router-dom";
import HomePage from "./layout/HomePage";
// import SimilarityPage from "./pages/SimilarityPage";
import PdbPage from "./layout/PdbPage";
// import NotFound from "./pages/NotFound";

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<HomePage />} />

        {/* <Route path="/similarity/:pdbId" element={<SimilarityPage />} /> */}

        <Route path="/pdb/:pdbId" element={<PdbPage />} />

        {/* <Route path="*" element={<NotFound />} /> */}
      </Routes>
    </BrowserRouter>
  );
}
