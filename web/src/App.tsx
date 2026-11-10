import { signInWithPopup, signOut } from "firebase/auth";
import { useAuth } from "./hooks/useAuth";
import { auth, googleProvider } from "./lib/firebase";
import { Board } from "./pages/Board";

export default function App() {
  const { user, role, loading, isStaff } = useAuth();

  if (loading) return <div className="center">Loading…</div>;

  if (!user) {
    return (
      <div className="center login">
        <h1>Ops Desk</h1>
        <p>Support requests for the operations team.</p>
        <button onClick={() => signInWithPopup(auth, googleProvider)}>Sign in with Google</button>
      </div>
    );
  }

  return (
    <>
      <nav className="top">
        <strong>Ops Desk</strong>
        <span className="role">{role}</span>
        <span className="grow" />
        <span>{user.displayName}</span>
        <button className="ghost" onClick={() => signOut(auth)}>Sign out</button>
      </nav>
      <Board isStaff={isStaff} />
    </>
  );
}
