import React from "react";
import { BrowserRouter as Router, Navigate, Routes, Route } from "react-router-dom";
import { ThemeProvider } from "./context/ThemeContext.jsx";
import Home from "./pages/Home";
import PostJob from "./pages/PostJob";
import JobList from "./pages/JobList";
import Register from "./pages/Register";
import Login from "./pages/Login";
import Navbar from "./components/Navbar";
import { ErrorBoundary } from "./components/ErrorBoundary.jsx";
import Chat from "./pages/Chat";
import Reviews from "./pages/Reviews";
import About from "./pages/About";
import NotFound from "./pages/NotFound";
import Footer from "./components/Footer";
import Contests from "./pages/Contests";
import Exchange from "./pages/Exchange";
import Profile from "./pages/Profile";
import Settings from "./pages/Settings";
import JobDetails from "./pages/JobDetails";
import JobApply from "./pages/JobApply";
import MyApplications from "./pages/MyApplications";
import UserPortfolio from "./pages/UserPortfolio";
import CalendarPage from "./pages/Calendar";
import Moderation from "./pages/Moderation";

function App() {
  return (
    <ThemeProvider>
      <Router>
        <div className="app-shell">
          <Navbar />
          <main className="app-content">
            <ErrorBoundary>
            <Routes>
              <Route path="/" element={<Home />} />
              <Route path="/about" element={<About />} />
              <Route path="/contests" element={<Contests />} />
              <Route path="/exchange" element={<Exchange />} />
              <Route path="/post-job" element={<PostJob />} />
              <Route path="/jobs" element={<JobList />} />
              <Route path="/jobs/:jobId/apply" element={<JobApply />} />
              <Route path="/jobs/:jobId" element={<JobDetails />} />
              <Route path="/my-applications" element={<MyApplications />} />
              <Route path="/u/:userId/portfolio" element={<UserPortfolio />} />
              <Route path="/calendar" element={<CalendarPage />} />
              <Route path="/moderation" element={<Moderation />} />
              <Route path="/dashboard" element={<Navigate to="/profile?tab=jobs" replace />} />
              <Route path="/profile" element={<Profile />} />
              <Route path="/settings" element={<Settings />} />
              <Route path="/chat" element={<Chat />} />
              <Route path="/reviews" element={<Reviews />} />
              <Route path="/register" element={<Register />} />
              <Route path="/login" element={<Login />} />
              <Route path="*" element={<NotFound />} />
            </Routes>
            </ErrorBoundary>
          </main>
          <Footer />
        </div>
      </Router>
    </ThemeProvider>
  );
}

export default App;
