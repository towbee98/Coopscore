import { useState, type SubmitEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api, ApiClientError } from "../api/client.ts";
import { setSession } from "../lib/auth.ts";
import { Button } from "../components/ui/Button.tsx";
import { Input, PasswordInput } from "../components/ui/Input.tsx";
import { CoopScoreLogo } from "../components/icons.tsx";

export function Login() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const { token, cooperative } = await api.login({ email, password });
      setSession(token, cooperative);
      navigate("/", { replace: true });
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Something went wrong");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-neutral-50 px-4">
      <div className="mb-6 flex flex-col items-center gap-2">
        <CoopScoreLogo className="h-9 w-9 text-primary-700" />
        <h1 className="text-2xl font-bold text-primary-700">CoopScore</h1>
      </div>

      <form onSubmit={handleSubmit} className="w-full max-w-sm rounded-lg border border-neutral-200 bg-white p-6 shadow-sm">
        <h2 className="mb-5 text-center text-lg font-bold text-neutral-950">Manager Login</h2>

        <div className="flex flex-col gap-4">
          <Input
            label="Email Address"
            type="email"
            name="email"
            placeholder="admin@cooperative.org"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          <PasswordInput
            label="Password"
            name="password"
            placeholder="••••••••"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </div>

        {error && <p className="mt-4 text-sm text-red-600">{error}</p>}

        <Button type="submit" className="mt-5 w-full" disabled={submitting}>
          {submitting ? "Logging in…" : "Log in"}
        </Button>
      </form>

      <p className="mt-5 text-sm text-neutral-500">
        Don't have a cooperative account?{" "}
        <Link to="/signup" className="font-semibold text-primary-700">
          Sign up.
        </Link>
      </p>
    </div>
  );
}
