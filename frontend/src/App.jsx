import { BrowserRouter, Routes, Route } from "react-router-dom";
import HomePage from "./layout/HomePage";
import SimilarityPage from "./layout/SimilarityPage";
import CyclizationPage from "./layout/CyclizationPage";
import PdbPage from "./layout/PdbPage";
// import NotFound from "./pages/NotFound";

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<HomePage />} />

        <Route path="/pdb/:pdbId" element={<PdbPage />} />
        <Route
          path="/similarity/:pdbId/:threshold"
          element={<SimilarityPage />}
        />

        <Route
          path="/cyclization/:pdbId/:cyclization"
          element={<CyclizationPage />}
        />

        {/* <Route path="*" element={<NotFound />} /> */}
      </Routes>
    </BrowserRouter>
  );
}
