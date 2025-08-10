// access.decorator.ts
import { jwtVerify } from 'jose';

const JWT_SECRET = new TextEncoder().encode('your-secret-key');

interface RequestWithUser {
  headers: Record<string, string>;
  user?: any;
}

/**
 * Минималистичный декоратор для проверки JWT
 */
export function Access(target: any, propertyName: string, descriptor: PropertyDescriptor) {
  const originalMethod = descriptor.value;

  descriptor.value = async function (...args: any[]) {
    const [req, res] = args as [RequestWithUser, any];

    try {
      const token = req.headers.authorization?.replace('Bearer ', '') || req.headers.Authorization?.replace('Bearer ', '');
      
      if (!token) {
        return res.status(401).json({ error: 'No token' });
      }

      const { payload } = await jwtVerify(token, JWT_SECRET);
      req.user = payload;

      return await originalMethod.apply(this, args);
    } catch {
      return res.status(401).json({ error: 'Invalid token' });
    }
  };

  return descriptor;
}

// Пример использования
export class UserController {
  @Access
  async getProfile(req: RequestWithUser, res: any) {
    return res.json({ userId: req.user?.sub });
  }
}