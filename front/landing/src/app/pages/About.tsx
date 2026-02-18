import { Link } from "react-router-dom";
import { Button } from "front-core";

export function About() {
  return (
    <div className="min-h-screen">
      <div className="px-6 py-20">
        <h1 className="text-5xl font-bold mb-6">About</h1>
        <p className="text-xl text-slate-300 mb-8">
          This page is server-side rendered and hydrated on the client.
        </p>
        <Button asChild>
          <Link to="/">Back to Home</Link>
        </Button>
      </div>
    </div>
  );
}
