import React from "react";
import { BrowserRouter as Router, Navigate, Routes, Route } from "react-router-dom";
import Home from "./pages/Home";
import PostJob from "./pages/PostJob";
import JobList from "./pages/JobList";
import Register from "./pages/Register";
import Login from "./pages/Login";
import Navbar from "./components/Navbar";
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

function App() {
  return (
    <Router>
      <div className="app-shell">
        <Navbar />
        <main className="app-content">
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/about" element={<About />} />
            <Route path="/contests" element={<Contests />} />
            <Route path="/exchange" element={<Exchange />} />
            <Route path="/post-job" element={<PostJob />} />
            <Route path="/jobs" element={<JobList />} />
            <Route path="/jobs/:jobId" element={<JobDetails />} />
            <Route path="/dashboard" element={<Navigate to="/profile?tab=jobs" replace />} />
            <Route path="/profile" element={<Profile />} />
            <Route path="/settings" element={<Settings />} />
            <Route path="/chat" element={<Chat />} />
            <Route path="/reviews" element={<Reviews />} />
            <Route path="/register" element={<Register />} />
            <Route path="/login" element={<Login />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </main>
        <Footer />
      </div>
    </Router>
  );
}

export default App;
