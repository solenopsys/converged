import { SignJWT, jwtVerify, generateKeyPair, exportJWK } from 'jose';
import { createHash } from 'crypto';

// Генерируем ключи для подписи JWT
const { privateKey, publicKey } = await generateKeyPair('RS256');
const jwks = await exportJWK(publicKey);

// Хранилище клиентов и токенов
const clients = new Map();
const authCodes = new Map();
const tokens = new Map();

// Генерация случайных строк
const randomString = () => crypto.randomUUID();

// Проверка PKCE
function verifyPKCE(codeVerifier, codeChallenge) {
  if (!codeChallenge) return true;
  
  const hash = createHash('sha256')
    .update(codeVerifier)
    .digest('base64url');
  
  return hash === codeChallenge;
}

Bun.serve({
  port: process.env.PORT || 3001,
  
  async fetch(req) {
    const url = new URL(req.url);
    const path = url.pathname;

    console.log('\n📥 [AUTH]', req.method, path);

    const headers = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    };

    if (req.method === 'OPTIONS') {
      return new Response(null, { headers });
    }

    // OAuth Authorization Server Metadata - КЛЮЧЕВОЕ ИЗМЕНЕНИЕ
    if (path === '/.well-known/oauth-authorization-server' || path === '/.well-known/openid-configuration') {
      return new Response(JSON.stringify({
        issuer: 'https://auth.4ir.club',
        authorization_endpoint: 'https://auth.4ir.club/authorize',
        token_endpoint: 'https://auth.4ir.club/token',
        registration_endpoint: 'https://auth.4ir.club/register', // ← ДОБАВЛЕНО
        jwks_uri: 'https://auth.4ir.club/jwks',
        scopes_supported: ['openid', 'email', 'mcp:access'],
        response_types_supported: ['code'],
        grant_types_supported: ['authorization_code', 'refresh_token'],
        token_endpoint_auth_methods_supported: ['client_secret_basic', 'client_secret_post', 'none'], // ← ДОБАВЛЕНО 'none'
        code_challenge_methods_supported: ['S256'],
        subject_types_supported: ['public'],
        id_token_signing_alg_values_supported: ['RS256'],
        claims_supported: ['sub', 'email', 'iss', 'aud', 'exp', 'iat'],
      }), {
        headers: { ...headers, 'Content-Type': 'application/json' }
      });
    }

    if (path === '/jwks') {
      return new Response(JSON.stringify({
        keys: [{ ...jwks, kid: 'default', use: 'sig', alg: 'RS256' }]
      }), {
        headers: { ...headers, 'Content-Type': 'application/json' }
      });
    }

    if (path === '/register' && req.method === 'POST') {
      const body = await req.json();
      const clientId = randomString();
      const clientSecret = randomString();
      
      clients.set(clientId, {
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uris: body.redirect_uris || [],
        grant_types: body.grant_types || ['authorization_code'],
      });

      console.log('✅ Client registered:', clientId);
      return new Response(JSON.stringify({
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uris: body.redirect_uris || [],
        grant_types: body.grant_types || ['authorization_code'],
      }), {
        headers: { ...headers, 'Content-Type': 'application/json' }
      });
    }

    if (path === '/authorize') {
      const params = url.searchParams;
      const clientId = params.get('client_id');
      const redirectUri = params.get('redirect_uri');
      const state = params.get('state');
      const codeChallenge = params.get('code_challenge');
      const codeChallengeMethod = params.get('code_challenge_method');
      
      if (!clientId || !redirectUri) {
        return new Response('Missing client_id or redirect_uri', { status: 400 });
      }
      
      if (codeChallenge && codeChallengeMethod !== 'S256') {
        const errorUrl = new URL(redirectUri);
        errorUrl.searchParams.set('error', 'invalid_request');
        if (state) errorUrl.searchParams.set('state', state);
        return Response.redirect(errorUrl.toString(), 302);
      }
      
      const code = randomString();
      authCodes.set(code, {
        clientId,
        redirectUri,
        codeChallenge,
        userId: 'user1',
        expiresAt: Date.now() + 10 * 60 * 1000,
      });

      const callbackUrl = new URL(redirectUri);
      callbackUrl.searchParams.set('code', code);
      if (state) callbackUrl.searchParams.set('state', state);

      return Response.redirect(callbackUrl.toString(), 302);
    }

    if (path === '/token' && req.method === 'POST') {
      const contentType = req.headers.get('Content-Type');
      let body;
      
      if (contentType?.includes('application/json')) {
        body = await req.json();
      } else {
        const formData = await req.formData();
        body = Object.fromEntries(formData);
      }
      
      const grantType = body.grant_type;

      if (grantType === 'authorization_code') {
        const code = body.code;
        const clientId = body.client_id;
        const clientSecret = body.client_secret;
        const codeVerifier = body.code_verifier;

        const authCode = authCodes.get(code);
        if (!authCode || authCode.expiresAt < Date.now()) {
          return new Response(JSON.stringify({ error: 'invalid_grant' }), {
            status: 400,
            headers: { ...headers, 'Content-Type': 'application/json' }
          });
        }

        if (clientId !== authCode.clientId) {
          return new Response(JSON.stringify({ error: 'invalid_client' }), {
            status: 401,
            headers: { ...headers, 'Content-Type': 'application/json' }
          });
        }

        const client = clients.get(clientId);
        if (client && client.client_secret && client.client_secret !== clientSecret) {
          return new Response(JSON.stringify({ error: 'invalid_client' }), {
            status: 401,
            headers: { ...headers, 'Content-Type': 'application/json' }
          });
        }

        // PKCE валидация
        if (authCode.codeChallenge) {
          if (!codeVerifier) {
            return new Response(JSON.stringify({ 
              error: 'invalid_grant',
              error_description: 'code_verifier required'
            }), {
              status: 400,
              headers: { ...headers, 'Content-Type': 'application/json' }
            });
          }
          
          if (!verifyPKCE(codeVerifier, authCode.codeChallenge)) {
            return new Response(JSON.stringify({ 
              error: 'invalid_grant',
              error_description: 'invalid code_verifier'
            }), {
              status: 400,
              headers: { ...headers, 'Content-Type': 'application/json' }
            });
          }
          
          console.log('✅ PKCE verified');
        }

        const accessToken = await new SignJWT({
          sub: authCode.userId,
          email: 'stub@example.com',
          scope: 'openid email mcp:access',
        })
          .setProtectedHeader({ alg: 'RS256', kid: 'default' })
          .setIssuer('https://auth.4ir.club')
          .setAudience('https://mcp.4ir.club')
          .setExpirationTime('2h')
          .setIssuedAt()
          .sign(privateKey);

        const refreshToken = randomString();
        tokens.set(refreshToken, {
          clientId,
          userId: authCode.userId,
        });

        authCodes.delete(code);

        console.log('✅ Access token issued');
        return new Response(JSON.stringify({
          access_token: accessToken,
          token_type: 'Bearer',
          expires_in: 7200,
          refresh_token: refreshToken,
          scope: 'openid email mcp:access',
        }), {
          headers: { ...headers, 'Content-Type': 'application/json' }
        });
      }

      if (grantType === 'refresh_token') {
        const refreshToken = body.refresh_token;
        const tokenData = tokens.get(refreshToken);

        if (!tokenData) {
          return new Response(JSON.stringify({ error: 'invalid_grant' }), {
            status: 400,
            headers: { ...headers, 'Content-Type': 'application/json' }
          });
        }

        const accessToken = await new SignJWT({
          sub: tokenData.userId,
          email: 'stub@example.com',
          scope: 'openid email mcp:access',
        })
          .setProtectedHeader({ alg: 'RS256', kid: 'default' })
          .setIssuer('https://auth.4ir.club')
          .setAudience('https://mcp.4ir.club')
          .setExpirationTime('2h')
          .setIssuedAt()
          .sign(privateKey);

        return new Response(JSON.stringify({
          access_token: accessToken,
          token_type: 'Bearer',
          expires_in: 7200,
          scope: 'openid email mcp:access',
        }), {
          headers: { ...headers, 'Content-Type': 'application/json' }
        });
      }

      return new Response(JSON.stringify({ error: 'unsupported_grant_type' }), {
        status: 400,
        headers: { ...headers, 'Content-Type': 'application/json' }
      });
    }

    return new Response('Not Found', { status: 404 });
  }
});

console.log(`🔐 OAuth сервер на порту ${process.env.PORT || 3001}`);