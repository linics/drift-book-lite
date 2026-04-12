import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { AdminLoginPage } from "./pages/AdminLoginPage.jsx";
import { BooksPage } from "./pages/BooksPage.jsx";
import { ReviewsPage } from "./pages/ReviewsPage.jsx";
import { FeaturedReviewsPage } from "./pages/FeaturedReviewsPage.jsx";
import { SensitiveWordsPage } from "./pages/SensitiveWordsPage.jsx";
import { AssetsPage } from "./pages/AssetsPage.jsx";
import { AdminGuard } from "./components/AdminLayout.jsx";

function AdminRoutes() {
  return (
    <AdminGuard>
      {({ token, setToken }) => (
        <Routes>
          <Route path="/books" element={<BooksPage token={token} onLogout={() => setToken("")} />} />
          <Route path="/reviews" element={<ReviewsPage token={token} onLogout={() => setToken("")} />} />
          <Route path="/featured" element={<FeaturedReviewsPage token={token} onLogout={() => setToken("")} />} />
          <Route path="/sensitive-words" element={<SensitiveWordsPage token={token} onLogout={() => setToken("")} />} />
          <Route path="/assets" element={<AssetsPage token={token} onLogout={() => setToken("")} />} />
          <Route path="*" element={<Navigate to="/books" replace />} />
        </Routes>
      )}
    </AdminGuard>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<AdminLoginPage />} />
        <Route path="/*" element={<AdminRoutes />} />
      </Routes>
    </BrowserRouter>
  );
}
