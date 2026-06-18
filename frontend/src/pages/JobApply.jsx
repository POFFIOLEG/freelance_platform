import { Link, Navigate, useParams } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";

const JobApply = () => {
  const { jobId } = useParams();
  const { token, user } = useAuth();

  if (!jobId) {
    return (
      <div className="page">
        <div className="card">
          <p>Задание не указано.</p>
          <Link to="/jobs">К списку</Link>
        </div>
      </div>
    );
  }

  if (!token) {
    return <Navigate to="/login" replace state={{ from: `/jobs/${jobId}/apply` }} />;
  }

  if (user?.role !== "worker") {
    return (
      <div className="page">
        <div className="card">
          <p>Отклики доступны исполнителям.</p>
          <Link to={`/jobs/${jobId}`}>К заданию</Link>
        </div>
      </div>
    );
  }

  return <Navigate to={`/jobs/${jobId}#job-apply`} replace />;
};

export default JobApply;
