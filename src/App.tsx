import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { useAuth } from './auth';
import { isConfigured } from './supabase';
import Layout from './components/Layout';
import Spinner from './components/Spinner';
import Login from './pages/Login';
import Register from './pages/Register';
import ForgotPassword from './pages/ForgotPassword';
import ResetPassword from './pages/ResetPassword';
import Dashboard from './pages/Dashboard';
import StartWorkout from './pages/StartWorkout';
import WorkoutSession from './pages/WorkoutSession';
import ExercisePicker from './pages/ExercisePicker';
import ExerciseLog from './pages/ExerciseLog';
import History from './pages/History';
import AnalyticsList from './pages/AnalyticsList';
import ExerciseAnalytics from './pages/ExerciseAnalytics';
import BodyWeight from './pages/BodyWeight';
import ProfilePage from './pages/Profile';
import Settings from './pages/Settings';

function Protected({ children }: { children: JSX.Element }) {
  const { session, loading } = useAuth();
  const loc = useLocation();
  if (loading) return <Spinner />;
  if (!session) return <Navigate to="/login" replace state={{ from: loc.pathname }} />;
  return children;
}

export default function App() {
  const { session, loading, recovering } = useAuth();

  if (!isConfigured) {
    return (
      <div className="page no-nav">
        <h1>Setup needed</h1>
        <p className="sub">
          Add your Supabase details to a <code>.env</code> file (copy <code>.env.example</code>), then restart. See README.md.
        </p>
      </div>
    );
  }
  if (loading) return <Spinner />;
  if (recovering) return <ResetPassword />;

  return (
    <Routes>
      <Route path="/login" element={session ? <Navigate to="/" replace /> : <Login />} />
      <Route path="/register" element={session ? <Navigate to="/" replace /> : <Register />} />
      <Route path="/forgot-password" element={<ForgotPassword />} />
      <Route path="/reset-password" element={<ResetPassword />} />

      <Route element={<Protected><Layout /></Protected>}>
        <Route path="/" element={<Dashboard />} />
        <Route path="/start" element={<StartWorkout />} />
        <Route path="/workout/:sessionId" element={<WorkoutSession />} />
        <Route path="/workout/:sessionId/add" element={<ExercisePicker />} />
        <Route path="/workout/:sessionId/exercise/:weId" element={<ExerciseLog />} />
        <Route path="/history" element={<History />} />
        <Route path="/progress" element={<AnalyticsList />} />
        <Route path="/progress/:exerciseId" element={<ExerciseAnalytics />} />
        <Route path="/body-weight" element={<BodyWeight />} />
        <Route path="/profile" element={<ProfilePage />} />
        <Route path="/settings" element={<Settings />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
