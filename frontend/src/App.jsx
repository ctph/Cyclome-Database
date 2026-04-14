import { BrowserRouter, Routes, Route } from "react-router-dom";
import HomePage from "./layout/HomePage";
import SimilarityPage from "./layout/SimilarityPage";
import CyclizationPage from "./layout/CyclizationPage";
import PdbPage from "./layout/PdbPage";
import CyclicSequenceSimilarityPage from "./layout/CyclicSequenceSimilarityPage";
import CritiCLPage from "./layout/CritiCLPage";
import Stop2MeltPage from "./layout/Stop2MeltPage";
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

        <Route
          path="/cyclic-sequence-similarity"
          element={<CyclicSequenceSimilarityPage />}
        />

        <Route
          path="/criticl"
          element={<CritiCLPage />}
        />

        <Route
          path="/stop2melt"
          element={<Stop2MeltPage />}
        />

        {/* <Route path="*" element={<NotFound />} /> */}
      </Routes>
    </BrowserRouter>
  );
}
