import React from "react";
import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";
import Home from "./pages/Home";
import PostJob from "./pages/PostJob";
import JobList from "./pages/JobList";
import Register from "./pages/Register";
import Login from "./pages/Login";
import Navbar from "./components/Navbar";
import Dashboard from "./pages/Dashboard";
import Chat from "./pages/Chat";
import Reviews from "./pages/Reviews";
import About from "./pages/About";
import NotFound from "./pages/NotFound";
import Footer from "./components/Footer";
import Contests from "./pages/Contests";
import Exchange from "./pages/Exchange";

function App() {
  return (
    <Router>
      <Navbar />
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/about" element={<About />} />
        <Route path="/contests" element={<Contests />} />
        <Route path="/exchange" element={<Exchange />} />
        <Route path="/post-job" element={<PostJob />} />
        <Route path="/jobs" element={<JobList />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/profile" element={<Navigate to="/dashboard" replace />} />
        <Route path="/chat" element={<Chat />} />
        <Route path="/reviews" element={<Reviews />} />
        <Route path="/register" element={<Register />} />
        <Route path="/login" element={<Login />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
      <Footer />
    </Router>
  );
}

export default App;
