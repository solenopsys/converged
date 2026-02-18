import type { Meta, StoryObj } from "@storybook/react-vite";
import { useEffect } from "react";
import type { ReactNode } from "react";
import { LoginForm } from "../../../../front/microfrontends/mf-auth/src/components/LoginForm";

const mockFetch = async (input: RequestInfo | URL, init?: RequestInit) => {
  const url = typeof input === "string" ? input : input.toString();
  const body = init?.body ? JSON.parse(String(init.body)) : {};

  if (url.includes("/auth/send-link")) {
    return new Response(
      JSON.stringify({
        ok: true,
        message: `Magic link sent to ${body?.email ?? "user@example.com"}`,
      }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  }

  if (url.includes("/auth/login")) {
    return new Response(
      JSON.stringify({
        ok: true,
        token: "storybook-demo-token",
      }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  }

  return new Response(JSON.stringify({ ok: false }), {
    status: 404,
    headers: { "Content-Type": "application/json" },
  });
};

function MockedAuthFetch({ children }: { children: ReactNode }) {
  useEffect(() => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = mockFetch as typeof fetch;
    return () => {
      globalThis.fetch = originalFetch;
    };
  }, []);

  return <>{children}</>;
}

const meta = {
  title: "Auth/LoginForm",
  component: LoginForm,
  parameters: {
    layout: "fullscreen",
  },
  decorators: [
    (Story) => {
      return (
        <MockedAuthFetch>
          <div
            style={{
              minHeight: "100vh",
              display: "flex",
              justifyContent: "center",
              alignItems: "flex-start",
              padding: "24px",
              background:
                "radial-gradient(circle at 20% 20%, rgba(16,185,129,0.16), transparent 40%), linear-gradient(135deg, #0b1220 0%, #111827 55%, #031b16 100%)",
            }}
          >
            <div
              style={{
                width: "100%",
                maxWidth: "420px",
                height: "700px",
                border: "1px solid rgba(255,255,255,0.12)",
                borderRadius: "16px",
                overflow: "hidden",
                background: "rgba(2, 6, 23, 0.82)",
                backdropFilter: "blur(10px)",
              }}
            >
              <Story />
            </div>
          </div>
        </MockedAuthFetch>
      );
    },
  ],
  tags: ["autodocs"],
} satisfies Meta<typeof LoginForm>;

export default meta;

type Story = StoryObj<typeof meta>;

export const PanelMode: Story = {};
