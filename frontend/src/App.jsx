import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AccountProvider } from "./account/AccountProvider";
import HomePage from "./layout/HomePage";
import SimilarityPage from "./layout/SimilarityPage";
import CyclizationPage from "./layout/CyclizationPage";
import PdbPage from "./layout/PdbPage";
import CyclicSequenceSimilarityPage from "./layout/CyclicSequenceSimilarityPage";
import CritiCLPage from "./layout/CritiCLPage";
import Stop2MeltPage from "./layout/Stop2MeltPage";
import HistoryPage from "./layout/HistoryPage";
// import NotFound from "./pages/NotFound";

export default function App() {
  return (
    <div className="cyclome-app">
      <BrowserRouter>
        <AccountProvider>
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

            <Route path="/history" element={<HistoryPage />} />

            {/* <Route path="*" element={<NotFound />} /> */}
          </Routes>
        </AccountProvider>
      </BrowserRouter>
    </div>
  );
}
