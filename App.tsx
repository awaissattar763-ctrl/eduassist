import React, { useState, useEffect } from "react";
import { createClient } from "@supabase/supabase-js";

// 🔥 YOUR SUPABASE CONFIG
const supabase = createClient(
  "https://flbbfwlyaunxjnvjoqek.supabase.co",
  "YOUR_ANON_KEY_HERE" // 👈 yahan apna key paste karo
);

export default function App() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [user, setUser] = useState<any>(null);
  const [isSignup, setIsSignup] = useState(false);

  // ✅ Check session
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setUser(data.session?.user || null);
    });

    const { data: listener } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setUser(session?.user || null);
      }
    );

    return () => {
      listener.subscription.unsubscribe();
    };
  }, []);

  // ✅ LOGIN / SIGNUP
  const handleAuth = async (e: any) => {
    e.preventDefault();

    if (isSignup) {
      const { error } = await supabase.auth.signUp({
        email,
        password,
      });
      if (error) return alert(error.message);
      alert("Signup successful! Check email.");
    } else {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      if (error) return alert(error.message);
      alert("Login successful");
    }
  };

  // ✅ LOGOUT
  const handleLogout = async () => {
    await supabase.auth.signOut();
  };

  // ================= UI =================

  if (!user) {
    return (
      <div style={{ padding: 40 }}>
        <h2>{isSignup ? "Signup" : "Login"}</h2>

        <form onSubmit={handleAuth}>
          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          <br /><br />

          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
          <br /><br />

          <button type="submit">
            {isSignup ? "Create Account" : "Login"}
          </button>
        </form>

        <br />

        <button onClick={() => setIsSignup(!isSignup)}>
          {isSignup ? "Already have account? Login" : "Create account"}
        </button>
      </div>
    );
  }

  return (
    <div style={{ padding: 40 }}>
      <h2>✅ Logged in</h2>
      <p>{user.email}</p>

      <button onClick={handleLogout}>Logout</button>
    </div>
  );
}
